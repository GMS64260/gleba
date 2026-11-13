import { classerParUrgence } from "./classement"
import type { ElementAujourdhui } from "./types"

/** Même sélection pour l'encart du jour et Gleba, avant tout repli visuel. */
export function urgencesAccueil(elements: readonly ElementAujourdhui[]) {
  const urgences = classerParUrgence(elements.filter((e) => e.urgent || e.etat === "critique"))
  const nombre = urgences.length
  return {
    premiere: urgences[0] ?? null,
    nombre,
    libelle: `${nombre} urgence${nombre > 1 ? "s" : ""}`,
  }
}
