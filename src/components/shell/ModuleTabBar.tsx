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
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"
interface TabDef {
  id: string
  label: string
  shortLabel?: string
  icon: React.ComponentType<{ className?: string }>
}

type Accent = "emerald" | "lime" | "amber" | "blue"

// Classes littérales complètes : Tailwind ne génère pas les classes
// construites dynamiquement. Charte « carnet de ferme » (2026-10-09) : les
// noms d'accent historiques (emerald, lime, amber, blue) restent l'API des
// pages, mais pointent sur les accents discrets de la charte — sauge
// (maraîchage), prairie (verger), ocre (élevage), eau (comptabilité). Le
// texte de l'onglet actif reste en encre : la couleur souligne, elle ne lit pas.
const ACCENTS: Record<Accent, { top: string; active: string; icon: string }> = {
  emerald: { top: "border-t-sauge", active: "border-sauge text-encre", icon: "text-sauge" },
  lime: { top: "border-t-prairie", active: "border-prairie text-encre", icon: "text-prairie" },
  amber: { top: "border-t-ocre", active: "border-ocre text-encre", icon: "text-ocre" },
  blue: { top: "border-t-eau", active: "border-eau text-encre", icon: "text-eau" },
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
  // Suit le header escamotable : quand il s'efface au scroll, les onglets
  // du module remontent seuls en haut de l'écran.
  const headerHidden = useHideOnScroll()
  return (
    <nav
      className={`relative top-0 z-40 border-b border-t-2 border-lin ${a.top} bg-craie/90 font-ui text-encre backdrop-blur-sm xl:sticky xl:top-[var(--module-tabbar-top)] xl:transition-[top] xl:duration-200 motion-reduce:transition-none`}
      // Ticket cmsx5x1z2 — décalage MESURÉ (publié par AppHeader dans
      // `--app-header-h`) et non plus 61 px codés en dur : un header qui passe
      // sur deux lignes recouvrait sinon cette barre et avalait les clics de ses
      // actions. Repli sur 61 px avant la première mesure.
      //
      // Le décalage passe par une variable consommée seulement en `xl:`, jamais
      // par `top` en ligne : la barre est `relative` sous xl, où `top` n'est pas
      // inerte mais la descend de la hauteur du header — un vide au-dessus du
      // menu mobile, et le recouvrement du contenu en dessous.
      style={{ "--module-tabbar-top": headerHidden ? "0px" : "var(--app-header-h, 61px)" } as React.CSSProperties}
    >
      <div className="container mx-auto px-4 max-w-[1600px]">
        {/* Mobile/tablette : onglets visibles. Le menu déroulant affichait
            seulement « Calendrier » fermé, ce qui rendait les autres sections
            introuvables sur les écrans tactiles. */}
        <div className="space-y-2 py-2 xl:hidden">
          <div className="-mx-4 overflow-x-auto px-4 pb-0.5 scrollbar-hide">
            <div className="flex w-max min-w-full items-center gap-1.5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? `${a.active} bg-craie`
                        : "border-lin bg-craie/80 text-ardoise hover:border-ardoise hover:text-encre"
                    }`}
                    title={tab.label}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? a.icon : "text-ardoise"}`} />
                    <span>{tab.shortLabel ?? tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide [&>*]:shrink-0">
              {actions}
            </div>
          )}
        </div>

        <div className="hidden xl:flex xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 lg:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? a.active
                      : "border-transparent text-ardoise hover:border-lin hover:text-encre"
                  }`}
                  title={tab.label}
                >
                  <tab.icon className={`h-4 w-4 ${isActive ? a.icon : ""}`} />
                  <span className="hidden 2xl:inline">{tab.label}</span>
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
