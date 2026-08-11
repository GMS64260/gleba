/**
 * Assemblage PUR du résumé quotidien « Quoi faire ce matin ? ».
 * La partie base de données vit dans `queries.ts` ; ici tout est testable
 * sans Prisma ni réseau.
 */

import { dateLocaleIso } from "./detect"
import type { AlerteMeteoNotification, ResumeQuotidien, TacheJour, TypeTache } from "./types"

/** Trie les tâches par date puis par type, et les alertes par date. */
export function construireResume(
  taches: TacheJour[],
  alertes: AlerteMeteoNotification[],
  options: { date?: string } = {}
): ResumeQuotidien {
  return {
    date: options.date ?? dateLocaleIso(),
    taches: [...taches].sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime() ||
        ordreTypeTache(a.type) - ordreTypeTache(b.type)
    ),
    alertesMeteo: [...alertes].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

const ORDRE_TYPES: Record<TypeTache, number> = {
  semis: 0,
  plantation: 1,
  recolte: 2,
  irrigation: 3,
}

function ordreTypeTache(type: TypeTache): number {
  return ORDRE_TYPES[type] ?? 99
}

export function labelTypeTache(type: TypeTache): string {
  switch (type) {
    case "semis":
      return "Semis"
    case "plantation":
      return "Plantations"
    case "recolte":
      return "Récoltes"
    case "irrigation":
      return "Irrigations"
  }
}

export function labelAlerteMeteo(type: AlerteMeteoNotification["type"]): string {
  switch (type) {
    case "gel":
      return "gel attendu"
    case "orage":
      return "orage en cours"
    case "canicule":
      return "canicule"
    case "vent":
      return "vent fort"
    case "pluie":
      return "pluie abondante"
  }
}

/** Libellé court d'une alerte pour l'objet de l'email (« gel attendu »). */
export function labelAlerteMeteoCourt(type: AlerteMeteoNotification["type"]): string {
  switch (type) {
    case "gel":
      return "gel attendu"
    case "orage":
      return "orage"
    case "canicule":
      return "canicule"
    case "vent":
      return "vent fort"
    case "pluie":
      return "pluie abondante"
  }
}

/** Regroupe les tâches par type pour le rendu en sections. */
export function grouperTachesParType(taches: TacheJour[]): Map<TypeTache, TacheJour[]> {
  const groupes = new Map<TypeTache, TacheJour[]>()
  for (const tache of taches) {
    const liste = groupes.get(tache.type) ?? []
    liste.push(tache)
    groupes.set(tache.type, liste)
  }
  return groupes
}

/** Nombre de tâches restant à faire (pour le pied du résumé). */
export function nombreTachesAFaire(taches: TacheJour[]): number {
  return taches.filter((t) => !t.fait).length
}
