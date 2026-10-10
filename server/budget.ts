import type { JevUsage } from "./jev.js";

export interface BudgetSnapshot {
  /** Server-local date the counters refer to (YYYY-MM-DD). */
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
}

/** Thrown before a Jev call when the daily budget is used up (the route answers 402). */
export class BudgetExceededError extends Error {
  override name = "BudgetExceededError";
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const round = (value: number) => Math.round(value * 1e8) / 1e8;

/**
 * In-memory daily spend counter (sum of usage.cost from Jev).
 * Resets at midnight server time and on every server restart.
 */
export class DailyBudget {
  private day: string;
  private spentUsd = 0;
  private requests = 0;
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(
    readonly limitUsd: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.day = dayKey(now());
  }

  private rollOver(): void {
    const today = dayKey(this.now());
    if (today === this.day) return;
    this.day = today;
    this.spentUsd = 0;
    this.requests = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
  }

  isExceeded(): boolean {
    this.rollOver();
    return this.spentUsd >= this.limitUsd;
  }

  exceededMessage(): string {
    const limit = this.limitUsd.toLocaleString("en-US");
    return `The daily Jev budget (${limit} USD) has been used up. The app will work again after midnight (server time).`;
  }

  record(usage: JevUsage): void {
    this.rollOver();
    this.requests += 1;
    this.spentUsd += usage.cost;
    this.inputTokens += usage.input_tokens;
    this.outputTokens += usage.output_tokens;
  }

  snapshot(): BudgetSnapshot {
    this.rollOver();
    return {
      day: this.day,
      requests: this.requests,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      spentUsd: round(this.spentUsd),
      limitUsd: this.limitUsd,
      remainingUsd: round(Math.max(0, this.limitUsd - this.spentUsd)),
    };
  }
}
