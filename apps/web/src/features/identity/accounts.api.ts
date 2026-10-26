import {
  accountKindChangeSchema,
  accountStatusSchema,
  changeEmailSchema,
  changePasswordSchema,
  createAccountSchema,
  managerAuthoritySchema,
  permissionsSchema,
  renameAccountSchema,
  resetAccountSchema,
  type AccountSummary,
} from "@clinic/contracts";
import type { z } from "zod";
import { readResponse, post } from "./identity.api.js";

const accountChanges = {
  permissions: permissionsSchema,
  username: renameAccountSchema,
  "reset-password": resetAccountSchema,
  kind: accountKindChangeSchema,
  manager: managerAuthoritySchema,
  status: accountStatusSchema,
};
export type AccountChange = {
  [K in keyof typeof accountChanges]: {
    operation: K;
    input: z.input<(typeof accountChanges)[K]>;
  };
}[keyof typeof accountChanges];

export const accountsApi = {
  async list(signal?: AbortSignal): Promise<AccountSummary[]> {
    const response = await fetch("/api/accounts", {
      cache: "no-store",
      signal,
    });
    return readResponse<AccountSummary[]>(response);
  },
  create(input: z.input<typeof createAccountSchema>) {
    return post("accounts", createAccountSchema.parse(input));
  },
  change(id: string, command: AccountChange) {
    return post(
      `accounts/${encodeURIComponent(id)}/${command.operation}`,
      accountChanges[command.operation].parse(command.input),
    );
  },
  changePassword(input: z.input<typeof changePasswordSchema>) {
    return post("password", changePasswordSchema.parse(input));
  },
  changeEmail(input: z.input<typeof changeEmailSchema>) {
    return post("email", changeEmailSchema.parse(input));
  },
};
