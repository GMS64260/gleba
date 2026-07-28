"use client"

/**
 * Point d'entrée d'une consultation admin lecture seule.
 * À ouvrir dans une fenêtre de navigation privée : consomme le jeton one-time
 * et connecte la fenêtre comme l'utilisateur cible via le provider
 * "impersonation", puis redirige vers l'accueil.
 */

import * as React from "react"
import { signIn } from "next-auth/react"
import { Loader2, ShieldAlert } from "lucide-react"

export default function ConsumeImpersonationPage() {
  const [erreur, setErreur] = React.useState<string | null>(null)

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")
    if (!token) {
      setErreur("Lien de consultation invalide (jeton manquant).")
      return
    }
    signIn("impersonation", { token, redirect: false }).then((res) => {
      if (res?.error) {
        setErreur("Lien expiré ou déjà utilisé. Regénérez une consultation depuis l'admin.")
      } else {
        // Navigation complète pour repartir avec le cookie de session cible.
        window.location.href = "/"
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center space-y-3">
        {erreur ? (
          <>
            <ShieldAlert className="h-8 w-8 text-red-500 mx-auto" />
            <h1 className="text-lg font-semibold text-slate-800">Consultation impossible</h1>
            <p className="text-sm text-muted-foreground">{erreur}</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 text-sky-600 mx-auto animate-spin" />
            <h1 className="text-lg font-semibold text-slate-800">Ouverture de la session…</h1>
            <p className="text-sm text-muted-foreground">
              Connexion en lecture seule au compte consulté.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
