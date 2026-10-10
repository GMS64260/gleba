import type { Prisma } from '@prisma/client'

/**
 * Filtre des ARROSAGES RÉELLEMENT NOTÉS dans `irrigations_planifiees`.
 *
 * Depuis la refonte du 2026-10-10, la table ne porte plus que l'historique :
 * les arrosages notés (`fait`). Elle garde aussi deux reliquats de l'ancien
 * plan qui ne sont pas des arrosages : les passages jamais faits (`fait` faux,
 * en attente ou périmés) et les passages « auto-validés » par la pluie
 * (`fait`, note « Auto-validé : pluie suffisante » ou « Auto-validée (pluie
 * suffisante) »). Calendrier, registre d'interventions et assistant lisent
 * cette seule définition.
 *
 * `notes` est nullable : un `NOT startsWith` seul écarterait aussi les vrais
 * arrosages sans observation (NULL en SQL), d'où le OU explicite.
 */
export function whereArrosageNote(): Prisma.IrrigationPlanifieeWhereInput {
  return {
    fait: true,
    OR: [{ notes: null }, { NOT: { notes: { startsWith: 'Auto-valid' } } }],
  }
}
