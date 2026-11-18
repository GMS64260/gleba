/**
 * Règles d'affichage de la page Irriguer (`/maraichage/cultures/irriguer`) :
 * filtres, pastille d'urgence, année lue dans l'adresse. Module pur,
 * importable côté client, pour que ces règles aient leurs tests.
 */
import { libelleIrrigation } from '@/lib/planches/libelle-irrigation'

/** Valeur du filtre pour les planches sans système d'arrosage renseigné. */
export const TYPE_IRRIGATION_NON_DEFINI = '__non_defini__'

export type FiltreUrgence = 'all' | 'critique' | 'haute' | 'aucune' | 'jamais'
export type FiltreBesoinEau = 'all' | '3' | '4'

export interface FiltresIrriguer {
  urgence: FiltreUrgence
  /** `all`, `TYPE_IRRIGATION_NON_DEFINI` ou une valeur de `optionsTypeIrrigation`. */
  typeIrrigation: string
  besoinEau: FiltreBesoinEau
}

interface CultureFiltrable {
  urgence: string
  joursSansEau: number | null
  planche: { irrigation: string | null } | null
  espece: { besoinEau: number | null; irrigation?: string | null } | null
}

/**
 * Clé d'un système d'arrosage pour le filtre et le regroupement : le libellé
 * affiché (« Goutte-a-goutte » et « Goutte-à-goutte » sont le même système,
 * `libelleIrrigation`), ou `TYPE_IRRIGATION_NON_DEFINI`.
 */
export function cleTypeIrrigation(irrigation: string | null | undefined): string {
  return libelleIrrigation(irrigation) || TYPE_IRRIGATION_NON_DEFINI
}

/**
 * Options du filtre « Type irrigation », comptées sur les cultures servies.
 * L'ancienne liste venait des valeurs brutes : deux entrées pour le
 * goutte-à-goutte, et « Non défini » qui ne retrouvait aucune culture.
 */
export function optionsTypeIrrigation(
  cultures: Pick<CultureFiltrable, 'planche'>[],
): { valeur: string; libelle: string; nombre: number }[] {
  const nombres = new Map<string, number>()
  for (const c of cultures) {
    const cle = cleTypeIrrigation(c.planche?.irrigation)
    nombres.set(cle, (nombres.get(cle) ?? 0) + 1)
  }
  return Array.from(nombres.entries())
    .map(([valeur, nombre]) => ({
      valeur,
      libelle: valeur === TYPE_IRRIGATION_NON_DEFINI ? 'Non défini' : valeur,
      nombre,
    }))
    .sort(
      (a, b) =>
        Number(a.valeur === TYPE_IRRIGATION_NON_DEFINI) - Number(b.valeur === TYPE_IRRIGATION_NON_DEFINI) ||
        a.libelle.localeCompare(b.libelle, 'fr'),
    )
}

/** Niveau de besoin en eau d'une espèce : celui de la pastille de la ligne. */
export function niveauBesoinEau(besoinEau: number | null, irrigation: string | null | undefined): 'eleve' | 'moyen' | 'faible' {
  if (irrigation === 'Eleve' || irrigation === 'Élevé' || (besoinEau && besoinEau >= 4)) return 'eleve'
  if (besoinEau && besoinEau >= 3) return 'moyen'
  return 'faible'
}

/** Cultures retenues par les trois filtres de la page. */
export function filtrerCultures<T extends CultureFiltrable>(cultures: T[], filtres: FiltresIrriguer): T[] {
  // Le filtre suit la pastille : « Moyen (3) » gardait aussi les besoins élevés.
  const niveau = filtres.besoinEau === '4' ? 'eleve' : filtres.besoinEau === '3' ? 'moyen' : null
  return cultures.filter((c) => {
    if (filtres.urgence === 'jamais' && c.joursSansEau !== null) return false
    if (filtres.urgence !== 'all' && filtres.urgence !== 'jamais' && c.urgence !== filtres.urgence) return false
    if (filtres.typeIrrigation !== 'all' && cleTypeIrrigation(c.planche?.irrigation) !== filtres.typeIrrigation) return false
    if (niveau && niveauBesoinEau(c.espece?.besoinEau ?? null, c.espece?.irrigation) !== niveau) return false
    return true
  })
}

export type EtiquetteUrgence = 'ok' | 'urgent' | 'priorite' | 'jamais' | 'moyen' | 'faible'

/**
 * Pastille d'une ligne. « Jamais » (aucun arrosage noté) ne remplace que les
 * urgences sans tâche : une culture en urgence haute jamais notée est dans la
 * tournée du jour, sa pastille grise la donnait pour secondaire.
 */
export function etiquetteUrgence(urgence: string, jamaisArrosee: boolean): EtiquetteUrgence {
  if (urgence === 'aucune') return 'ok'
  if (urgence === 'critique') return 'urgent'
  if (urgence === 'haute') return 'priorite'
  if (jamaisArrosee) return 'jamais'
  return urgence === 'moyenne' ? 'moyen' : 'faible'
}

/** Année du paramètre `annee` de l'adresse ; illisible ou absente, la saison en cours. */
export function anneeDemandee(valeur: string | null, maintenant: Date = new Date()): number {
  return valeur !== null && /^\d{4}$/.test(valeur) ? Number(valeur) : maintenant.getFullYear()
}

/** « 3 cultures sans bilan hydrique » (panne météo, parcelle non géolocalisée) ; null s'il n'y en a pas. */
export function phraseSansBilan(nombre: number | undefined): string | null {
  if (!nombre || nombre <= 0) return null
  return `${nombre} culture${nombre > 1 ? 's' : ''} sans bilan hydrique`
}
