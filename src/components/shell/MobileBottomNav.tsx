"use client"

/**
 * Barre de navigation mobile (modules + météo) — chantier UX 2026-07, palier 4.
 *
 * Sur mobile (< sm), les modules passent en barre d'onglets fixée en bas
 * d'écran (pattern app de terrain) : accessibles au pouce, toujours
 * visibles. Respecte les modules activés par l'utilisateur, comme
 * ModulesNav. Masquée sur l'éditeur jardin (plein écran assumé), les
 * parcours auth/onboarding, l'admin et la boutique publique.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Sprout, TreeDeciduous, Bird, Wallet, CloudSun } from "lucide-react"
import { useModules } from "@/hooks/use-modules"
import { MODULES, MODULE_IDS, type ModuleId } from "@/lib/modules"

const ICONS: Record<ModuleId, React.ComponentType<{ className?: string }>> = {
  maraichage: Sprout,
  verger: TreeDeciduous,
  elevage: Bird,
  comptabilite: Wallet,
}

const ACTIVE_COLOR: Record<ModuleId, string> = {
  maraichage: "text-emerald-600",
  verger: "text-lime-600",
  elevage: "text-amber-600",
  comptabilite: "text-blue-600",
}

// Libellés courts pour tenir à 4-5 items sur 360 px
const SHORT_LABELS: Record<ModuleId, string> = {
  maraichage: "Maraîchage",
  verger: "Verger",
  elevage: "Élevage",
  comptabilite: "Compta",
}

const EXCLUDED_PREFIXES = [
  "/jardin",
  "/login",
  "/register",
  "/reset-password",
  "/onboarding",
  "/admin",
  "/boutique",
]

export function MobileBottomNav() {
  const { data: session } = useSession()
  const pathname = usePathname()

  // Garde AVANT le hook useModules (composant interne) : pas de fetch de
  // préférences pour les visiteurs anonymes (pages marketing).
  if (!session?.user || !pathname) return null
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null

  return <MobileBottomNavInner pathname={pathname} />
}

function MobileBottomNavInner({ pathname }: { pathname: string }) {
  const { modules } = useModules()

  const currentModule: ModuleId | null =
    pathname === "/"
      ? "maraichage"
      : MODULE_IDS.find((id) => pathname.startsWith(MODULES[id].path)) ?? null
  const visibles = MODULE_IDS.filter((id) => id === currentModule || modules.includes(id))
  if (visibles.length === 0) return null

  const isMeteo = pathname.startsWith("/meteo")

  return (
    <>
      {/* Espace en flux pour que la barre fixe ne masque pas la fin de page */}
      <div className="h-16 sm:hidden" aria-hidden="true" />
      <nav
        aria-label="Modules"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex">
          {visibles.map((id) => {
            const Icon = ICONS[id]
            const isActive = id === currentModule && !isMeteo
            return (
              <Link
                key={id}
                href={id === "maraichage" ? "/" : MODULES[id].path}
                aria-current={isActive ? "page" : undefined}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium ${
                  isActive ? ACTIVE_COLOR[id] : "text-slate-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                {SHORT_LABELS[id]}
              </Link>
            )
          })}
          <Link
            href="/meteo"
            aria-current={isMeteo ? "page" : undefined}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium ${
              isMeteo ? "text-sky-600" : "text-slate-500"
            }`}
          >
            <CloudSun className="h-5 w-5" />
            Météo
          </Link>
        </div>
      </nav>
    </>
  )
}
