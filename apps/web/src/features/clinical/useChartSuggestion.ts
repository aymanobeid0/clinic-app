import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  ChartSuggestion,
  ClinicalWorkspace,
  Identity,
} from "@clinic/contracts";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { useTreatmentRead } from "../treatment/useTreatmentRead.js";
import { treatmentGet } from "../treatment/treatment.api.js";
export function useChartSuggestion(
  s: ChartSuggestion,
  patientId: string,
  revision: number,
  identity: Identity,
) {
  const f = useForm({
      defaultValues: { teeth: s.teeth.join(", "), surfaces: "" },
    }),
    [current, setCurrent] = useState(revision),
    [error, setError] = useState("");
  const command = useTreatmentCommand([
    "chart-suggestions",
    identity.clinicId,
    identity.accountId,
    patientId,
  ]);
  const read = useTreatmentRead<ClinicalWorkspace>([
    "chart-suggestions",
    identity.clinicId,
    identity.accountId,
    patientId,
  ]);
  async function submit(action: "confirm" | "dismiss") {
    const v = f.getValues();
    const teeth = v.teeth.split(/[, ]+/).filter(Boolean),
      surfaces = v.surfaces.split(/[, ]+/).filter(Boolean);
    await command.save(`clinical/${patientId}/suggestions/${s.id}`, {
      chartRevision: Math.max(current, revision),
      action,
      targets:
        action === "dismiss"
          ? []
          : teeth.map((tooth) => ({
              tooth,
              presence: "unknown",
              extractionHistory: false,
              conditions:
                s.category === "restoration"
                  ? [{ finding: "restoration", surfaces }]
                  : [],
              treatments: [],
            })),
    });
  }
  async function reload() {
    const value = await read.read((signal) =>
      treatmentGet<ClinicalWorkspace>(`clinical/${patientId}`, signal),
    );
    if (value) {
      setCurrent(value.chart.revision);
      setError("");
    }
  }
  return { f, command, submit, reload, error: error || read.error };
}
