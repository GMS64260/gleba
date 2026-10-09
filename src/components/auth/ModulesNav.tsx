"use client"

/**
 * Barre de navigation entre les modules métier (Maraîchage, Verger & Forêt, Élevage, Compta).
 * Respecte les préférences utilisateur : les modules désactivés ne sont pas affichés.
 * Le module courant est toujours affiché et stylé en "actif".
 */

import * as React from "react"
import Link from "next/link"
import { Sprout, TreeDeciduous, Bird, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useModules } from "@/hooks/use-modules"
import { MODULES, type ModuleId } from "@/lib/modules"

interface ModuleStyle {
  icon: React.ComponentType<{ className?: string }>
  activeClass: string
  inactiveClass: string
}

// Charte « carnet de ferme » (2026-10-09) : le module courant est posé sur
// sauge doux, les autres restent en encre sur craie. Les couleurs par module
// (émeraude, citron vert, ambre, bleu) sont retirées : chaque module garde
// son icône, pas une teinte de SaaS.
const ACTIVE = "bg-sauge-doux text-foret hover:bg-sauge-doux hover:text-foret"
const INACTIVE = "text-encre hover:bg-papier hover:text-encre"
const STYLES: Record<ModuleId, ModuleStyle> = {
  maraichage: { icon: Sprout, activeClass: ACTIVE, inactiveClass: INACTIVE },
  verger: { icon: TreeDeciduous, activeClass: ACTIVE, inactiveClass: INACTIVE },
  elevage: { icon: Bird, activeClass: ACTIVE, inactiveClass: INACTIVE },
  comptabilite: { icon: Wallet, activeClass: ACTIVE, inactiveClass: INACTIVE },
}

interface Props {
  /** Module courant ; absent sur les pages transverses (ex. /meteo) : tous les modules sont alors des liens */
  current?: ModuleId
}

export function ModulesNav({ current }: Props) {
  const { modules } = useModules()

  // Toujours afficher le module courant + les autres modules actifs (dans l'ordre canonique)
  const order: ModuleId[] = ["maraichage", "verger", "elevage", "comptabilite"]
  const visibles = order.filter((id) => id === current || modules.includes(id))

  if (visibles.length === 0) return null

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-lin bg-craie">
      {visibles.map((id, idx) => {
        const def = MODULES[id]
        const style = STYLES[id]
        const Icon = style.icon
        const isCurrent = id === current
        const isLast = idx === visibles.length - 1
        const className = `rounded-none ${isCurrent ? style.activeClass : style.inactiveClass} ${!isLast ? "border-r border-lin" : ""}`

        const inner = (
          <Button
            variant="ghost"
            size="sm"
            className={className}
            title={def.label}
            aria-label={def.label}
          >
            <Icon className={`h-4 w-4 sm:mr-1 ${isCurrent ? "text-sauge" : "text-ardoise"}`} />
            <span className="hidden lg:inline">{def.label}</span>
          </Button>
        )

        if (isCurrent) {
          return <React.Fragment key={id}>{inner}</React.Fragment>
        }
        return (
          <Link key={id} href={def.path}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
