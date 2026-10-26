"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/lib/global-dialog"
import type { DiscussionEncyclopedieVue } from "@/lib/encyclopedie/types"

interface Props {
  especeId: string
  discussions: DiscussionEncyclopedieVue[]
  peutPublier: boolean
  invitation: React.ReactNode
  onReload: () => Promise<unknown>
}

const CHAMP = "mt-1 min-h-11 w-full rounded-lg border border-lin bg-white px-3 py-2 text-sm text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
const date = (valeur: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valeur))

export function FicheDiscussions({ especeId, discussions, peutPublier, invitation, onReload }: Props) {
  const uid = React.useId()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [compose, setCompose] = React.useState(false)
  const [titre, setTitre] = React.useState("")
  const [contenu, setContenu] = React.useState("")
  const [reponse, setReponse] = React.useState("")
  const [signature, setSignature] = React.useState("")
  const [consent, setConsent] = React.useState(false)
  const [consentReponse, setConsentReponse] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const selected = discussions.find(d => d.id === selectedId) ?? null

  async function requete(url: string, method: string, body?: object) {
    const response = await fetch(url, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) })
    const result = await response.json().catch(() => ({})) as { error?: unknown; discussion?: { id?: unknown } }
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "L’échange n’a pas pu être enregistré. Réessayez.")
    return result
  }

  async function creer(event: React.FormEvent) {
    event.preventDefault()
    if (!peutPublier || !consent) return
    setBusy("creation"); setError(null); setMessage(null)
    try {
      const result = await requete(`/api/referentiel/vegetaux/${encodeURIComponent(especeId)}/discussions`, "POST", { titre: titre.trim(), contenu: contenu.trim(), signature: signature.trim() })
      await onReload()
      setCompose(false); setTitre(""); setContenu(""); setConsent(false)
      if (typeof result.discussion?.id === "string") setSelectedId(result.discussion.id)
      setMessage("Votre discussion est publiée sur cette fiche.")
    } catch (e) { setError(e instanceof Error ? e.message : "Création impossible.") }
    finally { setBusy(null) }
  }

  async function repondre(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !peutPublier || !consentReponse) return
    setBusy("reponse"); setError(null); setMessage(null)
    try {
      await requete(`/api/referentiel/discussions/${encodeURIComponent(selected.id)}/reponses`, "POST", { contenu: reponse.trim(), signature: signature.trim() })
      await onReload(); setReponse(""); setConsentReponse(false); setMessage("Votre réponse est publiée.")
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible.") }
    finally { setBusy(null) }
  }

  async function retirer(discussionId: string, reponseId?: string) {
    if (!(await confirmDialog(reponseId ? "Retirer cette réponse ?" : "Retirer cette discussion et ses réponses ?"))) return
    setBusy(reponseId ?? discussionId); setError(null); setMessage(null)
    try {
      const base = `/api/referentiel/discussions/${encodeURIComponent(discussionId)}`
      await requete(reponseId ? `${base}/reponses/${encodeURIComponent(reponseId)}` : base, "DELETE")
      if (!reponseId) setSelectedId(null)
      await onReload(); setMessage(reponseId ? "La réponse a été retirée." : "La discussion a été retirée.")
    } catch (e) { setError(e instanceof Error ? e.message : "Retrait impossible.") }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl"><h3 className="font-display text-2xl text-foret">Discuter de cette fiche</h3><p className="mt-2 text-sm leading-6 text-ardoise">Questions, sources à confronter et passages à clarifier. Ces échanges sont publics ; les améliorations de l’article passent ensuite par une proposition relue.</p></div>
        {peutPublier && <Button className="min-h-11" onClick={() => { setSelectedId(null); setCompose(true); setError(null); setMessage(null) }}><Plus className="mr-2 h-4 w-4" />Ouvrir un sujet</Button>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-sauge-doux p-3 text-sm text-foret">{message}</p>}
      {!peutPublier && invitation}
      {compose && peutPublier && (
        <form className="space-y-4 rounded-xl border border-lin bg-white p-4 sm:p-6" onSubmit={creer}>
          <h4 className="font-semibold text-foret">Nouveau sujet</h4>
          <label className="block text-sm font-medium" htmlFor={`${uid}-titre`}>Titre du sujet<input autoFocus id={`${uid}-titre`} required minLength={6} maxLength={180} className={CHAMP} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Une question précise ou un point à clarifier" /></label>
          <label className="block text-sm font-medium" htmlFor={`${uid}-message`}>Votre message<textarea id={`${uid}-message`} required minLength={3} maxLength={4000} rows={5} className={CHAMP} value={contenu} onChange={e => setContenu(e.target.value)} /></label>
          <label className="block text-sm font-medium" htmlFor={`${uid}-signature`}>Votre signature publique<input id={`${uid}-signature`} required minLength={2} maxLength={80} className={CHAMP} autoComplete="off" value={signature} onChange={e => setSignature(e.target.value)} placeholder="Votre nom ou un pseudonyme choisi" /></label>
          <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input required type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Je comprends que ce message et cette signature seront visibles publiquement sur la fiche.</span></label>
          <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setCompose(false)}>Annuler</Button><Button className="min-h-11" type="submit" disabled={busy !== null}>{busy === "creation" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publier le sujet</Button></div>
        </form>
      )}
      {selected ? (
        <div className="space-y-4">
          <Button variant="ghost" className="min-h-11" onClick={() => { setSelectedId(null); setReponse(""); setError(null); setMessage(null) }}>← Toutes les discussions</Button>
          <article className="rounded-xl border border-lin bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-display text-2xl text-foret">{selected.titre}</h4><p className="mt-2 text-xs text-ardoise">{selected.signature} · {date(selected.createdAt)}</p></div>{selected.supprimable && <Button variant="ghost" size="sm" className="min-h-11" disabled={busy !== null} onClick={() => retirer(selected.id)}><Trash2 className="mr-2 h-4 w-4" />Retirer le sujet</Button>}</div>
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-encre">{selected.contenu}</p>
          </article>
          <h4 className="text-sm font-semibold text-foret">{selected.nbReponses} réponse{selected.nbReponses > 1 ? "s" : ""}</h4>
          {selected.nbReponses > selected.reponses.length && <p className="rounded-lg bg-papier p-3 text-sm leading-6 text-ardoise">Les {selected.reponses.length} dernières réponses sont affichées. <Link href={`/communaute?tab=salon&sujet=${encodeURIComponent(selected.id)}`} className="font-medium text-foret underline">Ouvrir le fil complet dans le forum</Link>.</p>}
          {selected.reponses.map(r => <article key={r.id} className="rounded-xl border border-lin bg-craie p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words text-xs text-ardoise"><span className="font-semibold text-foret">{r.signature}</span> · {date(r.createdAt)}</p>{r.supprimable && <Button variant="ghost" size="sm" className="min-h-11" disabled={busy !== null} onClick={() => retirer(selected.id, r.id)}><Trash2 className="mr-2 h-4 w-4" />Retirer ma réponse</Button>}</div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{r.contenu}</p></article>)}
          {peutPublier && <form className="space-y-4 rounded-xl border border-lin bg-white p-4 sm:p-6" onSubmit={repondre}><h4 className="font-semibold text-foret">Apporter une réponse</h4><label className="block text-sm font-medium" htmlFor={`${uid}-reponse`}>Votre réponse<textarea id={`${uid}-reponse`} required minLength={2} maxLength={4000} rows={4} className={CHAMP} value={reponse} onChange={e => setReponse(e.target.value)} /></label><label className="block text-sm font-medium" htmlFor={`${uid}-signature-reponse`}>Votre signature publique<input id={`${uid}-signature-reponse`} required minLength={2} maxLength={80} className={CHAMP} autoComplete="off" value={signature} onChange={e => setSignature(e.target.value)} /></label><label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input required type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={consentReponse} onChange={e => setConsentReponse(e.target.checked)} /><span>Je comprends que cette réponse et cette signature seront publiées sur la fiche.</span></label><div className="flex justify-end"><Button type="submit" className="min-h-11" disabled={busy !== null}>{busy === "reponse" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publier ma réponse</Button></div></form>}
        </div>
      ) : discussions.length > 0 ? (
        <div className="divide-y divide-lin overflow-hidden rounded-xl border border-lin bg-white">{discussions.map(d => <article key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><h4 className="break-words font-medium text-foret">{d.titre}</h4><p className="mt-1 text-xs text-ardoise">{d.signature} · {date(d.createdAt)} · {d.nbReponses} réponse{d.nbReponses > 1 ? "s" : ""}</p><p className="mt-2 line-clamp-2 break-words text-sm text-ardoise">{d.contenu}</p></div><Button variant="outline" className="min-h-11 shrink-0" onClick={() => { setSelectedId(d.id); setCompose(false); setError(null); setMessage(null) }} aria-label={`Lire la discussion : ${d.titre}`}>Lire la discussion</Button></article>)}</div>
      ) : !compose && (
        <div className="rounded-xl border border-dashed border-lin bg-papier/50 p-6 text-sm text-ardoise"><MessageSquare className="mb-3 h-6 w-6 text-sauge" /><p>Aucune discussion n’est encore ouverte pour cette fiche. Une question précise ou une source à examiner peut lancer l’échange.</p></div>
      )}
      {discussions.length >= 30 && !selected && <p className="text-xs text-ardoise">Les trente discussions les plus récentes de cette fiche sont affichées.</p>}
      <p className="border-t border-lin pt-4 text-sm text-ardoise">Pour les échanges du quotidien, retrouvez aussi <Link href="/communaute?tab=salon" className="font-medium text-foret underline underline-offset-2">le salon de Gleba</Link>.</p>
    </div>
  )
}
