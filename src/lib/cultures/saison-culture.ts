/**
 * Alerte « hors saison » d'une culture légumière : la date d'implantation
 * saisie (plantation pour un itinéraire en plantation, semis sinon) comparée à
 * la fenêtre d'implantation de son ITP. Une seule règle pour le formulaire
 * « Nouvelle culture », l'assistant « Semer », `POST`/`PUT /api/cultures` et
 * les tâches du jour.
 *
 * Constat du 2026-10-25 sur un compte réel : une aubergine sous abri (ITP
 * « implantation S16–S18 ») créée le 25 octobre partait plantée le jour même
 * (le formulaire décale tout le cycle quand la fenêtre de l'année est passée),
 * et l'accueil affichait « Planter Aubergine — aujourd'hui » sans un mot sur la
 * saison. L'avertissement existant (`validateCultureDates`, ±28 jours autour de
 * la seule semaine de plantation) ne vivait que dans un toast après
 * l'enregistrement.
 *
 * Non bloquant, comme `alerteSaisonRecolteArbre` du verger : l'écart est DIT,
 * l'utilisateur garde la main (abri chauffé, essai, contre-saison voulue).
 */

import { getISOWeek } from "date-fns"
import { jourCivilStocke } from "@/lib/jour-civil"
import { semaineSemisEffective } from "@/lib/cultures/dates-itp"
import {
  SEMAINES_PAR_AN,
  dureeEntreSemaines,
  normaliserSemaine,
  semainesDePeriode,
} from "@/lib/semaines-lisibles"

/** Écart toléré autour de la fenêtre d'implantation, en semaines. */
export const TOLERANCE_SEMAINES_IMPLANTATION = 3

/** Champs d'un ITP (déjà calé sur la zone du lecteur) lus par l'alerte. */
export interface ItpSaison {
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineImplantationDebut?: number | null
  semaineImplantationFin?: number | null
  /** Opération d'implantation de la source (« Plantation », « Semis »…). */
  implantation?: string | null
}

export type EtapeImplantation = "semis" | "plantation"

export interface AlerteSaisonCulture {
  /** Étape comparée à la fenêtre. */
  etape: EtapeImplantation
  /** Champ de la culture qui porte la date comparée. */
  champ: "dateSemis" | "datePlantation"
  /** Semaine ISO de la date saisie. */
  semaine: number
  fenetre: { debut: number; fin: number }
  /** Semaines entre la date saisie et la fenêtre (au-delà de la tolérance). */
  ecartSemaines: number
  message: string
}

/** Fenêtre d'implantation documentée par la source (`s_implantation_*`), ou null. */
function fenetreDocumentee(itp: ItpSaison): { debut: number; fin: number } | null {
  const debut = itp.semaineImplantationDebut ?? itp.semaineImplantationFin
  const fin = itp.semaineImplantationFin ?? itp.semaineImplantationDebut
  if (!debut || !fin) return null
  return { debut: normaliserSemaine(debut), fin: normaliserSemaine(fin) }
}

function dansFenetre(semaine: number, fenetre: { debut: number; fin: number }): boolean {
  return semainesDePeriode({ debut: fenetre.debut, duree: dureeEntreSemaines(fenetre.debut, fenetre.fin) }).has(
    normaliserSemaine(semaine),
  )
}

/**
 * Opération qui implante la culture.
 *
 * « Plantation… » ou « Semis » seul, dits par la source, font foi. Sinon
 * (« Semis et implantation », libellé « Semis et plantation » du formulaire
 * d'ITP, ou champ vide d'un ITP historique ou personnel) : l'étape dont la
 * semaine tombe dans la fenêtre d'implantation, à défaut la plantation quand
 * l'ITP en porte une. Revue du 2026-10-25 : un ITP perso semé S10, planté S16,
 * fenêtre S15–S18, était jugé sur son semis et levait une alerte à tort.
 */
