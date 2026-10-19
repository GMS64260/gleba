/**
 * Année d'une opération d'entretien du verger : source unique du filtre
 * d'année de l'onglet Opérations, de la route GET /api/arbres/operations et du
 * calendrier mensuel.
 *
 * Signalement QA du 2026-10-19 : le sélecteur d'année du verger était conservé
 * au rechargement, mais l'onglet Opérations chargeait toutes les opérations de
 * toutes les années ; une taille prévue le 15/07/2027 et des tailles de février
 * 2026 restaient listées sous 2025 comme sous 2027, avec le même coût total.
 *
 * Règle : la date qui place une opération dans le temps est
 *   - pour une opération réalisée, sa date de réalisation (`date`) ;
 *   - pour une opération à faire, sa date prévue (`datePrevue`), à défaut
 *     `date` (colonne non nulle, qui reçoit aussi la date prévue à la saisie).
 * C'est la date affichée dans la colonne Date de l'onglet et celle qui
 * positionne l'opération dans le calendrier. L'année est l'année civile locale
 * de cette date. Aucune opération n'échappe donc à un exercice : une opération
 * à faire d'une année passée reste sous son année (et dans le Calendrier, qui
 * regroupe tout ce qui reste à faire).
 *
 * Module pur : importable côté écran comme côté route.
 */

export interface OperationArbreDatee {
  fait: boolean
  date: Date | string | null
  datePrevue: Date | string | null
}

function versDate(valeur: Date | string | null | undefined): Date | null {
  if (!valeur) return null
  const date = valeur instanceof Date ? valeur : new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Date qui place l'opération dans le temps (réalisation, sinon date prévue). */
export function dateReferenceOperationArbre(op: OperationArbreDatee): Date | null {
  return op.fait
    ? versDate(op.date) ?? versDate(op.datePrevue)
    : versDate(op.datePrevue) ?? versDate(op.date)
}

/** Année civile (locale) de l'opération, ou null sans date exploitable. */
export function anneeOperationArbre(op: OperationArbreDatee): number | null {
  return dateReferenceOperationArbre(op)?.getFullYear() ?? null
}

export function operationArbreDansAnnee(op: OperationArbreDatee, annee: number): boolean {
  return anneeOperationArbre(op) === annee
}

/**
 * Même règle, en filtre Prisma (`OperationArbreWhereInput`) : bornes locales
 * [1er janvier, 1er janvier suivant[, comme les autres routes du verger.
 */
export function whereOperationsArbreAnnee(annee: number) {
  const dansAnnee = { gte: new Date(annee, 0, 1), lt: new Date(annee + 1, 0, 1) }
  return {
    OR: [
      { fait: true, date: dansAnnee },
      { fait: false, datePrevue: dansAnnee },
      { fait: false, datePrevue: null, date: dansAnnee },
    ],
  }
}

/** Coût des opérations listées : total, part réalisée, part prévue. */
export function resumeCoutOperations(
  operations: ReadonlyArray<{ fait: boolean; cout: number | null }>,
): { total: number; realise: number; prevu: number } {
  let realise = 0
  let prevu = 0
  for (const op of operations) {
    const cout = op.cout ?? 0
    if (!Number.isFinite(cout)) continue
    if (op.fait) realise += cout
    else prevu += cout
  }
  return { total: realise + prevu, realise, prevu }
}
