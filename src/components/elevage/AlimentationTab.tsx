"use client"

/**
 * Onglet Alimentation - Stocks aliments + Consommations + Soins en sous-onglets
 */

import * as React from "react"
import {
  Package,
  TrendingDown,
  Stethoscope,
  Plus,
  Pencil,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Check,
  Trash2,
  Scale,
} from "lucide-react"
import { RationSubTab } from "./RationSubTab"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { verifierPrixAliment, type CategorieAliment } from "@/lib/elevage/prix-aliment-seuils"
import { todayLocalISO } from '@/lib/format-utils'

// ============================================================
// Composant principal
// ============================================================

export function AlimentationTab() {
  // Bug testeur 2026-05-31 — le bouton « + Soin » d'une fiche animale pointe
  // vers /elevage?tab=alimentation&sub=soins&animalId=29 mais on retombait
  // toujours sur l'onglet Stocks (defaultValue figé) et le formulaire ne
  // s'ouvrait pas. On lit `sub` (onglet) et `animalId` (pré-remplissage du
  // soin) depuis l'URL au montage côté client.
  const [activeSub, setActiveSub] = React.useState<string>("stocks")
  const [soinAnimalId, setSoinAnimalId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sub = params.get("sub")
    const animalId = params.get("animalId")
    if (sub === "soins" || sub === "consommations" || sub === "stocks") {
      setActiveSub(sub)
    }
    if (animalId) {
      // Implique l'onglet Soins même si `sub` n'est pas explicite.
      setActiveSub("soins")
      setSoinAnimalId(animalId)
    }
  }, [])

  return (
    <Tabs value={activeSub} onValueChange={setActiveSub} className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-y-1">
        <TabsTrigger value="stocks" className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Stocks
        </TabsTrigger>
        <TabsTrigger value="consommations" className="flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4" />
          Consommations
        </TabsTrigger>
        <TabsTrigger value="soins" className="flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4" />
          Soins
        </TabsTrigger>
        <TabsTrigger value="ration" className="flex items-center gap-1.5">
          <Scale className="h-4 w-4" />
          Ration
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stocks">
        <StocksSubTab />
      </TabsContent>
      <TabsContent value="consommations">
        <ConsommationsSubTab />
      </TabsContent>
      <TabsContent value="soins">
        <SoinsSubTab initialAnimalId={soinAnimalId} />
      </TabsContent>
      <TabsContent value="ration">
        <RationSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Stocks Aliments
// ============================================================

interface Aliment {
  id: string
  nom: string
  type: string | null
  especesCibles: string | null
  proteines: number | null
  prix: number | null
  stock: number | null
  stockMin: number | null
  dateStock: string | null
  consoMoyJour?: number | null
  joursAutonomie?: number | null
  dateRupture?: string | null
  fournisseur: { id: string; contact: string | null } | null
  _count: { consommations: number }
}

// Bug #7 — Mapping code → label avec accents pour les types d'aliments
// (le code reste sans accents pour rester compatible avec les seeds et les
// filtres existants).
const TYPE_LABELS: Record<string, string> = {
  granules: "Granulés",
  cereales: "Céréales",
  complement: "Complément",
  fourrage: "Fourrage",
  foin: "Foin",
  paille: "Paille",
  autre: "Autre",
}
function labelType(code: string | null | undefined): string {
  if (!code) return "-"
  return TYPE_LABELS[code.toLowerCase()] ?? code
}

function StocksSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [aliments, setAliments] = React.useState<Aliment[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingStock, setEditingStock] = React.useState<string | null>(null)
  const [newStock, setNewStock] = React.useState("")
  // Bug feedback testeur 2026-05-25 (cmplkehs9/cmplkbnye) — badge "À vérifier"
  // était purement décoratif. On le rend cliquable pour éditer le prix
  // directement depuis la ligne (les autres granulés sont entre 0,40 et
  // 0,55 €/kg, donc 22 €/kg pour les granulés agneau était bien à corriger
  // sans devoir passer par "Nouvel aliment").
  const [editingPrix, setEditingPrix] = React.useState<string | null>(null)
  const [newPrix, setNewPrix] = React.useState("")

  const [formData, setFormData] = React.useState({
    id: "", nom: "", type: "granules", especesCibles: "", prix: "", stock: "", stockMin: "", description: "", ufl: "", pdin: "", pdie: "", uel: "",
  })
  // QA Julien 2026-05-15 — Bug #12 : payload en attente quand prix
  // hors-norme, en attente de confirmation utilisateur via ConfirmDialog.
  const [prixWarning, setPrixWarning] = React.useState<{ message: string } | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/elevage/aliments')
      if (response.ok) {
        const result = await response.json()
        setAliments(result.data)
        setStats(result.stats)
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les aliments" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  // QA Julien 2026-05-15 — Bug #12 : garde-fou sur le prix d'un
  // aliment. La saisie est non bloquante mais demande confirmation
  // explicite si la valeur dépasse l'ordre de grandeur usuel pour la
  // catégorie (Granulés ≤ 2 €/kg, Foin ≤ 0,5, etc.).
  const submitAliment = React.useCallback(async () => {
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Aliment créé" })
      setIsDialogOpen(false)
      setFormData({ id: "", nom: "", type: "granules", especesCibles: "", prix: "", stock: "", stockMin: "", description: "", ufl: "", pdin: "", pdie: "", uel: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'aliment" })
    }
  }, [formData, toast, fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.id) {
      toast({ title: "Renseignez l'identifiant", variant: "destructive" })
      return
    }
    if (!formData.nom) {
      toast({ title: "Renseignez le nom", variant: "destructive" })
      return
    }
    const prixNum = formData.prix ? parseFloat(formData.prix) : null
    const check = verifierPrixAliment(prixNum, (formData.type as CategorieAliment) || "autre")
    // Cas prix=0 : erreur dure (le check renvoie ok=false sans seuil)
    if (!check.ok && check.seuil === null) {
      toast({ variant: "destructive", title: "Prix invalide", description: check.message })
      return
    }
    // Cas hors-norme : confirmation
    if (!check.ok) {
      setPrixWarning({ message: check.message })
      return
    }
    await submitAliment()
  }

  const updateStock = async (id: string) => {
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock: parseFloat(newStock) }),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Stock mis a jour" })
      setEditingStock(null)
      setNewStock("")
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Bug feedback testeur 2026-05-25 (cmplkehs9/cmplkbnye) — édition rapide
  // du prix depuis la ligne, déclenchée par le badge "À vérifier".
  const updatePrix = async (id: string) => {
    const prixNum = parseFloat(newPrix)
    if (Number.isNaN(prixNum) || prixNum < 0) {
      toast({ variant: "destructive", title: "Prix invalide" })
      return
    }
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, prix: prixNum }),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Prix mis à jour" })
      setEditingPrix(null)
      setNewPrix("")
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-4">
      {stats && stats.stockBas > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alerte stock bas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-800">{stats.stockBas} aliment(s) en dessous du seuil minimum</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouvel aliment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un aliment</DialogTitle>
              <DialogDescription>Granulés, céréales, foin...</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>ID *</Label><Input value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, '_') }))} placeholder="granules_pondeuses" /></div>
                <div className="space-y-2"><Label>Nom *</Label><Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} placeholder="Granules pondeuses" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Prix (&euro;/kg)</Label><Input type="number" step="0.01" value={formData.prix} onChange={(e) => setFormData(f => ({ ...f, prix: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Stock (kg)</Label><Input type="number" step="0.1" value={formData.stock} onChange={(e) => setFormData(f => ({ ...f, stock: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Stock minimum (alerte)</Label><Input type="number" step="0.1" value={formData.stockMin} onChange={(e) => setFormData(f => ({ ...f, stockMin: e.target.value }))} /></div>
              {/* PROMPT 25 — valeurs alimentaires INRA (par kg brut) pour le calcul de ration */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Valeurs alimentaires (par kg brut) — pour le calculateur de ration</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1"><Label className="text-xs">UFL</Label><Input type="number" step="0.01" value={formData.ufl} onChange={(e) => setFormData(f => ({ ...f, ufl: e.target.value }))} placeholder="0.85" /></div>
                  <div className="space-y-1"><Label className="text-xs">PDIN (g)</Label><Input type="number" step="1" value={formData.pdin} onChange={(e) => setFormData(f => ({ ...f, pdin: e.target.value }))} placeholder="90" /></div>
                  <div className="space-y-1"><Label className="text-xs">PDIE (g)</Label><Input type="number" step="1" value={formData.pdie} onChange={(e) => setFormData(f => ({ ...f, pdie: e.target.value }))} placeholder="95" /></div>
                  <div className="space-y-1"><Label className="text-xs">UEL</Label><Input type="number" step="0.01" value={formData.uel} onChange={(e) => setFormData(f => ({ ...f, uel: e.target.value }))} placeholder="1.0" /></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit">Créer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aliment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Prix/kg</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Seuil min</TableHead>
                  <TableHead className="text-right">Autonomie</TableHead>
                  <TableHead>MAJ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliments.map((a) => {
                  // Bug testeur 2026-05-31 — un stock jamais initialisé (NULL)
                  // qui part en consommation forcée se retrouve stocké en
                  // négatif (ex. -15 kg) et était affiché tel quel. On ne montre
                  // plus de valeur négative : l'affichage est borné à 0 et on
                  // signale explicitement qu'il faut (ré)initialiser le stock.
                  const stockNonInitialise = a.stock === null || a.stock < 0
                  const stockAffiche = a.stock !== null ? Math.max(0, a.stock) : null
                  // « épuisé » = stock initialisé tombé exactement à 0 (alerte rouge).
                  // Un stock négatif relève désormais de « non initialisé » (orange).
                  const stockEpuise = a.stock !== null && a.stock === 0
                  const stockBas = !stockEpuise && !stockNonInitialise && a.stock !== null && a.stockMin !== null && a.stock <= a.stockMin
                  // Feedback Marc 2026-05-16 \u2014 V3 Bug 4 : les s\u00e9quences
                  // d'\u00e9chappement \u00ab À vérifier \u00bb \u00e9taient rendues
                  // telles quelles dans le JSX (non interpr\u00e9t\u00e9es). On
                  // utilise les vraies lettres \u00ab À vérifier \u00bb.
                  const prixCheck = verifierPrixAliment(a.prix ?? null, (a.type as CategorieAliment) ?? null)
                  const prixHorsNorme = !prixCheck.ok && prixCheck.seuil !== null
                  return (
                    <TableRow key={a.id} className={stockEpuise ? "bg-red-50" : (stockNonInitialise || stockBas) ? "bg-orange-50" : ""}>
                      <TableCell className="font-medium">{a.nom}</TableCell>
                      <TableCell><Badge variant="outline">{labelType(a.type)}</Badge></TableCell>
                      <TableCell className="text-right">
                        {editingPrix === a.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input type="number" step="0.01" min="0" value={newPrix} onChange={(e) => setNewPrix(e.target.value)} className="w-24 h-8" autoFocus />
                            <span className="text-xs text-muted-foreground">{"\u20ac"}/kg</span>
                            <Button size="sm" variant="ghost" onClick={() => updatePrix(a.id)}>&#10003;</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingPrix(null); setNewPrix("") }}>&times;</Button>
                          </div>
                        ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {a.prix ? `${a.prix.toFixed(2)} \u20ac` : '-'}
                          {prixHorsNorme && (
                            <button
                              type="button"
                              onClick={() => { setEditingPrix(a.id); setNewPrix(a.prix?.toString() || "") }}
                              title={`${prixCheck.message} — cliquez pour corriger`}
                              className="inline-flex items-center rounded-md border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              À vérifier
                            </button>
                          )}
                        </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingStock === a.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input type="number" step="0.1" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="w-20 h-8" autoFocus />
                            <Button size="sm" variant="ghost" onClick={() => updateStock(a.id)}>&#10003;</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingStock(null); setNewStock("") }}>&times;</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingStock(a.id); setNewStock(stockAffiche !== null ? stockAffiche.toString() : "") }}
                            className={`font-bold hover:underline ${stockNonInitialise ? 'text-orange-600' : stockBas ? 'text-orange-600' : ''}`}
                            title={stockNonInitialise ? "Stock non initialisé — cliquez pour le renseigner" : undefined}
                          >
                            {/* Bug #7 + testeur 2026-05-31 \u2014 jamais de valeur
                                n\u00e9gative affich\u00e9e : NULL ou stock < 0
                                (consommation forc\u00e9e sur un stock non renseign\u00e9)
                                \u2192 badge \u00ab Initialiser \u00bb au lieu de "-15 kg". */}
                            {stockNonInitialise
                              ? <span className="inline-flex items-center rounded-md border border-orange-400 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">Initialiser</span>
                              : `${stockAffiche} kg`}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.stockMin !== null ? `${a.stockMin} kg` : '\u2014'}</TableCell>
                      <TableCell className="text-right">
                        {/* GAP P0 \u2014 autonomie estim\u00e9e au rythme moyen des 30 derniers jours */}
                        {a.joursAutonomie != null ? (
                          <span
                            className={`text-sm font-medium ${a.joursAutonomie <= 7 ? 'text-red-700' : a.joursAutonomie <= 14 ? 'text-amber-700' : 'text-slate-600'}`}
                            title={a.dateRupture ? `Rupture estim\u00e9e le ${new Date(a.dateRupture).toLocaleDateString('fr-FR')} (conso moy. ${a.consoMoyJour} kg/j)` : undefined}
                          >
                            {a.joursAutonomie} j
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">{'\u2014'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.dateStock ? new Date(a.dateStock).toLocaleDateString('fr-FR') : '\u2014'}</TableCell>
                      <TableCell>
                        {stockEpuise ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (stockNonInitialise || stockBas) ? (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {aliments.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun aliment enregistré</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* QA Julien 2026-05-15 — Bug #12 : confirmation prix hors-norme.
          Pas bloquant : l'éleveur valide explicitement les cas légitimes
          (alimentation thérapeutique, complément technique cher…). */}
      <ConfirmDialog
        open={prixWarning !== null}
        onOpenChange={(o) => !o && setPrixWarning(null)}
        title="Prix inhabituel"
        description={prixWarning?.message}
        confirmLabel="Confirmer ce prix"
        variant="warning"
        onConfirm={async () => {
          setPrixWarning(null)
          await submitAliment()
        }}
      />
    </div>
  )
}

// ============================================================
// Consommations
// ============================================================

interface Consommation {
  id: number
  date: string
  quantite: number
  notes: string | null
  aliment: { id: string; nom: string; type: string | null }
  lot: { id: number; nom: string | null } | null
}

interface AlimentSimple { id: string; nom: string; type: string | null }
interface LotSimple { id: number; nom: string | null; especeAnimale: { nom: string } }

interface ConsoStats {
  totalKg: number
  nbEnregistrements: number
  parAliment: { alimentId: string; nom: string; totalKg: number; count: number }[]
}

function ConsommationsSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [consommations, setConsommations] = React.useState<Consommation[]>([])
  const [aliments, setAliments] = React.useState<AlimentSimple[]>([])
  const [lots, setLots] = React.useState<LotSimple[]>([])
  const [stats, setStats] = React.useState<ConsoStats | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [filterDateDebut, setFilterDateDebut] = React.useState("")
  const [filterDateFin, setFilterDateFin] = React.useState("")
  // QA 2026-05-15 — édition par ligne
  const [editingConsoId, setEditingConsoId] = React.useState<number | null>(null)
  // Bug feedback testeur 2026-05-26 (cmpm6xi6w / cmpmqtzdg) — les alertes
  // de stock étaient des window.confirm() natifs, invisibles des agents
  // de test (« accepté silencieusement »). Migration vers ConfirmDialog
  // in-app. `stockConfirm` porte le message serveur (422 STOCK_*).
  const [stockConfirm, setStockConfirm] = React.useState<{ message: string } | null>(null)
  const [deletingConsoId, setDeletingConsoId] = React.useState<number | null>(null)

  const [formData, setFormData] = React.useState({
    alimentId: "", lotId: "", date: todayLocalISO(), quantite: "", notes: "",
  })

  const resetConsoForm = () => {
    setEditingConsoId(null)
    setFormData({ alimentId: "", lotId: "", date: todayLocalISO(), quantite: "", notes: "" })
  }

  const handleEditConso = (c: Consommation) => {
    setEditingConsoId(c.id)
    setFormData({
      alimentId: c.aliment.id,
      lotId: c.lot?.id ? c.lot.id.toString() : "",
      date: c.date.split('T')[0],
      quantite: c.quantite.toString(),
      notes: c.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = "/api/elevage/consommations-aliments?limit=200"
      if (filterDateDebut) url += `&dateDebut=${filterDateDebut}`
      if (filterDateFin) url += `&dateFin=${filterDateFin}`

      const [consRes, alimRes, lotsRes] = await Promise.all([
        fetch(url),
        fetch("/api/elevage/aliments"),
        fetch("/api/elevage/lots?statut=actif"),
      ])

      if (consRes.ok) { const r = await consRes.json(); setConsommations(r.data); setStats(r.stats) }
      if (alimRes.ok) setAliments((await alimRes.json()).data)
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast, filterDateDebut, filterDateFin])

  React.useEffect(() => { fetchData() }, [fetchData])

  const submitConsommation = async (overrideStock = false) => {
    const isEdit = editingConsoId !== null
    const body = {
      ...(isEdit ? { id: editingConsoId } : {}),
      alimentId: formData.alimentId,
      lotId: formData.lotId ? parseInt(formData.lotId) : null,
      date: formData.date,
      quantite: parseFloat(formData.quantite),
      notes: formData.notes || null,
      ...(overrideStock ? { overrideStock: true } : {}),
    }
    const response = await fetch("/api/elevage/consommations-aliments", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (response.ok) {
      toast({
        title: isEdit ? "Consommation mise à jour" : "Consommation enregistrée",
        description: `${formData.quantite} kg`,
      })
      setIsDialogOpen(false)
      resetConsoForm()
      fetchData()
      return
    }

    // Bug #5 — extraire le message détaillé du serveur. Le 422
    // STOCK_INSUFFISANT explique exactement combien de stock manque.
    let payload: { error?: string; code?: string; details?: { message?: string } } = {}
    try {
      payload = await response.json()
    } catch {
      /* corps non-JSON */
    }
    if (response.status === 422 && payload.code === "STOCK_INSUFFISANT") {
      const message = payload.details?.message ?? payload.error ?? "Stock insuffisant"
      setStockConfirm({ message: `${message}\n\nEnregistrer quand même (le stock passera en négatif) ?` })
      return
    }
    if (response.status === 422 && payload.code === "STOCK_NON_INITIALISE") {
      const message = payload.details?.message ?? payload.error ?? "Stock non initialisé"
      setStockConfirm({ message })
      return
    }
    toast({
      variant: "destructive",
      title: "Erreur",
      description: payload.details?.message ?? payload.error ?? "Impossible d'enregistrer",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.alimentId) {
      toast({ title: "Sélectionnez un aliment", variant: "destructive" })
      return
    }
    if (!formData.quantite) {
      toast({ title: "Renseignez la quantité", variant: "destructive" })
      return
    }
    try {
      await submitConsommation(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (deletingConsoId == null) return
    try {
      const res = await fetch(`/api/elevage/consommations-aliments?id=${deletingConsoId}`, { method: "DELETE" })
      if (!res.ok) {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Suppression impossible" })
        return
      }
      toast({ title: "Consommation supprimée, stock restauré" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    } finally {
      setDeletingConsoId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Total consommé</CardDescription>
              <CardTitle className="text-2xl">{stats.totalKg.toFixed(1)} kg</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xs text-muted-foreground">{stats.nbEnregistrements} enregistrements</p>
            </CardContent>
          </Card>
          {stats.parAliment.slice(0, 2).map((a) => (
            <Card key={a.alimentId}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs">{a.nom}</CardDescription>
                <CardTitle className="text-2xl">{a.totalKg.toFixed(1)} kg</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">{a.count} distributions</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtres et actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={filterDateDebut} onChange={(e) => setFilterDateDebut(e.target.value)} className="w-[150px]" />
          <span className="text-muted-foreground">au</span>
          <Input type="date" value={filterDateFin} onChange={(e) => setFilterDateFin(e.target.value)} className="w-[150px]" />
          {(filterDateDebut || filterDateFin) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterDateDebut(""); setFilterDateFin("") }}>Effacer</Button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetConsoForm() }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingConsoId(null)}><Plus className="h-4 w-4 mr-1" />Saisie rapide</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingConsoId ? "Modifier la consommation" : "Nouvelle consommation"}</DialogTitle>
                <DialogDescription>{editingConsoId ? `Édition de la consommation #${editingConsoId}` : "Enregistrer une distribution d'aliment"}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Aliment *</Label>
                  <Select value={formData.alimentId} onValueChange={(v) => setFormData(f => ({ ...f, alimentId: v }))}>
                    <SelectTrigger><SelectValue placeholder="— Sélectionner un aliment —" /></SelectTrigger>
                    <SelectContent>{aliments.map(a => <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lot (optionnel)</Label>
                  {/* QA Julien 2026-05-15 — Bug #1 BLOQUANT : Radix
                      interdit <SelectItem value=""> depuis sa v1, ce qui
                      crashait la modale entière à l'ouverture. On utilise
                      désormais la sentinelle "__all__" pour "Tous les
                      animaux" et on la convertit en null au submit. */}
                  <Select
                    value={formData.lotId || "__all__"}
                    onValueChange={(v) => setFormData(f => ({ ...f, lotId: v === "__all__" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Tous les animaux" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous les animaux</SelectItem>
                      {lots.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.nom || `Lot #${l.id}`} ({l.especeAnimale.nom})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Quantité (kg) *</Label><Input type="number" min="0" step="0.1" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} placeholder="0" /></div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit">
                    {editingConsoId ? "Mettre à jour" : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Aliment</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consommations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="font-medium">{c.aliment.nom}</TableCell>
                    <TableCell>{c.lot?.nom || (c.lot ? `Lot #${c.lot.id}` : "-")}</TableCell>
                    <TableCell className="text-right font-bold">{c.quantite} kg</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{c.notes || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditConso(c)} title="Modifier" className="text-slate-600 hover:text-slate-900">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingConsoId(c.id)} className="text-red-600 hover:text-red-700" title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {consommations.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune consommation enregistrée</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Alerte stock (insuffisant / non initialisé) — modale in-app
          remplaçant les window.confirm() natifs (cmpm6xi6w / cmpmqtzdg). */}
      <ConfirmDialog
        open={stockConfirm !== null}
        onOpenChange={(o) => !o && setStockConfirm(null)}
        title="Stock insuffisant"
        description={
          <span className="whitespace-pre-line">{stockConfirm?.message ?? ""}</span>
        }
        confirmLabel="Enregistrer quand même"
        cancelLabel="Annuler"
        variant="warning"
        onConfirm={async () => {
          setStockConfirm(null)
          await submitConsommation(true)
        }}
      />

      {/* Suppression d'une consommation — modale in-app (remplace confirm()). */}
      <ConfirmDialog
        open={deletingConsoId !== null}
        onOpenChange={(o) => !o && setDeletingConsoId(null)}
        title="Supprimer cette consommation ?"
        description="Le stock de l'aliment sera restauré. Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

// ============================================================
// Soins
// ============================================================

interface Soin {
  id: number
  date: string
  type: string
  description: string | null
  produit: string | null
  produitId: string | null
  dose: string | null
  voie: string | null
  motif: string | null
  ordonnanceUrl: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  veterinaire: string | null
  datePrevue: string | null
  fait: boolean
  notes: string | null
  animalId: number | null
  animal: { id: number; nom: string; identifiant: string } | null
  lot: { id: number; nom: string } | null
}

interface LotSoin { id: number; nom: string | null; quantiteActuelle: number }

const SOIN_TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  autre: "Autre",
}

function SoinsSubTab({ initialAnimalId = null }: { initialAnimalId?: string | null }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [soins, setSoins] = React.useState<Soin[]>([])
  const [lots, setLots] = React.useState<LotSoin[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [filterFait, setFilterFait] = React.useState<string>("all")
  // QA 2026-05-15 — édition par ligne
  const [editingSoinId, setEditingSoinId] = React.useState<number | null>(null)

  const EMPTY_SOIN_FORM = {
    cible: "lot" as "lot" | "animal",
    lotId: "",
    animalId: "",
    date: todayLocalISO(),
    type: "Vaccination",
    description: "",
    produit: "",
    produitId: "",
    dose: "",
    voie: "",
    motif: "",
    ordonnanceUrl: "",
    veterinaire: "",
    datePrevue: "",
    quantite: "", unite: "", cout: "", fait: true, notes: "",
  }
  const [formData, setFormData] = React.useState(EMPTY_SOIN_FORM)

  const resetSoinForm = () => {
    setEditingSoinId(null)
    setFormData(EMPTY_SOIN_FORM)
  }

  const handleEditSoin = (s: Soin) => {
    setEditingSoinId(s.id)
    setFormData({
      cible: s.animalId ? "animal" : "lot",
      lotId: s.lot?.id ? s.lot.id.toString() : "",
      animalId: s.animal?.id ? s.animal.id.toString() : "",
      date: s.date.split('T')[0],
      type: s.type ?? "Vaccination",
      description: s.description ?? "",
      produit: s.produit ?? "",
      produitId: s.produitId ?? "",
      dose: s.dose ?? "",
      voie: s.voie ?? "",
      motif: s.motif ?? "",
      ordonnanceUrl: s.ordonnanceUrl ?? "",
      veterinaire: s.veterinaire ?? "",
      datePrevue: s.datePrevue ? s.datePrevue.split('T')[0] : "",
      quantite: s.quantite ? s.quantite.toString() : "",
      unite: s.unite ?? "",
      cout: s.cout ? s.cout.toString() : "",
      fait: s.fait,
      notes: s.notes ?? "",
    })
    setIsDialogOpen(true)
  }
  const [animaux, setAnimaux] = React.useState<{ id: number; nom: string | null; identifiant: string | null; especeAnimale?: { nom?: string } }[]>([])
  const [produits, setProduits] = React.useState<{ id: string; nom: string; substanceActive: string | null; tempsAttenteLaitJ: number; tempsAttenteViandeJ: number; autoriseAB: boolean }[]>([])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = '/api/elevage/soins?limit=100'
      if (filterFait !== 'all') url += `&fait=${filterFait}`
      const [soinsRes, lotsRes, animauxRes, produitsRes] = await Promise.all([
        fetch(url),
        fetch('/api/elevage/lots?statut=actif'),
        fetch('/api/elevage/animaux?statut=actif'),
        fetch('/api/elevage/produits-veterinaires'),
      ])
      if (soinsRes.ok) setSoins((await soinsRes.json()).data)
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
      if (animauxRes.ok) setAnimaux((await animauxRes.json()).data)
      if (produitsRes.ok) setProduits((await produitsRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [filterFait, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Bug testeur 2026-05-31 — arrivée depuis « + Soin » d'une fiche animale :
  // on pré-ouvre le formulaire « Nouveau soin » ciblé sur cet animal. Ne se
  // déclenche qu'une fois (ref) pour ne pas ré-ouvrir après fermeture.
  const initialAnimalApplied = React.useRef(false)
  React.useEffect(() => {
    if (!initialAnimalId || initialAnimalApplied.current) return
    initialAnimalApplied.current = true
    setEditingSoinId(null)
    setFormData({ ...EMPTY_SOIN_FORM, cible: "animal", animalId: initialAnimalId })
    setIsDialogOpen(true)
  }, [initialAnimalId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        date: formData.date,
        type: formData.type,
        description: formData.description || null,
        produit: formData.produit || null,
        produitId: formData.produitId || null,
        dose: formData.dose || null,
        voie: formData.voie || null,
        motif: formData.motif || null,
        ordonnanceUrl: formData.ordonnanceUrl || null,
        veterinaire: formData.veterinaire || null,
        datePrevue: formData.datePrevue || null,
        quantite: formData.quantite ? parseFloat(formData.quantite) : null,
        unite: formData.unite || null,
        cout: formData.cout ? parseFloat(formData.cout) : null,
        fait: formData.fait,
        notes: formData.notes || null,
      }
      if (formData.cible === "animal") payload.animalId = formData.animalId ? parseInt(formData.animalId) : null
      else payload.lotId = formData.lotId ? parseInt(formData.lotId) : null

      const isEdit = editingSoinId !== null
      if (isEdit) payload.id = editingSoinId
      const response = await fetch('/api/elevage/soins', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok) {
        toast({ variant: "destructive", title: "Erreur", description: json.error || "Échec" })
        return
      }
      toast({
        title: isEdit ? "Soin mis à jour" : "Soin enregistré",
        description: json.info || undefined,
      })
      setIsDialogOpen(false)
      resetSoinForm()
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le soin" })
    }
  }

  const toggleFait = async (id: number, fait: boolean) => {
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fait: !fait, date: !fait ? new Date().toISOString() : undefined }),
      })
      if (!response.ok) throw new Error('Erreur')
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtres + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterFait} onValueChange={setFilterFait}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="false">À faire</SelectItem>
            <SelectItem value="true">Faits</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetSoinForm() }}>
            <DialogTrigger asChild><Button size="sm" onClick={() => setEditingSoinId(null)}><Plus className="h-4 w-4 mr-1" />Nouveau soin</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingSoinId ? "Modifier le soin" : "Enregistrer un soin"}</DialogTitle><DialogDescription>{editingSoinId ? `Édition du soin #${editingSoinId}` : "Vaccination, vermifuge, traitement..."}</DialogDescription></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 max-h-[70dvh] overflow-y-auto pr-2">
                {/* Cible : animal ou lot */}
                <div className="space-y-2">
                  <Label>Cible *</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={formData.cible === "animal" ? "default" : "outline"} onClick={() => setFormData(f => ({ ...f, cible: "animal", lotId: "" }))}>
                      Animal individuel
                    </Button>
                    <Button type="button" size="sm" variant={formData.cible === "lot" ? "default" : "outline"} onClick={() => setFormData(f => ({ ...f, cible: "lot", animalId: "" }))}>
                      Lot
                    </Button>
                  </div>
                  {formData.cible === "animal" ? (
                    <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.animalId} onChange={(e) => setFormData(f => ({ ...f, animalId: e.target.value }))}>
                      <option value="">— Sélectionner un animal —</option>
                      {animaux.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nom || a.identifiant || `#${a.id}`}{a.especeAnimale?.nom ? ` (${a.especeAnimale.nom})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.lotId} onChange={(e) => setFormData(f => ({ ...f, lotId: e.target.value }))}>
                      <option value="">— Sélectionner un lot —</option>
                      {lots.map(l => <option key={l.id} value={l.id}>{l.nom || `Lot #${l.id}`}</option>)}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.type} onChange={(e) => setFormData(f => ({ ...f, type: e.target.value }))}>
                      <option value="Vaccination">Vaccination</option>
                      <option value="Vermifuge">Vermifuge</option>
                      <option value="Traitement vétérinaire">Traitement vétérinaire</option>
                      <option value="Tonte">Tonte</option>
                      <option value="Parage onglons">Parage onglons</option>
                      <option value="Castration">Castration</option>
                      <option value="Identification">Identification</option>
                      <option value="Prophylaxie obligatoire">Prophylaxie obligatoire</option>
                      <option value="Coproscopie">Coproscopie</option>
                      <option value="Mise en lutte">Mise en lutte</option>
                      <option value="Tarissement">Tarissement</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>

                {/* Produit vétérinaire */}
                <div className="space-y-2">
                  <Label>Produit vétérinaire (référentiel)</Label>
                  <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.produitId} onChange={(e) => {
                    const p = produits.find(x => x.id === e.target.value)
                    setFormData(f => ({ ...f, produitId: e.target.value, produit: p?.nom || f.produit }))
                  }}>
                    <option value="">— Aucun (saisie libre) —</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nom} {p.substanceActive ? `(${p.substanceActive})` : ""} — TA lait {p.tempsAttenteLaitJ}j / viande {p.tempsAttenteViandeJ}j{p.autoriseAB ? " ✓AB" : ""}
                      </option>
                    ))}
                  </select>
                  <Input value={formData.produit} onChange={(e) => setFormData(f => ({ ...f, produit: e.target.value }))} placeholder="Libellé produit (si saisie libre)" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Dose</Label><Input value={formData.dose} onChange={(e) => setFormData(f => ({ ...f, dose: e.target.value }))} placeholder="2 ml/10 kg" /></div>
                  <div className="space-y-2">
                    <Label>Voie</Label>
                    <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.voie} onChange={(e) => setFormData(f => ({ ...f, voie: e.target.value }))}>
                      <option value="">—</option>
                      <option value="IM">IM</option>
                      <option value="SC">SC</option>
                      <option value="IV">IV</option>
                      <option value="PO">PO (orale)</option>
                      <option value="Local">Local</option>
                      <option value="IN">IN (nasale)</option>
                      <option value="Vaginal">Vaginal</option>
                      <option value="Intra-mamm.">Intra-mamm.</option>
                      <option value="Pour-on">Pour-on</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div className="space-y-2"><Label>Coût (€)</Label><Input type="number" step="0.01" value={formData.cout} onChange={(e) => setFormData(f => ({ ...f, cout: e.target.value }))} /></div>
                </div>

                <div className="space-y-2">
                  <Label>Motif clinique</Label>
                  <Input value={formData.motif} onChange={(e) => setFormData(f => ({ ...f, motif: e.target.value }))} placeholder="Indication, symptômes..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Vétérinaire</Label>
                    <Input value={formData.veterinaire} onChange={(e) => setFormData(f => ({ ...f, veterinaire: e.target.value }))} placeholder="Nom (registre sanitaire)" />
                  </div>
                  <div className="space-y-2">
                    <Label>URL ordonnance (PDF)</Label>
                    <Input value={formData.ordonnanceUrl} onChange={(e) => setFormData(f => ({ ...f, ordonnanceUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Quantité</Label><Input type="number" step="0.01" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Unité</Label><Input value={formData.unite} onChange={(e) => setFormData(f => ({ ...f, unite: e.target.value }))} placeholder="mL, doses..." /></div>
                </div>

                <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="flex items-center gap-2">
                    <Checkbox id="fait" checked={formData.fait} onCheckedChange={(c) => setFormData(f => ({ ...f, fait: !!c }))} />
                    <Label htmlFor="fait">Déjà effectué</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Rappel planifié (date)</Label>
                    <Input type="date" value={formData.datePrevue} onChange={(e) => setFormData(f => ({ ...f, datePrevue: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={formData.cible === "lot" ? !formData.lotId : !formData.animalId}>Enregistrer</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lot/Animal</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soins.map((soin) => {
                  // Bug feedback testeur 2026-05-26 (cmplp16kb) — afficher
                  // distinctement la date prévue et la date de réalisation
                  // pour ne pas perdre l'historique du planning. Badge "En
                  // retard" en rouge si datePrevue < aujourd'hui et !fait.
                  const dateAffichee = soin.datePrevue ?? soin.date
                  const enRetard =
                    !soin.fait &&
                    !!soin.datePrevue &&
                    new Date(soin.datePrevue) < new Date(new Date().toDateString())
                  const realiseDiffPrevue =
                    soin.fait &&
                    !!soin.datePrevue &&
                    new Date(soin.datePrevue).toDateString() !== new Date(soin.date).toDateString()
                  // Bug feedback testeur 2026-05-31 — un soin marqué "fait" à une
                  // date antérieure à sa date prévue (réalisation anticipée) est
                  // souvent un clic par erreur : on le signale en ambre au lieu
                  // du vert "réalisé normalement". Non bloquant (l'avance peut
                  // être volontaire en élevage).
                  const realiseEnAvance =
                    realiseDiffPrevue &&
                    new Date(soin.date) < new Date(new Date(soin.datePrevue!).toDateString())
                  return (
                  <TableRow key={soin.id} className={!soin.fait ? (enRetard ? "bg-red-50" : "bg-blue-50") : ""}>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => toggleFait(soin.id, soin.fait)} title={soin.fait ? "Marquer non fait" : "Marquer fait"} className={soin.fait ? "text-green-600" : "text-slate-400"}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditSoin(soin)} title="Modifier" className="text-slate-600 hover:text-slate-900">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{new Date(dateAffichee).toLocaleDateString('fr-FR')}</span>
                        {enRetard && (
                          <span className="text-[10px] font-medium text-red-700 uppercase tracking-wide">En retard</span>
                        )}
                        {realiseDiffPrevue && (
                          <span className={`text-[10px] ${realiseEnAvance ? "font-medium text-amber-700" : "text-emerald-700"}`}>
                            {realiseEnAvance ? "Fait en avance le " : "Fait le "}
                            {new Date(soin.date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{SOIN_TYPE_LABELS[soin.type] || soin.type}</Badge></TableCell>
                    <TableCell>{soin.lot?.nom || soin.animal?.nom || '-'}</TableCell>
                    <TableCell>{soin.produit || '-'}</TableCell>
                    <TableCell className="text-right">{soin.cout ? `${soin.cout.toFixed(2)} \u20ac` : '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{soin.notes || '-'}</TableCell>
                  </TableRow>
                  )
                })}
                {soins.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun soin enregistré</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
