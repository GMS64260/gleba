"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  EVENEMENT_CHOIX_COOKIES,
  enregistrerChoixCookies,
  lireChoixCookies,
  mesureAudienceRefusee,
} from "@/lib/consentement-cookies"

/** Le même choix local que le bandeau, sans aucun appel à Matomo. */
export function OppositionMesureAudience() {
  const [refus, setRefus] = useState<boolean | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    const actualiser = () => setRefus(mesureAudienceRefusee())
    actualiser()
    window.addEventListener(EVENEMENT_CHOIX_COOKIES, actualiser)
    window.addEventListener("storage", actualiser)
    return () => {
      window.removeEventListener(EVENEMENT_CHOIX_COOKIES, actualiser)
      window.removeEventListener("storage", actualiser)
    }
  }, [])

  const modifier = () => {
    try {
      enregistrerChoixCookies({
        ...lireChoixCookies(),
        analytics: refus === true,
      })
      setErreur("")
    } catch {
      setErreur("Votre navigateur ne permet pas d’enregistrer ce choix. Activez « Ne pas me pister » dans ses réglages.")
    }
  }

  return (
    <div className="my-4">
      <p aria-live="polite">
        {refus === true ? "Vous vous opposez à la mesure d’audience sur ce navigateur." : "Vous pouvez refuser la mesure d’audience sur ce navigateur."}
      </p>
      <Button type="button" variant="outline" disabled={refus === null} onClick={modifier}>
        {refus ? "Autoriser la mesure d’audience" : "M’opposer à la mesure d’audience"}
      </Button>
      {erreur && <p role="alert">{erreur}</p>}
    </div>
  )
}
