/**
 * « Déjà fait » à la création d'une culture.
 *
 * Friction 2026-08-23 : un maraîcher qui enregistre un semis réalisé la veille
 * crée la culture avec sa vraie date… puis doit RETROUVER la culture et cocher
 * « semis fait » dans un second geste. Sur trois cultures saisies le même
 * matin, une seule a reçu ce second geste — le briefing du lendemain relançait
 * « 2 semis en retard » pour du travail déjà en terre.
 *
 * Les formulaires de création proposent donc la case au bon moment, avec deux
 * règles distinctes :
 *
 * - la case n'est PROPOSÉE que si la date rend l'étape réalisable (aujourd'hui
 *   ou avant) — l'invariant d'exécution interdit une étape faite datée dans le
 *   futur (cf. execution.ts) ;
 * - elle n'est PRÉ-COCHÉE que sur une saisie MANUELLE d'une date strictement
 *   passée : antidater est le geste de qui enregistre l'histoire. Une date du
 *   jour reste ambiguë (« je sème cet après-midi ») et les préremplissages ITP
 *   posent des dates sans intention de l'utilisateur — ni l'un ni l'autre ne
 *   cochent à sa place.
 *
 * Les comparaisons se font en journées civiles locales, comme execution.ts :
 * comparer des instants bruts déclarerait « futur » une date du jour stockée
 * à minuit.
 */

import { jourCivilLocal } from './execution'

function versDate(valeur: Date | string | null | undefined): Date | null {
  if (!valeur) return null
  const d = valeur instanceof Date ? valeur : new Date(valeur)
  return Number.isNaN(d.getTime()) ? null : d
}

/** La case « déjà fait » a-t-elle un sens pour cette date ? (aujourd'hui ou avant) */
export function etapeDejaRealisable(
  date: Date | string | null | undefined,
  maintenant: Date = new Date(),
): boolean {
  const d = versDate(date)
  if (!d) return false
  return jourCivilLocal(d) <= jourCivilLocal(maintenant)
}

/** Faut-il pré-cocher après une saisie manuelle ? (date strictement passée) */
export function cocherApresSaisieManuelle(
  date: Date | string | null | undefined,
  maintenant: Date = new Date(),
): boolean {
  const d = versDate(date)
  if (!d) return false
  return jourCivilLocal(d) < jourCivilLocal(maintenant)
}
