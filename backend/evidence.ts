export function supportsDate(iso: unknown, quote: unknown) {
  if (
    typeof iso !== "string" ||
    typeof quote !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(iso)
  )
    return false;
  const parsed = new Date(iso + "T12:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== iso
  )
    return false;
  const [y, m, d] = iso.split("-").map(Number);
  const candidates = [
    ...quote.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g),
  ].map((a) => [+a[1], +a[2], +a[3]]);
  for (const a of quote.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g))
    candidates.push([+a[3], +a[2], +a[1]]);
  if (candidates.some((a) => a[0] === y && a[1] === m && a[2] === d))
    return true;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const clean = quote
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/[,]/g, "");
  const month = months[m - 1];
  return new RegExp(
    `\\b(?:${d}\\s+(?:${month}|${month.slice(0, 3)})\\s+${y}|(?:${month}|${month.slice(0, 3)})\\s+${d}\\s+${y})\\b`,
    "i",
  ).test(clean);
}
export function supportsEntity(value: string, quote: string) {
  const compact = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const normalized = compact(quote);
  const numbers = new Set(quote.match(/\d+/g) || []);
  const words = value.match(/[\p{L}]+|\d+/gu) || [];
  return (
    words.length > 0 &&
    words.every((w) =>
      /^\d+$/.test(w) ? numbers.has(w) : normalized.includes(compact(w)),
    )
  );
}
