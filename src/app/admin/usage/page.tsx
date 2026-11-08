"use client"

/**
 * Page Admin - Usage des comptes
 * Vue d'ensemble (présence, régularité, modules activés contre modules
 * réellement utilisés), tendances par période, puis une ligne par compte
 * avec sa fiche dépliable. Compte démo et comptes admin exclus, données
 * d'exemple et miroirs comptables non comptés (src/lib/admin-usage.ts).
 */

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"
import { ResponsiveContainer } from "@/components/ui/responsive-container"
import { Bot, ChevronDown, Search, TrendingUp } from "lucide-react"
import { GROUPES_USAGE, SEGMENTS } from "@/lib/admin-usage-groupes"
import { MODULE_IDS } from "@/lib/modules"
import { FicheCompteUsage } from "@/components/admin/usage/FicheCompteUsage"
import type { CompteUsage, GroupeUsageId, Segment, UsageData } from "@/components/admin/usage/types"
import {
  GROUPE_VISUEL,
  SEGMENT_VISUEL,
  fmtBucketLabel,
  fmtDate,
  ilYa,
  nf,
  userLabel,
} from "@/components/admin/usage/visuel"

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

type Tri = "activite" | "saisies" | "assistant" | "recent" | "inscription" | "nom"
const TRIS: Array<{ id: Tri; libelle: string }> = [
  { id: "activite", libelle: "Jours actifs sur la période" },
  { id: "saisies", libelle: "Saisies sur la période" },
  { id: "assistant", libelle: "Questions à l’assistant" },
  { id: "recent", libelle: "Dernière visite" },
  { id: "inscription", libelle: "Inscription la plus récente" },
  { id: "nom", libelle: "Nom" },
]

/** Filtre « utilise » : un groupe, l'assistant, ou « ne saisit rien ». */
type FiltreUsage = "tous" | GroupeUsageId | "assistant" | "aucun"

