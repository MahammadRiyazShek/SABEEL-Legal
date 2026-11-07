import "dotenv/config";
import { migrate } from "./db.js";
import { startWorkers } from "./worker.js";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await migrate();
  const stop = await startWorkers();
  console.log(
    "SABEEL persistent worker running: OCR, ingestion, corpus studies, WhatsApp, Drive, monitors",
  );
  const shutdown = () => {
    void stop().finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
