"use client"

import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getGlossaireEntry } from "@/lib/glossaire"
import { cn } from "@/lib/utils"

interface GlossaireTermProps {
  /** Clé du terme dans le glossaire (ex: "ITP", "Planche"). Insensible à la casse. */
  term: string
  /** Contenu affiché. Si absent, le terme lui-même est utilisé. */
  children?: React.ReactNode
  /** Classes additionnelles sur le span. */
  className?: string
  /** Désactive le tooltip (rend juste le contenu sans soulignement). */
  disabled?: boolean
}

/**
 * Wrappe du texte avec un tooltip qui définit un terme métier du glossaire.
 * Souligné en pointillé pour signaler la présence d'une infobulle.
 *
 * Exemple :
 *   <GlossaireTerm term="ITP">ITP</GlossaireTerm>
 *   <GlossaireTerm term="DAR">délai avant récolte</GlossaireTerm>
 */
export function GlossaireTerm({
  term,
  children,
  className,
  disabled = false,
}: GlossaireTermProps) {
  const entry = getGlossaireEntry(term)
  const content = children ?? term

  if (disabled || !entry) {
    return <span className={className}>{content}</span>
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "underline decoration-dotted decoration-slate-400 underline-offset-2 cursor-help",
              className
            )}
          >
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left">
          <p className="font-semibold mb-1">{entry.label}</p>
          <p className="text-xs leading-relaxed opacity-95">{entry.definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
