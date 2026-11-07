import test from "node:test";
import assert from "node:assert/strict";
import { supportsDate, supportsEntity } from "../backend/evidence.ts";
test("hearing dates must match the actual evidence quote", () => {
  assert.equal(
    supportsDate("2026-11-14", "Post on 14.11.2026 for hearing."),
    true,
  );
  assert.equal(
    supportsDate("2026-11-15", "Post on 14.11.2026 for hearing."),
    false,
  );
});
test("invalid calendar dates are rejected", () => {
  assert.equal(supportsDate("2026-02-30", "30.02.2026"), false);
  assert.equal(supportsDate(null, "14.11.2026"), false);
});
test("ISO and written-month dates are supported", () => {
  assert.equal(supportsDate("2026-11-14", "Next hearing: 2026-11-14"), true);
  assert.equal(supportsDate("2026-11-14", "List on 14th November 2026"), true);
  assert.equal(supportsDate("2026-11-14", "November 14, 2026"), true);
});
test("a quote about Alice cannot support a Bob entity", () => {
  assert.equal(supportsEntity("Bob Example", "Alice Example appeared"), false);
  assert.equal(supportsEntity("Alice Example", "Alice Example appeared"), true);
});
test("case identifier validation accepts legal punctuation without numeric substring collisions", () => {
  assert.equal(supportsEntity("WP 1234/2026", "W.P. No. 1234 of 2026"), true);
  assert.equal(supportsEntity("626", "Survey 1626"), false);
});
