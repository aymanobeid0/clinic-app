import { useState } from "react";
import { useFieldArray, type Control } from "react-hook-form";
import type { PlanFields } from "./usePlanForm.js";
export function usePlanExtras(control: Control<PlanFields>, index: number) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `items.${index}.extras`,
    keyName: "fieldKey",
  });
  const [label, setLabel] = useState(""),
    [amount, setAmount] = useState("");
  function add() {
    if (!label.trim() || !amount.trim()) return;
    append({ id: crypto.randomUUID(), label, amount });
    setLabel("");
    setAmount("");
  }
  return { fields, remove, label, setLabel, amount, setAmount, add };
}
