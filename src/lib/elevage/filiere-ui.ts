/**
 * Capacités d'UI par filière d'élevage (Phase 0 « modes d'élevage »).
 *
 * Source unique de vérité pour décider quelles surfaces « élevage de rente »
 * (lait, ponte, abattage, tarissement, délais d'attente…) sont pertinentes pour
 * un animal, en fonction de la filière de son espèce. Les composants consomment
 * `capacites(filiere)` pour masquer — jamais supprimer — les surfaces hors sujet.
 *
 * Principe Phase 0 : `rente` = comportement historique inchangé ; toute autre
 * filière (compagnie/équin/NAC) partage le profil « compagnie ». Les
 * différenciations équin/NAC viendront en Phase 1+.
 *
 * cf. docs/elevage-modes-phase0-spec.md
 */

import type { Filiere } from "@/lib/elevage/filiere"

export interface CapacitesFiliere {
  /** L'animal produit une denrée de rente (lait, œufs, viande, laine…). */
  productionRente: boolean
  /** Délais d'attente lait/viande applicables (résidus → denrées consommables). */
  delaisAttente: boolean
  /** Tarissement pertinent (femelle laitière). */
  tarissement: boolean
  /** Ponte / œufs pertinents. */
  ponte: boolean
  /** Abattage / rendement carcasse pertinents. */
  abattage: boolean
  /** Reproduction (saillies, gestation, portées) — pertinente pour toutes les filières. */
  reproduction: boolean
  /** Généalogie / filiation — pertinente pour toutes les filières. */
  genealogie: boolean
  /** Mettre en avant l'identification par puce (I-CAD/SIRE) plutôt que la boucle. */
  identificationPuce: boolean
  /** Réservations/acquéreurs et documents de cession canins/félins. */
  reservations: boolean
  /** Tests santé, pedigree et compatibilité de sélection. */
  selection: boolean
  /** Variante de tableau de bord à présenter. */
  dashboard: "rente" | "compagnie"
}

const RENTE: CapacitesFiliere = {
  productionRente: true,
  delaisAttente: true,
  tarissement: true,
  ponte: true,
  abattage: true,
  reproduction: true,
  genealogie: true,
  identificationPuce: false,
  reservations: false,
  selection: false,
  dashboard: "rente",
}

const COMPAGNIE: CapacitesFiliere = {
  productionRente: false,
  delaisAttente: false,
  tarissement: false,
  ponte: false,
  abattage: false,
  reproduction: true,
  genealogie: true,
  identificationPuce: true,
  reservations: true,
  selection: true,
  dashboard: "compagnie",
}

const EQUIN: CapacitesFiliere = {
  ...COMPAGNIE,
  // Les documents de réservation/cession actuels citent I-CAD, LOF/LOOF et
  // le certificat d'engagement chiens/chats : ils ne sont pas valables pour
  // une cession équine. La sélection et les tests restent pertinents.
  reservations: false,
}

const NAC: CapacitesFiliere = {
  ...COMPAGNIE,
  // Le socle actuel de sélection est LOF/LOOF/SIRE et ses tests santé sont
  // calibrés chiens/équins. Ne pas le présenter comme adapté aux NAC.
  reservations: false,
  selection: false,
}

export function capacites(filiere: Filiere): CapacitesFiliere {
  if (filiere === "compagnie") return COMPAGNIE
  if (filiere === "equin") return EQUIN
  if (filiere === "nac") return NAC
  return RENTE
}

/** Raccourci : la filière relève-t-elle de l'élevage de rente ? */
export function estRente(filiere: Filiere): boolean {
  return filiere === "rente"
}

/** Conserve le sous-onglet courant uniquement s'il reste disponible. */
export function normaliserSousOnglet(
  courant: string,
  disponibles: readonly string[],
  repli: string,
): string {
  return disponibles.includes(courant) ? courant : repli
}
