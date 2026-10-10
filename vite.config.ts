import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Only PORT is read here; the OpenRouter key never reaches the Vite config or the browser.
  const env = loadEnv(mode, process.cwd(), "PORT");
  const apiPort = env.PORT || "3000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
    test: {
      include: ["test/**/*.test.ts"],
      environment: "node",
    },
  };
});
