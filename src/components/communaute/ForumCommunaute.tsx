"use client"

import * as React from "react"
import { LienCommunaute as Link, naviguerCommunaute } from "./LienCommunaute"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MessageSquare, PushPin as Pin, Plus, Search, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { AccesSalon } from "@/components/communaute/SalonDiscussion"
import { urlConnexion } from "@/lib/auth-retour"
import { messageErreurReponse } from "@/lib/api-erreur"
import { confirmDialog } from "@/lib/global-dialog"
import type { CategorieForum, SujetForumVue, FilForumVue } from "@/lib/encyclopedie/types"

const CATEGORIES = [
  { value: "", label: "Tous les sujets", description: "Les échanges de la communauté" },
  { value: "ENTRAIDE", label: "Entraide", description: "Questions et coups de main" },
  { value: "PRATIQUES", label: "Pratiques de culture", description: "Méthodes et observations" },
  { value: "ENCYCLOPEDIE", label: "Encyclopédie", description: "Sources et fiches à enrichir" },
  { value: "GENERAL", label: "Général", description: "Faire connaissance" },
] as const

interface FilForum { sujet: FilForumVue }
interface PageForum { sujets: SujetForumVue[]; total: number; page: number; pages: number }

const FORMAT_RELATIF = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" })

function dateForum(value: string) {
  const date = new Date(value)
  const maintenant = new Date()
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const memeJour = date.getFullYear() === maintenant.getFullYear()
    && date.getMonth() === maintenant.getMonth() && date.getDate() === maintenant.getDate()
  return memeJour ? `Aujourd’hui à ${heure}` : date.toLocaleString("fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function activiteForum(value: string) {
  const secondes = (new Date(value).getTime() - Date.now()) / 1000
  if (Math.abs(secondes) < 60) return "à l’instant"
  if (Math.abs(secondes) < 3600) return FORMAT_RELATIF.format(Math.trunc(secondes / 60), "minute")
  if (Math.abs(secondes) < 86400) return FORMAT_RELATIF.format(Math.trunc(secondes / 3600), "hour")
  return FORMAT_RELATIF.format(Math.trunc(secondes / 86400), "day")
}

function DateForum({ value, relative = false }: { value: string; relative?: boolean }) {
  const absolue = new Date(value).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })
  return <time dateTime={value} title={absolue} aria-label={absolue}>{relative ? activiteForum(value) : dateForum(value)}</time>
}
function labelCategorie(value: string) { return CATEGORIES.find((categorie) => categorie.value === value)?.label || "Général" }

export function ForumCommunaute({ acces }: { acces: AccesSalon }) {
  const params = useSearchParams()
  if (acces === "chargement") return <ChargementForum />
  if (acces !== "membre") return (
    <section className="rounded-xl border border-lin bg-craie p-6 text-center sm:p-10">
      <MessageSquare className="mx-auto h-9 w-9 text-sauge" aria-hidden />
      <h2 className="mt-4 font-display text-2xl">Un espace pour échanger entre membres</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ardoise">{acces === "demo" ? "Le compte de démonstration est partagé. Utilisez un compte personnel pour lire les sujets et participer en votre nom." : "Connectez-vous avec votre compte personnel pour lire le forum, poser une question et répondre aux autres membres."}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3"><Button asChild className="min-h-11"><Link href={urlConnexion(`/communaute?${params}`)}>Connexion</Link></Button><Button asChild variant="outline" className="min-h-11"><Link href="/register">Créer un compte</Link></Button></div>
    </section>
  )
  return <ForumMembre />
}

function ForumMembre() {
  const params = useSearchParams()
  const sujetId = params.get("sujet")
  function urlForum(changes: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString())
    query.set("tab", "salon")
    for (const [key, value] of Object.entries(changes)) { if (value) query.set(key, value); else query.delete(key) }
    return `/communaute?${query}`
  }
  const revenir = () => naviguerCommunaute(urlForum({ sujet: null, pageReponses: null }))
  return sujetId ? <FilForumMembre key={sujetId} sujetId={sujetId} revenir={revenir} /> : <ListeForum urlForum={urlForum} />
}

