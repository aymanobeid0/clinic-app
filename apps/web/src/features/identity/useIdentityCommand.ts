import { validationSummary } from "@clinic/contracts";
import { useRef, useState } from "react";
import { ZodError } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { createIdentityWorkflow } from "./identity.workflow.js";

// No useMutation: it would retain sensitive command variables/results in cache.
export function useIdentityCommand() {
  const cache = useQueryClient();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      return true;
    } catch (error) {
      await createIdentityWorkflow(cache).reconcileDenied(error);
      setError(
        error instanceof ZodError
          ? validationSummary(error)
          : error instanceof Error
            ? error.message
            : "Service indisponible.",
      );
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, setError, setNotice, run };
}
