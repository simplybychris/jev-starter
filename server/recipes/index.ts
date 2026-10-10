import { demo } from "./demo.js";
import { registerRecipes } from "./recipe.js";

/** All recipes available at POST /api/recipes/<name>. Add new recipes to this list. */
export const recipes = registerRecipes([demo]);
