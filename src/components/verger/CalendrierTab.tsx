"use client"

/**
 * Onglet Calendrier & Taches du verger - Stats, graphiques et operations en attente
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts"
import {
  TreeDeciduous,
  TrendingUp,
  TrendingDown,
  Apple,
  Axe,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  Check,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { VergerCalendarView } from "./VergerCalendarView"
import { TreeCareGantt } from "./TreeCareGantt"

interface DashboardArbresData {
  stats: {
    arbresTotal: number
    arbresFruitiers: number
    arbresPetitsFruits: number
    arbresForestiers: number
    arbresProductifs: number
    recoltesFruitsAnnee: number
    recoltesFruitsCount: number
    recoltesFruitsAnneePrecedente: number
    productionBoisAnnee: number
    productionBoisKg: number
    venteBoisAnnee: number
    operationsEnAttente: number
    // Bug #6 — KPI verger
    surfaceVergerHa?: number
    pyramideAge?: {
      age_0_5: number
      age_5_15: number
      age_15_30: number
      age_30_plus: number
      sansDate: number
    }
    topEspeces?: { espece: string; count: number }[]
  }
  charts: {
    recoltesFruitsMois: { mois: string; quantite: number }[]
    productionBoisMois: { mois: string; volumeM3: number }[]
    boisParDestination: { destination: string; volumeM3: number; couleur: string }[]
    topRecoltesArbres: { arbreId: number; nom: string; type: string; quantite: number }[]
    arbresParType: { type: string; count: number; couleur: string }[]
  }
  activity: {
    prochainesOperations: {
      id: number
      type: string
      datePrevue: string
      arbre: { id: number; nom: string; type: string }
    }[]
    arbresAttention: { id: number; nom: string; type: string; etat: string }[]
  }
  meta: {
    year: number
    generatedAt: string
  }
}

interface OperationArbre {
  id: number
  arbreId: number
  type: string
  datePrevue: string | null
  fait: boolean
  arbre: { id: number; nom: string; type: string }
}

interface CalendrierTabProps {
  year: number
}

export function CalendrierTab({ year }: CalendrierTabProps) {
  const { toast } = useToast()
  const [data, setData] = React.useState<DashboardArbresData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [operationsEnRetard, setOperationsEnRetard] = React.useState<OperationArbre[]>([])
  const [operationsAVenir, setOperationsAVenir] = React.useState<OperationArbre[]>([])
  const [arbresAttention, setArbresAttention] = React.useState<{ id: number; nom: string; type: string; etat: string }[]>([])
  const [especesUtilisateur, setEspecesUtilisateur] = React.useState<string[]>([])

  React.useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [statsRes, opsRes, arbresRes] = await Promise.all([
          fetch(`/api/arbres/stats?year=${year}`),
          fetch("/api/arbres/operations?fait=false"),
          fetch("/api/arbres"),
        ])

        if (statsRes.ok) {
          setData(await statsRes.json())
        }

        if (opsRes.ok) {
          const ops: OperationArbre[] = await opsRes.json()
          const today = new Date()
          setOperationsEnRetard(
            ops.filter((op) => op.datePrevue && new Date(op.datePrevue) < today)
          )
          setOperationsAVenir(
            ops.filter((op) => !op.datePrevue || new Date(op.datePrevue) >= today)
          )
        }

        if (arbresRes.ok) {
          const arbres = await arbresRes.json()
          setArbresAttention(
            arbres.filter((a: { etat: string }) => ["mauvais", "moyen"].includes(a.etat))
          )
          // Espèces uniques pour le Gantt d'entretien
          const especes = [...new Set(arbres.map((a: { espece: string | null }) => a.espece).filter(Boolean))] as string[]
          setEspecesUtilisateur(especes)
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [year, toast])

  // Feedback Marc 2026-05-16 — V4 Bug 5 : afficher "+0% vs 2025"
  // quand 2025 = 0 kg est trompeur (Maraîchage affichait "Pas de
  // comparatif" dans le même cas). On expose désormais un flag
  // `hasComparatif` pour rendre "N/A" si N-1 < 5 kg (seuil de
  // pertinence) comme dans potager/CalendrierTab.
  const yearDiff = React.useMemo(() => {
    if (!data?.stats) return { diff: 0, percent: "0", hasComparatif: false }
    const current = data.stats.recoltesFruitsAnnee
    const previous = data.stats.recoltesFruitsAnneePrecedente
    const hasComparatif = previous >= 5
    const diff = current - previous
    const percent = previous > 0 ? Math.round((diff / previous) * 100) : 0
    return { diff, percent: percent.toString(), hasComparatif }
  }, [data?.stats])

  const handleMarkDone = async (op: OperationArbre) => {
    try {
      const res = await fetch(`/api/arbres/operations/${op.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fait: true, date: new Date().toISOString() }),
      })
      if (res.ok) {
        setOperationsEnRetard((prev) => prev.filter((o) => o.id !== op.id))
        setOperationsAVenir((prev) => prev.filter((o) => o.id !== op.id))
        toast({ title: "Fait !" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-lime-500 to-lime-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-lime-100 text-xs">Total arbres</CardDescription>
            <CardTitle className="text-2xl">
              {/* QA Hélène 2026-05-15 — Bug #9 : on garde l'ancienne
                  valeur visible pendant le refetch (stale-while-revalidate)
                  pour éviter le big number absent ~2s pendant qu'on
                  recharge après un ajout. Skeleton seulement au premier
                  chargement (data = null). */}
              {data == null ? <Skeleton className="h-8 w-12 bg-lime-400" /> : data.stats.arbresTotal || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-lime-100">{data?.stats.arbresProductifs || 0} fruitiers productifs</p>
          </CardContent>
        </Card>

        {/* Bug #6 — Surface verger (ha) */}
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-emerald-100 text-xs">Surface verger</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-emerald-400" /> : `${data?.stats.surfaceVergerHa ?? 0} ha`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-emerald-100">
              Parcelles avec arbres
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-slate-300 text-xs">Fruitiers</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-12 bg-slate-500" /> : data?.stats.arbresFruitiers || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-slate-300">+ {data?.stats.arbresPetitsFruits || 0} petits fruits</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600 to-amber-700 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-amber-100 text-xs">Récoltes fruits {year}</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-amber-400" /> : `${data?.stats.recoltesFruitsAnnee || 0} kg`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {yearDiff.hasComparatif ? (
              <div className="flex items-center gap-1 text-xs">
                {yearDiff.diff >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-200" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-200" />
                )}
                <span className={yearDiff.diff >= 0 ? "text-green-200" : "text-red-200"}>
                  {yearDiff.diff >= 0 ? "+" : ""}{yearDiff.percent}% vs {year - 1}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-amber-100 italic">
                Pas de comparatif N-1 disponible
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-teal-100 text-xs">Production bois</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-teal-400" /> : `${data?.stats.productionBoisAnnee || 0} m3`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-xs text-teal-100">
              {data?.stats.venteBoisAnnee ? `${data.stats.venteBoisAnnee} EUR vendus` : "Aucune vente"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bug #6 — Pyramide d'âge + Top 5 espèces */}
      {(data?.stats.pyramideAge || data?.stats.topEspeces) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data?.stats.pyramideAge && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TreeDeciduous className="h-4 w-4 text-lime-600" />
                  Pyramide d'âge des arbres
                </CardTitle>
                <CardDescription className="text-xs">
                  Tranches d'âge des fruitiers et petits fruits (basé sur la date de plantation)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const p = data.stats.pyramideAge!
                  const max = Math.max(p.age_0_5, p.age_5_15, p.age_15_30, p.age_30_plus, 1)
                  const tranches: { label: string; n: number; color: string }[] = [
                    { label: "0 – 5 ans", n: p.age_0_5, color: "bg-emerald-400" },
                    { label: "5 – 15 ans", n: p.age_5_15, color: "bg-lime-500" },
                    { label: "15 – 30 ans", n: p.age_15_30, color: "bg-amber-500" },
                    { label: "30 ans et +", n: p.age_30_plus, color: "bg-orange-600" },
                  ]
                  return (
                    <div className="space-y-2">
                      {tranches.map((t) => (
                        <div key={t.label} className="flex items-center gap-3 text-xs">
                          <div className="w-24 text-muted-foreground">{t.label}</div>
                          <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                            <div
                              className={`h-full ${t.color}`}
                              style={{ width: `${(t.n / max) * 100}%` }}
                            />
                          </div>
                          <div className="w-12 text-right font-medium">{t.n}</div>
                        </div>
                      ))}
                      {p.sansDate > 0 && (
                        <p className="text-xs text-muted-foreground italic mt-2">
                          {p.sansDate} arbre(s) sans date de plantation
                        </p>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {data?.stats.topEspeces && data.stats.topEspeces.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Apple className="h-4 w-4 text-orange-500" />
                  Top 5 espèces du verger
                </CardTitle>
                <CardDescription className="text-xs">
                  Répartition par nombre d'arbres
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  {/* QA Hélène 2026-05-15 — Bug #4 : `key` basé sur la
                      signature des données force un remount complet
                      quand on ajoute/supprime un arbre, sinon Recharts
                      gardait l'ancien tracé en cache. */}
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart key={data.stats.topEspeces.map((e) => `${e.espece}:${e.count}`).join("|")}>
                      <Pie
                        data={data.stats.topEspeces}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={75}
                        dataKey="count"
                        nameKey="espece"
                        label={({ name, value }) => `${name}: ${value}`}
                        isAnimationActive={false}
                      >
                        {data.stats.topEspeces.map((_, i) => (
                          <Cell
                            key={i}
                            fill={["#84cc16", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][i % 5]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Calendrier des operations */}
      <VergerCalendarView year={year} />

      {/* Calendrier d'entretien par espece */}
      {especesUtilisateur.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-purple-600" />
              Calendrier d'entretien par espèce
            </CardTitle>
            <CardDescription>
              Périodes recommandées de taille, traitement, fertilisation et récolte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TreeCareGantt especes={especesUtilisateur} />
          </CardContent>
        </Card>
      )}

      {/* Graphiques */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Apple className="h-4 w-4 text-orange-500" />
              Récoltes fruits par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.recoltesFruitsMois && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.recoltesFruitsMois}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} kg`, "Récolte"]}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="quantite"
                      stroke="#f97316"
                      fill="#fed7aa"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Axe className="h-4 w-4 text-amber-600" />
              Production bois par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.productionBoisMois && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.productionBoisMois}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} m3`, "Volume"]}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Bar dataKey="volumeM3" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TreeDeciduous className="h-4 w-4 text-lime-600" />
              Répartition par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {/* QA Hélène 2026-05-15 — Bug #5 : avec un seul type
                  d'arbres (ex. 21 fruitiers, 0 autre), Recharts dessinait
                  un mini-arc 5 % au lieu d'un disque plein. On affiche
                  désormais un disque plein quand il n'y a qu'une seule
                  catégorie + le re-render forcé par `key` (cf #4). */}
              {data?.charts.arbresParType && data.charts.arbresParType.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart key={data.charts.arbresParType.map((e) => `${e.type}:${e.count}`).join("|")}>
                    <Pie
                      data={data.charts.arbresParType}
                      cx="50%"
                      cy="50%"
                      innerRadius={data.charts.arbresParType.length === 1 ? 0 : 50}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={data.charts.arbresParType.length === 1 ? -270 : 450}
                      dataKey="count"
                      nameKey="type"
                      isAnimationActive={false}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {data.charts.arbresParType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.couleur} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Top récoltes par arbre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {data?.charts.topRecoltesArbres && data.charts.topRecoltesArbres.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.topRecoltesArbres} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="nom"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} kg`, "Récolte"]}
                    />
                    <Bar dataKey="quantite" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Aucune récolte enregistrée
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taches */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Operations en retard */}
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              En retard ({operationsEnRetard.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operationsEnRetard.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune opération en retard</p>
            ) : (
              <div className="space-y-3">
                {operationsEnRetard.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div>
                      <p className="font-medium">{op.arbre.nom}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {op.type} — prévu le{" "}
                        {op.datePrevue
                          ? new Date(op.datePrevue).toLocaleDateString("fr-FR")
                          : "non défini"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkDone(op)}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Fait
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operations a venir */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-lime-600" />
              À faire ({operationsAVenir.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {operationsAVenir.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune opération planifiée</p>
            ) : (
              <div className="space-y-3">
                {operationsAVenir.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{op.arbre.nom}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {op.type}
                        {op.datePrevue && (
                          <> — prévu le {new Date(op.datePrevue).toLocaleDateString("fr-FR")}</>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkDone(op)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Fait
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Arbres a surveiller */}
      {arbresAttention.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
              <TreeDeciduous className="h-4 w-4" />
              Arbres à surveiller ({arbresAttention.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {arbresAttention.map((arbre) => (
                <Link key={arbre.id} href={`/verger/${arbre.id}`}>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors">
                    <div>
                      <p className="font-medium">{arbre.nom}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {arbre.type.replace("_", " ")}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        arbre.etat === "mauvais"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {arbre.etat}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
