"use client"

/**
 * Onglet Reproduction - Naissances + Calculateur gestation
 */

import * as React from "react"
import {
  Baby,
  Plus,
  RefreshCw,
  Calendar,
  Calculator,
  Trash2,
  Heart,
} from "lucide-react"

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
import { useToast } from "@/hooks/use-toast"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts"

// ============================================================
// Types
// ============================================================

interface Naissance {
  id: number
  date: string
  nombreNes: number
  nombreVivants: number
  nombreMales: number | null
  nombreFemelles: number | null
  poidsTotal: number | null
  pereIdentifiant: string | null
  notes: string | null
  mere: {
    id: number
    nom: string | null
    identifiant: string | null
    race: string | null
    especeAnimale: {
      id: string
      nom: string
      dureeGestation: number | null
      dureeCouvaison: number | null
    }
  } | null
}

interface NaissanceStats {
  totalNaissances: number
  totalNes: number
  totalVivants: number
  totalMales: number
  totalFemelles: number
  tauxSurvie: number | null
  parMois: { mois: number; nes: number; vivants: number }[]
}

interface AnimalFemelle {
  id: number
  nom: string | null
  identifiant: string | null
  race: string | null
  especeAnimale: {
    id: string
    nom: string
    dureeGestation: number | null
    dureeCouvaison: number | null
  }
}

const MOIS_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']

// ============================================================
// Composant principal
// ============================================================

