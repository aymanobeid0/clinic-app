import {
  verifiedCurrencies,
  type catalogCommandSchema,
  type TreatmentPlan,
  type TreatmentVersion,
  type TreatmentItem,
  type treatmentPlanSchema,
  type enableCurrencySchema,
} from '@clinic/contracts';
import type { z } from 'zod';
import {
  IdentityError,
  type Actor,
  type IdentityAccess,
} from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { TreatmentRepository } from './treatment.repository.js';
export function exactMinor(value: string, precision: number) {
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > precision)
    throw new IdentityError(
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
          throw new IdentityError(403, 'Accès en lecture clinique requis.');
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
            throw new IdentityError(
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
          throw new IdentityError(
            409,
            'La proposition a changé. Rechargez et réconciliez votre saisie conservée.',
          );
        if (old && old.currency !== data.currency)
          throw new IdentityError(
            400,
            'La devise d’une proposition existante ne peut pas changer.',
          );
        const currency = await r.enabled(data.currency);
        if (!currency) throw new IdentityError(400, 'Devise non activée.');
        const items: TreatmentItem[] = [];
        let needsOverride = false,
          needsDiscount = false;
        for (const input of data.items) {
          const previous = old?.items.find((i) => i.id === input.id);
          const procedure = await r.procedure(input.procedureId);
          if (!procedure)
            throw new IdentityError(400, 'Acte du catalogue introuvable.');
          if (previous && previous.procedureId !== input.procedureId)
            throw new IdentityError(
              400,
              'Utilisez une nouvelle ligne pour changer d’acte.',
            );
          if (
            !previous &&
            (!procedure.active || procedure.revision !== input.catalogRevision)
          )
            throw new IdentityError(
              409,
              'Cet acte a changé. Relisez le catalogue avant de l’ajouter.',
            );
          if (procedure.currency !== data.currency)
            throw new IdentityError(
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
            throw new IdentityError(
              403,
              'Autorisation de modification de prix requise.',
            );
          if (
            (discountMinor !== (previous?.discountMinor ?? '0') ||
              input.discountReason !== (previous?.discountReason ?? '')) &&
            !c.isManager &&
            !c.permissions.includes('discounts')
          )
            throw new IdentityError(403, 'Autorisation de remise requise.');
          if (BigInt(discountMinor) > BigInt(priceMinor))
            throw new IdentityError(400, 'La remise dépasse le prix.');
          if (BigInt(discountMinor) > 0n && !input.discountReason)
            throw new IdentityError(400, 'Un motif de remise est requis.');
          items.push({
            id: input.id,
            procedureId: procedure.id,
            catalogRevision: previous?.catalogRevision ?? procedure.revision,
            name: previous?.name ?? procedure.name,
            durationMinutes:
              previous?.durationMinutes ?? procedure.durationMinutes,
            scope: input.scope,
            teeth: input.teeth,
            baseMinor,
            priceMinor,
            discountMinor,
            discountReason: input.discountReason,
          });
        }
        const version: TreatmentVersion = {
          id: data.id,
          patientId,
          revision: data.revision + 1,
          title: data.title,
          currency: data.currency,
          status: 'draft',
          items,
          totalMinor: items
            .reduce(
              (n, i) => n + BigInt(i.priceMinor) - BigInt(i.discountMinor),
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
          throw new IdentityError(
            400,
            'Activez cette devise dans les paramètres.',
          );
        const old = await r.procedure(data.id);
        if ((old?.revision ?? 0) !== data.revision)
          throw new IdentityError(
            409,
            'Le catalogue a changé. Rechargez et réconciliez votre saisie conservée.',
          );
        if (old && old.currency !== data.currency)
          throw new IdentityError(
            400,
            'La devise existante ne peut pas être réétiquetée. Créez un autre acte.',
          );
        const content = {
          id: data.id,
          revision: data.revision,
          name: data.name,
          currency: data.currency,
          durationMinutes: data.durationMinutes,
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
