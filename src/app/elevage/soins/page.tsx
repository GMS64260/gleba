"use client"

/**
 * Page Soins des Animaux
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Stethoscope, Plus, RefreshCw, Check } from "lucide-react"

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

interface Soin {
  id: number
  date: string
  type: string
  description: string | null
  produit: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  veterinaire: string | null
  datePrevue: string | null
  fait: boolean
  notes: string | null
  animal: { id: number; nom: string; identifiant: string } | null
  lot: { id: number; nom: string } | null
}

interface Lot { id: number; nom: string | null; quantiteActuelle: number }

const TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  autre: "Autre",
}

export default function SoinsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [soins, setSoins] = React.useState<Soin[]>([])
  const [lots, setLots] = React.useState<Lot[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [filterFait, setFilterFait] = React.useState<string>("all")

  const [formData, setFormData] = React.useState({
    lotId: "", date: new Date().toISOString().split('T')[0], type: "vaccination",
    description: "", produit: "", quantite: "", unite: "", cout: "", fait: true, notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = '/api/elevage/soins?limit=100'
      if (filterFait !== 'all') url += `&fait=${filterFait}`
      const [soinsRes, lotsRes] = await Promise.all([fetch(url), fetch('/api/elevage/lots?statut=actif')])
      if (soinsRes.ok) setSoins((await soinsRes.json()).data)
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [filterFait, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Soin enregistré" })
      setIsDialogOpen(false)
      setFormData({ lotId: "", date: new Date().toISOString().split('T')[0], type: "vaccination", description: "", produit: "", quantite: "", unite: "", cout: "", fait: true, notes: "" })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le soin" })
    }
  }

  const toggleFait = async (id: number, fait: boolean) => {
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fait: !fait, date: !fait ? new Date().toISOString() : undefined }),
      })
      if (!response.ok) throw new Error('Erreur')
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
              <Stethoscope className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Soins & Traitements</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterFait} onValueChange={setFilterFait}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="false">À faire</SelectItem>
                <SelectItem value="true">Faits</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouveau soin</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Enregistrer un soin</DialogTitle><DialogDescription>Vaccination, vermifuge, traitement...</DialogDescription></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Lot *</Label>
                      <Select value={formData.lotId} onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}>
                        <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{lots.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.nom || `Lot #${l.id}`}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type *</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vaccination">Vaccination</SelectItem>
                          <SelectItem value="vermifuge">Vermifuge</SelectItem>
                          <SelectItem value="traitement">Traitement</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Produit</Label><Input value={formData.produit} onChange={(e) => setFormData(f => ({ ...f, produit: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Quantité</Label><Input type="number" step="0.01" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Unité</Label><Input value={formData.unite} onChange={(e) => setFormData(f => ({ ...f, unite: e.target.value }))} placeholder="mL, doses..." /></div>
                    <div className="space-y-2"><Label>Coût (€)</Label><Input type="number" step="0.01" value={formData.cout} onChange={(e) => setFormData(f => ({ ...f, cout: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="fait" checked={formData.fait} onCheckedChange={(c) => setFormData(f => ({ ...f, fait: !!c }))} />
                    <Label htmlFor="fait">Déjà effectué</Label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={!formData.lotId}>Enregistrer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader><CardTitle>Historique des soins</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Lot/Animal</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Coût</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soins.map((soin) => (
                    <TableRow key={soin.id} className={!soin.fait ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleFait(soin.id, soin.fait)} className={soin.fait ? "text-green-600" : "text-gray-400"}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>{new Date(soin.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABELS[soin.type] || soin.type}</Badge></TableCell>
                      <TableCell>{soin.lot?.nom || soin.animal?.nom || '-'}</TableCell>
                      <TableCell>{soin.produit || '-'}</TableCell>
                      <TableCell className="text-right">{soin.cout ? `${soin.cout.toFixed(2)} €` : '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{soin.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {soins.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun soin enregistré</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
