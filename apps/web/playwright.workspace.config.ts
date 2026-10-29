import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: /workspace.*\.spec\.ts/,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4188", headless: true },
  webServer: {
    command: "npm exec vite -- --config vite.workspace.config.ts",
    url: "http://127.0.0.1:4188",
    reuseExistingServer: false,
  },
  reporter: "list",
});
