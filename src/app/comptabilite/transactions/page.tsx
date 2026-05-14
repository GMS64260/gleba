"use client"

/**
 * Page Transactions unifiée
 * Onglets: Revenus, Dépenses, Saisie
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Receipt, RefreshCw, Filter, Plus, Sprout, TreeDeciduous, Bird, TrendingUp, TrendingDown, Store, Info, ChevronDown, ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface SourceBreakdown {
  module: string
  source: string
  label: string
  count: number
  montant: number
}

interface Transaction {
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
  client?: string | null
  fournisseur?: string | null
  paye: boolean | null
  categorie: string
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  potager: <Sprout className="h-4 w-4 text-green-600" />,
  verger: <TreeDeciduous className="h-4 w-4 text-lime-600" />,
  elevage: <Bird className="h-4 w-4 text-amber-600" />,
  boutique: <Store className="h-4 w-4 text-teal-600" />,
  autre: <Receipt className="h-4 w-4 text-blue-600" />,
}

export default function TransactionsPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState("revenus")
  const [isLoading, setIsLoading] = React.useState(true)
  const [revenus, setRevenus] = React.useState<Transaction[]>([])
  const [depenses, setDepenses] = React.useState<Transaction[]>([])
  const [statsRevenus, setStatsRevenus] = React.useState<any>(null)
  const [statsDepenses, setStatsDepenses] = React.useState<any>(null)
  const [sourcesBreakdown, setSourcesBreakdown] = React.useState<SourceBreakdown[]>([])
  const [sourcesOpen, setSourcesOpen] = React.useState(false)
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [selectedModule, setSelectedModule] = React.useState<string>("all")

  // Form states for manual entry
  const [formType, setFormType] = React.useState<"vente" | "depense">("vente")
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    categorie: "",
    description: "",
    quantite: "",
    unite: "",
    prixUnitaire: "",
    montant: "",
    client: "",
    fournisseur: "",
    module: "potager",
    paye: true,
  })

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ year: selectedYear.toString() })
      if (selectedModule && selectedModule !== 'all') params.set('module', selectedModule)

      const [revRes, depRes, srcRes] = await Promise.all([
        fetch(`/api/comptabilite/revenus?${params}`),
        fetch(`/api/comptabilite/depenses?${params}`),
        fetch(`/api/comptabilite/sources?year=${selectedYear}`),
      ])

      if (revRes.ok) {
        const result = await revRes.json()
        setRevenus(result.data)
        setStatsRevenus(result.stats)
      }
      if (depRes.ok) {
        const result = await depRes.json()
        setDepenses(result.data)
        setStatsDepenses(result.stats)
      }
      if (srcRes.ok) {
        const result = await srcRes.json()
        setSourcesBreakdown(result.sources || [])
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const endpoint = formType === "vente"
      ? "/api/comptabilite/ventes-manuelles"
      : "/api/comptabilite/depenses-manuelles"

    const body = formType === "vente" ? {
      date: formData.date,
      categorie: formData.categorie,
      description: formData.description,
      quantite: formData.quantite ? parseFloat(formData.quantite) : null,
      unite: formData.unite || null,
      prixUnitaire: formData.prixUnitaire ? parseFloat(formData.prixUnitaire) : null,
      montant: parseFloat(formData.montant),
      client: formData.client || null,
      module: formData.module,
      paye: formData.paye,
    } : {
      date: formData.date,
      categorie: formData.categorie,
      description: formData.description,
      montant: parseFloat(formData.montant),
      fournisseur: formData.fournisseur || null,
      module: formData.module,
      paye: formData.paye,
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast({ title: "Enregistré", description: `${formType === "vente" ? "Vente" : "Dépense"} ajoutée` })
        setFormData({
          date: new Date().toISOString().split('T')[0],
          categorie: "",
          description: "",
          quantite: "",
          unite: "",
          prixUnitaire: "",
          montant: "",
          client: "",
          fournisseur: "",
          module: "potager",
          paye: true,
        })
        fetchData()
      } else {
        throw new Error()
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b border-b-2 border-b-blue-500 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <Receipt className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Transactions</h1>
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
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="potager">Maraîchage</SelectItem>
                <SelectItem value="verger">Verger</SelectItem>
                <SelectItem value="elevage">Élevage</SelectItem>
                <SelectItem value="boutique">Boutique</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="revenus" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenus
            </TabsTrigger>
            <TabsTrigger value="depenses" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Dépenses
            </TabsTrigger>
            <TabsTrigger value="saisie" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Saisie
            </TabsTrigger>
          </TabsList>

          {/* Onglet Revenus */}
          <TabsContent value="revenus">
            {/* Card "Source de vérité" - explique d'où viennent les chiffres */}
            <Card className="mb-6 border-blue-200 bg-blue-50/40">
              <CardHeader
                className="cursor-pointer select-none py-4"
                onClick={() => setSourcesOpen(o => !o)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base">D'où viennent ces chiffres ?</CardTitle>
                  </div>
                  {sourcesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {sourcesOpen && (
                <CardContent className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Ce total agrège toutes vos ventes, qu'elles proviennent du potager,
                    du verger, de l'elevage, de la boutique en ligne ou de saisies manuelles.
                  </p>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Sprout className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Potager</strong> — récoltes au statut « vendu » (avec prix renseigné).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <TreeDeciduous className="h-4 w-4 text-lime-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Verger (fruits)</strong> — récoltes d'arbres au statut « vendu ».</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <TreeDeciduous className="h-4 w-4 text-amber-800 mt-0.5 flex-shrink-0" />
                      <span><strong>Verger (bois)</strong> — productions de bois avec destination « vente ».</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Bird className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Élevage (produits)</strong> — œufs, lait, animaux vivants…</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Bird className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Élevage (viande)</strong> — abattages avec destination « vente ».</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Store className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Boutique en ligne</strong> — commandes au statut « livrée ».</span>
                    </div>
                    <div className="flex items-start gap-2 md:col-span-2">
                      <Receipt className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Saisies manuelles</strong> — ventes ajoutées via l'onglet Saisie (hors automatiques).</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs">
                    Une commande boutique apparaît ici <strong>uniquement quand son statut
                    est « livrée »</strong>. Avant ce statut, elle est visible dans{' '}
                    <Link href="/boutique" className="underline font-medium">
                      /boutique → Commandes
                    </Link>
                    .
                  </div>

                  {/* Mini tableau de réconciliation */}
                  <div>
                    <p className="font-medium mb-2">Détail par source ({selectedYear})</p>
                    <div className="overflow-x-auto border rounded-md bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Nb</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sourcesBreakdown.map((s) => (
                            <TableRow key={`${s.module}-${s.source}`}>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {MODULE_ICONS[s.module] || MODULE_ICONS.autre}
                                  <span className="capitalize text-xs">{s.module}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">{s.label}</TableCell>
                              <TableCell className="text-right text-xs">{s.count}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatEuro(s.montant)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {sourcesBreakdown.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                                Aucune donnée pour cette annee
                              </TableCell>
                            </TableRow>
                          )}
                          {sourcesBreakdown.length > 0 && (
                            <TableRow className="bg-slate-50 font-semibold">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right">
                                {sourcesBreakdown.reduce((s, x) => s + x.count, 0)}
                              </TableCell>
                              <TableCell className="text-right text-blue-700">
                                {formatEuro(sourcesBreakdown.reduce((s, x) => s + x.montant, 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {statsRevenus && (
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-100">Total</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold">{formatEuro(statsRevenus.total)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Maraîchage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-green-600">{formatEuro(statsRevenus.parModule?.potager || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Verger</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-lime-600">{formatEuro(statsRevenus.parModule?.verger || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Élevage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-amber-600">{formatEuro(statsRevenus.parModule?.elevage || 0)}</p></CardContent>
                </Card>
              </div>
            )}
            <Card>
              <CardHeader><CardTitle>Revenus ({revenus.length})</CardTitle></CardHeader>
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
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenus.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap">{new Date(r.date).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {MODULE_ICONS[r.module]}
                                <span className="capitalize text-sm">{r.module}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate">{r.description}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">{formatEuro(r.montant)}</TableCell>
                            <TableCell>{r.client || '-'}</TableCell>
                            <TableCell>
                              {r.paye === null ? (
                                <Badge variant="outline">N/A</Badge>
                              ) : r.paye ? (
                                <Badge className="bg-green-100 text-green-800">Payé</Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-800">À payer</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {revenus.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun revenu</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Dépenses */}
          <TabsContent value="depenses">
            {statsDepenses && (
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-red-100">Total</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold">{formatEuro(statsDepenses.total)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Maraîchage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(statsDepenses.parModule?.potager || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Verger</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(statsDepenses.parModule?.verger || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Élevage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(statsDepenses.parModule?.elevage || 0)}</p></CardContent>
                </Card>
              </div>
            )}
            <Card>
              <CardHeader><CardTitle>Dépenses ({depenses.length})</CardTitle></CardHeader>
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
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Statut</TableHead>
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
                            <TableCell className="max-w-[250px] truncate">{d.description}</TableCell>
                            <TableCell className="text-right font-bold text-red-600">{formatEuro(d.montant)}</TableCell>
                            <TableCell>{d.fournisseur || '-'}</TableCell>
                            <TableCell>
                              {d.paye === null ? (
                                <Badge variant="outline">N/A</Badge>
                              ) : d.paye ? (
                                <Badge className="bg-green-100 text-green-800">Payé</Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-800">À payer</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {depenses.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune dépense</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Saisie */}
          <TabsContent value="saisie">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Nouvelle transaction</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={formType === "vente" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormType("vente")}
                      className={formType === "vente" ? "bg-green-600" : ""}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Vente
                    </Button>
                    <Button
                      variant={formType === "depense" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormType("depense")}
                      className={formType === "depense" ? "bg-red-600" : ""}
                    >
                      <TrendingDown className="h-4 w-4 mr-1" />
                      Dépense
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Module</Label>
                      <Select value={formData.module} onValueChange={(v) => setFormData({ ...formData, module: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="potager">Maraîchage</SelectItem>
                          <SelectItem value="verger">Verger</SelectItem>
                          <SelectItem value="elevage">Élevage</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Catégorie</Label>
                      <Select value={formData.categorie} onValueChange={(v) => setFormData({ ...formData, categorie: v })}>
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>
                          {formType === "vente" ? (
                            <>
                              <SelectItem value="legumes">Légumes</SelectItem>
                              <SelectItem value="fruits">Fruits</SelectItem>
                              <SelectItem value="oeufs">Oeufs</SelectItem>
                              <SelectItem value="viande">Viande</SelectItem>
                              <SelectItem value="transformation">Transformation</SelectItem>
                              <SelectItem value="service">Service</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="materiel">Matériel</SelectItem>
                              <SelectItem value="semences">Semences/Plants</SelectItem>
                              <SelectItem value="aliments">Aliments animaux</SelectItem>
                              <SelectItem value="carburant">Carburant</SelectItem>
                              <SelectItem value="main_oeuvre">Main d'oeuvre</SelectItem>
                              <SelectItem value="abonnement">Abonnement</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={formType === "vente" ? "Ex: Panier légumes famille Martin" : "Ex: Sac granulés pondeuses 25kg"}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <Label>Montant (EUR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    {formType === "vente" && (
                      <>
                        <div>
                          <Label>Quantité</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.quantite}
                            onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                            placeholder="Optionnel"
                          />
                        </div>
                        <div>
                          <Label>Unité</Label>
                          <Input
                            value={formData.unite}
                            onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                            placeholder="kg, unité..."
                          />
                        </div>
                        <div>
                          <Label>Client</Label>
                          <Input
                            value={formData.client}
                            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                            placeholder="Nom client"
                          />
                        </div>
                      </>
                    )}
                    {formType === "depense" && (
                      <div>
                        <Label>Fournisseur</Label>
                        <Input
                          value={formData.fournisseur}
                          onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                          placeholder="Nom fournisseur"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.paye}
                        onChange={(e) => setFormData({ ...formData, paye: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Payé</span>
                    </label>
                  </div>

                  <Button type="submit" className={formType === "vente" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
                    <Plus className="h-4 w-4 mr-2" />
                    Enregistrer {formType === "vente" ? "la vente" : "la dépense"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