function ListeForum({ urlForum }: { urlForum: (changes: Record<string, string | null>) => string }) {
  const params = useSearchParams()
  const [data, setData] = React.useState<PageForum | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [chargement, setChargement] = React.useState(true)
  const [reessai, setReessai] = React.useState(0)
  const [recherche, setRecherche] = React.useState(params.get("forumQ") ?? "")
  const categorie = params.get("forumCategorie") ?? ""
  const tri = params.get("forumTri") === "sans-reponse" ? "sans-reponse" : "recent"
  const page = params.get("forumPage") ?? "1"
  const q = params.get("forumQ") ?? ""

  React.useEffect(() => {
    const controller = new AbortController()
    setChargement(true)
    setErreur(null)
    setRecherche(q)
    const query = new URLSearchParams({ q, categorie, tri, page })
    fetch(`/api/communaute/forum?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(await messageErreurReponse(response)); return response.json() as Promise<PageForum> })
      .then(setData)
      .catch((error: unknown) => { if (!controller.signal.aborted) setErreur(error instanceof Error ? error.message : "Le forum n’a pas pu être chargé.") })
      .finally(() => { if (!controller.signal.aborted) setChargement(false) })
    return () => controller.abort()
  }, [q, categorie, tri, page, reessai])

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="min-w-0" aria-label="Catégories du forum">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ardoise">Les espaces d’échange</p>
        <nav className="flex flex-wrap gap-2 lg:flex-col">{CATEGORIES.map((item) => <Link key={item.value} href={urlForum({ forumCategorie: item.value || null, forumPage: null })} scroll={false} aria-current={categorie === item.value ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${categorie === item.value ? "border-sauge/30 bg-sauge-doux text-foret" : "border-transparent text-ardoise hover:border-lin hover:bg-craie"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${categorie === item.value ? "bg-sauge" : "bg-lin"}`} aria-hidden /><span><span className="block font-medium">{item.label}</span><span className="hidden text-xs leading-5 text-ardoise lg:block">{item.description}</span></span></Link>)}</nav>
        <div className="mt-5 hidden rounded-xl border border-lin bg-craie p-4 lg:block"><BookOpen className="h-5 w-5 text-sauge" aria-hidden /><p className="mt-3 text-sm font-medium">Du forum à la fiche</p><p className="mt-2 text-xs leading-6 text-ardoise">Une discussion peut faire émerger une source ou une précision utile à l’encyclopédie.</p><Link href="/communaute?tab=encyclopedie" className="mt-3 inline-flex min-h-11 items-center text-sm text-foret underline underline-offset-4">Explorer les fiches</Link></div>
      </aside>
      <section className="min-w-0 space-y-4" aria-labelledby="sujets-forum">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="sujets-forum" className="font-display text-2xl">{categorie ? labelCategorie(categorie) : "Tous les sujets"}</h2><p className="mt-1 text-sm text-ardoise">{!chargement && !erreur && data ? `${data.total} sujet${data.total > 1 ? "s" : ""}` : "Des échanges que l’on peut retrouver"}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => setReessai((n) => n + 1)}>Actualiser</Button><NouveauSujet onCreated={(id) => naviguerCommunaute(urlForum({ sujet: id, pageReponses: null }))} /></div></div>
        <form onSubmit={(event) => { event.preventDefault(); naviguerCommunaute(urlForum({ forumQ: recherche.trim() || null, forumPage: null }), "replace") }} className="flex flex-wrap gap-2 rounded-xl border border-lin bg-craie p-3">
          <label className="sr-only" htmlFor="forum-recherche">Rechercher un sujet</label><div className="relative min-w-0 flex-1 basis-44"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ardoise" aria-hidden /><Input id="forum-recherche" type="search" maxLength={80} value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher dans les sujets…" className="h-11 pl-9" /></div>
          <Button type="submit" variant="outline" className="min-h-11">Rechercher</Button>
          <label className="sr-only" htmlFor="forum-tri">Afficher les sujets</label><select id="forum-tri" value={tri} onChange={(event) => naviguerCommunaute(urlForum({ forumTri: event.target.value, forumPage: null }), "replace")} className="h-11 max-w-full rounded-md border border-input bg-background px-3 text-sm"><option value="recent">Dernières activités</option><option value="sans-reponse">Sans réponse</option></select>
        </form>
        {erreur ? <ErreurForum message={erreur} reessayer={() => setReessai((n) => n + 1)} /> : chargement ? <ChargementForum /> : data && data.sujets.length === 0 ? <div className="rounded-xl border border-dashed border-lin bg-craie p-8 text-center"><MessageSquare className="mx-auto h-8 w-8 text-sauge" aria-hidden /><h3 className="mt-4 font-display text-xl">{q || categorie || tri === "sans-reponse" ? "Aucun sujet dans cette sélection" : "La conversation peut commencer ici"}</h3><p className="mt-2 text-sm leading-6 text-ardoise">{q || categorie || tri === "sans-reponse" ? "Essayez une autre recherche ou consultez tous les sujets." : "Présentez votre question ou votre pratique dans un premier sujet."}</p>{(q || categorie || tri === "sans-reponse") && <Link href={urlForum({ forumQ: null, forumCategorie: null, forumTri: null, forumPage: null })} className="mt-3 inline-flex min-h-11 items-center text-sm text-foret underline underline-offset-4">Voir tous les sujets</Link>}</div> : data ? <>
          <div className="divide-y divide-lin overflow-hidden rounded-xl border border-lin bg-craie">{data.sujets.map((sujet) => <Link key={sujet.id} href={urlForum({ sujet: sujet.id, pageReponses: null })} scroll={false} className="group grid min-w-0 gap-3 p-4 transition-colors hover:bg-sauge-doux/40 sm:grid-cols-[minmax(0,1fr)_100px] sm:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs text-ardoise"><span className="rounded-md bg-papier px-2 py-1">{labelCategorie(sujet.categorie)}</span>{sujet.epingle && <span className="inline-flex items-center gap-1 text-foret"><Pin className="h-3.5 w-3.5" aria-hidden />Épinglé</span>}{sujet.resolu && <span className="inline-flex items-center gap-1 text-foret"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Résolu</span>}{sujet.espece && <span>{sujet.espece.nom}</span>}</div><h3 className="mt-2 break-words text-base font-semibold leading-6 text-encre group-hover:text-foret">{sujet.titre}</h3><p className="mt-2 break-words text-xs text-ardoise">{sujet.signature} · <DateForum value={sujet.createdAt} /></p></div><div className="flex items-center justify-between gap-3 text-xs text-ardoise sm:flex-col sm:items-end sm:justify-center"><span className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4" aria-hidden />{sujet.nbReponses} réponse{sujet.nbReponses > 1 ? "s" : ""}</span><span className="sm:text-right">Actif <DateForum value={sujet.derniereActiviteAt} relative /></span></div></Link>)}</div>
          {data.pages > 1 && <nav className="flex items-center justify-center gap-3" aria-label="Pagination du forum">{data.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={urlForum({ forumPage: String(data.page - 1) })} scroll={false}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden />Précédente</Link></Button> : <Button variant="outline" className="min-h-11" disabled>Précédente</Button>}<span className="text-sm text-ardoise">{data.page} / {data.pages}</span>{data.page < data.pages ? <Button asChild variant="outline" className="min-h-11"><Link href={urlForum({ forumPage: String(data.page + 1) })} scroll={false}>Suivante<ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button> : <Button variant="outline" className="min-h-11" disabled>Suivante</Button>}</nav>}
        </> : null}
      </section>
    </div>
  )
}

