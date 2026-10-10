import { BudgetExceededError, type DailyBudget } from "./budget.js";
import { askMany, type AskJev, type JevRequest, type JevResult } from "./jev.js";
import type { RecipeContext } from "./recipes/recipe.js";

export interface CallSummary {
  /** Time spent waiting for Jev. Several parallel calls count from the first start to the last end. */
  ms: number;
  /** Sum of the cost of all calls in USD. */
  cost: number;
  /** True when OpenRouter did not report the cost and it was estimated from tokens. */
  costEstimated: boolean;
  /** Number of Jev requests made for this API call. */
  calls: number;
}

/**
 * The only way recipes reach Jev: every call checks the daily budget first and records its cost.
 */
export function createRecipeContext(askJev: AskJev, budget: DailyBudget) {
  let calls = 0;
  let cost = 0;
  let costEstimated = false;
  let lastMs = 0;
  let firstStart: number | undefined;
  let lastEnd = 0;

  async function ask(request: JevRequest): Promise<JevResult> {
    if (budget.isExceeded()) throw new BudgetExceededError(budget.exceededMessage());
    const started = performance.now();
    firstStart ??= started;
    const result = await askJev(request);
    budget.record(result.usage);
    calls += 1;
    cost += result.usage.cost;
    costEstimated ||= Boolean(result.usage.costEstimated);
    lastMs = result.ms;
    lastEnd = Math.max(lastEnd, performance.now());
    return result;
  }

  const context: RecipeContext = {
    ask,
    askMany: (requests, options) => askMany(ask, requests, options),
  };

  function summary(): CallSummary {
    const ms = calls === 1 ? lastMs : Math.round(lastEnd - (firstStart ?? lastEnd));
    return { ms, cost: Math.round(cost * 1e10) / 1e10, costEstimated, calls };
  }

  return { context, summary };
}
