"use client"

/**
 * Page Factures impayées
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, AlertCircle, RefreshCw, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Impayee {
  id: number
  source: string
  date: string
  type: string
  description: string
  montant: number
  client: string | null
}

export default function ImpayeesPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [impayees, setImpayees] = React.useState<Impayee[]>([])
  const [total, setTotal] = React.useState(0)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      // Récupérer les ventes produits impayées
      const [ventesRes, manuellesRes] = await Promise.all([
        fetch('/api/elevage/ventes?paye=false'),
        fetch('/api/comptabilite/ventes-manuelles?paye=false'),
      ])

      const items: Impayee[] = []

      if (ventesRes.ok) {
        const ventesData = await ventesRes.json()
        const ventes = ventesData.data || []
        ventes.forEach((v: any) => {
          items.push({
            id: v.id,
            source: 'VenteProduit',
            date: v.date,
            type: v.type,
            description: v.description || `Vente ${v.type}`,
            montant: v.prixTotal,
            client: v.client,
          })
        })
      }

      if (manuellesRes.ok) {
        const manuellesData = await manuellesRes.json()
        const manuelles = manuellesData.data || []
        manuelles.forEach((m: any) => {
          items.push({
            id: m.id,
            source: 'VenteManuelle',
            date: m.date,
            type: m.categorie,
            description: m.description,
            montant: m.montant,
            client: m.client,
          })
        })
      }

      // Trier par date
      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setImpayees(items)
      setTotal(items.reduce((sum, i) => sum + i.montant, 0))
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const markAsPaid = async (item: Impayee) => {
    try {
      let response
      if (item.source === 'VenteProduit') {
        response = await fetch('/api/elevage/ventes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, paye: true }),
        })
      } else {
        response = await fetch('/api/comptabilite/ventes-manuelles', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, paye: true }),
        })
      }

      if (!response.ok) throw new Error('Erreur')

      toast({ title: "Marqué comme payé", description: formatEuro(item.montant) })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour" })
    }
  }

  const daysSince = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold">Factures Impayées</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className={impayees.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Nombre de factures</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${impayees.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {impayees.length}
              </p>
            </CardContent>
          </Card>
          <Card className={total > 0 ? "border-amber-200 bg-amber-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Montant total dû</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${total > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatEuro(total)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Liste */}
        <Card>
          <CardHeader>
            <CardTitle>Factures en attente de paiement</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : impayees.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-lg font-medium text-green-600">Toutes les factures sont payées !</p>
                <p className="text-muted-foreground">Aucune facture en attente de paiement.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ancienneté</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {impayees.map((item) => {
                    const days = daysSince(item.date)
                    return (
                      <TableRow key={`${item.source}-${item.id}`} className={days > 30 ? "bg-red-50" : days > 14 ? "bg-orange-50" : ""}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            days > 30 ? "bg-red-100 text-red-800" :
                            days > 14 ? "bg-orange-100 text-orange-800" :
                            "bg-yellow-100 text-yellow-800"
                          }>
                            {days} jours
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                        <TableCell>{item.client || '-'}</TableCell>
                        <TableCell className="text-right font-bold text-amber-600 whitespace-nowrap">
                          {formatEuro(item.montant)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{item.source}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsPaid(item)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Payé
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
      </div>
    </div>
  )
}
