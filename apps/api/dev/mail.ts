import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Mail } from "../src/modules/identity/index.js";
import {
  localDirectory,
  requireLocalDevelopment,
} from "../../../scripts/local-dev-config.ts";
type Message = {
  kind: "verification" | "recovery" | "notification";
  to: string;
  at: string;
  token?: string;
  url?: string;
  subject?: string;
};
export async function localMail() {
  requireLocalDevelopment();
  await mkdir(localDirectory, { recursive: true });
  const path = join(localDirectory, "mailbox.json");
  let messages: Message[] = [];
  try {
    messages = JSON.parse(await readFile(path, "utf8")) as Message[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Cannot read the local development mailbox.");
  }
  async function capture(message: Omit<Message, "at">) {
    messages.push({ ...message, at: new Date().toISOString() });
    messages = messages.slice(-100);
    await writeFile(path, JSON.stringify(messages, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(
      "Local fictional mail captured in .local-dev/mailbox.json (no email sent).",
    );
  }
  const adapter: Mail = {
    sendVerification: async (m) =>
      capture({
        kind: "verification",
        to: m.to,
        token: m.token,
        url: m.verificationUrl,
      }),
    sendRecovery: async (m) =>
      capture({
        kind: "recovery",
        to: m.to,
        token: m.token,
        url: m.recoveryUrl,
      }),
    sendNotification: async (m) =>
      capture({ kind: "notification", to: m.to, subject: m.subject }),
  };
  return {
    adapter,
    verification: (to: string) =>
      messages.findLast((m) => m.kind === "verification" && m.to === to)?.token,
  };
}
