"use client"

/**
 * Onglet Calendrier Elevage - Vue hebdomadaire des taches
 * Pattern inspire du CalendrierTab potager
 */

import * as React from "react"
import {
  Stethoscope,
  Egg,
  Package,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  TrendingUp,
  Info,
  CalendarClock,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"

// ============================================================
// Types
// ============================================================

interface SoinTask {
  id: number
  date: string
  dateReelle: string
  type: string
  description: string | null
  produit: string | null
  cout: number | null
  fait: boolean
  animal: { id: number; nom: string; identifiant: string } | null
  lot: { id: number; nom: string } | null
}

interface ProductionEntry {
  id: number
  date: string
  quantite: number
  casses: number | null
  lot: { id: number; nom: string } | null
}

interface ConsoEntry {
  id: number
  date: string
  quantite: number
  aliment: { id: string; nom: string }
  lot: { id: number; nom: string } | null
}

interface TachesData {
  soins: SoinTask[]
  productions: ProductionEntry[]
  consommations: ConsoEntry[]
  stats: {
    soinsTotal: number
    soinsFaits: number
    soinsRestants: number
    totalOeufs: number
    totalConsoKg: number
    estimationOeufsJour: number
    estimationSource?: 'theorique' | 'historique' | 'mixte'
    nbLotsPondeuses: number
    aPonte?: boolean
  }
}

type AgendaEcheance = {
  id: string
  kind: string
  date: string | null
  joursRestants: number | null
  titre: string
  detail?: string
  gravite: 'info' | 'attention' | 'urgent'
}

const SOIN_TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  naissance_prevue: "Naissance prévue",
  autre: "Autre",
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ============================================================
// Helpers
// ============================================================

function getWeekStart(offset: number): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7
  const start = new Date(now)
  start.setDate(now.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('fr-FR', opts)} - ${end.toLocaleDateString('fr-FR', opts)}`
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

// Bug cmp8rtr5m (Marc 2026-05-16) — Off-by-one calendrier élevage.
// `toISOString()` retourne du UTC : un dimanche local 00:00 CEST devient
// samedi 22:00 UTC, donc split('T')[0] décale la clé d'un jour. On clé
// désormais sur le couple année-mois-jour local de la date.
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ============================================================
// Composant principal
// ============================================================

export function CalendrierTab() {
  const { toast } = useToast()
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [data, setData] = React.useState<TachesData | null>(null)
  // Bug cmp8smrwe — masquer les tâches déjà faites par défaut.
  const [showFaits, setShowFaits] = React.useState(false)
  // GAP P0 — agenda unifié : échéances à venir (indépendantes de la semaine).
  const [echeances, setEcheances] = React.useState<AgendaEcheance[]>([])

  React.useEffect(() => {
    fetch('/api/elevage/agenda?jours=21')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.echeances) setEcheances(j.echeances) })
      .catch(() => {})
  }, [])

  const weekStart = React.useMemo(() => getWeekStart(weekOffset), [weekOffset])
  const weekEnd = React.useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59)
    return end
  }, [weekStart])

  // Jours de la semaine
  const weekDays = React.useMemo(() => {
    return JOURS.map((label, i) => {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      return { label, date, dateKey: localDateKey(date) }
    })
  }, [weekStart])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/elevage/taches?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
      )
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [weekStart, weekEnd])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Toggle soin fait
  const toggleSoin = async (id: number, fait: boolean) => {
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fait: !fait, date: !fait ? new Date().toISOString() : undefined }),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: fait ? "Soin rouvert" : "Soin marque fait !" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Grouper evenements par jour
  const eventsByDay = React.useMemo(() => {
    if (!data) return new Map<string, { soins: SoinTask[]; productions: ProductionEntry[]; consommations: ConsoEntry[] }>()

    const map = new Map<string, { soins: SoinTask[]; productions: ProductionEntry[]; consommations: ConsoEntry[] }>()
    weekDays.forEach(d => map.set(d.dateKey, { soins: [], productions: [], consommations: [] }))

    data.soins.forEach(s => {
      const key = localDateKey(new Date(s.date))
      if (map.has(key)) map.get(key)!.soins.push(s)
    })
    data.productions.forEach(p => {
      const key = localDateKey(new Date(p.date))
      if (map.has(key)) map.get(key)!.productions.push(p)
    })
    data.consommations.forEach(c => {
      const key = localDateKey(new Date(c.date))
      if (map.has(key)) map.get(key)!.consommations.push(c)
    })

    return map
  }, [data, weekDays])

  const today = localDateKey(new Date())

  // Review caprin 2026-07-21 — un éleveur sans pondeuses (ex. uniquement des
  // chèvres) ne doit pas voir de KPI œufs : « Œufs collectés » et « Taux
  // collecte » n'ont aucun sens et découragent (0 sur ~14 attendus). On
  // n'affiche ces cartes que si l'élevage a une composante ponte réelle.
  // Priorité au flag cheptel `aPonte` (lots + animaux individuels, indépendant
  // de la semaine) ; repli sur les signaux hebdo si l'API ne le renvoie pas.
  const hasPonte = !!data && (
    data.stats.aPonte ??
    (data.stats.nbLotsPondeuses > 0 || data.stats.totalOeufs > 0 || data.stats.estimationOeufsJour > 0)
  )

  return (
    <div className="space-y-6">
      {/* Navigation semaine */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-sm font-medium hover:text-amber-600 min-w-[180px] text-center transition-colors"
          >
            {weekOffset === 0
              ? "Cette semaine"
              : weekOffset === 1
                ? "Semaine prochaine"
                : weekOffset === -1
                  ? "Semaine dernière"
                  : formatDateRange(weekStart, weekEnd)
            }
          </button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(o => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* GAP P0 — Prochaines échéances (agenda unifié, indépendant de la semaine) */}
      {echeances.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              Prochaines échéances
              <span className="text-xs font-normal text-slate-500">(21 jours)</span>
              {echeances.filter((e) => e.gravite === "urgent").length > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  {echeances.filter((e) => e.gravite === "urgent").length} urgent(s)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {echeances.slice(0, 15).map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                      e.gravite === "urgent" ? "bg-red-500" : e.gravite === "attention" ? "bg-amber-500" : "bg-slate-300"
                    }`}
                  />
                  <span className="font-medium text-slate-700">{e.titre}</span>
                  {e.detail && <span className="text-xs text-slate-500">— {e.detail}</span>}
                  {e.date && (
                    <span className="ml-auto text-xs text-slate-400 shrink-0">
                      {new Date(e.date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {echeances.length > 15 && (
              <p className="text-xs text-slate-400 mt-2">+{echeances.length - 15} autre(s) échéance(s)…</p>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : data && (
        <>
          {/* Mini-stats semaine */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <Stethoscope className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-blue-700">{data.stats.soinsRestants}</p>
              <p className="text-xs text-blue-600">Soins à faire</p>
              {data.stats.soinsFaits > 0 && (
                <p className="text-xs text-blue-400 mt-0.5">{data.stats.soinsFaits} fait(s)</p>
              )}
            </div>
            {hasPonte && (
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <Egg className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
              <p className="text-2xl font-bold text-yellow-700">{data.stats.totalOeufs}</p>
              <p className="text-xs text-yellow-600">Œufs collectés</p>
              {data.stats.estimationOeufsJour > 0 && (
                <p
                  className="text-xs text-yellow-400 mt-0.5 cursor-help"
                  title={
                    data.stats.estimationSource === 'historique'
                      ? "Estimation = moyenne observée sur les 60 derniers jours (pas de référentiel race)."
                      : data.stats.estimationSource === 'mixte'
                      ? "Estimation = moyenne entre le référentiel race × saison et l'historique observé (≥ 14 j de saisies)."
                      : "Estimation théorique : effectif × taux de ponte mensuel de la race. Variabilité ± 25 % selon stress, lumière et alimentation."
                  }
                >
                  ~{data.stats.estimationOeufsJour}/jour attendu
                  {data.stats.estimationSource === 'historique' && " (d'après vos saisies)"}
                  {data.stats.estimationSource === 'mixte' && " (ajusté sur vos saisies)"}
                  {data.stats.estimationSource !== 'theorique' && <Info className="inline-block h-2.5 w-2.5 ml-0.5 align-text-top" />}
                </p>
              )}
            </div>
            )}
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <Package className="h-5 w-5 mx-auto text-orange-600 mb-1" />
              <p className="text-2xl font-bold text-orange-700">{data.stats.totalConsoKg} kg</p>
              <p className="text-xs text-orange-600">Aliments distribués</p>
            </div>
            {hasPonte && (() => {
              // BUG #4 (audit Julien 15/05/2026) — Taux collecte semaine.
              // Avant : 999 œufs / (14 × 7) × 100 ≈ 1019 % affiché en vert.
              // Désormais on défend en profondeur :
              //   - div par 0 → « — » (pas Infinity %)
              //   - taux > 110 % → rouge + tooltip « anomalie de saisie »
              //   - 95-110 % → vert (saison de pic)
              //   - 0-95 %    → bleu/vert standard
              //
              // Bug feedback testeur 2026-05-26 (cmplojf11) — Le dénominateur
              // était fixe (7 × attenduJour) même si l'éleveur n'avait saisi
              // qu'1 jour sur la semaine, ce qui faisait afficher 14 % au lieu
              // de ~96 %. On compte désormais le nombre de jours qui ont
              // effectivement reçu une saisie pour ajuster le dénominateur.
              const total = data.stats.totalOeufs
              const attenduJour = data.stats.estimationOeufsJour
              const joursAvecSaisie = new Set(
                (data.productions ?? []).map((p) => p.date.slice(0, 10))
              ).size
              const denominateurJours = Math.max(1, Math.min(7, joursAvecSaisie))
              const attenduSem = attenduJour * denominateurJours
              const ratio = total > 0 && attenduSem > 0 ? (total / attenduSem) * 100 : null
              const anomalie = ratio !== null && ratio > 110
              const labelColor = anomalie ? 'text-red-700' : 'text-green-700'
              const bgColor = anomalie ? 'bg-red-50' : 'bg-green-50'
              const subColor = anomalie ? 'text-red-600' : 'text-green-600'
              const display =
                ratio === null
                  ? '—'
                  : anomalie
                  ? `${Math.round(ratio)} %` // pas de cap, on assume l'overflow visuel
                  : `${Math.round(ratio)} %`
              return (
                <div className={`${bgColor} rounded-lg p-3 text-center`}>
                  <TrendingUp className={`h-5 w-5 mx-auto ${subColor} mb-1`} />
                  {anomalie ? (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={`text-2xl font-bold ${labelColor} flex items-center justify-center gap-1 cursor-help`}>
                            {display}
                            <AlertTriangle className="h-4 w-4" />
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-left text-xs">
                          <p className="font-semibold mb-1">Saisie anormale détectée</p>
                          <p>
                            La collecte de la semaine dépasse l'attendu théorique
                            ({Math.round(attenduSem)} œufs pour cet effectif × saison).
                            Vérifiez les dernières saisies ou l'effectif du lot.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <p className={`text-2xl font-bold ${labelColor}`}>{display}</p>
                  )}
                  <p className={`text-xs ${subColor}`}>
                    Taux collecte
                    {joursAvecSaisie > 0 && joursAvecSaisie < 7 ? ` (${joursAvecSaisie}j)` : " sem."}
                  </p>
                </div>
              )
            })()}
          </div>

          {/* Bug cmp8smrwe (Marc 2026-05-16) — Toggle pour masquer les
              tâches faites dans la vue Cette semaine. Par défaut on les
              cache (seules les tâches à faire sont visibles + un footer
              de récap). */}
          <div className="flex items-center justify-end gap-2 text-xs">
            <label className="inline-flex items-center gap-1 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={showFaits}
                onChange={(e) => setShowFaits(e.target.checked)}
                className="accent-amber-500"
              />
              Afficher les tâches déjà faites
            </label>
          </div>

          {/* Vue par jour */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-7">
            {weekDays.map(({ label, date, dateKey }) => {
              const dayEvents = eventsByDay.get(dateKey)
              const isToday = dateKey === today
              const hasSoinsAFaire = dayEvents?.soins.some(s => !s.fait) || false
              const soinsAffiches = dayEvents?.soins.filter(s => showFaits || !s.fait) ?? []
              const soinsFaitsMasques = (dayEvents?.soins.filter(s => s.fait).length ?? 0)
                - (showFaits ? (dayEvents?.soins.filter(s => s.fait).length ?? 0) : 0)

              return (
                <Card
                  key={dateKey}
                  className={`${isToday ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''} ${hasSoinsAFaire ? 'border-blue-200' : ''}`}
                >
                  <CardHeader className="pb-1 pt-2 px-3">
                    <CardTitle className="text-xs font-medium flex items-center justify-between">
                      <span className={isToday ? 'text-amber-700' : 'text-muted-foreground'}>{label}</span>
                      <span className={`text-xs ${isToday ? 'bg-amber-500 text-white px-1.5 py-0.5 rounded-full' : 'text-muted-foreground'}`}>
                        {date.getDate()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1.5">
                    {/* Soins du jour */}
                    {soinsAffiches.map(soin => (
                      <button
                        key={`soin-${soin.id}`}
                        onClick={() => toggleSoin(soin.id, soin.fait)}
                        className={`w-full text-left p-1.5 rounded text-xs transition-all ${
                          soin.fait
                            ? 'bg-green-50 text-green-700 opacity-60 line-through'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {soin.fait
                            ? <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                            : <Stethoscope className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          }
                          <span className="truncate">
                            {SOIN_TYPE_LABELS[soin.type] || soin.type}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-70 truncate ml-4">
                          {soin.lot?.nom || soin.animal?.nom || ''}
                        </p>
                      </button>
                    ))}

                    {/* Récap des soins masqués (faits) */}
                    {soinsFaitsMasques > 0 && (
                      <p className="text-[10px] text-green-600 italic pl-1">
                        ✓ {soinsFaitsMasques} fait{soinsFaitsMasques > 1 ? 's' : ''}
                      </p>
                    )}

                    {/* Productions du jour */}
                    {dayEvents?.productions.map(prod => (
                      <div
                        key={`prod-${prod.id}`}
                        className="w-full p-1.5 rounded text-xs bg-yellow-50 text-yellow-700"
                      >
                        <div className="flex items-center gap-1">
                          <Egg className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                          <span>{prod.quantite} œufs</span>
                        </div>
                        {prod.lot && <p className="text-[10px] opacity-70 ml-4">{prod.lot.nom}</p>}
                      </div>
                    ))}

                    {/* Consommations du jour */}
                    {dayEvents?.consommations.map(conso => (
                      <div
                        key={`conso-${conso.id}`}
                        className="w-full p-1.5 rounded text-xs bg-orange-50 text-orange-700"
                      >
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-orange-500 flex-shrink-0" />
                          <span>{conso.quantite} kg</span>
                        </div>
                        <p className="text-[10px] opacity-70 ml-4">{conso.aliment.nom}</p>
                      </div>
                    ))}

                    {/* Jour vide */}
                    {(!dayEvents || (dayEvents.soins.length === 0 && dayEvents.productions.length === 0 && dayEvents.consommations.length === 0)) && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">-</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Liste des soins a faire (section complete) */}
          {data.soins.filter(s => !s.fait).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-blue-600" />
                  Soins à faire cette semaine
                  <Badge variant="secondary" className="ml-auto">
                    {data.soins.filter(s => !s.fait).length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data.soins.filter(s => !s.fait).map(soin => (
                    <button
                      key={soin.id}
                      onClick={() => toggleSoin(soin.id, soin.fait)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {SOIN_TYPE_LABELS[soin.type] || soin.type}
                          </Badge>
                          <span className="font-medium text-sm truncate">
                            {soin.lot?.nom || soin.animal?.nom || '-'}
                          </span>
                        </div>
                        {(soin.produit || soin.description) && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {soin.produit || soin.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(soin.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                      </span>
                      <Check className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
