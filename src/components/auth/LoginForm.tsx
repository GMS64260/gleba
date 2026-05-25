"use client"

/**
 * Formulaire de connexion — glassmorphism + gradient animé
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2, ArrowRight } from "lucide-react"

const VERIFY_MESSAGES: Record<string, { text: string; type: "success" | "error" | "info" }> = {
  success: { text: "Email vérifié ! Vous pouvez maintenant vous connecter.", type: "success" },
  expired: { text: "Le lien de vérification a expiré. Inscrivez-vous à nouveau.", type: "error" },
  invalid: { text: "Lien de vérification invalide.", type: "error" },
  already: { text: "Cet email est déjà vérifié. Connectez-vous.", type: "info" },
  error: { text: "Erreur lors de la vérification.", type: "error" },
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const verifyStatus = searchParams.get("verify")

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError("Une erreur est survenue")
    } finally {
      setLoading(false)
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
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50/80 rounded-xl border border-red-200/50 backdrop-blur-sm">
          {error}
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
            Connexion...
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
