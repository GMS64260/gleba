"use client"

/**
 * Aperçu d'un document dans la fenêtre — livré le 2026-08-19.
 *
 * Tous les documents PDF de Gleba (factures, registres réglementaires,
 * étiquettes, dossiers de campagne, carnets) partaient en téléchargement natif.
 * Conséquences : l'onglet ouvert par « Voir le PDF » se refermait aussitôt,
 * personne ne pouvait vérifier un registre avant de l'archiver, et un agent de
 * test qui explore Gleba au navigateur perdait la main dès qu'un document était
 * produit — le fichier quitte la page, il n'y a plus rien à inspecter.
 *
 * Cet écran charge le document, l'affiche, et laisse le téléchargement à un
 * clic. Deux choix techniques à connaître :
 *
 * 1. Le document est récupéré en `fetch` puis affiché depuis une URL `blob:`.
 *    Caddy envoie `X-Frame-Options: DENY` sur tout gleba.fr, ce qui interdit
 *    d'encadrer une réponse de l'API — même en même origine. Une URL `blob:`
 *    n'a pas d'en-têtes HTTP : elle s'affiche sans toucher à la configuration
 *    du serveur, et sans affaiblir la protection anti-encadrement du site.
 * 2. Charger le document ici plutôt que de le laisser au cadre permet d'afficher
 *    l'erreur en clair — session expirée, document introuvable — au lieu d'un
 *    JSON brut rendu comme du texte. Le bouton « Télécharger » repasse par
 *    l'API avec `?telecharger=1` : une génération de plus, mais le fichier
 *    porte le nom décidé par le serveur et le bouton reste fonctionnel même si
 *    l'aperçu a échoué.
 */

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Download, ExternalLink, FileText, Loader2 } from "lucide-react"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import { Button } from "@/components/ui/button"
import { cheminDocumentValide, urlTelechargement } from "@/lib/apercu-document"

type Etat =
  | { statut: "chargement" }
  | { statut: "pret"; url: string; typeMime: string; octets: number }
  | { statut: "erreur"; message: string }

const TAILLES = ["o", "Ko", "Mo"]

function tailleLisible(octets: number): string {
  let valeur = octets
  let unite = 0
  while (valeur >= 1024 && unite < TAILLES.length - 1) {
    valeur /= 1024
    unite += 1
  }
  return `${valeur.toFixed(unite === 0 ? 0 : 1)} ${TAILLES[unite]}`
}

export default function ApercuDocumentPage() {
  // `useSearchParams` exige une frontière Suspense pour le prérendu (même
  // motif que /verger, /elevage, /jardin).
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ouverture du document…
        </div>
      }
    >
      <ApercuDocument />
    </React.Suspense>
  )
}

function ApercuDocument() {
  const searchParams = useSearchParams()
  const src = searchParams.get("src")
  const titre = searchParams.get("titre") || "Document"
  const [etat, setEtat] = React.useState<Etat>({ statut: "chargement" })

  React.useEffect(() => {
    if (!cheminDocumentValide(src)) {
      setEtat({
        statut: "erreur",
        message:
          "Ce lien d'aperçu ne désigne pas un document de Gleba. Revenez à l'écran d'origine et relancez l'aperçu depuis son bouton.",
      })
      return
    }

    let annule = false
    let urlBlob: string | null = null

    ;(async () => {
      setEtat({ statut: "chargement" })
      try {
        const reponse = await fetch(src, { credentials: "include" })
        if (!reponse.ok) {
          // Le corps d'erreur de l'API est du JSON : on l'affiche en clair.
          let detail = ""
          try {
            const payload = await reponse.json()
            detail = typeof payload?.error === "string" ? payload.error : ""
          } catch {
            /* réponse sans JSON exploitable */
          }
          const message =
            reponse.status === 401
              ? "Session expirée — reconnectez-vous, puis relancez l'aperçu."
              : reponse.status === 404
                ? "Document introuvable."
                : detail || `Le document n'a pas pu être produit (erreur ${reponse.status}).`
          if (!annule) setEtat({ statut: "erreur", message })
          return
        }
        const blob = await reponse.blob()
        if (annule) return
        urlBlob = URL.createObjectURL(blob)
        setEtat({
          statut: "pret",
          url: urlBlob,
          typeMime: blob.type || "application/octet-stream",
          octets: blob.size,
        })
      } catch {
        if (!annule) {
          setEtat({
            statut: "erreur",
            message: "Le document n'a pas pu être chargé (réseau indisponible).",
          })
        }
      }
    })()

    return () => {
      annule = true
      if (urlBlob) URL.revokeObjectURL(urlBlob)
    }
  }, [src])

  const estPdf = etat.statut === "pret" && etat.typeMime.includes("pdf")

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppHeader />
      <PageToolbar>
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-5 w-5 flex-shrink-0 text-slate-500" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">{titre}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {etat.statut === "pret"
                ? `Aperçu — ${tailleLisible(etat.octets)}${estPdf ? " · PDF" : ""}`
                : etat.statut === "chargement"
                  ? "Préparation du document…"
                  : "Document non disponible"}
              {/* Le chemin du document, en clair : il dit QUEL document est à
                  l'écran, se copie, et se relit dans un journal de test. */}
              {src ? <span className="ml-1 font-mono">· {src}</span> : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour
          </Button>
          {cheminDocumentValide(src) && (
            <>
              <Button asChild variant="outline" size="sm">
                {/* Ouvre le document seul, servi `inline` par l'API : utile pour
                    l'imprimer ou le partager par son URL. */}
                <a href={src} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Ouvrir seul
                </a>
              </Button>
              <Button asChild size="sm">
                <a href={urlTelechargement(src)}>
                  <Download className="mr-1 h-4 w-4" />
                  Télécharger
                </a>
              </Button>
            </>
          )}
        </div>
      </PageToolbar>

      <main className="flex flex-1 flex-col p-2 sm:p-4">
        {etat.statut === "chargement" && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Génération du document…
          </div>
        )}

        {etat.statut === "erreur" && (
          <div className="mx-auto mt-8 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Aperçu impossible</p>
            <p className="mt-1">{etat.message}</p>
            <Link href="/" className="mt-3 inline-block text-amber-900 underline">
              Retour à l&apos;accueil
            </Link>
          </div>
        )}

        {etat.statut === "pret" && (
          <>
            <iframe
              src={estPdf ? `${etat.url}#view=FitH` : etat.url}
              title={titre}
              className="min-h-[70vh] w-full flex-1 rounded-lg border bg-white"
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Aperçu vide ? Certains navigateurs mobiles n&apos;affichent pas les PDF dans la page :
              utilisez « Ouvrir seul » ou « Télécharger ».
            </p>
          </>
        )}
      </main>
    </div>
  )
}
