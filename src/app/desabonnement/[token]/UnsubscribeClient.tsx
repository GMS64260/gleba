"use client"

import { useState } from "react"

type Status = "idle" | "loading" | "unsubscribed" | "resubscribed" | "error"

export function UnsubscribeClient({
  token,
  email,
  initiallyOptedOut,
}: {
  token: string
  email: string
  initiallyOptedOut: boolean
}) {
  const [status, setStatus] = useState<Status>(
    initiallyOptedOut ? "unsubscribed" : "idle",
  )
  const [error, setError] = useState<string | null>(null)

  async function call(action: "unsubscribe" | "resubscribe") {
    setStatus("loading")
    setError(null)
    try {
      const res = await fetch(`/api/desabonnement/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur")
      setStatus(action === "unsubscribe" ? "unsubscribed" : "resubscribed")
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Erreur réseau")
    }
  }

  const loading = status === "loading"
  const isOptedOut = status === "unsubscribed"

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Préférences d'emails Gleba
          </h1>
          <p className="mt-2 text-sm text-slate-500 break-all">{email}</p>

          {isOptedOut ? (
            <>
              <div className="mx-auto my-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-7 w-7 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <p className="text-slate-600">
                Vous êtes <strong>désabonné·e</strong> des emails non essentiels de Gleba
                (campagnes, invitations à donner votre avis).
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Vous continuerez à recevoir les emails indispensables liés à votre compte
                (vérification d'adresse, réinitialisation de mot de passe).
              </p>
              <button
                onClick={() => call("resubscribe")}
                disabled={loading}
                className="mt-6 inline-flex items-center rounded-lg border border-emerald-300 px-5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                {loading ? "…" : "Me réabonner"}
              </button>
            </>
          ) : status === "resubscribed" ? (
            <>
              <div className="mx-auto my-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-7 w-7 text-emerald-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-slate-600">
                C'est noté, vous êtes de nouveau <strong>abonné·e</strong>. Merci&nbsp;!
              </p>
              <button
                onClick={() => call("unsubscribe")}
                disabled={loading}
                className="mt-6 inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Finalement, me désabonner
              </button>
            </>
          ) : (
            <>
              <p className="mt-6 text-slate-600">
                Souhaitez-vous ne plus recevoir les emails non essentiels de Gleba
                (campagnes, invitations à donner votre avis)&nbsp;?
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Les emails indispensables liés à votre compte (vérification d'adresse,
                réinitialisation de mot de passe) continueront d'être envoyés.
              </p>
              <button
                onClick={() => call("unsubscribe")}
                disabled={loading}
                className="mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "…" : "Me désabonner"}
              </button>
            </>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <a
            href="https://gleba.fr"
            className="mt-8 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-900"
          >
            gleba.fr →
          </a>
        </div>
      </div>
    </div>
  )
}