export default function AdminUsagePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [days, setDays] = React.useState(90)
  const [bucket, setBucket] = React.useState("week")
  const [top, setTop] = React.useState(8)
  const [data, setData] = React.useState<UsageData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [erreur, setErreur] = React.useState(false)

  const [search, setSearch] = React.useState("")
  const [segment, setSegment] = React.useState<Segment | "tous">("tous")
  const [filtreUsage, setFiltreUsage] = React.useState<FiltreUsage>("tous")
  const [tri, setTri] = React.useState<Tri>("activite")
  const [ouvert, setOuvert] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (status === "loading") return
    if (!session?.user || session.user.role !== "ADMIN") router.push("/")
  }, [session, status, router])

  React.useEffect(() => {
    let annule = false
    setLoading(true)
    setErreur(false)
    const params = new URLSearchParams({ days: String(days), bucket, top: String(top) })
    fetch(`/api/admin/usage?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: UsageData) => !annule && setData(d))
      .catch(() => {
        if (annule) return
        setData(null)
        setErreur(true)
      })
      .finally(() => !annule && setLoading(false))
    return () => {
      annule = true
    }
  }, [days, bucket, top])

  const comptes = React.useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    let rows = data.ranking.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.name?.toLowerCase().includes(q) ?? false)) return false
      if (segment !== "tous" && u.segment !== segment) return false
      if (filtreUsage === "assistant") return u.assistant.questionsFenetre > 0
      if (filtreUsage === "aucun") return u.saisiesFenetre === 0
      if (filtreUsage !== "tous") return u.usage[filtreUsage].fenetre > 0
      return true
    })
    const dateVal = (s: string | null) => (s ? new Date(s).getTime() : 0)
    rows = [...rows].sort((a, b) => {
      switch (tri) {
        case "saisies":
          return b.saisiesFenetre - a.saisiesFenetre || b.activeDaysInWindow - a.activeDaysInWindow
        case "assistant":
          return b.assistant.questionsFenetre - a.assistant.questionsFenetre || b.assistant.questionsTotal - a.assistant.questionsTotal
        case "recent":
          return dateVal(b.lastActivity) - dateVal(a.lastActivity)
        case "inscription":
          return dateVal(b.createdAt) - dateVal(a.createdAt)
        case "nom":
          return userLabel(a).localeCompare(userLabel(b), "fr", { sensitivity: "base" })
        default:
          return 0 // ordre de l'API : jours actifs, puis saisies
      }
    })
    return rows
  }, [data, search, segment, filtreUsage, tri])

  const filtresActifs = search.trim() !== "" || segment !== "tous" || filtreUsage !== "tous"

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white selection:bg-amber-200/70">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <TrendingUp className="h-6 w-6 shrink-0 text-amber-600 sm:h-7 sm:w-7" aria-hidden />
            <h1 className="truncate text-lg font-bold text-amber-800 sm:text-2xl">Usage des comptes</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">Retour admin</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6 sm:py-8">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
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
            {data && (
              <p className="text-xs text-slate-500 lg:ml-auto">
                {nf.format(data.totalRealUsers)} comptes réels · exclus : {data.excluded.adminCount} admin
                {data.excluded.adminCount > 1 ? "s" : ""}
                {data.excluded.demo ? " et le compte démo" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {loading && !data ? (
          <ChargementSquelette />
        ) : erreur || !data ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center">
              <p className="text-slate-700">Les métriques d’usage n’ont pas pu être chargées.</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Recharger la page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={`space-y-6 transition-opacity duration-200 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            <Resume data={data} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <AdoptionModules
                data={data}
                filtre={filtreUsage}
                onFiltre={(f) => {
                  setFiltreUsage((prev) => (prev === f ? "tous" : f))
                  document.getElementById("comptes")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              />
              <Segments
                data={data}
                actif={segment}
                onChoix={(s) => {
                  setSegment((prev) => (prev === s ? "tous" : s))
                  document.getElementById("comptes")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              />
            </div>

            <Tendances data={data} top={top} setTop={setTop} />

            <Card id="comptes" className="scroll-mt-24">
              <CardHeader className="space-y-1">
                <CardTitle>Comptes</CardTitle>
                <CardDescription>
                  Présence = jours où le compte a ouvert l’app. Saisies = lignes créées dans les modules (données
                  d’exemple, miroirs comptables automatiques et lignes de relevés bancaires exclus). Les saisies d’un
                  membre comptent chez le propriétaire de l’exploitation. Cliquez une ligne pour sa fiche.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                  <div className="relative w-full lg:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                    <input
                      type="search"
                      aria-label="Rechercher un compte"
                      placeholder="Nom ou e-mail…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-white py-1 pl-8 pr-3 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    />
                  </div>
                  <SelectSimple
                    label="Segment"
                    value={segment}
                    onChange={(v) => setSegment(v as Segment | "tous")}
                    options={[
                      { value: "tous", label: "Tous" },
                      ...SEGMENTS.map((s) => ({ value: s.id, label: `${s.libelle} (${data.segments[s.id]})` })),
                    ]}
                  />
                  <SelectSimple
                    label="Utilise"
                    value={filtreUsage}
                    onChange={(v) => setFiltreUsage(v as FiltreUsage)}
                    options={[
                      { value: "tous", label: "Peu importe" },
                      ...GROUPES_USAGE.map((g) => ({ value: g.id, label: g.libelle })),
                      { value: "assistant", label: "Assistant" },
                      { value: "aucun", label: "Rien saisi sur la période" },
                    ]}
                  />
                  <SelectSimple
                    label="Trier par"
                    value={tri}
                    onChange={(v) => setTri(v as Tri)}
                    options={TRIS.map((t) => ({ value: t.id, label: t.libelle }))}
                  />
                  {filtresActifs && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch("")
                        setSegment("tous")
                        setFiltreUsage("tous")
                      }}
                    >
                      Effacer les filtres
                    </Button>
                  )}
                  <p className="text-sm text-slate-600 tabular-nums lg:ml-auto" aria-live="polite">
                    {comptes.length} compte{comptes.length > 1 ? "s" : ""}
                  </p>
                </div>

                {data.ranking.length === 0 ? (
                  <p className="py-8 text-center text-slate-600">Aucun compte réel pour l’instant.</p>
                ) : comptes.length === 0 ? (
                  <p className="py-8 text-center text-slate-600">Aucun compte ne correspond à ces filtres.</p>
                ) : (
                  <ListeComptes comptes={comptes} data={data} ouvert={ouvert} setOuvert={setOuvert} />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------

function Resume({ data }: { data: UsageData }) {
  const r = data.resume
  const pct = (n: number, sur: number) => (sur > 0 ? `${Math.round((n / sur) * 100)} %` : "—")
  const items = [
    {
      label: "Actifs sur la période",
      valeur: r.actifsPeriode,
      detail: `${pct(r.actifsPeriode, data.totalRealUsers)} des ${nf.format(data.totalRealUsers)} comptes`,
    },
    {
      label: "Réguliers",
      valeur: r.reguliers,
      detail: "venus 3 des 4 dernières semaines",
    },
    {
      label: "Viennent sans saisir",
      valeur: r.sansSaisie,
      detail: `${pct(r.sansSaisie, r.actifsPeriode)} des actifs : consultent seulement`,
    },
    {
      label: "Ont questionné l’assistant",
      valeur: r.assistant,
      detail: `${pct(r.assistant, r.actifsPeriode)} des actifs`,
    },
    {
      label: "Nouveaux inscrits",
      valeur: r.nouveauxInscrits,
      detail: `sur ${data.range.days} jours`,
    },
  ]
  return (
    <Card>
      <dl className="grid grid-cols-2 divide-slate-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {items.map((it) => (
          <div key={it.label} className="px-4 py-4 sm:px-5">
            <dt className="text-sm text-slate-600">{it.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{nf.format(it.valeur)}</dd>
            <dd className="text-xs text-slate-500">{it.detail}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function AdoptionModules({
  data,
  filtre,
  onFiltre,
}: {
  data: UsageData
  filtre: FiltreUsage
  onFiltre: (f: FiltreUsage) => void
}) {
  const base = Math.max(1, data.totalRealUsers)
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Modules : activés et vraiment utilisés</CardTitle>
        <CardDescription>
          Barre claire = comptes qui affichent le module. Barre pleine = comptes qui y ont saisi au moins une ligne sur
          la période. Cliquez un module pour filtrer les comptes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {data.modules.map((m) => {
            const v = GROUPE_VISUEL[m.id]
            const Icone = v.icone
            const actif = filtre === m.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onFiltre(m.id)}
                  aria-pressed={actif}
                  className={`group w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    actif ? "bg-amber-50 ring-1 ring-amber-300" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                      <Icone className="h-4 w-4" aria-hidden />
                      {m.libelle}
                    </span>
                    <span className="text-right text-slate-600 tabular-nums">
                      <strong className="font-semibold text-slate-900">{m.utilisateurs}</strong>
                      {m.actives !== null ? ` / ${m.actives} l’affichent` : " compte" + (m.utilisateurs > 1 ? "s" : "")}
                      <span className="hidden sm:inline"> · {nf.format(m.saisies)} saisies</span>
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden>
                    {m.actives !== null && (
                      <div
                        className="absolute inset-y-0 left-0 rounded-full opacity-25"
                        style={{ width: `${(m.actives / base) * 100}%`, background: v.couleur }}
                      />
                    )}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(m.utilisateurs / base) * 100}%`, background: v.couleur }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function Segments({
  data,
  actif,
  onChoix,
}: {
  data: UsageData
  actif: Segment | "tous"
  onChoix: (s: Segment) => void
}) {
  const total = Math.max(1, data.totalRealUsers)
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Où en sont les comptes</CardTitle>
        <CardDescription>Classement d’après les jours actifs, à aujourd’hui (indépendant de la période).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          {SEGMENTS.map((s) =>
            data.segments[s.id] > 0 ? (
              <div
                key={s.id}
                style={{ width: `${(data.segments[s.id] / total) * 100}%`, background: SEGMENT_VISUEL[s.id].couleur }}
              />
            ) : null
          )}
        </div>
        <ul className="space-y-0.5">
          {SEGMENTS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onChoix(s.id)}
                aria-pressed={actif === s.id}
                className={`flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  actif === s.id ? "bg-amber-50 ring-1 ring-amber-300" : ""
                }`}
              >
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEGMENT_VISUEL[s.id].couleur }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{s.libelle}</span>
                  <span className="block text-xs text-slate-500">{s.aide}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">{data.segments[s.id]}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tendances
// ---------------------------------------------------------------------------

function Tendances({ data, top, setTop }: { data: UsageData; top: number; setTop: (n: number) => void }) {
  const b = data.range.bucket
  const periode = b === "day" ? "jour" : b === "week" ? "semaine" : "mois"
  const t = data.tendance

  const presence = t.buckets.map((k, i) => ({
    bucket: fmtBucketLabel(k, b),
    actifs: t.actifs[i],
    inscriptions: t.inscriptions[i],
  }))
  const groupesSaisis = GROUPES_USAGE.filter((g) => t.saisies[g.id]?.some((v) => v > 0))
  const saisies = t.buckets.map((k, i) => {
    const row: Record<string, string | number> = { bucket: fmtBucketLabel(k, b) }
    for (const g of groupesSaisis) row[g.id] = t.saisies[g.id][i]
    return row
  })
  const parCompte = data.series.buckets.map((k, i) => {
    const row: Record<string, string | number> = { bucket: fmtBucketLabel(k, b) }
    for (const u of data.series.users) row[u.id] = u.values[i] ?? 0
    return row
  })
  const auMoinsUnActif = t.actifs.some((v) => v > 0)
  const tooltip = { borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }

  return (
    <Card>
      <Tabs defaultValue="presence">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Dans le temps</CardTitle>
            <CardDescription>Par {periode}, sur les {data.range.days} derniers jours.</CardDescription>
          </div>
          <TabsList className="self-start">
            <TabsTrigger value="presence">Présence</TabsTrigger>
            <TabsTrigger value="saisies">Saisies</TabsTrigger>
            <TabsTrigger value="comptes">Par compte</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="presence" className="mt-0">
            {!auMoinsUnActif ? (
              <Vide>Aucune activité enregistrée sur cette période.</Vide>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={presence} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="actifs" name="Comptes actifs" fill="#d97706" radius={[3, 3, 0, 0]} />
                  <Line dataKey="inscriptions" name="Inscriptions" stroke="#334155" strokeWidth={2} dot={false} type="linear" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
          <TabsContent value="saisies" className="mt-0">
            {groupesSaisis.length === 0 ? (
              <Vide>Aucune saisie sur cette période.</Vide>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={saisies} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {groupesSaisis.map((g) => (
                    <Bar key={g.id} dataKey={g.id} name={g.libelle} stackId="s" fill={GROUPE_VISUEL[g.id].couleur} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
          <TabsContent value="comptes" className="mt-0 space-y-3">
            <FilterGroup label="Comptes affichés">
              {TOP_OPTIONS.map((o) => (
                <ToggleBtn key={o} active={top === o} onClick={() => setTop(o)}>
                  {o}
                </ToggleBtn>
              ))}
            </FilterGroup>
            {!data.series.users.some((u) => u.values.some((v) => v > 0)) ? (
              <Vide>Aucune activité enregistrée sur cette période.</Vide>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={parCompte} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltip} />
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
            <p className="text-xs text-slate-500">Jours actifs par {periode}, comptes les plus présents sur la période.</p>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Liste des comptes
// ---------------------------------------------------------------------------

const COLONNES = "lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_20px] lg:items-center lg:gap-4"

function ListeComptes({
  comptes,
  data,
  ouvert,
  setOuvert,
}: {
  comptes: CompteUsage[]
  data: UsageData
  ouvert: string | null
  setOuvert: (id: string | null) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className={`hidden border-b bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 ${COLONNES}`} aria-hidden>
        <span>Compte</span>
        <span>Présence ({data.range.days} j)</span>
        <span>Modules (saisies sur la période)</span>
        <span>Assistant</span>
        <span>Dernière visite</span>
        <span />
      </div>
      <ul className="divide-y">
        {comptes.map((u) => (
          <LigneCompte
            key={u.id}
            compte={u}
            semaines={data.resume.semainesFenetre}
            days={data.range.days}
            ouvert={ouvert === u.id}
            onToggle={() => setOuvert(ouvert === u.id ? null : u.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function LigneCompte({
  compte: u,
  semaines,
  days,
  ouvert,
  onToggle,
}: {
  compte: CompteUsage
  semaines: number
  days: number
  ouvert: boolean
  onToggle: () => void
}) {
  const seg = SEGMENTS.find((s) => s.id === u.segment)!
  const ficheId = `fiche-${u.id}`
  return (
    <li className={ouvert ? "bg-white" : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ouvert}
        aria-controls={ficheId}
        className={`w-full space-y-3 px-4 py-3 text-left transition-colors hover:bg-amber-50/60 focus-visible:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 lg:space-y-0 ${COLONNES}`}
      >
        <span className="flex min-w-0 items-start justify-between gap-3 lg:block">
          <span className="block min-w-0">
            <span className="block truncate font-medium text-slate-900">{u.name || u.email}</span>
            {u.name && <span className="block truncate text-xs text-slate-500">{u.email}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded border px-1.5 py-px text-[11px] font-medium ${SEGMENT_VISUEL[u.segment].badge}`} title={seg.aide}>
                {seg.libelle}
              </span>
              {!u.active && (
                <span className="rounded border border-slate-300 px-1.5 py-px text-[11px] text-slate-600">désactivé</span>
              )}
              {u.equipe.membreDe && (
                <span className="rounded border border-slate-200 px-1.5 py-px text-[11px] text-slate-600">membre</span>
              )}
              {u.equipe.membres > 0 && (
                <span className="rounded border border-slate-200 px-1.5 py-px text-[11px] text-slate-600">
                  équipe de {u.equipe.membres + 1}
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 lg:hidden ${ouvert ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>

        <span className="block text-sm tabular-nums">
          <span className="text-slate-500 lg:hidden">Présence : </span>
          <span className="font-semibold text-slate-900">{u.activeDaysInWindow} j</span>
          <span className="text-slate-500"> · {Math.min(u.activeWeeksInWindow, semaines)}/{semaines} sem.</span>
          <PresenceBarre valeur={u.activeWeeksInWindow} max={semaines} />
        </span>

        <span className="flex flex-wrap gap-1.5" aria-label="Modules">
          {MODULE_IDS.map((m) => (
            <PuceModule key={m} id={m} affiche={u.modulesActifs.includes(m)} saisies={u.usage[m].fenetre} />
          ))}
          {(["terrain", "communaute"] as const).map((g) =>
            u.usage[g].fenetre > 0 ? <PuceModule key={g} id={g} affiche saisies={u.usage[g].fenetre} /> : null
          )}
        </span>

        <span className="flex items-center gap-1.5 text-sm tabular-nums">
          <Bot className={`h-4 w-4 ${u.assistant.questionsFenetre ? "text-amber-700" : "text-slate-300"}`} aria-hidden />
          <span className={u.assistant.questionsFenetre ? "font-medium text-slate-900" : "text-slate-400"}>
            {u.assistant.questionsFenetre}
          </span>
          <span className="text-xs text-slate-500 lg:sr-only">question{u.assistant.questionsFenetre > 1 ? "s" : ""}</span>
        </span>

        <span className="block text-sm">
          <span className="text-slate-500 lg:hidden">Dernière visite : </span>
          <span className="text-slate-900">{ilYa(u.lastActivity, true)}</span>
          <span className="block text-xs text-slate-500">inscrit le {fmtDate(u.createdAt)}</span>
        </span>

        <ChevronDown
          className={`hidden h-4 w-4 text-slate-500 transition-transform duration-200 lg:block ${ouvert ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {ouvert && (
        <div id={ficheId}>
          <FicheCompteUsage compte={u} days={days} />
        </div>
      )}
    </li>
  )
}

function PresenceBarre({ valeur, max }: { valeur: number; max: number }) {
  const pct = Math.min(100, Math.round((valeur / Math.max(1, max)) * 100))
  return (
    <span className="mt-1.5 block h-1.5 w-full max-w-[140px] rounded-full bg-slate-100" aria-hidden>
      <span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Puce de module : pleine si saisies sur la période, contour si affiché sans saisie, effacée si masqué. */
function PuceModule({ id, affiche, saisies }: { id: GroupeUsageId; affiche: boolean; saisies: number }) {
  const v = GROUPE_VISUEL[id]
  const Icone = v.icone
  const etat = saisies > 0 ? "utilise" : affiche ? "inutilise" : "masque"
  const titre =
    etat === "utilise"
      ? `${v.court} : ${saisies} saisie${saisies > 1 ? "s" : ""} sur la période`
      : etat === "inutilise"
        ? `${v.court} : affiché, aucune saisie sur la période`
        : `${v.court} : masqué dans ses paramètres`
  return (
    <span
      title={titre}
      aria-label={titre}
      className={`inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs tabular-nums ${
        etat === "masque" ? "border-dashed border-slate-200 text-slate-300" : etat === "inutilise" ? "border-slate-300 text-slate-500" : "font-medium"
      }`}
      style={etat === "utilise" ? { color: v.couleur, borderColor: `${v.couleur}55`, background: `${v.couleur}12` } : undefined}
    >
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {etat === "utilise" && nf.format(saisies)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Petits composants
// ---------------------------------------------------------------------------

function Vide({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">{children}</div>
}

function ChargementSquelette() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-[104px] w-full" />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[320px] w-full" />
        <Skeleton className="h-[320px] w-full" />
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}

function SelectSimple({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 lg:flex-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      className={active ? "bg-amber-600 hover:bg-amber-700" : ""}
    >
      {children}
    </Button>
  )
}
