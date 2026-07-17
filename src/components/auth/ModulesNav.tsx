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

const STYLES: Record<ModuleId, ModuleStyle> = {
  maraichage: {
    icon: Sprout,
    activeClass: "bg-emerald-50 text-emerald-700",
    inactiveClass: "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50",
  },
  verger: {
    icon: TreeDeciduous,
    activeClass: "bg-lime-50 text-lime-700",
    inactiveClass: "text-lime-700 hover:text-lime-800 hover:bg-lime-50",
  },
  elevage: {
    icon: Bird,
    activeClass: "bg-amber-50 text-amber-700",
    inactiveClass: "text-amber-700 hover:text-amber-800 hover:bg-amber-50",
  },
  comptabilite: {
    icon: Wallet,
    activeClass: "bg-blue-50 text-blue-700",
    inactiveClass: "text-blue-700 hover:text-blue-800 hover:bg-blue-50",
  },
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
    <div className="flex items-center border rounded-lg overflow-hidden">
      {visibles.map((id, idx) => {
        const def = MODULES[id]
        const style = STYLES[id]
        const Icon = style.icon
        const isCurrent = id === current
        const isLast = idx === visibles.length - 1
        const className = `rounded-none ${isCurrent ? style.activeClass : style.inactiveClass} ${!isLast ? "border-r" : ""}`

        const inner = (
          <Button
            variant="ghost"
            size="sm"
            className={className}
            title={def.label}
            aria-label={def.label}
          >
            <Icon className="h-4 w-4 sm:mr-1" />
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
