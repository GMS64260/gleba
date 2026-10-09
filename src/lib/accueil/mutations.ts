/**
 * Mutations des lignes de la tuile Aujourd'hui (accueil v2) : chaque action
 * de saisie expose son INVERSE exact, que le toast « Annuler » rejoue
 * (politique de notifications du plan du 2026-10-08 : pas de « soft delete »
 * caché). Les corps visent les routes existantes, idempotentes :
 * `PATCH /api/cultures/{id}` et `PATCH /api/irrigations/{id}`.
 *
 * Module PUR (descriptions seulement) : la composition serveur les attache
 * aux lignes, le client les exécute (`client.ts`).
 */

export interface MutationLigne {
  /** Route PATCH, scopée par le tenant comme toute route. */
  url: string
  /** Corps qui marque la ligne faite. */
  corps: Record<string, unknown>
  /** Corps qui la remet comme avant. */
  inverse: Record<string, unknown>
  /** Titre du toast de confirmation : « Semis noté ». */
  titre: string
  /** Détail du toast : « Radis · B1 ». */
  detail?: string
}

export function mutationEtapeCulture(
  cultureId: number,
  etape: "semis" | "plantation",
  detail?: string,
): MutationLigne {
  const champ = etape === "semis" ? "semisFait" : "plantationFaite"
  return {
    url: `/api/cultures/${cultureId}`,
    corps: { [champ]: true },
    inverse: { [champ]: false },
    titre: etape === "semis" ? "Semis noté" : "Plantation notée",
    detail,
  }
}

export function mutationIrrigationFaite(irrigationId: number, detail?: string): MutationLigne {
  return {
    url: `/api/irrigations/${irrigationId}`,
    // La route pose elle-même `dateEffective` à maintenant quand `fait` passe à
    // vrai ; l'inverse l'efface pour revenir exactement à l'état d'avant.
    corps: { fait: true },
    inverse: { fait: false, dateEffective: null },
    titre: "Arrosage noté",
    detail,
  }
}
