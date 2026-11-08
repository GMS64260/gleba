/** Couleurs, icônes et formats partagés par la page /admin/usage. */

import type { ComponentType } from "react"
import { Bird, MapTrifold, Megaphone, Sprout, TreeDeciduous, Wallet } from "lucide-react"
import type { GroupeUsageId, Segment } from "./types"

export const GROUPE_VISUEL: Record<
  GroupeUsageId,
  { couleur: string; court: string; icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }
> = {
  maraichage: { couleur: "#15803d", court: "Maraîchage", icone: Sprout },
  verger: { couleur: "#b45309", court: "Verger", icone: TreeDeciduous },
  elevage: { couleur: "#be185d", court: "Élevage", icone: Bird },
  comptabilite: { couleur: "#1d4ed8", court: "Compta", icone: Wallet },
  terrain: { couleur: "#0f766e", court: "Plan & notes", icone: MapTrifold },
  communaute: { couleur: "#6d28d9", court: "Communauté", icone: Megaphone },
}

/** Classes Tailwind du badge et couleur de la pastille, par segment. */
export const SEGMENT_VISUEL: Record<Segment, { badge: string; couleur: string }> = {
  regulier: { badge: "bg-green-100 text-green-800 border-green-200", couleur: "#16a34a" },
  occasionnel: { badge: "bg-sky-100 text-sky-800 border-sky-200", couleur: "#0284c7" },
  nouveau: { badge: "bg-amber-100 text-amber-900 border-amber-200", couleur: "#d97706" },
  decroche: { badge: "bg-rose-100 text-rose-800 border-rose-200", couleur: "#e11d48" },
  jamais_revenu: { badge: "bg-slate-100 text-slate-600 border-slate-200", couleur: "#94a3b8" },
}

export const nf = new Intl.NumberFormat("fr-FR")

export function userLabel(u: { name: string | null; email: string }) {
  return u.name || u.email.split("@")[0]
}

/** Date avec heure significative (inscription, saisie) : fuseau du navigateur. */
export function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Jour pur (activity_days) : en UTC pour ne pas glisser d'un jour. */
export function fmtDay(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** « aujourd'hui », « hier », « il y a 12 j », « il y a 3 mois ». */
export function ilYa(s: string | null, utc = false) {
  if (!s) return "jamais"
  const d = new Date(s)
  const ref = new Date()
  if (utc) {
    ref.setUTCHours(0, 0, 0, 0)
  } else {
    ref.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
  }
  const j = Math.round((ref.getTime() - d.getTime()) / 86_400_000)
  if (j <= 0) return "aujourd’hui"
  if (j === 1) return "hier"
  if (j < 60) return `il y a ${j} j`
  const m = Math.round(j / 30)
  if (m < 24) return `il y a ${m} mois`
  return `il y a ${Math.round(j / 365)} ans`
}

export function fmtBucketLabel(iso: string, bucket: string) {
  const d = new Date(iso + "T00:00:00Z")
  if (bucket === "month") {
    return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" })
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
}
