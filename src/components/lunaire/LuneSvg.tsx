import * as React from "react"

/**
 * Disque lunaire dessiné d'après l'illumination (0-100 %) et le sens du
 * cycle : Lune croissante éclairée à droite, décroissante à gauche (vue de
 * l'hémisphère nord). Partie éclairée en paille, partie sombre en encre : un
 * seul dessin pour la petite lune de l'accueil, l'en-tête et le calendrier,
 * là où les emoji changeaient de style d'un appareil à l'autre (2026-10-12).
 */
export interface LuneSvgProps extends Omit<React.SVGAttributes<SVGSVGElement>, "viewBox"> {
  illumination: number
  croissante: boolean
}

const R = 10

/** Tracé SVG de la partie éclairée, dans une boîte 0-20 (`R` = 10). */
export function cheminEclaire(illumination: number, croissante: boolean): string {
  const k = Math.min(1, Math.max(0, illumination / 100))
  // Demi-axe horizontal du terminateur : R·|cos ψ| avec k = (1 + cos ψ)/2, soit
  // R aux syzygies, 0 aux quartiers ; l'aire éclairée vaut alors k fois le disque.
  const rx = (R * Math.abs(1 - 2 * k)).toFixed(3)
  // Demi-cercle du bord éclairé (sens horaire à droite), puis retour par le
  // terminateur, bombé vers le côté sombre dès que la Lune est plus qu'à moitié.
  const bord = croissante ? 1 : 0
  const retour = (k >= 0.5 ? 1 : 0) ^ (croissante ? 0 : 1)
  return `M ${R} 0 A ${R} ${R} 0 0 ${bord} ${R} ${2 * R} A ${rx} ${R} 0 0 ${retour} ${R} 0 Z`
}

export function LuneSvg({ illumination, croissante, ...rest }: LuneSvgProps) {
  return (
    <svg viewBox={`0 0 ${2 * R} ${2 * R}`} aria-hidden="true" focusable="false" {...rest}>
      <circle cx={R} cy={R} r={R} fill="var(--encre)" fillOpacity="0.85" />
      <path d={cheminEclaire(illumination, croissante)} fill="var(--paille)" />
      <circle cx={R} cy={R} r={R - 0.5} fill="none" stroke="var(--encre)" strokeOpacity="0.3" />
    </svg>
  )
}
