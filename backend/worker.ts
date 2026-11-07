import { q, pool } from "./db.ts";
import { ingest, mirrorDrive, mirrorPinecone, syncDrive } from "./documents.ts";
import { fullStudy } from "./research.ts";
import { runMonitor, schedulerTick } from "./monitor.ts";
import { processWhatsApp, summarizeMemory } from "./chat.ts";
import { waSend } from "./integrations.ts";
let stopped = false;
async function claim() {
  return (
    await q(
      `UPDATE jobs SET status='running',locked_at=now(),attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE status='pending' AND run_after<=now() ORDER BY run_after,created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
    )
  )[0];
}
async function execute(job: any) {
  switch (job.kind) {
    case "ingest":
      await ingest(job.payload.documentId);
      return { indexed: true };
    case "drive_upload":
      await mirrorDrive(job.payload.documentId);
      return { mirrored: true };
    case "pinecone":
      await mirrorPinecone(job.payload.documentId);
      return { indexed: true };
    case "drive_sync":
      return syncDrive();
    case "study":
      return fullStudy(job);
    case "monitor":
      return runMonitor(job.payload.monitorId);
    case "whatsapp":
      return processWhatsApp(job.payload.message);
    case "notify":
      return waSend(job.payload.phone, job.payload.text);
    case "memory_summary":
      await summarizeMemory(job.payload.owner);
      return { saved: true };
    default:
      throw new Error("Unknown job kind: " + job.kind);
  }
}
async function loop() {
  while (!stopped) {
    let job: any;
    try {
      job = await claim();
      if (!job) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const heartbeat = setInterval(
        () =>
          void q(
            `UPDATE jobs SET locked_at=now() WHERE id=$1 AND status='running'`,
            [job.id],
          ).catch(console.error),
        30000,
      );
      heartbeat.unref();
      try {
        const result = await execute(job);
        await q(
          `UPDATE jobs SET status='completed',result=$2,error=NULL WHERE id=$1`,
          [job.id, result || {}],
        );
      } catch (e: any) {
        const retry = job.attempts < 5;
        await q(
          `UPDATE jobs SET status=$2,error=$3,run_after=now()+($4*interval '1 second') WHERE id=$1`,
          [
            job.id,
            retry ? "pending" : "failed",
            e.message,
            Math.min(3600, 30 * 2 ** job.attempts),
          ],
        );
        console.error("Job failed", job.kind, job.id, e.message);
      } finally {
        clearInterval(heartbeat);
      }
    } catch (e) {
      console.error("Worker error", e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
export async function startWorkers() {
  await q(
    `UPDATE jobs SET status='pending' WHERE status='running' AND locked_at<now()-interval '5 minutes'`,
  );
  const recovery = setInterval(
    () =>
      void q(
        `UPDATE jobs SET status='pending',run_after=now() WHERE status='running' AND locked_at<now()-interval '5 minutes'`,
      ).catch(console.error),
    60000,
  );
  recovery.unref();
  let scheduling = false;
  const tick = async () => {
    if (scheduling) return;
    scheduling = true;
    try {
      await schedulerTick();
    } catch (e) {
      console.error("Scheduler error", e);
    } finally {
      scheduling = false;
    }
  };
  const timer = setInterval(() => void tick(), 30000);
  timer.unref();
  void tick();
  const workers = Array.from(
    {
      length: Math.max(
        1,
        Math.min(8, Number(process.env.WORKER_CONCURRENCY || 2)),
      ),
    },
    () => loop(),
  );
  return async () => {
    stopped = true;
    clearInterval(timer);
    clearInterval(recovery);
    await Promise.race([
      Promise.all(workers),
      new Promise((r) => setTimeout(r, 20000)),
    ]);
    await pool.end();
  };
}
