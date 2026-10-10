import type { z } from "zod";
import type { JevAnswers, JevQuestions, JevRequest, JevResult } from "../jev.js";

/**
 * What a multi-call recipe gets in run(): the only way to reach Jev.
 * Every call checks the daily budget first and records its cost.
 */
export interface RecipeContext {
  /** One Jev request. */
  ask(request: JevRequest): Promise<JevResult>;
  /** Several Jev requests, at most `concurrency` in flight (default and maximum: 8), results in order. */
  askMany(requests: JevRequest[], options?: { concurrency?: number }): Promise<JevResult[]>;
}

interface RecipeBase<I> {
  /** URL segment: POST /api/recipes/<name>. */
  name: string;
  /** Validates the browser input before Jev is called. Always set max lengths and max array sizes. */
  input: z.ZodType<I>;
}

/**
 * Most recipes: one Jev request built from the input.
 * The questions live here on the server; the browser only sends the input.
 */
export interface SingleCallRecipe<I, R> extends RecipeBase<I> {
  /** Builds the Jev request: context (state: text or an object sent as JSON) and questions (English instructions). */
  build(input: I): { state: JevRequest["state"]; questions: JevQuestions };
  /** Turns Jev probabilities into the app's result. Thresholds and arithmetic live here. */
  interpret(answers: JevAnswers, input: I): R;
  run?: undefined;
}

/**
 * Recipes that need several Jev requests, e.g. more items than fit in one request (32k tokens).
 * Use ctx.ask() / ctx.askMany() only, so the daily budget and the cost badge stay correct.
 */
export interface MultiCallRecipe<I, R> extends RecipeBase<I> {
  run(input: I, ctx: RecipeContext): Promise<R>;
  build?: undefined;
  interpret?: undefined;
}

export type Recipe<I, R> = SingleCallRecipe<I, R> | MultiCallRecipe<I, R>;

// The registry stores recipes with different input and result types.
export type AnyRecipe = Recipe<any, any>;
export type RecipeRegistry = ReadonlyMap<string, AnyRecipe>;

/** Helper that keeps the input and result types inferred. Write either build + interpret, or run. */
export function defineRecipe<I, R>(recipe: SingleCallRecipe<I, R>): SingleCallRecipe<I, R>;
export function defineRecipe<I, R>(recipe: MultiCallRecipe<I, R>): MultiCallRecipe<I, R>;
export function defineRecipe<I, R>(recipe: Recipe<I, R>): Recipe<I, R> {
  return recipe;
}

/** Builds the name -> recipe map and refuses duplicate names or incomplete recipes. */
export function registerRecipes(list: AnyRecipe[]): RecipeRegistry {
  const registry = new Map<string, AnyRecipe>();
  for (const recipe of list) {
    const name = recipe.name;
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error(`Recipe name "${name}" must use lowercase letters, digits and dashes`);
    }
    if (registry.has(name)) throw new Error(`Duplicate recipe name "${name}"`);
    const singleCall = typeof recipe.build === "function" && typeof recipe.interpret === "function";
    if (!singleCall && typeof recipe.run !== "function") {
      throw new Error(`Recipe "${name}" needs build() and interpret(), or run()`);
    }
    registry.set(name, recipe);
  }
  return registry;
}
