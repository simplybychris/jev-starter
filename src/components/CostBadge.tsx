import { formatMs, formatRequests, formatUsd } from "../lib/format";

interface CostBadgeProps {
  /** Time spent waiting for Jev in milliseconds. */
  ms: number;
  /** Cost in USD (sum of all Jev requests behind this result). */
  cost: number;
  /** Number of Jev requests behind this result; shown when more than one. */
  calls?: number;
  /** True when OpenRouter did not report the cost and the server estimated it. */
  estimated?: boolean;
  label?: string;
}

/** Shows time and cost of a Jev call. Put it next to every result that comes from Jev. */
export function CostBadge({ ms, cost, calls = 1, estimated = false, label = "Na żywo" }: CostBadgeProps) {
  return (
    <div className="cost-badge" title="Czas odpowiedzi Jev i koszt zapytania z OpenRoutera">
      <span className="cost-badge__dot" aria-hidden="true" />
      <span>{label}</span>
      {calls > 1 && (
        <>
          <span className="cost-badge__sep" aria-hidden="true">·</span>
          <span>{formatRequests(calls)}</span>
        </>
      )}
      <span className="cost-badge__sep" aria-hidden="true">·</span>
      <span>{formatMs(ms)}</span>
      <span className="cost-badge__sep" aria-hidden="true">·</span>
      <span title={estimated ? "Koszt szacowany z liczby tokenów" : undefined}>
        {estimated ? "≈ " : ""}
        {formatUsd(cost)}
      </span>
    </div>
  );
}
