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
import {
  compteVente,
  compteAchat,
  JOURNAUX,
} from "@/lib/comptabilite/plan-comptable-agricole"

// DEV1 #3 — Modes de règlement (lus par compteTresorerie pour générer
// la contrepartie 512 banque / 530 caisse / 411 client / 401 fournisseur).
const MODES_REGLEMENT = [
  { value: "Espèces", label: "Espèces" },
  { value: "Chèque", label: "Chèque" },
  { value: "Virement", label: "Virement" },
  { value: "CB", label: "Carte bancaire" },
  { value: "Prélèvement", label: "Prélèvement SEPA" },
  { value: "À crédit", label: "À crédit (pas de mouvement)" },
] as const

const TAUX_TVA = ["0", "2.1", "5.5", "10", "20"] as const

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

// Bug R1 : libellé de module cohérent (le code interne « potager » s'affichait
// « Potager » dans les lignes mais « Maraîchage » dans les filtres/cartes).
const MODULE_LABELS: Record<string, string> = {
  potager: "Maraîchage",
  verger: "Verger",
  elevage: "Élevage",
  boutique: "Boutique",
  autre: "Autre",
}
const moduleLabel = (m: string) => MODULE_LABELS[m] ?? (m.charAt(0).toUpperCase() + m.slice(1))

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
  // Bug R2 : l'année choisie sur le dashboard Compta se propage aux sous-pages
  // via localStorage (partagé), au lieu de toujours réinitialiser à l'année courante.
  const [selectedYear, setSelectedYear] = React.useState(() => {
    if (typeof window !== "undefined") {
      const ls = window.localStorage.getItem("gleba_compta_year")
      if (ls && /^\d{4}$/.test(ls)) return parseInt(ls, 10)
    }
    return new Date().getFullYear()
  })
  const [selectedModule, setSelectedModule] = React.useState<string>("all")

  // Form states for manual entry (DEV1 #3 — refonte conforme)
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
    // DEV1 #3 — nouveaux champs réglementaires
    tauxTVA: "5.5",
    journal: "VE",
    modeReglement: "",
    numeroPiece: "",
    pjUrl: "",
    pjFilename: "",
  })
  const [pjUploading, setPjUploading] = React.useState(false)

  // DEV1 #3 — Synchroniser le journal par défaut avec le type d'opération.
  React.useEffect(() => {
    setFormData((prev) => {
      const defaultJournal = formType === "vente" ? "VE" : "AC"
      // Ne change que si l'utilisateur n'a pas explicitement choisi autre chose.
      if (prev.journal === "VE" || prev.journal === "AC") {
        return { ...prev, journal: defaultJournal }
      }
      return prev
    })
  }, [formType])

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

  // DEV1 #3 — Upload PJ (PDF / JPG / PNG, max 10 Mo, Art. L102 B LPF).
  const handlePjUpload = async (file: File) => {
    setPjUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/justificatif", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Échec de l'upload")
      }
      const data = await res.json()
      setFormData((prev) => ({ ...prev, pjUrl: data.url, pjFilename: data.filename }))
      toast({ title: "Pièce justificative jointe", description: data.filename })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur upload PJ",
        description: err instanceof Error ? err.message : "Inconnue",
      })
    } finally {
      setPjUploading(false)
    }
  }

  // DEV1 #3 — Compte PCA dérivé pour affichage temps réel sous le sélecteur.
  const comptePCADerivé = React.useMemo(() => {
    if (!formData.categorie) return null
    return formType === "vente"
      ? compteVente(formData.categorie)
      : compteAchat(formData.categorie)
  }, [formType, formData.categorie])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.categorie) {
      toast({
        variant: "destructive",
        title: "Catégorie requise",
        description: "Veuillez choisir une catégorie avant d'enregistrer.",
      })
      return
    }

    const endpoint = formType === "vente"
      ? "/api/comptabilite/ventes-manuelles"
      : "/api/comptabilite/depenses-manuelles"

    const tauxTVA = parseFloat(formData.tauxTVA) || 0

    const commonExtras = {
      tauxTVA,
      journal: formData.journal,
      modeReglement: formData.modeReglement || null,
      numeroPiece: formData.numeroPiece || null,
      pjUrl: formData.pjUrl || null,
    }

    const body = formType === "vente" ? {
      date: formData.date,
      categorie: formData.categorie,
      description: formData.description,
      quantite: formData.quantite ? parseFloat(formData.quantite) : null,
      unite: formData.unite || null,
      prixUnitaire: formData.prixUnitaire ? parseFloat(formData.prixUnitaire) : null,
      montant: parseFloat(formData.montant),
      clientNom: formData.client || null,
      module: formData.module,
      paye: formData.paye,
      ...commonExtras,
    } : {
      date: formData.date,
      categorie: formData.categorie,
      description: formData.description,
      montant: parseFloat(formData.montant),
      fournisseurNom: formData.fournisseur || null,
      module: formData.module,
      paye: formData.paye,
      ...commonExtras,
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
          tauxTVA: "5.5",
          journal: formType === "vente" ? "VE" : "AC",
          modeReglement: "",
          numeroPiece: "",
          pjUrl: "",
          pjFilename: "",
        })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erreur ${res.status}`)
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
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
                                  <span className="capitalize text-xs">{moduleLabel(s.module)}</span>
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
              <div className="grid gap-4 md:grid-cols-5 mb-6">
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
                {/* Bug feedback cmpkyeynq — Card Boutique manquait : Total ≠ somme
                    des modules visibles. Pour la démo Marie Dubois/Jean Bertin…,
                    389 € de revenus boutique n'apparaissaient nulle part. */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Boutique</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-teal-600">{formatEuro(statsRevenus.parModule?.boutique || 0)}</p></CardContent>
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
                                <span className="capitalize text-sm">{moduleLabel(r.module)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate">{r.description}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              {formatEuro(r.montant)}
                              {/* Bug cmp8skoaa (Marc 2026-05-16) — badge sur les
                                  transactions à 0 € marquées Payé : héritées de
                                  l'ancienne saisie permissive (bug 13). */}
                              {r.montant === 0 && r.paye === true && (
                                <span
                                  className="ml-1 inline-block text-amber-600"
                                  title="Transaction à 0 € marquée Payé — à vérifier (saisie probablement incomplète)"
                                >
                                  ⚠
                                </span>
                              )}
                            </TableCell>
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
                                <span className="capitalize text-sm">{moduleLabel(d.module)}</span>
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
                        <SelectTrigger><SelectValue placeholder="— Choisir une catégorie —" /></SelectTrigger>
                        <SelectContent>
                          {formType === "vente" ? (
                            <>
                              <SelectItem value="legumes">Légumes</SelectItem>
                              <SelectItem value="fruits">Fruits</SelectItem>
                              <SelectItem value="oeufs">Œufs</SelectItem>
                              <SelectItem value="viande">Viande</SelectItem>
                              <SelectItem value="transformation">Transformation</SelectItem>
                              <SelectItem value="service">Service / prestation</SelectItem>
                              <SelectItem value="bois">Bois et produits forestiers</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="semences">Semences / Plants</SelectItem>
                              <SelectItem value="aliments">Aliments animaux</SelectItem>
                              <SelectItem value="fertilisants">Fertilisants / engrais</SelectItem>
                              <SelectItem value="phyto">Produits phytosanitaires</SelectItem>
                              <SelectItem value="carburant">Carburant</SelectItem>
                              <SelectItem value="energie">Énergie (eau, élec, gaz)</SelectItem>
                              <SelectItem value="materiel">Matériel agricole</SelectItem>
                              <SelectItem value="petit_outillage">Petit outillage</SelectItem>
                              <SelectItem value="prestation">Prestation / sous-traitance</SelectItem>
                              <SelectItem value="veterinaire">Vétérinaire</SelectItem>
                              <SelectItem value="msa">Cotisations MSA</SelectItem>
                              <SelectItem value="main_oeuvre">Main d&apos;œuvre</SelectItem>
                              <SelectItem value="abonnement">Abonnement / services</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {/* DEV1 #3 — Compte PCA dérivé affiché en temps réel */}
                      {comptePCADerivé && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          PCA : <span className="font-mono font-medium">{comptePCADerivé.num}</span> · {comptePCADerivé.lib}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* DEV1 #3 — Bloc compta réglementaire : Journal / Mode règlement / N° pièce / TVA */}
                  <div className="grid gap-4 md:grid-cols-4 border-t pt-4">
                    <div>
                      <Label>Journal *</Label>
                      <Select
                        value={formData.journal}
                        onValueChange={(v) => setFormData({ ...formData, journal: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(JOURNAUX).map(([code, lib]) => (
                            <SelectItem key={code} value={code}>{code} — {lib}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mode de règlement</Label>
                      <Select
                        value={formData.modeReglement}
                        onValueChange={(v) => setFormData({ ...formData, modeReglement: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {MODES_REGLEMENT.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>N° pièce justificative</Label>
                      <Input
                        value={formData.numeroPiece}
                        onChange={(e) => setFormData({ ...formData, numeroPiece: e.target.value })}
                        placeholder={formType === "vente" ? "Auto" : "Ex: FA-2026-042"}
                      />
                    </div>
                    <div>
                      <Label>Taux TVA (%)</Label>
                      <Select
                        value={formData.tauxTVA}
                        onValueChange={(v) => setFormData({ ...formData, tauxTVA: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TAUX_TVA.map((t) => (
                            <SelectItem key={t} value={t}>{t} %</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* DEV1 #3 — Upload pièce justificative (Art. L102 B LPF) */}
                  <div>
                    <Label>Pièce justificative (PDF / JPG / PNG, max 10 Mo)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={pjUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handlePjUpload(f)
                        }}
                        className="flex-1"
                      />
                      {formData.pjUrl && (
                        <>
                          <a
                            href={formData.pjUrl}
                            target="_blank"
                            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                          >
                            📎 {formData.pjFilename || "PJ jointe"}
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setFormData({ ...formData, pjUrl: "", pjFilename: "" })}
                          >
                            Retirer
                          </Button>
                        </>
                      )}
                    </div>
                    {pjUploading && (
                      <p className="text-xs text-muted-foreground mt-1">Upload en cours…</p>
                    )}
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
