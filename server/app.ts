import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import express, { type ErrorRequestHandler, type Express } from "express";
import { rateLimit } from "express-rate-limit";
import type { DailyBudget } from "./budget.js";
import type { AskJev } from "./jev.js";
import type { RecipeRegistry } from "./recipes/recipe.js";
import { createRecipeRouter } from "./routes.js";

export interface AppOptions {
  askJev: AskJev;
  budget: DailyBudget;
  recipes: RecipeRegistry;
  model: string;
  rateLimitPerMinute: number;
  /** Folder with the built frontend (dist/). null = API only (dev mode, tests). */
  staticDir: string | null;
}

const handleApiErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  const type = (error as { type?: string }).type;
  if (type === "entity.too.large") {
    res.status(413).json({ error: "Za dużo danych w zapytaniu (limit to 20 kB)." });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "Nieprawidłowy JSON w zapytaniu." });
    return;
  }
  console.error("[api]", error);
  res.status(500).json({ error: "Wewnętrzny błąd serwera. Szczegóły są w logach serwera." });
};

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  // One reverse proxy (Caddy) in front of the app in production.
  app.set("trust proxy", 1);

  const api = express.Router();
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: options.rateLimitPerMinute,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.path === "/health",
      handler: (_req, res) => {
        res.status(429).json({ error: "Za dużo zapytań. Odczekaj minutę i spróbuj ponownie." });
      },
    }),
  );
  api.use(express.json({ limit: "20kb" }));

  api.get("/health", (_req, res) => {
    res.json({ ok: true, model: options.model });
  });
  api.get("/stats", (_req, res) => {
    res.json(options.budget.snapshot());
  });
  api.use(createRecipeRouter(options));
  api.use((_req, res) => {
    res.status(404).json({ error: "Nie ma takiego adresu API." });
  });
  api.use(handleApiErrors);

  app.use("/api", api);

  const staticDir = options.staticDir;
  if (staticDir && existsSync(join(staticDir, "index.html"))) {
    app.use(express.static(staticDir));
    // SPA fallback: every other GET page shows the React app.
    app.use((req, res, next) => {
      if ((req.method !== "GET" && req.method !== "HEAD") || extname(req.path)) {
        next();
        return;
      }
      res.sendFile(join(staticDir, "index.html"));
    });
  }

  return app;
}
