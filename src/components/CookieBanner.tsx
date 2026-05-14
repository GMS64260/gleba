"use client"

/**
 * DEV2 audit Larcher - P0 #2 — Bandeau cookies CNIL/RGPD.
 *
 * Conformité :
 *  - Refus aussi facile que l'acceptation (CNIL délibération 2020-091)
 *  - Pas de cookie tiers déposé avant consentement
 *  - Stockage du choix (date, choix, IP hashée) côté serveur 13 mois
 *  - LocalStorage `gleba-cookie-consent` côté client pour ne pas
 *    réafficher le bandeau à chaque page
 */

import * as React from "react"
import { Cookie, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "gleba-cookie-consent"
const SESSION_KEY = "gleba-session-id"

interface ConsentChoice {
  essentiel: boolean
  analytics: boolean
  marketing: boolean
  personnalisation: boolean
  date: string
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

async function persistConsent(choice: Omit<ConsentChoice, "date" | "essentiel">) {
  const sessionId = getOrCreateSessionId()
  try {
    await fetch("/api/cookie-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...choice }),
    })
  } catch {
    // Silencieux : on conserve le choix local même si le serveur échoue
  }
  const stored: ConsentChoice = {
    essentiel: true,
    ...choice,
    date: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

export function CookieBanner() {
  const [open, setOpen] = React.useState(false)
  const [detail, setDetail] = React.useState(false)
  const [analytics, setAnalytics] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)
  const [perso, setPerso] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setOpen(true)
      return
    }
    try {
      const parsed: ConsentChoice = JSON.parse(raw)
      // Si > 13 mois, redemander
      const ageMs = Date.now() - new Date(parsed.date).getTime()
      if (ageMs > 395 * 24 * 60 * 60 * 1000) {
        setOpen(true)
      }
    } catch {
      setOpen(true)
    }
  }, [])

  const accepterTout = async () => {
    await persistConsent({ analytics: true, marketing: true, personnalisation: true })
    setOpen(false)
  }

  const refuserTout = async () => {
    await persistConsent({ analytics: false, marketing: false, personnalisation: false })
    setOpen(false)
  }

  const sauvegarderPerso = async () => {
    await persistConsent({ analytics, marketing, personnalisation: perso })
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Bannière cookies"
      className="fixed bottom-0 left-0 right-0 z-[100] border-t bg-white shadow-2xl"
    >
      <div className="container mx-auto px-4 py-3 max-w-4xl">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            {!detail ? (
              <p className="text-slate-700">
                Nous utilisons des cookies pour faire fonctionner le site (essentiels) et,
                avec votre accord, pour mesurer l&apos;audience et personnaliser votre expérience.
                Vous pouvez accepter, refuser ou personnaliser vos choix à tout moment.
                <a href="/confidentialite" className="underline ml-1">
                  En savoir plus
                </a>
                .
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-700 text-xs mb-2">
                  Choisissez les catégories que vous souhaitez activer. Les cookies essentiels
                  sont toujours actifs (nécessaires au fonctionnement du site).
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked disabled className="h-4 w-4" />
                  <span className="text-xs">
                    <strong>Essentiels</strong> — session, panier, sécurité. Toujours actifs.
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs">
                    <strong>Mesure d&apos;audience</strong> — statistiques de fréquentation anonymes.
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs">
                    <strong>Marketing</strong> — communication ciblée par email/réseaux.
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={perso}
                    onChange={(e) => setPerso(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs">
                    <strong>Personnalisation</strong> — préférences d&apos;affichage et contenus suggérés.
                  </span>
                </label>
              </div>
            )}
          </div>
          <button
            onClick={refuserTout}
            aria-label="Fermer (refuser tous les cookies non essentiels)"
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
          {!detail ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setDetail(true)}>
                Personnaliser
              </Button>
              <Button variant="outline" size="sm" onClick={refuserTout}>
                Tout refuser
              </Button>
              <Button size="sm" onClick={accepterTout} className="bg-emerald-600 hover:bg-emerald-700">
                Tout accepter
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setDetail(false)}>
                Retour
              </Button>
              <Button size="sm" onClick={sauvegarderPerso} className="bg-emerald-600 hover:bg-emerald-700">
                Enregistrer mes choix
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
