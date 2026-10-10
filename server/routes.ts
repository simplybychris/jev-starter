import { Router } from "express";
import { z } from "zod";
import type { DailyBudget } from "./budget.js";
import { JevError, type AskJev } from "./jev.js";
import type { RecipeRegistry } from "./recipes/recipe.js";

// Polish messages for generic validation errors (custom messages in schemas still win).
z.config(z.locales.pl());

export interface RecipeRouterDeps {
  recipes: RecipeRegistry;
  askJev: AskJev;
  budget: DailyBudget;
}

function formatIssues(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const message = [...new Set(issues.map((issue) => issue.message))].join(" ");
  return { error: message || "Nieprawidłowe dane wejściowe.", issues };
}

/**
 * POST /recipes/:name with the recipe input as JSON body.
 * Flow: validate -> budget check -> Jev -> interpret -> { result, ms, cost }.
 */
export function createRecipeRouter({ recipes, askJev, budget }: RecipeRouterDeps): Router {
  const router = Router();

  router.post("/recipes/:name", async (req, res) => {
    const name = req.params.name;
    const recipe = recipes.get(name);
    if (!recipe) {
      res.status(404).json({ error: `Nie ma przepisu „${name.slice(0, 60)}”.` });
      return;
    }

    const parsed = recipe.input.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json(formatIssues(parsed.error));
      return;
    }

    if (budget.isExceeded()) {
      res.status(402).json({ error: budget.exceededMessage() });
      return;
    }

    try {
      const { state, questions } = recipe.build(parsed.data);
      const jev = await askJev({ state, questions });
      budget.record(jev.usage);
      const result = recipe.interpret(jev.answers, parsed.data);
      res.json({ result, ms: jev.ms, cost: jev.usage.cost });
    } catch (error) {
      if (error instanceof JevError) {
        console.warn(`[jev] ${name}: ${error.status} ${error.message}`);
        res.status(502).json({ error: error.message });
        return;
      }
      console.error(`[recipe] ${name}:`, error);
      res.status(500).json({ error: "Wewnętrzny błąd serwera. Szczegóły są w logach serwera." });
    }
  });

  return router;
}
