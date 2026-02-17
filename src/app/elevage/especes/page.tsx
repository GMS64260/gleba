"use client"

/**
 * Page Gestion des Espèces Animales (référentiel)
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Settings,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
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

interface EspeceAnimale {
  id: string
  nom: string
  type: string
  production: string
  dureeGestation: number | null
  dureeCouvaison: number | null
  dureeElevage: number | null
  poidsAdulte: number | null
  rendementCarcasse: number | null
  ponteAnnuelle: number | null
  consommationJour: number | null
  prixAchat: number | null
  couleur: string | null
  description: string | null
  _count: { animaux: number; lots: number }
}

const TYPE_LABELS: Record<string, string> = {
  volaille: "Volaille",
  mammifere_petit: "Petit mammifère",
  mammifere_grand: "Grand mammifère",
  autre: "Autre",
}

const PRODUCTION_LABELS: Record<string, string> = {
  oeufs: "Oeufs",
  viande: "Viande",
  lait: "Lait",
  laine: "Laine",
  mixte: "Mixte",
}

const TYPE_COLORS: Record<string, string> = {
  volaille: "bg-yellow-100 text-yellow-800",
  mammifere_petit: "bg-purple-100 text-purple-800",
  mammifere_grand: "bg-blue-100 text-blue-800",
  autre: "bg-gray-100 text-gray-800",
}

const emptyForm = {
  id: "",
  nom: "",
  type: "volaille",
  production: "viande",
  dureeGestation: "",
  dureeCouvaison: "",
  dureeElevage: "",
  poidsAdulte: "",
  rendementCarcasse: "",
  ponteAnnuelle: "",
  consommationJour: "",
  prixAchat: "",
  couleur: "#F59E0B",
  description: "",
}

export default function EspecesAnimalesPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState(emptyForm)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/elevage/especes-animales')
      if (res.ok) {
        const result = await res.json()
        setEspeces(result.data)
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les espèces" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  const openEdit = (e: EspeceAnimale) => {
    setEditingId(e.id)
    setFormData({
      id: e.id,
      nom: e.nom,
      type: e.type,
      production: e.production,
      dureeGestation: e.dureeGestation?.toString() || "",
      dureeCouvaison: e.dureeCouvaison?.toString() || "",
      dureeElevage: e.dureeElevage?.toString() || "",
      poidsAdulte: e.poidsAdulte?.toString() || "",
      rendementCarcasse: e.rendementCarcasse?.toString() || "",
      ponteAnnuelle: e.ponteAnnuelle?.toString() || "",
      consommationJour: e.consommationJour?.toString() || "",
      prixAchat: e.prixAchat?.toString() || "",
      couleur: e.couleur || "#F59E0B",
      description: e.description || "",
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        id: formData.id.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        nom: formData.nom,
        type: formData.type,
        production: formData.production,
        couleur: formData.couleur || null,
        description: formData.description || null,
        dureeGestation: formData.dureeGestation ? parseInt(formData.dureeGestation) : null,
        dureeCouvaison: formData.dureeCouvaison ? parseInt(formData.dureeCouvaison) : null,
        dureeElevage: formData.dureeElevage ? parseInt(formData.dureeElevage) : null,
        poidsAdulte: formData.poidsAdulte ? parseFloat(formData.poidsAdulte) : null,
        rendementCarcasse: formData.rendementCarcasse ? parseFloat(formData.rendementCarcasse) : null,
        ponteAnnuelle: formData.ponteAnnuelle ? parseInt(formData.ponteAnnuelle) : null,
        consommationJour: formData.consommationJour ? parseFloat(formData.consommationJour) : null,
        prixAchat: formData.prixAchat ? parseFloat(formData.prixAchat) : null,
      }

      const isEdit = editingId !== null
      const url = isEdit ? `/api/elevage/especes-animales?id=${editingId}` : '/api/elevage/especes-animales'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur')
      }

      toast({ title: isEdit ? "Espèce modifiée" : "Espèce créée", description: formData.nom })
      setIsDialogOpen(false)
      setFormData(emptyForm)
      setEditingId(null)
      fetchData()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Impossible de sauvegarder" })
    }
  }

  const handleDelete = async (id: string, nom: string, count: number) => {
    if (count > 0) {
      toast({ variant: "destructive", title: "Suppression impossible", description: `${nom} est utilisée par ${count} animaux/lots` })
      return
    }
    if (!confirm(`Supprimer l'espèce "${nom}" ?`)) return
    try {
      const res = await fetch(`/api/elevage/especes-animales?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: "Espèce supprimée" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <Settings className="h-6 w-6 text-gray-600" />
              <h1 className="text-xl font-bold">Espèces animales</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle espèce
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total espèces</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{especes.length}</p>
            </CardContent>
          </Card>
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const count = especes.filter(e => e.type === key).length
            if (count === 0) return null
            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            )
          })}
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
                    <TableHead>Couleur</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Production</TableHead>
                    <TableHead className="text-right">Poids adulte</TableHead>
                    <TableHead className="text-right">Conso/jour</TableHead>
                    <TableHead className="text-right">Prix achat</TableHead>
                    <TableHead className="text-right">Animaux</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {especes.map((esp) => (
                    <TableRow key={esp.id}>
                      <TableCell>
                        <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: esp.couleur || '#ccc' }} />
                      </TableCell>
                      <TableCell className="font-medium">{esp.nom}</TableCell>
                      <TableCell>
                        <Badge className={TYPE_COLORS[esp.type] || "bg-gray-100"} variant="secondary">
                          {TYPE_LABELS[esp.type] || esp.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{PRODUCTION_LABELS[esp.production] || esp.production}</TableCell>
                      <TableCell className="text-right">
                        {esp.poidsAdulte ? `${esp.poidsAdulte} kg` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {esp.consommationJour ? `${esp.consommationJour} kg` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {esp.prixAchat ? `${esp.prixAchat} €` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {esp._count.animaux + esp._count.lots > 0 ? (
                          <Badge variant="outline">{esp._count.animaux} ind. / {esp._count.lots} lots</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(esp)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(esp.id, esp.nom, esp._count.animaux + esp._count.lots)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {especes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Aucune espèce configurée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Créer/Modifier */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'espèce" : "Nouvelle espèce"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifier les paramètres de cette espèce" : "Ajouter une espèce au référentiel"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => {
                    const nom = e.target.value
                    setFormData(f => ({
                      ...f,
                      nom,
                      ...(editingId ? {} : { id: nom.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_àéèêëîïôùûüç]/g, '') }),
                    }))
                  }}
                  placeholder="Poule pondeuse"
                />
              </div>
              <div className="space-y-2">
                <Label>Identifiant</Label>
                <Input
                  value={formData.id}
                  onChange={(e) => setFormData(f => ({ ...f, id: e.target.value }))}
                  placeholder="poule_pondeuse"
                  disabled={editingId !== null}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volaille">Volaille</SelectItem>
                    <SelectItem value="mammifere_petit">Petit mammifère</SelectItem>
                    <SelectItem value="mammifere_grand">Grand mammifère</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Production *</Label>
                <Select value={formData.production} onValueChange={(v) => setFormData(f => ({ ...f, production: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oeufs">Oeufs</SelectItem>
                    <SelectItem value="viande">Viande</SelectItem>
                    <SelectItem value="lait">Lait</SelectItem>
                    <SelectItem value="laine">Laine</SelectItem>
                    <SelectItem value="mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <Input
                  type="color"
                  value={formData.couleur}
                  onChange={(e) => setFormData(f => ({ ...f, couleur: e.target.value }))}
                  className="h-10 p-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gestation (j)</Label>
                <Input
                  type="number" min="0"
                  value={formData.dureeGestation}
                  onChange={(e) => setFormData(f => ({ ...f, dureeGestation: e.target.value }))}
                  placeholder="31"
                />
              </div>
              <div className="space-y-2">
                <Label>Couvaison (j)</Label>
                <Input
                  type="number" min="0"
                  value={formData.dureeCouvaison}
                  onChange={(e) => setFormData(f => ({ ...f, dureeCouvaison: e.target.value }))}
                  placeholder="21"
                />
              </div>
              <div className="space-y-2">
                <Label>Élevage (j)</Label>
                <Input
                  type="number" min="0"
                  value={formData.dureeElevage}
                  onChange={(e) => setFormData(f => ({ ...f, dureeElevage: e.target.value }))}
                  placeholder="90"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Poids adulte (kg)</Label>
                <Input
                  type="number" min="0" step="0.1"
                  value={formData.poidsAdulte}
                  onChange={(e) => setFormData(f => ({ ...f, poidsAdulte: e.target.value }))}
                  placeholder="3.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Rendement carc. (%)</Label>
                <Input
                  type="number" min="0" max="1" step="0.01"
                  value={formData.rendementCarcasse}
                  onChange={(e) => setFormData(f => ({ ...f, rendementCarcasse: e.target.value }))}
                  placeholder="0.72"
                />
              </div>
              <div className="space-y-2">
                <Label>Ponte/an</Label>
                <Input
                  type="number" min="0"
                  value={formData.ponteAnnuelle}
                  onChange={(e) => setFormData(f => ({ ...f, ponteAnnuelle: e.target.value }))}
                  placeholder="280"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Conso/jour (kg)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={formData.consommationJour}
                  onChange={(e) => setFormData(f => ({ ...f, consommationJour: e.target.value }))}
                  placeholder="0.12"
                />
              </div>
              <div className="space-y-2">
                <Label>Prix d'achat (€)</Label>
                <Input
                  type="number" min="0" step="0.5"
                  value={formData.prixAchat}
                  onChange={(e) => setFormData(f => ({ ...f, prixAchat: e.target.value }))}
                  placeholder="15"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={!formData.nom || !formData.id}>
                {editingId ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
