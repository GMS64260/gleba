"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"

import { compterEtats } from "@/lib/accueil/plan-vignette"
import type { PlanVignetteDonnees } from "@/lib/accueil/types"
import { cn } from "@/lib/utils"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { PlanVignette } from "./PlanVignette"
import { Tuile } from "./Tuile"

// Le vrai plan 2D (composant lourd, navigateur seulement) arrive après le
// premier rendu ; le dessin reconstitué tient lieu d'image d'attente.
const PlanVivant = dynamic(() => import("./PlanVivant").then((m) => m.PlanVivant), { ssr: false })

/**
 * Tuile « plan » de l'accueil v2 : le vrai plan de la ferme en lecture seule
 * (silhouettes de cultures, fond aérien), nom de la ferme, pastilles d'état
 * (à arroser, à récolter) en texte, et un seul lien vers le plan complet.
 */
export interface TuilePlanProps {
  plan: PlanVignetteDonnees | null
  nomFerme: string | null
  chargement: boolean
  rang?: number
}

export function TuilePlan({ plan, nomFerme, chargement, rang }: TuilePlanProps) {
  const style = rang !== undefined ? ({ "--rang": rang } as React.CSSProperties) : undefined
  const [vivantPret, setVivantPret] = React.useState(false)
  const marquerPret = React.useCallback(() => setVivantPret(true), [])

  if (chargement) {
    return (
      <section
        data-tuile="plan"
        aria-label="Plan de la ferme, chargement"
        className={cn("col-span-1 min-h-[220px] rounded-2xl border border-lin bg-herbe/60 lg:col-span-5", rang !== undefined && "accueil-entree")}
        style={style}
      />
    )
  }

  if (!plan || plan.planches.length === 0) {
    return <TuilePlanVide rang={rang} />
  }

  const etats = compterEtats(plan)
  const pastilles = [
    etats.arroser > 0 && { libelle: `${etats.arroser} à arroser`, couleur: "bg-argile" },
    etats.recolter > 0 && { libelle: `${etats.recolter} à récolter`, couleur: "bg-paille" },
    etats.arroser === 0 && etats.recolter === 0 && { libelle: `${etats.enPlace} en place`, couleur: "bg-prairie" },
  ].filter((p): p is { libelle: string; couleur: string } => Boolean(p))

  return (
    <section
      data-tuile="plan"
      className={cn(
        "relative col-span-1 min-h-[220px] overflow-hidden rounded-2xl border border-lin bg-craie lg:col-span-5",
        rang !== undefined && "accueil-entree",
      )}
      style={style}
    >
      {/* Image d'attente : le dessin reconstitué, effacé quand le vrai plan est prêt. */}
      <PlanVignette
        plan={plan}
        className={cn("absolute inset-0 h-full w-full transition-opacity duration-slow", vivantPret ? "opacity-0" : "opacity-100")}
      />
      <div className={cn("absolute inset-0 p-2 transition-opacity duration-slow", vivantPret ? "opacity-100" : "opacity-0")}>
        <PlanVivant onPret={marquerPret} />
      </div>
      <p className="sr-only">
        Plan de la ferme : {plan.planches.length} planches, {pastilles.map((p) => p.libelle).join(", ")}.
      </p>
      {nomFerme && (
        <span className="absolute left-2.5 top-2.5 rounded-md bg-craie/90 px-2 py-0.5 text-[11px] font-semibold text-encre shadow-sm">
          {nomFerme}
        </span>
      )}
      <div className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-1.5">
        {pastilles.map((p) => (
          <span
            key={p.libelle}
            className="inline-flex items-center gap-1.5 rounded-full bg-craie/90 px-2 py-0.5 text-[11px] font-medium text-encre shadow-sm"
          >
            <i aria-hidden className={cn("h-2 w-2 rounded-full", p.couleur)} />
            {p.libelle}
          </span>
        ))}
      </div>
      <Link
        href="/jardin"
        className="absolute bottom-2.5 right-2.5 inline-flex min-h-11 items-center rounded-lg bg-encre px-3 text-xs font-semibold text-craie hover:bg-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-craie"
      >
        Ouvrir le plan
      </Link>
    </section>
  )
}

/** État vide dédié (la planche n'est pas encore sur le plan). */
export function TuilePlanVide({ rang }: { rang?: number }) {
  return (
    <Tuile
      idTuile="plan"
      titre="Plan de la ferme"
      largeur={5}
      rang={rang}
      vide
      messageVide="Aucune planche n'est encore posée sur le plan."
      actionVide={
        <Link href="/jardin" className={CLASSES_LIEN_DISCRET}>
          Dessiner la ferme
        </Link>
      }
    />
  )
}
