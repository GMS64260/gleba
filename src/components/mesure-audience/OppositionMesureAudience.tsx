"use client"

/** Bouton d'opposition Matomo, affiché dans la politique de confidentialité. */

import { useEffect } from "react"

export function OppositionMesureAudience() {
  useEffect(() => {
    const hote = document.getElementById("matomo-opt-out")
    if (!hote || hote.childElementCount) return
    const script = document.createElement("script")
    script.async = true
    script.src =
      "https://stats.synalto.eu/index.php?module=CoreAdminHome&action=optOutJS&divId=matomo-opt-out&language=fr&showIntro=1"
    document.body.appendChild(script)
  }, [])
  return <div id="matomo-opt-out" className="my-4" />
}
