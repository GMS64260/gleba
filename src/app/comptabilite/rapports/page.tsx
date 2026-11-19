"use client"

/**
 * Page Rapports
 * Bilan, Analyse, Export
 */

import { celluleCsv } from "@/lib/csv-cellule"
import * as React from "react"
import { useDevise } from "@/hooks/use-devise"
import { formatMontantDevise } from "@/lib/format-utils"
import { deviseCommuneDesSeries, libellesTotauxParDevise, soustraireParDevise, type TotalDevise } from "@/lib/comptabilite/totaux-devise"
import { chargerStatsComptables } from "@/lib/comptabilite/stats-client"
import { groupesRapport, libelleDevise, MODULES_RAPPORT, type GroupeRapport, type StatsRapport } from "@/lib/comptabilite/rapport-devises"
import type { Devise } from "@/lib/territoires"
import { urlApercu } from "@/lib/apercu-document"
import Link from "next/link"
import { ArrowLeft, Download, RefreshCw, TrendingUp, TrendingDown, Wallet, PieChart, BarChart3, FileSpreadsheet, Calendar, Percent, Info, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip as InfoTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts"
import { ResponsiveContainer } from "@/components/ui/responsive-container"
import { kpiCardClass } from "@/lib/kpi-theme"
import { getAvailableYears } from "@/components/year-selector"
import { TvaAPreciser } from "@/components/comptabilite/TvaAPreciser"

/**
 * Réponse de GET /api/comptabilite/stats (lot devise-totaux-api) : un total
 * historique vaut `null` dès que deux devises coexistent ; son voisin
 * `…ParDevise` porte alors un total par devise, jamais additionnés.
 */
interface Stats extends StatsRapport {
  margePercent: number | null
  // BUG #2 — sous-totaux non payés (info, charges engagées non décaissées)
  depensesNonPayees?: number | null
  depensesNonPayeesParDevise?: TotalDevise[]
  nbDepensesNonPayees?: number
  revenusNonPayes?: number | null
  nbRevenusNonPayes?: number
  coherenceCheck?: {
    revenusSsot: number | null
    revenusSsotParDevise?: TotalDevise[]
    revenusSommeModules: number | null
    revenusSommeModulesParDevise?: TotalDevise[]
    revenusEcart: number | null
    revenusEcartParDevise?: TotalDevise[]
    depensesSsot: number | null
    depensesSsotParDevise?: TotalDevise[]
    depensesSommeModules: number | null
    depensesSommeModulesParDevise?: TotalDevise[]
    depensesEcart: number | null
    depensesEcartParDevise?: TotalDevise[]
    /** QA cmsw9dcrd — Σ avoirs de l'exercice. */
    avoirsExercice?: number | null
    /** Ticket cmvflua2x — d'où vient le total des revenus (somme = revenusSsot). */
    revenusComposition?: {
      ventes: number
      facturesRattachees: number
      facturesSansVente: number
      avoirs: number
    } | null
    /** Ticket cmsx69cuc — Σ des coûts analytiques (soins, aliments, fertilisation). */
    depensesAnalytiques?: number
    depensesAnalytiquesParDevise?: TotalDevise[]
  } | null
}

/** Ligne de GET /api/comptabilite/revenus ou /depenses, telle qu'exportée en CSV. */
interface LigneTransaction {
  date: string
  module: string
  categorie: string
  description: string
  montant: number
  /** Devise figée de la ligne ; absente : devise courante ; `null` : inconnue. */
  monnaie?: Devise | null
  client?: string | null
  fournisseur?: string | null
  paye: boolean | null
}

interface ChartData {
  // `null` : l'exercice compte deux devises.
  mensuel: { mois: string; revenus: number | null; depenses: number | null; benefice: number | null; revenusParDevise?: TotalDevise[]; depensesParDevise?: TotalDevise[]; beneficeParDevise?: TotalDevise[] }[]
  // `montant: null` : le graphique compte deux devises (voir `montantParDevise`).
  revenusParCategorie: { categorie: string; montant: number | null; montantParDevise?: TotalDevise[]; couleur: string }[]
  depensesParCategorie: { categorie: string; montant: number | null; montantParDevise?: TotalDevise[]; couleur: string }[]
}

// DEV1 #5 — Bilan PCG distinct du compte de résultat.
interface BilanData {
  year: number
  actif: {
    immobilisations: number
    stocks: number
    creances: number
    disponibilites: number
  }
  passif: {
    capital: number
    resultatExercice: number
    dettesFournisseurs: number
    tvaAPayer: number
    ecartEquilibrage: number
  }
  totalActif: number
  totalPassif: number
  // BUG #10 — diagnostic d'équilibrage exposé pour bannière UI
  diagnostic?: {
    ecart: number
    ecartAbs: number
    severity: 'ok' | 'info' | 'warning' | 'error'
    reasons: string[]
    capitalSaisi: boolean
    dispoSaisies: boolean
  }
}

interface TVAData {
  historique?: { regimesEnregistres: string[]; contexteDifferent: boolean; lignesSansContexte: number }
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
    nbVentesElevage?: number
    nbRecoltesPotager?: number
    nbRecoltesArbres?: number
    nbVenteBois?: number
    nbAbattages?: number
    nbConsommationsAliments?: number
    nbFertilisations?: number
    nbInfereesCollectees?: number
    nbInfereesDeductibles?: number
    inferencesBreakdown?: {
      ventesManuelles: number
      facturesAnciennes: number
      ventesElevage: number
      recoltesPotager: number
      recoltesArbres: number
      venteBois: number
      venteAbattage: number
      depensesManuelles: number
      consommationsAliments: number
      fertilisations: number
    }
  }
}

