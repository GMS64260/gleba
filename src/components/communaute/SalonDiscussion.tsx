"use client"

/**
 * Salon de discussion de la page Communauté.
 *
 * Réservé aux comptes personnels connectés : l'anonyme et le compte de
 * démonstration voient une invitation, jamais le fil (la route les refuse de
 * toute façon). Le fil se rafraîchit par interrogation tant que l'onglet est
 * affiché et la page visible (cf. `src/lib/communaute/salon.ts`).
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { messageErreurReponse } from "@/lib/api-erreur"
import { MESSAGES_REFUS_DEMO } from "@/lib/demo"
import { LONGUEUR_MAX_MESSAGE_SALON } from "@/lib/validations/salon"
import {
  ajouterPageAncienneSalon,
  cleJourSalon,
  fusionnerFenetreSalon,
  INTERVALLE_SALON_MS,
  libelleJourSalon,
  type MessageSalonVue,
  type PageSalon,
} from "@/lib/communaute/salon"
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react"

export type AccesSalon = "chargement" | "anonyme" | "demo" | "membre"

/** Distance au bas du fil sous laquelle on suit les nouveaux messages. */
const SEUIL_BAS_PX = 80

export function SalonDiscussion({ acces }: { acces: AccesSalon }) {
  if (acces === "chargement") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (acces === "anonyme") {
    return (
      <InvitationSalon texte="Le salon de discussion est réservé aux membres connectés de Gleba. Connectez-vous ou créez un compte gratuit pour échanger avec les autres maraîchers, arboriculteurs et éleveurs.">
        <Link href="/login?callbackUrl=/communaute">
          <Button className="bg-violet-600 hover:bg-violet-700">Connexion</Button>
        </Link>
        <Link href="/register">
          <Button variant="outline">Créer un compte</Button>
        </Link>
      </InvitationSalon>
    )
  }
  if (acces === "demo") {
    return <InvitationSalon texte={MESSAGES_REFUS_DEMO.salon} />
  }
  return <FilSalon />
}

