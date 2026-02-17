"use client"

/**
 * Page Gestion des Fournisseurs
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Truck, RefreshCw, Plus, Search, Edit, Trash2, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface Fournisseur {
  id: string
  contact: string | null
  adresse: string | null
  ville: string | null
  codePostal: string | null
  email: string | null
  telephone: string | null
  siteWeb: string | null
  siret: string | null
  type: string | null
  conditionsPaiement: number | null
  notes: string | null
  actif: boolean
  _count?: { varietes: number; aliments: number }
}

const TYPE_LABELS: Record<string, string> = {
  semences: "Semences",
  aliments: "Aliments animaux",
  animaux: "Animaux",
  materiel: "Matériel",
  mixte: "Mixte",
}

export default function FournisseursPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [fournisseurs, setFournisseurs] = React.useState<Fournisseur[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [search, setSearch] = React.useState("")
  const [showInactifs, setShowInactifs] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingFournisseur, setEditingFournisseur] = React.useState<Fournisseur | null>(null)

  const [formData, setFormData] = React.useState({
    id: "",
    contact: "",
    email: "",
    telephone: "",
    adresse: "",
    ville: "",
    codePostal: "",
    siteWeb: "",
    siret: "",
    type: "mixte",
    conditionsPaiement: "30",
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (!showInactifs) params.set('actif', 'true')

      const response = await fetch(`/api/comptabilite/fournisseurs?${params}`)
      if (response.ok) {
        const result = await response.json()
        setFournisseurs(result.data)
        setStats(result.stats)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les fournisseurs" })
    } finally {
      setIsLoading(false)
    }
  }, [search, showInactifs, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setFormData({
      id: "",
      contact: "",
      email: "",
      telephone: "",
      adresse: "",
      ville: "",
      codePostal: "",
      siteWeb: "",
      siret: "",
      type: "mixte",
      conditionsPaiement: "30",
      notes: "",
    })
    setEditingFournisseur(null)
  }

  const openEdit = (fournisseur: Fournisseur) => {
    setEditingFournisseur(fournisseur)
    setFormData({
      id: fournisseur.id,
      contact: fournisseur.contact || "",
      email: fournisseur.email || "",
      telephone: fournisseur.telephone || "",
      adresse: fournisseur.adresse || "",
      ville: fournisseur.ville || "",
      codePostal: fournisseur.codePostal || "",
      siteWeb: fournisseur.siteWeb || "",
      siret: fournisseur.siret || "",
      type: fournisseur.type || "mixte",
      conditionsPaiement: String(fournisseur.conditionsPaiement || 30),
      notes: fournisseur.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const body = {
        ...formData,
        conditionsPaiement: parseInt(formData.conditionsPaiement),
      }

      const response = await fetch('/api/comptabilite/fournisseurs', {
        method: editingFournisseur ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast({ title: editingFournisseur ? "Fournisseur modifié" : "Fournisseur créé" })
        setDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const err = await response.json()
        throw new Error(err.error)
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (fournisseur: Fournisseur) => {
    if (!confirm(`Désactiver le fournisseur "${fournisseur.id}" ?`)) return

    try {
      const response = await fetch(`/api/comptabilite/fournisseurs?id=${fournisseur.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({ title: "Fournisseur désactivé" })
        fetchData()
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-orange-600" />
              <h1 className="text-xl font-bold">Fournisseurs</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nouveau fournisseur</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingFournisseur ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Nom / Identifiant *</Label>
                      <Input
                        value={formData.id}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="Ex: Graines del Pais"
                        required
                        disabled={!!editingFournisseur}
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semences">Semences</SelectItem>
                          <SelectItem value="aliments">Aliments animaux</SelectItem>
                          <SelectItem value="animaux">Animaux</SelectItem>
                          <SelectItem value="materiel">Matériel</SelectItem>
                          <SelectItem value="mixte">Mixte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Contact</Label>
                      <Input
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        placeholder="Nom du contact"
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@fournisseur.fr"
                      />
                    </div>
                    <div>
                      <Label>Site web</Label>
                      <Input
                        value={formData.siteWeb}
                        onChange={(e) => setFormData({ ...formData, siteWeb: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Adresse</Label>
                    <Input
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Adresse"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Code postal</Label>
                      <Input
                        value={formData.codePostal}
                        onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                        placeholder="31000"
                      />
                    </div>
                    <div>
                      <Label>Ville</Label>
                      <Input
                        value={formData.ville}
                        onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                        placeholder="Toulouse"
                      />
                    </div>
                    <div>
                      <Label>SIRET</Label>
                      <Input
                        value={formData.siret}
                        onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                        placeholder="123 456 789 00012"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Conditions de paiement</Label>
                    <Select value={formData.conditionsPaiement} onValueChange={(v) => setFormData({ ...formData, conditionsPaiement: v })}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Comptant</SelectItem>
                        <SelectItem value="7">7 jours</SelectItem>
                        <SelectItem value="15">15 jours</SelectItem>
                        <SelectItem value="30">30 jours</SelectItem>
                        <SelectItem value="45">45 jours</SelectItem>
                        <SelectItem value="60">60 jours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes internes..."
                      rows={2}
                    />
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button type="submit">{editingFournisseur ? "Modifier" : "Créer"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total fournisseurs</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Semences</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.semences || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aliments</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.aliments || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Matériel</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.materiel || 0}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Filtres */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactifs}
                  onChange={(e) => setShowInactifs(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Afficher inactifs</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Liste */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fournisseurs.map((fournisseur) => (
                    <TableRow key={fournisseur.id} className={!fournisseur.actif ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {fournisseur.id}
                          {fournisseur.siteWeb && (
                            <a href={fournisseur.siteWeb} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABELS[fournisseur.type || 'mixte']}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {fournisseur.contact && <div>{fournisseur.contact}</div>}
                          {fournisseur.telephone && <div className="text-muted-foreground">{fournisseur.telephone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{fournisseur.ville || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {fournisseur.conditionsPaiement === 0 ? 'Comptant' : `${fournisseur.conditionsPaiement}j`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {(fournisseur._count?.varietes || 0) + (fournisseur._count?.aliments || 0)} articles
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(fournisseur)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {fournisseur.actif && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(fournisseur)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {fournisseurs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aucun fournisseur
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
