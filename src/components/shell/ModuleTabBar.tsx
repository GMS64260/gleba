"use client"

/**
 * Barre d'onglets de module partagée (shell applicatif) — chantier UX 2026-07, palier 2.
 *
 * Unifie les deux implémentations dupliquées (MaraichageHome / verger) :
 * même markup, même responsive (fix cmpkygqu8 : colonne sur mobile avec
 * onglets scrollables, ligne unique dès sm:), accent coloré par module.
 *
 * La barre est contrôlée : l'état actif et la navigation restent dans la
 * page (qui synchronise l'onglet avec l'URL via ?tab=).
 */

import * as React from "react"

interface TabDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type Accent = "emerald" | "lime" | "amber" | "blue"

// Classes littérales complètes : Tailwind ne génère pas les classes
// construites dynamiquement.
const ACCENTS: Record<Accent, { top: string; active: string; icon: string }> = {
  emerald: { top: "border-t-emerald-500", active: "border-emerald-600 text-emerald-700", icon: "text-emerald-600" },
  lime: { top: "border-t-lime-500", active: "border-lime-600 text-lime-700", icon: "text-lime-600" },
  amber: { top: "border-t-amber-500", active: "border-amber-600 text-amber-700", icon: "text-amber-600" },
  blue: { top: "border-t-blue-500", active: "border-blue-600 text-blue-700", icon: "text-blue-600" },
}

interface ModuleTabBarProps {
  tabs: readonly TabDef[]
  activeTab: string
  onTabChange: (id: string) => void
  accent: Accent
  /** Actions contextuelles à droite (boutons, sélecteur d'année…) */
  actions?: React.ReactNode
}

export function ModuleTabBar({ tabs, activeTab, onTabChange, accent, actions }: ModuleTabBarProps) {
  const a = ACCENTS[accent]
  return (
    <nav className={`border-b border-t-2 ${a.top} bg-white/80 backdrop-blur-sm sticky top-[61px] z-40`}>
      <div className="container mx-auto px-4 max-w-[1600px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center -mb-px overflow-x-auto scrollbar-hide min-w-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 lg:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? a.active
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                  title={tab.label}
                >
                  <tab.icon className={`h-4 w-4 ${isActive ? a.icon : ""}`} />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
          {actions && <div className="flex items-center gap-2 py-2 flex-wrap">{actions}</div>}
        </div>
      </div>
    </nav>
  )
}
