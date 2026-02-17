"use client"

/**
 * Page Consommations d'Aliments (élevage)
 * Suivi de l'alimentation des animaux
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  TrendingDown,
  Plus,
  RefreshCw,
  Calendar,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useToast } from "@/hooks/use-toast"

interface Consommation {
  id: number
  date: string
  quantite: number
  notes: string | null
  aliment: { id: string; nom: string; type: string | null }
  lot: { id: number; nom: string | null } | null
}

interface Aliment {
  id: string
  nom: string
  type: string | null
}

interface Lot {
  id: number
  nom: string | null
  especeAnimale: { nom: string }
}

interface Stats {
  totalKg: number
  nbEnregistrements: number
  parAliment: {
    alimentId: string
    nom: string
    totalKg: number
    count: number
  }[]
}

export default function ConsommationsAlimentsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [consommations, setConsommations] = React.useState<Consommation[]>([])
  const [aliments, setAliments] = React.useState<Aliment[]>([])
  const [lots, setLots] = React.useState<Lot[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  // Filtres
  const [filterDateDebut, setFilterDateDebut] = React.useState("")
  const [filterDateFin, setFilterDateFin] = React.useState("")

  // Formulaire
  const [formData, setFormData] = React.useState({
    alimentId: "",
    lotId: "",
    date: new Date().toISOString().split("T")[0],
    quantite: "",
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = "/api/elevage/consommations-aliments?limit=200"
      if (filterDateDebut) url += `&dateDebut=${filterDateDebut}`
      if (filterDateFin) url += `&dateFin=${filterDateFin}`

      const [consRes, alimRes, lotsRes] = await Promise.all([
        fetch(url),
        fetch("/api/elevage/aliments"),
        fetch("/api/elevage/lots?statut=actif"),
      ])

      if (consRes.ok) {
        const result = await consRes.json()
        setConsommations(result.data)
        setStats(result.stats)
      }
      if (alimRes.ok) {
        const result = await alimRes.json()
        setAliments(result.data)
      }
      if (lotsRes.ok) {
        const result = await lotsRes.json()
        setLots(result.data)
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
  }, [toast, filterDateDebut, filterDateFin])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch("/api/elevage/consommations-aliments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alimentId: formData.alimentId,
          lotId: formData.lotId ? parseInt(formData.lotId) : null,
          date: formData.date,
          quantite: parseFloat(formData.quantite),
          notes: formData.notes || null,
        }),
      })

      if (!response.ok) throw new Error("Erreur création")

      toast({
        title: "Consommation enregistrée",
        description: `${formData.quantite} kg ajoutés`,
      })
      setIsDialogOpen(false)
      setFormData({
        alimentId: formData.alimentId,
        lotId: formData.lotId,
        date: new Date().toISOString().split("T")[0],
        quantite: "",
        notes: "",
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer la consommation",
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette consommation ? Le stock sera restauré.")) return

    try {
      const response = await fetch(
        `/api/elevage/consommations-aliments?id=${id}`,
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error("Erreur suppression")
      toast({ title: "Consommation supprimée, stock restauré" })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/elevage">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Elevage
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-teal-600" />
              <h1 className="text-xl font-bold">Consommations Aliments</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Saisie rapide
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nouvelle consommation</DialogTitle>
                  <DialogDescription>
                    Enregistrer une distribution d'aliment
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Aliment *</Label>
                    <Select
                      value={formData.alimentId}
                      onValueChange={(v) =>
                        setFormData((f) => ({ ...f, alimentId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner l'aliment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {aliments.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lot (optionnel)</Label>
                    <Select
                      value={formData.lotId}
                      onValueChange={(v) =>
                        setFormData((f) => ({ ...f, lotId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les animaux" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Tous</SelectItem>
                        {lots.map((l) => (
                          <SelectItem key={l.id} value={l.id.toString()}>
                            {l.nom || `Lot #${l.id}`} ({l.especeAnimale.nom})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData((f) => ({ ...f, date: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité (kg) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.quantite}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            quantite: e.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, notes: e.target.value }))
                      }
                      placeholder="Observations..."
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={!formData.alimentId || !formData.quantite}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-teal-600" />
                  Total consommé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.totalKg.toFixed(1)} kg
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.nbEnregistrements} enregistrements
                </p>
              </CardContent>
            </Card>
            {stats.parAliment.slice(0, 2).map((a) => (
              <Card key={a.alimentId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    {a.nom}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{a.totalKg.toFixed(1)} kg</p>
                  <p className="text-xs text-muted-foreground">
                    {a.count} distributions
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtres dates */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={filterDateDebut}
              onChange={(e) => setFilterDateDebut(e.target.value)}
              className="w-[160px]"
              placeholder="Du..."
            />
            <span className="text-muted-foreground">au</span>
            <Input
              type="date"
              value={filterDateFin}
              onChange={(e) => setFilterDateFin(e.target.value)}
              className="w-[160px]"
              placeholder="Au..."
            />
            {(filterDateDebut || filterDateFin) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDateDebut("")
                  setFilterDateFin("")
                }}
              >
                Effacer
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des consommations</CardTitle>
            <CardDescription>200 derniers enregistrements</CardDescription>
          </CardHeader>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Aliment</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consommations.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {new Date(c.date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.aliment.nom}
                      </TableCell>
                      <TableCell>
                        {c.lot?.nom || c.lot ? `Lot #${c.lot.id}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {c.quantite} kg
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {c.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {consommations.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Aucune consommation enregistrée
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
