/**
 * Indicateurs de reproduction du troupeau (PROMPT 23) — fonctions pures.
 *
 * Dérive les repères zootechniques de pilotage de la reproduction à partir des
 * saillies et des naissances : fertilité, prolificité, mortalité des jeunes à
 * la naissance, intervalle entre mises-bas (IVV) et âge au premier part.
 *
 * Aucune donnée persistée en plus : tout est calculé à la volée.
 */

export type SaillieRepro = { femelleId: number; date: Date | string; statut: string }
export type NaissanceRepro = {
  mereId: number | null
  date: Date | string
  nombreNes: number
  nombreVivants: number
}
export type FemelleRepro = { id: number; dateNaissance: Date | string | null }

export type IndicateursRepro = {
  nbSaillies: number
  nbSailliesAvecIssue: number
  nbMiseBas: number
  /** % de saillies fécondantes parmi celles ayant une issue connue. */
  tauxFertilite: number | null
  /** Nés (total) moyens par mise-bas. */
  prolificite: number | null
  /** Nés-vivants moyens par mise-bas. */
  prolificiteVivants: number | null
  /** % de mortinatalité à la mise-bas = (nés − vivants) / nés. */
  mortaliteNaissance: number | null
  /** Intervalle moyen entre deux mises-bas (jours), sur les femelles ≥ 2 mises-bas. */
  ivvMoyenJours: number | null
  nbFemellesIvv: number
  /** Âge moyen au premier part (jours), sur les femelles à date de naissance connue. */
  agePremierPartJours: number | null
  nbFemellesAgePremierPart: number
}

const ms = (d: Date | string) => new Date(d).getTime()
const STATUTS_FECONDANTS = new Set(['Gestante', 'Mise-bas réalisée'])
const STATUTS_ISSUE = new Set(['Gestante', 'Non gestante', 'Mise-bas réalisée', 'Avortement'])

export function indicateursRepro(
  saillies: SaillieRepro[],
  naissances: NaissanceRepro[],
  femelles: FemelleRepro[] = []
): IndicateursRepro {
  // Fertilité
  const avecIssue = saillies.filter((s) => STATUTS_ISSUE.has(s.statut))
  const fecondantes = saillies.filter((s) => STATUTS_FECONDANTS.has(s.statut))
  const tauxFertilite = avecIssue.length > 0 ? (fecondantes.length / avecIssue.length) * 100 : null

  // Prolificité & mortinatalité (par mise-bas)
  const nbMiseBas = naissances.length
  const sumNes = naissances.reduce((s, n) => s + (n.nombreNes || 0), 0)
  const sumVivants = naissances.reduce((s, n) => s + (n.nombreVivants || 0), 0)
  const prolificite = nbMiseBas > 0 ? sumNes / nbMiseBas : null
  const prolificiteVivants = nbMiseBas > 0 ? sumVivants / nbMiseBas : null
  const mortaliteNaissance = sumNes > 0 ? ((sumNes - sumVivants) / sumNes) * 100 : null

  // IVV : intervalles entre mises-bas successives, par mère
  const parMere = new Map<number, number[]>()
  for (const n of naissances) {
    if (n.mereId == null) continue
    const arr = parMere.get(n.mereId) || []
    arr.push(ms(n.date))
    parMere.set(n.mereId, arr)
  }
  const intervalles: number[] = []
  let nbFemellesIvv = 0
  for (const dates of parMere.values()) {
    if (dates.length < 2) continue
    nbFemellesIvv++
    const tri = [...dates].sort((a, b) => a - b)
    for (let i = 1; i < tri.length; i++) {
      intervalles.push((tri[i] - tri[i - 1]) / 86_400_000)
    }
  }
  const ivvMoyenJours =
    intervalles.length > 0 ? intervalles.reduce((s, v) => s + v, 0) / intervalles.length : null

  // Âge au premier part : première mise-bas connue de la femelle − sa naissance
  const naissanceParMere = new Map<number, number>()
  for (const n of naissances) {
    if (n.mereId == null) continue
    const t = ms(n.date)
    const cur = naissanceParMere.get(n.mereId)
    if (cur == null || t < cur) naissanceParMere.set(n.mereId, t)
  }
  const agesPremierPart: number[] = []
  for (const f of femelles) {
    if (f.dateNaissance == null) continue
    const premier = naissanceParMere.get(f.id)
    if (premier == null) continue
    const age = (premier - ms(f.dateNaissance)) / 86_400_000
    if (age > 0) agesPremierPart.push(age)
  }
  const agePremierPartJours =
    agesPremierPart.length > 0
      ? agesPremierPart.reduce((s, v) => s + v, 0) / agesPremierPart.length
      : null

  const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
  const r0 = (v: number | null) => (v == null ? null : Math.round(v))

  return {
    nbSaillies: saillies.length,
    nbSailliesAvecIssue: avecIssue.length,
    nbMiseBas,
    tauxFertilite: r1(tauxFertilite),
    prolificite: r1(prolificite != null ? prolificite : null),
    prolificiteVivants: r1(prolificiteVivants),
    mortaliteNaissance: r1(mortaliteNaissance),
    ivvMoyenJours: r0(ivvMoyenJours),
    nbFemellesIvv,
    agePremierPartJours: r0(agePremierPartJours),
    nbFemellesAgePremierPart: agesPremierPart.length,
  }
}
