import { useForm } from "react-hook-form";
import type { Identity } from "@clinic/contracts";
import { useCurrencies } from "./useTreatmentQueries.js";
import { useTreatmentCommand } from "./useTreatmentCommand.js";
export function useCurrencyForm(identity: Identity) {
  const f = useForm({ defaultValues: { code: "MRU" } });
  const query = useCurrencies(identity);
  const command = useTreatmentCommand(
    ["currencies", identity.clinicId, identity.accountId],
    undefined,
    undefined,
    "Devise activée",
  );
  const submit = f.handleSubmit((v) => {
    void command.save("catalog/currencies", v);
  });
  return { f, query, command, submit };
}
