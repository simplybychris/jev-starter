import { once } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type AppOptions } from "../server/app.js";
import { DailyBudget } from "../server/budget.js";
import { z } from "zod";
import { JevError, noul, readNoul, type AskJev, type JevResult } from "../server/jev.js";
import { defineRecipe, registerRecipes } from "../server/recipes/recipe.js";

// A test-only recipe keeps these tests independent from the demo recipe.
const check = defineRecipe({
  name: "check",
  input: z.object({
    text: z.string({ error: "Wpisz treść." }).trim().min(1, "Wpisz treść.").max(50, "Najwyżej 50 znaków."),
    count: z.number().int().max(5).optional(),
  }),
  build: ({ text }) => ({ state: text, questions: { polite: noul("Is the message polite?") } }),
  interpret: (answers) => ({ polite: readNoul(answers, "polite").noul >= 0.5 }),
});
// A multi-call recipe: one Jev request per item, one at a time, through the budgeted context.
const batch = defineRecipe({
  name: "batch",
  input: z.object({ items: z.array(z.string().max(100)).min(1).max(10) }),
  run: async ({ items }, ctx) => {
    const results = await ctx.askMany(
      items.map((item) => ({ state: { item }, questions: { polite: noul("Is the item polite?") } })),
      { concurrency: 1 },
    );
    return { polite: results.map((r) => readNoul(r.answers, "polite").noul >= 0.5) };
  },
});

const recipes = registerRecipes([check, batch]);

const JEV_RESULT: JevResult = {
  model: "typesafe/jev-1.13-20260917",
  ms: 312,
  usage: { input_tokens: 480, output_tokens: 77, cost: 0.000021 },
  answers: { polite: { type: "noul", noul: 0.9 } },
};

function setup(overrides: Partial<AppOptions> = {}) {
  const askJev = vi.fn<AskJev>().mockResolvedValue(JEV_RESULT);
  const budget = new DailyBudget(1);
  const app = createApp({
    askJev,
    budget,
    recipes,
    model: "jev-1.13",
    rateLimitPerMinute: 100,
    bodyLimit: "1kb",
    exposeErrorDetails: false,
    staticDir: null,
    ...overrides,
  });
  return { app, askJev, budget };
}

async function withServer(app: ReturnType<typeof createApp>, run: (base: string) => Promise<void>) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

function post(base: string, path: string, body: unknown) {
  return fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function errorOf(response: Response): Promise<string> {
  const body = (await response.json()) as { error?: string };
  return body.error ?? "";
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/recipes/:name", () => {
  it("returns the interpreted result with time and cost", async () => {
    const { app, askJev, budget } = setup();
    await withServer(app, async (base) => {
      const response = await post(base, "/api/recipes/check", { text: "  Dzień dobry!  " });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        result: { polite: true },
        ms: 312,
        cost: 0.000021,
        costEstimated: false,
        calls: 1,
      });
    });
    expect(askJev).toHaveBeenCalledTimes(1);
    expect(askJev.mock.calls[0]![0].state).toBe("Dzień dobry!");
    expect(budget.snapshot().requests).toBe(1);
  });

  it("passes on an estimated cost", async () => {
    const askJev = vi
      .fn<AskJev>()
      .mockResolvedValue({ ...JEV_RESULT, usage: { ...JEV_RESULT.usage, cost: 0.00002, costEstimated: true } });
    await withServer(setup({ askJev }).app, async (base) => {
      const body = (await (await post(base, "/api/recipes/check", { text: "x" })).json()) as { costEstimated: boolean };
      expect(body.costEstimated).toBe(true);
    });
  });

  it("rejects invalid input with 400 and a Polish message, without calling Jev", async () => {
    const { app, askJev } = setup();
    await withServer(app, async (base) => {
      const missing = await post(base, "/api/recipes/check", {});
      expect(missing.status).toBe(400);
      expect(await errorOf(missing)).toBe("Wpisz treść.");

      const tooLong = await post(base, "/api/recipes/check", { text: "a".repeat(51) });
      expect(tooLong.status).toBe(400);
      expect(await errorOf(tooLong)).toBe("Najwyżej 50 znaków.");

      // Schemas without custom messages still answer in Polish (zod locale).
      const generic = await post(base, "/api/recipes/check", { text: "x", count: 10 });
      expect(generic.status).toBe(400);
      const genericError = await errorOf(generic);
      expect(genericError).not.toBe("");
      expect(genericError).not.toMatch(/Too big|expected/i);

      const badJson = await post(base, "/api/recipes/check", "{text:");
      expect(badJson.status).toBe(400);
      expect(await errorOf(badJson)).toMatch(/JSON/);

      const huge = await post(base, "/api/recipes/check", { text: "a".repeat(2000) });
      expect(huge.status).toBe(413);
      expect(await errorOf(huge)).toMatch(/1kb/);
    });
    expect(askJev).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown recipe", async () => {
    const { app } = setup();
    await withServer(app, async (base) => {
      const response = await post(base, "/api/recipes/nope", { text: "x" });
      expect(response.status).toBe(404);
      expect(await errorOf(response)).toMatch(/Nie ma przepisu/);
    });
  });

  it("returns 402 once the daily budget is used up", async () => {
    const budget = new DailyBudget(0.00001);
    budget.record({ input_tokens: 1, output_tokens: 1, cost: 0.00002 });
    const { app, askJev } = setup({ budget });
    await withServer(app, async (base) => {
      const response = await post(base, "/api/recipes/check", { text: "Dzień dobry" });
      expect(response.status).toBe(402);
      expect(await errorOf(response)).toMatch(/Dzienny limit/);
    });
    expect(askJev).not.toHaveBeenCalled();
  });

  it("maps Jev errors to 502 with a public message, details only in development", async () => {
    const failing = vi
      .fn<AskJev>()
      .mockRejectedValue(new JevError("OpenRouter odrzucił klucz API (401). Sprawdź OPENROUTER_API_KEY w .env.", 401));
    await withServer(setup({ askJev: failing }).app, async (base) => {
      const response = await post(base, "/api/recipes/check", { text: "Dzień dobry" });
      expect(response.status).toBe(502);
      const error = await errorOf(response);
      expect(error).toMatch(/konfiguracją/);
      expect(error).not.toMatch(/OPENROUTER_API_KEY|\.env|401/);
    });
    await withServer(setup({ askJev: failing, exposeErrorDetails: true }).app, async (base) => {
      const response = await post(base, "/api/recipes/check", { text: "Dzień dobry" });
      expect(await errorOf(response)).toMatch(/OPENROUTER_API_KEY/);
    });
  });

  it("maps other errors to 500 without details", async () => {

    const broken = vi.fn<AskJev>().mockRejectedValue(new Error("boom"));
    await withServer(setup({ askJev: broken }).app, async (base) => {
      const response = await post(base, "/api/recipes/check", { text: "Dzień dobry" });
      expect(response.status).toBe(500);
      expect(await errorOf(response)).not.toMatch(/boom/);
    });
  });

  it("limits requests per IP with 429", async () => {
    const { app } = setup({ rateLimitPerMinute: 2 });
    await withServer(app, async (base) => {
      expect((await post(base, "/api/recipes/check", { text: "1" })).status).toBe(200);
      expect((await post(base, "/api/recipes/check", { text: "2" })).status).toBe(200);
      const limited = await post(base, "/api/recipes/check", { text: "3" });
      expect(limited.status).toBe(429);
      expect(await errorOf(limited)).toMatch(/Za dużo zapytań/);
      expect((await fetch(`${base}/api/health`)).status).toBe(200);
    });
  });
});

