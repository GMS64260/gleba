import * as React from "react"

/**
 * Coche qui se trace (stroke-dashoffset, 220 ms) quand une ligne passe à
 * « Fait » : mouvement 2 du système de motion. Sans animation demandée, la
 * coche est dessinée d'emblée (classe `accueil-coche` inerte).
 */
export function CocheAnimee({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`accueil-coche ${className ?? ""}`}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
