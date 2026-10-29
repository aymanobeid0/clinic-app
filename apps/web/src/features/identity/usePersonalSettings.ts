import { useQueryClient } from "@tanstack/react-query";
import { useIdentityCommand } from "./useIdentityCommand.js";
import { useSelfSettings } from "./useAccountForms.js";
// Personal settings reuse the existing identity commands without reading staff accounts.
export function usePersonalSettings() {
  const cache = useQueryClient();
  const command = useIdentityCommand();
  const forms = useSelfSettings((action) =>
    command.run(async () => {
      await action();
      await cache.invalidateQueries({ queryKey: ["identity"] });
      command.setNotice(
        "Modification enregistrée. Vérifiez votre accès si nécessaire.",
      );
    }),
  );
  return {
    ...forms,
    busy: command.busy,
    error: command.error,
    notice: command.notice,
  };
}
