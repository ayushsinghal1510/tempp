import { chromium } from "playwright-core";
const B = "http://127.0.0.1:3007";
const exe = "/home/zeus/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const target = process.argv[2], email = process.argv[3], shot = process.argv[4];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1700 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
const r = await page.request.post(B + "/api/auth/login", { data: { email, password: "password123" } });
const raw = r.headers()["set-cookie"] || "";
await ctx.addCookies(raw.split("\n").map((l) => { const f = l.split(";")[0]; const i = f.indexOf("="); return { name: f.slice(0, i).trim(), value: f.slice(i + 1).trim(), domain: "127.0.0.1", path: "/" }; }).filter((c) => c.name));
await page.goto(B + target, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
const info = await page.evaluate(() => ({
  rechartsSurfaces: document.querySelectorAll(".recharts-surface").length,
  lines: document.querySelectorAll(".recharts-line-curve, path.recharts-curve").length,
  refLines: document.querySelectorAll(".recharts-reference-line").length,
  headings: [...document.querySelectorAll("h3,h2")].map((h) => h.textContent.trim()).filter(Boolean).slice(0, 12),
}));
console.log("TARGET:", target);
console.log("recharts-surfaces:", info.rechartsSurfaces, "| line-curves:", info.lines, "| reference-lines(kinks):", info.refLines);
console.log("headings:", JSON.stringify(info.headings));
console.log("errors:", errs.length ? errs.join(" || ") : "none");
await page.screenshot({ path: shot, fullPage: true });
console.log("shot:", shot);
await browser.close();
