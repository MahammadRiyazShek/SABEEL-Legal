import { mkdir, writeFile } from "node:fs/promises";
const target = new URL(process.env.PUBLIC_APP_URL || "");
if (target.protocol !== "https:")
  throw new Error("PUBLIC_APP_URL must be your HTTPS backend URL");
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const href = escape(target.href);
await mkdir("pages", { recursive: true });
await writeFile(
  "pages/index.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${href}"><title>SABEEL Legal</title><body><h1>SABEEL Legal</h1><p>The workspace is hosted on its secure backend.</p><p><a href="${href}">Open SABEEL workspace</a></p></body></html>`,
);
await writeFile("pages/.nojekyll", "");
