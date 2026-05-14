"use client"

/**
 * Composant Breadcrumb basé sur le path Next.js (PROMPT 21 §3).
 *
 * Convention :
 *  - le premier segment correspond au module (maraichage, verger, elevage, comptabilite)
 *  - le second segment correspond à une vue (cultures, planches, ...)
 *  - les segments dynamiques (id) sont affichés tels quels (l'ID est rarement
 *    pertinent à afficher en breadcrumb sans contexte ; libre à la page de
 *    surcharger via slot enfant si elle veut afficher "Carotte Nantaise")
 *
 * Utilisation : <Breadcrumb /> placé sous le header des pages internes.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ChevronRight } from "lucide-react"

const SEGMENT_LABELS: Record<string, string> = {
  maraichage: "Maraîchage",
  cultures: "Cultures",
  planches: "Planches",
  rotations: "Rotations",
  itps: "ITPs",
  stocks: "Stocks",
  recoltes: "Récoltes",
  planification: "Planification",
  especes: "Espèces",
  associations: "Associations",
  interventions: "Interventions",
  taches: "Tâches",
  tracabilite: "Traçabilité",
  verger: "Verger",
  arbres: "Arbres",
  "sante-phyto": "Santé phyto",
  plantations: "Plantations",
  campagnes: "Campagnes",
  elevage: "Élevage",
  animaux: "Animaux",
  production: "Production",
  reproduction: "Reproduction",
  dashboard: "Dashboard",
  comptabilite: "Comptabilité",
  factures: "Factures",
  clients: "Clients",
  fournisseurs: "Fournisseurs",
  rapports: "Rapports",
  export: "Export",
  "couts-production": "Coûts de production",
  "ventes-manuelles": "Ventes manuelles",
  "depenses-manuelles": "Dépenses manuelles",
  tva: "TVA",
  ca3: "CA3",
  fec: "FEC",
  boutique: "Boutique",
  jardin: "Jardin",
  parcelles: "Parcelles",
  parametres: "Paramètres",
  exploitation: "Exploitation",
  feedback: "Feedback",
  roadmap: "Roadmap",
  admin: "Admin",
  raccourcis: "Raccourcis clavier",
  aide: "Centre d'aide",
  new: "Nouveau",
  onboarding: "Onboarding",
}

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  // ID numérique : on le rend opaque "#42"
  if (/^\d+$/.test(segment)) return `#${segment}`
  // CUID / slug : on le tronque
  if (segment.length > 16) return segment.slice(0, 14) + "…"
  return segment[0].toUpperCase() + segment.slice(1)
}

export function Breadcrumb({ trailingLabel }: { trailingLabel?: string }) {
  const pathname = usePathname()
  if (!pathname || pathname === "/") return null

  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
      <ol className="container mx-auto flex items-center gap-1 flex-wrap">
        <li>
          <Link href="/" className="flex items-center hover:text-slate-900">
            <Home className="h-3 w-3" />
          </Link>
        </li>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1
          const href = "/" + segments.slice(0, i + 1).join("/")
          return (
            <React.Fragment key={i}>
              <li className="text-slate-300" aria-hidden>
                <ChevronRight className="h-3 w-3" />
              </li>
              <li>
                {isLast ? (
                  <span className="font-medium text-slate-900">
                    {trailingLabel || labelFor(seg)}
                  </span>
                ) : (
                  <Link href={href} className="hover:text-slate-900">
                    {labelFor(seg)}
                  </Link>
                )}
              </li>
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
