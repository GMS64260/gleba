"use client"

/**
 * Cellule « Avis » réutilisable pour les tableaux de référentiels : affiche la
 * note moyenne (★) + nb d'avis + badge « confirmé terrain », ou un appel à
 * témoigner si aucun avis. Clique → ouvre la modale (via onClick fourni).
 */

import * as React from "react"
import { CheckCircle2, MessageSquare } from "lucide-react"
import { StarRating } from "@/components/avis/StarRating"
import type { AvisStatsListe } from "@/lib/avis/types"

export function AvisCell({
  stats,
  onClick,
}: {
  stats?: AvisStatsListe | null
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-slate-100"
      title="Voir et donner un avis"
    >
      {stats && stats.nbAvis > 0 ? (
        <>
          <StarRating value={stats.noteMoyenne ?? 0} size={14} />
          <span className="text-xs text-muted-foreground">({stats.nbAvis})</span>
          {stats.badgeTerrain && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
        </>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Avis
        </span>
      )}
    </button>
  )
}
