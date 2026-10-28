import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch:
    /(?:consultation.*|care-workflows|billing-workflows|reporting-workflows|treatment-workflows|record-workflows|inventory-workflows)\.spec\.ts/,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4187", headless: true },
  webServer: {
    command: "npm exec vite -- --config vite.consultations.config.ts",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
  },
  reporter: "list",
});
