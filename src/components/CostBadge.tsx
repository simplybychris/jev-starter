const usdFormat = new Intl.NumberFormat("pl-PL", {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
});

/** 0.00002016 -> "0,000020 $" */
export function formatUsd(cost: number): string {
  return `${cost === 0 ? "0" : usdFormat.format(cost)} $`;
}

/** 312.4 -> "312 ms" */
export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

interface CostBadgeProps {
  /** Time of the Jev call in milliseconds. */
  ms: number;
  /** Cost of the Jev call in USD. */
  cost: number;
  label?: string;
}

/** Shows time and cost of a Jev call. Put it next to every result that comes from Jev. */
export function CostBadge({ ms, cost, label = "Na żywo" }: CostBadgeProps) {
  return (
    <div className="cost-badge" title="Czas odpowiedzi Jev i prawdziwy koszt zapytania z OpenRoutera">
      <span className="cost-badge__dot" aria-hidden="true" />
      <span>{label}</span>
      <span className="cost-badge__sep" aria-hidden="true">·</span>
      <span>{formatMs(ms)}</span>
      <span className="cost-badge__sep" aria-hidden="true">·</span>
      <span>{formatUsd(cost)}</span>
    </div>
  );
}
