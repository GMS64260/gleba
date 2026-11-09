import { especeBaseId } from '@/lib/elevage/espece-base'

/**
 * Coefficient UGB d'une tête, pour le chargement des pâtures.
 *
 * L'espèce se lit d'abord sur l'identifiant de base du profil (`brebis_lacaune`
 * → `brebis`), puis sur les mots du nom pour un profil personnel. Avant, seule
 * une sous-chaîne du NOM était cherchée (« ovin », « porc », « cheval »…) : le
 * catalogue nomme « Brebis », « Cochon », « Âne », « Poney », qui tombaient tous
 * à 0,02, et 100 brebis pesaient 2 UGB au lieu de 15.
 */
const UGB_PAR_ESPECE: Record<string, number> = {
  vache: 1, taureau: 1, veau: 1,
  cheval: 0.8, chevaux: 0.8, ane: 0.8, poney: 0.8, mulet: 0.8,
  brebis: 0.15, agneau: 0.15, belier: 0.15, mouton: 0.15,
  chevre: 0.15, bouc: 0.15, chevreau: 0.15,
  cochon: 0.3, porc: 0.3, porcelet: 0.3,
}
/** Petits animaux (volailles, lapins…) et espèce non reconnue. */
export const UGB_PAR_DEFAUT = 0.02

const MOTS: Array<[RegExp, number]> = [
  [/\b(bovins?|vaches?|taureaux?|veaux?|genisses?|boeufs?)\b/, 1],
  [/\b(equins?|equides?|chevaux|cheval|juments?|anes?|anesses?|poneys?|mulets?|bardots?)\b/, 0.8],
  [/\b(ovins?|moutons?|brebis|agneaux?|beliers?|caprins?|chevres?|boucs?|chevreaux?)\b/, 0.15],
  [/\b(porcins?|porcs?|cochons?|truies?|porcelets?)\b/, 0.3],
]

const normaliser = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ugbParTete(espece: { id?: string | null; nom?: string | null }): number {
  if (espece.id) {
    const base = UGB_PAR_ESPECE[especeBaseId(espece.id)]
    if (base !== undefined) return base
  }
  const texte = normaliser(`${espece.id ?? ''} ${espece.nom ?? ''}`).replace(/_/g, ' ')
  // « cochon d'Inde » n'est pas un porcin.
  if (/\bcochons? d ?inde\b|\bcobayes?\b/.test(texte.replace(/'/g, ' '))) return UGB_PAR_DEFAUT
  for (const [mots, coefficient] of MOTS) if (mots.test(texte)) return coefficient
  return UGB_PAR_DEFAUT
}
