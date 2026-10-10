import { formatMs, formatUsd } from "../lib/format";

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
