import {
  openingBalanceSchema,
  reconcileChargeSchema,
  settlementSchema,
  paymentMethodSchema,
  issueInvoiceSchema,
  creditAdjustmentSchema,
  releaseAllocationSchema,
  reversePaymentSchema,
  refundRequestSchema,
  refundActionSchema,
  cancelChargedPlanSchema,
  type OpeningBalance,
  type BillingAdjustment,
  type Settlement,
  type PaymentMethod,
  type Invoice,
  type FinancialCorrection,
} from "@clinic/contracts";

// Reuse transport validation; money, eligibility and permissions stay authoritative on the server.
export const billingActions = {
  opening: {
    schema: openingBalanceSchema.omit({ commandId: true }),
    path: "opening-balances",
  },
  reconcile: {
    schema: reconcileChargeSchema.omit({ commandId: true }),
    path: "reconcile",
  },
  settlement: {
    schema: settlementSchema.omit({ commandId: true }),
    path: "settlements",
  },
  method: {
    schema: paymentMethodSchema.omit({ commandId: true }),
    path: "payment-methods",
  },
  invoice: {
    schema: issueInvoiceSchema.omit({ commandId: true }),
    path: "invoices",
  },
  credit: {
    schema: creditAdjustmentSchema.omit({ commandId: true }),
    path: "credits",
  },
  release: {
    schema: releaseAllocationSchema.omit({ commandId: true }),
    path: "allocation-releases",
  },
  reversal: {
    schema: reversePaymentSchema.omit({ commandId: true }),
    path: "reversals",
  },
  refundRequest: {
    schema: refundRequestSchema.omit({ commandId: true }),
    path: "refund-requests",
  },
  refundApproval: {
    schema: refundActionSchema.omit({ commandId: true }),
    path: "refund-approvals",
  },
  refund: {
    schema: refundActionSchema.omit({ commandId: true }),
    path: "refunds",
  },
  cancellation: {
    schema: cancelChargedPlanSchema.omit({ commandId: true }),
    path: "cancel-plan",
  },
};
export type BillingAction = keyof typeof billingActions;
export type BillingResults = {
  opening: OpeningBalance;
  reconcile: BillingAdjustment;
  settlement: Settlement;
  method: PaymentMethod;
  invoice: Invoice;
  credit: FinancialCorrection;
  release: FinancialCorrection;
  reversal: FinancialCorrection;
  refundRequest: FinancialCorrection;
  refundApproval: FinancialCorrection;
  refund: FinancialCorrection;
  cancellation: FinancialCorrection;
};
export const billingKey = (accountKey: string, patientId: string) => [
  "billing",
  accountKey,
  patientId,
];
