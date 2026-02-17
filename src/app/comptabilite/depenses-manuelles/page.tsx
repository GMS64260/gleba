"use client"

/**
 * Page Dépenses Manuelles
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Receipt, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

interface DepenseManuelle {
  id: number
  date: string
  categorie: string
  description: string
  montant: number
  module: string | null
  fournisseur: string | null
  facture: string | null
  paye: boolean
  notes: string | null
}

const CATEGORIE_LABELS: Record<string, string> = {
  materiel: "Matériel",
  carburant: "Carburant",
  main_oeuvre: "Main d'oeuvre",
  abonnement: "Abonnement",
  autre: "Autre",
}

const MODULE_LABELS: Record<string, string> = {
  potager: "Potager",
  verger: "Verger",
  elevage: "Élevage",
  general: "Général",
}

export default function DepensesManuelles() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [depenses, setDepenses] = React.useState<DepenseManuelle[]>([])
  const [stats, setStats] = React.useState<{ total: number; count: number } | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    categorie: "materiel",
    description: "",
    montant: "",
    module: "general",
    fournisseur: "",
    facture: "",
    paye: true,
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/comptabilite/depenses-manuelles?limit=100')
      if (response.ok) {
        const result = await response.json()
        setDepenses(result.data)
        setStats(result.stats)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/comptabilite/depenses-manuelles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Dépense enregistrée", description: `${formData.montant} €` })
      setIsDialogOpen(false)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        categorie: "materiel",
        description: "",
        montant: "",
        module: "general",
        fournisseur: "",
        facture: "",
        paye: true,
        notes: "",
      })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette dépense ?")) return
    try {
      const response = await fetch(`/api/comptabilite/depenses-manuelles?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Dépense supprimée" })
      fetchData()
    } catch (error) {
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
              <Receipt className="h-6 w-6 text-orange-600" />
              <h1 className="text-xl font-bold">Dépenses Manuelles</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouvelle dépense</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Enregistrer une dépense</DialogTitle>
                  <DialogDescription>Matériel, carburant, main d'oeuvre...</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie *</Label>
                      <Select value={formData.categorie} onValueChange={(v) => setFormData(f => ({ ...f, categorie: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="materiel">Matériel</SelectItem>
                          <SelectItem value="carburant">Carburant</SelectItem>
                          <SelectItem value="main_oeuvre">Main d'oeuvre</SelectItem>
                          <SelectItem value="abonnement">Abonnement</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Achat outils, essence..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant *</Label>
                      <Input type="number" step="0.01" value={formData.montant} onChange={(e) => setFormData(f => ({ ...f, montant: e.target.value }))} placeholder="€" />
                    </div>
                    <div className="space-y-2">
                      <Label>Module</Label>
                      <Select value={formData.module} onValueChange={(v) => setFormData(f => ({ ...f, module: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">Général</SelectItem>
                          <SelectItem value="potager">Potager</SelectItem>
                          <SelectItem value="verger">Verger</SelectItem>
                          <SelectItem value="elevage">Élevage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fournisseur</Label>
                      <Input value={formData.fournisseur} onChange={(e) => setFormData(f => ({ ...f, fournisseur: e.target.value }))} placeholder="Nom fournisseur" />
                    </div>
                    <div className="space-y-2">
                      <Label>N° Facture</Label>
                      <Input value={formData.facture} onChange={(e) => setFormData(f => ({ ...f, facture: e.target.value }))} placeholder="Référence" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="paye" checked={formData.paye} onCheckedChange={(c) => setFormData(f => ({ ...f, paye: !!c }))} />
                    <Label htmlFor="paye">Déjà payé</Label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={!formData.description || !formData.montant}>Enregistrer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total dépenses</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-red-600">{stats.total.toFixed(2)} €</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nombre de dépenses</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.count}</p></CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Historique des dépenses</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depenses.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{new Date(d.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant="outline">{CATEGORIE_LABELS[d.categorie] || d.categorie}</Badge></TableCell>
                      <TableCell>{d.description}</TableCell>
                      <TableCell>{d.module ? MODULE_LABELS[d.module] || d.module : '-'}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">{d.montant.toFixed(2)} €</TableCell>
                      <TableCell>{d.fournisseur || '-'}</TableCell>
                      <TableCell>
                        <Badge className={d.paye ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                          {d.paye ? "Payé" : "À payer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} className="text-red-600 hover:text-red-700">×</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {depenses.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune dépense enregistrée</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
