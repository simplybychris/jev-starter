import { describe, expect, it, vi } from "vitest";
import {
  JEV_URL,
  JevError,
  askMany,
  choice,
  createAskJev,
  noul,
  readChoice,
  readNoul,
  readScore,
  score,
  type AskJev,
  type JevAnswers,
  type JevResult,
} from "../server/jev.js";

const API_KEY = "sk-or-v1-test-secret-123";

const OK_BODY = {
  model: "typesafe/jev-1.13-20260917",
  answers: {
    department: { type: "choice", choice: "technical", probabilities: { billing: 0, technical: 1 }, confidence: 1 },
    urgent: { type: "noul", noul: 0.95 },
  },
  usage: { input_tokens: 480, output_tokens: 77, cost: 0.00002016 },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(...responses: Array<Response | Error>) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) fn.mockRejectedValueOnce(response);
    else fn.mockResolvedValueOnce(response);
  }
  return fn;
}

const questions = {
  department: choice("Which team?", { billing: "Charges.", technical: "Bugs.", other: "None of the above." }),
  urgent: noul("Does the customer need help today?"),
};

describe("question helpers", () => {
  it("validate option and level counts", () => {
    expect(() => choice("x", { only: "One." })).toThrow();
    expect(() => score("x", ["One."])).toThrow();
    expect(() => score("x", Array.from({ length: 11 }, (_, i) => `Level ${i}.`))).toThrow();
    expect(score("x", ["Low.", "High."]).criteria).toEqual(["Low.", "High."]);
    expect(noul("x")).toEqual({ type: "noul", instructions: "x" });
    expect(noul("x", { true: "Yes.", false: "No." }).criteria).toEqual({ true: "Yes.", false: "No." });
  });
});

describe("askJev", () => {
  it("sends the model, state and questions with the bearer key", async () => {
    const fetch = mockFetch(jsonResponse(200, OK_BODY));
    const askJev = createAskJev({ apiKey: API_KEY, fetch });

    const result = await askJev({ state: "Faktura nie doszła.", questions });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(JEV_URL);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(String(init?.body))).toEqual({ model: "jev-1.13", state: "Faktura nie doszła.", questions });

    expect(result.answers.department).toMatchObject({ type: "choice", choice: "technical" });
    expect(result.usage).toEqual({ input_tokens: 480, output_tokens: 77, cost: 0.00002016 });
    expect(result.model).toBe("typesafe/jev-1.13-20260917");
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it("serialises object state as JSON and uses the configured model", async () => {
    const fetch = mockFetch(jsonResponse(200, OK_BODY));
    await createAskJev({ apiKey: API_KEY, model: "jev-custom", fetch })({ state: { a: 1 }, questions });
    const body = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
    expect(body.model).toBe("jev-custom");
    expect(body.state).toBe('{"a":1}');
  });

  it("retries once on 429 and 5xx", async () => {
    const fetch = mockFetch(jsonResponse(429, { error: { message: "Rate limited" } }), jsonResponse(200, OK_BODY));
    const result = await createAskJev({ apiKey: API_KEY, fetch, retryDelayMs: 0 })({ state: "x", questions });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.usage.cost).toBe(0.00002016);

    const failing = mockFetch(jsonResponse(503, "busy"), jsonResponse(502, "still busy"));
    const error = await createAskJev({ apiKey: API_KEY, fetch: failing, retryDelayMs: 0 })({ state: "x", questions }).catch((e) => e);
    expect(failing).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(JevError);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/chwilowo niedostępny/);
  });

  it("does not retry client errors and keeps the upstream details", async () => {
    const fetch = mockFetch(jsonResponse(400, { error: { message: "criteria must be an array" } }));
    const error = await createAskJev({ apiKey: API_KEY, fetch, retryDelayMs: 0 })({ state: "x", questions }).catch((e) => e);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(JevError);
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/Jev odrzucił zapytanie/);
    expect(error.message).toMatch(/criteria must be an array/);
  });

  it("maps 401 to a Polish key hint and never leaks the key", async () => {
    const fetch = mockFetch(jsonResponse(401, { error: { message: `Invalid key ${API_KEY}` } }));
    const error = await createAskJev({ apiKey: API_KEY, fetch })({ state: "x", questions }).catch((e) => e);
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/OPENROUTER_API_KEY/);
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain("sk-or-");
  });

  it("maps timeouts and connection failures", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const slow = await createAskJev({ apiKey: API_KEY, fetch: mockFetch(timeout), timeoutMs: 15_000 })({ state: "x", questions }).catch((e) => e);
    expect(slow).toBeInstanceOf(JevError);
    expect(slow.status).toBe(504);
    expect(slow.message).toMatch(/15 s/);

    const offline = await createAskJev({ apiKey: API_KEY, fetch: mockFetch(new TypeError("fetch failed")) })({ state: "x", questions }).catch((e) => e);
    expect(offline.status).toBe(502);
    expect(offline.message).toMatch(/połączyć/);
  });

  it("rejects a 200 response without answers", async () => {
    const fetch = mockFetch(jsonResponse(200, { error: { message: "Provider returned error" } }));
    const error = await createAskJev({ apiKey: API_KEY, fetch })({ state: "x", questions }).catch((e) => e);
    expect(error).toBeInstanceOf(JevError);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/Provider returned error/);
  });
});

