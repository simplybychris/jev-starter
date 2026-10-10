import { Router } from "express";
import { z } from "zod";
import { BudgetExceededError, type DailyBudget } from "./budget.js";
import { createRecipeContext } from "./context.js";
import { JevError, type AskJev } from "./jev.js";
import type { RecipeRegistry } from "./recipes/recipe.js";

export interface RecipeRouterDeps {
  recipes: RecipeRegistry;
  askJev: AskJev;
  budget: DailyBudget;
  /** true only in local development: show upstream details instead of the short public message. */
  exposeErrorDetails: boolean;
}

function formatIssues(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const message = [...new Set(issues.map((issue) => issue.message))].join(" ");
  return { error: message || "Invalid input.", issues };
}

/**
 * POST /recipes/:name with the recipe input as JSON body.
 * Flow: validate -> Jev through the budgeted context -> interpret -> { result, ms, cost, costEstimated, calls }.
 */
export function createRecipeRouter({ recipes, askJev, budget, exposeErrorDetails }: RecipeRouterDeps): Router {
  const router = Router();

  router.post("/recipes/:name", async (req, res) => {
    const name = req.params.name;
    const recipe = recipes.get(name);
    if (!recipe) {
      res.status(404).json({ error: `There is no recipe "${name.slice(0, 60)}".` });
      return;
    }

    const parsed = recipe.input.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json(formatIssues(parsed.error));
      return;
    }

    const { context, summary } = createRecipeContext(askJev, budget);
    try {
      let result: unknown;
      if (recipe.run) {
        result = await recipe.run(parsed.data, context);
      } else {
        const jev = await context.ask(recipe.build(parsed.data));
        result = recipe.interpret(jev.answers, parsed.data);
      }
      res.json({ result, ...summary() });
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        res.status(402).json({ error: error.message });
        return;
      }
      if (error instanceof JevError) {
        console.warn(`[jev] ${name}: ${error.status} ${error.message}`);
        res.status(502).json({ error: exposeErrorDetails ? error.message : error.publicMessage });
        return;
      }
      console.error(`[recipe] ${name}:`, error);
      res.status(500).json({ error: "Internal server error. Please try again later." });
    }
  });

  return router;
}
