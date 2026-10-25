import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  verifiedCurrencies,
  type Catalog,
  type CatalogEntry,
} from "@clinic/contracts";
import { treatmentApi, formatMinor } from "./treatment.api.js";
import { useTreatmentRead } from "./useTreatmentRead.js";
import { useTreatmentCommand } from "./useTreatmentCommand.js";
import { treatmentMessages as t } from "./treatment.messages.js";
export function useCatalogForm({
  entry,
  currencies,
  onLock,
  cacheKey,
}: {
  cacheKey: string[];
  entry: CatalogEntry | null;
  currencies: CatalogEntry["currency"][];
  onLock: (v: boolean) => void;
}) {
  const [id] = useState(() => entry?.id ?? crypto.randomUUID());
  const [revision, setRevision] = useState(entry?.revision ?? 0);
  const reloadState = useTreatmentRead<Catalog>(cacheKey);
  const reloadError = reloadState.error;
  const f = useForm({
    defaultValues: {
      name: entry?.name ?? "",
      chartCategory: entry?.chartCategory ?? "manual",
      currency: entry?.currency ?? currencies[0] ?? "MRU",
      price: entry
        ? formatMinor(entry.priceMinor, verifiedCurrencies[entry.currency])
        : "",
      durationMinutes: entry?.durationMinutes ?? 30,
      active: entry?.active ?? true,
    },
  });
  const command = useTreatmentCommand<CatalogEntry>(
    cacheKey,
    (v) => {
      setRevision(v.revision);
      f.reset(f.getValues());
    },
    undefined,
    t.catalogSaved,
  );
  useEffect(() => {
    onLock(command.busy || command.uncertain);
    return () => onLock(false);
  }, [onLock, command.busy, command.uncertain]);

  async function reload() {
    const catalog = await reloadState.read((signal) =>
      treatmentApi.catalog(signal),
    );
    if (catalog) {
      const latest = catalog.entries.find((e) => e.id === id);
      setRevision(latest?.revision ?? 0);
    }
  }

  const submit = f.handleSubmit((v) => {
    void command.save("catalog", {
      ...v,
      id,
      revision,
      durationMinutes: Number(v.durationMinutes),
    });
  });
  return {
    f,
    command,
    remote:
      command.denied || reloadState.denied
        ? undefined
        : reloadState.data?.entries.find((e) => e.id === id),
    reloadError,
    submit,
    reload,
  };
}