describe("answer readers", () => {
  const answers = OK_BODY.answers as JevAnswers;

  it("return typed answers", () => {
    expect(readChoice(answers, "department").choice).toBe("technical");
    expect(readNoul(answers, "urgent").noul).toBe(0.95);
  });

  it("throw a JevError when the answer is missing or has another type", () => {
    expect(() => readScore(answers, "department")).toThrow(JevError);
    expect(() => readChoice(answers, "missing")).toThrow(/missing/);
  });
});

describe("askMany", () => {
  const result = (n: number): JevResult => ({
    model: "m",
    ms: 1,
    usage: { input_tokens: n, output_tokens: 0, cost: 0 },
    answers: {},
  });

  it("keeps the order and never runs more than `concurrency` requests at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const ask: AskJev = async (request) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const n = Number(request.state);
      await new Promise((resolve) => setTimeout(resolve, 10 - n));
      inFlight -= 1;
      return result(n);
    };
    const requests = Array.from({ length: 7 }, (_, i) => ({ state: String(i), questions }));

    const results = await askMany(ask, requests, { concurrency: 3 });
    expect(results.map((r) => r.usage.input_tokens)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(maxInFlight).toBe(3);
  });

  it("caps concurrency at 8 and stops starting new requests after an error", async () => {
    let started = 0;
    let maxInFlight = 0;
    let inFlight = 0;
    const ask: AskJev = async (request) => {
      started += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (request.state === "2") throw new JevError("boom", 502);
      return result(0);
    };
    const many = Array.from({ length: 30 }, (_, i) => ({ state: String(i), questions }));
    await expect(askMany(ask, many, { concurrency: 50 })).rejects.toThrow("boom");
    expect(maxInFlight).toBe(8);
    expect(started).toBeLessThan(30);
  });
});

describe("retries and cost", () => {
  it("retries a 5xx once and returns the second answer", async () => {
    const fetch = mockFetch(jsonResponse(503, "busy"), jsonResponse(200, OK_BODY));
    const sleep = vi.fn(async () => undefined);
    const result = await createAskJev({ apiKey: API_KEY, fetch, sleep, retryDelayMs: 700 })({ state: "x", questions });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(700);
    expect(result.answers.urgent).toEqual({ type: "noul", noul: 0.95 });
  });

  it("honours Retry-After, capped", async () => {
    const limited = (seconds: string) =>
      new Response("slow down", { status: 429, headers: { "retry-after": seconds } });

    const sleep = vi.fn(async () => undefined);
    const fetchShort = mockFetch(limited("1"), jsonResponse(200, OK_BODY));
    await createAskJev({ apiKey: API_KEY, fetch: fetchShort, sleep, maxRetryDelayMs: 3000 })({ state: "x", questions });
    expect(sleep).toHaveBeenLastCalledWith(1000);

    const fetchLong = mockFetch(limited("120"), jsonResponse(200, OK_BODY));
    await createAskJev({ apiKey: API_KEY, fetch: fetchLong, sleep, maxRetryDelayMs: 3000 })({ state: "x", questions });
    expect(sleep).toHaveBeenLastCalledWith(3000);
  });

  it("does not retry a timeout", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const fetch = mockFetch(timeout, jsonResponse(200, OK_BODY));
    const error = await createAskJev({ apiKey: API_KEY, fetch, retryDelayMs: 0 })({ state: "x", questions }).catch((e) => e);
    expect(error).toBeInstanceOf(JevError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("estimates the cost from input tokens when OpenRouter does not report it", async () => {
    const body = { ...OK_BODY, usage: { input_tokens: 1_000_000, output_tokens: 10 } };
    const result = await createAskJev({ apiKey: API_KEY, fetch: mockFetch(jsonResponse(200, body)) })({ state: "x", questions });
    expect(result.usage.cost).toBeCloseTo(0.042, 10);
    expect(result.usage.costEstimated).toBe(true);

    const reported = await createAskJev({ apiKey: API_KEY, fetch: mockFetch(jsonResponse(200, OK_BODY)) })({ state: "x", questions });
    expect(reported.usage.costEstimated).toBeUndefined();
  });
});
