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
// The daily budget resets at midnight in this zone (Node picks up TZ changes at runtime).
if (config.timeZone) process.env.TZ = config.timeZone;
// `npm run dev` runs this file through tsx; Vite serves the page then. `npm start` runs dist-server/.
const devMode = import.meta.url.endsWith(".ts");

const app = createApp({
  askJev: createAskJev({ apiKey: config.openrouterApiKey, model: config.jevModel }),
  budget: new DailyBudget(config.dailyBudgetUsd),
  recipes,
  model: config.jevModel,
  rateLimitPerMinute: config.rateLimitPerMinute,
  bodyLimit: config.bodyLimit,
  exposeErrorDetails: devMode,
  staticDir: devMode ? null : join(PROJECT_ROOT, "dist"),
});

const server = app.listen(config.port, (error) => {
  if (error) {
    const busy = (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    console.error(
      busy
        ? `Port ${config.port} is already in use. Change PORT in .env or close the program that uses it.`
        : `Could not start the server: ${error.message}`,
    );
    process.exit(1);
  }
  console.log(
    devMode
      ? `API running on port ${config.port}. Open the page at the address Vite prints (usually http://localhost:5173).`
      : `App running: http://localhost:${config.port}`,
  );
});

// Docker sends SIGTERM on stop; close connections instead of waiting for a hard kill.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
