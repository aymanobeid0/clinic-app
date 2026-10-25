import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Identity,
  InventoryProjection,
  InventoryReceipt,
  InventoryMovement,
  InventorySettings,
} from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
import { useCareQuery } from "../clinical/useCareQuery.js";
import { inventoryAllowed, inventoryKey } from "./inventory.actions.js";
type Reads = {
  stock: InventoryProjection;
  receiving: { receipts: InventoryReceipt[] };
  movements: { movements: InventoryMovement[] };
  settings: InventorySettings;
};
// One read hook per chosen projection; no hidden history/settings waterfalls.
export function useInventory<K extends keyof Reads = "stock">(
  identity: Identity,
  view: K = "stock" as K,
) {
  const cache = useQueryClient();
  const account = identityScope(identity);
  const root = inventoryKey(account);
  const enabled = inventoryAllowed(identity, "inventory.read");
  const query = useCareQuery<Reads[K]>(
    [...root, view],
    view === "stock" ? "inventory" : `inventory/${view}`,
    "inventory/events",
    enabled,
    root,
  );
  useEffect(() => {
    if (!enabled || view !== "stock") return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      timer = setTimeout(
        () => {
          void cache.invalidateQueries({ queryKey: inventoryKey(account) });
          schedule();
        },
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
        ) - now.getTime(),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [cache, account, enabled, view]);
  return {
    ...query,
    data: enabled ? query.data : undefined,
    denied: !enabled || query.denied,
  };
}
