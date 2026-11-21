import { cn } from "@/lib/utils"

const LIEN = "whitespace-nowrap underline decoration-lin underline-offset-2 hover:text-encre"

interface SourceOpenMeteoProps {
  /**
   * L'écran montre un résultat calculé par Gleba à partir de ces données
   * (bilan hydrique, conseil d'arrosage) : la licence demande de signaler
   * qu'elles ont été transformées.
   */
  calcul?: boolean
  /** `span` pour une mention placée dans une ligne de texte. */
  as?: "p" | "span"
  className?: string
}

/**
 * Mention des données d'Open-Meteo. Elles sont publiées sous licence
 * CC BY 4.0, et Open-Meteo demande un lien vers son site à côté de chaque
 * affichage de ses données, offre payante comprise :
 * https://open-meteo.com/en/licence
 */
export function SourceOpenMeteo({ calcul = false, as: Balise = "p", className }: SourceOpenMeteoProps) {
  return (
    <Balise className={cn("text-[11px] leading-4 text-ardoise", className)}>
      {calcul ? "Calcul Gleba d’après les données météo d’" : "Données météo : "}
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className={LIEN}>
        Open-Meteo.com
        <span className="sr-only"> (nouvel onglet)</span>
      </a>{" "}
      (
      <a
        href="https://creativecommons.org/licenses/by/4.0/deed.fr"
        target="_blank"
        rel="license noopener noreferrer"
        className={LIEN}
      >
        CC BY 4.0
        <span className="sr-only"> (nouvel onglet)</span>
      </a>
      )
    </Balise>
  )
}
