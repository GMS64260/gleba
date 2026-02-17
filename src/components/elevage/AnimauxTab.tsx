"use client"

/**
 * Onglet Animaux - Animaux individuels + Lots en sous-onglets
 */

import * as React from "react"
import {
  Bird,
  Plus,
  RefreshCw,
  Search,
  Filter,
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
import { useToast } from "@/hooks/use-toast"

// ============================================================
// Types
// ============================================================

interface Animal {
  id: number
  identifiant: string | null
  nom: string | null
  race: string | null
  sexe: string | null
  dateNaissance: string | null
  dateArrivee: string | null
  statut: string
  poidsActuel: number | null
  especeAnimale: {
    id: string
    nom: string
    type: string
    couleur: string | null
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
  statut: string
  especeAnimale: { id: string; nom: string; type: string; couleur: string | null }
  _count: { animaux: number; productionsOeufs: number; soins: number }
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
  mort: "bg-gray-100 text-gray-800",
  reforme: "bg-orange-100 text-orange-800",
  termine: "bg-gray-100 text-gray-800",
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

  const [formData, setFormData] = React.useState({
    especeAnimaleId: "", identifiant: "", nom: "", race: "", sexe: "",
    dateNaissance: "", dateArrivee: new Date().toISOString().split('T')[0],
    provenance: "", prixAchat: "", poidsActuel: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = '/api/elevage/animaux?'
      if (filterEspece !== 'all') url += `especeAnimaleId=${filterEspece}&`
      if (filterStatut !== 'all') url += `statut=${filterStatut}&`

      const [animauxRes, especesRes] = await Promise.all([
        fetch(url),
        fetch('/api/elevage/especes-animales'),
      ])

      if (animauxRes.ok) setAnimaux((await animauxRes.json()).data)
      if (especesRes.ok) setEspeces((await especesRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les donnees" })
    } finally {
      setIsLoading(false)
    }
  }, [filterEspece, filterStatut, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/animaux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Animal cree" })
      setIsDialogOpen(false)
      setFormData({
        especeAnimaleId: "", identifiant: "", nom: "", race: "", sexe: "",
        dateNaissance: "", dateArrivee: new Date().toISOString().split('T')[0],
        provenance: "", prixAchat: "", poidsActuel: "", notes: "",
      })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de creer l'animal" })
    }
  }

  const handleDelete = async (id: number, nom: string) => {
    if (!confirm(`Supprimer ${nom || `animal #${id}`} ?`)) return
    try {
      await fetch(`/api/elevage/animaux/${id}`, { method: 'DELETE' })
      toast({ title: "Animal supprime" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  const filteredAnimaux = animaux.filter(a => {
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
        <Select value={filterEspece} onValueChange={setFilterEspece}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Espece" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les especes</SelectItem>
            {especes.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
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
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvel animal</DialogTitle>
              <DialogDescription>Ajouter un animal individuel</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Espece *</Label>
                <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                  <SelectContent>
                    {especes.map(e => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Identifiant</Label>
                  <Input value={formData.identifiant} onChange={(e) => setFormData(f => ({ ...f, identifiant: e.target.value }))} placeholder="Bague, puce..." />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} />
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
                <Button type="submit" disabled={!formData.especeAnimaleId}>Creer</Button>
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
                  <TableHead>Espece</TableHead>
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
                    <TableCell>{animal.nom || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {animal.especeAnimale.couleur && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: animal.especeAnimale.couleur }} />
                        )}
                        {animal.especeAnimale.nom}
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
                      {animal.poidsActuel ? `${animal.poidsActuel} kg` : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(animal.id, animal.nom || animal.identifiant || '')}
                        className="text-red-600 hover:text-red-700"
                      >
                        &times;
                      </Button>
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
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    especeAnimaleId: "", nom: "",
    dateArrivee: new Date().toISOString().split('T')[0],
    quantiteInitiale: "", provenance: "", prixAchatTotal: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [lotsRes, especesRes] = await Promise.all([
        fetch('/api/elevage/lots'),
        fetch('/api/elevage/especes-animales'),
      ])
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
      if (especesRes.ok) setEspeces((await especesRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les donnees" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Lot cree", description: `${formData.quantiteInitiale} animaux ajoutes` })
      setIsDialogOpen(false)
      setFormData({
        especeAnimaleId: "", nom: "",
        dateArrivee: new Date().toISOString().split('T')[0],
        quantiteInitiale: "", provenance: "", prixAchatTotal: "", notes: "",
      })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de creer le lot" })
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouveau lot</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Creer un lot</DialogTitle>
                <DialogDescription>Groupe d'animaux (volailles, etc.)</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Espece *</Label>
                  <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
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
                    <Label>Quantite *</Label>
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
                <div className="space-y-2">
                  <Label>Provenance</Label>
                  <Input value={formData.provenance} onChange={(e) => setFormData(f => ({ ...f, provenance: e.target.value }))} placeholder="Couvoir, eleveur..." />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={!formData.especeAnimaleId || !formData.quantiteInitiale}>Creer</Button>
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
                  <TableHead>Espece</TableHead>
                  <TableHead className="text-right">Initial</TableHead>
                  <TableHead className="text-right">Actuel</TableHead>
                  <TableHead>Arrivee</TableHead>
                  <TableHead>Provenance</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">{lot.nom || `Lot #${lot.id}`}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {lot.especeAnimale.couleur && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lot.especeAnimale.couleur }} />}
                        {lot.especeAnimale.nom}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{lot.quantiteInitiale}</TableCell>
                    <TableCell className="text-right font-bold">{lot.quantiteActuelle}</TableCell>
                    <TableCell>{lot.dateArrivee ? new Date(lot.dateArrivee).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell>{lot.provenance || '-'}</TableCell>
                    <TableCell className="text-right">{lot.prixAchatTotal ? `${lot.prixAchatTotal.toFixed(2)} \u20ac` : '-'}</TableCell>
                    <TableCell><Badge className={STATUT_COLORS[lot.statut] || ''}>{lot.statut}</Badge></TableCell>
                  </TableRow>
                ))}
                {lots.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun lot enregistre</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
