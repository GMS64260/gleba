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
  ClipboardCheck,
  Check,
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { VergerCalendarView } from "./VergerCalendarView"
import { TreeCareGantt, type EspeceArbreGantt } from "./TreeCareGantt"
import { kpiCardClass, kpiSubtleClass } from "@/lib/kpi-theme"
import { libelleOperationArbre } from "@/lib/verger/operation-label"
import {
  debutDeJour,
  libelleCourtOperation,
  libelleFenetre,
  statutOperationArbre,
  type StatutOperationArbre,
} from "@/lib/operation-arbre-statut"

interface DashboardArbresData {
  stats: {
    arbresTotal: number
    arbresFruitiers: number
    arbresPetitsFruits: number
    arbresForestiers: number
    arbresProductifs: number
    arbresSansParcelle?: number
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
  description: string | null
  datePrevue: string | null
  fenetreDebut: string | null
  dateLimite: string | null
  abandonneeLe: string | null
  fait: boolean
  arbre: { id: number; nom: string; type: string }
}

/**
 * Un lot d'opérations identiques portant sur plusieurs arbres. Le générateur
 * crée la même « taille en vert » sur tous les pommiers d'un verger : les
 * afficher une par une produisait 79 lignes indiscernables (constat de
 * production du 2026-08-03). On les présente comme un seul geste agricole.
 */
interface LotOperations {
  cle: string
  libelle: string
  type: string
  fenetre: string | null
  /** Fin de fenêtre la plus proche du lot : porte l'urgence réelle. */
  echeance: Date | null
  operations: OperationArbre[]
}

interface CalendrierTabProps {
  year: number
}

/** Au-delà, on renvoie vers l'onglet Opérations plutôt que de dérouler 80 lignes. */
const MAX_ARBRES_DEPLIES = 25

interface LotCardProps {
  lot: LotOperations
  variante: "a_faire" | "a_venir" | "depassee"
  deplie: boolean
  onToggle: () => void
  enCours: string | null
  onTraiterLot: (lot: LotOperations, action: "fait" | "solder") => void
  onMarquerFait: (operation: OperationArbre) => void
}

/**
 * Une ligne = un geste agricole sur N arbres, avec l'action qui va avec.
 * L'utilisateur pense « je taille en vert mes pommiers », pas « je valide 33
 * opérations » : le lot est l'unité de travail, l'arbre le détail.
 */
function LotCard({
  lot,
  variante,
  deplie,
  onToggle,
  enCours,
  onTraiterLot,
  onMarquerFait,
}: LotCardProps) {
  const nb = lot.operations.length
  const occupe = enCours !== null
  const fond =
    variante === "depassee"
      ? "bg-amber-50 border-amber-100"
      : variante === "a_faire"
        ? "bg-lime-50 border-lime-100"
        : "bg-slate-50 border-slate-100"

  return (
    <div className={`rounded-lg border ${fond}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={deplie}
        >
          {deplie ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="block font-medium">{lot.libelle}</span>
            <span className="block text-sm text-muted-foreground">
              {libelleOperationArbre(lot.type)} · {nb} {nb > 1 ? "arbres" : "arbre"}
              {lot.fenetre ? ` · fenêtre ${lot.fenetre}` : ""}
              {!lot.fenetre && lot.echeance
                ? ` · prévu le ${lot.echeance.toLocaleDateString("fr-FR")}`
                : ""}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {variante === "depassee" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={occupe}
              className="text-amber-800 border-amber-300 hover:bg-amber-100"
              onClick={() => onTraiterLot(lot, "solder")}
            >
              <Archive className="h-4 w-4 mr-1" />
              {enCours === `${lot.cle}:solder` ? "…" : "Solder"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={occupe}
            className="text-green-700 border-green-200 hover:bg-green-50"
            onClick={() => onTraiterLot(lot, "fait")}
          >
            <Check className="h-4 w-4 mr-1" />
            {enCours === `${lot.cle}:fait`
              ? "…"
              : nb > 1
                ? `Fait sur les ${nb}`
                : "Fait"}
          </Button>
        </div>
      </div>

      {deplie && (
        <div className="border-t bg-white/60 px-3 py-2">
          <ul className="divide-y">
            {lot.operations.slice(0, MAX_ARBRES_DEPLIES).map((operation) => (
              <li key={operation.id} className="flex items-center justify-between gap-2 py-1.5">
                <Link
                  href={`/verger/${operation.arbre.id}`}
                  className="min-w-0 truncate text-sm hover:underline"
                >
                  {operation.arbre.nom}
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-green-700 hover:bg-green-50"
                  disabled={occupe}
                  onClick={() => onMarquerFait(operation)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          {nb > MAX_ARBRES_DEPLIES && (
            <p className="pt-2 text-xs text-muted-foreground">
              et {nb - MAX_ARBRES_DEPLIES} autres —{" "}
              <Link href="/verger?tab=operations" className="underline">
                voir toutes les opérations
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Regroupe des opérations par geste agricole, du plus urgent au moins urgent. */
function regrouperOperations(operations: OperationArbre[]): LotOperations[] {
  const lots = new Map<string, LotOperations>()

  for (const operation of operations) {
    const libelle = libelleCourtOperation(operation.description)
    const cle = `${operation.type}|${libelle}`
    const echeance = operation.dateLimite
      ? new Date(operation.dateLimite)
      : operation.datePrevue
        ? new Date(operation.datePrevue)
        : null

    const existant = lots.get(cle)
    if (existant) {
      existant.operations.push(operation)
      if (echeance && (!existant.echeance || echeance < existant.echeance)) {
        existant.echeance = echeance
      }
      continue
    }

    lots.set(cle, {
      cle,
      libelle,
      type: operation.type,
      fenetre: libelleFenetre(operation.fenetreDebut, operation.dateLimite),
      echeance,
      operations: [operation],
    })
  }

  return [...lots.values()].sort((a, b) => {
    if (a.echeance && b.echeance) return a.echeance.getTime() - b.echeance.getTime()
    if (a.echeance) return -1
    if (b.echeance) return 1
    return b.operations.length - a.operations.length
  })
}

export function CalendrierTab({ year }: CalendrierTabProps) {
  const { toast } = useToast()
  const [data, setData] = React.useState<DashboardArbresData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [operations, setOperations] = React.useState<OperationArbre[]>([])
  const [arbresAttention, setArbresAttention] = React.useState<{ id: number; nom: string; type: string; etat: string }[]>([])
  const [especesUtilisateur, setEspecesUtilisateur] = React.useState<EspeceArbreGantt[]>([])
  const [lotsDeplies, setLotsDeplies] = React.useState<Record<string, boolean>>({})
  const [fenetresDepasseesDepliees, setFenetresDepasseesDepliees] = React.useState(false)
  const [enCours, setEnCours] = React.useState<string | null>(null)

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
          // Le tri par statut est dérivé (voir `statutOperationArbre`) : une
          // fenêtre encore ouverte reste à faire, une fenêtre refermée n'est pas
          // un retard, une opération soldée disparaît des listes d'action.
          setOperations(ops)
        }

        if (arbresRes.ok) {
          const arbres = await arbresRes.json()
          setArbresAttention(
            arbres.filter((a: { etat: string }) => ["mauvais", "moyen"].includes(a.etat))
          )
          // Couples espèce/type uniques pour le Gantt d'entretien.
          // cmsofzh0w — le type de l'arbre accompagne l'espèce : la frise ne
          // doit pas afficher un calendrier fruitier pour un arbre forestier.
          const paires = new Map<string, EspeceArbreGantt>()
          for (const a of arbres as Array<{ espece: string | null; type: string | null }>) {
            if (!a.espece) continue
            const cle = `${a.espece}::${a.type ?? ""}`
            if (!paires.has(cle)) paires.set(cle, { espece: a.espece, type: a.type ?? null })
          }
          setEspecesUtilisateur([...paires.values()])
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [year, toast])

  // Trois lots, dérivés d'une seule règle de statut partagée avec le briefing
  // et les autres écrans. `aujourdhui` est figé au rendu : recalculer minuit à
  // chaque itération ferait basculer un lot au passage de la journée.
  const { lotsAFaire, lotsAVenir, lotsDepasses, compteurs } = React.useMemo(() => {
    const aujourdhui = debutDeJour()
    const parStatut = new Map<StatutOperationArbre, OperationArbre[]>()
    for (const operation of operations) {
      const statut = statutOperationArbre(operation, aujourdhui)
      const bucket = parStatut.get(statut)
      if (bucket) bucket.push(operation)
      else parStatut.set(statut, [operation])
    }
    const aFaire = [
      ...(parStatut.get("a_faire") ?? []),
      ...(parStatut.get("en_retard") ?? []),
    ]
    const aVenir = parStatut.get("a_venir") ?? []
    const depassees = parStatut.get("fenetre_depassee") ?? []
    return {
      lotsAFaire: regrouperOperations(aFaire),
      lotsAVenir: regrouperOperations(aVenir),
      lotsDepasses: regrouperOperations(depassees),
      compteurs: {
        aFaire: aFaire.length,
        aVenir: aVenir.length,
        depassees: depassees.length,
      },
    }
  }, [operations])

  /**
   * Un seul geste pour un lot entier. `fait` enregistre la réalisation,
   * `solder` acte qu'une fenêtre refermée ne sera pas rattrapée cette saison.
   */
  const traiterLot = React.useCallback(
    async (lot: LotOperations, action: "fait" | "solder") => {
      const ids = lot.operations.map((operation) => operation.id)
      setEnCours(`${lot.cle}:${action}`)
      try {
        const res = await fetch("/api/arbres/operations/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || "échec")
        }
        const { count } = await res.json()
        const traites = new Set(ids)
        setOperations((prev) => prev.filter((operation) => !traites.has(operation.id)))
        toast({
          title:
            action === "fait"
              ? `${count} ${count > 1 ? "opérations validées" : "opération validée"}`
              : `${count} ${count > 1 ? "opérations soldées" : "opération soldée"}`,
          description:
            action === "solder"
              ? "Conservées comme non réalisées cette saison ; elles reviendront à la prochaine fenêtre."
              : undefined,
        })
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Traitement impossible",
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setEnCours(null)
      }
    },
    [toast]
  )

  const solderToutesFenetresDepassees = React.useCallback(async () => {
    const ids = lotsDepasses.flatMap((lot) => lot.operations.map((operation) => operation.id))
    if (ids.length === 0) return
    setEnCours("tout-solder")
    try {
      const res = await fetch("/api/arbres/operations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "solder" }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || "échec")
      }
      const { count } = await res.json()
      const traites = new Set(ids)
      setOperations((prev) => prev.filter((operation) => !traites.has(operation.id)))
      toast({
        title: `${count} ${count > 1 ? "opérations soldées" : "opération soldée"}`,
        description: "Les fenêtres de cette saison sont closes ; le calendrier repart propre.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Traitement impossible",
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setEnCours(null)
    }
  }, [lotsDepasses, toast])

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
        setOperations((prev) => prev.filter((o) => o.id !== op.id))
        toast({ title: "Fait !" })
      } else {
        toast({ variant: "destructive", title: "Validation impossible" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Total arbres</CardDescription>
            <CardTitle className="text-2xl">
              {/* QA Hélène 2026-05-15 — Bug #9 : on garde l'ancienne
                  valeur visible pendant le refetch (stale-while-revalidate)
                  pour éviter le big number absent ~2s pendant qu'on
                  recharge après un ajout. Skeleton seulement au premier
                  chargement (data = null). */}
              {data == null ? <Skeleton className="h-8 w-12 bg-slate-500" /> : data.stats.arbresTotal || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>{data?.stats.arbresProductifs || 0} fruitiers productifs</p>
            {/* Fix verger 2026-05-31 (bug #2) — Rend explicite l'écart entre
                le total verger (tous les arbres) et la liste Parcelles (arbres
                rattachés à une parcelle) : N arbre(s) orphelin(s) sans
                parcelle. */}
            {data?.stats.arbresSansParcelle ? (
              <p className={`text-xs ${kpiSubtleClass("neutre")}`}>
                dont {data.stats.arbresSansParcelle} sans parcelle
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Bug #6 — Surface verger (ha) */}
        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Surface verger</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-slate-500" /> : `${data?.stats.surfaceVergerHa ?? 0} ha`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>
              Parcelles avec arbres
            </p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Fruitiers</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-12 bg-slate-500" /> : data?.stats.arbresFruitiers || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>+ {data?.stats.arbresPetitsFruits || 0} petits fruits</p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass("revenu")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("revenu")} text-xs`}>Récoltes fruits {year}</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-emerald-400" /> : `${data?.stats.recoltesFruitsAnnee || 0} kg`}
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
              <p className={`text-[10px] ${kpiSubtleClass("revenu")} italic`}>
                Pas de comparatif N-1 disponible
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={kpiCardClass("revenu")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("revenu")} text-xs`}>Production bois</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16 bg-emerald-400" /> : `${data?.stats.productionBoisAnnee || 0} m³`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("revenu")}`}>
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
                  const totalAvecDate = p.age_0_5 + p.age_5_15 + p.age_15_30 + p.age_30_plus
                  // Bug #20 — Barres figées à 0 sans contexte clair :
                  // si TOUS les arbres sont sans date de plantation, on
                  // remplace la pyramide vide par un message d'invitation
                  // à compléter la donnée (utile pour les aides PCAE/HVE).
                  if (totalAvecDate === 0) {
                    return (
                      <div className="text-center py-6 space-y-2">
                        <p className="text-sm text-slate-700">
                          {p.sansDate} arbre(s) sans date de plantation.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Renseignez la date de plantation pour calculer la pyramide d'âge
                          (utile aux dossiers PCAE / HVE).
                        </p>
                        <Link
                          href="/verger?tab=arbres"
                          className="inline-block text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Compléter les dates
                        </Link>
                      </div>
                    )
                  }
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
                  Top espèces du verger
                </CardTitle>
                <CardDescription className="text-xs">
                  Répartition par nombre d&apos;arbres
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full min-w-0">
                  {/* QA Hélène 2026-05-15 — Bug #4 : `key` basé sur la
                      signature des données force un remount complet
                      quand on ajoute/supprime un arbre, sinon Recharts
                      gardait l'ancien tracé en cache. */}
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart key={data.stats.topEspeces.map((e) => `${e.espece}:${e.count}`).join("|")}>
                      <Pie
                        data={data.stats.topEspeces}
                        cx="50%"
                        cy="45%"
                        innerRadius={35}
                        outerRadius={65}
                        dataKey="count"
                        nameKey="espece"
                        label={false}
                        isAnimationActive={false}
                      >
                        {data.stats.topEspeces.map((_, i) => (
                          <Cell
                            key={i}
                            fill={["#84cc16", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"][i % 6]}
                          />
                        ))}
                      </Pie>
                      {/* Bug feedback testeur 2026-05-26 (cmpmqxcwf) — les
                          valeurs n'étaient lisibles qu'au survol. On affiche
                          désormais le nb d'arbres + % directement dans la
                          légende et le tooltip (donut auto-explicatif). */}
                      <Tooltip
                        formatter={(value, name) => {
                          const total = data.stats.topEspeces!.reduce((s, e) => s + e.count, 0)
                          const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0
                          return [`${value} arbre${Number(value) > 1 ? "s" : ""} (${pct}%)`, name as string]
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) => {
                          const item = data.stats.topEspeces!.find((e) => e.espece === value)
                          return `${value}${item ? ` (${item.count})` : ""}`
                        }}
                      />
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
            <div className="h-[250px] w-full min-w-0">
              {data?.charts.recoltesFruitsMois && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.recoltesFruitsMois}>
                    <CartesianGrid strokeDasharray="3 3" />
                    {/* QA cmsqn3n9s — sans interval=0, Recharts saute des ticks (« Nov » absent, trou visible entre Oct et Déc) */}
                    <XAxis dataKey="mois" tick={{ fontSize: 10 }} interval={0} />
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
            <div className="h-[250px] w-full min-w-0">
              {data?.charts.productionBoisMois && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.productionBoisMois}>
                    <CartesianGrid strokeDasharray="3 3" />
                    {/* QA cmsqn3n9s — sans interval=0, Recharts saute des ticks (« Nov » absent, trou visible entre Oct et Déc) */}
                    <XAxis dataKey="mois" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} m³`, "Volume"]}
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
            <div className="h-[250px] w-full min-w-0">
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
            <div className="h-[250px] w-full min-w-0">
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

      {/* Tâches d'entretien — regroupées par geste agricole, pas par ligne de
          base. Un verger de 86 arbres produit des lots de dizaines d'opérations
          identiques : la liste plate demandait un appui par arbre. */}
      <div className="space-y-6">
        <Card className="border-lime-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-lime-800">
              <ClipboardCheck className="h-4 w-4 text-lime-600" />
              À faire maintenant ({compteurs.aFaire})
            </CardTitle>
            <CardDescription>
              Opérations dont la fenêtre est ouverte aujourd’hui, la plus urgente en premier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lotsAFaire.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Rien à faire aujourd’hui au verger.
              </p>
            ) : (
              <div className="space-y-2">
                {lotsAFaire.map((lot) => (
                  <LotCard
                    key={lot.cle}
                    lot={lot}
                    variante="a_faire"
                    deplie={!!lotsDeplies[lot.cle]}
                    onToggle={() =>
                      setLotsDeplies((prev) => ({ ...prev, [lot.cle]: !prev[lot.cle] }))
                    }
                    enCours={enCours}
                    onTraiterLot={traiterLot}
                    onMarquerFait={handleMarkDone}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              À venir ({compteurs.aVenir})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lotsAVenir.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune opération planifiée</p>
            ) : (
              <div className="space-y-2">
                {lotsAVenir.map((lot) => (
                  <LotCard
                    key={lot.cle}
                    lot={lot}
                    variante="a_venir"
                    deplie={!!lotsDeplies[lot.cle]}
                    onToggle={() =>
                      setLotsDeplies((prev) => ({ ...prev, [lot.cle]: !prev[lot.cle] }))
                    }
                    enCours={enCours}
                    onTraiterLot={traiterLot}
                    onMarquerFait={handleMarkDone}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hors saison : masqué du flux de travail. Une opération dont la fenêtre
            est refermée n'est plus faisable cette année — l'afficher parmi les
            tâches était la principale source d'incohérence (125 lignes « en
            retard » impossibles à honorer). On la sort donc des listes, sans
            l'effacer : une ligne sobre permet de solder la saison et de garder
            la trace de ce qui n'a pas été fait. */}
        {compteurs.depassees > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground">
                {compteurs.depassees}{" "}
                {compteurs.depassees > 1 ? "opérations sont hors saison" : "opération est hors saison"}{" "}
                et ne {compteurs.depassees > 1 ? "sont" : "est"} plus réalisable
                {compteurs.depassees > 1 ? "s" : ""} cette année. Masquée
                {compteurs.depassees > 1 ? "s" : ""} des tâches ; elle
                {compteurs.depassees > 1 ? "s reviendront" : " reviendra"} à la prochaine fenêtre.
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setFenetresDepasseesDepliees((prev) => !prev)}
                >
                  {fenetresDepasseesDepliees ? (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-1" />
                  )}
                  Détail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={enCours !== null}
                  onClick={solderToutesFenetresDepassees}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  {enCours === "tout-solder" ? "Traitement…" : "Solder la saison"}
                </Button>
              </div>
            </div>
            {fenetresDepasseesDepliees && (
              <div className="mt-2 space-y-2">
                {lotsDepasses.map((lot) => (
                  <LotCard
                    key={lot.cle}
                    lot={lot}
                    variante="depassee"
                    deplie={!!lotsDeplies[lot.cle]}
                    onToggle={() =>
                      setLotsDeplies((prev) => ({ ...prev, [lot.cle]: !prev[lot.cle] }))
                    }
                    enCours={enCours}
                    onTraiterLot={traiterLot}
                    onMarquerFait={handleMarkDone}
                  />
                ))}
              </div>
            )}
          </div>
        )}
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
