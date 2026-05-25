"use client"

/**
 * Onglet Animaux - Animaux individuels + Lots en sous-onglets
 */

import * as React from "react"
import Link from "next/link"
import {
  Bird,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Filter,
  Stethoscope,
  Scissors,
  ShoppingCart,
  Skull,
  Trash2,
  Map as MapIcon,
  FileText,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { especeBaseId, especeBaseLabel, listEspecesBasePresentes } from "@/lib/elevage/espece-base"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"

// ============================================================
// Types
// ============================================================

interface Animal {
  id: number
  identifiant: string | null
  typeIdentifiant: string | null
  nom: string | null
  race: string | null
  sexe: string | null
  dateNaissance: string | null
  dateArrivee: string | null
  statut: string
  poidsActuel: number | null
  provenance: string | null
  nExploitationOrigine: string | null
  prixAchat: number | null
  notes: string | null
  especeAnimale: {
    id: string
    nom: string
    type: string
    couleur: string | null
    poidsAdulte: number | null
  }
  lot: { id: number; nom: string } | null
  _count: {
    productionsOeufs: number
    soins: number
    enfants: number
  }
}

interface Lot {
  id: number
  nom: string | null
  dateArrivee: string | null
  quantiteInitiale: number
  quantiteActuelle: number
  provenance: string | null
  prixAchatTotal: number | null
  notes: string | null
  statut: string
  parcelleGeo: { id: string; nom: string } | null
  especeAnimale: { id: string; nom: string; type: string; couleur: string | null }
  _count: { animaux: number; productionsOeufs: number; soins: number }
}

interface Parcelle {
  id: string
  nom: string
}

interface EspeceAnimale {
  id: string
  nom: string
  type: string
}

const STATUT_COLORS: Record<string, string> = {
  actif: "bg-green-100 text-green-800",
  vendu: "bg-blue-100 text-blue-800",
  abattu: "bg-red-100 text-red-800",
  mort: "bg-slate-100 text-slate-800",
  reforme: "bg-orange-100 text-orange-800",
  termine: "bg-slate-100 text-slate-800",
}

// ============================================================
// Composant principal
// ============================================================

export function AnimauxTab() {
  return (
    <Tabs defaultValue="animaux" className="space-y-4">
      <TabsList>
        <TabsTrigger value="animaux" className="flex items-center gap-1.5">
          <Bird className="h-4 w-4" />
          Animaux
        </TabsTrigger>
        <TabsTrigger value="lots" className="flex items-center gap-1.5">
          <Bird className="h-4 w-4" />
          Lots
        </TabsTrigger>
      </TabsList>

      <TabsContent value="animaux">
        <AnimauxSubTab />
      </TabsContent>
      <TabsContent value="lots">
        <LotsSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Animaux individuels
// ============================================================

function AnimauxSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [animaux, setAnimaux] = React.useState<Animal[]>([])
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [search, setSearch] = React.useState("")
  const [filterEspece, setFilterEspece] = React.useState<string>("all")
  const [filterStatut, setFilterStatut] = React.useState<string>("actif")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  // QA 2026-05-15 — édition par ligne pour les animaux
  const [editingAnimalId, setEditingAnimalId] = React.useState<number | null>(null)

  const EMPTY_ANIMAL_FORM = {
    especeAnimaleId: "", identifiant: "", typeIdentifiant: "",
    nom: "", race: "", sexe: "",
    dateNaissance: "", dateArrivee: new Date().toISOString().split('T')[0],
    provenance: "", nExploitationOrigine: "",
    prixAchat: "", poidsActuel: "", notes: "",
  }
  const [formData, setFormData] = React.useState(EMPTY_ANIMAL_FORM)

  const resetAnimalForm = () => {
    setEditingAnimalId(null)
    setFormData(EMPTY_ANIMAL_FORM)
  }

  const handleEditAnimal = (a: Animal) => {
    setEditingAnimalId(a.id)
    setFormData({
      especeAnimaleId: a.especeAnimale.id,
      identifiant: a.identifiant ?? "",
      typeIdentifiant: a.typeIdentifiant ?? "",
      nom: a.nom ?? "",
      race: a.race ?? "",
      sexe: a.sexe ?? "",
      dateNaissance: a.dateNaissance ? a.dateNaissance.split('T')[0] : "",
      dateArrivee: a.dateArrivee ? a.dateArrivee.split('T')[0] : new Date().toISOString().split('T')[0],
      provenance: a.provenance ?? "",
      nExploitationOrigine: a.nExploitationOrigine ?? "",
      prixAchat: a.prixAchat ? a.prixAchat.toString() : "",
      poidsActuel: a.poidsActuel ? a.poidsActuel.toString() : "",
      notes: a.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  // QA Julien 2026-05-15 — Bug #9 : on ne filtre plus serveur sur
  // l'espece+race exacte (Lacaune, Sussex…) mais sur l'espèce de base
  // (Poule, Brebis…), donc on charge la liste sans ce filtre et on
  // filtre côté client dans `filteredAnimaux`. Le filtre statut reste
  // serveur (volume potentiellement gros).
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = '/api/elevage/animaux?'
      if (filterStatut !== 'all') url += `statut=${filterStatut}&`

      const [animauxRes, especesRes] = await Promise.all([
        fetch(url),
        fetch('/api/elevage/especes-animales'),
      ])

      if (animauxRes.ok) setAnimaux((await animauxRes.json()).data)
      if (especesRes.ok) setEspeces((await especesRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [filterStatut, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Bug cmp8sagud (Marc 2026-05-16) — Toast générique "Impossible
    // d'enregistrer" sans détail. On récupère désormais le message
    // d'erreur retourné par l'API (zod flatten ou message custom) pour
    // pointer le champ fautif.
    try {
      const isEdit = editingAnimalId !== null
      const body = isEdit
        ? { id: editingAnimalId, ...formData }
        : formData
      const response = await fetch('/api/elevage/animaux', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const fieldErrors = payload?.details?.fieldErrors as Record<string, string[]> | undefined
        const firstField = fieldErrors ? Object.entries(fieldErrors).find(([, v]) => v.length > 0) : null
        const description = firstField
          ? `${firstField[0]} : ${firstField[1][0]}`
          : payload?.error || "Impossible d'enregistrer"
        throw new Error(description)
      }
      toast({ title: isEdit ? "Animal mis à jour" : "Animal créé" })
      setIsDialogOpen(false)
      resetAnimalForm()
      fetchData()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
    }
  }

  const [animalToDelete, setAnimalToDelete] = React.useState<Animal | null>(null)

  const handleDelete = (animal: Animal) => {
    setAnimalToDelete(animal)
  }

  const confirmDelete = async () => {
    if (!animalToDelete) return
    try {
      await fetch(`/api/elevage/animaux/${animalToDelete.id}`, { method: 'DELETE' })
      toast({ title: "Animal supprimé" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // --- Dialogs abattage / vente / mort ---
  const [abattageDialog, setAbattageDialog] = React.useState<Animal | null>(null)
  const [abattageForm, setAbattageForm] = React.useState({
    date: new Date().toISOString().split('T')[0],
    poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "",
  })

  const [venteDialog, setVenteDialog] = React.useState<Animal | null>(null)
  const [venteForm, setVenteForm] = React.useState({
    date: new Date().toISOString().split('T')[0],
    prixUnitaire: "", client: "", description: "", notes: "",
  })

  const [mortDialog, setMortDialog] = React.useState<Animal | null>(null)
  const [mortForm, setMortForm] = React.useState({
    date: new Date().toISOString().split('T')[0],
    cause: "", notes: "",
  })

  const handleAbattageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!abattageDialog) return
    try {
      const res = await fetch('/api/elevage/abattages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId: abattageDialog.id,
          date: abattageForm.date,
          quantite: 1,
          poidsVif: abattageForm.poidsVif ? parseFloat(abattageForm.poidsVif) : null,
          poidsCarcasse: abattageForm.poidsCarcasse ? parseFloat(abattageForm.poidsCarcasse) : null,
          destination: abattageForm.destination,
          prixVente: abattageForm.prixVente ? parseFloat(abattageForm.prixVente) : null,
          lieu: abattageForm.lieu || null,
          notes: abattageForm.notes || null,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: "Abattage enregistré", description: `${abattageDialog.nom || abattageDialog.identifiant || ''} marqué comme abattu` })
      setAbattageDialog(null)
      setAbattageForm({ date: new Date().toISOString().split('T')[0], poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'abattage" })
    }
  }

  const handleVenteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!venteDialog) return
    try {
      // Créer la vente
      const venteRes = await fetch('/api/elevage/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: venteForm.date,
          type: "animal_vivant",
          description: venteForm.description || `${venteDialog.nom || venteDialog.identifiant || ''} (${venteDialog.especeAnimale.nom})`,
          quantite: 1,
          unite: "unite",
          prixUnitaire: venteForm.prixUnitaire ? parseFloat(venteForm.prixUnitaire) : 0,
          client: venteForm.client || null,
          paye: true,
          notes: venteForm.notes || null,
        }),
      })
      if (!venteRes.ok) throw new Error('Erreur vente')
      // Marquer l'animal comme vendu
      await fetch(`/api/elevage/animaux/${venteDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'vendu', dateSortie: venteForm.date }),
      })
      toast({ title: "Vente enregistrée", description: `${venteDialog.nom || venteDialog.identifiant || ''} marque comme vendu` })
      setVenteDialog(null)
      setVenteForm({ date: new Date().toISOString().split('T')[0], prixUnitaire: "", client: "", description: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer la vente" })
    }
  }

  const handleMortSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mortDialog) return
    try {
      const res = await fetch(`/api/elevage/animaux/${mortDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statut: 'mort',
          dateSortie: mortForm.date,
          causeSortie: mortForm.cause || 'Mort',
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: "Décès enregistré", description: `${mortDialog.nom || mortDialog.identifiant || ''} marqué comme mort` })
      setMortDialog(null)
      setMortForm({ date: new Date().toISOString().split('T')[0], cause: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // QA Julien 2026-05-15 — Bug #9 : on dérive l'espèce de base
  // (Poule, Brebis…) depuis l'id de l'espèce animale et on filtre
  // côté client. Liste des espèces présentes calculée sur l'ensemble
  // chargé (avant filtre espèce) → dropdown stable.
  const especesPresentes = React.useMemo(
    () => listEspecesBasePresentes(animaux.map((a) => ({ especeAnimaleId: a.especeAnimale.id }))),
    [animaux]
  )

  const filteredAnimaux = animaux.filter(a => {
    if (filterEspece !== 'all' && especeBaseId(a.especeAnimale.id) !== filterEspece) {
      return false
    }
    if (!search) return true
    const s = search.toLowerCase()
    return (
      a.nom?.toLowerCase().includes(s) ||
      a.identifiant?.toLowerCase().includes(s) ||
      a.race?.toLowerCase().includes(s) ||
      a.especeAnimale.nom.toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[200px]"
          />
        </div>
        {/* QA Julien 2026-05-15 — Bug #9 : on liste les espèces de
            base réellement présentes (Poule/Brebis/Chèvre/Cochon/Vache)
            au lieu de tout le référentiel races. */}
        <Select value={filterEspece} onValueChange={setFilterEspece}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Espèce" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les espèces</SelectItem>
            {especesPresentes.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="actif">Actifs</SelectItem>
            <SelectItem value="vendu">Vendus</SelectItem>
            <SelectItem value="abattu">Abattus</SelectItem>
            <SelectItem value="mort">Morts</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">
          {filteredAnimaux.length} animal(aux)
        </div>
        <a
          href={`/api/elevage/registre-elevage?year=${new Date().getFullYear()}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="outline" size="sm" title="Registre d'élevage PDF (arrêté 5 juin 2000)">
            <FileText className="h-4 w-4 mr-1" />
            Registre
          </Button>
        </a>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetAnimalForm() }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingAnimalId(null)}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAnimalId ? "Modifier l'animal" : "Nouvel animal"}</DialogTitle>
              <DialogDescription>{editingAnimalId ? `Édition de l'animal #${editingAnimalId}` : "Ajouter un animal individuel"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Espèce *</Label>
                <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {especes.map(e => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Identifiant principal</Label>
                  <Input value={formData.identifiant} onChange={(e) => setFormData(f => ({ ...f, identifiant: e.target.value }))} placeholder="BDNI/IPG/SIRE..." />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.typeIdentifiant} onChange={(e) => setFormData(f => ({ ...f, typeIdentifiant: e.target.value }))}>
                    <option value="">— Non typé —</option>
                    <option value="BDNI bovin">BDNI bovin</option>
                    <option value="IPG ovin">IPG ovin</option>
                    <option value="IPG caprin">IPG caprin</option>
                    <option value="IPG porcin">IPG porcin</option>
                    <option value="SIRE équin">SIRE équin</option>
                    <option value="Bague volière">Bague volière</option>
                    <option value="Boucle aux.">Boucle aux.</option>
                    <option value="Puce RFID">Puce RFID</option>
                    <option value="Auxiliaire éleveur">Auxiliaire éleveur</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom (usuel)</Label>
                  <Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>N° exploitation origine</Label>
                  <Input value={formData.nExploitationOrigine} onChange={(e) => setFormData(f => ({ ...f, nExploitationOrigine: e.target.value }))} placeholder="(optionnel)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Race</Label>
                  <Input value={formData.race} onChange={(e) => setFormData(f => ({ ...f, race: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sexe</Label>
                  <Select value={formData.sexe} onValueChange={(v) => setFormData(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="femelle">Femelle</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="inconnu">Inconnu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date naissance</Label>
                  <Input type="date" value={formData.dateNaissance} onChange={(e) => setFormData(f => ({ ...f, dateNaissance: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Date arrivee</Label>
                  <Input type="date" value={formData.dateArrivee} onChange={(e) => setFormData(f => ({ ...f, dateArrivee: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prix achat</Label>
                  <Input type="number" step="0.01" value={formData.prixAchat} onChange={(e) => setFormData(f => ({ ...f, prixAchat: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Poids (kg)</Label>
                  <Input type="number" step="0.1" value={formData.poidsActuel} onChange={(e) => setFormData(f => ({ ...f, poidsActuel: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.especeAnimaleId}>
                  {editingAnimalId ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifiant</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead>Race</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimaux.map((animal) => (
                  <TableRow key={animal.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{animal.identifiant || '-'}</TableCell>
                    <TableCell>
                      {/* Bug #19 — Le nom n'était pas cliquable malgré
                          l'attente utilisateur (l'identifiant en fil
                          d'ariane est déjà un lien). */}
                      {animal.nom ? (
                        <Link href={`/elevage/animaux/${animal.id}`} className="hover:underline text-blue-700">
                          {animal.nom}
                        </Link>
                      ) : '-'}
                    </TableCell>
                    {/* QA Julien 2026-05-15 — Bug #10 : colonne Espèce
                        toujours visible et stable, affichage du libellé
                        de base (Poule / Brebis…) — la race est dans la
                        colonne suivante, plus de duplication "Poule
                        Marans · Marans". */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {animal.especeAnimale.couleur && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: animal.especeAnimale.couleur }} />
                        )}
                        {especeBaseLabel(animal.especeAnimale.id)}
                      </div>
                    </TableCell>
                    <TableCell>{animal.race || '-'}</TableCell>
                    <TableCell>
                      {animal.sexe === 'femelle' ? '\u2640' : animal.sexe === 'male' ? '\u2642' : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUT_COLORS[animal.statut] || ''}>{animal.statut}</Badge>
                    </TableCell>
                    <TableCell>{animal.lot?.nom || '-'}</TableCell>
                    <TableCell className="text-right">
                      {/* Bug cmp8sf92p (Marc 2026-05-16) — la colonne Poids
                          affichait "-" alors que la fiche montrait "Adulte:65kg".
                          On affiche le poids actuel s'il existe, sinon le poids
                          adulte de l'espèce comme référence avec une mise en
                          forme atténuée. */}
                      {animal.poidsActuel
                        ? `${animal.poidsActuel} kg`
                        : animal.especeAnimale.poidsAdulte
                          ? <span className="text-muted-foreground italic">≈{animal.especeAnimale.poidsAdulte} kg</span>
                          : '-'}
                    </TableCell>
                    <TableCell>
                      {animal.statut === 'actif' && (
                        <TooltipProvider delayDuration={100}>
                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {/* Bug #19 — Le tooltip "Fiche animal"
                                    sur un stéthoscope laissait croire à
                                    une saisie de soin. On clarifie + on
                                    ancre la fiche sur la section soins
                                    pour limiter le détour. */}
                                <Link
                                  href={`/elevage/animaux/${animal.id}#soins`}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 inline-flex"
                                >
                                  <Stethoscope className="h-3.5 w-3.5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>Fiche &amp; soins</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleEditAnimal(animal)}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Modifier la saisie</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setVenteForm(f => ({ ...f, date: new Date().toISOString().split('T')[0] })); setVenteDialog(animal) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Vendre</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setAbattageForm(f => ({ ...f, date: new Date().toISOString().split('T')[0], poidsVif: animal.poidsActuel?.toString() || "" })); setAbattageDialog(animal) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
                                >
                                  <Scissors className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Abattage</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setMortForm(f => ({ ...f, date: new Date().toISOString().split('T')[0] })); setMortDialog(animal) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                >
                                  <Skull className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Deces</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      )}
                      {animal.statut !== 'actif' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(animal)}
                          className="text-red-600 hover:text-red-700"
                        >
                          &times;
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAnimaux.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucun animal trouve
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Abattage */}
      <Dialog open={!!abattageDialog} onOpenChange={(open) => { if (!open) setAbattageDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-red-500" />
              Enregistrer un abattage
            </DialogTitle>
            <DialogDescription>
              {abattageDialog?.nom || abattageDialog?.identifiant || ''} — {abattageDialog?.especeAnimale.nom} {abattageDialog?.race ? `(${abattageDialog.race})` : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAbattageSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={abattageForm.date} onChange={(e) => setAbattageForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Select value={abattageForm.destination} onValueChange={(v) => setAbattageForm(f => ({ ...f, destination: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_consommation">Auto-consommation</SelectItem>
                    <SelectItem value="vente">Vente</SelectItem>
                    <SelectItem value="don">Don</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poids vif (kg)</Label>
                <Input type="number" step="0.1" value={abattageForm.poidsVif} onChange={(e) => setAbattageForm(f => ({ ...f, poidsVif: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Poids carcasse (kg)</Label>
                <Input type="number" step="0.1" value={abattageForm.poidsCarcasse} onChange={(e) => setAbattageForm(f => ({ ...f, poidsCarcasse: e.target.value }))} />
              </div>
            </div>
            {abattageForm.poidsVif && abattageForm.poidsCarcasse && (
              <div className="text-center py-1 bg-slate-50 rounded text-sm text-muted-foreground">
                Rendement : {((parseFloat(abattageForm.poidsCarcasse) / parseFloat(abattageForm.poidsVif)) * 100).toFixed(1)}%
              </div>
            )}
            {abattageForm.destination === 'vente' && (
              <div className="space-y-2">
                <Label>Prix de vente (€)</Label>
                <Input type="number" step="0.01" value={abattageForm.prixVente} onChange={(e) => setAbattageForm(f => ({ ...f, prixVente: e.target.value }))} placeholder="Prix total" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Lieu</Label>
              <Input value={abattageForm.lieu} onChange={(e) => setAbattageForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Lieu d'abattage" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={abattageForm.notes} onChange={(e) => setAbattageForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAbattageDialog(null)}>Annuler</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">Enregistrer l'abattage</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Vente */}
      <Dialog open={!!venteDialog} onOpenChange={(open) => { if (!open) setVenteDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              Enregistrer une vente
            </DialogTitle>
            <DialogDescription>
              {venteDialog?.nom || venteDialog?.identifiant || ''} — {venteDialog?.especeAnimale.nom} {venteDialog?.race ? `(${venteDialog.race})` : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVenteSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={venteForm.date} onChange={(e) => setVenteForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Prix de vente (€) *</Label>
                <Input type="number" step="0.01" value={venteForm.prixUnitaire} onChange={(e) => setVenteForm(f => ({ ...f, prixUnitaire: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input value={venteForm.client} onChange={(e) => setVenteForm(f => ({ ...f, client: e.target.value }))} placeholder="Nom du client" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={venteForm.description} onChange={(e) => setVenteForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Poulet fermier plein air" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={venteForm.notes} onChange={(e) => setVenteForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setVenteDialog(null)}>Annuler</Button>
              <Button type="submit" disabled={!venteForm.prixUnitaire}>Enregistrer la vente</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Mort */}
      <Dialog open={!!mortDialog} onOpenChange={(open) => { if (!open) setMortDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-slate-500" />
              Enregistrer un décès
            </DialogTitle>
            <DialogDescription>
              {mortDialog?.nom || mortDialog?.identifiant || ''} — {mortDialog?.especeAnimale.nom}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMortSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={mortForm.date} onChange={(e) => setMortForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cause du décès</Label>
              <Select value={mortForm.cause} onValueChange={(v) => setMortForm(f => ({ ...f, cause: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Maladie">Maladie</SelectItem>
                  <SelectItem value="Predateur">Prédateur</SelectItem>
                  <SelectItem value="Accident">Accident</SelectItem>
                  <SelectItem value="Vieillesse">Vieillesse</SelectItem>
                  <SelectItem value="Cause inconnue">Cause inconnue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={mortForm.notes} onChange={(e) => setMortForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Détails supplémentaires..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMortDialog(null)}>Annuler</Button>
              <Button type="submit" variant="destructive">Confirmer le décès</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={animalToDelete !== null}
        onOpenChange={(open) => !open && setAnimalToDelete(null)}
        entityLabel={
          animalToDelete
            ? `l'animal ${animalToDelete.nom || animalToDelete.identifiant || `#${animalToDelete.id}`}`
            : ""
        }
        dependencies={
          animalToDelete?._count
            ? [
                { label: "soins / traitements", count: animalToDelete._count.soins },
                { label: "productions d'œufs", count: animalToDelete._count.productionsOeufs },
                { label: "enregistrements de naissances (descendants)", count: animalToDelete._count.enfants },
              ]
            : []
        }
        warning={
          animalToDelete?._count?.enfants
            ? "Les liens de parenté seront rompus mais les descendants resteront enregistrés."
            : undefined
        }
        onConfirm={confirmDelete}
      />
    </div>
  )
}

// ============================================================
// Lots
// ============================================================

function LotsSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [lots, setLots] = React.useState<Lot[]>([])
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [parcelles, setParcelles] = React.useState<Parcelle[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  // QA 2026-05-15 — édition par ligne
  const [editingLotId, setEditingLotId] = React.useState<number | null>(null)

  const EMPTY_LOT_FORM = {
    especeAnimaleId: "", nom: "",
    dateArrivee: new Date().toISOString().split('T')[0],
    quantiteInitiale: "", provenance: "", prixAchatTotal: "", notes: "",
    parcelleGeoId: "",
  }
  const [formData, setFormData] = React.useState(EMPTY_LOT_FORM)

  const resetLotForm = () => {
    setEditingLotId(null)
    setFormData(EMPTY_LOT_FORM)
  }

  const handleEditLot = (lot: Lot) => {
    setEditingLotId(lot.id)
    setFormData({
      especeAnimaleId: lot.especeAnimale.id,
      nom: lot.nom ?? "",
      dateArrivee: lot.dateArrivee ? lot.dateArrivee.split('T')[0] : new Date().toISOString().split('T')[0],
      quantiteInitiale: lot.quantiteInitiale.toString(),
      provenance: lot.provenance ?? "",
      prixAchatTotal: lot.prixAchatTotal ? lot.prixAchatTotal.toString() : "",
      notes: lot.notes ?? "",
      parcelleGeoId: lot.parcelleGeo?.id ?? "",
    })
    setIsDialogOpen(true)
  }

  // Dialog abattage lot
  const [abatLotDialog, setAbatLotDialog] = React.useState<Lot | null>(null)
  const [abatLotForm, setAbatLotForm] = React.useState({
    date: new Date().toISOString().split('T')[0],
    quantite: "1", poidsVif: "", poidsCarcasse: "",
    destination: "auto_consommation", prixVente: "", lieu: "", notes: "",
  })

  const handleAbatLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!abatLotDialog) return
    try {
      const res = await fetch('/api/elevage/abattages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: abatLotDialog.id,
          date: abatLotForm.date,
          quantite: parseInt(abatLotForm.quantite) || 1,
          poidsVif: abatLotForm.poidsVif ? parseFloat(abatLotForm.poidsVif) : null,
          poidsCarcasse: abatLotForm.poidsCarcasse ? parseFloat(abatLotForm.poidsCarcasse) : null,
          destination: abatLotForm.destination,
          prixVente: abatLotForm.prixVente ? parseFloat(abatLotForm.prixVente) : null,
          lieu: abatLotForm.lieu || null,
          notes: abatLotForm.notes || null,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: "Abattage enregistré", description: `${abatLotForm.quantite} animal(aux) du lot ${abatLotDialog.nom || `#${abatLotDialog.id}`}` })
      setAbatLotDialog(null)
      setAbatLotForm({ date: new Date().toISOString().split('T')[0], quantite: "1", poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'abattage" })
    }
  }

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [lotsRes, especesRes, parcellesRes] = await Promise.all([
        fetch('/api/elevage/lots'),
        fetch('/api/elevage/especes-animales'),
        fetch('/api/carte'),
      ])
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
      if (especesRes.ok) setEspeces((await especesRes.json()).data)
      if (parcellesRes.ok) setParcelles(await parcellesRes.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const isEdit = editingLotId !== null
      const body = isEdit ? { id: editingLotId, ...formData } : formData
      const response = await fetch('/api/elevage/lots', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({
        title: isEdit ? "Lot mis à jour" : "Lot créé",
        description: isEdit ? undefined : `${formData.quantiteInitiale} animaux ajoutés`,
      })
      setIsDialogOpen(false)
      resetLotForm()
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lots.length} lot(s) &bull; {lots.reduce((sum, l) => sum + l.quantiteActuelle, 0)} animaux au total
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetLotForm() }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingLotId(null)}><Plus className="h-4 w-4 mr-1" />Nouveau lot</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingLotId ? "Modifier le lot" : "Créer un lot"}</DialogTitle>
                <DialogDescription>{editingLotId ? `Édition du lot #${editingLotId}` : "Groupe d'animaux (volailles, etc.)"}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Espèce *</Label>
                  <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {especes.map(e => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom du lot</Label>
                    <Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} placeholder="Lot pondeuses 2024" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantité *</Label>
                    <Input type="number" value={formData.quantiteInitiale} onChange={(e) => setFormData(f => ({ ...f, quantiteInitiale: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date arrivee</Label>
                    <Input type="date" value={formData.dateArrivee} onChange={(e) => setFormData(f => ({ ...f, dateArrivee: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix total</Label>
                    <Input type="number" step="0.01" value={formData.prixAchatTotal} onChange={(e) => setFormData(f => ({ ...f, prixAchatTotal: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provenance</Label>
                    <Input value={formData.provenance} onChange={(e) => setFormData(f => ({ ...f, provenance: e.target.value }))} placeholder="Couvoir, eleveur..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelle</Label>
                    <Select value={formData.parcelleGeoId} onValueChange={(v) => setFormData(f => ({ ...f, parcelleGeoId: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {parcelles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={!formData.especeAnimaleId || !formData.quantiteInitiale}>
                    {editingLotId ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead className="text-right">Initial</TableHead>
                  <TableHead className="text-right">Actuel</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Parcelle</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* QA Julien 2026-05-15 — Bug #11 : ligne lot cliquable
                    vers la fiche dédiée /elevage/lots/[id]. */}
                {lots.map((lot) => (
                  <TableRow
                    key={lot.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => {
                      // Ne pas naviguer si l'utilisateur clique sur un
                      // lien interne ou un bouton (ex: parcelle, sortir)
                      if ((e.target as HTMLElement).closest('a, button')) return
                      window.location.href = `/elevage/lots/${lot.id}`
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/elevage/lots/${lot.id}`} className="hover:underline">
                        {lot.nom || `Lot #${lot.id}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {lot.especeAnimale.couleur && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lot.especeAnimale.couleur }} />}
                        {especeBaseLabel(lot.especeAnimale.id)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{lot.quantiteInitiale}</TableCell>
                    <TableCell className="text-right font-bold">
                      {(() => {
                        // Bug #18 — Signaler les écarts initial → actuel non
                        // tracés (ni naissances dans le lot, ni transferts).
                        const l = lot as typeof lot & { naissancesVivantes?: number }
                        const naissances = l.naissancesVivantes ?? 0
                        const ecart = lot.quantiteActuelle - lot.quantiteInitiale
                        const ecartNonTrace = ecart - naissances
                        if (ecartNonTrace > 0) {
                          return (
                            <span title={`+${ecart} animaux dont ${naissances} naissance(s) enregistrée(s). Écart non documenté : ${ecartNonTrace}.`} className="inline-flex items-center gap-1">
                              {lot.quantiteActuelle}
                              <span className="text-amber-600 text-xs">⚠️</span>
                            </span>
                          )
                        }
                        return lot.quantiteActuelle
                      })()}
                    </TableCell>
                    <TableCell>{lot.dateArrivee ? new Date(lot.dateArrivee).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell>
                      {lot.parcelleGeo ? (
                        <Link href={`/jardin/carte?parcelle=${lot.parcelleGeo.id}`} className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 hover:underline">
                          <MapIcon className="h-3 w-3" />
                          {lot.parcelleGeo.nom}
                        </Link>
                      ) : (
                        <ParcelleAssignButton lotId={lot.id} parcelles={parcelles} onAssigned={fetchData} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">{lot.prixAchatTotal ? `${lot.prixAchatTotal.toFixed(2)} \u20ac` : '-'}</TableCell>
                    <TableCell><Badge className={STATUT_COLORS[lot.statut] || ''}>{lot.statut}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleEditLot(lot)}
                                className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-700"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier le lot</TooltipContent>
                          </Tooltip>
                          {lot.statut === 'actif' && lot.quantiteActuelle > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setAbatLotForm(f => ({ ...f, date: new Date().toISOString().split('T')[0], quantite: "1" })); setAbatLotDialog(lot) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
                                >
                                  <Scissors className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Abattage</TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {lots.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun lot enregistré</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog abattage lot */}
      <Dialog open={!!abatLotDialog} onOpenChange={(open) => { if (!open) setAbatLotDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-red-500" />
              Abattage depuis un lot
            </DialogTitle>
            <DialogDescription>
              {abatLotDialog?.nom || `Lot #${abatLotDialog?.id}`} — {abatLotDialog?.especeAnimale.nom} ({abatLotDialog?.quantiteActuelle} restants)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAbatLotSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={abatLotForm.date} onChange={(e) => setAbatLotForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Quantité *</Label>
                <Input type="number" min="1" max={abatLotDialog?.quantiteActuelle || 999} value={abatLotForm.quantite} onChange={(e) => setAbatLotForm(f => ({ ...f, quantite: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Select value={abatLotForm.destination} onValueChange={(v) => setAbatLotForm(f => ({ ...f, destination: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_consommation">Auto-conso</SelectItem>
                    <SelectItem value="vente">Vente</SelectItem>
                    <SelectItem value="don">Don</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poids vif total (kg)</Label>
                <Input type="number" step="0.1" value={abatLotForm.poidsVif} onChange={(e) => setAbatLotForm(f => ({ ...f, poidsVif: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Poids carcasse total (kg)</Label>
                <Input type="number" step="0.1" value={abatLotForm.poidsCarcasse} onChange={(e) => setAbatLotForm(f => ({ ...f, poidsCarcasse: e.target.value }))} />
              </div>
            </div>
            {abatLotForm.destination === 'vente' && (
              <div className="space-y-2">
                <Label>Prix de vente total (€)</Label>
                <Input type="number" step="0.01" value={abatLotForm.prixVente} onChange={(e) => setAbatLotForm(f => ({ ...f, prixVente: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={abatLotForm.notes} onChange={(e) => setAbatLotForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAbatLotDialog(null)}>Annuler</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">Enregistrer l'abattage</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ParcelleAssignButton({ lotId, parcelles, onAssigned }: { lotId: number; parcelles: Parcelle[]; onAssigned: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)

  if (parcelles.length === 0) return <span className="text-muted-foreground text-xs">-</span>

  const handleAssign = async (parcelleGeoId: string) => {
    try {
      const res = await fetch('/api/elevage/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lotId, parcelleGeoId }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Parcelle assignee" })
      setOpen(false)
      onAssigned()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <Select open={open} onOpenChange={setOpen} onValueChange={handleAssign}>
      <SelectTrigger className="h-7 w-[130px] text-xs border-dashed">
        <SelectValue placeholder="Assigner..." />
      </SelectTrigger>
      <SelectContent>
        {parcelles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
