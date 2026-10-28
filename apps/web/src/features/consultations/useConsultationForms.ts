import { useEffect } from "react";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import { z } from "zod";
import {
  bookConsultationSchema,
  consultationPaymentSchema,
  consultationPriceSchema,
  remunerationSchema,
  type Consultation,
  type Identity,
  type Settlement,
} from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
import {
  activeAccount,
  activePatientScope,
  consultationAllowed,
} from "./consultation.access.js";
import { useConsultationCommand } from "./useConsultationCommand.js";

function useCommandForm<T extends FieldValues, R>(
  scope: string,
  defaults: DefaultValues<T>,
  schema: z.ZodType,
  command: ReturnType<typeof useConsultationCommand<R>>,
  allowed: boolean,
  save: (values: T) => Promise<R | undefined>,
) {
  const form = useForm<T>({ defaultValues: defaults });
  useEffect(() => {
    form.reset(defaults);
  }, [scope]);
  useEffect(() => {
    if (command.denied || !allowed) form.reset(defaults);
  }, [command.denied, allowed]);
  async function submit() {
    if (!allowed || command.denied || command.busy) return;
    // Retry must bypass current validation: even invalid edited fields cannot
    // replace or strand a consequential command whose outcome is unknown.
    if (command.uncertain) return command.retry();
    form.clearErrors();
    const values = form.getValues();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      form.setError("root", {
        message: parsed.error.issues.map((i) => i.message).join(" "),
      });
      return;
    }
    return save(values);
  }
  return { form, command, allowed, submit };
}
const bookingSchema = bookConsultationSchema
  .omit({ commandId: true, id: true })
  .extend({
    price: z.preprocess(
      (value) => (value === "" ? undefined : value),
      bookConsultationSchema.shape.price,
    ),
  });
type Booking = z.infer<typeof bookingSchema>;
export function useConsultationBooking(
  identity: Identity,
  patientId: string,
  accessScope = "active",
) {
  const command = useConsultationCommand<Consultation>(
    identity,
    patientId,
    accessScope,
  );
  const allowed =
    consultationAllowed(identity) &&
    !!patientId &&
    activePatientScope(accessScope);
  const defaults: Booking = {
    doctorId: identity.kind === "doctor" ? identity.accountId : "",
    appointmentId: null,
    date: new Date().toISOString().slice(0, 10),
    price: "",
  };
  return useCommandForm<Booking, Consultation>(
    JSON.stringify([identityScope(identity), patientId, accessScope]),
    defaults,
    bookingSchema,
    command,
    allowed,
    (values) =>
      command.save(`consultations/${encodeURIComponent(patientId)}`, {
        ...bookingSchema.parse(values),
        id: crypto.randomUUID(),
      }),
  );
}
const paymentSchema = consultationPaymentSchema.omit({
  commandId: true,
  revision: true,
});
type Payment = z.input<typeof paymentSchema>;
export function useConsultationPayment(
  identity: Identity,
  consultation: Consultation,
  accessScope = "active",
) {
  const { patientId, id, revision } = consultation;
  const command = useConsultationCommand<Settlement>(
    identity,
    patientId,
    `${accessScope}:${id}`,
  );
  const allowed =
    activeAccount(identity) &&
    activePatientScope(accessScope) &&
    (identity.isManager || identity.permissions.includes("billing.edit")) &&
    (identity.isManager ||
      identity.kind !== "doctor" ||
      consultation.doctorId === identity.accountId);
  return useCommandForm<Payment, Settlement>(
    JSON.stringify([identityScope(identity), patientId, id, accessScope]),
    {
      currency: consultation.currency,
      amount: "",
      credit: "0",
      methodId: null,
    },
    paymentSchema,
    command,
    allowed,
    (values) =>
      command.save(
        `billing/${encodeURIComponent(patientId)}/consultations/${encodeURIComponent(id)}/payment`,
        { ...paymentSchema.parse(values), revision },
      ),
  );
}
const priceSchema = consultationPriceSchema.omit({ commandId: true });
const rateSchema = z
  .preprocess(
    (values) => ({
      ...(values as object),
      commandId: "00000000-0000-4000-8000-000000000000",
    }),
    remunerationSchema,
  )
  .transform(({ commandId: _, ...values }) => values);
export function useConsultationPriceForm(identity: Identity, revision: number) {
  const command = useConsultationCommand(identity);
  const editor = useCommandForm<z.infer<typeof priceSchema>, unknown>(
    identityScope(identity),
    { revision, currency: "MRU", price: "" },
    priceSchema,
    command,
    activeAccount(identity) && identity.isManager,
    (values) =>
      command.save("consultation-settings/price", priceSchema.parse(values)),
  );
  return {
    ...editor,
    review: () => {
      if (!command.busy && !command.uncertain)
        editor.form.setValue("revision", revision);
    },
  };
}
export function useRemunerationForm(
  identity: Identity,
  doctorId: string,
  revision: number,
) {
  const command = useConsultationCommand(identity, "", doctorId);
  const editor = useCommandForm<z.infer<typeof rateSchema>, unknown>(
    JSON.stringify([identityScope(identity), doctorId]),
    { doctorId, revision, mode: "percentage", rate: "" },
    rateSchema,
    command,
    activeAccount(identity) && identity.isManager,
    (values) =>
      command.save(
        "consultation-settings/remuneration",
        rateSchema.parse(values),
      ),
  );
  return {
    ...editor,
    review: () => {
      if (!command.busy && !command.uncertain)
        editor.form.setValue("revision", revision);
    },
  };
}
