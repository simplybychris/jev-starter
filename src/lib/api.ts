/** What every recipe endpoint returns. */
export interface RecipeResponse<TResult> {
  result: TResult;
  /** Time of the Jev call in milliseconds, measured on the server. */
  ms: number;
  /** Real cost of the Jev call in USD. */
  cost: number;
}

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
    throw new ApiError("Brak połączenia z serwerem. Sprawdź, czy aplikacja działa (npm run dev).", 0);
  }

  const body = (await response.json().catch(() => null)) as
    | (Partial<RecipeResponse<TResult>> & { error?: string })
    | null;

  if (!response.ok) {
    const message =
      body?.error ??
      `Serwer API nie odpowiada poprawnie (błąd ${response.status}). Sprawdź, czy aplikacja działa (npm run dev).`;
    throw new ApiError(message, response.status);
  }
  if (!body || body.result === undefined) {
    throw new ApiError("Serwer zwrócił nieoczekiwaną odpowiedź.", response.status);
  }
  return { result: body.result, ms: body.ms ?? 0, cost: body.cost ?? 0 };
}
