/**
 * Tâches ITP de la semaine (issue #16) — logique PURE.
 *
 * Chaque ITP (itinéraire technique) déclare les semaines canoniques de ses
 * opérations : `semaineSemis`, `semainePlantation`, `semaineRecolte` (début de
 * fenêtre), plus une fin de fenêtre de récolte (`semaineRecolteFin`, ou
 * `dureeRecolte` en repli). On en dérive les opérations « à faire cette
 * semaine » pour les cultures ACTIVES de l'utilisateur (culture rattachée à un
 * ITP, ou espèce disposant d'un ITP de référence).
 *
 * Choix de fenêtre : la SEMAINE CIVILE lundi → dimanche (semaine ISO), pas 7
 * jours glissants — c'est la convention du référentiel Gleba (semaines ISO,
 * `calculerDateDepuisSemaine` calée sur un lundi) et le repère naturel du
 * maraîcher (« Semer les tomates cette semaine »). Une opération est « dans la
 * semaine » quand sa fenêtre couvre au moins un jour de la semaine cible.
 *
 * Les semaines de l'ITP sont recalées sur la zone climatique de l'exploitation
 * (mêmes helpers que la planification : `decalageItpPourZone` +
 * `appliquerDecalageItp`), et l'ancrage se fait sur l'année de la culture
 * (`Culture.annee`, sinon l'année courante) avec report chronologique des
 * opérations qui chevauchent l'année suivante (récolte d'hiver d'un semis
 * d'automne, par ex.).
 *
 * Aucun import runtime lourd : testable sans Prisma ni réseau.
 */

import { addDays, getISOWeekYear, getWeek, startOfWeek } from "date-fns"
import { calculerDateDepuisSemaine, dateSemaineChrono } from "@/lib/assistant-helpers"
import {
  appliquerDecalageItp,
  decalageItpPourZone,
  itpApplicableAZone,
} from "@/lib/calendrier-climat"
import type { ZoneClimat } from "@/lib/terroir"
import { dateLocaleIso } from "./detect"
import type { TacheItpSemaine, TypeOperationItp } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Semaine civile courante (lundi → dimanche, semaine ISO)
// ─────────────────────────────────────────────────────────────────────────────

export interface SemaineCourante {
  /** Année ISO de la semaine (getISOWeekYear — diffère en début/fin d'année). */
  annee: number
  /** Numéro de semaine ISO (1-53). */
  semaine: number
  /** Lundi minuit (heure locale). */
  debut: Date
  /** Dimanche minuit + 1 jour (exclusif). */
  fin: Date
  /** YYYY-MM-DD du lundi. */
  debutIso: string
  /** YYYY-MM-DD du dimanche. */
  finIso: string
}

