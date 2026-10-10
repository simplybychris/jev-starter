/**
 * Jev client (TypeSafe's decision model) via OpenRouter.
 * Keep this file as is when building a new app; add recipes in server/recipes/ instead.
 */

export const JEV_URL = "https://openrouter.ai/api/v1/systemone";
export const DEFAULT_JEV_MODEL = "jev-1.13";

// ---------- Questions ----------

/** Pick exactly one option. Criteria: id -> one-sentence description (English). */
export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

/** Rate on a scale. Criteria: level descriptions, lowest first (index 0), 2-10 levels. */
export interface ScoreQuestion {
  type: "score";
  instructions: string;
  criteria: string[];
}

/** Yes/no probability. Optional criteria describe what "true" and "false" mean. */
export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
}

export type JevQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion;
export type JevQuestions = Record<string, JevQuestion>;

/** Builds a choice question. Always include an "other" / "none" option. */
export function choice(instructions: string, criteria: Record<string, string>): ChoiceQuestion {
  const count = Object.keys(criteria).length;
  if (count < 2 || count > 255) throw new Error("choice() needs between 2 and 255 options");
  return { type: "choice", instructions, criteria };
}

/** Builds a score question. Levels go from lowest (index 0) to highest. */
export function score(instructions: string, levels: string[]): ScoreQuestion {
  if (levels.length < 2 || levels.length > 10) {
    throw new Error("score() needs between 2 and 10 levels, lowest first");
  }
  return { type: "score", instructions, criteria: [...levels] };
}

/** Builds a yes/no question; the answer is P(yes). */
export function noul(instructions: string, criteria?: { true: string; false: string }): NoulQuestion {
  return criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };
}

