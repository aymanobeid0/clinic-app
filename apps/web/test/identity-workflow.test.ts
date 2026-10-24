import { afterEach, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createIdentityWorkflow } from "../src/features/identity/identity.workflow.js";

test("denied sign-in reports the API error and leaves no prior sensitive cache", async () => {
  const cache = new QueryClient();
  cache.setQueryData(["patients"], ["private"]);
  vi.stubGlobal("fetch", async (url: string) =>
    url === "/api/session"
      ? Response.json({ csrfToken: "fictional-csrf" })
      : Response.json({ error: "Identifiants invalides." }, { status: 401 }),
  );
  await expect(
    createIdentityWorkflow(cache).signIn({
      method: "email",
      email: "manager@example.invalid",
      password: "incorrect",
    }),
  ).rejects.toThrow("Identifiants invalides.");
  expect(cache.getQueryData(["patients"])).toBeUndefined();
  expect(cache.getQueryData(["identity"])).toBeNull();
  cache.clear();
});

test("late patient reads cannot repopulate the cache after a session transition", async () => {
  const cache = new QueryClient();
  let finish!: (value: string[]) => void;
  const pending = cache
    .fetchQuery({
      queryKey: ["patients"],
      queryFn: () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    })
    .catch(() => undefined);
  await createIdentityWorkflow(cache).transition(async () => {});
  finish(["private old patient"]);
  await pending;
  expect(cache.getQueryData(["patients"])).toBeUndefined();
  cache.clear();
});

afterEach(() => vi.unstubAllGlobals());

const manager = {
  accountId: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  username: "manager",
  loginMethod: "email",
  isManager: true,
  kind: "staff",
  permissions: [],
  historicalOnly: false,
  recoverySetup: false,
  loginEmail: "manager@example.invalid",
  displayName: "Responsable",
  stage: "ready",
};

test("observed account, clinic, permission and session changes discard sensitive cached queries", async () => {
  const cache = new QueryClient();
  let actor: object | null = manager;
  vi.stubGlobal("fetch", async (url: string) =>
    url === "/api/session"
      ? Response.json({ csrfToken: "fictional-csrf" })
      : actor
        ? Response.json(actor)
        : new Response(null, { status: 401 }),
  );
  const workflow = createIdentityWorkflow(cache);
  await workflow.query.queryFn();
  for (const next of [
    { ...manager, accountId: "33333333-3333-4333-8333-333333333333" },
    { ...manager, clinicId: "44444444-4444-4444-8444-444444444444" },
    { ...manager, permissions: ["patients.read"] },
    { ...manager, historicalOnly: true },
    null,
  ]) {
    cache.setQueryData(["patients"], ["private"]);
    actor = next;
    await workflow.query.queryFn();
    expect(cache.getQueryData(["patients"])).toBeUndefined();
  }
  cache.clear();
});

test("signing in discards old patient cache and does not retain credentials in mutation storage", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["patients", "old-clinic"], ["private patient"]);
  vi.stubGlobal("fetch", async (url: string) => {
    if (url === "/api/session")
      return Response.json({ csrfToken: "fictional-csrf" });
    if (url === "/api/sign-in")
      return Response.json({ csrfToken: "fictional-next-csrf" });
    return new Response(null, { status: 401 });
  });
  const workflow = createIdentityWorkflow(cache);
  await workflow.signIn({
    method: "email",
    email: "manager@example.invalid",
    password: "fictional-input",
  });
  expect(cache.getQueryData(["patients", "old-clinic"])).toBeUndefined();
  expect(cache.getMutationCache().getAll()).toEqual([]);
  cache.clear();
});
