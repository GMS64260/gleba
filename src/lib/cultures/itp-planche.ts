/**
 * Conduite d'un itinéraire technique (sous abri ou plein champ) contre le type
 * de la planche où la culture est posée.
 *
 * Ticket QA cmv4z6yhg (2026-10-12) : sur une planche sans type, le formulaire
 * proposait d'office le premier ITP du catalogue, « radis — sous abri forcé »,
 * et la culture partait avec son calendrier sans que personne ait dit que la
 * planche était sous abri. Même lecture du type de planche que l'arrosage
 * (`typeSousAbri`) : un type absent est inconnu, jamais supposé en plein champ,
 * et on ne déduit rien du nom de la planche ni de la parcelle.
 */
import { typeSousAbri } from "@/lib/irrigation/abri"

export type Conduite = "abri" | "plein_champ"

/** Conduite imposée par un ITP (`typePlanche`), ou null s'il n'en impose pas. */
export function conduiteItp(typePlanche: string | null | undefined): Conduite | null {
  return conduiteDepuisType(typePlanche)
}

/** Conduite qu'offre une planche d'après son type, ou null si le type manque. */
export function conduitePlanche(type: string | null | undefined): Conduite | null {
  return conduiteDepuisType(type)
}

function conduiteDepuisType(type: string | null | undefined): Conduite | null {
  const abri = typeSousAbri(type)
  if (abri === null) return null
  return abri ? "abri" : "plein_champ"
}

export const LIBELLE_CONDUITE: Record<Conduite, string> = {
  abri: "sous abri",
  plein_champ: "en plein champ",
}

export type VerdictItpPlanche =
  | { etat: "sans_planche" }
  /** L'ITP n'impose pas de conduite : toute planche convient. */
  | { etat: "sans_conduite" }
  | { etat: "planche_sans_type"; conduite: Conduite }
  | { etat: "compatible"; conduite: Conduite }
  | { etat: "incompatible"; conduite: Conduite; planche: Conduite }

export function verdictItpPlanche(
  itp: { typePlanche?: string | null } | null | undefined,
  planche: { type?: string | null } | null | undefined,
): VerdictItpPlanche {
  if (!planche) return { etat: "sans_planche" }
  const conduite = conduiteItp(itp?.typePlanche)
  if (!conduite) return { etat: "sans_conduite" }
  const offerte = conduitePlanche(planche.type)
  if (!offerte) return { etat: "planche_sans_type", conduite }
  if (offerte === conduite) return { etat: "compatible", conduite }
  return { etat: "incompatible", conduite, planche: offerte }
}

export type MotifProposition =
  /** Aucun ITP pour cette espèce. */
  | "aucun"
  /** Pas de planche : le premier ITP par confiance, comme avant. */
  | "premier"
  /** Un ITP compatible avec le type de la planche (ou sans conduite imposée). */
  | "compatible"
  /** Planche sans type : le premier ITP par confiance, parce qu'il n'impose pas de conduite. */
  | "sans_conduite"
  /** Planche sans type et tous les ITP imposent une conduite : rien d'office. */
  | "planche_sans_type"
  /** Planche typée et aucun ITP ne lui convient : rien d'office. */
  | "aucun_compatible"

/**
 * ITP proposé d'office à la création d'une culture. `itps` est déjà trié par
 * confiance (`sortBy=confiance`) : on retient le premier qui convient.
 *
 * Planche sans type : on ne descend pas l'ordre de confiance pour trouver un
 * ITP sans conduite imposée (relecture du 2026-10-12 : le catalogue officiel
 * est typé, les seuls ITP « libres » sont des contributions de membres, en
 * fin de liste ; en proposer un reviendrait à appliquer un itinéraire moins
 * sûr que la référence écartée). Seul le premier par confiance est proposé,
 * et seulement s'il n'impose rien.
 */
export function choisirItpParDefaut<T extends { id: string; typePlanche?: string | null }>(
  itps: readonly T[],
  planche: { type?: string | null } | null | undefined,
): { itp: T | null; motif: MotifProposition } {
  if (itps.length === 0) return { itp: null, motif: "aucun" }
  if (!planche) return { itp: itps[0], motif: "premier" }
  const offerte = conduitePlanche(planche.type)
  if (!offerte) {
    return conduiteItp(itps[0].typePlanche) === null
      ? { itp: itps[0], motif: "sans_conduite" }
      : { itp: null, motif: "planche_sans_type" }
  }
  const convient = itps.find((i) => {
    const conduite = conduiteItp(i.typePlanche)
    return conduite === null || conduite === offerte
  })
  return convient ? { itp: convient, motif: "compatible" } : { itp: null, motif: "aucun_compatible" }
}

/**
 * Avertissement serveur (non bloquant) quand l'ITP retenu contredit le type de
 * la planche. Une planche sans type ne déclenche rien ici : l'écran le dit au
 * moment du choix, et la plupart des planches n'ont pas de type.
 */
export function avertissementItpPlanche(
  verdict: VerdictItpPlanche,
  noms: { itp: string; planche: string },
): string | null {
  if (verdict.etat !== "incompatible") return null
  return `L'itinéraire technique « ${noms.itp} » est conduit ${LIBELLE_CONDUITE[verdict.conduite]} ; la planche « ${noms.planche} » est ${LIBELLE_CONDUITE[verdict.planche]}.`
}