const INFERENCE_LABELS: Record<string, string> = {
  ventesManuelles: 'Ventes manuelles sans taux saisi',
  facturesAnciennes: 'Factures pré-PROMPT 14C (TVA 5,5 % par défaut)',
  ventesElevage: 'Ventes élevage (5,5 %)',
  recoltesPotager: 'Récoltes potager (5,5 %)',
  recoltesArbres: 'Récoltes verger (5,5 %)',
  venteBois: 'Ventes bois (10 %)',
  venteAbattage: 'Abattages (5,5 %)',
  depensesManuelles: 'Dépenses manuelles sans taux saisi',
  consommationsAliments: 'Consommations d’aliments (10 %)',
  fertilisations: 'Fertilisations (20 %)',
}

export default function RapportsPage() {
  const devise = useDevise()
  const formatMontant = (value: number) => devise === null ? "—" : formatMontantDevise(value, devise)
  // Lot devise-totaux-api, tour 2 — chaque montant dans SA devise ; un total
  // historique `null` (deux devises) n'est jamais affiché comme un zéro.
  const formatEn = (value: number, monnaie: Devise | null) =>
    monnaie ? formatMontantDevise(value, monnaie) : "Montant indisponible : devise historique inconnue"
  const totauxEnLignes = (parDevise: TotalDevise[] | undefined, total: number | null | undefined) =>
    (parDevise?.length
      ? libellesTotauxParDevise(parDevise.map(t => ({ monnaie: t.monnaie, montant: t.total })), devise)
      : [total == null ? "—" : formatMontant(total)]
    ).map((l, i) => <span key={i} className="block">{l}</span>)
  const { toast } = useToast()
  // DEV1 #5 — Onglet par défaut renommé : ce qui s'appelait "bilan" est en
  // réalité un compte de résultat. Le vrai bilan est dans un onglet séparé.
  const [activeTab, setActiveTab] = React.useState("compte-de-resultat")
  const [bilanData, setBilanData] = React.useState<BilanData | null>(null)
  const [erreurBilan, setErreurBilan] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [stats, setStats] = React.useState<Stats | null>(null)
  // QA cmsjiqtd1 — Rapports ne partageait pas l'année choisie ailleurs (clé
  // `gleba_compta_year`). On la relit au montage (client-only) et on persiste
  // les changements réels, comme le dashboard Comptabilité.
  // QA cmsoamukd — `yearHydrated` doit être un STATE, pas un ref : avec un
  // ref, le fetch du montage partait avec l'année par défaut (2026) AVANT
  // l'hydratation, et sa réponse, plus lourde, arrivait après celle de
  // l'année demandée et l'écrasait (rapport « 2025 » aux chiffres 2026).
  const [yearHydrated, setYearHydrated] = React.useState(false)
  React.useEffect(() => {
    const stored = window.localStorage.getItem("gleba_compta_year")
    if (stored && /^\d{4}$/.test(stored)) {
      const y = parseInt(stored, 10)
      setSelectedYear((prev) => (y !== prev ? y : prev))
    }
    setYearHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  React.useEffect(() => {
    if (yearHydrated) window.localStorage.setItem("gleba_compta_year", String(selectedYear))
  }, [yearHydrated, selectedYear])
  const [charts, setCharts] = React.useState<ChartData | null>(null)
  const [revenus, setRevenus] = React.useState<LigneTransaction[]>([])
  const [depenses, setDepenses] = React.useState<LigneTransaction[]>([])
  const [tvaData, setTvaData] = React.useState<TVAData | null>(null)
  const [erreurTva, setErreurTva] = React.useState('')
  const [selectedTrimestre, setSelectedTrimestre] = React.useState<string>("all")

  // QA cmsqltuok — SSOT des exercices : même plage que le dashboard Comptabilité,
  // avec lequel cet écran partage la clé `gleba_compta_year`. La formule locale
  // s'arrêtait à l'année courante : l'année 2027 choisie au dashboard arrivait
  // ici sans SelectItem correspondant, et le sélecteur s'affichait vide.
  const years = getAvailableYears()

  // QA cmsoamukd — anti-réponse périmée : seule la dernière salve de fetch a
  // le droit d'écrire les states (dernier-arrivé-gagne sinon, et la salve la
  // plus lourde n'est pas forcément la dernière à répondre).
  const fetchSeq = React.useRef(0)

  const fetchData = React.useCallback(async () => {
    const seq = ++fetchSeq.current
    setIsLoading(true)
    try {
      const tvaParam = selectedTrimestre !== 'all' ? `&trimestre=${selectedTrimestre}` : ''
      const [statsData, revRes, depRes, tvaRes, bilanRes] = await Promise.all([
        // Contrat devise garanti, y compris dans le dépôt public (stats-client.ts).
        chargerStatsComptables<{ stats: Stats; charts: ChartData }>(selectedYear),
        fetch(`/api/comptabilite/revenus?year=${selectedYear}&limit=500`),
        fetch(`/api/comptabilite/depenses?year=${selectedYear}&limit=500`),
        fetch(`/api/comptabilite/tva?year=${selectedYear}${tvaParam}`),
        // DEV1 #5 — Bilan ACTIF/PASSIF
        fetch(`/api/comptabilite/bilan?year=${selectedYear}`),
      ])
      if (seq !== fetchSeq.current) return

      if (statsData) {
        setStats(statsData.stats)
        setCharts(statsData.charts)
      } else {
        setStats(null)
        setCharts(null)
      }
      if (revRes.ok) {
        const data = await revRes.json()
        if (seq !== fetchSeq.current) return
        setRevenus(data.data || [])
      }
      if (depRes.ok) {
        const data = await depRes.json()
        if (seq !== fetchSeq.current) return
        setDepenses(data.data || [])
      }
      if (bilanRes.ok) {
        const data = await bilanRes.json()
        if (seq !== fetchSeq.current) return
        setBilanData(data)
        setErreurBilan('')
      } else {
        const data = await bilanRes.json().catch(() => null)
        if (seq !== fetchSeq.current) return
        setBilanData(null)
        setErreurBilan(typeof data?.error === 'string' ? data.error : 'Le bilan ne peut pas être chargé. Réessayez.')
      }
      if (tvaRes.ok) {
        const data = await tvaRes.json()
        if (seq !== fetchSeq.current) return
        setTvaData(data)
        setErreurTva('')
      } else {
        const data = await tvaRes.json().catch(() => null)
        if (seq !== fetchSeq.current) return
        setTvaData(null)
        setErreurTva(typeof data?.error === 'string' ? data.error : 'Les montants de TVA ne peuvent pas être chargés. Réessayez.')
      }
    } catch {
      if (seq === fetchSeq.current) {
        setStats(null); setCharts(null); setRevenus([]); setDepenses([])
        setTvaData(null); setBilanData(null)
        setErreurBilan('La connexion ne permet pas de vérifier le bilan. Réessayez.')
        setErreurTva('La connexion ne permet pas de vérifier les montants de TVA. Réessayez.')
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
      }
    } finally {
      if (seq === fetchSeq.current) setIsLoading(false)
    }
  }, [selectedYear, selectedTrimestre, toast])

  // QA cmsoamukd — pas de fetch avant l'hydratation de l'année persistée : la
  // salve « année par défaut » était un fetch fantôme dont la réponse écrasait
  // celle de l'année réellement choisie.
  React.useEffect(() => {
    if (yearHydrated) fetchData()
  }, [yearHydrated, fetchData])

  // DEV1 #5 — Le type 'bilan' historique exporte en réalité un compte de
  // résultat synthétique. Le bouton est conservé sous son ancien nom de
  // type pour compatibilité, mais le filename émis devient
  // `compte-de-resultat_AAAA.csv` (plus exact réglementairement).
  const exportCSV = (type: 'revenus' | 'depenses' | 'bilan') => {
    let csv = ''
    let filename = ''

    if (type === 'revenus') {
      csv = 'Date;Module;Catégorie;Description;Montant;Devise;Client;Payé\n'
      revenus.forEach(r => {
        csv += `${new Date(r.date).toLocaleDateString('fr-FR')};${celluleCsv(r.module)};${celluleCsv(r.categorie)};${celluleCsv(r.description)};${r.montant};${libelleDevise(r.monnaie === undefined ? devise : r.monnaie)};${celluleCsv(r.client || '')};${r.paye ? 'Oui' : 'Non'}\n`
      })
      filename = `revenus_${selectedYear}.csv`
    } else if (type === 'depenses') {
      csv = 'Date;Module;Catégorie;Description;Montant;Devise;Fournisseur;Payé\n'
      depenses.forEach(d => {
        csv += `${new Date(d.date).toLocaleDateString('fr-FR')};${celluleCsv(d.module)};${celluleCsv(d.categorie)};${celluleCsv(d.description)};${d.montant};${libelleDevise(d.monnaie === undefined ? devise : d.monnaie)};${celluleCsv(d.fournisseur || '')};${d.paye === null ? 'N/A' : d.paye ? 'Oui' : 'Non'}\n`
      })
      filename = `depenses_${selectedYear}.csv`
    } else {
      // Une ligne par devise : jamais de total EUR + XPF ni de « null » écrit.
      csv = 'Indicateur;Devise;Valeur\n'
      if (stats) {
        const groupes = groupesRapport(stats, devise)
        const libelles: Record<(typeof MODULES_RAPPORT)[number], string> = { potager: 'Maraîchage', verger: 'Verger', elevage: 'Élevage', autre: 'Autre' }
        for (const g of groupes) {
          const d = libelleDevise(g.monnaie)
          csv += `Revenus totaux;${d};${g.revenus}\n`
          csv += `Dépenses totales;${d};${g.depenses}\n`
          csv += `Bénéfice;${d};${g.benefice}\n`
        }
        if (stats.margePercent !== null && groupes.length === 1) csv += `Marge;;${stats.margePercent}%\n`
        for (const g of groupes) {
          csv += `\nRevenus par module;${libelleDevise(g.monnaie)};\n`
          for (const m of MODULES_RAPPORT) csv += `${libelles[m]};${libelleDevise(g.monnaie)};${g.revenusParModule[m]}\n`
          csv += `\nDépenses par module;${libelleDevise(g.monnaie)};\n`
          for (const m of MODULES_RAPPORT) csv += `${libelles[m]};${libelleDevise(g.monnaie)};${g.depensesParModule[m]}\n`
        }
      }
      filename = `compte-de-resultat_${selectedYear}.csv`
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

  // Onglet Graphiques : un groupe unique (sa devise) ; `null` : plusieurs
  // devises, graphique indisponible ; `undefined` : rien de chargé.
  const groupesGraphiques = stats ? groupesRapport(stats, devise) : null
  const groupeUnique = groupesGraphiques === null || groupesGraphiques.length === 0 ? undefined
    : groupesGraphiques.length === 1 ? groupesGraphiques[0] : null
  // Un camembert mono-devise s'affiche dans la devise de ses parts.
  const formatCamembert = (parts: ChartData['revenusParCategorie']) => (v: number) => {
    const monnaies = new Set(parts.flatMap(p => (p.montantParDevise ?? []).map(t => t.monnaie)))
    return monnaies.size === 1 ? formatEn(v, [...monnaies][0]) : formatMontant(v)
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b border-b-2 border-b-blue-500 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        {/* Revue du 2026-11-01 — à 390 px, l'année et l'actualisation sortaient
            de l'écran (page de 441 px) : même retour à la ligne que Transactions. */}
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2 min-w-0">
              <Download className="h-6 w-6 text-blue-600 shrink-0" />
              <h1 className="text-xl font-bold truncate">Rapports</h1>
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
          {/* Même correctif que l'écran Factures (ticket cmsx6g3gq) : cinq
              onglets en `inline-flex` débordent d'un écran de 375 px et font
              défiler la page entière. */}
          <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="compte-de-resultat" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Compte de résultat
            </TabsTrigger>
            {/* DEV1 #5 — Vrai bilan PCG (ACTIF / PASSIF), séparé du compte de résultat. */}
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

          {/* Onglet Compte de résultat (anciennement labellisé "Bilan") */}
          <TabsContent value="compte-de-resultat">
            {isLoading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
            ) : stats ? (() => {
              const groupes: GroupeRapport[] = groupesRapport(stats, devise)
              const cc = stats.coherenceCheck
              const enLignes = (valeur: (g: GroupeRapport) => number) => groupes.length
                ? groupes.map((g, i) => <span key={i} className="block">{formatEn(valeur(g), g.monnaie)}</span>)
                : "—"
              const unique = groupes.length === 1 ? groupes[0] : null
              const dettes = (stats.depensesNonPayeesParDevise ?? []).filter(t => t.total > 0)
              // Écarts de cohérence devise par devise (jamais une somme de deux devises).
              const ecarts = (parDevise: TotalDevise[] | undefined, total: number | null | undefined, seuil: number) =>
                (parDevise ?? (total != null ? [{ monnaie: devise, total }] : [])).filter(t => Math.abs(t.total) > seuil)
              const ecartsRevenus = ecarts(cc?.revenusEcartParDevise, cc?.revenusEcart, 0.005)
              const ecartsDepenses = ecarts(cc?.depensesEcartParDevise, cc?.depensesEcart, 0.01)
              const deDevise = (l: TotalDevise[] | undefined, m: Devise | null, repli: number | null | undefined) =>
                l ? l.find(t => t.monnaie === m)?.total ?? 0 : repli ?? 0
              const deviseMensuelle = deviseCommuneDesSeries((charts?.mensuel ?? []).flatMap(m => [
                { valeur: m.revenus, parDevise: m.revenusParDevise },
                { valeur: m.depenses, parDevise: m.depensesParDevise },
                { valeur: m.benefice, parDevise: m.beneficeParDevise ?? (m.revenusParDevise && m.depensesParDevise ? soustraireParDevise(m.revenusParDevise, m.depensesParDevise) : undefined) },
              ]), devise)
              const mensuelIndisponible = !deviseMensuelle || (charts?.mensuel.some(m => m.revenus === null || m.depenses === null || m.benefice === null) ?? false)
              const formatGraphique = (v: number) => formatEn(v, deviseMensuelle?.monnaie ?? null)
              return (
              <div className="space-y-6">
                {/* BUG #2 (audit compta 2026-05-15) — Bannière explicite si
                    une charge engagée non payée fait partie du total. Plus
                    aucune exclusion silencieuse. Un montant par devise. */}
                {(dettes.length > 0 || (!stats.depensesNonPayeesParDevise && (stats.depensesNonPayees ?? 0) > 0)) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-amber-700 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{stats.nbDepensesNonPayees} dépense(s) engagée(s) non encore payée(s)</p>
                      <p className="text-xs mt-0.5">
                        Le total dépenses ci-dessous inclut {dettes.length
                          ? libellesTotauxParDevise(dettes.map(t => ({ monnaie: t.monnaie, montant: t.total })), devise).join(" et ")
                          : formatMontant(stats.depensesNonPayees ?? 0)} de
                        charges constatées (compta. d&apos;engagement) dont le règlement reste à effectuer.
                        Voir l&apos;onglet Transactions pour le détail.
                      </p>
                    </div>
                  </div>
                )}
                {/* Ticket cmvflua2x (2026-10-19) — les revenus par module sont
                    la ventilation de la SSOT elle-même : leur somme égale la
                    carte Revenus au centime. S'il réapparaissait un écart, il
                    est chiffré devise par devise et la composition est nommée. */}
                {ecartsRevenus.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-red-700 flex-shrink-0" />
                    <div>
                      {ecartsRevenus.map(e => {
                        const comp = groupes.find(g => g.monnaie === e.monnaie)?.composition ?? null
                        return (
                          <React.Fragment key={String(e.monnaie)}>
                            <p className="font-semibold">
                              Écart de {formatEn(Math.abs(e.total), e.monnaie)} entre le total des revenus et la somme des modules
                            </p>
                            <p className="text-xs mt-0.5">
                              Total des revenus {formatEn(deDevise(cc?.revenusSsotParDevise, e.monnaie, cc?.revenusSsot), e.monnaie)} ;
                              somme des modules {formatEn(deDevise(cc?.revenusSommeModulesParDevise, e.monnaie, cc?.revenusSommeModules), e.monnaie)}.
                              {comp && (
                                <> Composition du total : ventes {formatEn(comp.ventes, e.monnaie)}, factures rattachées à une vente {formatEn(comp.facturesRattachees, e.monnaie)}, factures sans vente rattachée {formatEn(comp.facturesSansVente, e.monnaie)}, avoirs {formatEn(comp.avoirs, e.monnaie)}.</>
                              )}
                              {" "}La ligne TOTAL ci-dessous reflète la somme des cellules visibles.
                            </p>
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* TICKET cmsoevq3v/cmsoevq3q puis cmsx69cuc — bandeau discret,
                    l'écart des dépenses est chiffré et rapproché des
                    valorisations internes, au centime et devise par devise. */}
                {ecartsDepenses.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-slate-500 flex-shrink-0" />
                    <div>
                      {ecartsDepenses.map(e => {
                        const analytiques = deDevise(cc?.depensesAnalytiquesParDevise, e.monnaie, cc?.depensesAnalytiques)
                        return (
                          <p key={String(e.monnaie)} className="text-xs">
                            Dépenses — ventilation analytique par module : {formatEn(deDevise(cc?.depensesSommeModulesParDevise, e.monnaie, cc?.depensesSommeModules), e.monnaie)} ;
                            total comptable : {formatEn(deDevise(cc?.depensesSsotParDevise, e.monnaie, cc?.depensesSsot), e.monnaie)}.
                            {Math.abs(analytiques - Math.abs(e.total)) < 0.01
                              ? ` L'écart de ${formatEn(analytiques, e.monnaie)} est exactement la valorisation interne des soins, consommations d'aliments et fertilisations : ce sont des coûts analytiques, pas des charges comptables.`
                              : " Les valorisations internes (consommations d'aliments, fertilisations…) ne sont pas des charges comptables : l'écart entre les deux n'est pas une anomalie."}
                          </p>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Résumé — un montant par devise, jamais de somme ni de zéro inventé. */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 max-md:[&>*>*]:px-3 max-md:[&>*>*:first-child]:pt-3 max-md:[&>*>*:last-child]:pb-3 max-md:[&_.text-2xl]:text-xl md:grid-cols-4">
                  <Card className={kpiCardClass("revenu")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Revenus {selectedYear}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.revenusParDevise ? enLignes(g => g.revenus) : totauxEnLignes(undefined, stats.revenus)}</p>
                    </CardContent>
                  </Card>
                  <Card className={kpiCardClass("depense")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Dépenses {selectedYear}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.depensesParDevise ? enLignes(g => g.depenses) : totauxEnLignes(undefined, stats.depenses)}</p>
                    </CardContent>
                  </Card>
                  <Card className={kpiCardClass(unique && unique.benefice < 0 ? "depense" : "revenu")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {unique ? (unique.benefice >= 0 ? 'Bénéfice' : 'Perte') : 'Résultat par devise'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">
                        {unique ? formatEn(Math.abs(unique.benefice), unique.monnaie) : enLignes(g => g.benefice)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={kpiCardClass((stats.margePercent ?? 0) >= 0 ? "revenu" : "depense")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Marge</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stats.margePercent === null ? (
                        <>
                          <p className="text-3xl font-bold">—</p>
                          <p className="text-xs text-muted-foreground">Indisponible : revenus et dépenses en devises différentes</p>
                        </>
                      ) : (
                        <p className="text-3xl font-bold">{stats.margePercent}%</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Détail par module — TICKET cmsoevq3v/cmsoevq3q : « ventilation
                    analytique » (valorisations internes incluses). Un tableau par
                    devise : une colonne n'additionne jamais deux devises. */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ventilation analytique par module</CardTitle>
                    <CardDescription>
                      Dépenses = coûts analytiques des modules (valorisations internes incluses) —
                      le total comptable de la ferme est celui des cartes ci-dessus.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {groupes.length === 0 && <p className="text-sm text-muted-foreground">Ventilation indisponible.</p>}
                    {groupes.map((g) => {
                      // BUG #1 (audit comptable 2026-05-15) — le TOTAL somme
                      // LITTÉRALEMENT les cellules visibles (de cette devise).
                      const rows = MODULES_RAPPORT.map((mod) => {
                        const rev = g.revenusParModule[mod]
                        const dep = g.depensesParModule[mod]
                        return { mod, rev, dep, res: rev - dep }
                      })
                      const totalRevenus = rows.reduce((s, r) => s + r.rev, 0)
                      const totalDepenses = rows.reduce((s, r) => s + r.dep, 0)
                      const totalResultat = totalRevenus - totalDepenses
                      return (
                        <div key={String(g.monnaie)} className="mb-4 last:mb-0">
                          {groupes.length > 1 && (
                            <p className="mb-2 text-sm font-medium">Montants en {g.monnaie === 'EUR' ? 'euros (€)' : g.monnaie === 'XPF' ? 'francs Pacifique (F)' : 'devise historique inconnue'}</p>
                          )}
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
                              {rows.map((r) => (
                                <TableRow key={r.mod}>
                                  <TableCell className="font-medium capitalize">{r.mod}</TableCell>
                                  <TableCell className="text-right text-green-600">{formatEn(r.rev, g.monnaie)}</TableCell>
                                  <TableCell className="text-right text-red-600">{formatEn(r.dep, g.monnaie)}</TableCell>
                                  <TableCell className={`text-right font-bold ${r.res >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                    {formatEn(r.res, g.monnaie)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="border-t-2">
                                <TableCell className="font-bold">TOTAL</TableCell>
                                <TableCell className="text-right font-bold text-green-600">{formatEn(totalRevenus, g.monnaie)}</TableCell>
                                <TableCell className="text-right font-bold text-red-600">{formatEn(totalDepenses, g.monnaie)}</TableCell>
                                <TableCell className={`text-right font-bold ${totalResultat >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                  {formatEn(totalResultat, g.monnaie)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )
                    })}
                    {/* Ticket cmvflua2x — d'où viennent les revenus des
                        modules : une facture saisie sans vente métier est rangée
                        en « Autre », un avoir se déduit du module de sa facture
                        d'origine. Une phrase par devise. */}
                    {groupes.map((g) => {
                      const comp = g.composition
                      if (!comp || (Math.abs(comp.facturesSansVente) < 0.005 && Math.abs(comp.avoirs) < 0.005)) return null
                      const parts: string[] = []
                      if (Math.abs(comp.facturesSansVente) >= 0.005) {
                        parts.push(`« Autre » comprend ${formatEn(comp.facturesSansVente, g.monnaie)} de factures sans vente rattachée (saisies dans Factures)`)
                      }
                      if (Math.abs(comp.avoirs) >= 0.005) {
                        parts.push(`les avoirs (${formatEn(comp.avoirs, g.monnaie)}) sont déduits du module de leur facture d'origine`)
                      }
                      return (
                        <p key={String(g.monnaie)} className="mt-3 text-xs text-muted-foreground" data-testid="revenus-composition">
                          Revenus par module : ventilation du total des revenus ({formatEn(g.revenus, g.monnaie)}). {parts.join(" ; ")}.
                        </p>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Graphique évolution mensuelle : indisponible en multi-devise
                    (deux unités sur un même axe), sinon dans la devise des données. */}
                {charts?.mensuel && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Évolution mensuelle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {mensuelIndisponible ? (
                        <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                          Graphique indisponible : montants en devises différentes (voir les totaux par devise)
                        </div>
                      ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={charts.mensuel}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mois" />
                          <YAxis tickFormatter={(v) => formatGraphique(Number(v))} />
                          <Tooltip formatter={(value) => [formatGraphique(Number(value || 0)), '']} />
                          <Legend />
                          <Line type="monotone" dataKey="revenus" name="Revenus" stroke="#22c55e" strokeWidth={2} />
                          <Line type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} />
                          <Line type="monotone" dataKey="benefice" name="Bénéfice" stroke="#3b82f6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              )
            })() : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune donnée disponible
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DEV1 #5 — Bilan ACTIF / PASSIF */}
          <TabsContent value="bilan">
            {isLoading ? (
              <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
            ) : bilanData ? (
              <div className="space-y-6">
                {/* BUG #10 (audit compta 2026-05-15) — Bannière d'alerte si
                    l'écart d'équilibrage 47x est anormal. Avant : le compte
                    47x absorbait silencieusement n'importe quel écart, même
                    −2 580 €. Maintenant le diagnostic est explicite. */}
                {bilanData.diagnostic && bilanData.diagnostic.severity !== 'ok' && (
                  <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
                    bilanData.diagnostic.severity === 'error'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : bilanData.diagnostic.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-blue-200 bg-blue-50 text-blue-900'
                  }`}>
                    <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                      bilanData.diagnostic.severity === 'error'
                        ? 'text-red-700'
                        : bilanData.diagnostic.severity === 'warning'
                        ? 'text-amber-700'
                        : 'text-blue-700'
                    }`} />
                    <div className="flex-1">
                      <p className="font-semibold">
                        {bilanData.diagnostic.severity === 'error'
                          ? 'Bilan déséquilibré — anomalie comptable'
                          : bilanData.diagnostic.severity === 'warning'
                          ? `Bilan équilibré via le compte 47x (${formatMontant(bilanData.diagnostic.ecart)})`
                          : 'Écart d\'arrondi'}
                      </p>
                      {bilanData.diagnostic.reasons.length > 0 && (
                        <ul className="text-xs mt-1 list-disc list-inside space-y-0.5">
                          {bilanData.diagnostic.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* ACTIF */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>ACTIF</span>
                        <span className="text-base text-muted-foreground">
                          {formatMontant(bilanData.totalActif)}
                        </span>
                      </CardTitle>
                      <CardDescription>Ce que possède l&apos;exploitation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Poste</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Immobilisations corporelles</div>
                              <div className="text-xs text-muted-foreground">215x · matériel agricole</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMontant(bilanData.actif.immobilisations)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Stocks</div>
                              <div className="text-xs text-muted-foreground">31x · semences, intrants <span className="italic">(à valoriser)</span></div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatMontant(bilanData.actif.stocks)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Créances clients</div>
                              <div className="text-xs text-muted-foreground">411 · factures et ventes non payées</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMontant(bilanData.actif.creances)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Disponibilités</div>
                              <div className="text-xs text-muted-foreground">512 · banque <span className="italic">(à saisir manuellement)</span></div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatMontant(bilanData.actif.disponibilites)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t-2 font-bold">
                            <TableCell>Total ACTIF</TableCell>
                            <TableCell className="text-right font-mono">{formatMontant(bilanData.totalActif)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* PASSIF */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>PASSIF</span>
                        <span className="text-base text-muted-foreground">
                          {formatMontant(bilanData.totalPassif)}
                        </span>
                      </CardTitle>
                      <CardDescription>Comment l&apos;actif est financé</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Poste</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Capital</div>
                              <div className="text-xs text-muted-foreground">101 · capital social</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMontant(bilanData.passif.capital)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Résultat de l&apos;exercice</div>
                              <div className="text-xs text-muted-foreground">12 · pivot Actif/Passif</div>
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${bilanData.passif.resultatExercice >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                              {formatMontant(bilanData.passif.resultatExercice)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">Dettes fournisseurs</div>
                              <div className="text-xs text-muted-foreground">401 · dépenses non payées</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMontant(bilanData.passif.dettesFournisseurs)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">TVA à payer</div>
                              <div className="text-xs text-muted-foreground">4457 − 4456 (solde net)</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMontant(bilanData.passif.tvaAPayer)}
                            </TableCell>
                          </TableRow>
                          {bilanData.passif.ecartEquilibrage !== 0 && (
                            <TableRow>
                              <TableCell>
                                <div className="font-medium text-amber-700">Écart d&apos;équilibrage</div>
                                <div className="text-xs text-muted-foreground">47x · à reclasser (disponibilités banque, capital…)</div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-amber-700">
                                {formatMontant(bilanData.passif.ecartEquilibrage)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="border-t-2 font-bold">
                            <TableCell>Total PASSIF</TableCell>
                            <TableCell className="text-right font-mono">{formatMontant(bilanData.totalPassif)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-4 text-sm text-blue-900">
                    <p className="font-medium mb-1">ℹ Notes méthodologiques (MVP)</p>
                    <ul className="list-disc ml-5 text-xs space-y-1">
                      <li>Les <strong>stocks</strong> et <strong>disponibilités bancaires</strong> ne sont pas encore intégrés
                        (à valoriser manuellement). L&apos;écart apparaît au compte <strong>47x</strong>.</li>
                      <li>Les <strong>amortissements linéaires</strong> ne sont pas appliqués sur les immobilisations
                        (étape suivante : fiche Immobilisation + durée d&apos;amortissement).</li>
                      <li>Le <strong>capital</strong> provient de Paramètres &gt; Exploitation. Renseignez-le pour équilibrer.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent role={erreurBilan ? 'alert' : undefined} className="py-8 text-center text-muted-foreground">
                  {erreurBilan || 'Aucune donnée disponible'}
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
                <CardContent className="flex flex-wrap gap-2">
                  {erreurTva && <p role="alert" className="w-full text-sm text-destructive">{erreurTva}</p>}
                  {tvaData?.historique?.contexteDifferent && (
                    <p role="status" className="w-full text-sm text-muted-foreground">
                      Les ventes de cette période conservent leur régime fiscal d’origine. Les paramètres actuels ne changent pas leurs montants.
                      {tvaData.historique.lignesSansContexte > 0 && ' Certaines écritures anciennes n’archivent pas leur régime : leur traitement reste à vérifier.'}
                    </p>
                  )}
                  {/* 2026-08-19 — les documents PDF s'ouvrent dans l'écran
                      d'aperçu : on relit l'aide CA3 avant de la reporter, et le
                      téléchargement reste à un clic. */}
                  <a
                    href={urlApercu(
                      `/api/comptabilite/tva/ca3?year=${selectedYear}${selectedTrimestre !== 'all' ? `&trimestre=${selectedTrimestre}` : ''}&format=pdf`,
                      `Aide CA3 ${selectedYear}${selectedTrimestre !== 'all' ? ` — T${selectedTrimestre}` : ''}`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Aide CA3 (PDF)
                    </Button>
                  </a>
                  <a
                    href={`/api/comptabilite/tva/ca3?year=${selectedYear}${selectedTrimestre !== 'all' ? `&trimestre=${selectedTrimestre}` : ''}&format=csv`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Aide CA3 (CSV)
                    </Button>
                  </a>
                  {tvaData?.details && ((tvaData.details.nbInfereesCollectees ?? 0) > 0 || (tvaData.details.nbInfereesDeductibles ?? 0) > 0) && (
                    // BUG #20 (audit compta 2026-05-15) — Avant : badge
                    // « X transactions avec TVA inférée » sans action possible,
                    // le comptable ne savait pas quoi vérifier. Maintenant
                    // c'est un tooltip qui détaille la provenance des
                    // inférences (élevage / récoltes / bois / aliments / etc.)
                    // pour qu'il puisse remonter à la source.
                    <TooltipProvider delayDuration={100}>
                      <InfoTooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded inline-flex items-center ml-auto cursor-help underline decoration-dotted decoration-amber-600 underline-offset-2"
                          >
                            ⚠ {(tvaData.details.nbInfereesCollectees ?? 0) + (tvaData.details.nbInfereesDeductibles ?? 0)} transaction(s) avec TVA inférée
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="max-w-md text-left">
                          <p className="font-semibold mb-2">TVA inférée — détail par source</p>
                          {tvaData.details.inferencesBreakdown ? (
                            <ul className="space-y-1 text-xs">
                              {Object.entries(tvaData.details.inferencesBreakdown)
                                .filter(([, n]) => n > 0)
                                .map(([source, n]) => (
                                  <li key={source} className="flex items-baseline gap-2">
                                    <span className="font-bold w-7 text-right">{n}</span>
                                    <span className="text-slate-100">{INFERENCE_LABELS[source] ?? source}</span>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-300">Détail indisponible</p>
                          )}
                          <p className="mt-2 text-[10px] text-slate-300">
                            L’inférence applique un taux par défaut faute de taux saisi à la source.
                            Saisir le taux dans le formulaire d’origine pour éviter cette approximation.
                          </p>
                        </TooltipContent>
                      </InfoTooltip>
                    </TooltipProvider>
                  )}
                </CardContent>
              </Card>

              <TvaAPreciser onCorrection={() => { void fetchData() }} />

              {isLoading ? (
                <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
              ) : tvaData ? (
                <>
                  {/* Résumé TVA */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4 max-md:[&>*>*]:px-3 max-md:[&>*>*:first-child]:pt-3 max-md:[&>*>*:last-child]:pb-3 max-md:[&_.text-2xl]:text-xl max-md:[&>*:first-child]:col-span-2 md:grid-cols-3">
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-700">TVA Collectée</CardTitle>
                        <CardDescription className="text-xs text-green-600">Sur les ventes</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-700">{formatMontant(tvaData.collectee.total)}</p>
                        <p className="text-xs text-green-600 mt-1">Base HT : {formatMontant(tvaData.collectee.baseTotal)}</p>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-700">TVA Déductible</CardTitle>
                        <CardDescription className="text-xs text-red-600">Sur les achats</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-red-700">{formatMontant(tvaData.deductible.total)}</p>
                        <p className="text-xs text-red-600 mt-1">Base HT : {formatMontant(tvaData.deductible.baseTotal)}</p>
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
                          {formatMontant(tvaData.solde.tvaAPayer > 0 ? tvaData.solde.tvaAPayer : tvaData.solde.creditTVA)}
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
                                <TableCell className="text-right">{formatMontant(data.base)}</TableCell>
                                <TableCell className="text-right font-medium text-green-600">{formatMontant(data.tva)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="border-t-2 font-bold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{formatMontant(tvaData.collectee.baseTotal)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatMontant(tvaData.collectee.total)}</TableCell>
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
                                <TableCell className="text-right">{formatMontant(data.base)}</TableCell>
                                <TableCell className="text-right font-medium text-red-600">{formatMontant(data.tva)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="border-t-2 font-bold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{formatMontant(tvaData.deductible.baseTotal)}</TableCell>
                              <TableCell className="text-right text-red-600">{formatMontant(tvaData.deductible.total)}</TableCell>
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
                      {/* BUG #9 (audit compta 2026-05-15) — Avant : « Ventes
                          manuelles 47, Factures 1, Dépenses 12 » sans préciser
                          que les sources brutes (élevage, récoltes, bois) sont
                          comptées séparément. Le comptable comptait 48 ventes
                          dans Transactions et trouvait l'écart inexplicable.
                          Désormais on détaille l'agrégation poste par poste. */}
                      {(() => {
                        const d = tvaData.details
                        const totalVentesCollectees =
                          (d.nbVentes || 0) +
                          (d.nbFactures || 0) +
                          (d.nbVentesElevage || 0) +
                          (d.nbRecoltesPotager || 0) +
                          (d.nbRecoltesArbres || 0) +
                          (d.nbVenteBois || 0) +
                          (d.nbAbattages || 0)
                        const totalDepensesDeductibles =
                          (d.nbDepenses || 0) +
                          (d.nbConsommationsAliments || 0) +
                          (d.nbFertilisations || 0)
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div>
                                <p className="font-semibold mb-1 text-emerald-700">
                                  Côté TVA collectée — {totalVentesCollectees} ligne(s)
                                </p>
                                <ul className="space-y-0.5 text-xs text-muted-foreground">
                                  <li><span className="font-medium text-slate-700">{d.nbVentes}</span> · ventes manuelles</li>
                                  <li><span className="font-medium text-slate-700">{d.nbFactures}</span> · factures (hors brouillon/annulée)</li>
                                  {(d.nbVentesElevage ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbVentesElevage}</span> · ventes élevage</li>
                                  )}
                                  {(d.nbRecoltesPotager ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbRecoltesPotager}</span> · récoltes potager vendues</li>
                                  )}
                                  {(d.nbRecoltesArbres ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbRecoltesArbres}</span> · récoltes verger vendues</li>
                                  )}
                                  {(d.nbVenteBois ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbVenteBois}</span> · ventes bois</li>
                                  )}
                                  {(d.nbAbattages ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbAbattages}</span> · abattages vendus</li>
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className="font-semibold mb-1 text-red-700">
                                  Côté TVA déductible — {totalDepensesDeductibles} ligne(s)
                                </p>
                                <ul className="space-y-0.5 text-xs text-muted-foreground">
                                  <li><span className="font-medium text-slate-700">{d.nbDepenses}</span> · dépenses manuelles</li>
                                  {(d.nbConsommationsAliments ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbConsommationsAliments}</span> · consommations d&apos;aliments</li>
                                  )}
                                  {(d.nbFertilisations ?? 0) > 0 && (
                                    <li><span className="font-medium text-slate-700">{d.nbFertilisations}</span> · fertilisations</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                              Périmètre TVA aligné sur l&apos;onglet Transactions : les sources brutes
                              (élevage, récoltes, bois, abattages) sont comptées séparément des
                              ventes manuelles pour éviter le double comptage avec les
                              VenteManuelle « auto » que ces sources génèrent.
                              Vérifiez ces données avant toute déclaration officielle.
                            </p>
                          </>
                        )
                      })()}
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
                {/* Revenus par categorie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-green-600" />
                      Revenus par catégorie
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {charts.revenusParCategorie.some(c => c.montant === null) ? (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        Répartition indisponible : montants en devises différentes (voir les totaux par devise)
                      </div>
                    ) : charts.revenusParCategorie.length > 0 ? (
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
                          <Tooltip formatter={(value) => [formatCamembert(charts.revenusParCategorie)(Number(value || 0)), '']} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Aucun revenu
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Dépenses par categorie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-red-600" />
                      Dépenses par catégorie
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {charts.depensesParCategorie.some(c => c.montant === null) ? (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        Répartition indisponible : montants en devises différentes (voir les totaux par devise)
                      </div>
                    ) : charts.depensesParCategorie.length > 0 ? (
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
                          <Tooltip formatter={(value) => [formatCamembert(charts.depensesParCategorie)(Number(value || 0)), '']} />
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
                    {groupeUnique === undefined ? null : groupeUnique === null ? (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        Graphique indisponible : montants en devises différentes (voir le compte de résultat)
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                          { module: 'Maraîchage', revenus: groupeUnique.revenusParModule.potager, depenses: groupeUnique.depensesParModule.potager },
                          { module: 'Verger', revenus: groupeUnique.revenusParModule.verger, depenses: groupeUnique.depensesParModule.verger },
                          { module: 'Élevage', revenus: groupeUnique.revenusParModule.elevage, depenses: groupeUnique.depensesParModule.elevage },
                          { module: 'Autre', revenus: groupeUnique.revenusParModule.autre, depenses: groupeUnique.depensesParModule.autre },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="module" />
                          <YAxis tickFormatter={(v) => formatEn(Number(v), groupeUnique.monnaie)} />
                          <Tooltip formatter={(value) => [formatEn(Number(value || 0), groupeUnique.monnaie), '']} />
                          <Legend />
                          <Bar dataKey="revenus" name="Revenus" fill="#22c55e" />
                          <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
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
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                    <Wallet className="h-6 w-6 text-blue-600" />
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
