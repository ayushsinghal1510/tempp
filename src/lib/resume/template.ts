// ─────────────────────────────────────────────────────────────────────────────
// RESUME TEMPLATE — the preamble the model is not allowed to touch.
//
// The single most important design decision in Resume Studio: the LLM writes
// the BODY only, and this file supplies everything around it. A model asked for
// a whole .tex file will, often enough to matter, invent a package that isn't
// in the TeX distribution, redefine \section three different ways across a
// conversation, or drop \end{document} — and every one of those is a hard
// compile failure the student sees as a broken product.
//
// Fixing the preamble collapses that failure surface to "did it write valid
// markup inside a document that already works", which is a far smaller ask and
// one that survives a dozen turns of edits without drifting.
//
// It is also the security boundary. `sanitizeBody` below is not a style check.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

/**
 * Loosely based on the widely-used "Jake's Resume" layout — one column, no
 * colour, ATS-readable, every package standard enough to be in any TeX
 * distribution. Deliberately conservative: this is a document that has to
 * survive being parsed by a recruiter's keyword scraper, not a design piece.
 */
const PREAMBLE = String.raw`\documentclass[letterpaper,11pt]{article}

\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{tabularx}
\usepackage[T1]{fontenc}
\usepackage[hidelinks]{hyperref}

\pagestyle{empty}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-0.6in}
\addtolength{\textheight}{1.2in}

\urlstyle{same}

% No \color here: the document is deliberately monochrome, and \color needs the
% xcolor package. Loading a package purely to restate the default black is how
% the rule silently broke every \section the first time this was written.
\titleformat{\section}{\vspace{-4pt}\scshape\raggedright\large}{}{0em}{}[\titlerule \vspace{-5pt}]

% ── Helpers the model is TOLD to use, so it never invents its own layout ──
% Keeping these here rather than letting the model write raw \hspace / \vspace
% is what makes spacing consistent across a resume that was edited twenty times.
\newcommand{\resumeItem}[1]{\item\small{#1 \vspace{-2pt}}}

\newcommand{\resumeHeading}[4]{%
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[2]{%
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeList}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeListEnd}{\end{itemize}}
\newcommand{\resumeBullets}{\begin{itemize}[leftmargin=0.3in, itemsep=0pt, parsep=0pt, topsep=2pt]}
\newcommand{\resumeBulletsEnd}{\end{itemize}\vspace{-5pt}}

\begin{document}
`;

const POSTAMBLE = String.raw`
\end{document}
`;

/**
 * Commands stripped from model output before compiling.
 *
 * `\input`, `\include`, `\InputIfFileExists` and `\openin` are the ones that
 * matter: tectonic runs with shell-escape off, so the model can't execute
 * anything, but `\input{/etc/passwd}` needs no shell — TeX will happily read a
 * file off the server's disk and typeset its contents into a PDF the student
 * then downloads. That is a file-disclosure primitive reachable by anyone who
 * can get the model to emit six characters, so it is closed here rather than
 * anywhere further downstream.
 *
 * `\write18` is defence in depth against a tectonic invoked with shell-escape
 * by some future caller. The structural ones (`\documentclass`, `\usepackage`,
 * `\begin{document}`) are here for a duller reason: a model that emits its own
 * preamble produces a document with two of everything, which fails to compile.
 */
const FORBIDDEN = [
  /\\input\b/gi,
  /\\include(?:only)?\b/gi,
  /\\InputIfFileExists\b/gi,
  /\\openin\b/gi,
  /\\read\b/gi,
  /\\write18\b/gi,
  /\\immediate\s*\\write\b/gi,
  /\\documentclass\b/gi,
  /\\usepackage\b/gi,
  /\\RequirePackage\b/gi,
  /\\begin\s*\{document\}/gi,
  /\\end\s*\{document\}/gi,
  /\\catcode\b/gi,
  /\\csname\b/gi,
];

/**
 * Strip anything the body is not allowed to contain.
 *
 * Neutralises rather than rejects: a body that trips one of these is usually a
 * model helpfully adding `\usepackage{xcolor}`, and failing the whole turn over
 * that would be worse for the student than quietly dropping the line. The
 * commands are replaced with a comment so the text stays on its own line and
 * can't fuse with what follows.
 */
export function sanitizeBody(tex: string): string {
  let out = tex;

  // Fenced code blocks are the single most common wrapper the model adds.
  out = out.replace(/^\s*```(?:latex|tex)?\s*\n?/i, "").replace(/```\s*$/, "");

  for (const pattern of FORBIDDEN) {
    out = out.replace(pattern, "% [removed] ");
  }

  return repairStructure(repairTypography(out)).trim();
}

