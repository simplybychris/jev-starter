import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { z } from "zod";

// Works both from server/ (tsx) and from dist-server/ (compiled): the parent is the project root.
export const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const DEFAULT_ENV_FILE = join(PROJECT_ROOT, ".env");

export interface Config {
  openrouterApiKey: string;
  jevModel: string;
  port: number;
  dailyBudgetUsd: number;
  rateLimitPerMinute: number;
  /** Max JSON body size, e.g. "100kb". */
  bodyLimit: string;
  /** IANA time zone for the daily budget reset (e.g. "Europe/Warsaw"), or undefined for the system zone. */
  timeZone: string | undefined;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

const MISSING_KEY = [
  "Brak klucza OPENROUTER_API_KEY.",
  "Skopiuj plik .env.example jako .env i wklej w nim klucz z https://openrouter.ai/settings/keys",
  "(albo ustaw zmienną środowiskową OPENROUTER_API_KEY).",
].join("\n");

const HINTS: Record<string, string> = {
  JEV_MODEL: "podaj nazwę modelu, np. jev-1.13",
  PORT: "podaj numer portu, np. 3000",
  DAILY_BUDGET_USD: "podaj kwotę w USD większą od zera, np. 1",
  RATE_LIMIT_PER_MINUTE: "podaj liczbę całkowitą większą od zera, np. 60",
  BODY_LIMIT: "podaj rozmiar w kb albo mb, np. 100kb",
  TZ: "podaj strefę czasową, np. Europe/Warsaw",
};

const schema = z.object({
  OPENROUTER_API_KEY: z.string(),
  JEV_MODEL: z.string().default("jev-1.13"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DAILY_BUDGET_USD: z.coerce.number().positive().default(1),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  BODY_LIMIT: z
    .string()
    .regex(/^\d+(kb|mb)$/i)
    .default("100kb"),
  TZ: z
    .string()
    .refine(isTimeZone)
    .optional(),
});

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

type EnvSource = Record<string, string | undefined>;

export function readEnvFile(path: string): EnvSource {
  if (!existsSync(path)) return {};
  return parseEnv(readFileSync(path, "utf8"));
}

/**
 * Loads settings from the .env file and the process environment.
 * The environment wins over .env; empty values count as missing.
 */
export function loadConfig(options: { env?: EnvSource; envFile?: string | null } = {}): Config {
  const env = options.env ?? process.env;
  const envFile = options.envFile === undefined ? DEFAULT_ENV_FILE : options.envFile;
  const fromFile = envFile ? readEnvFile(envFile) : {};

  const merged: EnvSource = {};
  for (const key of Object.keys(schema.shape)) {
    const value = (env[key] ?? "").trim() || (fromFile[key] ?? "").trim();
    if (value) merged[key] = value;
  }

  if (!merged.OPENROUTER_API_KEY) throw new ConfigError(MISSING_KEY);

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    const key = String(parsed.error.issues[0]?.path[0] ?? "");
    const hint = HINTS[key] ?? "sprawdź wartość";
    throw new ConfigError(`Nieprawidłowa wartość ${key} w .env: ${hint}.`);
  }

  const data = parsed.data;
  return {
    openrouterApiKey: data.OPENROUTER_API_KEY,
    jevModel: data.JEV_MODEL,
    port: data.PORT,
    dailyBudgetUsd: data.DAILY_BUDGET_USD,
    rateLimitPerMinute: data.RATE_LIMIT_PER_MINUTE,
    bodyLimit: data.BODY_LIMIT.toLowerCase(),
    timeZone: data.TZ,
  };
}
