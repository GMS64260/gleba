"use client"

/**
 * Page Gestion des Lots
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Bird, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Lot {
  id: number
  nom: string | null
  dateArrivee: string | null
  quantiteInitiale: number
  quantiteActuelle: number
  provenance: string | null
  prixAchatTotal: number | null
  statut: string
  especeAnimale: { id: string; nom: string; type: string; couleur: string | null }
  _count: { animaux: number; productionsOeufs: number; soins: number }
}

interface EspeceAnimale {
  id: string
  nom: string
  type: string
}

const STATUT_COLORS: Record<string, string> = {
  actif: "bg-green-100 text-green-800",
  reforme: "bg-orange-100 text-orange-800",
  termine: "bg-gray-100 text-gray-800",
}

export default function LotsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [lots, setLots] = React.useState<Lot[]>([])
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    especeAnimaleId: "",
    nom: "",
    dateArrivee: new Date().toISOString().split('T')[0],
    quantiteInitiale: "",
    provenance: "",
    prixAchatTotal: "",
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [lotsRes, especesRes] = await Promise.all([
        fetch('/api/elevage/lots'),
        fetch('/api/elevage/especes-animales'),
      ])
      if (lotsRes.ok) {
        const result = await lotsRes.json()
        setLots(result.data)
      }
      if (especesRes.ok) {
        const result = await especesRes.json()
        setEspeces(result.data)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Lot créé", description: `${formData.quantiteInitiale} animaux ajoutés` })
      setIsDialogOpen(false)
      setFormData({
        especeAnimaleId: "", nom: "", dateArrivee: new Date().toISOString().split('T')[0],
        quantiteInitiale: "", provenance: "", prixAchatTotal: "", notes: "",
      })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le lot" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/elevage">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Élevage</Button>
            </Link>
            <div className="flex items-center gap-2">
              <Bird className="h-6 w-6 text-orange-600" />
              <h1 className="text-xl font-bold">Gestion des Lots</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouveau lot</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer un lot</DialogTitle>
                  <DialogDescription>Groupe d'animaux (volailles, etc.)</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Espèce *</Label>
                    <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {especes.map(e => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du lot</Label>
                      <Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} placeholder="Lot pondeuses 2024" />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité *</Label>
                      <Input type="number" value={formData.quantiteInitiale} onChange={(e) => setFormData(f => ({ ...f, quantiteInitiale: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date arrivée</Label>
                      <Input type="date" value={formData.dateArrivee} onChange={(e) => setFormData(f => ({ ...f, dateArrivee: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prix total (€)</Label>
                      <Input type="number" step="0.01" value={formData.prixAchatTotal} onChange={(e) => setFormData(f => ({ ...f, prixAchatTotal: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Provenance</Label>
                    <Input value={formData.provenance} onChange={(e) => setFormData(f => ({ ...f, provenance: e.target.value }))} placeholder="Couvoir, éleveur..." />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={!formData.especeAnimaleId || !formData.quantiteInitiale}>Créer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader><CardTitle>Lots d'animaux</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Espèce</TableHead>
                    <TableHead className="text-right">Initial</TableHead>
                    <TableHead className="text-right">Actuel</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Provenance</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell className="font-medium">{lot.nom || `Lot #${lot.id}`}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {lot.especeAnimale.couleur && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lot.especeAnimale.couleur }} />}
                          {lot.especeAnimale.nom}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{lot.quantiteInitiale}</TableCell>
                      <TableCell className="text-right font-bold">{lot.quantiteActuelle}</TableCell>
                      <TableCell>{lot.dateArrivee ? new Date(lot.dateArrivee).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell>{lot.provenance || '-'}</TableCell>
                      <TableCell><Badge className={STATUT_COLORS[lot.statut] || ''}>{lot.statut}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {lots.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun lot enregistré</TableCell></TableRow>
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