export function etapeImplantation(itp: ItpSaison): EtapeImplantation {
  const source = itp.implantation?.trim().toLowerCase() ?? ""
  if (source.startsWith("plantation")) return "plantation"
  if (source.startsWith("semis") && !/\bet\b/.test(source)) return "semis"
  const fenetre = fenetreDocumentee(itp)
  if (fenetre) {
    if (itp.semainePlantation != null && dansFenetre(itp.semainePlantation, fenetre)) return "plantation"
    if (itp.semaineSemis != null && dansFenetre(itp.semaineSemis, fenetre)) return "semis"
  }
  return itp.semainePlantation != null ? "plantation" : "semis"
}

/**
 * Fenêtre d'implantation de l'ITP : celle que la source documente, sinon
 * (ITP historiques du référentiel Gleba, ITP personnels) la seule semaine de
 * référence de l'étape qui implante (`semainePlantation`, ou
 * `semaineSemisEffective`). Null si l'ITP ne situe pas son implantation.
 */
export function fenetreImplantation(itp: ItpSaison | null | undefined): { debut: number; fin: number } | null {
  if (!itp) return null
  const documentee = fenetreDocumentee(itp)
  if (documentee) return documentee
  const reference = etapeImplantation(itp) === "plantation" ? itp.semainePlantation : semaineSemisEffective(itp)
  if (!reference) return null
  const semaine = normaliserSemaine(reference)
  return { debut: semaine, fin: semaine }
}

/** Semaine ISO du JOUR civil d'une date (stockée à minuit UTC, ou minuit local). */
function semaineDuJour(date: Date | string | null | undefined): number | null {
  const jour = jourCivilStocke(date ?? null)
  if (!jour) return null
  const [a, m, j] = jour.split("-").map(Number)
  return getISOWeek(new Date(a, m - 1, j))
}

/** Écart circulaire entre deux semaines (S52 et S01 sont voisines). */
function ecartCirculaire(a: number, b: number): number {
  const d = Math.abs(normaliserSemaine(a) - normaliserSemaine(b)) % SEMAINES_PAR_AN
  return Math.min(d, SEMAINES_PAR_AN - d)
}

export function alerteSaisonCulture(params: {
  itp: ItpSaison | null | undefined
  dateSemis?: Date | string | null
  datePlantation?: Date | string | null
}): AlerteSaisonCulture | null {
  const { itp } = params
  const fenetre = fenetreImplantation(itp)
  if (!itp || !fenetre) return null

  const etape = etapeImplantation(itp)
  // Itinéraire en plantation : le semis (en pépinière) précède la fenêtre de
  // plusieurs semaines, il ne se compare pas à elle. En semis direct, une
  // date de plantation saisie à la place du semis est l'implantation.
  const champ: AlerteSaisonCulture["champ"] | null =
    etape === "plantation"
      ? params.datePlantation ? "datePlantation" : null
      : params.dateSemis ? "dateSemis" : params.datePlantation ? "datePlantation" : null
  if (!champ) return null
  const semaine = semaineDuJour(champ === "dateSemis" ? params.dateSemis : params.datePlantation)
  if (semaine == null) return null

  const semainesFenetre = semainesDePeriode({ debut: fenetre.debut, duree: dureeEntreSemaines(fenetre.debut, fenetre.fin) })
  const ecartSemaines = Math.min(...[...semainesFenetre].map((s) => ecartCirculaire(semaine, s)))
  if (ecartSemaines <= TOLERANCE_SEMAINES_IMPLANTATION) return null

  const libelleFenetre = fenetre.debut === fenetre.fin ? `S${fenetre.debut}` : `S${fenetre.debut}–S${fenetre.fin}`
  const prevue = champ === "datePlantation" ? "plantation prévue" : "semis prévu"
  return {
    etape,
    champ,
    semaine,
    fenetre,
    ecartSemaines,
    message: `Hors fenêtre de l'itinéraire (${etape} ${libelleFenetre}) : ${prevue} S${semaine}.`,
  }
}
