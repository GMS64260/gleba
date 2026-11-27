"use client"

import { Button } from "@/components/ui/button"
import { rouvrirBandeauCookies } from "@/lib/consentement-cookies"

/** Rouvre le bandeau cookies avec les choix enregistrés, pour les modifier ou les retirer. */
export function GererCookies() {
  return (
    <Button type="button" variant="outline" onClick={rouvrirBandeauCookies}>
      Modifier mes choix de cookies
    </Button>
  )
}
