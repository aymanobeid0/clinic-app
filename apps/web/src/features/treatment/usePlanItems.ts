import { useState } from "react";
import { verifiedCurrencies, type Catalog } from "@clinic/contracts";
import { formatMinor } from "./treatment.api.js";
import type { PlanItemFields } from "./usePlanForm.js";
export function usePlanItems(
  catalog: Catalog,
  currency: keyof typeof verifiedCurrencies,
  append: (item: PlanItemFields) => void,
) {
  const [procedure, setProcedure] = useState("");
  const available = catalog.entries.filter(
    (e) => e.active && e.currency === currency,
  );
  function add() {
    const e = available.find((e) => e.id === procedure);
    if (e)
      append({
        id: crypto.randomUUID(),
        procedureId: e.id,
        catalogRevision: e.revision,
        scope: "whole_mouth",
        teeth: "",
        price: formatMinor(e.priceMinor, verifiedCurrencies[e.currency]),
        discount: "0",
        discountReason: "",
        extras: [],
      });
  }
  return { procedure, setProcedure, available, add };
}
