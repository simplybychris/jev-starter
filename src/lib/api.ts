/** What every recipe endpoint returns. */
export interface RecipeResponse<TResult> {
  result: TResult;
  /** Time spent waiting for Jev in milliseconds, measured on the server. */
  ms: number;
  /** Cost of all Jev requests behind this result in USD. */
  cost: number;
  /** True when the cost was estimated from tokens (OpenRouter did not report it). */
  costEstimated: boolean;
  /** Number of Jev requests behind this result. */
  calls: number;
}

// Setup hints only while developing locally; visitors of a deployed app never see them.
const DEV_HINT = import.meta.env.DEV ? " Sprawdź, czy działa npm run dev." : "";

export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Calls POST /api/recipes/<name> with the recipe input.
 * Throws ApiError with a message that can be shown to the user as is.
 */
export async function callRecipe<TInput, TResult>(
  name: string,
  input: TInput,
  options: { signal?: AbortSignal } = {},
): Promise<RecipeResponse<TResult>> {
  let response: Response;
  try {
    response = await fetch(`/api/recipes/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(`Brak połączenia z serwerem.${DEV_HINT}`, 0);
  }

  const body = (await response.json().catch(() => null)) as
    | (Partial<RecipeResponse<TResult>> & { error?: string })
    | null;

  if (!response.ok) {
    const message = body?.error ?? `Serwer nie odpowiada poprawnie (błąd ${response.status}).${DEV_HINT}`;
    throw new ApiError(message, response.status);
  }
  if (!body || body.result === undefined) {
    throw new ApiError("Serwer zwrócił nieoczekiwaną odpowiedź.", response.status);
  }
  return {
    result: body.result,
    ms: body.ms ?? 0,
    cost: body.cost ?? 0,
    costEstimated: body.costEstimated ?? false,
    calls: body.calls ?? 1,
  };
}
