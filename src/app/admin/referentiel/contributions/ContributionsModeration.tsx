"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ComparaisonCorrection } from "@/components/encyclopedie/ComparaisonCorrection"
import { urlCorrection } from "@/components/encyclopedie/correction-liens"
import { messageErreurReponse } from "@/lib/api-erreur"
import { TITRES_SECTIONS, type ContributionModerationVue } from "@/lib/encyclopedie/types"

type Decision = "PUBLIER" | "A_REPRENDRE" | "REFUSER"

export function ContributionsModeration() {
  const [items, setItems] = React.useState<ContributionModerationVue[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [refresh, setRefresh] = React.useState(0)
  const [notice, setNotice] = React.useState<string | null>(null)
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch("/api/admin/referentiel/contributions", { cache: "no-store", signal: controller.signal })
        if (!response.ok) throw new Error(await messageErreurReponse(response))
        const data: { contributions: ContributionModerationVue[] } = await response.json()
        if (!controller.signal.aborted) setItems(data.contributions)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "La file de relecture n’est pas disponible.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [refresh])
  return (
    <div className="mt-7 space-y-5">
      <Button variant="outline" disabled={loading} onClick={() => setRefresh(v => v + 1)}>Actualiser la file</Button>
      {loading && <p role="status" className="text-sm text-ardoise">Chargement de la file de relecture…</p>}
      {notice && <p role="status" className="rounded-lg bg-sauge-doux p-3 text-sm text-foret">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="rounded-xl border border-lin bg-craie p-6 text-sm text-ardoise">Aucune proposition en attente de relecture.</p>}
      {items.map(item => <Proposition key={item.id} item={item} onDecision={message => { setItems(values => values.filter(value => value.id !== item.id)); setNotice(message) }} onConflict={() => setRefresh(v => v + 1)} />)}
    </div>
  )
}

function Proposition({ item, onDecision, onConflict }: { item: ContributionModerationVue; onDecision: (message: string) => void; onConflict: () => void }) {
  const [motif, setMotif] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const obsolete = item.revisionBaseId !== item.revisionActuelleId || Boolean(item.correctionObsolete)
  const lienFiche = item.correction ? urlCorrection(item.espece.id, item.correction.cibleType, item.correction.refId) : `/referentiel/vegetaux/${encodeURIComponent(item.espece.id)}#communaute-fiche`
  async function decide(decision: Decision) {
    if (motif.trim().length < 3) { setError("Expliquez la décision avant de l’enregistrer."); return }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/referentiel/contributions/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, motif: motif.trim() }) })
      if (!response.ok) {
        const message = await messageErreurReponse(response)
        if (response.status === 409) onConflict()
        throw new Error(message)
      }
      onDecision(decision === "PUBLIER" ? "La contribution est publiée et sa version est consultable dans la fiche." : "La décision et son motif sont visibles par le contributeur.")
    } catch (e) { setError(e instanceof Error ? e.message : "La décision n’a pas pu être enregistrée.") }
    finally { setBusy(false) }
  }
  return (
    <article className="rounded-xl border border-lin bg-craie p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-foret">{item.espece.nom} · {item.correction?.titre ?? TITRES_SECTIONS[item.section]}</h2>
        <Link href={lienFiche} className="inline-flex min-h-11 items-center text-sm text-foret hover:underline">Consulter la fiche →</Link>
      </div>
      <p className="mt-2 text-xs text-ardoise">Proposé par {item.signature} · {new Date(item.createdAt).toLocaleDateString("fr-FR")} · {item.licence}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm text-encre"><strong>Motif : </strong>{item.motif}</p>
      {obsolete && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Cet élément a changé depuis cette proposition. Demandez une reprise pour que le contributeur travaille à partir de la dernière version.</p>}
      {item.correction ? <div className="mt-5 space-y-3"><ComparaisonCorrection detail={item.correction} actuelles={obsolete ? item.cibleActuelle?.valeurs : undefined} /><p className="text-xs leading-5 text-ardoise">La correction relue sera affichée auprès de cet élément, avec sa source et son historique.</p></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-lin bg-papier p-4"><h3 className="text-sm font-semibold">Passage actuellement publié</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm text-ardoise">{item.contenuActuel || "Aucun passage documentaire publié dans cette section."}</p></div>
        <div className="rounded-lg border border-sauge/30 bg-sauge-doux/40 p-4"><h3 className="text-sm font-semibold">Passage proposé</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm text-encre">{item.contenu}</p></div>
      </div>}
      <p className="mt-4 whitespace-pre-wrap break-words text-sm text-ardoise"><strong>Source à vérifier : </strong>{item.source}</p>
      <label htmlFor={`decision-${item.id}`} className="mt-5 block text-sm font-medium">Retour au contributeur</label>
      <Textarea id={`decision-${item.id}`} value={motif} onChange={e => setMotif(e.target.value)} maxLength={1000} className="mt-2" placeholder="Ce qui a été vérifié, ce qui manque ou pourquoi la proposition n’est pas retenue…" />
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy || obsolete} onClick={() => void decide("PUBLIER")}>{item.correction ? "Publier la correction" : "Publier la contribution"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => void decide("A_REPRENDRE")}>Demander une reprise</Button>
        <Button variant="ghost" disabled={busy} onClick={() => void decide("REFUSER")}>Ne pas retenir</Button>
      </div>
    </article>
  )
}
