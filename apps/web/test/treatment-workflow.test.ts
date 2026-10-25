import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createTreatmentCommand } from "../src/features/treatment/treatment.workflow.js";
import { HttpError } from "../src/features/identity/identity.api.js";

afterEach(() => vi.unstubAllGlobals());

it("uncertain retries preserve nested values and command identity despite later caller edits", async () => {
  const cache = new QueryClient();
  const sent: unknown[] = [];
  vi.stubGlobal("fetch", (_url: string, options: RequestInit) => {
    sent.push(JSON.parse(String(options.body)));
    if (sent.length === 1) throw new TypeError("Lost response");
    return Promise.resolve(new Response(JSON.stringify({ revision: 2 })));
  });
  const workflow = createTreatmentCommand<{ revision: number }>(cache, [
    "plans",
    "actor",
    "patient",
  ]);
  const proposal = { revision: 1, items: [{ price: "100.00", teeth: ["11"] }] };
  await expect(
    workflow.save("treatment/patient/plans", proposal),
  ).rejects.toThrow("Lost response");
  proposal.items[0]!.price = "999.00";
  proposal.items[0]!.teeth.push("12");
  expect(workflow.uncertain).toBe(true);
  expect(await workflow.retry()).toEqual({ revision: 2 });
  expect(sent[1]).toEqual(sent[0]);
  expect(sent[1]).toMatchObject({
    items: [{ price: "100.00", teeth: ["11"] }],
  });
  expect(workflow.uncertain).toBe(false);
  await workflow.dispose();
  cache.clear();
});

it("permission denial clears a previously successful active plan observer snapshot", async () => {
  const cache = new QueryClient();
  const key = ["plans", "clinic", "actor", "patient"];
  const observer = new QueryObserver(cache, {
    queryKey: key,
    retry: false,
    queryFn: () => Promise.reject(new HttpError(403, "Dossier retiré")),
    initialData: [{ title: "Confidentiel" }],
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ error: "Dossier retiré" }), {
        status: 403,
      }),
    ),
  );
  const workflow = createTreatmentCommand(cache, key);
  await expect(workflow.save("treatment/patient/plans", {})).rejects.toThrow(
    "Dossier retiré",
  );
  expect(observer.getCurrentResult().data).toBeUndefined();
  expect(observer.getCurrentResult().error?.message).toBe("Dossier retiré");
  expect(workflow.uncertain).toBe(false);
  unsubscribe();
  await workflow.dispose();
  cache.clear();
});

it("a closed command cannot return late data or start another write", async () => {
  const cache = new QueryClient();
  let release!: (response: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const workflow = createTreatmentCommand(cache, ["plans", "actor", "patient"]);
  const pending = workflow.save("treatment/patient/plans", {});
  await workflow.dispose();
  release(new Response(JSON.stringify({ title: "Closed patient" })));
  expect(await pending).toBeUndefined();
  expect(await workflow.save("treatment/patient/plans", {})).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  cache.clear();
});