export function ReproductionTab() {
  return (
    <Tabs defaultValue="naissances" className="space-y-4">
      <TabsList>
        <TabsTrigger value="naissances" className="flex items-center gap-1.5">
          <Baby className="h-4 w-4" />
          Naissances
        </TabsTrigger>
        <TabsTrigger value="calculateur" className="flex items-center gap-1.5">
          <Calculator className="h-4 w-4" />
          Calculateur
        </TabsTrigger>
      </TabsList>

      <TabsContent value="naissances">
        <NaissancesSubTab />
      </TabsContent>
      <TabsContent value="calculateur">
        <CalculateurSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Naissances
// ============================================================

function NaissancesSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [naissances, setNaissances] = React.useState<Naissance[]>([])
  const [stats, setStats] = React.useState<NaissanceStats | null>(null)
  const [femelles, setFemelles] = React.useState<AnimalFemelle[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    mereId: "", pereIdentifiant: "",
    date: new Date().toISOString().split('T')[0],
    nombreNes: "", nombreVivants: "",
    nombreMales: "", nombreFemelles: "",
    poidsTotal: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [naissRes, animauxRes] = await Promise.all([
        fetch('/api/elevage/naissances'),
        fetch('/api/elevage/animaux?statut=actif&sexe=femelle'),
      ])

      if (naissRes.ok) {
        const result = await naissRes.json()
        setNaissances(result.data)
        setStats(result.stats)
      }
      if (animauxRes.ok) {
        const result = await animauxRes.json()
        setFemelles(result.data || [])
      }
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
      const response = await fetch('/api/elevage/naissances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Naissance enregistrée", description: `${formData.nombreNes} ne(s), ${formData.nombreVivants} vivant(s)` })
      setIsDialogOpen(false)
      setFormData({
        mereId: "", pereIdentifiant: "",
        date: new Date().toISOString().split('T')[0],
        nombreNes: "", nombreVivants: "",
        nombreMales: "", nombreFemelles: "",
        poidsTotal: "", notes: "",
      })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette naissance ?")) return
    try {
      await fetch(`/api/elevage/naissances?id=${id}`, { method: 'DELETE' })
      toast({ title: "Naissance supprimée" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Preparer donnees graphique
  const chartData = React.useMemo(() => {
    if (!stats?.parMois) return []
    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      nes: stats.parMois[i]?.nes || 0,
      vivants: stats.parMois[i]?.vivants || 0,
    }))
  }, [stats])

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && stats.totalNaissances > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-pink-400 to-pink-500 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-pink-100 text-xs">Naissances</CardDescription>
              <CardTitle className="text-2xl">{stats.totalNaissances}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xs text-pink-100">mises bas / eclosions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Total nes</CardDescription>
              <CardTitle className="text-2xl">{stats.totalNes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Vivants</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.totalVivants}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Taux survie</CardDescription>
              <CardTitle className={`text-2xl ${(stats.tauxSurvie || 0) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                {stats.tauxSurvie !== null ? `${stats.tauxSurvie}%` : '-'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Sexes</CardDescription>
              <CardTitle className="text-lg">
                {stats.totalMales > 0 && <span className="text-blue-600">{stats.totalMales}M</span>}
                {stats.totalMales > 0 && stats.totalFemelles > 0 && ' / '}
                {stats.totalFemelles > 0 && <span className="text-pink-600">{stats.totalFemelles}F</span>}
                {stats.totalMales === 0 && stats.totalFemelles === 0 && '-'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Graphique naissances par mois */}
      {stats && stats.totalNaissances > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Naissances par mois</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="nes" fill="#f472b6" radius={[4, 4, 0, 0]} name="Nes" />
                  <Bar dataKey="vivants" fill="#34d399" radius={[4, 4, 0, 0]} name="Vivants" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouvelle naissance</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enregistrer une naissance</DialogTitle>
              <DialogDescription>Mise bas ou eclosion</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Mere</Label>
                <Select value={formData.mereId} onValueChange={(v) => setFormData(f => ({ ...f, mereId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner la mere..." /></SelectTrigger>
                  <SelectContent>
                    {femelles.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.nom || a.identifiant || `#${a.id}`} ({a.especeAnimale.nom})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Pere (identifiant)</Label>
                  <Input value={formData.pereIdentifiant} onChange={(e) => setFormData(f => ({ ...f, pereIdentifiant: e.target.value }))} placeholder="Optionnel" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre nes *</Label>
                  <Input type="number" min="0" value={formData.nombreNes} onChange={(e) => setFormData(f => ({ ...f, nombreNes: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre vivants *</Label>
                  <Input type="number" min="0" value={formData.nombreVivants} onChange={(e) => setFormData(f => ({ ...f, nombreVivants: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Males</Label>
                  <Input type="number" min="0" value={formData.nombreMales} onChange={(e) => setFormData(f => ({ ...f, nombreMales: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Femelles</Label>
                  <Input type="number" min="0" value={formData.nombreFemelles} onChange={(e) => setFormData(f => ({ ...f, nombreFemelles: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Poids total (kg)</Label>
                  <Input type="number" step="0.01" value={formData.poidsTotal} onChange={(e) => setFormData(f => ({ ...f, poidsTotal: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Complications, observations..." />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.nombreNes || !formData.nombreVivants}>Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Historique des naissances</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mere</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead className="text-right">Nes</TableHead>
                  <TableHead className="text-right">Vivants</TableHead>
                  <TableHead className="text-right">M / F</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {naissances.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{new Date(n.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">
                      {n.mere ? (n.mere.nom || n.mere.identifiant || `#${n.mere.id}`) : '-'}
                    </TableCell>
                    <TableCell>{n.mere?.especeAnimale.nom || '-'}</TableCell>
                    <TableCell className="text-right font-bold">{n.nombreNes}</TableCell>
                    <TableCell className="text-right text-green-600 font-bold">{n.nombreVivants}</TableCell>
                    <TableCell className="text-right">
                      {n.nombreMales !== null || n.nombreFemelles !== null
                        ? `${n.nombreMales || 0}M / ${n.nombreFemelles || 0}F`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">{n.poidsTotal ? `${n.poidsTotal} kg` : '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{n.notes || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(n.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {naissances.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune naissance enregistrée</TableCell></TableRow>
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
// Calculateur de gestation / couvaison
// ============================================================

function CalculateurSubTab() {
  const [especes, setEspeces] = React.useState<{ id: string; nom: string; type: string; dureeGestation: number | null; dureeCouvaison: number | null }[]>([])
  const [selectedEspece, setSelectedEspece] = React.useState<string>("")
  const [dateAccouplement, setDateAccouplement] = React.useState(new Date().toISOString().split('T')[0])

  React.useEffect(() => {
    fetch('/api/elevage/especes-animales')
      .then(res => res.ok ? res.json() : null)
      .then(result => { if (result?.data) setEspeces(result.data) })
      .catch(() => {})
  }, [])

  const espece = especes.find(e => e.id === selectedEspece)
  const duree = espece?.type === 'volaille' ? espece.dureeCouvaison : espece?.dureeGestation
  const typeLabel = espece?.type === 'volaille' ? 'Couvaison' : 'Gestation'

  const dateNaissancePrevue = React.useMemo(() => {
    if (!duree || !dateAccouplement) return null
    const d = new Date(dateAccouplement)
    d.setDate(d.getDate() + duree)
    return d
  }, [duree, dateAccouplement])

  const joursRestants = React.useMemo(() => {
    if (!dateNaissancePrevue) return null
    const diff = dateNaissancePrevue.getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }, [dateNaissancePrevue])

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4 text-pink-600" />
            Calculateur de gestation / couvaison
          </CardTitle>
          <CardDescription>
            Estimez la date de naissance en fonction de l'espèce et la date d'accouplement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Espèce</Label>
            <Select value={selectedEspece} onValueChange={setSelectedEspece}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {especes.filter(e => e.dureeGestation || e.dureeCouvaison).map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom} ({e.type === 'volaille' ? `${e.dureeCouvaison || '?'}j couvaison` : `${e.dureeGestation || '?'}j gestation`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date d'accouplement / mise en couveuse</Label>
            <Input type="date" value={dateAccouplement} onChange={(e) => setDateAccouplement(e.target.value)} />
          </div>

          {espece && duree && dateNaissancePrevue && (
            <div className="bg-pink-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Baby className="h-5 w-5 text-pink-600" />
                <span className="font-medium text-pink-700">{typeLabel} : {duree} jours</span>
              </div>
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground">Date prévue de naissance</p>
                <p className="text-2xl font-bold text-pink-700">
                  {dateNaissancePrevue.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {joursRestants !== null && (
                  <Badge className={`mt-2 ${joursRestants <= 0 ? 'bg-green-100 text-green-800' : joursRestants <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-pink-100 text-pink-800'}`}>
                    {joursRestants <= 0 ? 'Terme depasse !' : joursRestants === 1 ? 'Demain !' : `Dans ${joursRestants} jours`}
                  </Badge>
                )}
              </div>

              {/* Barre de progression */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Accouplement</span>
                  <span>Naissance</span>
                </div>
                <div className="h-3 bg-pink-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, ((duree - (joursRestants || 0)) / duree) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Jour {Math.max(0, duree - (joursRestants || 0))} / {duree}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
