/**
 * Alerte « récolte hors saison » d'un arbre : une seule règle pour l'écran de
 * saisie, la création et la modification d'une récolte.
 *
 * QA cmvkoxe5o (2026-10-23) — trois surfaces, trois règles : l'encart du
 * formulaire lisait le calendrier de l'ESPÈCE (prunier : juillet-septembre)
 * en ignorant la variété, le POST lisait la variété par son seul id avec sa
 * propre arithmétique de semaines, et la modification (PUT) ne contrôlait
 * rien. Une récolte de Mirabelle de Nancy (mi-août) déplacée au 10 juillet ne
 * levait donc aucune alerte. Désormais :
 *   1. si la variété de l'arbre porte une période de récolte (référentiel,
 *      semaines ISO début + durée, lue comme `semaines-lisibles`), c'est elle
 *      qui fait foi, à `TOLERANCE_SEMAINES_RECOLTE` près ;
 *   2. sinon, le calendrier d'entretien de l'espèce (`checkOperationSaison`).
 * Non bloquant : l'écart est DIT, les micro-climats existent.
 */

import type { PrismaClient } from "@prisma/client"
import { getISOWeek } from "date-fns"
import { checkOperationSaison, type SaisonWarning } from "@/lib/tree-care-calendar"
import {
  SEMAINES_PAR_AN,
  libellePeriodeSemaines,
  normaliserSemaine,
  periodeDepuisSemaines,
  semainesDePeriode,
} from "@/lib/semaines-lisibles"
import { choisirVarieteArbre, whereVarietesCandidates, type ArbreVarieteSaisie } from "@/lib/verger/variete-arbre"

/** Écart toléré autour de la période de la variété, en semaines. */
export const TOLERANCE_SEMAINES_RECOLTE = 3

/** Période de récolte de la variété d'un arbre, telle que le référentiel la porte. */
export interface PeriodeRecolteVariete {
  nom: string
  semaineRecolte: number | null
  dureeRecolte: number | null
}

/**
 * « 2026-07-10 » (jour civil, sans fuseau), horodatage ISO, nombre ou Date →
 * Date locale ; null si illisible. Le corps d'une requête n'est pas typé : un
 * client de l'API peut envoyer un nombre (revue du 2026-10-23, 500 sur le POST).
 */
function lireDate(date: unknown): Date | null {
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : date
  if (typeof date === "number") return Number.isFinite(date) ? new Date(date) : null
  if (typeof date !== "string" || !date) return null
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const d = jour ? new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3])) : new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Notes d'une récolte sans la mention « ⚠️ Hors saison : … » que l'ancien POST
 * y recopiait (feedback cmpky7zmy). Figée à la création, elle restait quand la
 * date était corrigée ; l'alerte se calcule désormais à l'affichage.
 */
export function retirerMarqueSaison(notes: string | null | undefined): string | null {
  if (notes == null) return null
  const nettoyees = notes.replace(/^⚠️ Hors saison : [^\n]*(\n|$)/, "").trim()
  return nettoyees || null
}

/** Écart circulaire entre deux semaines ISO (S52 et S01 sont voisines). */
function ecartSemaines(a: number, b: number): number {
  const d = Math.abs(normaliserSemaine(a) - normaliserSemaine(b)) % SEMAINES_PAR_AN
  return Math.min(d, SEMAINES_PAR_AN - d)
}

export function alerteSaisonRecolteArbre(params: {
  espece: string | null | undefined
  variete: PeriodeRecolteVariete | null | undefined
  date: unknown
}): SaisonWarning | null {
  const d = lireDate(params.date)
  if (!d) return null

  const periode = params.variete
    ? periodeDepuisSemaines(params.variete.semaineRecolte, params.variete.dureeRecolte)
    : null
  if (params.variete && periode) {
    const semaine = getISOWeek(d)
    const ecart = Math.min(...[...semainesDePeriode(periode)].map((s) => ecartSemaines(semaine, s)))
    if (ecart <= TOLERANCE_SEMAINES_RECOLTE) return null
    const jourLisible = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    return {
      niveau: "info",
      message: `La récolte de ${params.variete.nom} se fait habituellement ${libellePeriodeSemaines(
        periode.debut,
        periode.duree,
        d.getFullYear(),
      )}. La date saisie (${jourLisible}, S${String(semaine).padStart(2, "0")}) est hors de cette période.`,
    }
  }

  return params.espece ? checkOperationSaison(params.espece, "recolte", d) : null
}

/**
 * Période de récolte de la variété de chaque arbre (clé : l'arbre lui-même),
 * résolue comme la pollinisation (`choisirVarieteArbre` : id exact, sinon
 * libellé normalisé dans l'espèce, variété du compte d'abord). Une requête
 * pour tout le lot.
 */
export async function chargerPeriodesRecolteVarietes<A extends ArbreVarieteSaisie>(
  db: Pick<PrismaClient, "variete">,
  userId: string,
  arbres: readonly A[],
): Promise<Map<A, PeriodeRecolteVariete | null>> {
  const resultat = new Map<A, PeriodeRecolteVariete | null>()
  const avecVariete = arbres.filter((a) => a.variete?.trim())
  if (avecVariete.length === 0) {
    for (const a of arbres) resultat.set(a, null)
    return resultat
  }
  const candidats = await db.variete.findMany({
    where: whereVarietesCandidates(avecVariete, userId),
    select: {
      id: true,
      nom: true,
      nomNormalise: true,
      especeId: true,
      userId: true,
      semaineRecolte: true,
      dureeRecolte: true,
    },
  })
  for (const a of arbres) {
    const v = choisirVarieteArbre(a, candidats, userId)
    resultat.set(
      a,
      v ? { nom: v.nom?.trim() || v.id, semaineRecolte: v.semaineRecolte, dureeRecolte: v.dureeRecolte } : null,
    )
  }
  return resultat
}
