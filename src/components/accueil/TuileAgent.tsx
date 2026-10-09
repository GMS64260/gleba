"use client"

import * as React from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"

import { ouvrirAssistant } from "@/lib/accueil/evenements"
import type { ElementAujourdhui } from "@/lib/accueil/types"
import { cn } from "@/lib/utils"

import type { MeteoSemaine } from "./TuileSemaine"

/**
 * Tuile « agent » de l'accueil v2, livraison L2 : elle montre l'alerte la
 * plus importante déjà calculée (météo de la parcelle, sinon première ligne
 * critique du jour) avec ses actions, et « Demander à Gleba » ouvre le
 * panneau d'assistant existant. Aucun appel au modèle depuis l'accueil :
 * son coût n'est pas mesuré (point ouvert du vault).
 */
export interface TuileAgentProps {
  alerteMeteo: MeteoSemaine["alertes"][number] | null
  elementCritique: ElementAujourdhui | null
  chargement: boolean
  rang?: number
}

const CLASSES_ACTION =
  "inline-flex min-h-11 items-center rounded-lg border border-lin bg-craie px-3 text-xs font-semibold text-encre hover:border-sauge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
const CLASSES_ACTION_PRINCIPALE =
  "inline-flex min-h-11 items-center rounded-lg border border-sauge bg-sauge px-3 text-xs font-semibold text-craie hover:bg-foret hover:border-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

/** Première alerte météo à montrer : danger avant attention, info ignorée. */
export function alerteMeteoPrioritaire(alertes: MeteoSemaine["alertes"] | undefined): MeteoSemaine["alertes"][number] | null {
  if (!alertes || alertes.length === 0) return null
  return alertes.find((a) => a.niveau === "danger") ?? alertes.find((a) => a.niveau === "attention") ?? null
}

export function TuileAgent({ alerteMeteo, elementCritique, chargement, rang }: TuileAgentProps) {
  let message: React.ReactNode
  let actions: React.ReactNode

  if (chargement) {
    message = <span className="text-ardoise/80">Je regarde la journée…</span>
    actions = null
  } else if (alerteMeteo) {
    message = (
      <>
        {alerteMeteo.message}
        {alerteMeteo.details ? ` ${alerteMeteo.details}` : ""}
      </>
    )
    actions = (
      <>
        <Link href="/meteo" className={CLASSES_ACTION_PRINCIPALE}>
          Ouvrir la météo
        </Link>
        <button type="button" onClick={() => ouvrirAssistant({ question: alerteMeteo.message })} className={CLASSES_ACTION}>
          Demander à Gleba
        </button>
      </>
    )
  } else if (elementCritique) {
    message = (
      <>
        {elementCritique.titre}
        {elementCritique.meta.length > 0 ? ` · ${elementCritique.meta.join(" · ")}` : ""}. C&rsquo;est le point le plus pressant du jour.
      </>
    )
    actions = (
      <>
        <Link href={elementCritique.action.href} className={CLASSES_ACTION_PRINCIPALE}>
          {elementCritique.action.libelle}
        </Link>
        <button type="button" onClick={() => ouvrirAssistant({ question: elementCritique.titre })} className={CLASSES_ACTION}>
          Demander à Gleba
        </button>
      </>
    )
  } else {
    message = "Rien d'urgent signalé pour aujourd'hui. Je peux préparer la journée, retrouver une culture ou noter une saisie."
    actions = (
      <button type="button" onClick={() => ouvrirAssistant()} className={CLASSES_ACTION_PRINCIPALE}>
        Demander à Gleba
      </button>
    )
  }

  return (
    <section
      data-tuile="agent"
      aria-labelledby="tuile-agent-titre"
      className={cn(
        "col-span-1 rounded-2xl bg-sauge-doux px-4 py-3.5 text-[13.5px] leading-snug text-encre lg:col-span-7",
        rang !== undefined && "accueil-entree",
      )}
      style={rang !== undefined ? ({ "--rang": rang } as React.CSSProperties) : undefined}
    >
      <h3 id="tuile-agent-titre" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foret">
        <Sparkles className="h-4 w-4 text-sauge" aria-hidden />
        Gleba
      </h3>
      <p>{message}</p>
      {actions && <div className="mt-2.5 flex flex-wrap gap-1.5">{actions}</div>}
    </section>
  )
}