// ---------- Answers ----------

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface ScoreAnswer {
  type: "score";
  /** Weighted mean of level indexes (float, 0 = lowest level). */
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface NoulAnswer {
  type: "noul";
  /** Probability that the answer is "yes" (0-1). */
  noul: number;
}

export type JevAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;
export type JevAnswers = Record<string, JevAnswer>;

export interface JevUsage {
  input_tokens: number;
  output_tokens: number;
  /** Real cost in USD reported by OpenRouter. */
  cost: number;
  /** True when OpenRouter did not report the cost and it was estimated from input tokens. */
  costEstimated?: boolean;
}

export interface JevRequest {
  /** Context for the questions, in any language. Objects are sent as JSON. */
  state: string | object;
  questions: JevQuestions;
}

export interface JevResult {
  answers: JevAnswers;
  usage: JevUsage;
  /** Wall time of the call measured on the server, including a retry. */
  ms: number;
  model: string;
}

export type AskJev = (request: JevRequest) => Promise<JevResult>;

/** Short message that is safe to show to any visitor (no setup hints, no upstream details). */
export function publicMessageFor(status: number): string {
  if (status === 400) return "The app had a problem with its request to Jev. Please try again later.";
  if ([401, 402, 403, 404].includes(status)) {
    return "The app has a server configuration problem. Please try again later.";
  }
  return "Jev is temporarily unavailable. Please try again in a moment.";
}

export class JevError extends Error {
  override name = "JevError";
  /** Safe for visitors; `message` has the details for logs and local development. */
  readonly publicMessage: string;
  constructor(
    message: string,
    /** Upstream HTTP status, or 502/504 for connection problems and timeouts. */
    readonly status: number,
  ) {
    super(message);
    this.publicMessage = publicMessageFor(status);
  }
}

function readAnswer<T extends JevAnswer["type"]>(
  answers: JevAnswers,
  key: string,
  type: T,
): Extract<JevAnswer, { type: T }> {
  const answer = answers[key];
  if (!answer || answer.type !== type) {
    throw new JevError(`Jev returned no ${type} answer for question "${key}".`, 502);
  }
  return answer as Extract<JevAnswer, { type: T }>;
}

export const readChoice = (answers: JevAnswers, key: string) => readAnswer(answers, key, "choice");
export const readScore = (answers: JevAnswers, key: string) => readAnswer(answers, key, "score");
export const readNoul = (answers: JevAnswers, key: string) => readAnswer(answers, key, "noul");

// ---------- Client ----------

export interface JevClientOptions {
  apiKey: string;
  model?: string;
  url?: string;
  timeoutMs?: number;
  /** Wait before the single retry when the server sends no Retry-After header. */
  retryDelayMs?: number;
  /** Upper bound for a Retry-After wait. */
  maxRetryDelayMs?: number;
  fetch?: typeof fetch;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Fallback when OpenRouter does not report usage.cost: about 0.042 USD per 1M input tokens. */
export const ESTIMATED_USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

const shouldRetry = (status: number) => status === 429 || status >= 500;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Delay before the retry: Retry-After (seconds or HTTP date) capped at maxMs, otherwise the fallback. */
export function retryDelay(response: Response, fallbackMs: number, maxMs: number): number {
  const header = response.headers.get("retry-after")?.trim();
  if (!header) return fallbackMs;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  if (!Number.isFinite(ms) || ms < 0) return fallbackMs;
  return Math.min(ms, maxMs);
}

function redact(text: string, apiKey: string): string {
  let clean = text.replace(/sk-or-[A-Za-z0-9_-]+/g, "[hidden key]");
  if (apiKey) clean = clean.split(apiKey).join("[hidden key]");
  return clean.length > 300 ? `${clean.slice(0, 300)}…` : clean;
}

function upstreamMessage(payload: unknown): string {
  if (typeof payload === "string") return payload.trim();
  if (payload && typeof payload === "object") {
    const record = payload as { error?: unknown; message?: unknown };
    if (record.error && typeof record.error === "object") {
      const message = (record.error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return "";
}

function describeStatus(status: number): string {
  if (status === 400) return "Jev rejected the request (400). Check the question format: score needs a list of levels, choice an object of options.";
  if (status === 401 || status === 403) return `OpenRouter rejected the API key (${status}). Check OPENROUTER_API_KEY in .env.`;
  if (status === 402) return "The OpenRouter account is out of credits or the key reached its credit limit (402).";
  if (status === 404) return "OpenRouter does not know this model (404). Check JEV_MODEL in .env.";
  if (status === 429) return "Too many requests to Jev (429). Wait a moment and try again.";
  if (status >= 500) return `Jev is temporarily unavailable (${status}). Try again in a moment.`;
  return `OpenRouter returned error ${status}.`;
}

function toJevError(status: number, payload: unknown, apiKey: string): JevError {
  const details = redact(upstreamMessage(payload), apiKey);
  const message = describeStatus(status) + (details ? ` Details: ${details}` : "");
  return new JevError(message, status);
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Creates the askJev() function bound to an API key. */
export function createAskJev(options: JevClientOptions): AskJev {
  const {
    apiKey,
    model = DEFAULT_JEV_MODEL,
    url = JEV_URL,
    timeoutMs = 15_000,
    retryDelayMs = 800,
    maxRetryDelayMs = 5_000,
  } = options;
  const doFetch = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? defaultSleep;

  async function send(body: string): Promise<Response> {
    try {
      return await doFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new JevError(`Jev did not answer within ${timeoutMs / 1000} s. Try again.`, 504);
      }
      throw new JevError("Could not connect to OpenRouter. Check the internet connection.", 502);
    }
  }

  async function readPayload(response: Response): Promise<unknown> {
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new JevError("The connection to Jev broke while reading the answer.", 502);
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return async function askJev({ state, questions }: JevRequest): Promise<JevResult> {
    const body = JSON.stringify({
      model,
      state: typeof state === "string" ? state : JSON.stringify(state),
      questions,
    });

    const started = performance.now();
    let response = await send(body);
    if (shouldRetry(response.status)) {
      const delay = retryDelay(response, retryDelayMs, maxRetryDelayMs);
      await response.body?.cancel().catch(() => undefined);
      await sleep(delay);
      response = await send(body);
    }
    const payload = await readPayload(response);
    if (!response.ok) throw toJevError(response.status, payload, apiKey);

    const data = payload as { model?: unknown; answers?: unknown; usage?: Record<string, unknown> } | null;
    if (!data || typeof data !== "object" || !data.answers || typeof data.answers !== "object") {
      const details = redact(upstreamMessage(payload), apiKey);
      throw new JevError(`Unexpected answer from Jev.${details ? ` Details: ${details}` : ""}`, 502);
    }

    const inputTokens = toNumber(data.usage?.input_tokens);
    const reportedCost = data.usage?.cost;
    const hasCost = typeof reportedCost === "number" && Number.isFinite(reportedCost);

    return {
      answers: data.answers as JevAnswers,
      usage: {
        input_tokens: inputTokens,
        output_tokens: toNumber(data.usage?.output_tokens),
        cost: hasCost ? reportedCost : inputTokens * ESTIMATED_USD_PER_INPUT_TOKEN,
        ...(hasCost ? {} : { costEstimated: true }),
      },
      ms: Math.round(performance.now() - started),
      model: typeof data.model === "string" ? data.model : model,
    };
  };
}

// ---------- Many requests ----------

/** Jev allows about 1200 requests per minute; bulk runs should keep at most 8 in flight. */
export const MAX_PARALLEL_REQUESTS = 8;

/**
 * Sends several Jev requests with at most `concurrency` in flight (default and maximum: 8).
 * Results keep the order of `requests`. The first error stops new requests and is rethrown.
 */
export async function askMany(
  ask: AskJev,
  requests: JevRequest[],
  options: { concurrency?: number } = {},
): Promise<JevResult[]> {
  const wanted = Math.floor(options.concurrency ?? MAX_PARALLEL_REQUESTS);
  const concurrency = Math.max(1, Math.min(MAX_PARALLEL_REQUESTS, wanted));
  const results: JevResult[] = new Array(requests.length);
  let next = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed && next < requests.length) {
      const index = next++;
      try {
        results[index] = await ask(requests[index]!);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, () => worker()));
  return results;
}
