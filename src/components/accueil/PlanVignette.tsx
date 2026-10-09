import * as React from "react"

import { calculerCadre } from "@/lib/accueil/plan-vignette"
import type { EtatPlanche, PlanVignetteDonnees } from "@/lib/accueil/types"

/**
 * Vignette SVG du plan de la ferme, calculée côté client à partir des
 * géométries (planches, arbres, objets) : pas de moteur 3D sur l'accueil.
 * Même convention que le plan 2D : rectangle `largeur × longueur` posé en
 * (posX, posY), tourné de `rotation2D` autour de son centre. L'état du jour
 * (à arroser, à récolter) est peint en liseré ; les pastilles de la tuile
 * portent le même état en texte.
 */
export interface PlanVignetteProps {
  plan: PlanVignetteDonnees
  className?: string
}

function stylePlanche(etat: EtatPlanche, trait: number): React.CSSProperties {
  switch (etat) {
    case "arroser":
      return { fill: "var(--herbe-sombre)", stroke: "var(--argile)", strokeWidth: trait * 2.5 }
    case "recolter":
      return { fill: "var(--herbe-sombre)", stroke: "var(--paille)", strokeWidth: trait * 2.5 }
    case "en-place":
      return { fill: "var(--herbe-sombre)", stroke: "var(--foret)", strokeWidth: trait * 0.6, opacity: 0.95 }
    default:
      return { fill: "var(--terre)", stroke: "var(--terre-claire)", strokeWidth: trait * 0.6 }
  }
}

function styleObjet(type: string, trait: number): React.CSSProperties {
  const t = type.toLowerCase()
  if (t === "serre" || t === "tunnel" || t === "chassis" || t === "châssis") {
    return { fill: "var(--eau-doux)", stroke: "var(--eau)", strokeWidth: trait, opacity: 0.9 }
  }
  if (t === "eau") return { fill: "var(--eau)", opacity: 0.8 }
  if (t === "batiment" || t === "bâtiment" || t === "mur") return { fill: "var(--lin)", stroke: "var(--ardoise)", strokeWidth: trait * 0.6 }
  if (t === "haie") return { fill: "var(--prairie)", opacity: 0.6 }
  if (t === "compost") return { fill: "var(--terre-claire)" }
  return { fill: "var(--lin-doux)", stroke: "var(--lin)", strokeWidth: trait * 0.6, opacity: 0.9 }
}

export function PlanVignette({ plan, className }: PlanVignetteProps) {
  const cadre = calculerCadre(plan)
  // Épaisseur de trait en mètres, pour rester ~1 px quelle que soit l'échelle.
  const trait = Math.max(cadre.largeur, cadre.hauteur) / 320

  return (
    <svg
      viewBox={`${cadre.x} ${cadre.y} ${cadre.largeur} ${cadre.hauteur}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x={cadre.x} y={cadre.y} width={cadre.largeur} height={cadre.hauteur} style={{ fill: "var(--herbe)" }} />
      {plan.objets.map((o) => (
        <g key={`o-${o.id}`} transform={`translate(${o.posX} ${o.posY}) rotate(${o.rotation2D} ${o.largeur / 2} ${o.longueur / 2})`}>
          <rect width={o.largeur} height={o.longueur} rx={trait * 2} style={styleObjet(o.type, trait)} />
        </g>
      ))}
      {plan.planches.map((p) => (
        <g key={`p-${p.id}`} transform={`translate(${p.posX} ${p.posY}) rotate(${p.rotation2D} ${p.largeur / 2} ${p.longueur / 2})`}>
          <rect width={p.largeur} height={p.longueur} rx={trait} style={stylePlanche(p.etat, trait)} />
        </g>
      ))}
      {plan.arbres.map((a) => (
        <circle
          key={`a-${a.id}`}
          cx={a.posX}
          cy={a.posY}
          r={Math.max(a.envergure, 0.5) / 2}
          style={{ fill: "var(--prairie)", opacity: 0.85 }}
        />
      ))}
    </svg>
  )
}
