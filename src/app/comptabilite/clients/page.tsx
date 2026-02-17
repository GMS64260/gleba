"use client"

/**
 * Page Gestion des Clients
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Users, RefreshCw, Plus, Search, Edit, Trash2, Building2, User, Users2, ShoppingBag } from "lucide-react"

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

interface Client {
  id: number
  nom: string
  type: string
  email: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  codePostal: string | null
  siret: string | null
  conditionsPaiement: number | null
  exonererTVA: boolean
  notes: string | null
  actif: boolean
  _count?: { ventesManuelles: number; factures: number }
}

const TYPE_LABELS: Record<string, string> = {
  particulier: "Particulier",
  professionnel: "Professionnel",
  association: "Association",
  amap: "AMAP",
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  particulier: <User className="h-4 w-4" />,
  professionnel: <Building2 className="h-4 w-4" />,
  association: <Users2 className="h-4 w-4" />,
  amap: <ShoppingBag className="h-4 w-4" />,
}

export default function ClientsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [clients, setClients] = React.useState<Client[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [search, setSearch] = React.useState("")
  const [showInactifs, setShowInactifs] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | null>(null)

  const [formData, setFormData] = React.useState({
    nom: "",
    type: "particulier",
    email: "",
    telephone: "",
    adresse: "",
    ville: "",
    codePostal: "",
    siret: "",
    conditionsPaiement: "0",
    exonererTVA: false,
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (!showInactifs) params.set('actif', 'true')

      const response = await fetch(`/api/comptabilite/clients?${params}`)
      if (response.ok) {
        const result = await response.json()
        setClients(result.data)
        setStats(result.stats)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les clients" })
    } finally {
      setIsLoading(false)
    }
  }, [search, showInactifs, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setFormData({
      nom: "",
      type: "particulier",
      email: "",
      telephone: "",
      adresse: "",
      ville: "",
      codePostal: "",
      siret: "",
      conditionsPaiement: "0",
      exonererTVA: false,
      notes: "",
    })
    setEditingClient(null)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({
      nom: client.nom,
      type: client.type,
      email: client.email || "",
      telephone: client.telephone || "",
      adresse: client.adresse || "",
      ville: client.ville || "",
      codePostal: client.codePostal || "",
      siret: client.siret || "",
      conditionsPaiement: String(client.conditionsPaiement || 0),
      exonererTVA: client.exonererTVA,
      notes: client.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const body = {
        ...formData,
        conditionsPaiement: parseInt(formData.conditionsPaiement),
        ...(editingClient && { id: editingClient.id }),
      }

      const response = await fetch('/api/comptabilite/clients', {
        method: editingClient ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast({ title: editingClient ? "Client modifié" : "Client créé" })
        setDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        throw new Error()
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (client: Client) => {
    if (!confirm(`Désactiver le client "${client.nom}" ?`)) return

    try {
      const response = await fetch(`/api/comptabilite/clients?id=${client.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({ title: "Client désactivé" })
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
              <Users className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Clients</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nouveau client</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Nom *</Label>
                      <Input
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        placeholder="Nom du client"
                        required
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particulier">Particulier</SelectItem>
                          <SelectItem value="professionnel">Professionnel</SelectItem>
                          <SelectItem value="association">Association</SelectItem>
                          <SelectItem value="amap">AMAP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemple.com"
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

                  <div>
                    <Label>Adresse</Label>
                    <Input
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Adresse"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Code postal</Label>
                      <Input
                        value={formData.codePostal}
                        onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                        placeholder="75000"
                      />
                    </div>
                    <div>
                      <Label>Ville</Label>
                      <Input
                        value={formData.ville}
                        onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                        placeholder="Paris"
                      />
                    </div>
                  </div>

                  {formData.type === 'professionnel' && (
                    <div>
                      <Label>SIRET</Label>
                      <Input
                        value={formData.siret}
                        onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                        placeholder="123 456 789 00012"
                      />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Conditions de paiement (jours)</Label>
                      <Select value={formData.conditionsPaiement} onValueChange={(v) => setFormData({ ...formData, conditionsPaiement: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="exonererTVA"
                        checked={formData.exonererTVA}
                        onChange={(e) => setFormData({ ...formData, exonererTVA: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="exonererTVA" className="cursor-pointer">Client exonéré de TVA</Label>
                    </div>
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
                    <Button type="submit">{editingClient ? "Modifier" : "Créer"}</Button>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total clients</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Particuliers</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.particulier || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Professionnels</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.professionnel || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">AMAP</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.amap || 0}</p></CardContent>
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
                    <TableHead>Ventes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className={!client.actif ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{client.nom}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {TYPE_ICONS[client.type]}
                          <span className="text-sm">{TYPE_LABELS[client.type]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {client.email && <div>{client.email}</div>}
                          {client.telephone && <div className="text-muted-foreground">{client.telephone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{client.ville || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {client.conditionsPaiement === 0 ? 'Comptant' : `${client.conditionsPaiement}j`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {client._count?.ventesManuelles || 0} ventes
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {client.actif && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(client)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aucun client
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
