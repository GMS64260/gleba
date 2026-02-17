"use client"

/**
 * Page Rapports
 * Bilan, Analyse, Export
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Download, RefreshCw, TrendingUp, TrendingDown, Wallet, PieChart, BarChart3, FileSpreadsheet, Calendar, Percent, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts"

interface Stats {
  revenus: number
  depenses: number
  benefice: number
  margePercent: number
  revenusParModule: { potager: number; verger: number; elevage: number; autre: number }
  depensesParModule: { potager: number; verger: number; elevage: number; autre: number }
}

interface ChartData {
  mensuel: { mois: string; revenus: number; depenses: number; benefice: number }[]
  revenusParCategorie: { categorie: string; montant: number; couleur: string }[]
  depensesParCategorie: { categorie: string; montant: number; couleur: string }[]
}

interface TVAData {
  periode: {
    annee: number
    trimestre: number | null
    debut: string
    fin: string
  }
  collectee: {
    parTaux: Record<string, { base: number; tva: number }>
    total: number
    baseTotal: number
  }
  deductible: {
    parTaux: Record<string, { base: number; tva: number }>
    total: number
    baseTotal: number
  }
  solde: {
    tvaAPayer: number
    creditTVA: number
  }
  details: {
    nbVentes: number
    nbFactures: number
    nbDepenses: number
  }
}

export default function RapportsPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState("bilan")
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [charts, setCharts] = React.useState<ChartData | null>(null)
  const [revenus, setRevenus] = React.useState<any[]>([])
  const [depenses, setDepenses] = React.useState<any[]>([])
  const [tvaData, setTvaData] = React.useState<TVAData | null>(null)
  const [selectedTrimestre, setSelectedTrimestre] = React.useState<string>("all")

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const tvaParam = selectedTrimestre !== 'all' ? `&trimestre=${selectedTrimestre}` : ''
      const [statsRes, revRes, depRes, tvaRes] = await Promise.all([
        fetch(`/api/comptabilite/stats?year=${selectedYear}`),
        fetch(`/api/comptabilite/revenus?year=${selectedYear}&limit=500`),
        fetch(`/api/comptabilite/depenses?year=${selectedYear}&limit=500`),
        fetch(`/api/comptabilite/tva?year=${selectedYear}${tvaParam}`),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
        setCharts(data.charts)
      }
      if (revRes.ok) {
        const data = await revRes.json()
        setRevenus(data.data || [])
      }
      if (depRes.ok) {
        const data = await depRes.json()
        setDepenses(data.data || [])
      }
      if (tvaRes.ok) {
        const data = await tvaRes.json()
        setTvaData(data)
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, selectedTrimestre, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const exportCSV = (type: 'revenus' | 'depenses' | 'bilan') => {
    let csv = ''
    let filename = ''

    if (type === 'revenus') {
      csv = 'Date;Module;Catégorie;Description;Montant;Client;Payé\n'
      revenus.forEach(r => {
        csv += `${new Date(r.date).toLocaleDateString('fr-FR')};${r.module};${r.categorie};${r.description};${r.montant};${r.client || ''};${r.paye ? 'Oui' : 'Non'}\n`
      })
      filename = `revenus_${selectedYear}.csv`
    } else if (type === 'depenses') {
      csv = 'Date;Module;Catégorie;Description;Montant;Fournisseur;Payé\n'
      depenses.forEach(d => {
        csv += `${new Date(d.date).toLocaleDateString('fr-FR')};${d.module};${d.categorie};${d.description};${d.montant};${d.fournisseur || ''};${d.paye === null ? 'N/A' : d.paye ? 'Oui' : 'Non'}\n`
      })
      filename = `depenses_${selectedYear}.csv`
    } else {
      csv = 'Indicateur;Valeur\n'
      if (stats) {
        csv += `Revenus totaux;${stats.revenus}\n`
        csv += `Dépenses totales;${stats.depenses}\n`
        csv += `Bénéfice;${stats.benefice}\n`
        csv += `Marge;${stats.margePercent}%\n`
        csv += `\nRevenus par module;\n`
        csv += `Potager;${stats.revenusParModule.potager}\n`
        csv += `Verger;${stats.revenusParModule.verger}\n`
        csv += `Élevage;${stats.revenusParModule.elevage}\n`
        csv += `Autre;${stats.revenusParModule.autre}\n`
        csv += `\nDépenses par module;\n`
        csv += `Potager;${stats.depensesParModule.potager}\n`
        csv += `Verger;${stats.depensesParModule.verger}\n`
        csv += `Élevage;${stats.depensesParModule.elevage}\n`
        csv += `Autre;${stats.depensesParModule.autre}\n`
      }
      filename = `bilan_${selectedYear}.csv`
    }

    // Créer et télécharger le fichier
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()

    toast({ title: "Export réussi", description: `${filename} téléchargé` })
  }

  const COLORS = ['#22c55e', '#84cc16', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <Download className="h-6 w-6 text-slate-600" />
              <h1 className="text-xl font-bold">Rapports</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="bilan" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Bilan
            </TabsTrigger>
            <TabsTrigger value="tva" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              TVA
            </TabsTrigger>
            <TabsTrigger value="analyse" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analyse
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Onglet Bilan */}
          <TabsContent value="bilan">
            {isLoading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Résumé */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Revenus {selectedYear}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{formatEuro(stats.revenus)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Dépenses {selectedYear}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{formatEuro(stats.depenses)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${stats.benefice >= 0 ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600'} text-white`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {stats.benefice >= 0 ? 'Bénéfice' : 'Perte'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{formatEuro(Math.abs(stats.benefice))}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Marge</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.margePercent}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Détail par module */}
                <Card>
                  <CardHeader>
                    <CardTitle>Résultat par module</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Module</TableHead>
                          <TableHead className="text-right">Revenus</TableHead>
                          <TableHead className="text-right">Dépenses</TableHead>
                          <TableHead className="text-right">Résultat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {['potager', 'verger', 'elevage', 'autre'].map(mod => {
                          const rev = stats.revenusParModule[mod as keyof typeof stats.revenusParModule] || 0
                          const dep = stats.depensesParModule[mod as keyof typeof stats.depensesParModule] || 0
                          const res = rev - dep
                          return (
                            <TableRow key={mod}>
                              <TableCell className="font-medium capitalize">{mod}</TableCell>
                              <TableCell className="text-right text-green-600">{formatEuro(rev)}</TableCell>
                              <TableCell className="text-right text-red-600">{formatEuro(dep)}</TableCell>
                              <TableCell className={`text-right font-bold ${res >= 0 ? 'text-purple-600' : 'text-orange-600'}`}>
                                {formatEuro(res)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="border-t-2">
                          <TableCell className="font-bold">TOTAL</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatEuro(stats.revenus)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600">{formatEuro(stats.depenses)}</TableCell>
                          <TableCell className={`text-right font-bold ${stats.benefice >= 0 ? 'text-purple-600' : 'text-orange-600'}`}>
                            {formatEuro(stats.benefice)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Graphique évolution mensuelle */}
                {charts?.mensuel && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Évolution mensuelle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={charts.mensuel}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mois" />
                          <YAxis tickFormatter={(v) => `${v}€`} />
                          <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                          <Legend />
                          <Line type="monotone" dataKey="revenus" name="Revenus" stroke="#22c55e" strokeWidth={2} />
                          <Line type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} />
                          <Line type="monotone" dataKey="benefice" name="Bénéfice" stroke="#8b5cf6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune donnée disponible
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet TVA */}
          <TabsContent value="tva">
            <div className="space-y-6">
              {/* Sélecteur de période */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-blue-600" />
                      Déclaration TVA
                    </CardTitle>
                    <Select value={selectedTrimestre} onValueChange={setSelectedTrimestre}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Période" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Année complète</SelectItem>
                        <SelectItem value="1">T1 (Jan-Mars)</SelectItem>
                        <SelectItem value="2">T2 (Avr-Juin)</SelectItem>
                        <SelectItem value="3">T3 (Juil-Sept)</SelectItem>
                        <SelectItem value="4">T4 (Oct-Déc)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {tvaData?.periode && (
                    <CardDescription>
                      Période : {new Date(tvaData.periode.debut).toLocaleDateString('fr-FR')} au {new Date(tvaData.periode.fin).toLocaleDateString('fr-FR')}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>

              {isLoading ? (
                <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
              ) : tvaData ? (
                <>
                  {/* Résumé TVA */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-700">TVA Collectée</CardTitle>
                        <CardDescription className="text-xs text-green-600">Sur les ventes</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-700">{formatEuro(tvaData.collectee.total)}</p>
                        <p className="text-xs text-green-600 mt-1">Base HT : {formatEuro(tvaData.collectee.baseTotal)}</p>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-700">TVA Déductible</CardTitle>
                        <CardDescription className="text-xs text-red-600">Sur les achats</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-red-700">{formatEuro(tvaData.deductible.total)}</p>
                        <p className="text-xs text-red-600 mt-1">Base HT : {formatEuro(tvaData.deductible.baseTotal)}</p>
                      </CardContent>
                    </Card>

                    <Card className={`border-2 ${tvaData.solde.tvaAPayer > 0 ? 'border-amber-400 bg-amber-50' : 'border-blue-400 bg-blue-50'}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-sm ${tvaData.solde.tvaAPayer > 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                          {tvaData.solde.tvaAPayer > 0 ? 'TVA à payer' : 'Crédit de TVA'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className={`text-3xl font-bold ${tvaData.solde.tvaAPayer > 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                          {formatEuro(tvaData.solde.tvaAPayer > 0 ? tvaData.solde.tvaAPayer : tvaData.solde.creditTVA)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Détail par taux */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base text-green-700">TVA Collectée par taux</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Taux</TableHead>
                              <TableHead className="text-right">Base HT</TableHead>
                              <TableHead className="text-right">TVA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(tvaData.collectee.parTaux).map(([taux, data]) => (
                              <TableRow key={taux}>
                                <TableCell>{taux}%</TableCell>
                                <TableCell className="text-right">{formatEuro(data.base)}</TableCell>
                                <TableCell className="text-right font-medium text-green-600">{formatEuro(data.tva)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="border-t-2 font-bold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{formatEuro(tvaData.collectee.baseTotal)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatEuro(tvaData.collectee.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base text-red-700">TVA Déductible par taux</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Taux</TableHead>
                              <TableHead className="text-right">Base HT</TableHead>
                              <TableHead className="text-right">TVA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(tvaData.deductible.parTaux).map(([taux, data]) => (
                              <TableRow key={taux}>
                                <TableCell>{taux}%</TableCell>
                                <TableCell className="text-right">{formatEuro(data.base)}</TableCell>
                                <TableCell className="text-right font-medium text-red-600">{formatEuro(data.tva)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="border-t-2 font-bold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{formatEuro(tvaData.deductible.baseTotal)}</TableCell>
                              <TableCell className="text-right text-red-600">{formatEuro(tvaData.deductible.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Info et sources */}
                  <Card className="border-slate-200 bg-slate-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Sources des données
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ventes manuelles :</span>{' '}
                          <span className="font-medium">{tvaData.details.nbVentes}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Factures :</span>{' '}
                          <span className="font-medium">{tvaData.details.nbFactures}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dépenses :</span>{' '}
                          <span className="font-medium">{tvaData.details.nbDepenses}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Les montants affichés sont calculés automatiquement à partir des ventes, factures et dépenses enregistrées.
                        Vérifiez ces données avant toute déclaration officielle.
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Aucune donnée TVA disponible
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Onglet Analyse */}
          <TabsContent value="analyse">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
            ) : charts ? (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Revenus par catégorie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-green-600" />
                      Revenus par catégorie
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {charts.revenusParCategorie.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPie>
                          <Pie
                            data={charts.revenusParCategorie}
                            dataKey="montant"
                            nameKey="categorie"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {charts.revenusParCategorie.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.couleur || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Aucun revenu
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Dépenses par catégorie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-red-600" />
                      Dépenses par catégorie
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {charts.depensesParCategorie.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPie>
                          <Pie
                            data={charts.depensesParCategorie}
                            dataKey="montant"
                            nameKey="categorie"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {charts.depensesParCategorie.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.couleur || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Aucune dépense
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Comparaison par module */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Comparaison par module
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                          { module: 'Potager', revenus: stats.revenusParModule.potager, depenses: stats.depensesParModule.potager },
                          { module: 'Verger', revenus: stats.revenusParModule.verger, depenses: stats.depensesParModule.verger },
                          { module: 'Élevage', revenus: stats.revenusParModule.elevage, depenses: stats.depensesParModule.elevage },
                          { module: 'Autre', revenus: stats.revenusParModule.autre, depenses: stats.depensesParModule.autre },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="module" />
                          <YAxis tickFormatter={(v) => `${v}€`} />
                          <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                          <Legend />
                          <Bar dataKey="revenus" name="Revenus" fill="#22c55e" />
                          <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune donnée disponible
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Export */}
          <TabsContent value="export">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
                    <Wallet className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle>Bilan {selectedYear}</CardTitle>
                  <CardDescription>Synthèse revenus, dépenses, résultat par module</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => exportCSV('bilan')} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-2">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle>Revenus {selectedYear}</CardTitle>
                  <CardDescription>{revenus.length} transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => exportCSV('revenus')} className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-2">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <CardTitle>Dépenses {selectedYear}</CardTitle>
                  <CardDescription>{depenses.length} transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => exportCSV('depenses')} className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
