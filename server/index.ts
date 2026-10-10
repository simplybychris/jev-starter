import { join } from "node:path";
import { createApp } from "./app.js";
import { DailyBudget } from "./budget.js";
import { ConfigError, PROJECT_ROOT, loadConfig, type Config } from "./config.js";
import { createAskJev } from "./jev.js";
import { recipes } from "./recipes/index.js";

function readConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
// `npm run dev` runs this file through tsx; Vite serves the page then. `npm start` runs dist-server/.
const devMode = import.meta.url.endsWith(".ts");

const app = createApp({
  askJev: createAskJev({ apiKey: config.openrouterApiKey, model: config.jevModel }),
  budget: new DailyBudget(config.dailyBudgetUsd),
  recipes,
  model: config.jevModel,
  rateLimitPerMinute: config.rateLimitPerMinute,
  staticDir: devMode ? null : join(PROJECT_ROOT, "dist"),
});

const server = app.listen(config.port, (error) => {
  if (error) {
    const busy = (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    console.error(
      busy
        ? `Port ${config.port} jest zajęty. Zmień PORT w .env albo zamknij program, który go używa.`
        : `Nie udało się uruchomić serwera: ${error.message}`,
    );
    process.exit(1);
  }
  console.log(
    devMode
      ? `API działa na porcie ${config.port}. Stronę otwórz pod adresem z Vite (zwykle http://localhost:5173).`
      : `Aplikacja działa: http://localhost:${config.port}`,
  );
});

// Docker sends SIGTERM on stop; close connections instead of waiting for a hard kill.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
