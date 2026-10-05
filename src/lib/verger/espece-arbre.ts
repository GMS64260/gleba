/**
 * Espèce d'un arbre : rattachement au catalogue et parcelle par défaut.
 *
 * Friction du 2026-10-05 (compte verger inscrit le 04/10) : 52 arbres saisis en
 * deux jours, AUCUN relié au catalogue (`espece_id` nul partout) et aucun
 * rattaché à la parcelle du compte. Le champ espèce est une saisie libre
 * assistée : « kiwi », « prunier », « pommier » en minuscules côtoyaient
 * « Kiwi », « Prunier », « Pommier » du catalogue, ce qui fabrique des espèces
 * distinctes dans les regroupements, et rien ne disait à l'utilisateur qu'une
 * espèce hors catalogue n'a ni âge d'entrée en production ni adéquation au
 * climat.
 *
 * Règle : une saisie qui désigne une espèce du catalogue (à la casse, aux
 * accents et aux tirets près) est enregistrée sous le nom canonique ET reliée
 * par `especeId`. Une saisie hors catalogue reste acceptée — repli explicite,
 * signalé au retour de l'API — car le catalogue ne couvre pas tout (asiminier,
 * arbousier…).
 */

import { normalizeReferentielKey } from "@/lib/normalize"

/** Types d'espèces du référentiel qui désignent des arbres (cf. `?type=all_arbres`). */
export const TYPES_ESPECE_ARBRE = ["arbre_fruitier", "petit_fruit"] as const

export interface EspeceCandidate {
  id: string
  nom: string | null
  userId: string | null
  type: string
}

export interface EspeceResolue {
  /** Libellé à enregistrer dans `arbres.espece`. */
  espece: string
  /** Clé du référentiel, ou null hors catalogue. */
  especeId: string | null
  horsCatalogue: boolean
}

const nomAffiche = (e: EspeceCandidate) => e.nom?.trim() || e.id

/**
 * Choisit l'entrée du référentiel désignée par la saisie, sans accès base.
 * Priorité : espèce d'arbre avant les autres types, puis l'entrée personnelle
 * de l'utilisateur, puis l'officielle, puis une entrée partagée.
 */
export function choisirEspeceArbre(
  saisie: string,
  candidats: EspeceCandidate[],
  userId: string,
): EspeceResolue {
  const libre = saisie.replace(/\s+/g, " ").trim()
  const cle = normalizeReferentielKey(libre)
  const correspondants = candidats.filter(
    (e) => normalizeReferentielKey(nomAffiche(e)) === cle || normalizeReferentielKey(e.id) === cle,
  )
  if (correspondants.length === 0) {
    return { espece: libre, especeId: null, horsCatalogue: true }
  }
  const rang = (e: EspeceCandidate) =>
    ((TYPES_ESPECE_ARBRE as readonly string[]).includes(e.type) ? 0 : 10) +
    (e.userId === userId ? 0 : e.userId == null ? 1 : 2)
  const retenue = [...correspondants].sort((a, b) => rang(a) - rang(b))[0]
  return { espece: nomAffiche(retenue), especeId: retenue.id, horsCatalogue: false }
}

export interface ParcelleCandidate {
  id: string
  usage: string | null
  couches: string[]
}

const estVerger = (p: ParcelleCandidate) =>
  p.couches.includes("VERGER") ||
  (p.usage ?? "").split(",").some((u) => u.trim().toLowerCase() === "verger")

/**
 * Parcelle à laquelle rattacher un arbre créé sans parcelle ni GPS.
 * Sans ambiguïté seulement : la seule parcelle du compte, ou à défaut la seule
 * parcelle catégorisée Verger. Plusieurs candidates → null (on ne devine pas).
 */
export function parcelleParDefautArbre(parcelles: ParcelleCandidate[]): string | null {
  if (parcelles.length === 1) return parcelles[0].id
  const vergers = parcelles.filter(estVerger)
  return vergers.length === 1 ? vergers[0].id : null
}

interface ClientEspeces {
  espece: {
    findMany(args: {
      where: object
      select: { id: true; nom: true; userId: true; type: true }
    }): Promise<EspeceCandidate[]>
  }
}

/** Résout la saisie contre les espèces d'arbres visibles par l'utilisateur. */
export async function resoudreEspeceArbre(
  client: ClientEspeces,
  userId: string,
  saisie: string,
): Promise<EspeceResolue> {
  const candidats = await client.espece.findMany({
    where: {
      AND: [
        { type: { in: [...TYPES_ESPECE_ARBRE] } },
        { OR: [{ userId: null }, { partageCommunaute: true }, { userId }] },
      ],
    },
    select: { id: true, nom: true, userId: true, type: true },
  })
  return choisirEspeceArbre(saisie, candidats, userId)
}
