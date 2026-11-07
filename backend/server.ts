import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app, { initializeDatabase } from "./app.js";
import { startWorkers } from "./worker.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function main() {
  await initializeDatabase();
  const stop =
    process.env.DISABLE_WORKERS === "true" ? undefined : await startWorkers();
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(root, "dist")));
    app.get("*", (_req, res) =>
      res.sendFile(path.join(root, "dist/index.html")),
    );
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("SABEEL no-login workspace ready"),
  );
  const shutdown = () => {
    server.close();
    void (stop ? stop() : Promise.resolve()).finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
