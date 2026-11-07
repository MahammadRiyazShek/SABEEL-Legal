export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/shamchabaz|shamsabad|shamshabaad/g, "shamshabad")
    .replace(/pida\s*shop|pedda\s*shahpur|pedashapur/g, "peddashahpur")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function fuzzyMatchDocument(query: string, documents: any[]) {
  const clean = normalize(query);
  if (!clean) return null;
  const tokens = clean.split(" ");
  const numbers = tokens.filter((t) => /^\d+$/.test(t));
  let best: any = null;
  for (const document of documents) {
    const title = normalize(
      document.title +
        " " +
        (document.uniqueTag || "") +
        " " +
        (document.village || "") +
        " " +
        (document.surveyNumber || ""),
    );
    const words = title.split(" ");
    if (numbers.some((n) => !words.includes(n))) continue;
    const score = title.includes(clean)
      ? 1
      : tokens.reduce(
          (sum, t) =>
            sum +
            Math.max(
              ...words.map(
                (w) => 1 - distance(t, w) / Math.max(t.length, w.length),
              ),
            ),
          0,
        ) / tokens.length;
    if (!best || score > best.score)
      best = {
        document,
        score,
        reason:
          score === 1
            ? "Exact title/tag match"
            : "Fuzzy title and identifier match",
      };
  }
  return best;
}
