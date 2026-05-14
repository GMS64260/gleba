"use client"

/**
 * Onglet Santé & Phyto du verger
 * - Observations santé (fiche santé longitudinale par arbre)
 * - Registre phytosanitaire
 * - Matrice pollinisation
 * Feature différenciante : aucun concurrent open-source ne propose ça
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  HeartPulse,
  Bug,
  Flower2,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Shield,
  Leaf,
  Pencil,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
}

interface Observation {
  id: number
  arbreId: number
  date: string
  type: string
  symptome: string | null
  diagnostic: string | null
  gravite: string
  organe: string | null
  traitement: string | null
  methodeTraitement: string | null
  produit: string | null
  doseAppliquee: number | null
  uniteDose: string | null
  dar: number | null
  numAMM: string | null
  resolu: boolean
  dateResolution: string | null
  notes: string | null
  arbre: { id: number; nom: string; type: string; espece: string | null }
}

interface PollinisationData {
  arbres: {
    id: number
    nom: string
    espece: string | null
    variete: string | null
    floraison: string | null
    groupePollinisation: string | null
    autofertile: boolean
    pollinisateursCompat: { arbrePollinisateur: { id: number; nom: string; espece: string | null; variete: string | null } }[]
  }[]
  alertes: { id: number; nom: string; espece: string | null; floraison: string | null; groupePollinisation: string | null }[]
  stats: { totalArbres: number; autofertiles: number; sansPollinisateur: number }
}

const TYPES_OBS = [
  { value: "maladie", label: "Maladie", color: "bg-red-100 text-red-700" },
  { value: "ravageur", label: "Ravageur", color: "bg-orange-100 text-orange-700" },
  { value: "carence", label: "Carence", color: "bg-yellow-100 text-yellow-700" },
  { value: "degat_climatique", label: "Dégât climatique", color: "bg-blue-100 text-blue-700" },
  { value: "observation_generale", label: "Observation", color: "bg-slate-100 text-slate-700" },
  { value: "vigueur", label: "Vigueur", color: "bg-green-100 text-green-700" },
]

const GRAVITES = [
  { value: "faible", label: "Faible", color: "bg-green-100 text-green-700" },
  { value: "moyenne", label: "Moyenne", color: "bg-yellow-100 text-yellow-700" },
  { value: "grave", label: "Grave", color: "bg-orange-100 text-orange-700" },
  { value: "critique", label: "Critique", color: "bg-red-100 text-red-700" },
]

const ORGANES = [
  { value: "feuilles", label: "Feuilles" },
  { value: "fruits", label: "Fruits" },
  { value: "branches", label: "Branches" },
  { value: "tronc", label: "Tronc" },
  { value: "racines", label: "Racines" },
  { value: "fleurs", label: "Fleurs" },
]

export function SanteTab() {
  return (
    <Tabs defaultValue="observations" className="space-y-4">
      <TabsList>
        <TabsTrigger value="observations" className="flex items-center gap-1.5">
          <HeartPulse className="h-4 w-4" />
          Observations
        </TabsTrigger>
        <TabsTrigger value="phyto" className="flex items-center gap-1.5">
          <Shield className="h-4 w-4" />
          Registre phyto
        </TabsTrigger>
        <TabsTrigger value="pollinisation" className="flex items-center gap-1.5">
          <Flower2 className="h-4 w-4" />
          Pollinisation
        </TabsTrigger>
      </TabsList>

      <TabsContent value="observations">
        <ObservationsSubTab />
      </TabsContent>
      <TabsContent value="phyto">
        <RegistrePhytoSubTab />
      </TabsContent>
      <TabsContent value="pollinisation">
        <PollinisationSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Observations de santé
// ============================================================

function ObservationsSubTab() {
  const { toast } = useToast()
  const [observations, setObservations] = React.useState<Observation[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filterType, setFilterType] = React.useState("all")
  const [filterGravite, setFilterGravite] = React.useState("all")
  const [filterResolu, setFilterResolu] = React.useState("false")
  const [showDialog, setShowDialog] = React.useState(false)
  const [editingObs, setEditingObs] = React.useState<Observation | null>(null)
  const defaultFormData = {
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    type: "observation_generale",
    symptome: "",
    diagnostic: "",
    gravite: "faible",
    organe: "",
    traitement: "",
    methodeTraitement: "",
    produit: "",
    doseAppliquee: "",
    uniteDose: "",
    dar: "",
    numAMM: "",
    notes: "",
  }
  const [formData, setFormData] = React.useState(defaultFormData)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType !== "all") params.set("type", filterType)
      if (filterGravite !== "all") params.set("gravite", filterGravite)
      if (filterResolu !== "all") params.set("resolu", filterResolu)

      const [obsRes, arbresRes] = await Promise.all([
        fetch(`/api/arbres/observations?${params}`),
        fetch("/api/arbres"),
      ])
      if (obsRes.ok) setObservations(await obsRes.json())
      if (arbresRes.ok) setArbres(await arbresRes.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    } finally {
      setLoading(false)
    }
  }, [filterType, filterGravite, filterResolu, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const openEdit = (obs: Observation) => {
    setEditingObs(obs)
    setFormData({
      arbreId: obs.arbreId.toString(),
      date: obs.date.split("T")[0],
      type: obs.type,
      symptome: obs.symptome || "",
      diagnostic: obs.diagnostic || "",
      gravite: obs.gravite,
      organe: obs.organe || "",
      traitement: obs.traitement || "",
      methodeTraitement: obs.methodeTraitement || "",
      produit: obs.produit || "",
      doseAppliquee: obs.doseAppliquee?.toString() || "",
      uniteDose: obs.uniteDose || "",
      dar: obs.dar?.toString() || "",
      numAMM: obs.numAMM || "",
      notes: obs.notes || "",
    })
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingObs
        ? `/api/arbres/observations/${editingObs.id}`
        : "/api/arbres/observations"
      const res = await fetch(url, {
        method: editingObs ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          doseAppliquee: formData.doseAppliquee || null,
          dar: formData.dar || null,
        }),
      })
      if (res.ok) {
        setShowDialog(false)
        setEditingObs(null)
        setFormData(defaultFormData)
        toast({ title: editingObs ? "Observation modifiée" : "Observation enregistrée" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const toggleResolu = async (obs: Observation) => {
    try {
      const res = await fetch(`/api/arbres/observations/${obs.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolu: !obs.resolu }),
      })
      if (res.ok) {
        toast({ title: obs.resolu ? "Marqué non résolu" : "Marqué résolu" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette observation ?")) return
    try {
      const res = await fetch(`/api/arbres/observations/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Observation supprimée" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const nonResolues = observations.filter((o) => !o.resolu).length
  const critiques = observations.filter((o) => o.gravite === "critique" && !o.resolu).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total observations</p>
            <p className="text-2xl font-bold">{observations.length}</p>
          </CardContent>
        </Card>
        <Card className={nonResolues > 0 ? "border-orange-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              Non résolues
            </p>
            <p className="text-2xl font-bold text-orange-600">{nonResolues}</p>
          </CardContent>
        </Card>
        <Card className={critiques > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Bug className="h-3 w-3 text-red-500" />
              Critiques
            </p>
            <p className="text-2xl font-bold text-red-600">{critiques}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Arbres touchés</p>
            <p className="text-2xl font-bold">
              {new Set(observations.filter((o) => !o.resolu).map((o) => o.arbreId)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres + bouton */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {TYPES_OBS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterGravite} onValueChange={setFilterGravite}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Gravité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {GRAVITES.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResolu} onValueChange={setFilterResolu}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            <SelectItem value="false">Non résolu</SelectItem>
            <SelectItem value="true">Résolu</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditingObs(null); setFormData(defaultFormData); setShowDialog(true) }} size="sm" className="bg-lime-600 hover:bg-lime-700">
          <Plus className="h-4 w-4 mr-1" />
          Observation
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-muted-foreground">Chargement...</p>
          ) : observations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <HeartPulse className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucune observation</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Arbre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Diagnostic</TableHead>
                  <TableHead>Gravité</TableHead>
                  <TableHead>Organe</TableHead>
                  <TableHead>Résolu</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observations.map((obs) => {
                  const typeConfig = TYPES_OBS.find((t) => t.value === obs.type)
                  const graviteConfig = GRAVITES.find((g) => g.value === obs.gravite)
                  return (
                    <TableRow key={obs.id} className={obs.gravite === "critique" && !obs.resolu ? "bg-red-50" : ""}>
                      <TableCell className="text-sm">{new Date(obs.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{obs.arbre.nom}</TableCell>
                      <TableCell>
                        <Badge className={typeConfig?.color || ""}>{typeConfig?.label || obs.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{obs.diagnostic || obs.symptome || "-"}</TableCell>
                      <TableCell>
                        <Badge className={graviteConfig?.color || ""}>{graviteConfig?.label || obs.gravite}</Badge>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{obs.organe || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleResolu(obs)}
                          className={obs.resolu ? "text-green-600" : "text-slate-400"}
                        >
                          {obs.resolu ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(obs)}>
                          <Pencil className="h-4 w-4 text-lime-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(obs.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingObs(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingObs ? "Modifier l'observation" : "Nouvelle observation de santé"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Arbre *</Label>
                <Select value={formData.arbreId} onValueChange={(v) => setFormData({ ...formData, arbreId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {arbres.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES_OBS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gravité</Label>
                <Select value={formData.gravite} onValueChange={(v) => setFormData({ ...formData, gravite: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRAVITES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Organe</Label>
                <Select value={formData.organe} onValueChange={(v) => setFormData({ ...formData, organe: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {ORGANES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Symptômes</Label>
                <Input value={formData.symptome} onChange={(e) => setFormData({ ...formData, symptome: e.target.value })} placeholder="Ex: Taches brunes sur feuilles" />
              </div>
              <div>
                <Label>Diagnostic</Label>
                <Input value={formData.diagnostic} onChange={(e) => setFormData({ ...formData, diagnostic: e.target.value })} placeholder="Ex: Tavelure" />
              </div>
            </div>

            {/* Section traitement (affichée si type maladie/ravageur) */}
            {(formData.type === "maladie" || formData.type === "ravageur") && (
              <Card className="border-dashed">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Traitement appliqué
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Méthode</Label>
                      <Select value={formData.methodeTraitement} onValueChange={(v) => setFormData({ ...formData, methodeTraitement: v })}>
                        <SelectTrigger><SelectValue placeholder="Choisir la méthode" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chimique">Chimique (produit phyto)</SelectItem>
                          <SelectItem value="biologique">Biologique (purin, décoction...)</SelectItem>
                          <SelectItem value="mecanique">Mécanique / manuel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Action réalisée</Label>
                      <Input value={formData.traitement} onChange={(e) => setFormData({ ...formData, traitement: e.target.value })} placeholder="Ex: Pulvérisation, taille sanitaire, piège..." />
                    </div>
                  </div>
                  {(formData.methodeTraitement === "chimique" || formData.methodeTraitement === "biologique") && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Produit</Label>
                          <Input value={formData.produit} onChange={(e) => setFormData({ ...formData, produit: e.target.value })} placeholder="Nom commercial" />
                        </div>
                        {formData.methodeTraitement === "chimique" && (
                          <div>
                            <Label>N° AMM</Label>
                            <Input value={formData.numAMM} onChange={(e) => setFormData({ ...formData, numAMM: e.target.value })} placeholder="Ex: 2210548" />
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Dose</Label>
                          <Input type="number" step="0.01" value={formData.doseAppliquee} onChange={(e) => setFormData({ ...formData, doseAppliquee: e.target.value })} />
                        </div>
                        <div>
                          <Label>Unité</Label>
                          <Select value={formData.uniteDose} onValueChange={(v) => setFormData({ ...formData, uniteDose: v })}>
                            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="L/ha">L/ha</SelectItem>
                              <SelectItem value="kg/ha">kg/ha</SelectItem>
                              <SelectItem value="g/L">g/L</SelectItem>
                              <SelectItem value="mL/L">mL/L</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>DAR (jours)</Label>
                          <Input type="number" value={formData.dar} onChange={(e) => setFormData({ ...formData, dar: e.target.value })} placeholder="Délai avant récolte" />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={!formData.arbreId}>
              {editingObs ? "Enregistrer les modifications" : "Enregistrer l'observation"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Registre phytosanitaire
// ============================================================

function RegistrePhytoSubTab() {
  const { toast } = useToast()
  const [observations, setObservations] = React.useState<Observation[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editingObs, setEditingObs] = React.useState<Observation | null>(null)
  const [showEditDialog, setShowEditDialog] = React.useState(false)
  const [showAddDialog, setShowAddDialog] = React.useState(false)
  const [editForm, setEditForm] = React.useState({
    produit: "",
    numAMM: "",
    doseAppliquee: "",
    uniteDose: "",
    dar: "",
    traitement: "",
    methodeTraitement: "",
  })
  const [addForm, setAddForm] = React.useState({
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    type: "maladie" as string,
    diagnostic: "",
    symptome: "",
    methodeTraitement: "chimique" as string,
    produit: "",
    numAMM: "",
    doseAppliquee: "",
    uniteDose: "",
    dar: "",
    traitement: "",
    gravite: "faible",
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [malRes, ravRes, arbresRes] = await Promise.all([
        fetch("/api/arbres/observations?type=maladie&resolu=all"),
        fetch("/api/arbres/observations?type=ravageur&resolu=all"),
        fetch("/api/arbres"),
      ])
      const allObs: Observation[] = []
      const ids = new Set<number>()
      if (malRes.ok) {
        const mal = await malRes.json()
        mal.filter((o: Observation) => o.produit || o.traitement).forEach((o: Observation) => {
          if (!ids.has(o.id)) { ids.add(o.id); allObs.push(o) }
        })
      }
      if (ravRes.ok) {
        const rav = await ravRes.json()
        rav.filter((o: Observation) => o.produit || o.traitement).forEach((o: Observation) => {
          if (!ids.has(o.id)) { ids.add(o.id); allObs.push(o) }
        })
      }
      setObservations(allObs)
      if (arbresRes.ok) setArbres(await arbresRes.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const openEdit = (obs: Observation) => {
    setEditingObs(obs)
    setEditForm({
      produit: obs.produit || "",
      numAMM: obs.numAMM || "",
      doseAppliquee: obs.doseAppliquee?.toString() || "",
      uniteDose: obs.uniteDose || "",
      dar: obs.dar?.toString() || "",
      traitement: obs.traitement || "",
      methodeTraitement: obs.methodeTraitement || (obs.produit ? "chimique" : "mecanique"),
    })
    setShowEditDialog(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingObs) return
    try {
      const res = await fetch(`/api/arbres/observations/${editingObs.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produit: editForm.produit || null,
          numAMM: editForm.numAMM || null,
          doseAppliquee: editForm.doseAppliquee || null,
          uniteDose: editForm.uniteDose || null,
          dar: editForm.dar || null,
          traitement: editForm.traitement || null,
          methodeTraitement: editForm.methodeTraitement || null,
        }),
      })
      if (res.ok) {
        setShowEditDialog(false)
        setEditingObs(null)
        toast({ title: "Traitement mis à jour" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/arbres/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          doseAppliquee: addForm.doseAppliquee || null,
          dar: addForm.dar || null,
        }),
      })
      if (res.ok) {
        setShowAddDialog(false)
        setAddForm({
          arbreId: "",
          date: new Date().toISOString().split("T")[0],
          type: "maladie",
          diagnostic: "",
          symptome: "",
          methodeTraitement: "chimique",
          produit: "",
          numAMM: "",
          doseAppliquee: "",
          uniteDose: "",
          dar: "",
          traitement: "",
          gravite: "faible",
          notes: "",
        })
        toast({ title: "Traitement enregistré" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  // Distinguer traitements par methodeTraitement (fallback: produit rempli = chimique)
  const getMethode = (o: Observation) => o.methodeTraitement || (o.produit ? "chimique" : "mecanique")
  const chimiques = observations.filter((o) => getMethode(o) === "chimique")
  const biologiques = observations.filter((o) => getMethode(o) === "biologique")
  const mecaniques = observations.filter((o) => getMethode(o) === "mecanique")
  const complets = chimiques.filter((o) => o.numAMM && o.doseAppliquee && o.dar).length
  const incomplets = chimiques.length - complets
  const bioComplets = biologiques.filter((o) => o.produit && o.doseAppliquee).length
  const bioIncomplets = biologiques.length - bioComplets

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
            <Shield className="h-4 w-4" />
            Registre phytosanitaire
          </CardTitle>
          <CardDescription className="text-amber-600">
            Conformité Bio / HVE - Tous les traitements avec n° AMM, dose et DAR
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total traitements</p>
            <p className="text-2xl font-bold">{observations.length}</p>
          </CardContent>
        </Card>
        <Card className={incomplets > 0 ? "border-red-200" : complets > 0 ? "border-green-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3 text-amber-500" />
              Chimiques
            </p>
            <p className="text-2xl font-bold">{chimiques.length}</p>
            {chimiques.length > 0 && (
              <p className="text-xs mt-1">
                <span className="text-green-600">{complets} complet{complets > 1 ? "s" : ""}</span>
                {incomplets > 0 && <span className="text-red-600 ml-2">{incomplets} incomplet{incomplets > 1 ? "s" : ""}</span>}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className={biologiques.length > 0 ? "border-emerald-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Leaf className="h-3 w-3 text-emerald-500" />
              Biologiques
            </p>
            <p className="text-2xl font-bold text-emerald-600">{biologiques.length}</p>
          </CardContent>
        </Card>
        <Card className={mecaniques.length > 0 ? "border-blue-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Leaf className="h-3 w-3 text-blue-500" />
              Mécaniques
            </p>
            <p className="text-2xl font-bold text-blue-600">{mecaniques.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bouton ajouter */}
      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter un traitement
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-muted-foreground">Chargement...</p>
          ) : observations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun traitement enregistré</p>
              <p className="text-sm">Ajoutez des traitements avec le bouton ci-dessus</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Arbre</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Produit / Action</TableHead>
                  <TableHead>N° AMM</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>DAR</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((obs) => {
                  const methode = getMethode(obs)
                  const needsAmm = methode === "chimique"
                  const needsDose = methode === "chimique" || methode === "biologique"
                  const isComplete = needsAmm ? (obs.numAMM && obs.doseAppliquee && obs.dar) : needsDose ? (obs.produit && obs.doseAppliquee) : true
                  const methodeBadge = methode === "chimique"
                    ? <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Chimique</Badge>
                    : methode === "biologique"
                    ? <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Biologique</Badge>
                    : <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Mécanique</Badge>
                  return (
                    <TableRow key={obs.id} className={!isComplete ? "bg-red-50/50" : ""}>
                      <TableCell className="text-sm">{new Date(obs.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{obs.arbre.nom}</TableCell>
                      <TableCell className="text-sm">{obs.diagnostic || obs.symptome || "-"}</TableCell>
                      <TableCell>{methodeBadge}</TableCell>
                      <TableCell className="font-medium">{obs.produit || obs.traitement || "-"}</TableCell>
                      <TableCell>
                        {obs.numAMM ? (
                          <Badge variant="outline" className="text-xs">{obs.numAMM}</Badge>
                        ) : needsAmm ? (
                          <Badge variant="destructive" className="text-xs">Manquant</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {obs.doseAppliquee ? `${obs.doseAppliquee} ${obs.uniteDose || ""}` : needsDose ? (
                          <Badge variant="destructive" className="text-xs">Manquant</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {obs.dar ? (
                          <Badge variant="outline">{obs.dar}j</Badge>
                        ) : needsAmm ? (
                          <Badge variant="destructive" className="text-xs">Manquant</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(obs)}>
                          <Pencil className="h-4 w-4 text-lime-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog édition phyto */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditingObs(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les données phyto</DialogTitle>
          </DialogHeader>
          {editingObs && (
            <div className="mb-2 text-sm text-muted-foreground">
              <span className="font-medium">{editingObs.arbre.nom}</span> — {editingObs.diagnostic || editingObs.symptome || "Traitement"} — {new Date(editingObs.date).toLocaleDateString("fr-FR")}
            </div>
          )}
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Méthode</Label>
                <Select value={editForm.methodeTraitement} onValueChange={(v) => setEditForm({ ...editForm, methodeTraitement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chimique">Chimique (produit phyto)</SelectItem>
                    <SelectItem value="biologique">Biologique (purin, décoction...)</SelectItem>
                    <SelectItem value="mecanique">Mécanique / manuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action réalisée</Label>
                <Input value={editForm.traitement} onChange={(e) => setEditForm({ ...editForm, traitement: e.target.value })} placeholder="Ex: Pulvérisation, taille sanitaire, piège..." />
              </div>
            </div>
            {(editForm.methodeTraitement === "chimique" || editForm.methodeTraitement === "biologique") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Produit</Label>
                    <Input value={editForm.produit} onChange={(e) => setEditForm({ ...editForm, produit: e.target.value })} placeholder="Nom commercial" />
                  </div>
                  {editForm.methodeTraitement === "chimique" && (
                    <div>
                      <Label>N° AMM</Label>
                      <Input value={editForm.numAMM} onChange={(e) => setEditForm({ ...editForm, numAMM: e.target.value })} placeholder="Ex: 2210548" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Dose</Label>
                    <Input type="number" step="0.01" value={editForm.doseAppliquee} onChange={(e) => setEditForm({ ...editForm, doseAppliquee: e.target.value })} />
                  </div>
                  <div>
                    <Label>Unité</Label>
                    <Select value={editForm.uniteDose} onValueChange={(v) => setEditForm({ ...editForm, uniteDose: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L/ha">L/ha</SelectItem>
                        <SelectItem value="kg/ha">kg/ha</SelectItem>
                        <SelectItem value="g/L">g/L</SelectItem>
                        <SelectItem value="mL/L">mL/L</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DAR (jours)</Label>
                    <Input type="number" value={editForm.dar} onChange={(e) => setEditForm({ ...editForm, dar: e.target.value })} placeholder="Délai avant récolte" />
                  </div>
                </div>
              </>
            )}
            <Button type="submit" className="w-full">
              Enregistrer les modifications
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog ajout traitement */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un traitement phytosanitaire</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Arbre *</Label>
                <Select value={addForm.arbreId} onValueChange={(v) => setAddForm({ ...addForm, arbreId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {arbres.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maladie">Maladie</SelectItem>
                    <SelectItem value="ravageur">Ravageur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cible / Diagnostic</Label>
                <Input value={addForm.diagnostic} onChange={(e) => setAddForm({ ...addForm, diagnostic: e.target.value })} placeholder="Ex: Tavelure, Carpocapse, Bactériose..." />
              </div>
              <div>
                <Label>Symptômes</Label>
                <Input value={addForm.symptome} onChange={(e) => setAddForm({ ...addForm, symptome: e.target.value })} placeholder="Ex: Taches brunes..." />
              </div>
            </div>
            <Card className="border-dashed">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Traitement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Méthode</Label>
                    <Select value={addForm.methodeTraitement} onValueChange={(v) => setAddForm({ ...addForm, methodeTraitement: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chimique">Chimique (produit phyto)</SelectItem>
                        <SelectItem value="biologique">Biologique (purin, décoction...)</SelectItem>
                        <SelectItem value="mecanique">Mécanique / manuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action réalisée</Label>
                    <Input value={addForm.traitement} onChange={(e) => setAddForm({ ...addForm, traitement: e.target.value })} placeholder="Ex: Pulvérisation, taille sanitaire, piège..." />
                  </div>
                </div>
                {(addForm.methodeTraitement === "chimique" || addForm.methodeTraitement === "biologique") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Produit</Label>
                        <Input value={addForm.produit} onChange={(e) => setAddForm({ ...addForm, produit: e.target.value })} placeholder="Nom commercial" />
                      </div>
                      {addForm.methodeTraitement === "chimique" && (
                        <div>
                          <Label>N° AMM</Label>
                          <Input value={addForm.numAMM} onChange={(e) => setAddForm({ ...addForm, numAMM: e.target.value })} placeholder="Ex: 2210548" />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Dose</Label>
                        <Input type="number" step="0.01" value={addForm.doseAppliquee} onChange={(e) => setAddForm({ ...addForm, doseAppliquee: e.target.value })} />
                      </div>
                      <div>
                        <Label>Unité</Label>
                        <Select value={addForm.uniteDose} onValueChange={(v) => setAddForm({ ...addForm, uniteDose: v })}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="L/ha">L/ha</SelectItem>
                            <SelectItem value="kg/ha">kg/ha</SelectItem>
                            <SelectItem value="g/L">g/L</SelectItem>
                            <SelectItem value="mL/L">mL/L</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>DAR (jours)</Label>
                        <Input type="number" value={addForm.dar} onChange={(e) => setAddForm({ ...addForm, dar: e.target.value })} placeholder="Délai avant récolte" />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <div>
              <Label>Notes</Label>
              <Textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={!addForm.arbreId}>
              Enregistrer le traitement
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Pollinisation
// ============================================================

function PollinisationSubTab() {
  const { toast } = useToast()
  const [data, setData] = React.useState<PollinisationData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [showDialog, setShowDialog] = React.useState(false)
  const [formData, setFormData] = React.useState({
    arbrePolliniseId: "",
    arbrePollinisateurId: "",
    compatibilite: "bonne",
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/arbres/pollinisation")
      if (res.ok) setData(await res.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/arbres/pollinisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowDialog(false)
        setFormData({ arbrePolliniseId: "", arbrePollinisateurId: "", compatibilite: "bonne", notes: "" })
        toast({ title: "Association créée" })
        fetchData()
      } else {
        const err = await res.json()
        toast({ title: err.error || "Erreur", variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/arbres/pollinisation?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Association supprimée" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Flower2 className="h-3 w-3 text-lime-500" />
              Arbres fruitiers
            </p>
            <p className="text-2xl font-bold">{data?.stats.totalArbres || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Autofertiles</p>
            <p className="text-2xl font-bold text-lime-600">{data?.stats.autofertiles || 0}</p>
          </CardContent>
        </Card>
        <Card className={data?.stats.sansPollinisateur ? "border-red-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              Sans pollinisateur
            </p>
            <p className="text-2xl font-bold text-red-600">{data?.stats.sansPollinisateur || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      {data?.alertes && data.alertes.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Arbres sans pollinisateur compatible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.alertes.map((a) => (
                <Badge key={a.id} variant="destructive" className="text-xs">
                  {a.nom} {a.floraison ? `(${a.floraison})` : ""} {a.groupePollinisation ? `Gr.${a.groupePollinisation}` : ""}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header + bouton */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Associations de pollinisation</h3>
        <Button onClick={() => setShowDialog(true)} size="sm" className="bg-lime-600 hover:bg-lime-700">
          <Plus className="h-4 w-4 mr-1" />
          Association
        </Button>
      </div>

      {/* Table des arbres avec leurs pollinisateurs */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-muted-foreground">Chargement...</p>
          ) : !data?.arbres.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <Flower2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun arbre fruitier</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arbre</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead>Floraison</TableHead>
                  <TableHead>Groupe</TableHead>
                  <TableHead>Autofertile</TableHead>
                  <TableHead>Pollinisateurs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.arbres.map((arbre) => (
                  <TableRow key={arbre.id} className={!arbre.autofertile && arbre.pollinisateursCompat.length === 0 ? "bg-red-50" : ""}>
                    <TableCell className="font-medium">{arbre.nom}</TableCell>
                    <TableCell className="text-sm">{arbre.espece || "-"}</TableCell>
                    <TableCell>
                      {arbre.floraison ? (
                        <Badge variant="outline" className="capitalize text-xs">{arbre.floraison.replace(/_/g, " ")}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {arbre.groupePollinisation ? (
                        <Badge className="bg-lime-100 text-lime-700">{arbre.groupePollinisation}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {arbre.autofertile ? (
                        <Badge className="bg-lime-100 text-lime-700">Oui</Badge>
                      ) : (
                        <Badge variant="outline">Non</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {arbre.pollinisateursCompat.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {arbre.pollinisateursCompat.map((p) => (
                            <Badge key={p.arbrePollinisateur.id} variant="outline" className="text-xs">
                              {p.arbrePollinisateur.nom}
                            </Badge>
                          ))}
                        </div>
                      ) : arbre.autofertile ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        <span className="text-sm text-red-500">Aucun !</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle association de pollinisation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Arbre à polliniser *</Label>
              <Select value={formData.arbrePolliniseId} onValueChange={(v) => setFormData({ ...formData, arbrePolliniseId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {data?.arbres.filter((a) => !a.autofertile).map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.nom} {a.espece ? `(${a.espece})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pollinisateur *</Label>
              <Select value={formData.arbrePollinisateurId} onValueChange={(v) => setFormData({ ...formData, arbrePollinisateurId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {data?.arbres.filter((a) => a.id.toString() !== formData.arbrePolliniseId).map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.nom} {a.espece ? `(${a.espece})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Compatibilité</Label>
              <Select value={formData.compatibilite} onValueChange={(v) => setFormData({ ...formData, compatibilite: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellente">Excellente</SelectItem>
                  <SelectItem value="bonne">Bonne</SelectItem>
                  <SelectItem value="partielle">Partielle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={!formData.arbrePolliniseId || !formData.arbrePollinisateurId}>
              Créer l'association
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
