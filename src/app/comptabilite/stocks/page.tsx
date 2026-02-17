"use client"

/**
 * Page Stocks unifiés - Vue consolidée de tous les stocks
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Package, RefreshCw, AlertTriangle, Sprout, TreeDeciduous, Bird, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface StockItem {
  id: string
  module: string
  categorie: string
  nom: string
  stock: number
  unite: string
  stockMin: number | null
  alerteBas: boolean
  valeur: number | null
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  potager: <Sprout className="h-4 w-4 text-green-600" />,
  verger: <TreeDeciduous className="h-4 w-4 text-lime-600" />,
  elevage: <Bird className="h-4 w-4 text-amber-600" />,
}

const MODULE_COLORS: Record<string, string> = {
  potager: "bg-green-100 text-green-800",
  verger: "bg-lime-100 text-lime-800",
  elevage: "bg-amber-100 text-amber-800",
}

export default function StocksPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [stocks, setStocks] = React.useState<StockItem[]>([])
  const [alertes, setAlertes] = React.useState<StockItem[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [selectedModule, setSelectedModule] = React.useState<string>("all")

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/comptabilite/stocks')
      if (response.ok) {
        const result = await response.json()
        setStocks(result.data)
        setAlertes(result.alertes)
        setStats(result.stats)
      }
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

  const filteredStocks = selectedModule && selectedModule !== 'all'
    ? stocks.filter(s => s.module === selectedModule)
    : stocks

  // Grouper par catégorie
  const stocksByCategory = React.useMemo(() => {
    const grouped: Record<string, StockItem[]> = {}
    filteredStocks.forEach(s => {
      if (!grouped[s.categorie]) grouped[s.categorie] = []
      grouped[s.categorie].push(s)
    })
    return grouped
  }, [filteredStocks])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-violet-600" />
              <h1 className="text-xl font-bold">Stocks Unifiés</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total articles</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.totalItems}</p></CardContent>
            </Card>
            <Card className={alertes.length > 0 ? "border-orange-200 bg-orange-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  {alertes.length > 0 && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                  Alertes stock bas
                </CardTitle>
              </CardHeader>
              <CardContent><p className={`text-2xl font-bold ${alertes.length > 0 ? 'text-orange-600' : ''}`}>{stats.alertes}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Valeur estimée</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-violet-600">{formatEuro(stats.valeurTotale)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Répartition</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 text-sm">
                  <span className="text-green-600">{stats.parModule.potager} P</span>
                  <span className="text-lime-600">{stats.parModule.verger} V</span>
                  <span className="text-amber-600">{stats.parModule.elevage} E</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alertes */}
        {alertes.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Stocks bas ({alertes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {alertes.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      {MODULE_ICONS[a.module]}
                      <div>
                        <p className="font-medium text-sm">{a.nom}</p>
                        <p className="text-xs text-muted-foreground">{a.categorie}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-600">{a.stock} {a.unite}</p>
                      <p className="text-xs text-muted-foreground">min: {a.stockMin}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stocks par catégorie */}
        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(stocksByCategory).map(([categorie, items]) => (
              <Card key={categorie}>
                <CardHeader>
                  <CardTitle className="text-base">{categorie} ({items.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Min</TableHead>
                        <TableHead className="text-right">Valeur</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id} className={item.alerteBas ? "bg-orange-50" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {MODULE_ICONS[item.module]}
                              <span className="capitalize text-sm">{item.module}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.nom}</TableCell>
                          <TableCell className="text-right font-bold">
                            {item.stock} {item.unite}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.stockMin !== null ? `${item.stockMin} ${item.unite}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.valeur !== null ? formatEuro(item.valeur) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.alerteBas ? (
                              <Badge className="bg-orange-100 text-orange-800">Bas</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
            {Object.keys(stocksByCategory).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun stock enregistré
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
