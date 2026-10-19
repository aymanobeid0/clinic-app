import { AppError } from '../../errors/app-error.js';
import {
  verifiedCurrencies,
  type catalogCommandSchema,
  type planLifecycleSchema,
  type TreatmentPlan,
  type TreatmentVersion,
  type TreatmentItem,
  type treatmentPlanSchema,
  type enableCurrencySchema,
} from '@clinic/contracts';
import type { z } from 'zod';
import type { Actor, IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { TreatmentRepository } from './treatment.repository.js';
import { VisitRepository } from './visit.repository.js';
export function exactMinor(value: string, precision: number) {
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > precision)
    throw new AppError(
      400,
      'Décimales excessives : aucun arrondi autorisé.',
    );
  return (
    BigInt(whole!) * 10n ** BigInt(precision) +
    BigInt(fraction.padEnd(precision, '0') || '0')
  );
}
export class TreatmentService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  async plans(actor: Actor | undefined, patientId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      'clinical.read',
      async (c, tx) => {
        const versions = await new TreatmentRepository(tx, c.clinicId).versions(
          patientId,
        );
        const ids = [...new Set(versions.map((v) => v.id))];
        return ids.map((id) =>
          this.visible(
            versions.filter((v) => v.id === id),
            c.permissions,
          ),
        );
      },
    );
  }
  private visible(
    versions: TreatmentVersion[],
    permissions: readonly string[],
  ): TreatmentPlan {
    return {
      ...versions.at(-1)!,
      events: permissions.includes('clinical.history') ? versions : [],
    };
  }
  authorizePlan(actor: Actor | undefined, patientId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      'clinical.read',
      async (c) => c.clinicId,
    );
  }
  async lifecycle(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof planLifecycleSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      data.action === 'evidence'
        ? 'acceptance.draft'
        : data.action === 'accept'
          ? 'plans.accept'
          : 'plans.finalize',
      async (c, tx) => {
        if (!c.permissions.includes('clinical.read'))
          throw new AppError(403, 'Accès en lecture clinique requis.');
        const r = new TreatmentRepository(tx, c.clinicId);
        await r.lock();
        const replay = await r.replay(
          data.commandId,
          ['lifecycle', patientId, data],
          c.accountId,
        );
        const versions = await r.versions(patientId, data.id);
        if (replay.receipt)
          return {
            clinicId: c.clinicId,
            value: this.visible(versions, c.permissions),
          };
        const old = versions.at(-1);
        if (!old) throw new AppError(404, 'Proposition introuvable.');
        if (old.revision !== data.revision)
          throw new AppError(
            409,
            'La proposition a changé. Rechargez et réconciliez votre saisie conservée.',
          );
        const at = new Date(this.now()).toISOString(),
          name = await r.name(c.accountId);
        const version: TreatmentVersion = {
          ...old,
          revision: old.revision + 1,
          authorId: c.accountId,
          authorName: name,
          recordedAt: at,
        };
        if (data.action === 'cancel') {
          if ((await new VisitRepository(tx,c.clinicId).state(patientId)).starts.some(s=>s.planId===data.id))
            throw new AppError(409,'Les soins commencés nécessitent un ajustement financier explicite.');
          if (!data.reason)
            throw new AppError(400, 'Motif d’annulation requis.');
          if (!['draft', 'presented', 'accepted'].includes(old.status))
            throw new AppError(
              409,
              'Cette proposition ne peut plus être annulée ici.',
            );
          version.status = 'cancelled';
          version.cancellation = {
            reason: data.reason,
            actorId: c.accountId,
            actorName: name,
            at,
          };
        } else if (data.action === 'present') {
          if (old.status !== 'draft')
            throw new AppError(
              409,
              'Seul un brouillon peut être présenté.',
            );
          version.status = 'presented';
        } else {
          if (old.status !== 'presented')
            throw new AppError(
              409,
              'Présentez la version actuelle avant son acceptation.',
            );
          if (data.action === 'evidence') {
            if (
              !data.acceptedBy ||
              !data.acceptedAt ||
              !data.method ||
              Date.parse(data.acceptedAt) > this.now()
            )
              throw new AppError(
                400,
                'Identité, date passée et méthode d’accord requises.',
              );
            version.evidence = {
              acceptedBy: data.acceptedBy,
              acceptedAt: data.acceptedAt,
              method: data.method,
              proposalRevision: old.evidence?.proposalRevision ?? old.revision,
              recordedBy: c.accountId,
              recordedByName: name,
              recordedAt: at,
            };
          } else {
            if (!old.evidence)
              throw new AppError(
                409,
                'Consignez les éléments d’accord avant confirmation.',
              );
            version.status = 'accepted';
            version.acceptance = {
              ...old.evidence,
              confirmedBy: c.accountId,
              confirmedByName: name,
              confirmedAt: at,
            };
            const care=await new VisitRepository(tx,c.clinicId).state(patientId);
            if(care.starts.some(s=>s.planId===data.id))
              version.status=version.items.every(i=>care.completions.some(e=>e.planId===data.id && e.itemId===i.id))?'completed':'in_progress';
          }
        }
        await r.append(patientId, version);
        await r.save(data.commandId, c.accountId, replay.hash, { id: data.id });
        return {
          clinicId: c.clinicId,
          value: this.visible([...versions, version], c.permissions),
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  async printable(
    actor: Actor | undefined,
    patientId: string,
    planId: string,
    revision: number,
  ) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      'clinical.print',
      async (c, tx) => {
        if (!c.permissions.includes('clinical.read'))
          throw new AppError(403, 'Accès en lecture clinique requis.');
        const versions = await new TreatmentRepository(tx, c.clinicId).versions(
          patientId,
          planId,
        );
        const version = versions.find((v) => v.revision === revision);
        if (!version) throw new AppError(404, 'Version introuvable.');
        if (
          version.revision !== versions.at(-1)?.revision &&
          !c.permissions.includes('clinical.history')
        )
          throw new AppError(403, 'Autorisation d’historique requise.');
        return {
          ...version,
          ...(await new TreatmentRepository(tx, c.clinicId).printIdentity(
            patientId,
          )),
        };
      },
    );
  }
  async savePlan(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof treatmentPlanSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      'plans.draft',
      async (c, tx) => {
        if (!c.permissions.includes('clinical.read'))
          throw new AppError(403, 'Accès en lecture clinique requis.');
        const r = new TreatmentRepository(tx, c.clinicId);
        await r.lock();
        const replay = await r.replay(
          data.commandId,
          ['plan', patientId, data],
          c.accountId,
        );
        const versions = await r.versions(patientId, data.id);
        if (replay.receipt) {
          const receipt = replay.receipt as {
            override?: boolean;
            discount?: boolean;
          };
          if (
            (receipt.override &&
              !c.isManager &&
              !c.permissions.includes('prices.override')) ||
            (receipt.discount &&
              !c.isManager &&
              !c.permissions.includes('discounts'))
          )
            throw new AppError(
              403,
              'Autorisation financière de la commande retirée.',
            );
          return {
            clinicId: c.clinicId,
            value: this.visible(versions, c.permissions),
          };
        }
        await r.bind(patientId, data.id);
        const old = versions.at(-1);
        if ((old?.revision ?? 0) !== data.revision)
          throw new AppError(
            409,
            'La proposition a changé. Rechargez et réconciliez votre saisie conservée.',
          );
        if (
          old &&
          ['cancelled'].includes(old.status)
        )
          throw new AppError(
            409,
            'Cette proposition ne peut plus être modifiée ici.',
          );
        if (old && old.currency !== data.currency)
          throw new AppError(
            400,
            'La devise d’une proposition existante ne peut pas changer.',
          );
        const currency = await r.enabled(data.currency);
        if (!currency) throw new AppError(400, 'Devise non activée.');
        const items: TreatmentItem[] = [];
        let needsOverride = false,
          needsDiscount = false;
        for (const input of data.items) {
          const previous = old?.items.find((i) => i.id === input.id);
          const procedure = await r.procedure(input.procedureId);
          if (!procedure)
            throw new AppError(400, 'Acte du catalogue introuvable.');
          if (previous && previous.procedureId !== input.procedureId)
            throw new AppError(
              400,
              'Utilisez une nouvelle ligne pour changer d’acte.',
            );
          if (
            !previous &&
            (!procedure.active || procedure.revision !== input.catalogRevision)
          )
            throw new AppError(
              409,
              'Cet acte a changé. Relisez le catalogue avant de l’ajouter.',
            );
          if (procedure.currency !== data.currency)
            throw new AppError(
              400,
              'Chaque proposition utilise une seule devise, sans conversion.',
            );
          const baseMinor =
            previous?.baseMinor ?? procedure.priceMinor.toString();
          const priceMinor = exactMinor(
            input.price,
            currency.precision,
          ).toString();
          const discountMinor = exactMinor(
            input.discount,
            currency.precision,
          ).toString();
          needsOverride ||= priceMinor !== (previous?.priceMinor ?? baseMinor);
          needsDiscount ||=
            discountMinor !== (previous?.discountMinor ?? '0') ||
            input.discountReason !== (previous?.discountReason ?? '');
          if (
            priceMinor !== (previous?.priceMinor ?? baseMinor) &&
            !c.isManager &&
            !c.permissions.includes('prices.override')
          )
            throw new AppError(
              403,
              'Autorisation de modification de prix requise.',
            );
          if (
            (discountMinor !== (previous?.discountMinor ?? '0') ||
              input.discountReason !== (previous?.discountReason ?? '')) &&
            !c.isManager &&
            !c.permissions.includes('discounts')
          )
            throw new AppError(403, 'Autorisation de remise requise.');
          if (BigInt(discountMinor) > BigInt(priceMinor))
            throw new AppError(400, 'La remise dépasse le prix.');
          if (BigInt(discountMinor) > 0n && !input.discountReason)
            throw new AppError(400, 'Un motif de remise est requis.');
          if (
            new Set(input.extras.map((e) => e.id)).size !== input.extras.length
          )
            throw new AppError(400, 'Frais supplémentaires en double.');
          const extras = input.extras.map((e) => ({
            id: e.id,
            label: e.label,
            amountMinor: exactMinor(e.amount, currency.precision).toString(),
          }));
          const extrasChanged =
            JSON.stringify(extras) !==
            JSON.stringify(
              (previous?.extras ?? []).map((e) => ({
                id: e.id,
                label: e.label,
                amountMinor: e.amountMinor,
              })),
            );
          needsOverride ||= extrasChanged;
          if (
            extrasChanged &&
            !c.isManager &&
            !c.permissions.includes('prices.override')
          )
            throw new AppError(
              403,
              'Autorisation de modification de prix requise.',
            );
          items.push({
            id: input.id,
            procedureId: procedure.id,
            catalogRevision: previous?.catalogRevision ?? procedure.revision,
            name: previous?.name ?? procedure.name,
            chartCategory: previous?.chartCategory ?? procedure.chartCategory as TreatmentItem['chartCategory'],
            durationMinutes:
              previous?.durationMinutes ?? procedure.durationMinutes,
            scope: input.scope,
            teeth: input.teeth,
            baseMinor,
            priceMinor,
            discountMinor,
            discountReason: input.discountReason,
            extras,
          });
        }
        const agreed = (v: { title: string; items: TreatmentItem[] }) =>
          JSON.stringify({
            title: v.title,
            items: v.items
              .map((i) => ({
                id: i.id,
                procedureId: i.procedureId,
                scope: i.scope,
                teeth: [...i.teeth].sort(),
                priceMinor: i.priceMinor,
                discountMinor: i.discountMinor,
                discountReason: i.discountReason,
                extras: (i.extras ?? [])
                  .map((e) => ({
                    id: e.id,
                    label: e.label,
                    amountMinor: e.amountMinor,
                  }))
                  .sort((a, b) => a.id.localeCompare(b.id)),
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          });
        // A price revision may not erase or relabel performed clinical work.
        const starts=(await new VisitRepository(tx,c.clinicId).state(patientId)).starts.filter(s=>s.planId===data.id);
        for(const start of starts) {
          const item=items.find(i=>i.id===start.itemId);
          if(!item || item.procedureId!==start.item.procedureId || item.scope!==start.item.scope || JSON.stringify([...item.teeth].sort())!==JSON.stringify([...start.item.teeth].sort()))
            throw new AppError(409,'Conservez les références des actes déjà commencés.');
        }
        const changed =
          !old || agreed(old) !== agreed({ title: data.title, items });
        const version: TreatmentVersion = {
          ...(old && !changed ? old : {}),
          id: data.id,
          patientId,
          revision: data.revision + 1,
          title: data.title,
          currency: data.currency,
          status: changed ? 'draft' : old!.status,
          notes: data.notes,
          items,
          totalMinor: items
            .reduce(
              (n, i) =>
                n +
                BigInt(i.priceMinor) -
                BigInt(i.discountMinor) +
                (i.extras ?? []).reduce(
                  (sum, e) => sum + BigInt(e.amountMinor),
                  0n,
                ),
              0n,
            )
            .toString(),
          authorId: c.accountId,
          authorName: await r.name(c.accountId),
          recordedAt: new Date(this.now()).toISOString(),
        };
        await r.append(patientId, version);
        await r.save(data.commandId, c.accountId, replay.hash, {
          id: data.id,
          revision: version.revision,
          override: needsOverride,
          discount: needsDiscount,
        });
        return {
          clinicId: c.clinicId,
          value: this.visible([...versions, version], c.permissions),
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  catalog(actor: Actor | undefined) {
    return this.identity.withCatalogRead(actor, (c, tx) =>
      new TreatmentRepository(tx, c.clinicId).catalog(),
    );
  }
  authorizeCurrencies(actor: Actor | undefined) {
    return this.identity.withManager(actor, async (c) => c.clinicId);
  }
  authorize(actor: Actor | undefined) {
    return this.identity.withCatalogRead(actor, async (c) => c.clinicId);
  }
  currencies(actor: Actor | undefined) {
    return this.identity.withManager(actor, (c, tx) =>
      new TreatmentRepository(tx, c.clinicId).currencies(),
    );
  }
  async enable(
    actor: Actor | undefined,
    data: z.infer<typeof enableCurrencySchema>,
  ) {
    const result = await this.identity.withManager(actor, async (c, tx) => {
      const r = new TreatmentRepository(tx, c.clinicId);
      await r.lock();
      const replay = await r.replay(
        data.commandId,
        ['currency', data],
        c.accountId,
      );
      if (replay.receipt)
        return { clinicId: c.clinicId, value: replay.receipt };
      const value = await r.currency(data.code, verifiedCurrencies[data.code]);
      await r.save(data.commandId, c.accountId, replay.hash, value);
      return { clinicId: c.clinicId, value };
    });
    this.updates.publish(result.clinicId);
    return result.value;
  }
  async put(
    actor: Actor | undefined,
    data: z.infer<typeof catalogCommandSchema>,
  ) {
    const result = await this.identity.withPermission(
      actor,
      'catalog.manage',
      async (c, tx) => {
        const r = new TreatmentRepository(tx, c.clinicId);
        await r.lock();
        const replay = await r.replay(
          data.commandId,
          ['catalog', data],
          c.accountId,
        );
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        const currency = await r.enabled(data.currency);
        if (!currency)
          throw new AppError(
            400,
            'Activez cette devise dans les paramètres.',
          );
        const old = await r.procedure(data.id);
        if ((old?.revision ?? 0) !== data.revision)
          throw new AppError(
            409,
            'Le catalogue a changé. Rechargez et réconciliez votre saisie conservée.',
          );
        if (old && old.currency !== data.currency)
          throw new AppError(
            400,
            'La devise existante ne peut pas être réétiquetée. Créez un autre acte.',
          );
        const content = {
          id: data.id,
          revision: data.revision,
          name: data.name,
          currency: data.currency,
          durationMinutes: data.durationMinutes,
          chartCategory: data.chartCategory,
          active: data.active,
        };
        const saved = await r.put({
          ...content,
          revision: data.revision + 1,
          priceMinor: exactMinor(data.price, currency.precision),
        });
        const value = {
          ...content,
          revision: saved.revision,
          priceMinor: saved.priceMinor.toString(),
        };
        await r.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
