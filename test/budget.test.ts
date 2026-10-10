import { describe, expect, it } from "vitest";
import { DailyBudget } from "../server/budget.js";

const usage = (cost: number) => ({ input_tokens: 100, output_tokens: 10, cost });

describe("DailyBudget", () => {
  it("sums costs and reports when the limit is reached", () => {
    const budget = new DailyBudget(0.0001, () => new Date(2026, 9, 10, 12));
    expect(budget.isExceeded()).toBe(false);
    budget.record(usage(0.00006));
    expect(budget.isExceeded()).toBe(false);
    budget.record(usage(0.00006));
    expect(budget.isExceeded()).toBe(true);
    expect(budget.snapshot()).toMatchObject({
      day: "2026-10-10",
      requests: 2,
      inputTokens: 200,
      outputTokens: 20,
      spentUsd: 0.00012,
      limitUsd: 0.0001,
      remainingUsd: 0,
    });
  });

  it("resets at midnight server time", () => {
    let now = new Date(2026, 9, 10, 23, 59);
    const budget = new DailyBudget(0.0001, () => now);
    budget.record(usage(0.001));
    expect(budget.isExceeded()).toBe(true);

    now = new Date(2026, 9, 11, 0, 0, 1);
    expect(budget.isExceeded()).toBe(false);
    expect(budget.snapshot()).toMatchObject({ day: "2026-10-11", requests: 0, spentUsd: 0 });
  });

  it("explains the limit", () => {
    expect(new DailyBudget(2.5).exceededMessage()).toMatch(/daily Jev budget \(2\.5 USD\)/);
  });
});
