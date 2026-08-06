import { chromium } from "playwright-core";

const B = "http://127.0.0.1:3011";
const EXE = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOT_DIR;

// [route, email, outfile, dark?]
const JOBS = JSON.parse(process.argv[2]);

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const [route, email, file, dark] of JOBS) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200));
  });

  try {
    const r = await page.request.post(B + "/api/auth/login", {
      data: { email, password: "password123" },
    });
    const raw = r.headers()["set-cookie"] || "";
    const cookies = raw
      .split("\n")
      .map((l) => {
        const f = l.split(";")[0];
        const i = f.indexOf("=");
        return {
          name: f.slice(0, i).trim(),
          value: f.slice(i + 1).trim(),
          domain: "127.0.0.1",
          path: "/",
        };
      })
      .filter((c) => c.name);
    await ctx.addCookies(cookies);
    if (dark) {
      await ctx.addInitScript(() =>
        localStorage.setItem("prepai-theme", "dark"),
      );
    }

    await page.goto(B + route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(7000);
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    console.log(
      `OK  ${file}  ${route}  login=${r.status()}  errors=${errs.length ? errs.slice(0, 2).join(" | ") : "none"}`,
    );
  } catch (e) {
    console.log(`FAIL ${file} ${route}: ${e.message.slice(0, 160)}`);
  }
  await ctx.close();
}

await browser.close();
