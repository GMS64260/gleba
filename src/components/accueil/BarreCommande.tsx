"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { ouvrirRecherche } from "@/lib/accueil/evenements"
import { cn } from "@/lib/utils"

/**
 * Barre de commande de l'accueil v2 (maquette : « Demander à Gleba… ⌘ K »).
 * Elle ouvre la palette existante (recherche + actions de saisie + entrée
 * « Demander à Gleba » qui ouvre l'assistant). Un bouton, pas un champ : la
 * saisie se fait dans la palette.
 */
export function BarreCommande({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => ouvrirRecherche()}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-lin bg-craie px-3.5 text-left text-sm text-ardoise shadow-[0_1px_2px_rgba(31,42,36,0.05)] hover:border-sauge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge",
        className,
      )}
    >
      <Sparkles className="h-[18px] w-[18px] shrink-0 text-sauge" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{compact ? "Demander ou chercher dans Gleba…" : "Demander à Gleba…"}</span>
      {!compact && (
        <kbd className="hidden rounded-md border border-lin px-1.5 py-0.5 font-ui text-[11px] text-ardoise sm:inline">⌘ K</kbd>
      )}
    </button>
  )
}
