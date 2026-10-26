"use client"

import * as React from "react"
import { ENTREES_NAVIGATION, type PageNavigationId } from "@/lib/navigation-principale"
import { cn } from "@/lib/utils"

export function ConteneurPage({ as: Balise = "main", className, children, ...props }: React.HTMLAttributes<HTMLElement> & { as?: "main" | "div" }) {
  return <Balise className={cn("mx-auto w-full max-w-[1600px] px-4 lg:px-6", className)} {...props}>{children}</Balise>
}

interface PageEnteteProps {
  id: PageNavigationId
  actions?: React.ReactNode
  description?: React.ReactNode
  className?: string
}

/** Une racine du carnet porte le même nom et la même icône que sa navigation. */
export const PageEntete = React.forwardRef<HTMLDivElement, PageEnteteProps>(function PageEntete({ id, actions, description, className }, ref) {
  const entree = ENTREES_NAVIGATION.find(item => item.id === id)!
  const Icone = entree.icone
  return (
    <div ref={ref} data-page-entete={id} className={cn("font-ui", className)}>
      <ConteneurPage as="div" className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-3 lg:py-4">
        <div className="min-w-0">
          <div className="flex min-h-11 min-w-0 items-center gap-3">
            <Icone className="h-5 w-5 shrink-0 text-ardoise" aria-hidden />
            <h1 className="font-display text-2xl font-medium leading-[1.2] tracking-tight text-encre lg:text-[28px]">{entree.libelle}</h1>
          </div>
          {description && <div className="mt-2 text-sm leading-6 text-ardoise">{description}</div>}
        </div>
        {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2 sm:justify-end [&_button]:min-h-11">{actions}</div>}
      </ConteneurPage>
    </div>
  )
})
