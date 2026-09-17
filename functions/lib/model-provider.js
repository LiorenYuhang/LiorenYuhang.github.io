export function parsePositiveInt(s, fallback) {
  if (typeof s === "number") return Number.isSafeInteger(s) && s > 0 ? s : fallback;
  if (typeof s !== "string" || !/^[1-9]\d*$/.test(s)) return fallback;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : fallback;
}
