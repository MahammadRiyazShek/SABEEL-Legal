import test from "node:test";
import assert from "node:assert/strict";
import { chunkPages, extract } from "../backend/documents.ts";
import { chunkBlocks, filters } from "../backend/research.ts";
import {
  localSlot,
  tomorrowISO,
  dateMarker,
  verifyListing,
} from "../backend/monitor.ts";
import { normalize, distance, fuzzyMatchDocument } from "../backend/matcher.ts";
import {
  isPublicIP,
  validateURL,
  allowedPhone,
} from "../backend/integrations.ts";
import { vector } from "../backend/db.ts";

test("page-aware overlapping chunks preserve every page and stable ordinal", () => {
  const chunks = chunkPages(["abcdefghijklmno", "second page"], 10, 2);
  assert.equal(chunks.length, 4);
  assert.equal(chunks[0].page, 1);
  assert.equal(chunks[2].page, 2);
  assert.deepEqual(
    chunks.map((c) => c.ordinal),
    [0, 1, 2, 3],
  );
  assert.equal(chunks[1].text, "ijklmno");
});
test("blank pages do not renumber actual PDF pages", () => {
  const c = chunkPages(["", "", "hello evidence"]);
  assert.equal(c[0].page, 3);
});
test("invalid chunk configuration cannot produce an infinite loop", () => {
  assert.throws(() => chunkPages(["text"], 10, 10));
  assert.throws(() => chunkPages(["text"], 0, 0));
});
test("large corpus blocks cover text well beyond a first-page sample", () => {
  const pages = ["FIRST" + "x".repeat(32000) + "TAIL", "SECOND_PAGE"];
  const blocks = chunkBlocks(pages);
  assert.ok(blocks.length >= 3);
  assert.ok(blocks.join("").includes("TAIL"));
  assert.ok(blocks.join("").includes("[p.2] SECOND_PAGE"));
});
test("scope filters are parameterized and never silently fall back to the corpus", () => {
  const f = filters(
    { village: "x' OR 1=1 --", documentIds: ["123"], surveyNumber: "626" },
    2,
  );
  assert.equal(f.values[1], "x' OR 1=1 --");
  assert.ok(!f.where.includes("OR 1=1"));
  assert.ok(f.where.includes("$2"));
  assert.ok(f.where.includes("$4"));
});
test("Asia/Kolkata scheduler day respects local midnight", () => {
  const now = new Date("2026-11-07T18:45:00Z");
  assert.deepEqual(localSlot("Asia/Kolkata", now), {
    day: "2026-11-08",
    time: "00:15",
  });
  assert.equal(tomorrowISO("Asia/Kolkata", now), "2026-11-09");
});
test("tomorrow handles calendar-year rollover", () =>
  assert.equal(
    tomorrowISO("UTC", new Date("2026-12-31T12:00:00Z")),
    "2027-01-01",
  ));
test("date marker replaces every date component", () =>
  assert.equal(
    dateMarker("CAUSELIST DD.MM.YYYY / YYYY-MM-DD", "2026-11-14"),
    "CAUSELIST 14.11.2026 / 2026-11-14",
  ));
test("missing publication date is unverified, not not-listed", () => {
  const r = verifyListing("WP 1234/2026 listed", "WP 1234/2026", "14.11.2026");
  assert.equal(r.status, "unverified");
  assert.equal(r.isListed, null);
});
test("punctuated case identifiers match in dated sources", () =>
  assert.equal(
    verifyListing(
      "CAUSELIST 14.11.2026 W.P. No. 1234/2026",
      "WP No 1234/2026",
      "14.11.2026",
    ).isListed,
    true,
  ));
test("similar longer case number does not become a false match", () =>
  assert.equal(
    verifyListing("14.11.2026 WP 11234/2026", "WP 1234/2026", "14.11.2026")
      .status,
    "not_found_in_source",
  ));
test("proper dated absence is scoped to configured source", () => {
  const r = verifyListing(
    "14.11.2026 WP 9999/2026",
    "WP 1234/2026",
    "14.11.2026",
  );
  assert.equal(r.isListed, false);
  assert.ok(r.remarks.includes("not a claim about every court list"));
});
test("phonetic document retrieval handles screenshot transcription error", () => {
  const docs = [
    { id: "1", title: "Shamshabad 626.pdf", surveyNumber: "626" },
    { id: "2", title: "Shamshabad 627.pdf", surveyNumber: "627" },
  ];
  assert.equal(fuzzyMatchDocument("shamchabaz 626", docs)?.document.id, "1");
  assert.equal(fuzzyMatchDocument("shamchabaz 999", docs), null);
});
test("generic fuzzy matching is not limited to named villages", () => {
  const d = fuzzyMatchDocument("moinabd 88", [
    { id: "a", title: "Moinabad 88 title deed" },
  ]);
  assert.ok(d && d.score > 0.8);
  assert.equal(distance("abc", "abc"), 0);
  assert.equal(normalize("Pida Shop"), "peddashahpur");
});
test("retrieval empty query has no match", () =>
  assert.equal(fuzzyMatchDocument("", [{ title: "anything" }]), null));
test("embeddings enforce 1536 finite dimensions", () => {
  assert.throws(() => vector([1, 2]));
  assert.throws(() => vector(Array(1536).fill(NaN)));
  assert.ok(vector(Array(1536).fill(0.01)).startsWith("["));
});
test("SSRF checks reject internal and loopback addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.1.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
  ])
    assert.equal(isPublicIP(ip), false, ip);
  assert.equal(isPublicIP("8.8.8.8"), true);
});
test("fetch validation rejects HTTP, credentials, custom ports and unknown hosts", async () => {
  for (const url of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:8000",
    "https://not-allowlisted.example",
  ])
    await assert.rejects(validateURL(url));
});
test("WhatsApp defaults to no authorized recipients", () => {
  const previous = process.env.WHATSAPP_ALLOWED_NUMBERS;
  process.env.WHATSAPP_ALLOWED_NUMBERS = "";
  assert.equal(allowedPhone("919999999999"), false);
  process.env.WHATSAPP_ALLOWED_NUMBERS = "919999999999";
  assert.equal(allowedPhone("+919999999999"), true);
  if (previous === undefined) delete process.env.WHATSAPP_ALLOWED_NUMBERS;
  else process.env.WHATSAPP_ALLOWED_NUMBERS = previous;
});
test("plain text extraction preserves input", async () => {
  const pages = await extract(
    Buffer.from("A real plain text document."),
    "text/plain",
    "notes.txt",
  );
  assert.deepEqual(pages, ["A real plain text document."]);
});

test("XLSX extraction preserves worksheet names, rows and values", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Revenue History");
  sheet.addRow(["Village", "Survey", "Owner"]);
  sheet.addRow(["Shamshabad", 626, "Example owner"]);
  const pages = await extract(
    Buffer.from(await workbook.xlsx.writeBuffer()),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "history.xlsx",
  );
  assert.equal(pages.length, 1);
  assert.match(pages[0], /Revenue History/);
  assert.match(pages[0], /Shamshabad.*626.*Example owner/);
});
