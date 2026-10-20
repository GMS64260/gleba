"use client"

/**
 * Suppression d'une planche depuis un écran : un seul parcours, un seul
 * message de refus, celui du serveur.
 *
 * QA cmvgdp9fn (2026-10-20) : la page Planches, puis l'onglet Terrain du
 * tableau de bord (revue du même jour), refusaient seuls dès qu'ils voyaient
 * des cultures (« X a 4 culture(s) associée(s) »), sans les années où les
 * retrouver ni lien ; Terrain supprimait en plus par NOM. Les deux écrans
 * passent ici :
 * 1. vérification préalable `GET /api/planches/[id]/suppression` (même refus
 *    que DELETE, `refusSuppressionPlanche`) ;
 * 2. confirmation, avec les fertilisations importées qui partiront ;
 * 3. `DELETE /api/planches/[id]` par identifiant ; son 409 fait foi (une
 *    culture ajoutée entre-temps).
 *
 * Un refus qui porte un lien reste affiché jusqu'à ce qu'on le ferme : un
 * toast de 5 s disparaissait avant qu'on ait lu les années.
 */

import * as React from "react"

import { ToastAction } from "@/components/ui/toast"
import { toast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"

/** Refus de suppression rendu par le serveur. */
export interface RefusSuppressionPlanche {
  error?: string
  lien?: { href: string; libelle: string } | null
}

export function afficherRefusSuppressionPlanche(
  corps: RefusSuppressionPlanche | null,
  naviguer: (href: string) => void,
) {
  const lien = corps?.lien
  toast({
    variant: "destructive",
    title: "Impossible de supprimer",
    description: corps?.error || "Impossible de supprimer la planche",
    action: lien ? (
      <ToastAction altText={lien.libelle} onClick={() => naviguer(lien.href)}>
        {lien.libelle}
      </ToastAction>
    ) : undefined,
    // Avec un lien : jusqu'à fermeture (Radix et `use-toast` ignorent Infinity).
    ...(lien ? { duration: Number.POSITIVE_INFINITY } : {}),
  })
}

/**
 * Vérifie, confirme puis supprime. Rend `true` si la planche a été supprimée.
 */
export async function supprimerPlancheVerifiee(
  planche: { id: string; nom: string },
  naviguer: (href: string) => void,
): Promise<boolean> {
  const url = `/api/planches/${encodeURIComponent(planche.id)}`
  try {
    const verification = await fetch(`${url}/suppression`)
    const etat = (await verification.json().catch(() => null)) as
      | (RefusSuppressionPlanche & { supprimable?: boolean; fertilisations?: number })
      | null
    if (!verification.ok || !etat || !etat.supprimable) {
      afficherRefusSuppressionPlanche(etat, naviguer)
      return false
    }

    // Les fertilisations (import Potaléger) partent avec la planche : aucun
    // écran ne les gère, on le dit avant de confirmer (QA cmv29i9ad).
    const fertilisations = etat.fertilisations ?? 0
    const avertissement =
      fertilisations > 1
        ? ` Ses ${fertilisations} fertilisations importées seront supprimées avec elle.`
        : fertilisations === 1
          ? " Sa fertilisation importée sera supprimée avec elle."
          : ""
    if (!(await confirmDialog(`Supprimer la planche "${planche.nom}" ?${avertissement}`))) return false

    const response = await fetch(url, { method: "DELETE" })
    if (!response.ok) {
      afficherRefusSuppressionPlanche(
        (await response.json().catch(() => null)) as RefusSuppressionPlanche | null,
        naviguer,
      )
      return false
    }
    toast({ title: "Planche supprimée", description: `La planche "${planche.nom}" a été supprimée` })
    return true
  } catch {
    toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la planche" })
    return false
  }
}
