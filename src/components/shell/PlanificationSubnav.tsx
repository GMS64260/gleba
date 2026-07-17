"use client"

/**
 * Sous-navigation persistante du hub Planification — chantier UX 2026-07, palier 3.
 *
 * Les sous-pages de /maraichage/planification/* étaient des écrans isolés ;
 * cette barre les relie comme sections d'un même hub (verticale sur desktop,
 * défilement horizontal sur mobile). La « Vue d'ensemble » renvoie vers
 * l'onglet Planification de la home maraîchage.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Sprout,
  Apple,
  Package,
  Users,
  Boxes,
  ListPlus,
  Bean,
} from "lucide-react"

const BASE = "/maraichage/planification"

const SECTIONS = [
  { label: "Vue d'ensemble", href: "/?tab=planification", match: null, icon: LayoutDashboard },
  { label: "Cultures prévues", href: `${BASE}/cultures-prevues`, match: `${BASE}/cultures-prevues`, icon: Sprout },
  { label: "Récoltes prévues", href: `${BASE}/recoltes-prevues`, match: `${BASE}/recoltes-prevues`, icon: Apple },
  { label: "Semences", href: `${BASE}/semences`, match: `${BASE}/semences`, icon: Bean },
  { label: "Plants", href: `${BASE}/plants`, match: `${BASE}/plants`, icon: Package },
  { label: "Associations", href: `${BASE}/associations`, match: `${BASE}/associations`, icon: Users },
  // /maraichage/planification/stocks est un redirect (Bug 15) : lien direct
  { label: "Stocks", href: "/maraichage/stocks", match: null, icon: Boxes },
  { label: "Créer les cultures", href: `${BASE}/creer-cultures`, match: `${BASE}/creer-cultures`, icon: ListPlus },
] as const

export function PlanificationSubnav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Sections de planification"
      className="w-full lg:w-[210px] lg:flex-shrink-0 lg:sticky lg:top-[76px] bg-white/90 backdrop-blur-sm border rounded-lg p-1.5 flex lg:flex-col gap-0.5 overflow-x-auto scrollbar-hide"
    >
      {SECTIONS.map((s) => {
        const isActive = s.match !== null && pathname.startsWith(s.match)
        return (
          <Link
            key={s.label}
            href={s.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
              isActive
                ? "bg-emerald-50 text-emerald-700 font-medium"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <s.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
