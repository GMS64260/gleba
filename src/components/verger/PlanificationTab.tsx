"use client"

/**
 * Onglet Planification du verger - Hub de planification, zones et stocks
 * Modèle : PlanificationTab du potager
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Scissors,
  Apple,
  Bug,
  Droplets,
  Flower2,
  TreeDeciduous,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  Package,
  ArrowRight,
  Compass,
  Wind,
  Mountain,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PlanificationStats {
  arbresTotal: number
  arbresFruitiers: number
  operationsAPlanifier: number
  recoltesPrevues: number
  observationsNonResolues: number
  arbresSansPollinisateur: number
}

interface ZoneVerger {
  id: number
  nom: string
  type: string
  surface: number | null
  exposition: string | null
  altitude: number | null
  protectionVent: string | null
  typeSol: string | null
  irrigation: string | null
  notes: string | null
  _count: { arbres: number }
}

const TYPES_ZONE = [
  { value: "verger", label: "Verger" },
  { value: "haie", label: "Haie" },
  { value: "bosquet", label: "Bosquet" },
  { value: "agroforesterie", label: "Agroforesterie" },
]

const EXPOSITIONS = [
  { value: "nord", label: "Nord" },
  { value: "sud", label: "Sud" },
  { value: "est", label: "Est" },
  { value: "ouest", label: "Ouest" },
  { value: "plat", label: "Plat" },
]

const IRRIGATIONS = [
  { value: "goutte_a_goutte", label: "Goutte-à-goutte" },
  { value: "aspersion", label: "Aspersion" },
  { value: "micro_aspersion", label: "Micro-aspersion" },
  { value: "aucune", label: "Aucune" },
]

const PROTECTIONS_VENT = [
  { value: "aucune", label: "Aucune" },
  { value: "haie", label: "Haie" },
  { value: "mur", label: "Mur" },
  { value: "filet", label: "Filet" },
]

interface PlanificationTabProps {
  year: number
}

export function PlanificationTab({ year }: PlanificationTabProps) {
  return (
    <Tabs defaultValue="planification" className="space-y-4">
      <TabsList>
        <TabsTrigger value="planification" className="flex items-center gap-1.5">
          <TreeDeciduous className="h-4 w-4" />
          Planification
        </TabsTrigger>
        <TabsTrigger value="zones" className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          Zones
        </TabsTrigger>
        <TabsTrigger value="stocks" className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Stocks
        </TabsTrigger>
      </TabsList>

      <TabsContent value="planification">
        <PlanificationHubSubTab year={year} />
      </TabsContent>
      <TabsContent value="zones">
        <ZonesSubTab />
      </TabsContent>
      <TabsContent value="stocks">
        <StocksSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Planification Hub
// ============================================================

function PlanificationHubSubTab({ year }: { year: number }) {
  const [stats, setStats] = React.useState<PlanificationStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/arbres/stats?year=${year}`)
        if (res.ok) {
          const data = await res.json()
          setStats({
            arbresTotal: data.stats.arbresTotal,
            arbresFruitiers: data.stats.arbresFruitiers,
            operationsAPlanifier: data.stats.operationsEnAttente,
            recoltesPrevues: data.stats.recoltesFruitsCount,
            observationsNonResolues: 0,
            arbresSansPollinisateur: 0,
          })
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [year])

  const actionCards = [
    {
      title: "Calendrier de taille",
      description: "Planifier les tailles par espèce et saison",
      icon: Scissors,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      href: `/arbres?tab=operations`,
    },
    {
      title: "Récoltes prévisionnelles",
      description: "Calendrier de récolte par arbre et variété",
      icon: Apple,
      color: "text-lime-600",
      bg: "bg-lime-50 border-lime-200",
      href: `/arbres?tab=productions`,
    },
    {
      title: "Traitements planifiés",
      description: "Planification phytosanitaire et fertilisation",
      icon: Bug,
      color: "text-red-600",
      bg: "bg-red-50 border-red-200",
      href: `/arbres?tab=sante`,
    },
    {
      title: "Besoins irrigation",
      description: "Estimation des besoins en eau par zone",
      icon: Droplets,
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
      href: `/arbres?tab=planification`,
    },
    {
      title: "Matrice pollinisation",
      description: "Compatibilités et alertes pollinisation",
      icon: Flower2,
      color: "text-pink-600",
      bg: "bg-pink-50 border-pink-200",
      href: `/arbres?tab=sante`,
    },
    {
      title: "Plan du verger",
      description: "Voir et éditer le plan 2D",
      icon: MapPin,
      color: "text-teal-600",
      bg: "bg-teal-50 border-teal-200",
      href: `/jardin?usage=verger`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <TreeDeciduous className="h-4 w-4 text-lime-600" />
                  Arbres fruitiers
                </p>
                <p className="text-2xl font-bold">{stats?.arbresFruitiers || 0}</p>
                <p className="text-xs text-muted-foreground">sur {stats?.arbresTotal || 0} arbres</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-amber-600" />
                  Opérations à planifier
                </p>
                <p className="text-2xl font-bold">{stats?.operationsAPlanifier || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Apple className="h-4 w-4 text-orange-600" />
                  Récoltes {year}
                </p>
                <p className="text-2xl font-bold">{stats?.recoltesPrevues || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Bug className="h-4 w-4 text-red-600" />
                  Alertes santé
                </p>
                <p className="text-2xl font-bold">{stats?.observationsNonResolues || 0}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Action Cards */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {actionCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${card.bg}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                    <div>
                      <p className="font-medium text-sm">{card.title}</p>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Zones du verger (CRUD)
// ============================================================

function ZonesSubTab() {
  const { toast } = useToast()
  const [zones, setZones] = React.useState<ZoneVerger[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showDialog, setShowDialog] = React.useState(false)
  const [editingZone, setEditingZone] = React.useState<ZoneVerger | null>(null)
  const [formData, setFormData] = React.useState({
    nom: "",
    type: "verger",
    surface: "",
    exposition: "",
    altitude: "",
    protectionVent: "",
    typeSol: "",
    irrigation: "",
    notes: "",
  })

  const fetchZones = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/arbres/zones")
      if (res.ok) setZones(await res.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchZones()
  }, [fetchZones])

  const resetForm = () => {
    setFormData({
      nom: "",
      type: "verger",
      surface: "",
      exposition: "",
      altitude: "",
      protectionVent: "",
      typeSol: "",
      irrigation: "",
      notes: "",
    })
    setEditingZone(null)
  }

  const openEdit = (zone: ZoneVerger) => {
    setEditingZone(zone)
    setFormData({
      nom: zone.nom,
      type: zone.type,
      surface: zone.surface?.toString() || "",
      exposition: zone.exposition || "",
      altitude: zone.altitude?.toString() || "",
      protectionVent: zone.protectionVent || "",
      typeSol: zone.typeSol || "",
      irrigation: zone.irrigation || "",
      notes: zone.notes || "",
    })
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingZone ? `/api/arbres/zones/${editingZone.id}` : "/api/arbres/zones"
    const method = editingZone ? "PUT" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowDialog(false)
        resetForm()
        toast({ title: editingZone ? "Zone modifiée" : "Zone créée" })
        fetchZones()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette zone ? Les arbres seront dissociés.")) return
    try {
      const res = await fetch(`/api/arbres/zones/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Zone supprimée" })
        fetchZones()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const totalSurface = zones.reduce((sum, z) => sum + (z.surface || 0), 0)
  const totalArbres = zones.reduce((sum, z) => sum + z._count.arbres, 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Zones</p>
            <p className="text-2xl font-bold">{zones.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Surface totale</p>
            <p className="text-2xl font-bold">{totalSurface.toFixed(0)} m²</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Arbres en zones</p>
            <p className="text-2xl font-bold">{totalArbres}</p>
          </CardContent>
        </Card>
      </div>

      {/* Header + bouton */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Zones du verger</h3>
        <Button
          onClick={() => { resetForm(); setShowDialog(true) }}
          size="sm"
          className="bg-lime-600 hover:bg-lime-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle zone
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-muted-foreground">Chargement...</p>
          ) : zones.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucune zone définie</p>
              <p className="text-sm">Créez des zones pour organiser votre verger</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Surface</TableHead>
                  <TableHead>Exposition</TableHead>
                  <TableHead>Irrigation</TableHead>
                  <TableHead className="text-right">Arbres</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.nom}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{zone.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{zone.surface ? `${zone.surface} m²` : "-"}</TableCell>
                    <TableCell>
                      {zone.exposition ? (
                        <span className="flex items-center gap-1 capitalize">
                          <Compass className="h-3 w-3" />
                          {zone.exposition}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="capitalize">{zone.irrigation?.replace(/_/g, " ") || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Badge>{zone._count.arbres}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(zone)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(zone.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier la zone" : "Nouvelle zone"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom *</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Verger sud"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES_ZONE.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Surface (m²)</Label>
                <Input
                  type="number"
                  value={formData.surface}
                  onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                />
              </div>
              <div>
                <Label>Exposition</Label>
                <Select value={formData.exposition} onValueChange={(v) => setFormData({ ...formData, exposition: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {EXPOSITIONS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Altitude (m)</Label>
                <Input
                  type="number"
                  value={formData.altitude}
                  onChange={(e) => setFormData({ ...formData, altitude: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Irrigation</Label>
                <Select value={formData.irrigation} onValueChange={(v) => setFormData({ ...formData, irrigation: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {IRRIGATIONS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Protection vent</Label>
                <Select value={formData.protectionVent} onValueChange={(v) => setFormData({ ...formData, protectionVent: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {PROTECTIONS_VENT.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              {editingZone ? "Modifier" : "Créer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Stocks
// ============================================================

function StocksSubTab() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <Link href="/stocks">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-lime-600" />
              Stocks complets
            </CardTitle>
            <CardDescription>Semences, plants, engrais, phyto</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href="/arbres?tab=productions">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Apple className="h-4 w-4 text-orange-600" />
              Récoltes en stock
            </CardTitle>
            <CardDescription>Fruits et bois en stock</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href="/arbres?tab=sante">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-600" />
              Registre phyto
            </CardTitle>
            <CardDescription>Traitements et observations</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  )
}
