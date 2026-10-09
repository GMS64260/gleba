"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { enregistrerVersionAccueil } from "@/lib/accueil/client"
import { CHEMIN_ACCUEIL } from "@/lib/accueil/preference"
import { toast } from "@/hooks/use-toast"

import { CLASSES_LIEN_DISCRET } from "./boutons"

/** Lien « Revenir à l'ancien accueil » : remet la préférence à v1 puis ouvre /dashboard. */
export function RetourAncienAccueil({ className }: { className?: string }) {
  const router = useRouter()
  const [enCours, setEnCours] = React.useState(false)

  const revenir = async () => {
    if (enCours) return
    setEnCours(true)
    const resultat = await enregistrerVersionAccueil("v1")
    if (!resultat.ok) {
      toast({ title: "Choix non enregistré", description: resultat.error ?? "Erreur réseau" })
    }
    router.push(CHEMIN_ACCUEIL.v1)
  }

  return (
    <button type="button" onClick={revenir} disabled={enCours} className={`${CLASSES_LIEN_DISCRET} ${className ?? ""}`}>
      Revenir à l&rsquo;ancien accueil
    </button>
  )
}
