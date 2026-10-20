import type {
  AllocationRelease,
  CreditSource,
  FinancialCorrection,
  Settlement,
} from "@clinic/contracts";

// A projection over retained facts: releases never rewrite receipt allocations.
export function projectFunds(
  settlements: Settlement[],
  corrections: FinancialCorrection[],
) {
  const reversed = new Set(
    corrections.flatMap((c) =>
      c.reversedSettlementId ? [c.reversedSettlementId] : [],
    ),
  );
  const releases = corrections.flatMap((c) => c.releases);
  const lots: CreditSource[] = [
    ...settlements
      .filter((s) => BigInt(s.depositMinor) > 0n)
      .map((s) => ({
        id: s.id,
        chargeId: null,
        currency: s.currency,
        rootSettlementId: s.id,
        performedBy: null,
        amountMinor: s.depositMinor,
        availableMinor: s.depositMinor,
      })),
    ...corrections.flatMap((c) => c.credits.map((l) => ({ ...l }))),
  ];
  const allocations = settlements.flatMap((s) =>
    s.allocations.map((a) => {
      const released = releases.filter(
        (r) => r.settlementId === s.id && r.chargeId === a.chargeId,
      );
      const newMoney =
        BigInt(a.newMoneyMinor) -
        released.reduce((n, r) => n + BigInt(r.newMoneyMinor), 0n);
      const sources = a.sources.map((src) => ({
        ...src,
        amountMinor: (
          BigInt(src.amountMinor) -
          released
            .flatMap((r) => r.sources)
            .filter((r) => r.settlementId === src.settlementId)
            .reduce((n, r) => n + BigInt(r.amountMinor), 0n)
        ).toString(),
      }));
      return {
        settlementId: s.id,
        chargeId: a.chargeId,
        at: s.at,
        newMoneyMinor: newMoney.toString(),
        creditMinor: sources
          .reduce((n, r) => n + BigInt(r.amountMinor), 0n)
          .toString(),
        sources,
      };
    }),
  );
  for (const lot of lots) {
    lot.availableMinor = reversed.has(lot.rootSettlementId)
      ? "0"
      : (
          BigInt(lot.amountMinor) -
          settlements
            .flatMap((s) => s.allocations)
            .flatMap((a) => a.sources)
            .filter((s) => s.settlementId === lot.id)
            .reduce((n, s) => n + BigInt(s.amountMinor), 0n) -
          corrections
            .filter((c) => c.kind === "refund" && c.sourceId === lot.id)
            .reduce((n, c) => n + BigInt(c.amountMinor!), 0n)
        ).toString();
  }
  return { lots, allocations, reversed };
}

export function releaseFunds(
  funds: ReturnType<typeof projectFunds>,
  chargeId: string,
  amount: bigint,
  performedBy: string,
  currency: string,
  id: () => string,
  settlementId?: string,
) {
  const releases: AllocationRelease[] = [],
    credits: CreditSource[] = [];
  let remaining = amount;
  for (const a of funds.allocations.filter(
    (a) =>
      a.chargeId === chargeId &&
      (!settlementId || a.settlementId === settlementId),
  )) {
    if (remaining === 0n) break;
    const fresh =
      BigInt(a.newMoneyMinor) < remaining ? BigInt(a.newMoneyMinor) : remaining;
    const release: AllocationRelease = {
      settlementId: a.settlementId,
      chargeId,
      newMoneyMinor: fresh.toString(),
      sources: [],
    };
    if (fresh > 0n)
      credits.push({
        id: id(),
        chargeId,
        currency,
        rootSettlementId: a.settlementId,
        performedBy,
        amountMinor: fresh.toString(),
        availableMinor: fresh.toString(),
      });
    remaining -= fresh;
    for (const src of a.sources) {
      const used =
        BigInt(src.amountMinor) < remaining
          ? BigInt(src.amountMinor)
          : remaining;
      if (used === 0n) continue;
      const lot = funds.lots.find((l) => l.id === src.settlementId)!;
      release.sources.push({
        settlementId: src.settlementId,
        amountMinor: used.toString(),
      });
      credits.push({
        id: id(),
        chargeId,
        currency,
        rootSettlementId: lot.rootSettlementId,
        performedBy,
        amountMinor: used.toString(),
        availableMinor: used.toString(),
      });
      remaining -= used;
    }
    releases.push(release);
  }
  return { releases, credits, remaining };
}