function InvitationSalon({ texte, children }: { texte: string; children?: React.ReactNode }) {
  return (
    <Card className="border-violet-200">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <MessageSquare className="h-10 w-10 text-violet-400" />
        <p className="max-w-xl text-sm text-muted-foreground" role="note">
          {texte}
        </p>
        {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
      </CardContent>
    </Card>
  )
}

function FilSalon() {
  const { toast } = useToast()
  const [messages, setMessages] = React.useState<MessageSalonVue[]>([])
  const [chargement, setChargement] = React.useState(true)
  const [anciensRestants, setAnciensRestants] = React.useState(false)
  const [chargementAnciens, setChargementAnciens] = React.useState(false)
  const [horsLigne, setHorsLigne] = React.useState(false)
  const [refus, setRefus] = React.useState<string | null>(null)
  const [brouillon, setBrouillon] = React.useState("")
  const [envoi, setEnvoi] = React.useState(false)

  const filRef = React.useRef<HTMLDivElement>(null)
  // Des pages d'historique ont été chargées : la fenêtre ne remplace plus le fil.
  const historiqueEtendu = React.useRef(false)
  // Toute écriture locale (envoi, retrait) incrémente la génération : une
  // interrogation partie AVANT ne doit pas écraser le fil avec un état périmé.
  const generation = React.useRef(0)
  const enCours = React.useRef(false)
  // Ajustement de défilement à appliquer après le rendu.
  const defilement = React.useRef<{ type: "bas" } | { type: "conserver"; hauteur: number } | null>(null)

  const estEnBas = () => {
    const el = filRef.current
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_BAS_PX
  }

  const rafraichir = React.useCallback(async () => {
    if (enCours.current) return
    enCours.current = true
    const depart = generation.current
    try {
      const res = await fetch("/api/communaute/salon", { cache: "no-store" })
      if (res.status === 401) {
        setRefus("Votre session a expiré : reconnectez-vous pour retrouver le salon.")
        return
      }
      if (res.status === 403) {
        setRefus(await messageErreurReponse(res))
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const page = (await res.json()) as PageSalon
      setHorsLigne(false)
      if (depart !== generation.current) return
      if (estEnBas()) defilement.current = { type: "bas" }
      if (!page.plusAnciens) historiqueEtendu.current = false
      setMessages((prev) => (historiqueEtendu.current ? fusionnerFenetreSalon(prev, page) : page.messages))
      if (!historiqueEtendu.current) setAnciensRestants(page.plusAnciens)
    } catch {
      setHorsLigne(true)
    } finally {
      enCours.current = false
      setChargement(false)
    }
  }, [])

  // Interrogation : seulement page visible ; reprise immédiate au retour.
  React.useEffect(() => {
    if (refus) return
    let arrete = false
    let minuteur: ReturnType<typeof setTimeout> | undefined
    const tour = async () => {
      if (document.visibilityState === "visible") await rafraichir()
      if (!arrete) minuteur = setTimeout(tour, INTERVALLE_SALON_MS)
    }
    void tour()
    const auRetour = () => {
      if (document.visibilityState === "visible") void rafraichir()
    }
    document.addEventListener("visibilitychange", auRetour)
    return () => {
      arrete = true
      clearTimeout(minuteur)
      document.removeEventListener("visibilitychange", auRetour)
    }
  }, [rafraichir, refus])

  React.useLayoutEffect(() => {
    const el = filRef.current
    const action = defilement.current
    if (!el || !action) return
    defilement.current = null
    if (action.type === "bas") el.scrollTop = el.scrollHeight
    else el.scrollTop += el.scrollHeight - action.hauteur
  }, [messages])

  const chargerAnciens = async () => {
    const premier = messages[0]
    if (!premier) return
    setChargementAnciens(true)
    try {
      const query = new URLSearchParams({ avantLe: premier.createdAt, avantId: premier.id })
      const res = await fetch(`/api/communaute/salon?${query}`, { cache: "no-store" })
      if (!res.ok) throw new Error(await messageErreurReponse(res))
      const page = (await res.json()) as PageSalon
      historiqueEtendu.current = true
      defilement.current = { type: "conserver", hauteur: filRef.current?.scrollHeight ?? 0 }
      setMessages((prev) => ajouterPageAncienneSalon(prev, page.messages))
      setAnciensRestants(page.plusAnciens)
    } catch (e) {
      toast({
        title: "Historique indisponible",
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
        variant: "destructive",
      })
    } finally {
      setChargementAnciens(false)
    }
  }

  const envoyer = async () => {
    const contenu = brouillon.trim()
    if (!contenu || envoi) return
    setEnvoi(true)
    try {
      const res = await fetch("/api/communaute/salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu }),
      })
      if (!res.ok) {
        toast({ title: "Message non envoyé", description: await messageErreurReponse(res), variant: "destructive" })
        return
      }
      const { message } = (await res.json()) as { message: MessageSalonVue }
      generation.current++
      defilement.current = { type: "bas" }
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      setBrouillon("")
    } catch {
      toast({ title: "Message non envoyé", description: "Connexion impossible, réessayez.", variant: "destructive" })
    } finally {
      setEnvoi(false)
    }
  }

  const retirer = async (message: MessageSalonVue) => {
    const question = message.auteur.estMoi
      ? "Supprimer votre message ? Il disparaîtra pour tous les membres."
      : `Retirer le message de ${message.auteur.nom} ? Il disparaîtra pour tous les membres.`
    if (!(await confirmDialog(question))) return
    try {
      const res = await fetch(`/api/communaute/salon/${message.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await messageErreurReponse(res))
      generation.current++
      setMessages((prev) => prev.filter((m) => m.id !== message.id))
    } catch (e) {
      toast({
        title: "Suppression impossible",
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
        variant: "destructive",
      })
    }
  }

  if (refus) return <InvitationSalon texte={refus} />

  const reste = LONGUEUR_MAX_MESSAGE_SALON - brouillon.length

  return (
    <Card className="border-violet-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-violet-800">
          <MessageSquare className="h-5 w-5 text-violet-600" />
          Salon de discussion
        </CardTitle>
        <CardDescription>
          Visible par tous les membres connectés de Gleba. Restez courtois et ne publiez pas de
          coordonnées personnelles ; l&apos;équipe peut retirer un message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {horsLigne && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
            Connexion au salon perdue, nouvel essai automatique…
          </p>
        )}

        <div
          ref={filRef}
          // Hauteur = écran moins l'en-tête de page, l'encart Community Voice, les
          // onglets et la zone de saisie : à 1280×900, on écrit sans faire défiler.
          className="h-[calc(100dvh-36rem)] min-h-[220px] overflow-y-auto rounded-lg border bg-white px-3 py-2"
          role="log"
          aria-label="Messages du salon"
        >
          {chargement ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Aucun message pour l&apos;instant. Lancez la conversation !
            </p>
          ) : (
            <>
              {anciensRestants && (
                <div className="flex justify-center py-2">
                  <Button variant="ghost" size="sm" onClick={chargerAnciens} disabled={chargementAnciens}>
                    {chargementAnciens && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Messages précédents
                  </Button>
                </div>
              )}
              <ol className="space-y-1">
                {messages.map((m, i) => {
                  const date = new Date(m.createdAt)
                  const nouveauJour = i === 0 || cleJourSalon(new Date(messages[i - 1].createdAt)) !== cleJourSalon(date)
                  return (
                    <li key={m.id}>
                      {nouveauJour && (
                        <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                          <span className="h-px flex-1 bg-slate-200" />
                          <span className="inline-block first-letter:uppercase">{libelleJourSalon(date)}</span>
                          <span className="h-px flex-1 bg-slate-200" />
                        </div>
                      )}
                      <MessageSalon message={m} date={date} onRetirer={retirer} />
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void envoyer()
          }}
        >
          <Textarea
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            onKeyDown={(e) => {
              // Entrée envoie, Maj+Entrée va à la ligne ; jamais pendant une
              // composition (accents saisis par une méthode d'entrée).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void envoyer()
              }
            }}
            placeholder="Écrire un message…"
            aria-label="Votre message"
            rows={2}
            maxLength={LONGUEUR_MAX_MESSAGE_SALON}
            className="resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {reste < 200 ? `${reste} caractères restants` : "Entrée pour envoyer, Maj+Entrée pour aller à la ligne"}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={envoi || !brouillon.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Envoyer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function MessageSalon({
  message,
  date,
  onRetirer,
}: {
  message: MessageSalonVue
  date: Date
  onRetirer: (message: MessageSalonVue) => void
}) {
  return (
    <div
      className={`rounded-md px-2 py-1.5 ${message.auteur.estMoi ? "bg-violet-50" : "hover:bg-slate-50"}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold text-slate-800">
          {message.auteur.estMoi ? "Vous" : message.auteur.nom}
        </span>
        {message.auteur.equipe && (
          <Badge variant="outline" className="border-violet-300 bg-violet-50 px-1.5 py-0 text-[10px] text-violet-700">
            Équipe Gleba
          </Badge>
        )}
        <time
          className="text-xs text-muted-foreground"
          dateTime={message.createdAt}
          title={date.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
        >
          {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </time>
        {message.supprimable && (
          <button
            type="button"
            onClick={() => onRetirer(message)}
            className="ml-auto rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600"
            aria-label={message.auteur.estMoi ? "Supprimer mon message" : `Retirer le message de ${message.auteur.nom}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{message.contenu}</p>
    </div>
  )
}
