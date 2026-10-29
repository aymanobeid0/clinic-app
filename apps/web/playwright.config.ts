import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/consultation*.spec.ts", "**/workspace*.spec.ts"],
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4173", headless: true },
  webServer: {
    command: "npm exec vite -- --config vite.scaffold.config.ts",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
  reporter: "list",
});
