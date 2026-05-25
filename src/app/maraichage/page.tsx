/**
 * Module Maraîchage — home par défaut (PROMPT 21).
 *
 * La page d'accueil du maraîchage redirige vers le dashboard global `/`
 * qui contient le calendrier de la semaine. Les sous-routes dédiées
 * (`/maraichage/cultures`, `/maraichage/recoltes`, `/maraichage/planches`)
 * restent accessibles directement.
 *
 * Feedback Marc 2026-05-16 — V2 Bug 7 : `/maraichage?tab=cultures`
 * arrivait sur le calendrier (les query params étaient perdus par
 * `redirect("/")`). On préserve désormais le `searchParams` pour que
 * l'utilisateur arrive sur le bon onglet.
 */

import { redirect } from "next/navigation"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MaraichagePage({ searchParams }: PageProps) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v)
    } else {
      sp.set(key, value)
    }
  }
  const query = sp.toString()
  redirect(query ? `/?${query}` : "/")
}
