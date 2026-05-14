"use client"

/**
 * Page "Mot de passe oublié" - saisie de l'email pour recevoir le lien de reset
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react"

export default function MotDePasseOubliePage() {
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [error, setError] = React.useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
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
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                  Email envoyé
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Si un compte existe avec cette adresse, vous allez recevoir un email avec un lien pour réinitialiser votre mot de passe. Le lien est valable 1 heure.
                </p>
                <p className="text-xs text-slate-400">
                  Pensez à vérifier vos spams.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-7">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                    Mot de passe oublié ?
                  </h2>
                  <p className="text-sm text-slate-400 mt-1.5">
                    Saisissez votre email, nous vous enverrons un lien.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
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
                      autoComplete="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200 disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full h-12 rounded-xl btn-gradient text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      "Envoyer le lien"
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
