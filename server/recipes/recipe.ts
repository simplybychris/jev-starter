import type { z } from "zod";
import type { JevAnswers, JevQuestions, JevRequest } from "../jev.js";

/**
 * A recipe = one decision your app asks Jev about.
 * The questions live here on the server; the browser only sends the input.
 */
export interface Recipe<I, R> {
  /** URL segment: POST /api/recipes/<name>. */
  name: string;
  /** Validates the browser input before Jev is called. Always set max lengths. */
  input: z.ZodType<I>;
  /** Builds the Jev request: context (state: text or an object sent as JSON) and questions (English instructions). */
  build(input: I): { state: JevRequest["state"]; questions: JevQuestions };
  /** Turns Jev probabilities into the app's result. Thresholds and arithmetic live here. */
  interpret(answers: JevAnswers, input: I): R;
}

// The registry stores recipes with different input and result types.
export type AnyRecipe = Recipe<any, any>;
export type RecipeRegistry = ReadonlyMap<string, AnyRecipe>;

/** Helper that keeps the input and result types inferred. */
export function defineRecipe<I, R>(recipe: Recipe<I, R>): Recipe<I, R> {
  return recipe;
}

/** Builds the name -> recipe map and refuses duplicate names. */
export function registerRecipes(list: AnyRecipe[]): RecipeRegistry {
  const registry = new Map<string, AnyRecipe>();
  for (const recipe of list) {
    if (!/^[a-z0-9-]+$/.test(recipe.name)) {
      throw new Error(`Recipe name "${recipe.name}" must use lowercase letters, digits and dashes`);
    }
    if (registry.has(recipe.name)) throw new Error(`Duplicate recipe name "${recipe.name}"`);
    registry.set(recipe.name, recipe);
  }
  return registry;
}
