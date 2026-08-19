"use client"

/**
 * Bouton « Continuer avec Google » — même langage visuel que les boutons
 * secondaires des formulaires d'auth (glassmorphism).
 *
 * N'est rendu par LoginForm/RegisterForm que si le provider Google est
 * configuré côté serveur (prop googleEnabled des pages).
 */

import * as React from "react"
import { signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

export function GoogleSignInButton({
  callbackUrl = "/",
  label = "Continuer avec Google",
}: {
  callbackUrl?: string
  label?: string
}) {
  const [loading, setLoading] = React.useState(false)

  function handleClick() {
    setLoading(true)
    // Redirection complète vers Google : pas de retour d'erreur local ici,
    // les échecs reviennent sur /login?error=… (gérés par LoginForm).
    signIn("google", { callbackUrl })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 rounded-xl border border-slate-200/60 bg-white/60 text-sm font-medium text-slate-700
                 hover:bg-white hover:border-slate-300 hover:shadow-sm
                 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-center gap-2.5"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <GoogleLogo className="h-4 w-4" />
      )}
      {label}
    </button>
  )
}
