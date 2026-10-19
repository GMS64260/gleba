/**
 * « Quantité versée » d'un arrosage noté (ticket QA cmv3japsf) : mêmes
 * chiffres et mêmes mots sur le conseiller d'irrigation, les Tâches et le
 * Calendrier. Avec une quantité, le bilan retranche l'eau versée ; sans
 * (« Quantité inconnue »), l'arrosage remet la réserve du sol pleine. Pur,
 * sans dépendance serveur.
 */
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { formatNombre } from '@/lib/format-utils'

/**
 * Ce que le dialogue « Noter l'arrosage » (`SaisieArrosage`) doit savoir d'une
 * ligne : la dose conseillée, la surface sur laquelle les litres versés se
 * répartissent, la planche à nommer.
 */
export interface ContexteQuantiteVersee {
  litresParM2: number | null
  /** Surface de la PLANCHE, celle du chargeur qui convertit les litres ; 0 si inconnue. */
  surfaceM2: number
  plancheNom: string | null
}

/**
 * Contexte de saisie depuis la culture qui pilote la ligne : une seule règle
 * pour les Tâches, le Calendrier (`arrosagesDuJour`) et la page Irriguer
 * (ticket QA du 2026-10-19 : « Marquer comme arrosé » notait un plein sans
 * rien demander). La surface est celle de la planche ENTIÈRE, comme
 * `chargerArrosagesSaisis` qui rapporte les litres notés à la planche :
 * préremplir avec la seule portion de la culture sous-estimerait l'apport.
 */
export function contexteQuantiteVersee(culture: {
  reserve?: { litresParM2: number } | null
  planche: {
    nom?: string | null
    surface?: number | null
    largeur?: number | null
    longueur?: number | null
  } | null
}): ContexteQuantiteVersee {
  return {
    litresParM2: culture.reserve ? culture.reserve.litresParM2 : null,
    surfaceM2: culture.planche ? surfaceCultureM2({ planche: culture.planche }) : 0,
    // Un nom vide n'est pas un nom : repli sur le libellé générique.
    plancheNom: culture.planche?.nom || null,
  }
}

/** Litres conseillés sur la surface (préremplissage) ; null sans dose ou sans surface. */
export function litresConseilles(litresParM2: number | null, surfaceM2: number): number | null {
  return litresParM2 !== null && litresParM2 > 0 && surfaceM2 > 0 ? Math.round(litresParM2 * surfaceM2) : null
}

/**
 * Litres saisis (« 12,5 », « 12.5 », « 1 200 ») ; NaN si le champ est vide
 * ou illisible. Champ texte à clavier décimal : un champ `number` peut rendre
 * vide une saisie à virgule selon le navigateur.
 */
export function lireLitres(saisie: string): number {
  const texte = saisie.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(texte)) return NaN
  return Number(texte)
}

/**
 * « soit 538 L pour la planche A3 » : le chiffre que le dialogue préremplit,
 * pour qu'une ligne n'annonce pas un volume et le dialogue un autre (revue du
 * 2026-10-19 : la page Irriguer affichait le volume de la seule portion
 * cultivée). Null sans dose ou sans surface.
 */
export function phraseLitresPlanche(contexte: ContexteQuantiteVersee): string | null {
  const litres = litresConseilles(contexte.litresParM2, contexte.surfaceM2)
  if (litres === null) return null
  return `soit ${formatNombre(litres)} L pour la planche${contexte.plancheNom ? ` ${contexte.plancheNom}` : ''}`
}

/** Aide sous le champ : le conseil en litres, la surface de répartition, « Quantité inconnue ». */
export function aideQuantite(litresParM2: number | null, surfaceM2: number): string {
  const conseil = litresConseilles(litresParM2, surfaceM2)
  return [
    conseil !== null && litresParM2 !== null
      ? `Conseil : ${formatNombre(litresParM2, 1)} L/m², soit ${formatNombre(conseil)} L.`
      : null,
    surfaceM2 > 0
      ? `Le conseil est recalculé avec l’eau versée sur ${formatNombre(surfaceM2, 1)} m².`
      : 'Surface inconnue : l’arrosage comptera comme complet.',
    '« Quantité inconnue » compte un arrosage complet (réserve du sol remplie).',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Détail du toast « Arrosage noté ». */
export function detailArrosageNote(nom: string, litres: number | null): string {
  return `${nom} · ${litres ? `${formatNombre(litres, 1)} L versés` : 'arrosage complet'}, consigné dans les interventions.`
}
