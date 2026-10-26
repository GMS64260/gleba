"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ReferenceSource } from "@/components/encyclopedie/ReferenceSource"
import { SECTIONS_ENCYCLOPEDIE, TITRES_SECTIONS, type CommunauteVegetalVue, type SectionEncyclopedie, type SectionEncyclopedieVue } from "@/lib/encyclopedie/types"

export interface BrouillonContribution {
  section: SectionEncyclopedie
  contenu: string
  source: string
  contenuBase: string
  revisionBaseId: string | null
}

interface Props {
  especeId: string
  nom: string
  open: boolean
  initial: BrouillonContribution | null
  sections: SectionEncyclopedieVue[]
  onOpenChange: (open: boolean) => void
  onReload: () => Promise<CommunauteVegetalVue | null>
}

async function messageErreur(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof payload?.error === "string" ? payload.error : "La proposition n’a pas pu être enregistrée. Réessayez."
}

const CHAMP = "mt-1 min-h-11 w-full rounded-lg border border-lin bg-white px-3 py-2 text-sm text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

export function FormContribution({ especeId, nom, open, initial, sections, onOpenChange, onReload }: Props) {
  const uid = React.useId()
  const [section, setSection] = React.useState<SectionEncyclopedie>("presentation")
  const [contenu, setContenu] = React.useState("")
  const [source, setSource] = React.useState("")
  const [motif, setMotif] = React.useState("")
  const [signature, setSignature] = React.useState("")
  const [licence, setLicence] = React.useState(false)
  const [base, setBase] = React.useState({ contenu: "", revisionId: null as string | null })
  const [preview, setPreview] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [reloading, setReloading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [conflict, setConflict] = React.useState(false)

  React.useEffect(() => {
    if (!open || !initial) return
    setSection(initial.section)
    setContenu(initial.contenu)
    setSource(initial.source)
    setBase({ contenu: initial.contenuBase, revisionId: initial.revisionBaseId })
    setMotif("")
    setLicence(false)
    setPreview(false)
    setSent(false)
    setError(null)
    setConflict(false)
  }, [open, initial])

  function changerSection(next: SectionEncyclopedie) {
    const actuelle = sections.find(s => s.section === next)
    setSection(next)
    setContenu(actuelle?.contenu ?? "")
    setSource(actuelle?.source ?? "")
    setBase({ contenu: actuelle?.contenu ?? "", revisionId: actuelle?.revisionId ?? null })
    setError(null)
    setConflict(false)
  }

  async function actualiserBase() {
    setReloading(true)
    const data = await onReload()
    if (data) {
      const actuelle = data.sections.find(s => s.section === section)
      setBase({ contenu: actuelle?.contenu ?? "", revisionId: actuelle?.revisionId ?? null })
      setConflict(false)
      setError(null)
    }
    setReloading(false)
  }

  async function envoyer() {
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/referentiel/vegetaux/${encodeURIComponent(especeId)}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, contenu: contenu.trim(), source: source.trim(), motif: motif.trim(), signature: signature.trim(), revisionBaseId: base.revisionId, acceptationLicence: licence }),
      })
      if (!response.ok) {
        setConflict(response.status === 409)
        throw new Error(await messageErreur(response))
      }
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible. Réessayez.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!sending) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto border-lin bg-craie">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-foret">{sent ? "Votre proposition est enregistrée" : `Améliorer la fiche ${nom}`}</DialogTitle>
          <DialogDescription>{sent ? "L’équipe pourra la relire avant de publier une nouvelle version de la fiche." : "Apportez une précision et sa source. Votre texte sera relu avant publication."}</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-5 py-2">
            <p className="rounded-lg bg-sauge-doux p-4 text-sm text-foret" role="status">Vous retrouverez la proposition et la réponse de l’équipe dans vos contributions.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="min-h-11"><Link href="/communaute?tab=contribuer">Suivre mes contributions</Link></Button>
              <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>Revenir à la fiche</Button>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-5">
            <p className="text-sm font-medium text-foret">{TITRES_SECTIONS[section]}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-lin bg-papier p-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ardoise">Version publiée</h3><p className="whitespace-pre-wrap break-words text-sm leading-6">{base.contenu || "Cette section n’a pas encore de texte communautaire publié."}</p></div>
              <div className="min-w-0 rounded-lg border border-sauge/30 bg-sauge-doux/40 p-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foret">Votre proposition</h3><p className="whitespace-pre-wrap break-words text-sm leading-6">{contenu}</p></div>
            </div>
            <dl className="space-y-3 break-words text-sm"><div><dt className="font-medium">Source</dt><dd className="mt-1 text-ardoise"><ReferenceSource source={source} /></dd></div><div><dt className="font-medium">Pourquoi ce changement ?</dt><dd className="mt-1 text-ardoise">{motif}</dd></div><div><dt className="font-medium">Attribution publique</dt><dd className="mt-1 text-ardoise">{signature} · CC BY 4.0</dd></div></dl>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {conflict && <div className="space-y-2"><p className="text-sm text-ardoise">Votre texte reste conservé. Actualisez le passage de départ, puis vérifiez la comparaison.</p><Button variant="outline" className="min-h-11" disabled={reloading} onClick={actualiserBase}>{reloading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Actualiser la version de départ</Button></div>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-lin pt-4"><Button variant="outline" className="min-h-11" disabled={sending} onClick={() => setPreview(false)}>Modifier le texte</Button><Button className="min-h-11" disabled={sending || conflict} onClick={envoyer}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Soumettre à la relecture</Button></div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); setPreview(true); setError(null) }}>
            <label className="block text-sm font-medium" htmlFor={`${uid}-section`}>Section<select id={`${uid}-section`} aria-label="Section" value={section} className={CHAMP} onChange={e => { void changerSection(e.target.value as SectionEncyclopedie) }}>{SECTIONS_ENCYCLOPEDIE.map(cle => <option key={cle} value={cle}>{TITRES_SECTIONS[cle]}</option>)}</select></label>
            <label className="block text-sm font-medium" htmlFor={`${uid}-texte`}>Votre proposition<textarea id={`${uid}-texte`} aria-label="Votre proposition" required minLength={20} maxLength={12000} rows={8} value={contenu} onChange={e => setContenu(e.target.value)} className={CHAMP} placeholder="Un passage clair, avec ses conditions d’application…" /></label>
            <label className="block text-sm font-medium" htmlFor={`${uid}-source`}>Source ou référence<textarea id={`${uid}-source`} aria-label="Source ou référence" required minLength={5} maxLength={2000} rows={2} value={source} onChange={e => setSource(e.target.value)} className={CHAMP} placeholder="Titre, auteur, publication ou lien vers la référence" /></label>
            <label className="block text-sm font-medium" htmlFor={`${uid}-motif`}>Pourquoi ce changement ?<input id={`${uid}-motif`} aria-label="Pourquoi ce changement ?" required minLength={3} maxLength={500} value={motif} onChange={e => setMotif(e.target.value)} className={CHAMP} placeholder="Information manquante, correction, précision du contexte…" /></label>
            <label className="block text-sm font-medium" htmlFor={`${uid}-signature`}>Votre signature publique<input id={`${uid}-signature`} aria-label="Votre signature publique" required minLength={2} maxLength={80} autoComplete="off" value={signature} onChange={e => setSignature(e.target.value)} className={CHAMP} placeholder="Un nom ou un pseudonyme choisi pour cette contribution" /></label>
            <p className="text-xs leading-5 text-ardoise">Si votre texte est publié, votre signature, sa source et les versions de la fiche seront consultables publiquement.</p>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={licence} onChange={e => setLicence(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>Je peux proposer ce texte et j’accepte sa publication sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a>, avec la signature indiquée.</span></label>
            <div className="flex justify-end border-t border-lin pt-4"><Button type="submit" className="min-h-11">Comparer avant / après</Button></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