/**
 * Repair the one structural mistake the model reliably makes.
 *
 * `\resumeBullets` opens a list nested INSIDE an entry, so it is only legal
 * after something that emitted an `\item` — a `\resumeHeading` or
 * `\resumeSubItem`. Put it straight after `\resumeList` and LaTeX aborts with
 * "Something's wrong--perhaps a missing \item".
 *
 * The model does this in the Skills section, where there is no heading to hang
 * bullets off, and it is a hard compile failure rather than a cosmetic one.
 * Inserting the missing `\item` is exactly what LaTeX is asking for, and the
 * outer list is declared with `label={}` so it adds no visible marker.
 */
function repairStructure(tex: string): string {
  return tex.replace(
    /(\\resumeList\b)(\s*)(?=\\resumeBullets\b)/g,
    "$1$2\\item{}$2",
  );
}

/**
 * Repair the characters that compile cleanly and then typeset as NOTHING.
 *
 * This is the nastiest bug class this product can have. There is no error, the
 * PDF renders, and the student sends an employer a resume reading
 * "idempotencykey layer" and "perlineitem query". Both were observed on the
 * first two resumes ever generated here, which is roughly a 100% hit rate —
 * prompt instructions help but cannot be the only defence.
 *
 * Two separate causes, same symptom:
 *
 *   \-        a DISCRETIONARY hyphen. Marks a permitted break point and prints
 *             only if the word actually breaks there. Models emit it believing
 *             a backslash "escapes" the hyphen; nothing needs escaping.
 *   U+2011    a non-breaking hyphen, and friends. Undefined in the T1 font
 *             encoding, so the engine drops the glyph and carries on.
 *
 * Everything here is a same-meaning ASCII substitution, so nothing the model
 * intended is lost.
 */
function repairTypography(tex: string): string {
  return (
    tex
      .replace(/\\-/g, "-")
      // Hyphens and dashes: U+2010 hyphen, U+2011 non-breaking hyphen,
      // U+2012 figure dash, U+2212 minus.
      .replace(/[‐‑‒−]/g, "-")
      // En/em dashes to their LaTeX ligatures, which is what they mean.
      .replace(/–/g, "--")
      .replace(/—/g, "---")
      // Curly quotes and apostrophes.
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, "''")
      // Non-breaking and other exotic spaces.
      .replace(/[    ]/g, " ")
      .replace(/…/g, "...")
      // Maths symbols the model reaches for when writing metrics. Undefined in
      // text mode, so they either abort the compile or vanish. Accented letters
      // are deliberately NOT touched — "José" and "Müller" are real names that
      // LaTeX handles correctly, and stripping them would corrupt the header.
      .replace(/≈/g, "$\\approx$")
      .replace(/×/g, "$\\times$")
      .replace(/≤/g, "$\\leq$")
      .replace(/≥/g, "$\\geq$")
      .replace(/→/g, "$\\rightarrow$")
      .replace(/°/g, "$^\\circ$")
      // `~` is a non-breaking space in LaTeX, but a model writing " ~400"
      // means "approximately". Only rewritten after whitespace: an intentional
      // tie such as `Fig.~1` is written WITHOUT a preceding space, so that
      // distinction is what keeps this from mangling real markup.
      .replace(/(^|\s)~(?=\d)/g, "$1$\\sim$")
      // `\~` is the tilde ACCENT command, so `\~400` sets a tilde over the 4.
      // Models reach for it after being told to escape special characters, and
      // it means the same "approximately" as the bare form above.
      .replace(/\\~\{?\}?(?=\d)/g, "$\\sim$")
  );
}

/** The model's body wrapped into a complete, compilable document. */
export function buildDocument(body: string): string {
  return PREAMBLE + sanitizeBody(body) + POSTAMBLE;
}

/**
 * The starting body for a student who has nothing yet. Compiles on its own, so
 * the studio always has something to render — an empty preview pane on first
 * load reads as broken, even when it's just empty.
 */
export function starterBody(name: string, email: string): string {
  return String.raw`\begin{center}
  {\Huge \scshape ${escapeText(name)}} \\ \vspace{2pt}
  \small ${escapeText(email)}
\end{center}

\section{Education}
\resumeList
  \resumeHeading{Your university}{Year -- Year}{Your degree}{City}
\resumeListEnd

\section{Experience}
\resumeList
  \resumeHeading{Role}{Dates}{Company}{City}
  \resumeBullets
    \resumeItem{Tell me about your work and I will write this properly.}
  \resumeBulletsEnd
\resumeListEnd`;
}

/**
 * Escape a plain string for use inside LaTeX text. Only for values WE inject
 * (a name pulled off the user row) — the model writes real LaTeX and must not
 * be run through this, or every command it wrote would be escaped into
 * literal text.
 */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}
