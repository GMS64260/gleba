"use client"

/**
 * Page Stocks Aliments
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Package, Plus, RefreshCw, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Aliment {
  id: string
  nom: string
  type: string | null
  especesCibles: string | null
  proteines: number | null
  prix: number | null
  stock: number | null
  stockMin: number | null
  dateStock: string | null
  fournisseur: { id: string; contact: string | null } | null
  _count: { consommations: number }
}

export default function AlimentsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [aliments, setAliments] = React.useState<Aliment[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingStock, setEditingStock] = React.useState<string | null>(null)
  const [newStock, setNewStock] = React.useState("")

  const [formData, setFormData] = React.useState({
    id: "", nom: "", type: "granules", especesCibles: "", prix: "", stock: "", stockMin: "", description: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/elevage/aliments')
      if (response.ok) {
        const result = await response.json()
        setAliments(result.data)
        setStats(result.stats)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les aliments" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Aliment créé" })
      setIsDialogOpen(false)
      setFormData({ id: "", nom: "", type: "granules", especesCibles: "", prix: "", stock: "", stockMin: "", description: "" })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer l'aliment" })
    }
  }

  const updateStock = async (id: string) => {
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock: parseFloat(newStock) }),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Stock mis à jour" })
      setEditingStock(null)
      setNewStock("")
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
            <Link href="/elevage"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Élevage</Button></Link>
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold">Stocks Aliments</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouvel aliment</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Ajouter un aliment</DialogTitle><DialogDescription>Granulés, céréales, foin...</DialogDescription></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>ID *</Label><Input value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, '_') }))} placeholder="granules_pondeuses" /></div>
                    <div className="space-y-2"><Label>Nom *</Label><Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} placeholder="Granulés pondeuses" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Prix (€/kg)</Label><Input type="number" step="0.01" value={formData.prix} onChange={(e) => setFormData(f => ({ ...f, prix: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Stock (kg)</Label><Input type="number" step="0.1" value={formData.stock} onChange={(e) => setFormData(f => ({ ...f, stock: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Stock minimum (alerte)</Label><Input type="number" step="0.1" value={formData.stockMin} onChange={(e) => setFormData(f => ({ ...f, stockMin: e.target.value }))} /></div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={!formData.id || !formData.nom}>Créer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {stats && stats.stockBas > 0 && (
          <Card className="border-orange-200 bg-orange-50 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-orange-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Alerte stock bas</CardTitle>
            </CardHeader>
            <CardContent><p className="text-orange-800">{stats.stockBas} aliment(s) en dessous du seuil minimum</p></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Liste des aliments</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aliment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Prix/kg</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Seuil min</TableHead>
                    <TableHead>MAJ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aliments.map((a) => {
                    const stockBas = a.stock !== null && a.stockMin !== null && a.stock <= a.stockMin
                    return (
                      <TableRow key={a.id} className={stockBas ? "bg-orange-50" : ""}>
                        <TableCell className="font-medium">{a.nom}</TableCell>
                        <TableCell><Badge variant="outline">{a.type || '-'}</Badge></TableCell>
                        <TableCell className="text-right">{a.prix ? `${a.prix.toFixed(2)} €` : '-'}</TableCell>
                        <TableCell className="text-right">
                          {editingStock === a.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input type="number" step="0.1" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="w-20 h-8" autoFocus />
                              <Button size="sm" variant="ghost" onClick={() => updateStock(a.id)}>✓</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingStock(null); setNewStock("") }}>×</Button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingStock(a.id); setNewStock(a.stock?.toString() || "") }} className={`font-bold hover:underline ${stockBas ? 'text-orange-600' : ''}`}>
                              {a.stock !== null ? `${a.stock} kg` : '-'}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{a.stockMin !== null ? `${a.stockMin} kg` : '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{a.dateStock ? new Date(a.dateStock).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell>{stockBas && <AlertTriangle className="h-4 w-4 text-orange-500" />}</TableCell>
                      </TableRow>
                    )
                  })}
                  {aliments.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun aliment enregistré</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
