"use client"

/**
 * Produits transformés du verger (2026-10-30, retour FB-8CXUUN) : transformer
 * des fruits en stock (jus, compote, confiture…) et suivre le produit obtenu,
 * vendable ensuite par BL ou facture depuis « Ajouter depuis mes stocks ».
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { SelectNatif } from "@/components/ui/select-natif"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FlaskConical, Plus, Trash2, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { todayLocalISO, formatNombre } from "@/lib/format-utils"
import { UNITES_PRODUIT_TRANSFORME, TAUX_TVA_PRODUIT_TRANSFORME } from "@/lib/verger/transformation-options"

interface LotFruit {
  id: number
  date: string
  quantite: number
  statut: string
  numLot?: string | null
  stockDisponibleCommercial?: number | null
  arbre: { nom: string; espece?: string | null }
}

interface LotTransforme {
  id: number
  produit: string
  numLot: string
  date: string
  quantite: number
  unite: string
  stockDisponibleCommercial: number
  datePeremption: string | null
  prixUnitaire: number | null
  tauxTVA: number
  statutBioSnapshot: string | null
  notes: string | null
  annulable: boolean
  sources: { id: string; quantite: number; unite: string; sourceNom: string; fruit: { id: number; numLot: string | null; date: string; arbre: { nom: string; espece: string | null } } | null }[]
}

const fmt = (n: number) => formatNombre(n, 3)
const PRODUITS_SUGGERES = ["Jus", "Compote", "Confiture", "Cidre", "Purée", "Fruits séchés", "Coulis", "Gelée"]
const nombre = (texte: string) => Number(texte.replace(",", ".").trim())
const disponible = (lot: LotFruit) => lot.stockDisponibleCommercial ?? lot.quantite
const nomLotFruit = (lot: LotFruit) =>
  `${lot.arbre.espece || lot.arbre.nom} · ${lot.arbre.nom} · ${new Date(lot.date).toLocaleDateString("fr-FR")}${lot.numLot ? ` · ${lot.numLot}` : ""}`

function formulaireVierge(lotInitialId?: number | null) {
  return {
    sources: [{ fruitId: lotInitialId ? String(lotInitialId) : "", quantite: "" }],
    produit: "",
    quantite: "",
    unite: "bouteille" as string,
    date: todayLocalISO(),
    datePeremption: "",
    prixUnitaire: "",
    tauxTVA: "5.5",
    numLot: "",
    notes: "",
  }
}

/** Dialogue autonome : il charge lui-même les lots de fruits en stock. */
export function TransformationDialog({ open, onOpenChange, lotInitialId, onCree }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lotInitialId?: number | null
  onCree?: () => void
}) {
  const { toast } = useToast()
  const [lots, setLots] = React.useState<LotFruit[]>([])
  const [form, setForm] = React.useState(() => formulaireVierge(lotInitialId))
  const [envoi, setEnvoi] = React.useState(false)
  const cle = React.useRef("")

  React.useEffect(() => {
    if (!open) return
    cle.current = crypto.randomUUID()
    const initial = formulaireVierge(lotInitialId)
    setForm(initial)
    let actif = true
    fetch("/api/arbres/recoltes?statut=en_stock").then(r => (r.ok ? r.json() : [])).then((liste: LotFruit[]) => {
      if (!actif) return
      const enStock = liste.filter(l => disponible(l) > 0)
      setLots(enStock)
      // Par défaut, tout le reliquat du lot choisi depuis sa ligne.
      const choisi = enStock.find(l => l.id === lotInitialId)
      if (choisi) setForm(f => ({ ...f, sources: [{ fruitId: String(choisi.id), quantite: String(disponible(choisi)) }] }))
    }).catch(() => { if (actif) setLots([]) })
    return () => { actif = false }
  }, [open, lotInitialId])

  const majSource = (index: number, champ: "fruitId" | "quantite", valeur: string) =>
    setForm(f => ({ ...f, sources: f.sources.map((s, i) => {
      if (i !== index) return s
      if (champ === "fruitId") {
        const lot = lots.find(l => String(l.id) === valeur)
        return { fruitId: valeur, quantite: lot ? String(disponible(lot)) : s.quantite }
      }
      return { ...s, quantite: valeur }
    }) }))

  const kilos = form.sources.reduce((n, s) => n + (Number.isFinite(nombre(s.quantite)) ? nombre(s.quantite) : 0), 0)

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (envoi) return
    const sources = form.sources.filter(s => s.fruitId).map(s => ({ fruitId: Number(s.fruitId), quantite: nombre(s.quantite) }))
    if (!sources.length) return toast({ variant: "destructive", title: "Choisissez au moins un lot de fruits" })
    if (!form.produit.trim() || !(nombre(form.quantite) > 0)) return toast({ variant: "destructive", title: "Indiquez le produit et la quantité obtenue" })
    setEnvoi(true)
    try {
      const res = await fetch("/api/arbres/transformations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources,
          produit: form.produit.trim(),
          quantite: nombre(form.quantite),
          unite: form.unite,
          date: form.date,
          datePeremption: form.datePeremption || null,
          prixUnitaire: form.prixUnitaire.trim() ? nombre(form.prixUnitaire) : null,
          tauxTVA: Number(form.tauxTVA),
          numLot: form.numLot.trim() || null,
          notes: form.notes.trim() || null,
          cleIdempotence: cle.current,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      toast({ title: "Produit transformé en stock", description: `${data.produit} · lot ${data.numLot} : ${fmt(data.quantite)} ${data.unite}. Vendez-le par BL ou facture depuis « Ajouter depuis mes stocks ».` })
      onOpenChange(false)
      onCree?.()
    } catch (err) {
      toast({ variant: "destructive", title: "Transformation refusée", description: err instanceof Error ? err.message : "Erreur" })
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transformer des fruits</DialogTitle>
          <DialogDescription>
            Les kilos utilisés sortent de leurs lots ; le produit obtenu entre en stock, vendable par bon de livraison ou facture.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enregistrer} noValidate className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Fruits utilisés</legend>
            {lots.length === 0 && <p className="text-sm text-muted-foreground">Aucun lot de fruits en stock.</p>}
            {form.sources.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
                <div>
                  <Label htmlFor={`transfo-lot-${i}`} className="text-xs">Lot</Label>
                  <SelectNatif id={`transfo-lot-${i}`} value={s.fruitId} onChange={e => majSource(i, "fruitId", e.target.value)}>
                    <option value="" disabled>Choisir un lot</option>
                    {lots.filter(l => String(l.id) === s.fruitId || !form.sources.some(x => x.fruitId === String(l.id))).map(l => (
                      <option key={l.id} value={l.id}>{nomLotFruit(l)} ({fmt(disponible(l))} kg)</option>
                    ))}
                  </SelectNatif>
                </div>
                <div>
                  <Label htmlFor={`transfo-kg-${i}`} className="text-xs">Kilos</Label>
                  <Input id={`transfo-kg-${i}`} inputMode="decimal" value={s.quantite} onChange={e => majSource(i, "quantite", e.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="sm" disabled={form.sources.length === 1}
                  onClick={() => setForm(f => ({ ...f, sources: f.sources.filter((_, j) => j !== i) }))} title="Retirer ce lot">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" disabled={form.sources.length >= Math.min(lots.length, 20)}
                onClick={() => setForm(f => ({ ...f, sources: [...f.sources, { fruitId: "", quantite: "" }] }))}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un lot
              </Button>
              <span className="text-xs text-muted-foreground">Total : {fmt(kilos)} kg</span>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="transfo-produit">Produit obtenu *</Label>
            <Input id="transfo-produit" list="transfo-produits" placeholder="Jus de pomme, compote…" value={form.produit}
              onChange={e => setForm(f => ({ ...f, produit: e.target.value }))} />
            <datalist id="transfo-produits">{PRODUITS_SUGGERES.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="transfo-quantite">Quantité obtenue *</Label>
              <Input id="transfo-quantite" inputMode="decimal" value={form.quantite} onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="transfo-unite">Unité</Label>
              <SelectNatif id="transfo-unite" value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}>
                {UNITES_PRODUIT_TRANSFORME.map(u => <option key={u} value={u}>{u}</option>)}
              </SelectNatif>
            </div>
            <div>
              <Label htmlFor="transfo-date">Date de transformation</Label>
              <Input id="transfo-date" type="date" max={todayLocalISO()} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="transfo-ddm">À consommer avant</Label>
              <Input id="transfo-ddm" type="date" min={form.date} value={form.datePeremption} onChange={e => setForm(f => ({ ...f, datePeremption: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="transfo-prix">Prix de vente TTC / {form.unite}</Label>
              <Input id="transfo-prix" inputMode="decimal" placeholder="Facultatif" value={form.prixUnitaire} onChange={e => setForm(f => ({ ...f, prixUnitaire: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="transfo-tva">TVA à la vente</Label>
              <SelectNatif id="transfo-tva" value={form.tauxTVA} onChange={e => setForm(f => ({ ...f, tauxTVA: e.target.value }))}>
                {TAUX_TVA_PRODUIT_TRANSFORME.map(t => <option key={t} value={String(t)}>{formatNombre(t, 1)} %{t === 20 ? " (boissons alcoolisées : cidre…)" : ""}</option>)}
              </SelectNatif>
            </div>
          </div>
          <div>
            <Label htmlFor="transfo-lot">N° de lot</Label>
            <Input id="transfo-lot" placeholder="Automatique si vide" value={form.numLot} onChange={e => setForm(f => ({ ...f, numLot: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="transfo-notes">Notes</Label>
            <Input id="transfo-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={envoi || lots.length === 0}>
            {envoi ? "Enregistrement..." : "Mettre le produit en stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProduitsTransformesSubTab() {
  const { toast } = useToast()
  const [lots, setLots] = React.useState<LotTransforme[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogue, setDialogue] = React.useState(false)
  const [annulation, setAnnulation] = React.useState(false)

  const charger = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/arbres/transformations")
      if (!res.ok) throw new Error()
      setLots(await res.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Produits transformés indisponibles." })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => { charger() }, [charger])

  const annuler = async (lot: LotTransforme) => {
    if (annulation) return
    if (!(await confirmDialog(`Annuler la transformation « ${lot.produit} » (lot ${lot.numLot}) ? Les fruits reviennent dans leurs lots et le produit sort du stock.`))) return
    setAnnulation(true)
    try {
      const res = await fetch(`/api/arbres/transformations/${lot.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      toast({ title: "Transformation annulée", description: "Les fruits sont revenus en stock." })
      await charger()
    } catch (err) {
      toast({ variant: "destructive", title: "Annulation refusée", description: err instanceof Error ? err.message : "Erreur" })
    } finally {
      setAnnulation(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground max-w-xl">
          Jus, compotes, confitures… issus de vos fruits. Vendez-les depuis Comptabilité &gt; Factures ou Bons de livraison, bouton « Ajouter depuis mes stocks ».
        </p>
        <Button onClick={() => setDialogue(true)} size="sm" className="bg-orange-600 hover:bg-orange-700">
          <FlaskConical className="h-4 w-4 mr-1" />
          Nouvelle transformation
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-muted-foreground">Chargement...</p>
          ) : lots.length === 0 ? (
            <p className="p-8 text-muted-foreground text-center">Aucun produit transformé. Utilisez « Transformer » sur un lot de fruits en stock.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">En stock</TableHead>
                  <TableHead>Fruits utilisés</TableHead>
                  <TableHead>À consommer avant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map(lot => (
                  <TableRow key={lot.id}>
                    <TableCell>{new Date(lot.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{lot.produit}</div>
                      <div className="text-xs text-muted-foreground">Lot {lot.numLot}{lot.statutBioSnapshot ? ` · ${lot.statutBioSnapshot}` : ""}{lot.prixUnitaire != null ? ` · ${formatNombre(lot.prixUnitaire, 2)} € TTC / ${lot.unite}` : ""}</div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {fmt(lot.stockDisponibleCommercial)} / {fmt(lot.quantite)} {lot.unite}
                      {lot.stockDisponibleCommercial <= 0 && <Badge variant="outline" className="ml-2 text-xs">Écoulé</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.sources.map(s => (
                        <div key={s.id}>{fmt(s.quantite)} {s.unite} · {s.fruit ? `${s.fruit.arbre.espece || s.fruit.arbre.nom} (${s.fruit.numLot ?? s.sourceNom})` : s.sourceNom}</div>
                      ))}
                    </TableCell>
                    <TableCell>{lot.datePeremption ? new Date(lot.datePeremption).toLocaleDateString("fr-FR") : "-"}</TableCell>
                    <TableCell className="text-right">
                      {lot.stockDisponibleCommercial > 0 && (
                        <Link className="block text-sm text-primary underline" href={`/comptabilite/factures?tab=livraisons&stock=transforme:${lot.id}`}>Préparer un BL</Link>
                      )}
                      {lot.annulable ? (
                        <Button disabled={annulation} variant="ghost" size="sm" onClick={() => annuler(lot)} title="Annuler la transformation : les fruits reviennent en stock">
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Annuler
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Livré ou facturé</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <TransformationDialog open={dialogue} onOpenChange={setDialogue} onCree={charger} />
    </div>
  )
}
