"use client"

/**
 * Formulaire de connexion — glassmorphism + gradient animé
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2, ArrowRight, RefreshCw } from "lucide-react"
import { GoogleSignInButton } from "./GoogleSignInButton"
import { REFUS_CONNEXION, messageRefusConnexion } from "@/lib/auth-refus"

const VERIFY_MESSAGES: Record<string, { text: string; type: "success" | "error" | "info" }> = {
  success: { text: "Email vérifié ! Vous pouvez maintenant vous connecter.", type: "success" },
  expired: { text: "Le lien de vérification a expiré. Inscrivez-vous à nouveau.", type: "error" },
  invalid: { text: "Lien de vérification invalide.", type: "error" },
  already: { text: "Cet email est déjà vérifié. Connectez-vous.", type: "info" },
  error: { text: "Erreur lors de la vérification.", type: "error" },
}

// Erreurs renvoyées sur /login?error=… par le flux OAuth (callback signIn de
// auth.ts pour `google`/`inactive`, codes Auth.js pour le reste).
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google:
    "Connexion Google impossible : adresse email absente ou non vérifiée par Google.",
  inactive: "Ce compte a été désactivé. Contactez contact@gleba.fr.",
  AccessDenied: "Connexion refusée.",
  OAuthAccountNotLinked:
    "Cet email est déjà associé à un compte. Connectez-vous avec votre mot de passe.",
  OAuthCallbackError: "La connexion Google a échoué. Réessayez.",
  Configuration:
    "La connexion est momentanément indisponible. Contactez contact@gleba.fr.",
}

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const verifyStatus = searchParams.get("verify")
  const oauthError = searchParams.get("error")
  // Chemin sans JavaScript : Auth.js renvoie sur /login?error=CredentialsSignin
  // &code=<motif>. Le formulaire utilise normalement `redirect: false` et lit le
  // motif dans la réponse, mais cette URL existe et ne doit pas rester muette.
  const refusUrl =
    oauthError === "CredentialsSignin" ? searchParams.get("code") : null

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  // Motif du dernier refus : sert à proposer le remède, pas seulement à
  // expliquer. Une adresse non vérifiée se débloque par un renvoi d'email.
  const [refusCode, setRefusCode] = React.useState("")
  const [resending, setResending] = React.useState(false)
  const [resendMessage, setResendMessage] = React.useState<{ ok: boolean; texte: string } | null>(null)
  const [loading, setLoading] = React.useState(false)
  // Connexion acceptée, page cible en cours d'ouverture. Le formulaire reste
  // verrouillé jusqu'à ce que la navigation le démonte : avant, `loading`
  // retombait dès la réponse de `signIn`, AVANT le rendu du tableau de bord.
  // Sur une liaison lente (compte en Nouvelle-Calédonie, 2026-08-26 et 28), le
  // formulaire restait visible et actif plusieurs secondes, et l'utilisatrice
  // re-soumettait — deux connexions « ok » à 9 et 18 s d'écart à chaque visite.
  const [redirecting, setRedirecting] = React.useState(false)

  // Filet : si la page cible ne s'ouvre pas, ne pas laisser un formulaire mort.
  React.useEffect(() => {
    if (!redirecting) return
    const t = setTimeout(() => {
      setRedirecting(false)
      setLoading(false)
      setError("Connexion acceptée, mais la page met du temps à s'ouvrir. Rechargez la page.")
    }, 20_000)
    return () => clearTimeout(t)
  }, [redirecting])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError("")
    setRefusCode("")
    setResendMessage(null)
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // `result.error` est un code Auth.js générique ; le motif réel voyage
        // dans `result.code`, seule propriété que la bibliothèque propage.
        const code = result.code ?? ""
        setRefusCode(code)
        setError(messageRefusConnexion(code))
        setLoading(false)
        return
      }

      // Succès : `loading` reste vrai, seul le libellé change.
      setRedirecting(true)
      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError("Une erreur est survenue")
      setLoading(false)
    }
  }

  /** Même endpoint que l'écran de confirmation d'inscription. */
  async function handleResend() {
    setResending(true)
    setResendMessage(null)
    try {
      const res = await fetch("/api/auth/resend-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.emailEnvoye !== false) {
        setResendMessage({ ok: true, texte: "Email renvoyé. Vérifiez votre boîte, et les indésirables." })
      } else {
        setResendMessage({
          ok: false,
          texte:
            data?.error ||
            "Le renvoi a échoué. Vérifiez l'adresse saisie, ou écrivez à contact@gleba.fr.",
        })
      }
    } catch {
      setResendMessage({ ok: false, texte: "Le renvoi a échoué (réseau indisponible)." })
    } finally {
      setResending(false)
    }
  }

  const formRef = React.useRef<HTMLFormElement>(null)

  function handleDemo() {
    setEmail("demo@gleba.fr")
    setPassword("demo2026")
    // Auto-submit après un tick pour laisser React mettre à jour les champs
    setTimeout(() => formRef.current?.requestSubmit(), 0)
  }

  // Auto-déclenchement de la démo si la home a renvoyé sur /login?demo=1
  const demoRequested = searchParams.get("demo") === "1"
  const demoFiredRef = React.useRef(false)
  React.useEffect(() => {
    if (demoRequested && !demoFiredRef.current) {
      demoFiredRef.current = true
      handleDemo()
    }
  }, [demoRequested])

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {verifyStatus && VERIFY_MESSAGES[verifyStatus] && (
        <div
          className={`p-3 text-sm rounded-xl border backdrop-blur-sm ${
            VERIFY_MESSAGES[verifyStatus].type === "success"
              ? "text-green-700 bg-green-50/80 border-green-200/50"
              : VERIFY_MESSAGES[verifyStatus].type === "info"
              ? "text-blue-700 bg-blue-50/80 border-blue-200/50"
              : "text-red-700 bg-red-50/80 border-red-200/50"
          }`}
        >
          {VERIFY_MESSAGES[verifyStatus].text}
        </div>
      )}
      {!error && refusUrl && (
        <div className="p-3 text-sm text-red-700 bg-red-50/80 rounded-xl border border-red-200/50 backdrop-blur-sm">
          {messageRefusConnexion(refusUrl)}
        </div>
      )}
      {!error && !refusUrl && oauthError && OAUTH_ERROR_MESSAGES[oauthError] && (
        <div className="p-3 text-sm text-red-700 bg-red-50/80 rounded-xl border border-red-200/50 backdrop-blur-sm">
          {OAUTH_ERROR_MESSAGES[oauthError]}
        </div>
      )}
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50/80 rounded-xl border border-red-200/50 backdrop-blur-sm space-y-2">
          <p>{error}</p>
          {/* Expliquer ne suffit pas : cinq comptes sur sept refusés pour
              adresse non vérifiée l'ont été dans les cinq minutes suivant leur
              inscription, donc avec un email d'activation encore en route ou
              déjà perdu. Le remède est offert sur place. */}
          {refusCode === REFUS_CONNEXION.EMAIL_NON_VERIFIE && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !email}
                className="inline-flex items-center gap-1.5 font-medium text-red-800 underline underline-offset-2 hover:text-red-900 disabled:opacity-60"
              >
                {resending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Renvoyer l&apos;email de vérification
              </button>
              {resendMessage && (
                <p className={resendMessage.ok ? "text-emerald-700" : "text-red-800"}>
                  {resendMessage.texte}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-600 pl-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="votre@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 placeholder:text-slate-400
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                     transition-all duration-200 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between pl-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-600">
            Mot de passe
          </label>
          <Link
            href="/mot-de-passe-oublie"
            className="text-xs text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          placeholder="Votre mot de passe"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 placeholder:text-slate-400
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                     transition-all duration-200 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl btn-gradient text-white font-semibold text-sm tracking-wide
                   shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30
                   transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {redirecting ? "Connexion réussie, ouverture…" : "Connexion..."}
          </>
        ) : (
          <>
            Se connecter
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Séparateur */}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200/40" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 text-xs text-slate-400 bg-white/60 backdrop-blur-sm rounded-full">ou</span>
        </div>
      </div>

      {googleEnabled && <GoogleSignInButton callbackUrl={callbackUrl} />}

      <button
        type="button"
        onClick={handleDemo}
        className="w-full h-11 rounded-xl border border-emerald-200/60 bg-emerald-50/30 text-sm font-medium text-emerald-700
                   hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-sm
                   transition-all duration-200 flex items-center justify-center gap-2"
      >
        Essayer la démo
      </button>
    </form>
  )
}
