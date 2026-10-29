// Retained verification consumer until #76 proves all replacement coverage.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IdentityPage } from "../src/features/identity/IdentityPage.js";
import "../src/styles.css";
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={cache}>
      <IdentityPage />
    </QueryClientProvider>
  </StrictMode>,
);
