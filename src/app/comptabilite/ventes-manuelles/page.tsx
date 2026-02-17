"use client"

/**
 * Page Ventes Manuelles
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, ShoppingCart, Plus, RefreshCw } from "lucide-react"

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

interface VenteManuelle {
  id: number
  date: string
  categorie: string
  description: string
  quantite: number | null
  unite: string | null
  prixUnitaire: number | null
  montant: number
  client: string | null
  module: string | null
  paye: boolean
  notes: string | null
}

const CATEGORIE_LABELS: Record<string, string> = {
  legumes: "Légumes",
  fruits: "Fruits",
  transformation: "Transformation",
  service: "Service",
  autre: "Autre",
}

export default function VentesManuelles() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [ventes, setVentes] = React.useState<VenteManuelle[]>([])
  const [stats, setStats] = React.useState<{ total: number; count: number } | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    categorie: "legumes",
    description: "",
    quantite: "",
    unite: "kg",
    prixUnitaire: "",
    montant: "",
    client: "",
    module: "potager",
    paye: true,
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/comptabilite/ventes-manuelles?limit=100')
      if (response.ok) {
        const result = await response.json()
        setVentes(result.data)
        setStats(result.stats)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Calcul automatique du montant
  React.useEffect(() => {
    if (formData.quantite && formData.prixUnitaire) {
      const montant = parseFloat(formData.quantite) * parseFloat(formData.prixUnitaire)
      setFormData(f => ({ ...f, montant: montant.toFixed(2) }))
    }
  }, [formData.quantite, formData.prixUnitaire])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/comptabilite/ventes-manuelles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Vente enregistrée", description: `${formData.montant} €` })
      setIsDialogOpen(false)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        categorie: "legumes",
        description: "",
        quantite: "",
        unite: "kg",
        prixUnitaire: "",
        montant: "",
        client: "",
        module: "potager",
        paye: true,
        notes: "",
      })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette vente ?")) return
    try {
      const response = await fetch(`/api/comptabilite/ventes-manuelles?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Vente supprimée" })
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
              <ShoppingCart className="h-6 w-6 text-emerald-600" />
              <h1 className="text-xl font-bold">Ventes Manuelles</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouvelle vente</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Enregistrer une vente</DialogTitle>
                  <DialogDescription>Légumes, fruits, services...</DialogDescription>
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
                          <SelectItem value="legumes">Légumes</SelectItem>
                          <SelectItem value="fruits">Fruits</SelectItem>
                          <SelectItem value="transformation">Transformation</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Tomates, courgettes..." />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantité</Label>
                      <Input type="number" step="0.1" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unité</Label>
                      <Select value={formData.unite} onValueChange={(v) => setFormData(f => ({ ...f, unite: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="unite">unité</SelectItem>
                          <SelectItem value="botte">botte</SelectItem>
                          <SelectItem value="heure">heure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prix unit.</Label>
                      <Input type="number" step="0.01" value={formData.prixUnitaire} onChange={(e) => setFormData(f => ({ ...f, prixUnitaire: e.target.value }))} placeholder="€" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant total *</Label>
                      <Input type="number" step="0.01" value={formData.montant} onChange={(e) => setFormData(f => ({ ...f, montant: e.target.value }))} placeholder="€" />
                    </div>
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Input value={formData.client} onChange={(e) => setFormData(f => ({ ...f, client: e.target.value }))} placeholder="Nom du client" />
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
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total ventes</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-green-600">{stats.total.toFixed(2)} €</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nombre de ventes</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.count}</p></CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Historique des ventes</CardTitle></CardHeader>
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
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventes.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{new Date(v.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant="outline">{CATEGORIE_LABELS[v.categorie] || v.categorie}</Badge></TableCell>
                      <TableCell>{v.description}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{v.montant.toFixed(2)} €</TableCell>
                      <TableCell>{v.client || '-'}</TableCell>
                      <TableCell>
                        <Badge className={v.paye ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                          {v.paye ? "Payé" : "À payer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)} className="text-red-600 hover:text-red-700">×</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ventes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune vente enregistrée</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