function NouveauSujet({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [titre, setTitre] = React.useState("")
  const [contenu, setContenu] = React.useState("")
  const [signature, setSignature] = React.useState("")
  const [categorie, setCategorie] = React.useState<CategorieForum>("GENERAL")
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [envoi, setEnvoi] = React.useState(false)
  async function soumettre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setEnvoi(true); setErreur(null)
    try {
      const response = await fetch("/api/communaute/forum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titre: titre.trim(), contenu: contenu.trim(), signature: signature.trim(), categorie }) })
      if (!response.ok) throw new Error(await messageErreurReponse(response))
      const result = await response.json() as { sujet: { id: string } }
      setOpen(false); setTitre(""); setContenu(""); onCreated(result.sujet.id)
    } catch (error) { setErreur(error instanceof Error ? error.message : "Le sujet n’a pas pu être publié.") }
    finally { setEnvoi(false) }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="min-h-11"><Plus className="mr-2 h-4 w-4" aria-hidden />Nouveau sujet</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Ouvrir un sujet</DialogTitle><DialogDescription>Une question précise et son contexte aident les autres membres à répondre. Votre signature est visible sur votre contribution.</DialogDescription></DialogHeader><form onSubmit={soumettre} className="space-y-4"><ChampSignature id="forum-signature" value={signature} onChange={setSignature} /><div><label htmlFor="forum-nouveau-titre" className="mb-1.5 block text-sm font-medium">Titre du sujet</label><Input id="forum-nouveau-titre" value={titre} onChange={(event) => setTitre(event.target.value)} required minLength={6} maxLength={160} placeholder="Une question ou une pratique à partager" className="h-11" /></div><div><label htmlFor="forum-nouvelle-categorie" className="mb-1.5 block text-sm font-medium">Catégorie</label><select id="forum-nouvelle-categorie" value={categorie} onChange={(event) => setCategorie(event.target.value as CategorieForum)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">{CATEGORIES.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label htmlFor="forum-nouveau-contenu" className="mb-1.5 block text-sm font-medium">Votre message</label><Textarea id="forum-nouveau-contenu" value={contenu} onChange={(event) => setContenu(event.target.value)} required minLength={10} maxLength={4000} rows={6} placeholder="Décrivez le contexte, ce que vous avez essayé et ce que vous souhaitez comprendre." /><p className="mt-1 text-right text-xs text-ardoise">{contenu.length} / 4 000</p></div><p className="text-xs leading-5 text-ardoise">Le forum général est réservé aux membres personnels. Les discussions rattachées à une fiche peuvent aussi être lues sur cette fiche publique.</p>{erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}<DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={envoi} className="min-h-11">{envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Publier le sujet</Button></DialogFooter></form></DialogContent></Dialog>
}

function FilForumMembre({ sujetId, revenir }: { sujetId: string; revenir: () => void }) {
  const params = useSearchParams()
  const pageReponses = params.get("pageReponses")
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [data, setData] = React.useState<FilForum | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [chargement, setChargement] = React.useState(true)
  const [contenu, setContenu] = React.useState("")
  const [signature, setSignature] = React.useState("")
  const [envoi, setEnvoi] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [reessai, setReessai] = React.useState(0)
  const recharger = () => setReessai((n) => n + 1)

  React.useEffect(() => {
    const controller = new AbortController(); setChargement(true); setErreur(null)
    fetch(`/api/communaute/forum/${encodeURIComponent(sujetId)}${pageReponses ? `?pageReponses=${encodeURIComponent(pageReponses)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(await messageErreurReponse(response)); return response.json() as Promise<FilForum> })
      .then(setData)
      .catch((error: unknown) => { if (!controller.signal.aborted) setErreur(error instanceof Error ? error.message : "La discussion n’a pas pu être chargée.") })
      .finally(() => { if (!controller.signal.aborted) setChargement(false) })
    return () => controller.abort()
  }, [sujetId, pageReponses, reessai])

  async function repondre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setEnvoi(true); setMessage(null)
    try {
      const response = await fetch(`/api/referentiel/discussions/${encodeURIComponent(sujetId)}/reponses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contenu: contenu.trim(), signature: signature.trim() }) })
      if (!response.ok) throw new Error(await messageErreurReponse(response))
      setContenu(""); setMessage("Votre réponse a été publiée.");
      if (pageReponses) { const query = new URLSearchParams(params.toString()); query.delete("pageReponses"); naviguerCommunaute(`/communaute?${query}`, "replace") }
      recharger()
    } catch (error) { setMessage(error instanceof Error ? error.message : "La réponse n’a pas pu être publiée.") }
    finally { setEnvoi(false) }
  }
  async function changerEtat(patch: { resolu?: boolean; epingle?: boolean }) {
    try {
      const response = await fetch(`/api/communaute/forum/${encodeURIComponent(sujetId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
      if (!response.ok) throw new Error(await messageErreurReponse(response))
      setMessage("Le sujet a été mis à jour."); recharger()
    } catch (error) { setMessage(error instanceof Error ? error.message : "La modification n’a pas pu être enregistrée.") }
  }
  async function retirer(reponseId?: string) {
    if (!(await confirmDialog(reponseId ? "Retirer votre réponse de cette discussion ?" : "Retirer ce sujet et ses réponses ?"))) return
    try {
      const base = `/api/referentiel/discussions/${encodeURIComponent(sujetId)}`
      const response = await fetch(reponseId ? `${base}/reponses/${encodeURIComponent(reponseId)}` : base, { method: "DELETE" })
      if (!response.ok) throw new Error(await messageErreurReponse(response))
      if (reponseId) { setMessage("La réponse a été retirée."); recharger() } else revenir()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Le retrait n’a pas pu être effectué.") }
  }

  function urlReponses(page: number) {
    const query = new URLSearchParams(params.toString())
    query.set("tab", "salon"); query.set("sujet", sujetId); query.set("pageReponses", String(page))
    return `/communaute?${query}`
  }

  return <section className="min-w-0 space-y-5"><Button variant="ghost" className="min-h-11" onClick={revenir}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden />Tous les sujets</Button>{erreur ? <ErreurForum message={erreur} reessayer={recharger} /> : chargement ? <ChargementForum /> : data ? <>
    <header className="rounded-xl border border-lin bg-craie p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2 text-xs text-ardoise"><span className="rounded-md bg-papier px-2 py-1">{labelCategorie(data.sujet.categorie)}</span>{data.sujet.epingle && <span className="inline-flex items-center gap-1"><Pin className="h-3.5 w-3.5" aria-hidden />Épinglé</span>}{data.sujet.resolu && <span className="inline-flex items-center gap-1 text-foret"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Résolu</span>}</div><h2 className="mt-3 break-words font-display text-2xl leading-tight sm:text-3xl">{data.sujet.titre}</h2><p className="mt-3 break-words text-sm text-ardoise">Ouvert par {data.sujet.signature} · <DateForum value={data.sujet.createdAt} /> · {data.sujet.nbReponses} réponse{data.sujet.nbReponses > 1 ? "s" : ""}</p>{data.sujet.espece && <Link href={`/referentiel/vegetaux/${encodeURIComponent(data.sujet.espece.id)}#communaute-fiche`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-foret underline underline-offset-4"><BookOpen className="h-4 w-4" aria-hidden />Fiche {data.sujet.espece.nom}</Link>}{(data.sujet.supprimable || isAdmin) && <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => changerEtat({ resolu: !data.sujet.resolu })}>{data.sujet.resolu ? "Rouvrir le sujet" : "Marquer comme résolu"}</Button>{isAdmin && <Button variant="outline" className="min-h-11" onClick={() => changerEtat({ epingle: !data.sujet.epingle })}>{data.sujet.epingle ? "Désépingler" : "Épingler le sujet"}</Button>}<Button variant="ghost" className="min-h-11 text-red-700" onClick={() => retirer()}><Trash2 className="mr-2 h-4 w-4" aria-hidden />Retirer le sujet</Button></div>}</header>
    <MessageForum signature={data.sujet.signature} date={data.sujet.createdAt} contenu={data.sujet.contenu} initial />
    <section aria-labelledby="reponses-forum" className="space-y-4"><h3 id="reponses-forum" className="font-display text-2xl">Les réponses</h3>{data.sujet.reponses.length ? data.sujet.reponses.map((reponse) => <MessageForum key={reponse.id} signature={reponse.signature} date={reponse.createdAt} contenu={reponse.contenu} retirer={reponse.supprimable ? () => retirer(reponse.id) : undefined} />) : <p className="rounded-xl border border-dashed border-lin p-5 text-sm text-ardoise">Ce sujet attend sa première réponse.</p>}{data.sujet.pagesReponses > 1 && <nav aria-label="Pagination des réponses" className="flex flex-wrap items-center justify-center gap-3">{data.sujet.pageReponses > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={urlReponses(data.sujet.pageReponses - 1)} scroll={false}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden />Réponses précédentes</Link></Button> : <Button variant="outline" className="min-h-11" disabled>Réponses précédentes</Button>}<span className="text-sm text-ardoise">{data.sujet.pageReponses} / {data.sujet.pagesReponses}</span>{data.sujet.pageReponses < data.sujet.pagesReponses ? <Button asChild variant="outline" className="min-h-11"><Link href={urlReponses(data.sujet.pageReponses + 1)} scroll={false}>Réponses suivantes<ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button> : <Button variant="outline" className="min-h-11" disabled>Réponses suivantes</Button>}</nav>}</section>
    <form onSubmit={repondre} className="rounded-xl border border-lin bg-craie p-5 sm:p-6"><h3 className="font-display text-2xl">Participer à la discussion</h3><div className="mt-4 space-y-4"><ChampSignature id="forum-reponse-signature" value={signature} onChange={setSignature} /><div><label htmlFor="forum-reponse-contenu" className="mb-1.5 block text-sm font-medium">Votre réponse</label><Textarea id="forum-reponse-contenu" value={contenu} onChange={(event) => setContenu(event.target.value)} required minLength={3} maxLength={4000} rows={5} placeholder="Un retour, une question ou une source pour faire avancer l’échange…" /><p className="mt-1 text-right text-xs text-ardoise">{contenu.length} / 4 000</p></div><p className="text-xs leading-5 text-ardoise">Votre signature et ce message seront visibles avec ce sujet{data.sujet.espece ? ", y compris sur la fiche publique associée" : " pour les membres connectés"}.</p><Button type="submit" disabled={envoi || !contenu.trim() || !signature.trim()} className="min-h-11">{envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-2 h-4 w-4" aria-hidden />}Publier ma réponse</Button></div></form>
  </> : null}{message && <p role="status" className="rounded-lg border border-lin bg-craie p-4 text-sm">{message}</p>}</section>
}

function ChampSignature({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">Nom public ou pseudonyme</label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} required minLength={2} maxLength={80} placeholder="Le nom affiché avec votre contribution" className="h-11" /><p className="mt-1.5 text-xs leading-5 text-ardoise">Choisissez votre signature. Votre adresse e-mail n’est jamais affichée.</p></div>
}
function MessageForum({ signature, date, contenu, initial, retirer }: { signature: string; date: string; contenu: string; initial?: boolean; retirer?: () => void }) {
  return <article className={`min-w-0 rounded-xl border p-5 sm:p-6 ${initial ? "border-sauge/30 bg-sauge-doux/40" : "border-lin bg-craie"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sauge-doux text-sm font-semibold text-foret" aria-hidden>{signature.slice(0, 1).toLocaleUpperCase("fr-FR")}</span><div className="min-w-0"><p className="break-words text-sm font-semibold">{signature}</p><p className="text-xs text-ardoise"><DateForum value={date} />{initial ? " · Message d’ouverture" : ""}</p></div></div>{retirer && <Button variant="ghost" className="min-h-11 text-xs text-red-700" onClick={retirer}><Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />Retirer</Button>}</div><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-encre">{contenu}</p></article>
}
function ChargementForum() { return <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-ardoise"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Chargement des échanges…</div> }
function ErreurForum({ message, reessayer }: { message: string; reessayer: () => void }) { return <div role="alert" className="rounded-xl border border-lin bg-craie p-6"><p className="text-sm">{message}</p><Button variant="outline" className="mt-3 min-h-11" onClick={reessayer}>Réessayer</Button></div> }
