"use client"

/**
 * Page des cultures à irriguer — intégration météo complète
 * Affiche l'urgence d'irrigation basée sur le bilan hydrique réel et les
 * précipitations passées et prévues ; on y note les arrosages. Les lignes
 * « à arroser » des tâches en dérivent (src/lib/irrigation/a-arroser.ts).
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Droplets,
  RefreshCw,
  Droplet,
  CloudRain,
  CloudSun,
  CheckCircle2,
  Info,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import { SaisieArrosage } from "@/components/potager/SaisieArrosage"
import { consommationHebdoTotale } from "@/lib/irrigation/consommation"
import { annulerArrosage, noterArrosage } from "@/lib/irrigation/noter-arrosage"
import {
  contexteQuantiteVersee,
  detailArrosageNote,
  phraseLitresPlanche,
} from "@/lib/irrigation/quantite-versee"
import { notifierEnregistrement } from "@/lib/notifications-ecran"
import { confirmDialog } from "@/lib/global-dialog"
import { libelleIrrigation } from '@/lib/planches/libelle-irrigation'
import { formatNombre } from '@/lib/format-utils'
import { phraseExcluesTournee, phraseHorsTournee, type CultureHorsTournee } from '@/lib/irrigation/hors-tournee'

interface MeteoResume {
  pluie48h: number
  pluie7j: number
  pluiePrevue48h: number
  pluiePrevue5j: number
  joursSansPluie: number | null
  joursAvantPluie: number | null
}

interface CultureIrriguer {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  aIrriguer: boolean | null
  derniereIrrigation: string | null
  nbRangs: number | null
  longueur: number | null
  joursSansEau: number | null
  ageJours: number | null
  isJeune: boolean
  sousAbri: boolean
  urgence: 'critique' | 'haute' | 'moyenne' | 'faible' | 'aucune'
  raisonUrgence: string
  consommationEauSemaine: number
  meteo: MeteoResume | null
  /** Bilan hydrique (null sans météo) : dose pour remplir la réserve du sol. */
  reserve: {
    doseMm: number
    litresParM2: number
    litresConseilles: number
    /** Passages d'au plus 20 L/m² (1 au goutte-à-goutte). */
    passages: number
  } | null
  espece: {
    id: string
    nom: string | null
    couleur: string | null
    besoinEau: number | null
    irrigation: string | null
  } | null
  planche: {
    id: string
    nom?: string
    ilot: string | null
    type: string | null
    irrigation: string | null
    surface: number | null
    largeur: number | null
    longueur: number | null
  } | null
  variete: {
    id: string
    nom: string | null
  } | null
}

/**
 * Tournée du jour servie par la route (`tourneeDuJour`, même règle que la page
 * Tâches) : passages, cultures cochées, et cultures en urgence qu'elle écarte
 * faute d'être cochées « à irriguer » (QA cmvge3o5z).
 */
interface Tournee {
  lignes: { cle: string }[]
  nbCultures: number
  horsTournee: CultureHorsTournee[]
}

interface Stats {
  total: number
  nbIlots: number
  critique: number
  haute: number
  aucune: number
  jamaisArrose: number
  consommationTotaleEstimee: number
  parTypeIrrigation: { type: string; count: number }[]
}

function CulturesIrriguerContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CultureIrriguer[]>([])
  const [parIlot, setParIlot] = React.useState<Record<string, CultureIrriguer[]>>({})
  const [, setParTypeIrrigation] = React.useState<Record<string, CultureIrriguer[]>>({})
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [tournee, setTournee] = React.useState<Tournee | null>(null)
  const [meteoGlobal, setMeteoGlobal] = React.useState<MeteoResume | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [groupBy, setGroupBy] = React.useState<'ilot' | 'type-irrigation' | 'urgence'>('ilot')
  const [filtreUrgence, setFiltreUrgence] = React.useState<'all' | 'critique' | 'haute' | 'aucune' | 'jamais'>('all')
  const [filtreTypeIrrigation, setFiltreTypeIrrigation] = React.useState<string>('all')
  const [filtreBesoinEau, setFiltreBesoinEau] = React.useState<'all' | '3' | '4'>('all')
  // Culture dont on note l'arrosage (dialogue « Noter l'arrosage »).
  const [arrosageANoter, setArrosageANoter] = React.useState<CultureIrriguer | null>(null)
  const [arrosageEnCours, setArrosageEnCours] = React.useState(false)

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => currentYear - 3 + i)
  }, [])

  // `silencieux` : relecture après un changement de coche, sans squelette.
  const fetchData = React.useCallback(async (silencieux = false) => {
    if (!silencieux) setIsLoading(true)
    try {
      const response = await fetch(`/api/cultures/irriguer?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setParIlot(result.parIlot)
      setParTypeIrrigation(result.parTypeIrrigation || {})
      setStats(result.stats)
      setTournee(result.tournee ?? null)
      setMeteoGlobal(result.meteo || null)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures à irriguer",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleIrrigation = async (cultureId: number, currentValue: boolean | null) => {
    try {
      const response = await fetch("/api/cultures/irriguer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultureId, aIrriguer: !currentValue }),
      })
      if (!response.ok) throw new Error("Erreur")

      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
      ))
      setParIlot(prev => {
        const n: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          n[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
          )
        }
        return n
      })

      toast({
        title: "Mis à jour",
        description: currentValue ? "Irrigation désactivée" : "Irrigation activée",
      })
      // La tournée du jour dépend de la coche : on la relit du serveur.
      fetchData(true)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour",
      })
    }
  }

  // Ticket QA du 2026-10-19 : « Marquer comme arrosé » enregistrait aussitôt
  // un arrosage complet (réserve du sol remplie) sans rien demander, alors que
  // « Noter » demande les litres versés partout ailleurs. Le bouton ouvre
  // désormais le même dialogue (`SaisieArrosage`), prérempli avec la dose
  // conseillée sur la planche, et passe par le même client (`noterArrosage`).
  const noterArrosageCulture = async (
    culture: CultureIrriguer,
    litres: number | null,
    notes: string | null,
  ) => {
    setArrosageEnCours(true)
    try {
      const resultat = await noterArrosage([culture.id], notes, litres, "irriguer")
      if (!resultat.ok) throw new Error(resultat.erreur)
      setArrosageANoter(null)
      await fetchData()

      // Un geste de trop s'annule : inverse exact, comme sur les Tâches.
      notifierEnregistrement({
        titre: "Arrosage noté",
        // `||` : un nom de planche vide tombe sur le repli.
        detail: detailArrosageNote(culture.planche?.nom || culture.espece?.nom || culture.especeId, litres),
        annuler: async () => {
          const annule = await annulerArrosage(resultat.annulation)
          if (!annule.ok) throw new Error(annule.erreur)
          await fetchData()
        },
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e instanceof Error && e.message ? e.message : "Impossible de noter l'arrosage",
      })
    } finally {
      setArrosageEnCours(false)
    }
  }

  const marquerIlotArrose = async (ilot: string) => {
    const culturesIlot = parIlot[ilot]
    if (!culturesIlot || culturesIlot.length === 0) return

    // Un îlot porte plusieurs planches : une seule quantité n'y aurait pas de
    // sens, ce geste note un arrosage complet par planche. On le dit avant.
    const nbPlanches = new Set(culturesIlot.map(c => c.planche?.id ?? `culture:${c.id}`)).size
    // Clé de regroupement des planches sans îlot (`irrigation-conseil.ts`).
    const lieu = ilot === "Sans îlot" ? "sans îlot" : `de l'îlot ${ilot}`
    const confirme = await confirmDialog(
      `${nbPlanches > 1 ? `Les ${nbPlanches} planches` : "La planche"} ${lieu} ${nbPlanches > 1 ? "compteront comme arrosées" : "comptera comme arrosée"}, réserve du sol remplie. Pour noter les litres réellement versés, utilisez le bouton d'arrosage de chaque culture.`,
      { title: "Noter un arrosage complet ?", confirmLabel: "Noter l'arrosage complet" },
    )
    if (!confirme) return

    try {
      // Même client que « Noter » : événement `gleba:irrigation-updated` pour
      // les autres vues, et annulation exacte du geste.
      const resultat = await noterArrosage(culturesIlot.map(c => c.id), null, null, "irriguer")
      if (!resultat.ok) throw new Error(resultat.erreur)
      await fetchData()

      notifierEnregistrement({
        titre: "Îlot arrosé",
        detail: `${ilot} · arrosage complet de ${nbPlanches} planche${nbPlanches > 1 ? "s" : ""}, consigné dans les interventions.`,
        annuler: async () => {
          const annule = await annulerArrosage(resultat.annulation)
          if (!annule.ok) throw new Error(annule.erreur)
          await fetchData()
        },
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e instanceof Error && e.message ? e.message : "Impossible de noter l'arrosage",
      })
    }
  }

  const getUrgenceColor = (urgence: string): string => {
    if (urgence === 'critique') return "text-red-600"
    if (urgence === 'haute') return "text-orange-500"
    if (urgence === 'moyenne') return "text-yellow-600"
    if (urgence === 'aucune') return "text-green-600"
    return "text-blue-600"
  }

  const getUrgenceBadge = (urgence: string, jamais: boolean) => {
    if (urgence === 'aucune') return <Badge variant="secondary" className="bg-green-100 text-green-700">OK</Badge>
    if (jamais && urgence !== 'critique') return <Badge variant="secondary" className="bg-slate-100 text-slate-600">Jamais</Badge>
    if (urgence === 'critique') return <Badge variant="destructive">Urgent</Badge>
    if (urgence === 'haute') return <Badge className="bg-orange-500">Priorité</Badge>
    if (urgence === 'moyenne') return <Badge className="bg-yellow-500">Moyen</Badge>
    return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Faible</Badge>
  }

  const getBesoinEauBadge = (besoinEau: number | null, irrigation: string | null) => {
    if (irrigation === 'Eleve' || irrigation === 'Élevé' || (besoinEau && besoinEau >= 4)) {
      return <Badge variant="destructive">Élevé</Badge>
    }
    if (besoinEau && besoinEau >= 3) {
      return <Badge variant="default" className="bg-orange-500">Moyen</Badge>
    }
    return <Badge variant="secondary">Faible</Badge>
  }

  // Cultures en urgence jamais cochées que la tournée écarte (identifiants
  // servis par la route) ; une culture décochée exprès n'appelle pas d'invitation.
  const horsTournee = React.useMemo(
    () =>
      new Set(
        (tournee?.horsTournee ?? []).filter((c) => c.motif !== "exclue").map((c) => c.cultureId),
      ),
    [tournee],
  )

  const filteredData = React.useMemo(() => {
    let filtered = data

    if (filtreUrgence !== 'all') {
      if (filtreUrgence === 'jamais') {
        filtered = filtered.filter(c => c.joursSansEau === null)
      } else {
        filtered = filtered.filter(c => c.urgence === filtreUrgence)
      }
    }

    if (filtreTypeIrrigation !== 'all') {
      filtered = filtered.filter(c => c.planche?.irrigation === filtreTypeIrrigation)
    }

    if (filtreBesoinEau !== 'all') {
      const seuil = parseInt(filtreBesoinEau)
      filtered = filtered.filter(c => (c.espece?.besoinEau || 0) >= seuil)
    }

    return filtered
  }, [data, filtreUrgence, filtreTypeIrrigation, filtreBesoinEau])

  const groupedData = React.useMemo(() => {
    if (groupBy === 'ilot') {
      const groups: Record<string, typeof filteredData> = {}
      filteredData.forEach(c => {
        const key = c.planche?.ilot || 'Sans îlot'
        if (!groups[key]) groups[key] = []
        groups[key].push(c)
      })
      return groups
    } else if (groupBy === 'type-irrigation') {
      const groups: Record<string, typeof filteredData> = {}
      filteredData.forEach(c => {
        const key = libelleIrrigation(c.planche?.irrigation) || 'Non défini'
        if (!groups[key]) groups[key] = []
        groups[key].push(c)
      })
      return groups
    } else {
      const groups: Record<string, typeof filteredData> = {
        'Critique': filteredData.filter(c => c.urgence === 'critique'),
        'Haute': filteredData.filter(c => c.urgence === 'haute'),
        'Moyenne': filteredData.filter(c => c.urgence === 'moyenne'),
        'Faible': filteredData.filter(c => c.urgence === 'faible'),
        'OK (pas besoin)': filteredData.filter(c => c.urgence === 'aucune'),
      }
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) delete groups[key]
      })
      return groups
    }
  }, [filteredData, groupBy])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader current="maraichage" showLune />
        <PageToolbar>
          <Skeleton className="h-8 w-64" />
        </PageToolbar>
        <main className="container mx-auto px-4 py-6">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <AppHeader current="maraichage" showLune />
      <PageToolbar>
        <div className="flex items-center gap-4">
          <Link href="/maraichage/cultures">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cultures
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Droplets className="h-6 w-6 text-cyan-600" />
            <h1 className="text-xl font-bold">Irrigation</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Select
            value={annee.toString()}
            onValueChange={(value) => setAnnee(parseInt(value))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {annees.map((a) => (
                <SelectItem key={a} value={a.toString()}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageToolbar>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Bandeau meteo */}
        {meteoGlobal && (
          <div className={`mb-4 p-4 rounded-lg border ${
            meteoGlobal.pluie48h >= 8
              ? 'bg-blue-50 border-blue-200'
              : meteoGlobal.joursSansPluie !== null && meteoGlobal.joursSansPluie >= 5
              ? 'bg-orange-50 border-orange-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-start gap-3">
              {meteoGlobal.pluie48h >= 8 ? (
                <CloudRain className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              ) : meteoGlobal.pluiePrevue48h >= 5 ? (
                <CloudRain className="h-5 w-5 text-cyan-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CloudSun className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium">
                    {meteoGlobal.pluie48h >= 8
                      ? `Il a plu ${Math.round(meteoGlobal.pluie48h)}mm ces 2 derniers jours`
                      : meteoGlobal.pluie7j >= 10
                      ? `${Math.round(meteoGlobal.pluie7j)}mm de pluie cette semaine`
                      : meteoGlobal.joursSansPluie !== null && meteoGlobal.joursSansPluie >= 3
                      ? `${meteoGlobal.joursSansPluie} jours sans pluie`
                      : 'Conditions normales'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>7j: {Math.round(meteoGlobal.pluie7j)}mm</span>
                  <span>48h: {Math.round(meteoGlobal.pluie48h)}mm</span>
                  {meteoGlobal.pluiePrevue48h > 0 && (
                    <span className="text-blue-600">
                      +{Math.round(meteoGlobal.pluiePrevue48h)}mm prévus (48h)
                    </span>
                  )}
                  {meteoGlobal.pluiePrevue5j > 0 && (
                    <span className="text-blue-600">
                      +{Math.round(meteoGlobal.pluiePrevue5j)}mm prévus (5j)
                    </span>
                  )}
                  {meteoGlobal.joursAvantPluie !== null && meteoGlobal.joursAvantPluie > 0 && (
                    <span>Prochaine pluie dans {meteoGlobal.joursAvantPluie}j</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ilot">Grouper par îlot</SelectItem>
              <SelectItem value="type-irrigation">Par type irrigation</SelectItem>
              <SelectItem value="urgence">Par urgence</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtreUrgence} onValueChange={(v) => setFiltreUrgence(v as typeof filtreUrgence)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Urgence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes urgences</SelectItem>
              <SelectItem value="critique">Critique</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="aucune">OK (pas besoin)</SelectItem>
              <SelectItem value="jamais">Jamais arrosé</SelectItem>
            </SelectContent>
          </Select>

          {stats && stats.parTypeIrrigation.length > 0 && (
            <Select value={filtreTypeIrrigation} onValueChange={setFiltreTypeIrrigation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type irrigation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {stats.parTypeIrrigation.map(t => (
                  <SelectItem key={t.type} value={t.type}>
                    {t.type} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filtreBesoinEau} onValueChange={(v) => setFiltreBesoinEau(v as typeof filtreBesoinEau)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Besoin eau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous besoins</SelectItem>
              <SelectItem value="4">Élevé (4+)</SelectItem>
              <SelectItem value="3">Moyen (3)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-600" />
                  Cultures suivies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
                {stats.aucune > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {stats.aucune === 1
                      ? "1 n'a pas besoin d'arrosage"
                      : `${stats.aucune} n'ont pas besoin d'arrosage`}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className={stats.critique > 0 ? "border-red-300 bg-red-50" : stats.critique + stats.haute === 0 ? "border-green-300 bg-green-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Urgences</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.critique + stats.haute > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-red-600">{stats.critique + stats.haute}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.critique} critique · {stats.haute} haute
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-600">0</p>
                    <p className="text-xs text-green-600 mt-1">Aucune urgence</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">À arroser aujourd&apos;hui</CardTitle>
              </CardHeader>
              <CardContent>
                {/* QA cmvge3o5z — même tournée que la page Tâches (cultures
                    cochées « à irriguer » en urgence critique ou haute, un
                    passage par planche) ; les urgences non cochées sont
                    nommées au lieu d'être comptées en silence. */}
                {tournee ? (
                  <>
                    <p className="text-2xl font-bold text-blue-600">{tournee.lignes.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tournee.lignes.length > 1 ? "passages" : "passage"} de la tournée du jour (page Tâches)
                      {tournee.nbCultures > 0 &&
                        ` · ${tournee.nbCultures} culture${tournee.nbCultures > 1 ? "s" : ""} cochée${tournee.nbCultures > 1 ? "s" : ""}`}
                    </p>
                    {phraseHorsTournee(tournee.horsTournee) && (
                      <p className="text-xs text-orange-700 mt-1">{phraseHorsTournee(tournee.horsTournee)}</p>
                    )}
                    {phraseExcluesTournee(tournee.horsTournee) && (
                      <p className="text-xs text-muted-foreground mt-1">{phraseExcluesTournee(tournee.horsTournee)}</p>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-bold text-blue-600">—</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Consommation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyan-600">{stats.consommationTotaleEstimee}L</p>
                <p className="text-xs text-muted-foreground mt-1">par semaine (estimé)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Groupes */}
        {Object.keys(groupedData).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {filtreUrgence !== 'all' || filtreTypeIrrigation !== 'all' || filtreBesoinEau !== 'all'
                ? 'Aucune culture ne correspond aux filtres'
                : `Aucune culture à irriguer pour ${annee}`}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([groupe, cultures]) => {
              // QA cmsqlstoi — même règle que le KPI Consommation : une planche
              // multiculture est arrosée en un seul passage, donc on dédoublonne
              // par planche au lieu d'additionner culture par culture.
              const consommationGroupe = consommationHebdoTotale(cultures)
              const okCount = cultures.filter(c => c.urgence === 'aucune').length

              return (
              <Card key={groupe}>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="whitespace-nowrap">{groupe}</Badge>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {cultures.length} culture(s)
                      </span>
                      {okCount === cultures.length ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Tout OK
                        </Badge>
                      ) : (
                        groupBy === 'ilot' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => marquerIlotArrose(groupe)}
                            className="text-cyan-600 border-cyan-300 hover:bg-cyan-50 whitespace-nowrap"
                          >
                            <Droplet className="h-4 w-4 mr-1" />
                            Tout arroser
                          </Button>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Droplets className="h-3 w-3 text-cyan-600 flex-shrink-0" />
                        <span>{Math.round(consommationGroupe)}L/sem</span>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cultures.map((culture) => {
                      const jamais = culture.joursSansEau === null
                      const urgenceColor = getUrgenceColor(culture.urgence)
                      // Volume conseillé pour la PLANCHE : le chiffre que le
                      // dialogue « Noter l'arrosage » préremplit.
                      const litresPlanche = phraseLitresPlanche(contexteQuantiteVersee(culture))
                      const libelleNoter = `Noter l'arrosage de ${culture.espece?.nom || culture.especeId}${culture.planche ? ` (${culture.planche.nom || culture.planche.id})` : ""}`

                      return (
                        <div
                          key={culture.id}
                          className={`flex flex-col gap-2 p-3 rounded-lg transition-colors ${
                            culture.urgence === 'critique' ? 'bg-red-50 border border-red-200' :
                            culture.urgence === 'haute' ? 'bg-orange-50 border border-orange-200' :
                            culture.urgence === 'aucune' ? 'bg-green-50/50 border border-green-100' :
                            'bg-slate-50'
                          }`}
                        >
                          {/* Ligne principale */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={culture.aIrriguer || false}
                                onCheckedChange={() => toggleIrrigation(culture.id, culture.aIrriguer)}
                                className="mt-1 sm:mt-0"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {culture.espece?.couleur && (
                                    <div
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: culture.espece.couleur }}
                                    />
                                  )}
                                  <span className="font-medium break-words">{culture.espece?.nom ?? culture.especeId}</span>
                                  {culture.variete && (
                                    <span className="text-sm text-muted-foreground break-words">
                                      ({culture.variete.nom ?? culture.variete.id})
                                    </span>
                                  )}
                                  {culture.sousAbri && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Abri</Badge>
                                  )}
                                </div>

                                {/* Info culture */}
                                <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                                  {culture.ageJours !== null && (
                                    <span className={culture.isJeune ? "text-green-600 font-medium" : ""}>
                                      {culture.ageJours < 7
                                        ? `${culture.ageJours}j`
                                        : `${Math.floor(culture.ageJours / 7)}sem`}
                                      {culture.isJeune && " (jeune)"}
                                    </span>
                                  )}
                                  {culture.planche?.irrigation && (
                                    <span className="flex items-center gap-1">
                                      <Droplets className="h-3 w-3" />
                                      {libelleIrrigation(culture.planche.irrigation)}
                                    </span>
                                  )}
                                  {culture.consommationEauSemaine > 0 && (
                                    <span>~{Math.round(culture.consommationEauSemaine)}L/sem</span>
                                  )}
                                </div>
                                {horsTournee.has(culture.id) && (
                                  <p className="mt-1 text-xs text-orange-700">
                                    Hors de la tournée du jour : cochez « à irriguer » pour l&apos;ajouter aux tâches.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {getUrgenceBadge(culture.urgence, jamais)}

                              <div className={`text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap ${urgenceColor}`}>
                                {!jamais ? (
                                  <>
                                    <Droplets className="h-3 w-3 flex-shrink-0" />
                                    <span>
                                      {culture.joursSansEau === 0 ? "Auj." : `${culture.joursSansEau}j`}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-xs">Jamais</span>
                                )}
                              </div>

                              {/* Meteo culture */}
                              {culture.meteo && culture.meteo.pluie48h > 0 && (
                                <span className="text-xs text-blue-500 flex items-center gap-0.5">
                                  <CloudRain className="h-3 w-3" />
                                  {Math.round(culture.meteo.pluie48h)}mm
                                </span>
                              )}

                              <div className="text-sm">
                                {getBesoinEauBadge(
                                  culture.espece?.besoinEau || null,
                                  culture.espece?.irrigation || null
                                )}
                              </div>

                              {culture.planche && (
                                <Link href={`/maraichage/planches/${encodeURIComponent(culture.planche.id)}`}>
                                  <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200 whitespace-nowrap">
                                    {culture.planche.nom || culture.planche.id}
                                  </Badge>
                                </Link>
                              )}

                              {culture.urgence !== 'aucune' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setArrosageANoter(culture)}
                                  className="h-8 w-8 p-0 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                  title={libelleNoter}
                                  aria-label={libelleNoter}
                                >
                                  <Droplet className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Raison urgence */}
                          {culture.raisonUrgence && (
                            <div className="flex items-start gap-1.5 pl-9 sm:pl-10">
                              <Info className={`h-3 w-3 flex-shrink-0 mt-0.5 ${urgenceColor}`} />
                              <p className={`text-xs ${urgenceColor}`}>
                                {culture.raisonUrgence}
                                {culture.reserve && culture.reserve.litresParM2 > 0 && (
                                  <>
                                    {/* Nombres à la française (QA cmv3javy4). */}
                                    {" "}Dose conseillée : {formatNombre(culture.reserve.litresParM2, 1)} L/m²
                                    {litresPlanche && `, ${litresPlanche}`}
                                    {culture.reserve.passages >= 2 &&
                                      `, en ${culture.reserve.passages} passages d'environ ${Math.round(culture.reserve.litresParM2 / culture.reserve.passages)} L/m² espacés de quelques heures`}.
                                  </>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
            })}
          </div>
        )}

        {/* Historique récent */}
        {filteredData.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Historique récent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {filteredData
                  .filter(c => c.derniereIrrigation)
                  .sort((a, b) => new Date(b.derniereIrrigation!).getTime() - new Date(a.derniereIrrigation!).getTime())
                  .slice(0, 10)
                  .map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2">
                        {c.espece?.couleur && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: c.espece.couleur }}
                          />
                        )}
                        <span>{c.espece?.nom ?? c.especeId}</span>
                        {c.planche && (
                          <Badge variant="secondary" className="text-xs">{c.planche.nom || c.planche.id}</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {new Date(c.derniereIrrigation!).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                {filteredData.filter(c => c.derniereIrrigation).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Aucun arrosage enregistre</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={arrosageANoter !== null} onOpenChange={(nextOpen) => {
        if (!nextOpen && !arrosageEnCours) setArrosageANoter(null)
      }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-[430px]">
          {arrosageANoter && (
            <SaisieArrosage
              key={arrosageANoter.id}
              arrosage={contexteQuantiteVersee(arrosageANoter)}
              libelle={[
                arrosageANoter.planche ? arrosageANoter.planche.nom || arrosageANoter.planche.id : null,
                arrosageANoter.espece?.nom ?? arrosageANoter.especeId,
              ].filter(Boolean).join(" · ")}
              enCours={arrosageEnCours}
              onNoter={(litres, notes) => noterArrosageCulture(arrosageANoter, litres, notes)}
              onRetour={() => setArrosageANoter(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CulturesIrriguerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesIrriguerContent />
    </Suspense>
  )
}
