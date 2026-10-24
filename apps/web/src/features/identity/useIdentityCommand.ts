import { useRef, useState } from "react";
import { ZodError } from "zod";

// No useMutation: it would retain sensitive command variables/results in cache.
export function useIdentityCommand() {
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
      setError(
        error instanceof ZodError
          ? "Vérifiez les champs saisis."
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
