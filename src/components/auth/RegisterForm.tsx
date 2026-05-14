"use client"

/**
 * Formulaire d'inscription — meme style glassmorphism que LoginForm
 */

import * as React from "react"
import { Loader2, ArrowRight, Mail, RefreshCw } from "lucide-react"
import Link from "next/link"

export function RegisterForm() {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [emailSent, setEmailSent] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    if (password.length < 12) {
      setError("Le mot de passe doit contenir au moins 12 caracteres")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription")
        return
      }

      // Afficher le message de verification email
      setEmailSent(true)
    } catch {
      setError("Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      await fetch("/api/auth/resend-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } catch {
      // silencieux
    } finally {
      setResending(false)
    }
  }

  // Ecran de confirmation email envoyé
  if (emailSent) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <Mail className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Verifiez votre email</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Un email de confirmation a été envoyé a <strong className="text-slate-700">{email}</strong>.
          Cliquez sur le lien dans l&apos;email pour activer votre compte.
        </p>
        <div className="pt-2 space-y-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors flex items-center gap-1.5 mx-auto"
          >
            {resending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Renvoyer l&apos;email
          </button>
          <Link
            href="/login"
            className="block text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Retour a la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50/80 rounded-xl border border-red-200/50 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-slate-600 pl-1">
          Nom <span className="text-slate-400 font-normal">(optionnel)</span>
        </label>
        <input
          id="name"
          type="text"
          placeholder="Votre nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 placeholder:text-slate-400
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                     transition-all duration-200 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-600 pl-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="votre@email.com"
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
        <label htmlFor="password" className="block text-sm font-medium text-slate-600 pl-1">
          Mot de passe <span className="text-slate-400 font-normal">(12 caracteres min.)</span>
        </label>
        <input
          id="password"
          type="password"
          placeholder="Choisissez un mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          disabled={loading}
          className="w-full h-12 px-4 rounded-xl bg-white/50 border border-slate-200/60 text-slate-900 placeholder:text-slate-400
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                     transition-all duration-200 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-600 pl-1">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          placeholder="Confirmez votre mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
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
            Inscription...
          </>
        ) : (
          <>
            Créer mon compte
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-slate-500">
        Deja un compte ?{" "}
        <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
          Se connecter
        </Link>
      </p>
    </form>
  )
}
