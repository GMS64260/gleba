"use client"

/**
 * Onglet Especes - Referentiel des especes animales
 */

import * as React from "react"
import {
  Settings,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
  mammifere_petit: "Petit mammifere",
  mammifere_grand: "Grand mammifere",
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

const ESPECE_TYPES = [
  { value: "all", label: "Tous" },
  { value: "volaille", label: "Volailles" },
  { value: "mammifere_petit", label: "Petits mammiferes" },
  { value: "mammifere_grand", label: "Grands mammiferes" },
  { value: "autre", label: "Autres" },
] as const

const emptyForm = {
  id: "", nom: "", type: "volaille", production: "viande",
  dureeGestation: "", dureeCouvaison: "", dureeElevage: "",
  poidsAdulte: "", rendementCarcasse: "", ponteAnnuelle: "",
  consommationJour: "", prixAchat: "", couleur: "#F59E0B", description: "",
}

export function EspecesTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [filteredEspeces, setFilteredEspeces] = React.useState<EspeceAnimale[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState(emptyForm)
  const [selectedType, setSelectedType] = React.useState("all")

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/elevage/especes-animales')
      if (res.ok) {
        const result = await res.json()
        setEspeces(result.data)
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les especes" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  React.useEffect(() => {
    if (selectedType === "all") {
      setFilteredEspeces(especes)
    } else {
      setFilteredEspeces(especes.filter(e => e.type === selectedType))
    }
  }, [selectedType, especes])

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  const openEdit = (e: EspeceAnimale) => {
    setEditingId(e.id)
    setFormData({
      id: e.id, nom: e.nom, type: e.type, production: e.production,
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
        nom: formData.nom, type: formData.type, production: formData.production,
        couleur: formData.couleur || null, description: formData.description || null,
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

      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur')
      }

      toast({ title: isEdit ? "Espece modifiee" : "Espece creee", description: formData.nom })
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
      toast({ variant: "destructive", title: "Suppression impossible", description: `${nom} est utilisee par ${count} animaux/lots` })
      return
    }
    if (!confirm(`Supprimer l'espece "${nom}" ?`)) return
    try {
      const res = await fetch(`/api/elevage/especes-animales?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: "Espece supprimee" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtres par type */}
      <div className="flex items-center justify-between">
        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <TabsList className="flex-wrap h-auto gap-1">
            {ESPECE_TYPES.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle espece
          </Button>
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
                  <TableHead>Couleur</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Production</TableHead>
                  <TableHead className="text-right">Poids adulte</TableHead>
                  <TableHead className="text-right">Conso/jour</TableHead>
                  <TableHead className="text-right">Ponte/an</TableHead>
                  <TableHead className="text-right">Prix achat</TableHead>
                  <TableHead className="text-right">Animaux</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEspeces.map((esp) => (
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
                    <TableCell className="text-right">{esp.poidsAdulte ? `${esp.poidsAdulte} kg` : '-'}</TableCell>
                    <TableCell className="text-right">{esp.consommationJour ? `${esp.consommationJour} kg` : '-'}</TableCell>
                    <TableCell className="text-right">{esp.ponteAnnuelle || '-'}</TableCell>
                    <TableCell className="text-right">{esp.prixAchat ? `${esp.prixAchat} \u20ac` : '-'}</TableCell>
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
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(esp.id, esp.nom, esp._count.animaux + esp._count.lots)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEspeces.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune espece configuree</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Creer/Modifier */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'espece" : "Nouvelle espece"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifier les parametres de cette espece" : "Ajouter une espece au referentiel"}
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
                      ...f, nom,
                      ...(editingId ? {} : { id: nom.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }),
                    }))
                  }}
                  placeholder="Poule pondeuse"
                />
              </div>
              <div className="space-y-2">
                <Label>Identifiant</Label>
                <Input value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value }))} placeholder="poule_pondeuse" disabled={editingId !== null} className="font-mono text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volaille">Volaille</SelectItem>
                    <SelectItem value="mammifere_petit">Petit mammifere</SelectItem>
                    <SelectItem value="mammifere_grand">Grand mammifere</SelectItem>
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
                <Input type="color" value={formData.couleur} onChange={(e) => setFormData(f => ({ ...f, couleur: e.target.value }))} className="h-10 p-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Gestation (j)</Label><Input type="number" min="0" value={formData.dureeGestation} onChange={(e) => setFormData(f => ({ ...f, dureeGestation: e.target.value }))} placeholder="31" /></div>
              <div className="space-y-2"><Label>Couvaison (j)</Label><Input type="number" min="0" value={formData.dureeCouvaison} onChange={(e) => setFormData(f => ({ ...f, dureeCouvaison: e.target.value }))} placeholder="21" /></div>
              <div className="space-y-2"><Label>Elevage (j)</Label><Input type="number" min="0" value={formData.dureeElevage} onChange={(e) => setFormData(f => ({ ...f, dureeElevage: e.target.value }))} placeholder="90" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Poids adulte (kg)</Label><Input type="number" min="0" step="0.1" value={formData.poidsAdulte} onChange={(e) => setFormData(f => ({ ...f, poidsAdulte: e.target.value }))} placeholder="3.5" /></div>
              <div className="space-y-2"><Label>Rendement carc. (%)</Label><Input type="number" min="0" max="1" step="0.01" value={formData.rendementCarcasse} onChange={(e) => setFormData(f => ({ ...f, rendementCarcasse: e.target.value }))} placeholder="0.72" /></div>
              <div className="space-y-2"><Label>Ponte/an</Label><Input type="number" min="0" value={formData.ponteAnnuelle} onChange={(e) => setFormData(f => ({ ...f, ponteAnnuelle: e.target.value }))} placeholder="280" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Conso/jour (kg)</Label><Input type="number" min="0" step="0.01" value={formData.consommationJour} onChange={(e) => setFormData(f => ({ ...f, consommationJour: e.target.value }))} placeholder="0.12" /></div>
              <div className="space-y-2"><Label>Prix d'achat (&euro;)</Label><Input type="number" min="0" step="0.5" value={formData.prixAchat} onChange={(e) => setFormData(f => ({ ...f, prixAchat: e.target.value }))} placeholder="15" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={!formData.nom || !formData.id}>
                {editingId ? "Enregistrer" : "Creer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
