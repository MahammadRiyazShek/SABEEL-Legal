import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = process.env.BROWSER_TEST_DATABASE_URL;
if (!db)
  throw new Error(
    "Set BROWSER_TEST_DATABASE_URL to a separate empty pgvector-enabled test database.",
  );
const port = Number(process.env.BROWSER_TEST_PORT || 3198),
  base = `http://127.0.0.1:${port}`;
const app = spawn(process.execPath, ["--import", "tsx", "backend/server.ts"], {
  env: {
    ...process.env,
    DATABASE_URL: db,
    NODE_ENV: "production",
    PORT: String(port),
    APP_URL: base,
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    DRIVE_AUTO_SYNC: "false",
    GOOGLE_DRIVE_FOLDER_ID: "",
    WHATSAPP_ACCESS_TOKEN: "",
    TAVILY_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
app.stdout.on("data", (d) => (log += d));
app.stderr.on("data", (d) => (log += d));
let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/healthz")).ok) break;
    } catch {}
    if (app.exitCode !== null) throw new Error(log);
    await sleep(200);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("previews", { recursive: true });
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: /sign in|sign up|sign out/i })
      .count(),
    0,
  );
  await page
    .getByRole("heading", { name: "Your documents, working together." })
    .waitFor();
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "previews/workspace-desktop.png",
    fullPage: true,
  });
  const tabs = [
    ["Research Studio", "Research with an evidence trail."],
    ["Document Connections", "Follow the links between records."],
    ["Monitoring & Reminders", "Daily checks. Durable reminders."],
    ["Assistant & Memory", "SABEEL Assistant"],
    ["Integrations & Jobs", "Your deployment control room."],
  ];
  for (const [name, heading] of tabs) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Document Vault/ }).click();
  await page
    .getByRole("heading", { name: "Your documents, working together." })
    .waitFor();
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  assert.equal(overflow, false, "Mobile page must not overflow horizontally");
  await page.screenshot({
    path: "previews/workspace-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: no-login desktop, all six workspace screens, mobile 390px layout, no uncaught browser errors.",
  );
} finally {
  await browser?.close();
  if (app.exitCode === null) {
    const exited = new Promise((r) => app.once("exit", r));
    app.kill("SIGTERM");
    await Promise.race([exited, sleep(25000)]);
    if (app.exitCode === null) app.kill("SIGKILL");
  }
}
