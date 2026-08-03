// ─────────────────────────────────────────────────────────────────────────────
// LATEX COMPILATION — tectonic, out of process.
//
// tectonic rather than a texlive install: a single ~30MB static binary that
// fetches the packages a document actually needs into a local cache, instead of
// 2-4GB of distribution baked into every deploy image. The tradeoff is a slow
// FIRST compile on a cold cache (~15s, measured, mostly downloads) against ~3.7s
// warm. Both numbers are why callers cache the PDF bytes on the row and never
// compile inside a page render.
//
// The binary is not vendored — see resolveBinary() for how it is found and what
// happens when it is missing.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

/**
 * Compiled PDF bytes.
 *
 * `Uint8Array<ArrayBuffer>` and not `Buffer`: Prisma's `Bytes` column type
 * demands a view backed by a real ArrayBuffer, and Node's Buffer is
 * `Buffer<ArrayBufferLike>` — which may be a SharedArrayBuffer and so does not
 * satisfy it. Converting once here keeps that cast out of every caller.
 */
export type Pdf = Uint8Array<ArrayBuffer>;

export type CompileResult =
  | { ok: true; pdf: Pdf }
  | { ok: false; log: string };

/** Raised when tectonic isn't installed at all — an ops problem, not a TeX one. */
export class TectonicMissingError extends Error {
  constructor(searched: string[]) {
    super(
      `tectonic not found (looked in: ${searched.join(", ")}). ` +
        `Install it or set TECTONIC_BIN — see docs/resume-studio.md.`,
    );
    this.name = "TectonicMissingError";
  }
}

/**
 * Where the binary lives, in priority order: an explicit env override first so
 * a deploy can point at wherever its image put it, then the conventional
 * per-user install path, then bare `tectonic` for a PATH install.
 *
 * Deliberately NOT falling back to "compile without it" — a resume studio that
 * silently stops producing PDFs is worse than one that reports it can't.
 */
function resolveBinary(): string {
  const candidates = [
    process.env.TECTONIC_BIN,
    join(homedir(), ".local", "bin", "tectonic"),
    "/usr/local/bin/tectonic",
  ].filter((c): c is string => Boolean(c));

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Last resort: trust PATH. If it isn't there either, execFile reports ENOENT
  // and compile() turns that into TectonicMissingError.
  return "tectonic";
}

/** Compile timeout. A resume that hasn't built in 60s is not going to. */
const TIMEOUT_MS = 60_000;

/** How much of the TeX log to hand back on failure. */
const LOG_TAIL = 3_000;

/**
 * Compile a complete .tex document to PDF.
 *
 * Never throws on a LaTeX error — a document that doesn't build is an ordinary,
 * expected outcome here (the model wrote it), and the caller feeds the log back
 * to the model to fix. It throws only when the toolchain itself is broken,
 * which is not something a retry can help with.
 */
export async function compileLatex(tex: string): Promise<CompileResult> {
  const bin = resolveBinary();
  const dir = await mkdtemp(join(tmpdir(), "resume-"));
  const texPath = join(dir, "resume.tex");
  const pdfPath = join(dir, "resume.pdf");

  try {
    await writeFile(texPath, tex, "utf8");

    try {
      await run(bin, [
        "-X",
        "compile",
        texPath,
        "--outdir",
        dir,
        // The log file is the whole retry loop — it carries the line numbers
        // the model needs to fix its own output. Without this tectonic deletes
        // it on the way out and all we can report is "it failed".
        "--keep-logs",
        // Second line of defence behind sanitizeBody(): tectonic's own switch
        // for "this input came from somewhere I don't trust", which disables
        // shell-escape and the other known-insecure engine features outright.
        "--untrusted",
      ]);
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stderr?: string };
      if (e.code === "ENOENT") throw new TectonicMissingError([bin]);

      // A non-zero exit is a LaTeX error. Prefer the .log file: tectonic's
      // stderr is a summary, the log has the line numbers the model needs.
      const log = await readFile(join(dir, "resume.log"), "utf8").catch(
        () => e.stderr ?? e.message,
      );
      return { ok: false, log: tail(log) };
    }

    const pdf = await readFile(pdfPath).catch(() => null);
    if (!pdf || pdf.length === 0) {
      const log = await readFile(join(dir, "resume.log"), "utf8").catch(
        () => "tectonic exited cleanly but produced no PDF.",
      );
      return { ok: false, log: tail(log) };
    }

    // Copies into a fresh ArrayBuffer — see the Pdf type above.
    return { ok: true, pdf: new Uint8Array(pdf) };
  } finally {
    // Best-effort: a leaked temp dir is not worth failing a request over.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          Object.assign(err, { stderr: stderr || stdout });
          reject(err);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * The END of the log, not the start. TeX logs open with hundreds of lines of
 * package banners and close with the actual error — a head-truncated log is
 * almost always the useless half.
 *
 * The diagnosis is hoisted above the raw tail. Even a correctly tail-truncated
 * log buries one `! LaTeX Error:` line under font-loading chatter, and the
 * model reads that chatter as context rather than as the thing to fix. Stating
 * the error first is the difference between a retry that repairs the document
 * and one that reshuffles it.
 */
function tail(log: string): string {
  const trimmed = log.trim();

  // `!` opens a TeX error; `l.NN` is the line it died on. Both are what a human
  // would scroll to find.
  const diagnosis = trimmed
    .split("\n")
    .filter((l) => /^!|^l\.\d+/.test(l))
    .slice(0, 12)
    .join("\n");

  const body =
    trimmed.length <= LOG_TAIL ? trimmed : `…\n${trimmed.slice(-LOG_TAIL)}`;

  return diagnosis ? `${diagnosis}\n\n--- full log tail ---\n${body}` : body;
}
