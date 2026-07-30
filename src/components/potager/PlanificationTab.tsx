"use client"

/**
 * Onglet Planification - Hub de planification + ITPs + Stocks
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import {
  Leaf,
  Map,
  LayoutGrid,
  BarChart3,
  CalendarRange,
  Users,
  FileStack,
  Sprout,
  Package,
  Route,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/tables/DataTable"
import { useToast } from "@/hooks/use-toast"
import { updateDashboardSearchParams } from "@/lib/dashboard-navigation"
import { ZONE_CLIMAT_LABEL } from "@/lib/terroir"

// ============================================================
// Types
// ============================================================

interface Stats {
  totalCultures: number
  culturesExistantes: number
  culturesACreer: number
  // surfaceTotale = surface planifiée (alimentée par getKpiMaraichage SSOT).
  surfaceTotale: number
  surfaceCultivee?: number
  surfacePlanifiee?: number
  recoltesTotales: number
  // BUG-feedback (Marc 2026-05-16) : champs unifiés avec
  // /api/planification/recoltes-prevues et le Calendrier.
  recoltesRealiseesKg?: number
  recoltesProjectionKg?: number
  recoltesTotalAttenduKg?: number
  nbEspeces: number
  nbVarietes?: number
  nbEspecesAvecVariete?: number
  annee: number
}

interface ITPWithRelations {
  id: string
  nom: string | null
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  semaineImplantationDebut: number | null
  semaineImplantationFin: number | null
  semaineRecolteFin: number | null
  dureePepiniere: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  notes: string | null
  typePlanche: string | null
  implantation: string | null
  forcage: boolean | null
  zoneClimat: string | null
  sourceReference: string | null
  sourceUrl: string | null
  statutValidation: string
  espece: {
    id: string
    nom: string | null
    couleur: string | null
    famille: { id: string; couleur: string | null } | null
  } | null
  _count: { cultures: number; rotationsDetails: number }
}

// ============================================================
// Sous-onglets planification
// ============================================================

const planifGroups = [
  {
    title: "Construire mon plan",
    description: "Choisir les cultures et les répartir dans l’espace.",
    tone: "emerald",
    items: [
      { title: "Cultures par espèce", description: "Voir ce qui est prévu", href: "/maraichage/planification/cultures-prevues", icon: Leaf },
      { title: "Répartition par îlots", description: "Organiser les grandes zones", href: "/maraichage/planification/cultures-prevues/par-ilots", icon: Map },
      { title: "Répartition par planches", description: "Affecter chaque emplacement", href: "/maraichage/planification/cultures-prevues/par-planches", icon: LayoutGrid },
      { title: "Associations", description: "Vérifier les compatibilités", href: "/maraichage/planification/associations", icon: Users },
    ],
  },
  {
    title: "Préparer la mise en culture",
    description: "Transformer le plan en besoins concrets.",
    tone: "amber",
    items: [
      { title: "Créer les cultures", description: "Générer les cultures planifiées", href: "/maraichage/planification/creer-cultures", icon: FileStack },
      { title: "Semences nécessaires", description: "Calculer les quantités à prévoir", href: "/maraichage/planification/semences", icon: Sprout },
      { title: "Plants nécessaires", description: "Préparer les plants à produire ou acheter", href: "/maraichage/planification/plants", icon: Package },
    ],
  },
  {
    title: "Suivre la saison",
    description: "Lire la charge et les récoltes dans le temps.",
    tone: "violet",
    items: [
      { title: "Récoltes par mois", description: "Vision globale de la saison", href: "/maraichage/planification/recoltes-prevues", icon: BarChart3 },
      { title: "Récoltes par semaine", description: "Anticiper la charge opérationnelle", href: "/maraichage/planification/recoltes-prevues/par-semaines", icon: CalendarRange },
    ],
  },
]

interface PlanificationTabProps {
  year: number
}

const SUB_TABS = ["planification", "itps", "stocks"]

export function PlanificationTab({ year }: PlanificationTabProps) {
  const searchParams = useSearchParams()

  // Palier 2 (unification onglets) : le sous-onglet vit dans l'URL (?sub=),
  // le paramètre ?tab=planification étant déjà pris par l'onglet de module.
  const subParam = searchParams.get("sub")
  const activeSub = subParam && SUB_TABS.includes(subParam) ? subParam : "planification"
  const handleSubChange = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "planification") {
        params.delete("sub")
      } else {
        params.set("sub", value)
      }
      // replace : changer de sous-onglet ne doit pas empiler l'historique
      updateDashboardSearchParams(params, "replace")
    },
    [searchParams]
  )

  return (
    <Tabs value={activeSub} onValueChange={handleSubChange} className="space-y-4">
      <div className="sm:hidden">
        <Select value={activeSub} onValueChange={handleSubChange}>
          <SelectTrigger className="h-10 w-full bg-white font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planification">Organiser la saison</SelectItem>
            <SelectItem value="itps">Itinéraires techniques (ITP)</SelectItem>
            <SelectItem value="stocks">Stocks et approvisionnements</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TabsList className="hidden sm:inline-flex">
        <TabsTrigger value="planification" className="flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Organiser la saison
        </TabsTrigger>
        <TabsTrigger value="itps" className="flex items-center gap-1.5">
          <Route className="h-4 w-4" />
          Itinéraires techniques
        </TabsTrigger>
        <TabsTrigger value="stocks" className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Stocks
        </TabsTrigger>
      </TabsList>

      <TabsContent value="planification">
        <PlanificationSubTab year={year} />
      </TabsContent>
      <TabsContent value="itps">
        <ItpsSubTab />
      </TabsContent>
      <TabsContent value="stocks">
        <StocksSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Planification hub
// ============================================================

function PlanificationSubTab({ year }: { year: number }) {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/planification/stats?annee=${year}`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [year])

  return (
    <div className="space-y-6">
      {/* Entrée orientée tâche : l'utilisateur comprend immédiatement l'état
          de sa saison et la prochaine action utile. */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white shadow-sm">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Saison {year}</Badge>
              {!isLoading && stats?.culturesACreer === 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" /> Plan prêt à utiliser
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Organiser ma saison</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-100">
              Construisez votre plan, préparez les semences et les plants, puis suivez la production attendue au fil de l’année.
            </p>
          </div>
          <Link
            href={`${stats?.culturesACreer ? "/maraichage/planification/creer-cultures" : "/maraichage/planification/cultures-prevues"}?annee=${year}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
          >
            <ClipboardList className="h-4 w-4" />
            {stats?.culturesACreer ? `Créer ${stats.culturesACreer} culture${stats.culturesACreer > 1 ? "s" : ""}` : "Consulter mon plan"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Parcours en trois intentions, au lieu de neuf cartes concurrentes. */}
      <div className="space-y-5">
        {planifGroups.map((group, groupIndex) => {
          const toneClasses = group.tone === "emerald"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : group.tone === "amber"
              ? "bg-amber-50 text-amber-700 border-amber-100"
              : "bg-violet-50 text-violet-700 border-violet-100"
          return (
            <section key={group.title} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${toneClasses}`}>{groupIndex + 1}</span>
                <div>
                  <h3 className="font-semibold text-slate-950">{group.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={`${item.href}?annee=${year}`}
                    className="group flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClasses}`}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// ITPs
// ============================================================


const itpColumns: ColumnDef<ITPWithRelations>[] = [
  {
    accessorKey: "id",
    header: "ITP",
    cell: ({ row }) => {
      const itp = row.original
      const couleur = itp.espece?.couleur || itp.espece?.famille?.couleur || "#888888"
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
          <span className="font-medium">{itp.nom ?? itp.id}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "espece.id",
    header: "Espèce",
    cell: ({ row }) => row.original.espece?.nom ?? row.original.espece?.id ?? "-",
  },
  {
    id: "implantationWindow",
    header: "Implantation",
    cell: ({ row }) => {
      const itp = row.original
      const debut = itp.semaineImplantationDebut ?? itp.semainePlantation ?? itp.semaineSemis
      const fin = itp.semaineImplantationFin
      return (
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {fin ? `S${debut}–S${fin}` : formatSemaine(debut)}
          </Badge>
          <p className="text-[11px] text-muted-foreground">
            {itp.implantation ?? (itp.semainePlantation ? "Plantation" : "Semis")}
            {itp.forcage ? " · forcé" : ""}
          </p>
        </div>
      )
    },
  },
  {
    id: "harvestWindow",
    header: "Récolte",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {row.original.semaineRecolteFin
          ? `S${row.original.semaineRecolte}–S${row.original.semaineRecolteFin}`
          : formatSemaine(row.original.semaineRecolte)}
      </Badge>
    ),
  },
  {
    accessorKey: "typePlanche",
    header: "Conduite",
    cell: ({ row }) => (
      <div className="text-xs">
        <span>{row.original.typePlanche ?? "Non précisée"}</span>
        {row.original.zoneClimat && (
          <p className="mt-1 text-muted-foreground">
            {ZONE_CLIMAT_LABEL[row.original.zoneClimat as keyof typeof ZONE_CLIMAT_LABEL] ??
              row.original.zoneClimat}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "statutValidation",
    header: "Qualité",
    cell: ({ row }) =>
      row.original.statutValidation === "source_documentee" ? (
        <div className="space-y-1">
          <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <ShieldCheck className="h-3 w-3" />
            Sourcé
          </Badge>
          {row.original.sourceUrl && (
            <a
              href={row.original.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-emerald-700 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              INRAE <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : row.original.statutValidation === "personnel" ? (
        <Badge variant="outline">Personnel</Badge>
      ) : (
        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          À confirmer
        </Badge>
      ),
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
]

function ItpsSubTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<ITPWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [qualityFilter, setQualityFilter] = React.useState("all")
  const [plancheFilter, setPlancheFilter] = React.useState("all")

  const [loadError, setLoadError] = React.useState<string | null>(null)
  // Bug feedback testeur 2026-05-26 (cmplonap8) — "Failed to fetch"
  // intermittent au premier clic sur l'onglet ITPs. Souvent une race
  // navigateur (TypeError) plutôt qu'une erreur serveur. On ajoute un
  // retry automatique transparent pour ne pas exposer ce flake à l'user.
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const attempt = async (retriesLeft: number): Promise<void> => {
      try {
        const response = await fetch("/api/itps?pageSize=1000&applicable=1&calibre=1", { cache: "no-store" })
        if (!response.ok) {
          // Feedback Marc 2026-05-16 — Bug 13 : on récupère le détail
          // d'erreur retourné par l'API pour ne pas afficher un toast
          // générique qui contredit l'état "Aucun ITP trouvé." du DataTable.
          let msg = `Erreur ${response.status}`
          try {
            const errJson = await response.json()
            if (errJson?.error) msg = String(errJson.error)
          } catch { /* ignore */ }
          throw new Error(msg)
        }
        const result = await response.json()
        const rows = (Array.isArray(result) ? result : result.data || []) as ITPWithRelations[]
        const qualityRank: Record<string, number> = {
          source_documentee: 0,
          personnel: 1,
          a_revoir: 2,
        }
        setData(
          [...rows].sort(
            (a, b) =>
              (qualityRank[a.statutValidation] ?? 9) - (qualityRank[b.statutValidation] ?? 9) ||
              (a.espece?.nom ?? a.especeId ?? "").localeCompare(
                b.espece?.nom ?? b.especeId ?? "",
                "fr"
              ) ||
              (a.semaineImplantationDebut ?? a.semaineSemis ?? 99) -
                (b.semaineImplantationDebut ?? b.semaineSemis ?? 99)
          )
        )
      } catch (err) {
        const isNetworkErr =
          err instanceof TypeError ||
          (err instanceof Error && /Failed to fetch|NetworkError/i.test(err.message))
        if (isNetworkErr && retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, 400))
          return attempt(retriesLeft - 1)
        }
        const message = err instanceof Error ? err.message : "Impossible de charger les ITPs"
        setLoadError(message)
        toast({ variant: "destructive", title: "Erreur", description: message })
      }
    }
    try {
      await attempt(1)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredData = React.useMemo(
    () =>
      data.filter((itp) => {
        if (qualityFilter !== "all" && itp.statutValidation !== qualityFilter) return false
        if (plancheFilter !== "all" && itp.typePlanche !== plancheFilter) return false
        return true
      }),
    [data, qualityFilter, plancheFilter]
  )

  const documentedCount = data.filter(
    (itp) => itp.statutValidation === "source_documentee"
  ).length

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Itinéraires techniques contextualisés</p>
            {/* QA 2026-07-30 — « 525 scénarios documentés » se lisait comme le
                total de la table, qui en affiche 647 : les deux compteurs
                paraissaient se contredire alors qu'ils mesurent des périmètres
                différents. On annonce désormais le rapport. */}
            <p className="mt-1 max-w-3xl text-emerald-800">
              {documentedCount} des {data.length} itinéraires reposent sur une source documentée,
              indiquant une vraie fenêtre d&apos;implantation et de récolte ; les autres restent
              listés dans le tableau. Les dates sont recalées depuis le climat de la source vers
              celui de votre exploitation.
            </p>
          </div>
          <Link
            href="/maraichage/itps/calendrier"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          >
            <CalendarRange className="h-4 w-4" />
            Voir le calendrier
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={qualityFilter} onValueChange={setQualityFilter}>
          <SelectTrigger className="w-full bg-white sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les qualités</SelectItem>
            <SelectItem value="source_documentee">Documentés par une source</SelectItem>
            <SelectItem value="a_revoir">Repères à confirmer</SelectItem>
            <SelectItem value="personnel">Mes itinéraires</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plancheFilter} onValueChange={setPlancheFilter}>
          <SelectTrigger className="w-full bg-white sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes conduites</SelectItem>
            <SelectItem value="Plein champ">Plein champ</SelectItem>
            <SelectItem value="Sous abri">Sous abri</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loadError && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={fetchData}
            className="text-xs underline hover:no-underline"
          >
            Réessayer
          </button>
        </div>
      )}
      <DataTable
        columns={itpColumns}
        data={filteredData}
        isLoading={isLoading}
        pageSize={25}
        onAdd={() => router.push("/maraichage/itps/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/maraichage/itps/${encodeURIComponent(row.id)}`)}
        onRowEdit={(row) => router.push(`/maraichage/itps/${encodeURIComponent(row.id)}`)}
        searchPlaceholder="Rechercher un ITP..."
        emptyMessage={loadError ? "Erreur lors du chargement — cliquez sur Réessayer." : "Aucun ITP trouvé."}
      />
    </div>
  )
}

// ============================================================
// Stocks (lien vers la page dédiée)
// ============================================================

function StocksSubTab() {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 text-sm text-violet-800">
        <p className="font-medium">Gestion des stocks</p>
        <p className="mt-1 text-violet-700">
          Gérez vos inventaires de semences, plants et fertilisants.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/maraichage/stocks">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Package className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Stocks complets</CardTitle>
                  <CardDescription className="text-xs">Semences, plants, fertilisants</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/maraichage/recoltes">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Suivi récoltes</CardTitle>
                  <CardDescription className="text-xs">Production, ventes, pertes</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/maraichage/cultures/irriguer">
          <Card className="hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <Sprout className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Irrigation</CardTitle>
                  <CardDescription className="text-xs">Cultures à irriguer</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