describe("multi-call recipes (run + ctx.askMany)", () => {
  it("sums cost and calls, records every call in the budget", async () => {
    const { app, askJev, budget } = setup();
    await withServer(app, async (base) => {
      const response = await post(base, "/api/recipes/batch", { items: ["a", "b", "c"] });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { result: unknown; cost: number; calls: number; ms: number };
      expect(body.result).toEqual({ polite: [true, true, true] });
      expect(body.calls).toBe(3);
      expect(body.cost).toBeCloseTo(0.000063, 10);
      expect(body.ms).toBeGreaterThanOrEqual(0);
    });
    expect(askJev).toHaveBeenCalledTimes(3);
    expect(askJev.mock.calls[1]![0].state).toEqual({ item: "b" });
    expect(budget.snapshot().requests).toBe(3);
  });

  it("stops with 402 when the budget runs out in the middle", async () => {
    const budget = new DailyBudget(0.00002);
    const { app, askJev } = setup({ budget });
    await withServer(app, async (base) => {
      const response = await post(base, "/api/recipes/batch", { items: ["a", "b", "c"] });
      expect(response.status).toBe(402);
    });
    expect(askJev).toHaveBeenCalledTimes(1);
  });

  it("rejects recipes without build/interpret or run", () => {
    expect(() => registerRecipes([{ name: "broken", input: z.object({}) } as never])).toThrow(/build\(\)/);
  });
});

describe("other endpoints", () => {
  it("serves health, stats and a JSON 404 for unknown API paths", async () => {
    const { app } = setup();
    await withServer(app, async (base) => {
      expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true, model: "jev-1.13" });
      expect(await (await fetch(`${base}/api/stats`)).json()).toMatchObject({ requests: 0, spentUsd: 0, limitUsd: 1 });
      const missing = await fetch(`${base}/api/nothing`);
      expect(missing.status).toBe(404);
      expect(await errorOf(missing)).toMatch(/Nie ma takiego adresu/);
      expect(await (await fetch(`${base}/`)).text()).toMatch(/serwer API/);
    });
  });

  it("serves the built frontend with an SPA fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jev-starter-dist-"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>app</title>");
    const { app } = setup({ staticDir: dir });
    await withServer(app, async (base) => {
      expect(await (await fetch(`${base}/`)).text()).toContain("<title>app</title>");
      expect(await (await fetch(`${base}/some/page`)).text()).toContain("<title>app</title>");
      expect((await fetch(`${base}/missing.js`)).status).toBe(404);
    });
  });
});
