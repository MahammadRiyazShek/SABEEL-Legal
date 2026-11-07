import { load } from "cheerio";
import { q, id, enqueue, pool } from "./db.ts";
import { fetchSource, waSend, allowedPhone } from "./integrations.ts";
import { extract } from "./documents.ts";
export function localSlot(timezone: string, now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
export function tomorrowISO(timezone: string, now = new Date()) {
  const { day } = localSlot(timezone, now);
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function dateMarker(pattern: string, day: string) {
  const [y, m, d] = day.split("-");
  return pattern.replaceAll("YYYY", y).replaceAll("MM", m).replaceAll("DD", d);
}
export function verifyListing(text: string, match: string, marker: string) {
  if (!marker || !text.toLowerCase().includes(marker.toLowerCase()))
    return {
      status: "unverified",
      isListed: null,
      remarks:
        "Expected publication/date marker not found. This source does not verify the target list date.",
    };
  const chars = Array.from(match.replace(/[^\p{L}\p{N}]/gu, ""));
  const regex = new RegExp(
    "(?<![\\p{L}\\p{N}])" +
      chars.join("[^\\p{L}\\p{N}]*") +
      "(?![\\p{L}\\p{N}])",
    "iu",
  );
  const found = chars.length >= 3 && regex.test(text);
  return {
    status: found ? "found_in_source" : "not_found_in_source",
    isListed: found,
    remarks: found
      ? "Identifier found in the configured dated source. Review the linked entry."
      : "Identifier was not found in this configured dated source; this is not a claim about every court list.",
  };
}
export async function runMonitor(monitorId: string) {
  const m = (await q("SELECT * FROM monitors WHERE id=$1", [monitorId]))[0];
  if (!m) return { status: "removed" };
  const day = tomorrowISO(m.timezone);
  const url = m.url
    .replaceAll("{date}", day)
    .replaceAll("{YYYY}", day.slice(0, 4))
    .replaceAll("{MM}", day.slice(5, 7))
    .replaceAll("{DD}", day.slice(8, 10));
  let result: any;
  try {
    const source = await fetchSource(url);
    let text: string;
    if (source.mime.includes("pdf"))
      text = (await extract(source.bytes, "application/pdf")).join("\n");
    else if (source.mime.includes("html")) {
      const $ = load(source.bytes.toString());
      $("script,style,noscript").remove();
      text = $("body").text().replace(/\s+/g, " ");
    } else text = source.bytes.toString("utf8");
    if (
      /captcha|verify you are human|access denied/i.test(text) &&
      text.length < 15000
    )
      throw new Error(
        "Portal requires interactive access or returned a challenge page. Use an accessible official PDF/API/feed URL.",
      );
    const marker = dateMarker(m.date_pattern, day);
    const match = String(m.match_text);
    result = {
      ...verifyListing(text, match, marker),
      targetDate: day,
      url: source.url,
      checkedAt: new Date().toISOString(),
      dateMarker: marker,
    };
    const index = text.toLowerCase().indexOf(match.toLowerCase());
    if (index >= 0)
      result.evidence = text.slice(Math.max(0, index - 200), index + 600);
  } catch (e: any) {
    result = {
      status: "unverified",
      isListed: null,
      error: e.message,
      url,
      targetDate: day,
      checkedAt: new Date().toISOString(),
    };
  }
  // Persist the observation before delivery, so delivery retries never turn an unavailable source into "not listed".
  await q("INSERT INTO monitor_runs(id,monitor_id,result) VALUES($1,$2,$3)", [
    id(),
    monitorId,
    result,
  ]);
  await q("UPDATE monitors SET last_result=$2 WHERE id=$1", [
    monitorId,
    result,
  ]);
  if (m.phone) {
    const text = `SABEEL • ${m.title}\nTarget date: ${day}\n${result.status}\n${result.remarks || result.error}\n${url}`;
    await enqueue("notify", { phone: m.phone, text });
  }
  return result;
}
export async function schedulerTick() {
  const rows = await q("SELECT * FROM monitors WHERE enabled=true");
  for (const m of rows) {
    const slot = localSlot(m.timezone);
    if (slot.time < m.local_time || m.last_slot === slot.day) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = (
        await client.query(
          "SELECT last_slot FROM monitors WHERE id=$1 FOR UPDATE",
          [m.id],
        )
      ).rows[0];
      if (locked && locked.last_slot !== slot.day) {
        await client.query("UPDATE monitors SET last_slot=$2 WHERE id=$1", [
          m.id,
          slot.day,
        ]);
        await client.query(
          "INSERT INTO jobs(id,kind,payload) VALUES($1,$2,$3)",
          [id(), "monitor", { monitorId: m.id }],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const due = await q(
    `SELECT * FROM reminders WHERE done=false AND notified=false AND due_at<=now() ORDER BY due_at LIMIT 100`,
  );
  for (const r of due) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = (
        await client.query(
          "SELECT notified FROM reminders WHERE id=$1 FOR UPDATE",
          [r.id],
        )
      ).rows[0];
      if (row && !row.notified) {
        if (r.phone && allowedPhone(r.phone))
          await client.query(
            "INSERT INTO jobs(id,kind,payload) VALUES($1,$2,$3)",
            [
              id(),
              "notify",
              {
                phone: r.phone,
                text:
                  "SABEEL reminder: " +
                  r.title +
                  "\nDue: " +
                  new Date(r.due_at).toISOString(),
              },
            ],
          );
        await client.query("UPDATE reminders SET notified=true WHERE id=$1", [
          r.id,
        ]);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  // Optional daily incremental Drive import.
  if (process.env.DRIVE_AUTO_SYNC === "true") {
    const day = localSlot(process.env.DEFAULT_TIMEZONE || "Asia/Kolkata").day;
    const key = "drive_sync:" + day;
    const inserted = await q(
      `INSERT INTO settings(key,value) VALUES($1,'true') ON CONFLICT DO NOTHING RETURNING key`,
      [key],
    );
    if (inserted.length) await enqueue("drive_sync", {});
  }
}
