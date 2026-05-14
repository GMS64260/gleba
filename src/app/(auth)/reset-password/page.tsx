"use client"

/**
 * Page de réinitialisation effective du mot de passe (via token URL)
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ArrowLeft, Lock, CheckCircle2, XCircle } from "lucide-react"

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!token) setError("Lien invalide : aucun token fourni.")
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 12) {
      setError("Le mot de passe doit contenir au moins 12 caractères.")
      return
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push("/login"), 2500)
      } else {
        setError(data.error || "Erreur inattendue")
      }
    } catch {
      setError("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <Link href="/login" className="mb-8 animate-fade-in-up">
        <Image
          src="/gleba-logo.png"
          alt="Gleba"
          width={400}
          height={136}
          className="h-24 sm:h-32 w-auto"
          priority
        />
      </Link>

      <div className="w-full max-w-[420px] animate-fade-in-up-2">
        <div className="card-glow rounded-2xl">
          <div className="bg-white/75 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-900/[0.06] p-8 sm:p-9">
            {success ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                  Mot de passe modifié
                </h2>
                <p className="text-sm text-slate-500">
                  Vous allez être redirigé vers la connexion...
                </p>
              </div>
            ) : !token ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                  <XCircle className="h-7 w-7 text-red-600" />
                </div>
                <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                  Lien invalide
                </h2>
                <p className="text-sm text-slate-500">
                  Le lien de réinitialisation est incorrect ou incomplet.
                </p>
                <Link
                  href="/mot-de-passe-oublie"
                  className="inline-block text-sm text-emerald-700 hover:text-emerald-800 underline"
                >
                  Demander un nouveau lien
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-7">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Lock className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                    Nouveau mot de passe
                  </h2>
                  <p className="text-sm text-slate-400 mt-1.5">
                    Choisissez un mot de passe d'au moins 12 caractères.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-50/80 rounded-xl border border-red-200/50 backdrop-blur-sm">
                      {error}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-600 pl-1">
                      Nouveau mot de passe
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                      disabled={loading}
                      className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200 disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="confirm" className="block text-sm font-medium text-slate-600 pl-1">
                      Confirmer le mot de passe
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={12}
                      disabled={loading}
                      className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200 disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !password || !confirm}
                    className="w-full h-12 rounded-xl btn-gradient text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validation...
                      </>
                    ) : (
                      "Réinitialiser le mot de passe"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-6 flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-600 transition-colors duration-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour à la connexion
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>}>
      <ResetPasswordInner />
    </React.Suspense>
  )
}
