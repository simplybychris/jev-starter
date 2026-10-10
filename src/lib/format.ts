const usdFormat = new Intl.NumberFormat("pl-PL", {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
});

/** 0.00002016 -> "0,000020 $" (non-breaking space before the unit). */
export function formatUsd(cost: number): string {
  return `${cost === 0 ? "0" : usdFormat.format(cost)}\u00a0$`;
}

/** 312.4 -> "312 ms" (non-breaking space before the unit). */
export function formatMs(ms: number): string {
  return `${Math.round(ms)}\u00a0ms`;
}

/** 0.964 -> "96%" */
export function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** 1 -> "1 zapytanie", 3 -> "3 zapytania", 5 -> "5 zapytań" */
export function formatRequests(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return "1 zapytanie";
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} zapytania`;
  return `${count} zapytań`;
}
