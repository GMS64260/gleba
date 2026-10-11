/**
 * « Quantité versée » d'un arrosage noté (ticket QA cmv3japsf) : mêmes
 * chiffres et mêmes mots sur le conseiller d'irrigation, les Tâches et le
 * Calendrier. Avec une quantité, le bilan retranche l'eau versée ; sans
 * (« Quantité inconnue »), l'arrosage remet la réserve du sol pleine. Pur,
 * sans dépendance serveur.
 */
import { formatNombre } from '@/lib/format-utils'

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
