/**
 * Layout hub Planification — chantier UX 2026-07, palier 3.
 *
 * Fournit le shell (AppHeader) et la sous-navigation persistante à toutes
 * les sous-pages de /maraichage/planification/* : elles deviennent les
 * sections d'un même écran au lieu de pages isolées. Les URLs profondes
 * sont conservées telles quelles.
 */

import { AppHeader } from "@/components/shell/AppHeader"
import { PlanificationSubnav } from "@/components/shell/PlanificationSubnav"

export default function PlanificationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <AppHeader current="maraichage" />
      <div className="container mx-auto px-4 py-5 max-w-[1600px] flex flex-col lg:flex-row gap-5 items-start">
        <PlanificationSubnav />
        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
    </div>
  )
}
