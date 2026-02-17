"use client"

/**
 * Page Liste des Animaux
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Bird,
  Plus,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

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
}

export default function AnimauxPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [animaux, setAnimaux] = React.useState<Animal[]>([])
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [search, setSearch] = React.useState("")
  const [filterEspece, setFilterEspece] = React.useState<string>("all")
  const [filterStatut, setFilterStatut] = React.useState<string>("actif")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  // Form state
  const [formData, setFormData] = React.useState({
    especeAnimaleId: "",
    identifiant: "",
    nom: "",
    race: "",
    sexe: "",
    dateNaissance: "",
    dateArrivee: new Date().toISOString().split('T')[0],
    provenance: "",
    prixAchat: "",
    poidsActuel: "",
    notes: "",
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

      if (animauxRes.ok) {
        const result = await animauxRes.json()
        setAnimaux(result.data)
      }
      if (especesRes.ok) {
        const result = await especesRes.json()
        setEspeces(result.data)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données",
      })
    } finally {
      setIsLoading(false)
    }
  }, [filterEspece, filterStatut, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/animaux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Erreur création')

      toast({
        title: "Animal créé",
        description: "L'animal a été ajouté avec succès",
      })
      setIsDialogOpen(false)
      setFormData({
        especeAnimaleId: "",
        identifiant: "",
        nom: "",
        race: "",
        sexe: "",
        dateNaissance: "",
        dateArrivee: new Date().toISOString().split('T')[0],
        provenance: "",
        prixAchat: "",
        poidsActuel: "",
        notes: "",
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'animal",
      })
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/elevage">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Élevage
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Bird className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold">Animaux</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nouvel animal</DialogTitle>
                  <DialogDescription>
                    Ajouter un animal individuel
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Espèce *</Label>
                    <Select
                      value={formData.especeAnimaleId}
                      onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {especes.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Identifiant</Label>
                      <Input
                        value={formData.identifiant}
                        onChange={(e) => setFormData(f => ({ ...f, identifiant: e.target.value }))}
                        placeholder="Bague, puce..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={formData.nom}
                        onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Race</Label>
                      <Input
                        value={formData.race}
                        onChange={(e) => setFormData(f => ({ ...f, race: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sexe</Label>
                      <Select
                        value={formData.sexe}
                        onValueChange={(v) => setFormData(f => ({ ...f, sexe: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="femelle">Femelle</SelectItem>
                          <SelectItem value="male">Mâle</SelectItem>
                          <SelectItem value="inconnu">Inconnu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date naissance</Label>
                      <Input
                        type="date"
                        value={formData.dateNaissance}
                        onChange={(e) => setFormData(f => ({ ...f, dateNaissance: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date arrivée</Label>
                      <Input
                        type="date"
                        value={formData.dateArrivee}
                        onChange={(e) => setFormData(f => ({ ...f, dateArrivee: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prix achat (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.prixAchat}
                        onChange={(e) => setFormData(f => ({ ...f, prixAchat: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Poids (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.poidsActuel}
                        onChange={(e) => setFormData(f => ({ ...f, poidsActuel: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Provenance</Label>
                    <Input
                      value={formData.provenance}
                      onChange={(e) => setFormData(f => ({ ...f, provenance: e.target.value }))}
                      placeholder="Origine de l'animal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes supplémentaires"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={!formData.especeAnimaleId}>
                      Créer
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Filtres */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterEspece} onValueChange={setFilterEspece}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Espèce" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les espèces</SelectItem>
                {especes.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnimaux.map((animal) => (
                    <TableRow key={animal.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {animal.identifiant || '-'}
                      </TableCell>
                      <TableCell>{animal.nom || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {animal.especeAnimale.couleur && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: animal.especeAnimale.couleur }}
                            />
                          )}
                          {animal.especeAnimale.nom}
                        </div>
                      </TableCell>
                      <TableCell>{animal.race || '-'}</TableCell>
                      <TableCell>
                        {animal.sexe === 'femelle' ? '♀' : animal.sexe === 'male' ? '♂' : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUT_COLORS[animal.statut] || ''}>
                          {animal.statut}
                        </Badge>
                      </TableCell>
                      <TableCell>{animal.lot?.nom || '-'}</TableCell>
                      <TableCell className="text-right">
                        {animal.poidsActuel ? `${animal.poidsActuel} kg` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAnimaux.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun animal trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
