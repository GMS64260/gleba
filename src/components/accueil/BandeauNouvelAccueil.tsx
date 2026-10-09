"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sparkles, X } from "lucide-react"

import { enregistrerVersionAccueil } from "@/lib/accueil/client"
import { CHEMIN_ACCUEIL } from "@/lib/accueil/preference"
import { definirVersionAccueilLocale } from "@/hooks/use-version-accueil"
import { toast } from "@/hooks/use-toast"

import { CLASSES_BOUTON_PRINCIPAL } from "./boutons"

/**
 * Bandeau « Essayer le nouvel accueil » sur l'accueil historique (L2, opt-in
 * par compte). « Essayer » enregistre la préférence puis ouvre /aujourdhui ;
 * si l'enregistrement est refusé (compte démo figé en 403), la page s'ouvre
 * quand même et le message dit pourquoi le choix ne sera pas retenu.
 */
export const CLE_BANDEAU_MASQUE = "gleba-bandeau-accueil-v2"

export function BandeauNouvelAccueil() {
  const router = useRouter()
  const [visible, setVisible] = React.useState(false)
  const [enCours, setEnCours] = React.useState(false)

  React.useEffect(() => {
    // Jamais de lecture localStorage pendant le rendu (React #418).
    try {
      setVisible(window.localStorage.getItem(CLE_BANDEAU_MASQUE) !== "1")
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const essayer = async () => {
    if (enCours) return
    setEnCours(true)
    const resultat = await enregistrerVersionAccueil("v2")
    if (resultat.ok) definirVersionAccueilLocale("v2")
    if (!resultat.ok) {
      toast({
        title: "Choix non enregistré",
        description: `${resultat.error ?? "Erreur réseau"} Vous pouvez tout de même découvrir le nouvel accueil.`,
      })
    }
    router.push(CHEMIN_ACCUEIL.v2)
  }

  const masquer = () => {
    try {
      window.localStorage.setItem(CLE_BANDEAU_MASQUE, "1")
    } catch {
      // Le bandeau reviendra à la prochaine visite : acceptable.
    }
    setVisible(false)
  }

  return (
    <div className="border-b border-lin bg-sauge-doux" data-bandeau="nouvel-accueil">
      <div className="container mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2 text-sm text-foret">
        <Sparkles className="h-4 w-4 shrink-0 text-sauge" aria-hidden />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">Nouveau :</strong> un accueil qui montre la ferme d&rsquo;abord, avec la liste du jour, le plan
          et la semaine. Vous pourrez revenir ici à tout moment.
        </p>
        <button type="button" onClick={essayer} disabled={enCours} className={`${CLASSES_BOUTON_PRINCIPAL} min-h-9 px-3 text-xs`}>
          Essayer
        </button>
        <button
          type="button"
          onClick={masquer}
          aria-label="Masquer ce bandeau"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foret/70 hover:bg-craie hover:text-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
