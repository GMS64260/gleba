"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Loader2, Share2, Trash2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useIsDemoAccount } from "@/hooks/use-is-demo"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import type { VuePartageRecolte } from "@/lib/avis/photos"
import { photosPourEnvoi, SelecteurPhotosAvis } from "./PhotosAvis"

const TYPES = { ESPECE: "Espèce", VARIETE: "Variété", ITP: "Itinéraire" }
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" })

export function BoutonPartagerRecolte({ recolteId }: { recolteId: number }) {
  const [open, setOpen] = React.useState(false)
  return <><Button type="button" size="sm" variant="outline" className="min-h-10" onClick={() => setOpen(true)} aria-label={`Partager la récolte ${recolteId} dans la communauté`}><Share2 className="mr-1.5 h-4 w-4" aria-hidden />Partager</Button><DialogPartagerRecolte recolteId={recolteId} open={open} onOpenChange={setOpen} /></>
}

export function DialogPartagerRecolte({ recolteId, open, onOpenChange, onShared }: { recolteId: number; open: boolean; onOpenChange: (open: boolean) => void; onShared?: () => void }) {
  const { data: session, status } = useSession()
  const demo = useIsDemoAccount()
  const { toast } = useToast()
  const [preview, setPreview] = React.useState<VuePartageRecolte | null>(null)
  const [cible, setCible] = React.useState("")
  const [commentaire, setCommentaire] = React.useState("")
  const [partagerQuantite, setPartagerQuantite] = React.useState(true)
  const [fichiers, setFichiers] = React.useState<File[]>([])
  const [droits, setDroits] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState(false)
  const [chargement, setChargement] = React.useState(false)
  const [envoi, setEnvoi] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [essai, setEssai] = React.useState(0)
  const [succes, setSucces] = React.useState(false)
  const [conflit, setConflit] = React.useState(false)
  const uid = React.useId()
  const peutApercu = status === "authenticated" && !session?.user?.impersonatedBy
  const personnel = peutApercu && !demo
  const base = `/api/recoltes/${recolteId}/partage-avis`

  React.useEffect(() => {
    setPreview(null); setCible(""); setCommentaire(""); setFichiers([]); setDroits(false); setConfirmation(false); setSucces(false); setErreur(null); setConflit(false); setPartagerQuantite(true)
  }, [base, open])

  React.useEffect(() => {
    if (!open) return
    if (!peutApercu) return
    const controller = new AbortController()
    setChargement(true); setErreur(null); setConfirmation(false)
    fetch(base, { signal: controller.signal }).then(async res => {
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Cette récolte ne peut pas être partagée.")
      return body as VuePartageRecolte
    }).then(resultat => {
      if (controller.signal.aborted) return
      setPreview(resultat)
      setCible(current => resultat.cibles.some(item => `${item.refType}:${item.refId}` === current) ? current : resultat.cibles[0] ? `${resultat.cibles[0].refType}:${resultat.cibles[0].refId}` : "")
      setConflit(false)
    }).catch(error => { if (!controller.signal.aborted) setErreur(error instanceof Error ? error.message : "Chargement impossible") }).finally(() => { if (!controller.signal.aborted) setChargement(false) })
    return () => controller.abort()
  }, [base, open, peutApercu, essai])

  const selection = preview?.cibles.find(item => `${item.refType}:${item.refId}` === cible)
  const partage = preview?.partages.find(item => item.refType === selection?.refType && item.refId === selection?.refId)

  const publier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selection || !preview || !personnel || !confirmation || conflit || (fichiers.length > 0 && !droits) || envoi) return
    setEnvoi(true); setErreur(null)
    try {
      const photos = await photosPourEnvoi(fichiers)
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refType: selection.refType, refId: selection.refId, empreinteBase: preview.empreinte, commentaire: commentaire.trim() || null, partagerQuantite, photos, confirmationDroitsPhotos: fichiers.length > 0 ? droits : undefined, confirmerPartage: true }) })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) { setConflit(true); setConfirmation(false) }
      if (!res.ok) throw new Error(body.error || "Le partage n’a pas pu être publié.")
      setSucces(true); setFichiers([])
      setPreview(current => current ? { ...current, partages: [...current.partages.filter(item => item.refType !== selection.refType || item.refId !== selection.refId), { id: body.temoignage.id, refType: selection.refType, refId: selection.refId }] } : current)
      onShared?.()
      toast({ title: "Récolte partagée", description: "Votre témoignage est visible dans les avis communautaires." })
    } catch (error) { setErreur(error instanceof Error ? error.message : "Erreur réseau") } finally { setEnvoi(false) }
  }

  const retirer = async () => {
    if (!partage || envoi || !(await confirmDialog("Retirer ce partage de la communauté ? La récolte reste dans votre registre."))) return
    setEnvoi(true); setErreur(null)
    try {
      const res = await fetch(`/api/avis/temoignages/${encodeURIComponent(partage.id)}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Le partage n’a pas pu être retiré.")
      setPreview(current => current ? { ...current, partages: current.partages.filter(item => item.id !== partage.id) } : current)
      setSucces(false); setConfirmation(false); onShared?.()
      toast({ title: "Partage retiré", description: "Votre récolte est conservée dans votre registre." })
    } catch (error) { setErreur(error instanceof Error ? error.message : "Erreur réseau") } finally { setEnvoi(false) }
  }

  return <Dialog open={open} onOpenChange={value => { if (!envoi) onOpenChange(value) }}><DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Partager ma récolte</DialogTitle><DialogDescription>Un témoignage choisi par vous, dans les avis communautaires. Votre récolte reste dans votre registre.</DialogDescription></DialogHeader>{!peutApercu ? <p role="note" className="rounded-lg border bg-muted/30 p-4 text-sm">{status === "loading" ? "Vérification de la connexion…" : demo ? "Utilisez un compte personnel pour partager vos récoltes. La démonstration ne publie aucun témoignage." : "Une session personnelle est nécessaire pour partager une récolte."}</p> : chargement ? <p role="status" className="flex items-center gap-2 py-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Préparation de l’aperçu…</p> : preview ? <form onSubmit={publier} className="space-y-4">{demo && <p role="note" className="rounded-lg border bg-muted/30 p-3 text-sm">Aperçu en démonstration : utilisez un compte personnel pour publier votre récolte et vos photos.</p>}<div className="rounded-lg border bg-sauge-doux/30 p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">Valeurs actuelles dans votre registre</p><p className="font-medium">Récolte du {DATE.format(new Date(preview.dateRecolte))}</p><p className="mt-1">{preview.quantite.toLocaleString("fr-FR")} {preview.unite}</p></div>{preview.cibles.length === 0 ? <p className="text-sm text-muted-foreground">Cette récolte n’est pas rattachée à une référence communautaire accessible. Vos références privées restent dans votre exploitation.</p> : <><label htmlFor={`${uid}-cible`} className="block text-sm font-medium">Publier dans les avis de<select id={`${uid}-cible`} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 py-2" value={cible} disabled={envoi || !personnel} onChange={event => { setCible(event.target.value); setSucces(false); setConfirmation(false); setErreur(null) }}>{preview.cibles.map(item => <option key={`${item.refType}:${item.refId}`} value={`${item.refType}:${item.refId}`}>{TYPES[item.refType]} · {item.nom}</option>)}</select></label>{partage ? <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p role="status" className="flex items-center gap-2 text-sm text-emerald-900"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />{succes ? "Votre récolte est partagée dans ces avis." : "Cette récolte est déjà partagée dans ces avis."}</p><p className="text-xs text-emerald-900">La date, la quantité et l’unité du témoignage restent celles choisies au moment du partage. Modifier votre registre ne modifie pas ce témoignage.</p><Button type="button" variant="outline" disabled={envoi || !personnel} onClick={retirer}><Trash2 className="mr-2 h-4 w-4" aria-hidden />Retirer ce partage</Button></div> : <><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={!personnel} checked={partagerQuantite} onChange={event => setPartagerQuantite(event.target.checked)} />Afficher la quantité dans mon témoignage</label><label htmlFor={`${uid}-commentaire`} className="block text-sm font-medium">Votre retour sur cette récolte (facultatif)<Textarea id={`${uid}-commentaire`} className="mt-1" rows={3} maxLength={2000} placeholder="Ce qui a bien poussé, une difficulté, une observation…" value={commentaire} onChange={event => setCommentaire(event.target.value)} disabled={envoi || !personnel} /></label><SelecteurPhotosAvis fichiers={fichiers} onChange={setFichiers} disabled={envoi || !personnel} />{fichiers.length > 0 && <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1.5" disabled={!personnel} checked={droits} onChange={event => setDroits(event.target.checked)} />J’ai pris ces photos ou j’ai l’autorisation de les partager avec les membres de Gleba.</label>}<div className="rounded-lg border bg-muted/30 p-3 text-sm"><p>Seront partagés : {selection?.nom}, la date{partagerQuantite ? ", la quantité" : ""}, votre commentaire et les photos choisies.</p><p className="mt-2 text-xs text-muted-foreground">Les prix, clients, factures, planches et notes privées restent dans votre exploitation.</p></div><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1.5" disabled={!personnel} checked={confirmation} onChange={event => setConfirmation(event.target.checked)} />Je souhaite publier ce témoignage auprès des membres de Gleba.</label><Button type="submit" className="min-h-11 w-full" disabled={envoi || !personnel || conflit || !confirmation || (fichiers.length > 0 && !droits)}>{envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Share2 className="mr-2 h-4 w-4" aria-hidden />}Publier mon témoignage</Button></>}</>}{erreur && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erreur}</p>}{conflit && <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setEssai(value => value + 1)}>Recharger l’aperçu</Button>}<Button type="button" variant="ghost" className="w-full" disabled={envoi} onClick={() => onOpenChange(false)}>Fermer</Button></form> : <div className="space-y-3"><p role="alert" className="text-sm text-red-700">{erreur}</p><Button type="button" variant="outline" onClick={() => setEssai(value => value + 1)}>Réessayer</Button></div>}</DialogContent></Dialog>
}
