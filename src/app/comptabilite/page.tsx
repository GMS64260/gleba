"use client"

/**
 * Dashboard Comptabilité
 * Vue financière agrégée de tous les modules
 */

import * as React from "react"
import { useDevise } from "@/hooks/use-devise"
import { formatMontantDevise } from "@/lib/format-utils"
import { deviseCommuneDesSeries, libellesTotauxParDevise } from "@/lib/comptabilite/totaux-devise"
import { chargerStatsComptables } from "@/lib/comptabilite/stats-client"
import type { Devise } from "@/lib/territoires"
import { PageEntete, ConteneurPage } from "@/components/shell/PageEntete"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AppHeader } from "@/components/shell/AppHeader"
import { TourComptabilite } from "@/components/tours/tour-comptabilite"
import { PremiersPasBanner } from "@/components/premiers-pas-banner"
import { computeYearDiff, libelleComparatifRevenus } from "@/lib/comptabilite/year-diff"
import { getAvailableYears } from "@/components/year-selector"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts"
import { ResponsiveContainer } from "@/components/ui/responsive-container"
import {
  ArrowRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Receipt,
  ShoppingCart,
  Download,
  FileText,
  AlertTriangle,
  Users,
  Truck,
  BarChart3,
  Hammer,
  Shield,
} from "lucide-react"
import { kpiCardClass, kpiSubtleClass } from "@/lib/kpi-theme"
import { liensAlertesCompta } from "@/lib/comptabilite/alertes"
// Modules du dashboard comptabilité (rationalisé)
const modulesCompta = [
  { title: "Banque", description: "Stripe, relevés et rapprochement", href: "/comptabilite/banque", icon: Wallet, color: "text-sky-700", bgColor: "bg-sky-50" },
  {
    title: "Transactions",
    description: "Revenus, dépenses, saisie",
    href: "/comptabilite/transactions",
    icon: Receipt,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Devis et facturation",
    description: "Devis, livraisons, factures et avoirs",
    href: "/comptabilite/factures",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Clients",
    description: "Gestion des clients",
    href: "/comptabilite/clients",
    icon: Users,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    title: "Fournisseurs",
    description: "Gestion des fournisseurs",
    href: "/comptabilite/fournisseurs",
    icon: Truck,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  {
    title: "Stocks",
    description: "Vue globale des stocks",
    href: "/comptabilite/stocks",
    icon: Package,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    title: "Rapports & TVA",
    description: "Bilan, TVA, export",
    href: "/comptabilite/rapports",
    icon: Download,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
  },
  {
    title: "Export FEC",
    description: "Fichier des Écritures Comptables",
    href: "/comptabilite/export",
    icon: FileText,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    title: "Coûts de production",
    description: "Rentabilité par culture",
    href: "/comptabilite/couts-production",
    icon: BarChart3,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    title: "Interventions",
    description: "Opérations terrain, temps, coûts",
    href: "/interventions",
    icon: Hammer,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    title: "Traçabilité",
    description: "Registres réglementaires",
    href: "/tracabilite",
    icon: Shield,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
]

const groupesCompta = [
  { title: "Au quotidien", description: "Saisir, facturer et suivre les règlements", hrefs: ["/comptabilite/transactions", "/comptabilite/factures", "/comptabilite/banque"] },
  { title: "Mes partenaires", description: "Retrouver rapidement clients et fournisseurs", hrefs: ["/comptabilite/clients", "/comptabilite/fournisseurs"] },
  { title: "Piloter et déclarer", description: "Comprendre les résultats, les stocks et préparer les exports", hrefs: ["/comptabilite/stocks", "/comptabilite/rapports", "/comptabilite/export", "/comptabilite/couts-production"] },
  { title: "Suivi terrain", description: "Relier les opérations aux coûts et aux registres", hrefs: ["/interventions", "/tracabilite"] },
]

/** Un total d'une devise (GET /api/comptabilite/stats, lot devise-totaux-api). */
type TotalDeviseApi = { monnaie: Devise | null; total: number; count?: number }

interface ComptaStats {
  stats: {
    // Totaux historiques : `null` dès que deux devises coexistent ; le voisin
    // `…ParDevise` porte alors un total par devise, jamais additionnés.
    revenus: number | null
    revenusParDevise?: TotalDeviseApi[]
    depenses: number | null
    depensesParDevise?: TotalDeviseApi[]
    benefice: number | null
    beneficeParDevise?: TotalDeviseApi[]
    margePercent: number | null
    revenusParModule: { potager: number | null; verger: number | null; elevage: number | null; autre: number | null }
    depensesParModule: { potager: number | null; verger: number | null; elevage: number | null; autre: number | null }
    // BUG #2 — sous-totaux non payés (info, pas exclusion)
    depensesNonPayees?: number | null
    depensesNonPayeesParDevise?: TotalDeviseApi[]
    nbDepensesNonPayees?: number
    revenusNonPayes?: number | null
    nbRevenusNonPayes?: number
    coherenceCheck?: {
      revenusSsot: number
      revenusSommeModules: number
      revenusEcart: number
      depensesSsot: number
      depensesSommeModules: number
      depensesEcart: number
    }
    // YTD vs YTD année dernière (cf. src/lib/kpi/compta.ts).
    revenusAnneePrecedente: number | null
    revenusAnneePrecedenteParDevise?: TotalDeviseApi[]
    revenusAnneePrecedenteTotal?: number | null
    depensesAnneePrecedente?: number | null
    depensesAnneePrecedenteParDevise?: TotalDeviseApi[]
    depensesAnneePrecedenteTotal?: number | null
    comparisonMode?: string
    facturesImpayees: number
    facturesImpayeesTotal: number | null
    facturesImpayeesDevise?: string | null
    facturesImpayeesParDevise?: { monnaie: string | null; montant: number }[]
    stocksBas: number
    // QA 2026-05-15 — Bug #5
    commandesEnAttente?: number
    commandesEnAttentePayees?: number
    commandesEnAttenteTotal?: number | null
    commandesEnAttenteTotalParDevise?: TotalDeviseApi[]
  }
  charts: {
    // `null` : l'exercice compte deux devises (voisins `…ParDevise`).
    mensuel: { mois: string; revenus: number | null; depenses: number | null; benefice: number | null }[]
    // `montant: null` : le graphique compte deux devises (lot devise-totaux-api).
    revenusParCategorie: { categorie: string; montant: number | null; montantParDevise?: TotalDeviseApi[]; couleur: string }[]
    depensesParCategorie: { categorie: string; montant: number | null; montantParDevise?: TotalDeviseApi[]; couleur: string }[]
    parModule: { module: string; revenus: number | null; revenusParDevise?: TotalDeviseApi[]; depenses: number | null; depensesParDevise?: TotalDeviseApi[]; benefice: number | null }[]
  }
  activity: {
    dernieresTransactions: {
      id: number
      type: "revenu" | "depense"
      date: string
      description: string
      montant: number
      module: string
      paye: boolean
    }[]
    facturesImpayees: {
      id: number
      type: string
      date: string
      client: string
      montant: number
    }[]
    alertesStock: {
      id: string
      nom: string
      stock: number
      stockMin: number
      module: string
    }[]
  }
  meta: {
    year: number
    generatedAt: string
  }
}

export default function DashboardComptabilite() {
  const devise = useDevise()
  const formatMontant = (value: number) => devise === null ? "—" : formatMontantDevise(value, devise)
  // Un total par devise, jamais additionnés ni réétiquetés (lot devise-totaux-api).
  // Une ligne par devise seulement quand il y en a plusieurs : un total unique
  // reste dans sa phrase (« 2 commandes (74,50 €) », « Dont 748,24 € non payés »).
  const totauxParDevise = (parDevise: TotalDeviseApi[] | undefined, total: number | null | undefined) =>
    (parDevise?.length
      ? libellesTotauxParDevise(parDevise.map(t => ({ monnaie: t.monnaie, montant: t.total })), devise)
      : [total == null ? "—" : formatMontant(total)]
    ).map((l, i, tous) => <span key={i} className={tous.length > 1 ? "block" : undefined}>{l}</span>)
  // Montant d'un total mono-devise : dans SA devise (une ferme passée en XPF
  // garde des totaux EUR), jamais réétiqueté dans la devise courante.
  const formatUnique = (parDevise: TotalDeviseApi[] | undefined, valeur: number) => {
    const seule = parDevise?.length === 1 ? parDevise[0].monnaie : undefined
    return seule === null ? "Devise historique inconnue" : seule ? formatMontantDevise(valeur, seule) : formatMontant(valeur)
  }
  const { data: session } = useSession()
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [data, setData] = React.useState<ComptaStats | null>(null)
  // Graphiques mono-devise : dans la devise des écritures de l'exercice (une
  // ferme passée en XPF peut n'avoir que des montants EUR cette année-là).
  const formatGraphique = (valeur: number) => {
    const monnaies = new Set([...(data?.stats.revenusParDevise ?? []), ...(data?.stats.depensesParDevise ?? [])]
      .filter(t => (t.count ?? 1) !== 0 || t.total !== 0).map(t => t.monnaie))
    const seule = monnaies.size === 1 ? [...monnaies][0] : null
    return monnaies.size === 1 ? (seule ? formatMontantDevise(valeur, seule) : "Devise historique inconnue") : formatMontant(valeur)
  }
  // Un camembert mono-devise s'affiche dans la devise de ses parts.
  const formatCamembert = (parts: { montantParDevise?: TotalDeviseApi[] }[]) => (valeur: number) => {
    const monnaies = new Set(parts.flatMap(p => (p.montantParDevise ?? []).map(t => t.monnaie)))
    const seule = monnaies.size === 1 ? [...monnaies][0] : null
    return monnaies.size === 1 ? (seule ? formatMontantDevise(valeur, seule) : "Devise historique inconnue") : formatGraphique(valeur)
  }
  // Résultat par module : barres de recettes et de charges tracées ensemble
  // seulement si TOUTES les séries partagent une devise (recettes XPF seules
  // et charges EUR seules ne se comparent pas) ; `null` : indisponible.
  const deviseParModule = data?.charts
    ? deviseCommuneDesSeries(data.charts.parModule.flatMap(m => [
        { valeur: m.revenus, parDevise: m.revenusParDevise },
        { valeur: m.depenses, parDevise: m.depensesParDevise },
      ]), devise)
    : null
  const formatParModule = (valeur: number) =>
    deviseParModule?.monnaie ? formatMontantDevise(valeur, deviseParModule.monnaie) : formatMontant(valeur)
  const [loading, setLoading] = React.useState(true)

  // QA cmsjiqtd1 / cmsjitp3x — l'année revenait à 2026 après reload : la page
  // ÉCRIVAIT `gleba_compta_year` à chaque changement (dont le montage) mais ne
  // le RELISAIT jamais, écrasant donc la préférence à chaque reload. On lit la
  // valeur stockée au montage (client-only, pour ne pas casser l'hydratation),
  // puis on ne persiste que les changements réels de l'utilisateur.
  // QA cmsoamukd — state et non ref : le fetch du montage attend l'hydratation
  // (sinon la salve « année par défaut » peut écraser celle de l'année choisie).
  const [yearHydrated, setYearHydrated] = React.useState(false)
  React.useEffect(() => {
    const stored = window.localStorage.getItem("gleba_compta_year")
    if (stored && /^\d{4}$/.test(stored)) {
      const y = parseInt(stored, 10)
      if (y !== selectedYear) setSelectedYear(y)
    }
    setYearHydrated(true)
    // Montage uniquement : lecture initiale de la préférence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  React.useEffect(() => {
    // Ne persiste qu'après la lecture initiale, sinon le fallback écrase la préférence.
    if (yearHydrated) window.localStorage.setItem("gleba_compta_year", String(selectedYear))
  }, [yearHydrated, selectedYear])

  // Années disponibles
  const currentYear = new Date().getFullYear()
  // QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4] (inclut
  // l'année à venir pour planification anticipée — était 2022-2026)
  const availableYears = getAvailableYears()

  // Charger les données
  React.useEffect(() => {
    let actif = true
    const fetchData = async () => {
      setLoading(true)
      setData(null)
      try {
        // Contrat devise garanti, y compris dans le dépôt public (stats-client.ts).
        const json = await chargerStatsComptables<ComptaStats>(selectedYear)
        if (actif) setData(json)
      } catch (err) {
        console.error("Erreur chargement stats compta:", err)
      } finally {
        if (actif) setLoading(false)
      }
    }

    if (session?.user && yearHydrated) {
      fetchData()
    }
    return () => { actif = false }
  }, [selectedYear, session?.user, yearHydrated])

  // QA Camille 2026-05-15 — Bug #6 : le seuil "N-1 ≥ 100 €" cachait les
  // comparatifs légitimes (N-1 = 0 € et N > 0 → la carte disait
  // "indisponible" alors qu'il aurait fallu "Nouveau"). On expose 3
  // états :
  //   * "compare"  : N-1 > 0 → pourcentage classique
  //   * "nouveau"  : N-1 = 0 et N > 0  → première année avec activité
  //   * "vide"     : N-1 = 0 et N = 0  → aucune activité ni en N ni N-1
  const yearDiff = React.useMemo(() => computeYearDiff(data?.stats), [data?.stats])

  const liensAlertes = liensAlertesCompta(selectedYear)

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <AppHeader current="comptabilite" />
      <PageEntete id="comptabilite" actions={<div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Link href="/comptabilite/transactions">Nouvelle transaction</Link>
            </Button>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]" aria-label="Année affichée">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
            </Select>
          </div>} />

      {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Comptabilité */}
      <TourComptabilite />
      <ConteneurPage className="py-6">
        <div className="mb-6">
          <PremiersPasBanner module="comptabilite" />
        </div>
        {/* Titre + Sélecteur d'annee */}


        {/* Stats Cards */}
        <div className="grid gap-4 lg:grid-cols-4 mb-6">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="bg-gradient-to-br from-slate-100 to-slate-200">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))
          ) : data?.stats ? (
            <>
              <Card className={kpiCardClass("revenu")}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm font-medium ${kpiSubtleClass("revenu")} flex items-center gap-2`}>
                    <TrendingUp className="h-4 w-4" />
                    Revenus {selectedYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totauxParDevise(data.stats.revenusParDevise, data.stats.revenus)}</p>
                  {/* Libellés : libelleComparatifRevenus (src/lib/comptabilite/year-diff.ts),
                      chacun porte sur N-1 (ticket cmv290vir). */}
                  {yearDiff.state === "vide" ? (
                    <p className={`text-[10px] ${kpiSubtleClass("revenu")} italic mt-1`}>
                      {libelleComparatifRevenus(yearDiff, selectedYear, n => {
                        const monnaie = data.stats.depensesAnneePrecedenteParDevise?.find(t => t.total !== 0)?.monnaie
                        return monnaie ? formatMontantDevise(n, monnaie) : formatMontant(n)
                      })}
                    </p>
                  ) : (
                    <p className={`text-sm ${kpiSubtleClass("revenu")} mt-1`}>
                      {libelleComparatifRevenus(yearDiff, selectedYear, n => {
                        const monnaie = data.stats.depensesAnneePrecedenteParDevise?.find(t => t.total !== 0)?.monnaie
                        return monnaie ? formatMontantDevise(n, monnaie) : formatMontant(n)
                      })}
                    </p>
                  )}
                  {yearDiff.state === "compare" && selectedYear === currentYear && (
                    // Exercice en cours : N-1 est lu jusqu'au même jour
                    // (src/lib/kpi/compta.ts) ; un exercice passé se compare entier.
                    <p className={`text-[10px] ${kpiSubtleClass("revenu")} opacity-90`}>
                      (à date, comparé au même jour de {selectedYear - 1})
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className={kpiCardClass("depense")}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm font-medium ${kpiSubtleClass("depense")} flex items-center gap-2`}>
                    <TrendingDown className="h-4 w-4" />
                    Dépenses {selectedYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totauxParDevise(data.stats.depensesParDevise, data.stats.depenses)}</p>
                  {/* BUG #2 (audit compta 2026-05-15) — Charges engagées non
                      encore payées : info au comptable sur la trésorerie qui
                      sortira encore, sans masquer la charge (compta engagement). */}
                  {(data.stats.depensesNonPayeesParDevise ?? []).some(t => t.total > 0) || (data.stats.depensesNonPayees ?? 0) > 0 ? (
                    <p className={`text-[10px] ${kpiSubtleClass("depense")} mt-1`}>
                      Dont {totauxParDevise(data.stats.depensesNonPayeesParDevise?.filter(t => t.total > 0), data.stats.depensesNonPayees)} non encore payé(s)
                      {data.stats.nbDepensesNonPayees ? ` · ${data.stats.nbDepensesNonPayees} ligne(s)` : ''}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className={kpiCardClass((data.stats.benefice ?? 0) >= 0 ? "revenu" : "depense")}>
                <CardHeader className="pb-2">
                  {/* Ancien texte blanc sur carte saturée : invisible depuis les cartes à plat (kpi-theme). */}
                  <CardTitle className={`text-sm font-medium ${kpiSubtleClass((data.stats.benefice ?? 0) >= 0 ? "revenu" : "depense")} flex items-center gap-2`}>
                    <Wallet className="h-4 w-4" />
                    {data.stats.benefice === null ? 'Résultat par devise' : data.stats.benefice >= 0 ? 'Bénéfice' : 'Perte'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {data.stats.benefice === null
                      ? totauxParDevise(data.stats.beneficeParDevise, null)
                      : formatUnique(data.stats.beneficeParDevise, Math.abs(data.stats.benefice))}
                  </p>
                </CardContent>
              </Card>

              <Card className={kpiCardClass((data.stats.margePercent ?? 0) >= 0 ? "revenu" : "depense")}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm font-medium ${kpiSubtleClass((data.stats.margePercent ?? 0) >= 0 ? "revenu" : "depense")} flex items-center gap-2`}>
                    Marge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold" title={data.stats.margePercent === null ? "Marge indisponible : montants en devises différentes" : "Marge nette en %"}>
                    {data.stats.margePercent === null ? '—' : `${data.stats.margePercent}%`}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Alertes */}
        {data?.stats && (data.stats.facturesImpayees > 0 || data.stats.stocksBas > 0 || (data.stats.commandesEnAttente ?? 0) > 0) && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {data.stats.facturesImpayees > 0 && (
              <Link href={liensAlertes.creances} aria-label="Voir les créances impayées" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <Card className="h-full border-amber-200 bg-amber-50 transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {/* QA cmswu9r5x — créances (factures, ventes, commandes
                        boutique), pas seulement des factures. */}
                    Créances impayées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-800">
                    {data.stats.facturesImpayees} créance(s) en attente
                  </p>
                  <div className="mt-1 space-y-1 text-amber-800">
                    {data.stats.facturesImpayeesParDevise?.length ? data.stats.facturesImpayeesParDevise.map(({ monnaie, montant }) => (
                      <p key={monnaie ?? 'chargement'} className="break-words">
                        {monnaie === 'EUR' || monnaie === 'XPF'
                          ? formatMontantDevise(montant, monnaie)
                          : monnaie === null ? '—'
                            : 'Total indisponible : devise historique inconnue pour certaines créances.'}
                      </p>
                    )) : <p>{data.stats.facturesImpayeesDevise === 'EUR' || data.stats.facturesImpayeesDevise === 'XPF'
                      ? formatMontantDevise(data.stats.facturesImpayeesTotal ?? 0, data.stats.facturesImpayeesDevise)
                      : 'Total indisponible : devise historique inconnue pour certaines créances.'}</p>}
                  </div>
                <p className="mt-2 flex items-center gap-1 text-sm font-medium text-amber-800 group-hover:underline">Voir les créances<ArrowRight className="h-4 w-4" /></p>
                </CardContent>
              </Card>
              </Link>
            )}
            {(data.stats.commandesEnAttente ?? 0) > 0 && (
              // QA 2026-05-15 — Bug #5 : compteur des commandes boutique
              // pas encore livrées (donc pas encore en compta). Permet
              // de réconcilier "Boutique 14 cmds = Compta 11 cmds + 3
              // en attente".
              <Link href={liensAlertes.commandes} aria-label="Voir les commandes boutique en attente" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <Card className="h-full border-blue-200 bg-blue-50 transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Commandes boutique en attente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-blue-800">
                    {data.stats.commandesEnAttente} commande(s) ({totauxParDevise(data.stats.commandesEnAttenteTotalParDevise, data.stats.commandesEnAttenteTotal)})
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {(data.stats.commandesEnAttentePayees ?? 0) > 0
                      ? `Statut Nouveau / Confirmée / Prête. ${data.stats.commandesEnAttentePayees} déjà payée(s) : leur recette est déjà comptabilisée. Les autres le seront au paiement ou à la livraison.`
                      : 'Statut Nouveau / Confirmée / Prête — sera comptabilisé au paiement ou, à défaut, à la livraison.'}
                  </p>
                <p className="mt-2 flex items-center gap-1 text-sm font-medium text-blue-800 group-hover:underline">Voir les commandes<ArrowRight className="h-4 w-4" /></p>
                </CardContent>
              </Card>
              </Link>
            )}
            {data.stats.stocksBas > 0 && (
              <Link href={liensAlertes.stocks} aria-label="Voir les stocks bas" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <Card className="h-full border-orange-200 bg-orange-50 transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Stocks bas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-orange-800">{data.stats.stocksBas} article(s) en dessous du seuil minimum</p>
                <p className="mt-2 flex items-center gap-1 text-sm font-medium text-orange-800 group-hover:underline">Voir les articles<ArrowRight className="h-4 w-4" /></p>
                </CardContent>
              </Card>
              </Link>
            )}
          </div>
        )}

        {/* Entrées organisées selon le chemin utilisateur, pas selon la structure technique. */}
        <div className="grid gap-4 lg:grid-cols-2 mb-8">
          {groupesCompta.map((groupe) => (
            <Card key={groupe.title}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{groupe.title}</CardTitle>
                <CardDescription>{groupe.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {modulesCompta.filter((module) => groupe.hrefs.includes(module.href)).map((module) => (
                  <Link key={module.href} href={module.href} className="group flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/50">
                    <div className={`h-9 w-9 shrink-0 rounded-lg ${module.bgColor} flex items-center justify-center`}>
                      <module.icon className={`h-4 w-4 ${module.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{module.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{module.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        {data?.charts && (
          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* P&L Mensuel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résultat mensuel</CardTitle>
              </CardHeader>
              <CardContent>
                {data.charts.mensuel.some(m => m.revenus === null || m.depenses === null) ? (
                  <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                    Graphique indisponible : montants en devises différentes (voir les totaux par devise)
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.charts.mensuel}>
                    <defs>
                      <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatGraphique(Number(v))} />
                    <Tooltip
                      formatter={(value) => [formatGraphique(Number(value || 0)), '']}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Area type="monotone" dataKey="revenus" name="Revenus" stroke="#22c55e" fill="url(#colorRevenus)" />
                    <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" fill="url(#colorDepenses)" />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Revenus par categorie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenus par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {data.charts.revenusParCategorie.some(c => c.montant === null) ? (
                  <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                    Répartition indisponible : revenus en devises différentes (voir les totaux par devise)
                  </div>
                ) : data.charts.revenusParCategorie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={data.charts.revenusParCategorie}
                        dataKey="montant"
                        nameKey="categorie"
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        label={({ percent }) => ((percent || 0) >= 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : '')}
                        labelLine={false}
                      >
                        {data.charts.revenusParCategorie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.couleur} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatCamembert(data.charts.revenusParCategorie)(Number(value || 0)), '']} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Aucun revenu enregistré
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dépenses par categorie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {data.charts.depensesParCategorie.some(c => c.montant === null) ? (
                  <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                    Répartition indisponible : dépenses en devises différentes (voir les totaux par devise)
                  </div>
                ) : data.charts.depensesParCategorie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={data.charts.depensesParCategorie}
                        dataKey="montant"
                        nameKey="categorie"
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        label={({ percent }) => ((percent || 0) >= 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : '')}
                        labelLine={false}
                      >
                        {data.charts.depensesParCategorie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.couleur} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatCamembert(data.charts.depensesParCategorie)(Number(value || 0)), '']} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Aucune dépense enregistrée
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparaison par module */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résultat par module</CardTitle>
              </CardHeader>
              <CardContent>
                {deviseParModule === null || data.charts.parModule.some(m => m.revenus === null || m.depenses === null) ? (
                  <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                    Graphique indisponible : montants en devises différentes (voir les totaux par devise)
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.parModule} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatParModule(Number(v))} />
                    <YAxis dataKey="module" type="category" tick={{ fontSize: 12 }} width={70} />
                    <Tooltip formatter={(value) => [formatParModule(Number(value || 0)), '']} />
                    <Bar dataKey="revenus" name="Revenus" fill="#22c55e" />
                    <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </ConteneurPage>
    </div>
  )
}
