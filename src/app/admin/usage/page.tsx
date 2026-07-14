"use client"

/**
 * Page Admin - Activité par utilisateur dans le temps
 * Courbes de jours actifs par période + classement des utilisateurs les
 * plus actifs (compte démo et comptes admin exclus, contenu d'exemple
 * de l'inscription non compté).
 */

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  TrendingUp,
  Shield,
  Loader2,
  Trophy,
  Users,
  CalendarCheck,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react"

interface RankUser {
  id: string
  email: string
  name: string | null
  active: boolean
  createdAt: string
  activeDaysTotal: number
  activeDaysInWindow: number
  lastActivity: string | null
  contentTotal: number
}

interface SeriesUser {
  id: string
  email: string
  name: string | null
  values: number[]
}

interface UsageData {
  range: { days: number; bucket: string; start: string }
  excluded: { demo: boolean; adminCount: number }
  totalRealUsers: number
  ranking: RankUser[]
  series: { buckets: string[]; users: SeriesUser[] }
}

type SortKey =
  | "default"
  | "user"
  | "activeDaysInWindow"
  | "activeDaysTotal"
  | "contentTotal"
  | "lastActivity"
  | "createdAt"

const PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
  "#0d9488", "#be123c", "#a16207", "#9333ea", "#0284c7",
  "#15803d", "#b91c1c", "#c2410c", "#6d28d9", "#1d4ed8",
]

const DAYS_OPTIONS = [
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
  { value: 180, label: "6 mois" },
  { value: 365, label: "1 an" },
]
const BUCKET_OPTIONS = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
]
const TOP_OPTIONS = [5, 8, 12, 20]

function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** Dates pures (jours actifs) : à formater en UTC pour ne pas glisser d'un jour */
function fmtDay(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })
}

