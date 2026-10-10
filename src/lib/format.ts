const usdFormat = new Intl.NumberFormat("en-US", {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
});

/** 0.00002016 -> "$0.000020" */
export function formatUsd(cost: number): string {
  return `$${cost === 0 ? "0" : usdFormat.format(cost)}`;
}

/** 312.4 -> "312 ms" (non-breaking space before the unit). */
export function formatMs(ms: number): string {
  return `${Math.round(ms)}\u00a0ms`;
}

/** 0.964 -> "96%" */
export function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** 1 -> "1 request", 3 -> "3 requests" */
export function formatRequests(count: number): string {
  return count === 1 ? "1 request" : `${count} requests`;
}
