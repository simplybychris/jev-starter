import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../server/config.js";

function envFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "jev-starter-"));
  const path = join(dir, ".env");
  writeFileSync(path, content);
  return path;
}

describe("loadConfig", () => {
  it("fails fast with a Polish message when the key is missing", () => {
    expect(() => loadConfig({ env: {}, envFile: null })).toThrow(ConfigError);
    expect(() => loadConfig({ env: { OPENROUTER_API_KEY: "  " }, envFile: null })).toThrow(
      /Brak klucza OPENROUTER_API_KEY/,
    );
  });

  it("applies defaults", () => {
    const config = loadConfig({ env: { OPENROUTER_API_KEY: "test-key" }, envFile: null });
    expect(config).toEqual({
      openrouterApiKey: "test-key",
      jevModel: "jev-1.13",
      port: 3000,
      dailyBudgetUsd: 1,
      rateLimitPerMinute: 60,
    });
  });

  it("reads the .env file and lets the environment win", () => {
    const path = envFile("OPENROUTER_API_KEY=from-file\nPORT=4000\nDAILY_BUDGET_USD=2.5\n");
    const fromFile = loadConfig({ env: {}, envFile: path });
    expect(fromFile.openrouterApiKey).toBe("from-file");
    expect(fromFile.port).toBe(4000);
    expect(fromFile.dailyBudgetUsd).toBe(2.5);

    const overridden = loadConfig({ env: { OPENROUTER_API_KEY: "from-env", PORT: "5000" }, envFile: path });
    expect(overridden.openrouterApiKey).toBe("from-env");
    expect(overridden.port).toBe(5000);
  });

  it("treats empty values as missing", () => {
    const path = envFile("OPENROUTER_API_KEY=from-file\nPORT=\n");
    const config = loadConfig({ env: { OPENROUTER_API_KEY: "" }, envFile: path });
    expect(config.openrouterApiKey).toBe("from-file");
    expect(config.port).toBe(3000);
  });

  it("rejects invalid numbers with a hint", () => {
    expect(() =>
      loadConfig({ env: { OPENROUTER_API_KEY: "k", DAILY_BUDGET_USD: "-1" }, envFile: null }),
    ).toThrow(/DAILY_BUDGET_USD/);
    expect(() => loadConfig({ env: { OPENROUTER_API_KEY: "k", PORT: "abc" }, envFile: null })).toThrow(
      /PORT/,
    );
  });
});