function fmtBucketLabel(iso: string, bucket: string) {
  const d = new Date(iso + "T00:00:00Z")
  if (bucket === "month") {
    return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" })
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
}

function userLabel(u: { name: string | null; email: string }) {
  return u.name || u.email.split("@")[0]
}

export default function AdminUsagePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [days, setDays] = React.useState(90)
  const [bucket, setBucket] = React.useState("week")
  const [top, setTop] = React.useState(8)
  const [data, setData] = React.useState<UsageData | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Tri + recherche du tableau
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("default")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")

  const handleSort = React.useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"))
        return key
      }
      // Nouveau tri : texte = asc par défaut, reste = desc
      setSortDir(key === "user" ? "asc" : "desc")
      return key
    })
  }, [])

  React.useEffect(() => {
    if (status === "loading") return
    if (!session?.user || session.user.role !== "ADMIN") {
      router.push("/")
    }
  }, [session, status, router])

  React.useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      days: String(days),
      bucket,
      top: String(top),
    })
    fetch(`/api/admin/usage?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [days, bucket, top])

  // Transforme les séries en données recharts : [{ bucket, <id>: n, ... }]
  const chartData = React.useMemo(() => {
    if (!data) return []
    return data.series.buckets.map((b, i) => {
      const row: Record<string, string | number> = {
        bucket: fmtBucketLabel(b, data.range.bucket),
      }
      for (const u of data.series.users) row[u.id] = u.values[i] ?? 0
      return row
    })
  }, [data])

  const hasSeriesData = React.useMemo(
    () => data?.series.users.some((u) => u.values.some((v) => v > 0)) ?? false,
    [data]
  )

  // Tableau filtré (recherche) puis trié (colonne cliquée)
  const visibleRanking = React.useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    let rows = data.ranking
    if (q) {
      rows = rows.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name?.toLowerCase().includes(q) ?? false)
      )
    }
    if (sortKey === "default") return rows
    const dir = sortDir === "asc" ? 1 : -1
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "user":
          cmp = userLabel(a).localeCompare(userLabel(b), "fr", { sensitivity: "base" })
          break
        case "lastActivity":
        case "createdAt": {
          const av = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0
          const bv = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0
          cmp = av - bv
          break
        }
        default:
          cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return cmp * dir
    })
    return sorted
  }, [data, search, sortKey, sortDir])

  const bucketLabel = bucket === "day" ? "jour" : bucket === "week" ? "semaine" : "mois"

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-amber-600" />
            <h1 className="text-2xl font-bold text-amber-800">Activité des comptes</h1>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              Retour admin
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filtres */}
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center gap-6">
            <FilterGroup label="Période">
              {DAYS_OPTIONS.map((o) => (
                <ToggleBtn key={o.value} active={days === o.value} onClick={() => setDays(o.value)}>
                  {o.label}
                </ToggleBtn>
              ))}
            </FilterGroup>
            <FilterGroup label="Granularité">
              {BUCKET_OPTIONS.map((o) => (
                <ToggleBtn key={o.value} active={bucket === o.value} onClick={() => setBucket(o.value)}>
                  {o.label}
                </ToggleBtn>
              ))}
            </FilterGroup>
            <FilterGroup label="Courbes (top)">
              {TOP_OPTIONS.map((o) => (
                <ToggleBtn key={o} active={top === o} onClick={() => setTop(o)}>
                  {o}
                </ToggleBtn>
              ))}
            </FilterGroup>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Impossible de charger les métriques d&apos;activité
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Résumé */}
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                icon={<Users className="h-5 w-5 text-amber-600" />}
                label="Vrais utilisateurs"
                value={data.totalRealUsers}
                hint="hors démo & admins"
              />
              <SummaryCard
                icon={<Shield className="h-5 w-5 text-slate-500" />}
                label="Comptes exclus"
                value={data.excluded.adminCount + (data.excluded.demo ? 1 : 0)}
                hint={`${data.excluded.adminCount} admin${data.excluded.adminCount > 1 ? "s" : ""}${
                  data.excluded.demo ? " + démo" : ""
                }`}
              />
              <SummaryCard
                icon={<CalendarCheck className="h-5 w-5 text-green-600" />}
                label="Actifs sur la période"
                value={data.ranking.filter((u) => u.activeDaysInWindow > 0).length}
                hint={`au moins 1 jour actif sur ${data.range.days}j`}
              />
            </div>

            {/* Graphique */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  Jours actifs par {bucketLabel}
                </CardTitle>
                <CardDescription>
                  Un jour est « actif » dès que l&apos;utilisateur a utilisé l&apos;app ce jour-là
                  (visite ou action). Une courbe par utilisateur (top {top} sur la période).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!hasSeriesData ? (
                  <div className="h-[360px] flex items-center justify-center text-muted-foreground">
                    Aucune activité enregistrée sur cette période
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {data.series.users.map((u, i) => (
                        <Line
                          key={u.id}
                          type="monotone"
                          dataKey={u.id}
                          name={userLabel(u)}
                          stroke={PALETTE[i % PALETTE.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Classement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-600" />
                  Top utilisateurs
                </CardTitle>
                <CardDescription>
                  Classés par jours actifs sur la période. Le contenu créé ne compte pas
                  les données d&apos;exemple de l&apos;inscription.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Recherche */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher par email ou nom..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {data.ranking.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun utilisateur</p>
                ) : visibleRanking.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun utilisateur ne correspond à « {search} »
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">#</TableHead>
                          <SortHead label="Utilisateur" col="user" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                          <SortHead label={`Jours actifs (${data.range.days}j)`} col="activeDaysInWindow" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                          <SortHead label="Jours actifs (total)" col="activeDaysTotal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                          <SortHead label="Contenu créé" col="contentTotal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                          <SortHead label="Dernière activité" col="lastActivity" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                          <SortHead label="Inscrit le" col="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRanking.map((u, i) => (
                          <TableRow key={u.id} className={i < 3 ? "bg-amber-50/40" : undefined}>
                            <TableCell className="font-semibold text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/admin/users/${u.id}`}
                                className="font-medium hover:underline"
                              >
                                {u.name || u.email}
                              </Link>
                              <div className="flex items-center gap-2">
                                {u.name && (
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {u.email}
                                  </span>
                                )}
                                {!u.active && (
                                  <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
                                    inactif
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {u.activeDaysInWindow}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {u.activeDaysTotal}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {u.contentTotal}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {fmtDay(u.lastActivity)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {fmtDate(u.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

function SortHead({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
  align?: "left" | "right"
}) {
  const activeSort = sortKey === col
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 select-none hover:text-amber-700 transition-colors ${
          align === "right" ? "flex-row-reverse" : ""
        } ${activeSort ? "text-amber-700 font-semibold" : ""}`}
      >
        <span className="whitespace-nowrap">{label}</span>
        {activeSort ? (
          sortDir === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label} :</span>
      <div className="flex gap-1">{children}</div>
    </div>
  )
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={active ? "bg-amber-600 hover:bg-amber-700" : ""}
    >
      {children}
    </Button>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: number
  hint: string
}) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className="rounded-lg bg-amber-50 p-2">{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}
