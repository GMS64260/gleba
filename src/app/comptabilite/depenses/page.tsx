"use client"

/**
 * Page Dépenses unifiées - Toutes les dépenses de tous les modules
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, TrendingDown, RefreshCw, Filter, Sprout, TreeDeciduous, Bird } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Expense {
  id: string
  source: string
  sourceId: number
  module: string
  date: string
  description: string
  quantite: number | null
  unite: string | null
  prixUnitaire: number | null
  montant: number
  fournisseur: string | null
  paye: boolean | null
  categorie: string
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  potager: <Sprout className="h-4 w-4 text-green-600" />,
  verger: <TreeDeciduous className="h-4 w-4 text-lime-600" />,
  elevage: <Bird className="h-4 w-4 text-amber-600" />,
  autre: <TrendingDown className="h-4 w-4 text-blue-600" />,
}

export default function DepensesPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [depenses, setDepenses] = React.useState<Expense[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [selectedModule, setSelectedModule] = React.useState<string>("all")

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ year: selectedYear.toString() })
      if (selectedModule && selectedModule !== 'all') params.set('module', selectedModule)

      const response = await fetch(`/api/comptabilite/depenses?${params}`)
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
  }, [selectedYear, selectedModule, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-red-600" />
              <h1 className="text-xl font-bold">Dépenses</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les modules</SelectItem>
                <SelectItem value="potager">Potager</SelectItem>
                <SelectItem value="verger">Verger</SelectItem>
                <SelectItem value="elevage">Élevage</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-5 mb-6">
            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-100">Total</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{formatEuro(stats.total)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Sprout className="h-4 w-4 text-green-600" />Potager</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(stats.parModule.potager)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TreeDeciduous className="h-4 w-4 text-lime-600" />Verger</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(stats.parModule.verger)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Bird className="h-4 w-4 text-amber-600" />Élevage</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(stats.parModule.elevage)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Autre</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(stats.parModule.autre)}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Liste */}
        <Card>
          <CardHeader><CardTitle>Détail des dépenses ({depenses.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depenses.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap">{new Date(d.date).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {MODULE_ICONS[d.module]}
                            <span className="capitalize text-sm">{d.module}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{d.categorie}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{d.description}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {d.quantite ? `${d.quantite} ${d.unite || ''}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">{formatEuro(d.montant)}</TableCell>
                        <TableCell>{d.fournisseur || '-'}</TableCell>
                        <TableCell>
                          {d.paye === null ? (
                            <Badge variant="outline" className="text-gray-500">N/A</Badge>
                          ) : d.paye ? (
                            <Badge className="bg-green-100 text-green-800">Payé</Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-800">À payer</Badge>
                          )}
                        </TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{d.source}</span></TableCell>
                      </TableRow>
                    ))}
                    {depenses.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune dépense enregistrée</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