/** Semaine civile (ISO) contenant `reference` — défaut : aujourd'hui. */
export function semaineCourante(reference: Date = new Date()): SemaineCourante {
  const debut = startOfWeek(reference, { weekStartsOn: 1 })
  const fin = addDays(debut, 7)
  return {
    annee: getISOWeekYear(reference),
    semaine: getWeek(reference, { weekStartsOn: 1 }),
    debut,
    fin,
    debutIso: dateLocaleIso(debut),
    finIso: dateLocaleIso(addDays(debut, 6)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Opérations d'un ITP (semis / plantation / récolte) et leur fenêtre
// ─────────────────────────────────────────────────────────────────────────────

/** Champs d'un ITP utiles au calcul des opérations hebdomadaires. */
export interface ItpSemaineInput {
  id: string
  zoneClimat: ZoneClimat | null
  semaineSemis?: number | null
  semainePlantation?: number | null
  /** Début de la fenêtre de récolte (semaine ISO). */
  semaineRecolte?: number | null
  /** Fin de la fenêtre de récolte (semaine ISO) — prioritaire sur dureeRecolte. */
  semaineRecolteFin?: number | null
  /** Durée de récolte en semaines (repli si semaineRecolteFin absent). */
  dureeRecolte?: number | null
}

/** Fenêtre (en dates) d'une opération ITP. */
export interface FenetreOperationItp {
  type: TypeOperationItp
  /** Lundi de la première semaine de la fenêtre. */
  debut: Date
  /** Dimanche (fin de journée) de la dernière semaine de la fenêtre. */
  fin: Date
}

const JOUR_MS = 86_400_000

/**
 * Opérations d'un ITP positionnées sur l'année de la culture, avec décalage
 * de zone appliqué et report chronologique (plantation/récolte peuvent passer
 * sur l'année suivante si leur semaine « recule » par rapport à l'étape
 * précédente).
 */
export function operationsItp(
  itp: ItpSemaineInput,
  options: { anneeCulture: number; decalageZone?: number }
): FenetreOperationItp[] {
  const annee = options.anneeCulture
  const decale = options.decalageZone ? appliquerDecalageItp(itp, options.decalageZone) : itp
  const ops: FenetreOperationItp[] = []

  if (decale.semaineSemis != null) {
    const debut = calculerDateDepuisSemaine(annee, decale.semaineSemis)
    ops.push({ type: "semis", debut, fin: new Date(debut.getTime() + 6 * JOUR_MS) })
  }

  if (decale.semainePlantation != null) {
    const debut = dateSemaineChrono(annee, decale.semainePlantation, decale.semaineSemis ?? null)
    ops.push({ type: "plantation", debut, fin: new Date(debut.getTime() + 6 * JOUR_MS) })
  }

  if (decale.semaineRecolte != null) {
    const debut = dateSemaineChrono(
      annee,
      decale.semaineRecolte,
      decale.semainePlantation ?? decale.semaineSemis ?? null
    )
    const nbSemaines =
      decale.semaineRecolteFin != null
        ? Math.max(1, decale.semaineRecolteFin - decale.semaineRecolte + 1)
        : decale.dureeRecolte != null
          ? Math.max(1, decale.dureeRecolte)
          : 1
    ops.push({ type: "recolte", debut, fin: new Date(debut.getTime() + (nbSemaines * 7 - 1) * JOUR_MS) })
  }

  return ops
}

/** Opérations d'un ITP dont la fenêtre couvre la semaine cible. */
export function operationsItpDansSemaine(
  itp: ItpSemaineInput,
  cible: SemaineCourante,
  options: { anneeCulture: number; decalageZone?: number }
): Array<FenetreOperationItp & { date: string }> {
  const debutCible = cible.debut.getTime()
  const finCible = cible.fin.getTime() - 1 // dimanche minuit exclusif → fin de journée
  const dansSemaine: Array<FenetreOperationItp & { date: string }> = []
  for (const op of operationsItp(itp, options)) {
    // Intersection de fenêtres : l'op touche la semaine si elle n'est ni
    // entièrement avant, ni entièrement après.
    if (op.debut.getTime() <= finCible && op.fin.getTime() >= debutCible) {
      dansSemaine.push({ ...op, date: dateLocaleIso(op.debut) })
    }
  }
  return dansSemaine
}

// ─────────────────────────────────────────────────────────────────────────────
// Croisement avec les cultures actives
// ─────────────────────────────────────────────────────────────────────────────

/** Culture active telle que fournie par queries.ts (déjà jointe). */
export interface CultureItpInput {
  id: number
  especeId: string
  /** Année de planification — ancre les semaines ITP (défaut : année courante). */
  annee: number | null
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  couleur: string | null
  especeNom: string | null
  varieteNom: string | null
  plancheName: string | null
  ilot: string | null
  /** ITP résolu (culture.itp, sinon meilleur ITP de l'espèce). */
  itp: ItpSemaineInput | null
}

/** Flag « fait » qui éteint l'opération correspondante (pas de doublon de tâche). */
const FAIT_PAR_TYPE: Record<TypeOperationItp, keyof Pick<CultureItpInput, "semisFait" | "plantationFaite" | "recolteFaite">> = {
  semis: "semisFait",
  plantation: "plantationFaite",
  recolte: "recolteFaite",
}

const ORDRE_TYPE: Record<TypeOperationItp, number> = { semis: 0, plantation: 1, recolte: 2 }

/**
 * Tâches ITP de la semaine courante pour des cultures actives.
 * Pure : les données sont déjà jointes depuis la base (queries.ts).
 */
export function tachesItpSemainePourCultures(
  cultures: CultureItpInput[],
  options: { userZone?: ZoneClimat | null; aujourdHui?: Date } = {}
): TacheItpSemaine[] {
  const cible = semaineCourante(options.aujourdHui ?? new Date())
  const taches: TacheItpSemaine[] = []

  for (const culture of cultures) {
    const itp = culture.itp
    if (!itp) continue
    // Un ITP métropolitain n'est pas transposable hors de la métropole
    // (zones tropicales/hémisphère sud : ITP dédiés uniquement).
    if (!itpApplicableAZone(itp.zoneClimat, options.userZone ?? null)) continue

    const anneeCulture = culture.annee ?? cible.annee
    const decalageZone = decalageItpPourZone(itp.zoneClimat, options.userZone ?? null)

    for (const op of operationsItpDansSemaine(itp, cible, { anneeCulture, decalageZone })) {
      if (culture[FAIT_PAR_TYPE[op.type]]) continue
      taches.push({
        cultureId: culture.id,
        type: op.type,
        especeNom: culture.especeNom ?? culture.especeId,
        varieteNom: culture.varieteNom,
        plancheName: culture.plancheName,
        ilot: culture.ilot,
        date: op.date,
        semaine: cible.semaine,
        couleur: culture.couleur,
      })
    }
  }

  return taches.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      ORDRE_TYPE[a.type] - ORDRE_TYPE[b.type] ||
      a.especeNom.localeCompare(b.especeNom)
  )
}
