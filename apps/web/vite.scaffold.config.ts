import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.js";
// Existing browser journeys retain their original consumer; #76 owns retirement.
export default mergeConfig(
  base,
  defineConfig({
    plugins: [
      {
        name: "retained-scaffold",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === "/" || req.url?.startsWith("/?"))
              req.url = "/test/scaffold.html" + req.url.slice(1);
            next();
          });
        },
      },
    ],
  }),
);
