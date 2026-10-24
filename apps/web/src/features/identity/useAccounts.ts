import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Identity } from "@clinic/contracts";
import { accountsApi } from "./accounts.api.js";
import { useIdentityCommand } from "./useIdentityCommand.js";
import { createIdentityWorkflow } from "./identity.workflow.js";

export function useAccounts(identity: Identity) {
  const cache = useQueryClient();
  const command = useIdentityCommand();
  const accounts = useQuery({
    queryKey: ["accounts", identity.clinicId, identity.accountId],
    queryFn: ({ signal }) => accountsApi.list(signal),
    enabled:
      identity.stage === "ready" &&
      identity.isManager &&
      !identity.historicalOnly,
    gcTime: 0,
  });
  useEffect(() => {
    if (accounts.error)
      void createIdentityWorkflow(cache).reconcileDenied(accounts.error);
  }, [accounts.error, cache]);
  async function run(action: () => Promise<unknown>) {
    return command.run(async () => {
      await action();
      await cache.invalidateQueries({ queryKey: ["identity"] });
      await cache.invalidateQueries({ queryKey: ["accounts"] });
      command.setNotice("Modification enregistrée.");
    });
  }
  return {
    ...command,
    accounts,
    run,
    reload: () => cache.invalidateQueries({ queryKey: ["accounts"] }),
  };
}
