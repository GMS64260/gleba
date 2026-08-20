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

import { addDays, getISOWeek, getISOWeekYear, startOfWeek } from "date-fns"
import { calculerDateDepuisSemaine, semaineAbsolue } from "@/lib/assistant-helpers"
import {
  appliquerDecalageItp,
  decalageItpPourLecteur,
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
    // QA cmswxqnaz : `getWeek(…, { weekStartsOn: 1 })` ancre la semaine 1 sur
    // « la semaine contenant le 1er janvier » (firstWeekContainsDate: 1) et
    // diverge de l'ISO dès que le 1er janvier tombe un vendredi, samedi ou
    // dimanche (2027, 2028, 2032…). Tout le reste de Gleba lit et écrit en
    // semaine ISO (`getISOWeek`, `calculerDateDepuisSemaine`) : le couple
    // (annee, semaine) doit rester dans cette même convention, sinon la clé
    // anti-redondance `tache-itp-semaine:AAAA-Sww` saute ou se répète au
    // passage d'année, et le « S12 » affiché ne désigne pas la fenêtre calculée.
    semaine: getISOWeek(reference),
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
  /** null = catalogue officiel ; renseigné = ITP personnel d'un membre. */
  userId?: string | null
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

  // Cascade en semaines ABSOLUES : chaque jalon sert de référence au suivant sous
  // sa forme reportée (> 52 si l'étape est passée à l'année suivante). Passer la
  // semaine bornée 1–52 perdait le report et ramenait la récolte avant la
  // plantation.
  const semisAbsolu = decale.semaineSemis != null ? semaineAbsolue(decale.semaineSemis) : null
  let plantationAbsolue: number | null = null
  if (decale.semainePlantation != null) {
    plantationAbsolue = semaineAbsolue(decale.semainePlantation, semisAbsolu)
    const debut = calculerDateDepuisSemaine(annee, plantationAbsolue)
    ops.push({ type: "plantation", debut, fin: new Date(debut.getTime() + 6 * JOUR_MS) })
  }

  if (decale.semaineRecolte != null) {
    const debut = calculerDateDepuisSemaine(
      annee,
      semaineAbsolue(decale.semaineRecolte, plantationAbsolue ?? semisAbsolu)
    )
    // Fenêtre de récolte à cheval sur le 31 décembre : « S50 → S3 » vaut 6
    // semaines, pas une. La soustraction nue rendait un nombre négatif ramené à 1
    // par le Math.max, alors que le calendrier ITP, lui, dessine bien les deux
    // barres (GanttRow). 41 itinéraires sont dans ce cas, 59 après calage
    // climatique.
    const nbSemaines =
      decale.semaineRecolteFin != null
        ? ((decale.semaineRecolteFin - decale.semaineRecolte + 52) % 52) + 1
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
  /**
   * Dates réellement saisies sur la culture. Elles font foi : les semaines de
   * l'ITP ne servent qu'aux jalons que l'utilisateur n'a pas datés.
   */
  dateSemis?: Date | string | null
  datePlantation?: Date | string | null
  dateRecolte?: Date | string | null
}

/** Flag « fait » qui éteint l'opération correspondante (pas de doublon de tâche). */
const FAIT_PAR_TYPE: Record<TypeOperationItp, keyof Pick<CultureItpInput, "semisFait" | "plantationFaite" | "recolteFaite">> = {
  semis: "semisFait",
  plantation: "plantationFaite",
  recolte: "recolteFaite",
}

const ORDRE_TYPE: Record<TypeOperationItp, number> = { semis: 0, plantation: 1, recolte: 2 }

const DATE_PAR_TYPE: Record<
  TypeOperationItp,
  keyof Pick<CultureItpInput, "dateSemis" | "datePlantation" | "dateRecolte">
> = {
  semis: "dateSemis",
  plantation: "datePlantation",
  recolte: "dateRecolte",
}

/**
 * Jalon daté par l'utilisateur : la semaine réelle, ou null si non daté.
 *
 * Les notifications se calculaient sur `culture.annee` et sur les semaines
 * THÉORIQUES de l'ITP, alors que tous les écrans lisent les dates stockées de la
 * culture. Les deux se contredisaient : une courgette semée le 15/04 (S16) avec
 * un ITP à S14/S18/S34 recevait « Cette semaine : planter » en S18, quand
 * /taches plaçait la plantation au 20/05 (S21) — et rien n'arrivait en S21.
 * La date saisie fait foi.
 */
function semaineDuJalon(
  culture: CultureItpInput,
  type: TypeOperationItp
): { annee: number; semaine: number; jour: string } | null {
  const brute = culture[DATE_PAR_TYPE[type]]
  if (!brute) return null
  const d = brute instanceof Date ? brute : new Date(brute)
  if (Number.isNaN(d.getTime())) return null
  // Midi UTC : une date saisie via <input type="date"> peut être persistée à
  // 23:00 la veille (minuit Europe/Paris) — même précaution qu'en planification.
  const jourCivil = new Date(d.getTime() + 12 * 3_600_000)
  return {
    annee: getISOWeekYear(jourCivil),
    semaine: getISOWeek(jourCivil),
    jour: jourCivil.toISOString().slice(0, 10),
  }
}

/**
 * Tâches ITP de la semaine courante pour des cultures actives.
 * Pure : les données sont déjà jointes depuis la base (queries.ts).
 */
export function tachesItpSemainePourCultures(
  cultures: CultureItpInput[],
  options: { userZone?: ZoneClimat | null; lecteurId?: string | null; aujourdHui?: Date } = {}
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
    // Calage du LECTEUR : même règle que la liste ITP, la planification et les
    // calendriers. `decalageItpPourZone` seul déplaçait les semaines qu'un
    // membre avait saisies dans son propre climat (QA cmsqmujo9).
    const decalageZone = decalageItpPourLecteur(
      itp,
      options.userZone ?? null,
      options.lecteurId ?? null
    )

    // Jalons datés par l'utilisateur : ils sortent du calcul ITP et sont
    // confrontés directement à la semaine cible.
    for (const type of ["semis", "plantation", "recolte"] as TypeOperationItp[]) {
      if (culture[FAIT_PAR_TYPE[type]]) continue
      const reelle = semaineDuJalon(culture, type)
      if (!reelle) continue
      if (reelle.annee !== cible.annee || reelle.semaine !== cible.semaine) continue
      taches.push({
        cultureId: culture.id,
        type,
        especeNom: culture.especeNom ?? culture.especeId,
        varieteNom: culture.varieteNom,
        plancheName: culture.plancheName,
        ilot: culture.ilot,
        date: reelle.jour,
        semaine: cible.semaine,
        couleur: culture.couleur,
      })
    }

    for (const op of operationsItpDansSemaine(itp, cible, { anneeCulture, decalageZone })) {
      if (culture[FAIT_PAR_TYPE[op.type]]) continue
      // Jalon déjà daté : la date stockée a été traitée juste au-dessus, la
      // semaine théorique de l'ITP ne doit pas en produire un second.
      if (semaineDuJalon(culture, op.type)) continue
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
