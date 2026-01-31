"use client"

/**
 * Page des cultures a irriguer
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Droplets, Check, RefreshCw, Droplet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useToast } from "@/hooks/use-toast"

interface CultureIrriguer {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  aIrriguer: boolean | null
  derniereIrrigation: string | null
  espece: {
    id: string
    couleur: string | null
    besoinEau: number | null
    irrigation: string | null
  } | null
  planche: {
    id: string
    ilot: string | null
    type: string | null
    irrigation: string | null
  } | null
  variete: {
    id: string
  } | null
}

interface Stats {
  total: number
  nbIlots: number
}

function CulturesIrriguerContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CultureIrriguer[]>([])
  const [parIlot, setParIlot] = React.useState<Record<string, CultureIrriguer[]>>({})
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => currentYear - 3 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/cultures/irriguer?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setParIlot(result.parIlot)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures a irriguer",
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

      // Mettre a jour localement
      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
      ))
      setParIlot(prev => {
        const newParIlot: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          newParIlot[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
          )
        }
        return newParIlot
      })

      toast({
        title: "Mis a jour",
        description: currentValue ? "Irrigation desactivee" : "Irrigation activee",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour",
      })
    }
  }

  // Marquer une culture comme arrosee
  const marquerArrosee = async (cultureId: number) => {
    try {
      const response = await fetch("/api/cultures/irriguer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultureId, marquerArrosage: true }),
      })
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const now = result.date

      // Mettre a jour localement
      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, derniereIrrigation: now } : c
      ))
      setParIlot(prev => {
        const newParIlot: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          newParIlot[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, derniereIrrigation: now } : c
          )
        }
        return newParIlot
      })

      toast({
        title: "Arrosage note",
        description: "Derniere irrigation mise a jour",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  // Marquer tout un ilot comme arrose
  const marquerIlotArrose = async (ilot: string) => {
    const culturesIlot = parIlot[ilot]
    if (!culturesIlot || culturesIlot.length === 0) return

    try {
      const cultureIds = culturesIlot.map(c => c.id)
      const response = await fetch("/api/cultures/irriguer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultureIds, marquerArrosage: true }),
      })
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const now = result.date

      // Mettre a jour localement
      setData(prev => prev.map(c =>
        cultureIds.includes(c.id) ? { ...c, derniereIrrigation: now } : c
      ))
      setParIlot(prev => {
        const newParIlot: Record<string, CultureIrriguer[]> = {}
        for (const [i, cultures] of Object.entries(prev)) {
          newParIlot[i] = cultures.map(c =>
            cultureIds.includes(c.id) ? { ...c, derniereIrrigation: now } : c
          )
        }
        return newParIlot
      })

      toast({
        title: "Ilot arrose",
        description: `${culturesIlot.length} culture(s) marquee(s)`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  // Calculer le nombre de jours depuis derniere irrigation
  const joursDepuisIrrigation = (date: string | null): number | null => {
    if (!date) return null
    const diff = Date.now() - new Date(date).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  // Couleur selon urgence (jours sans arrosage)
  const getUrgenceColor = (jours: number | null): string => {
    if (jours === null) return "text-gray-400"
    if (jours >= 3) return "text-red-600"
    if (jours >= 2) return "text-orange-500"
    if (jours >= 1) return "text-yellow-600"
    return "text-green-600"
  }

  const getBesoinEauBadge = (besoinEau: number | null, irrigation: string | null) => {
    if (irrigation === 'Eleve' || (besoinEau && besoinEau >= 4)) {
      return <Badge variant="destructive">Eleve</Badge>
    }
    if (besoinEau && besoinEau >= 3) {
      return <Badge variant="default" className="bg-orange-500">Moyen</Badge>
    }
    return <Badge variant="secondary">Faible</Badge>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cultures">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cultures
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Droplets className="h-6 w-6 text-cyan-600" />
              <h1 className="text-xl font-bold">Cultures a irriguer</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
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
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-600" />
                  Cultures a irriguer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Ilots concernes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.nbIlots}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info */}
        <div className="mb-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <p className="text-sm text-cyan-800">
            Cette page liste les cultures en place qui necessitent une irrigation reguliere
            (besoin en eau eleve ou marque manuellement). Cochez/decochez pour gerer le statut.
          </p>
        </div>

        {/* Par ilot */}
        {Object.keys(parIlot).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune culture a irriguer pour {annee}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(parIlot).map(([ilot, cultures]) => (
              <Card key={ilot}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{ilot}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {cultures.length} culture(s)
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => marquerIlotArrose(ilot)}
                      className="text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                    >
                      <Droplet className="h-4 w-4 mr-1" />
                      Tout arroser
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cultures.map((culture) => {
                      const jours = joursDepuisIrrigation(culture.derniereIrrigation)
                      const urgenceColor = getUrgenceColor(jours)

                      return (
                        <div
                          key={culture.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={culture.aIrriguer || false}
                              onCheckedChange={() => toggleIrrigation(culture.id, culture.aIrriguer)}
                            />
                            <div className="flex items-center gap-2">
                              {culture.espece?.couleur && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: culture.espece.couleur }}
                                />
                              )}
                              <span className="font-medium">{culture.especeId}</span>
                              {culture.variete && (
                                <span className="text-sm text-muted-foreground">
                                  ({culture.variete.id})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Derniere irrigation */}
                            <div className={`text-sm flex items-center gap-1 ${urgenceColor}`}>
                              {jours !== null ? (
                                <>
                                  <Droplets className="h-3 w-3" />
                                  <span>
                                    {jours === 0 ? "Aujourd'hui" : `${jours}j`}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400 text-xs">Jamais</span>
                              )}
                            </div>

                            {/* Besoin eau */}
                            <div className="text-sm">
                              {getBesoinEauBadge(
                                culture.espece?.besoinEau || null,
                                culture.espece?.irrigation || null
                              )}
                            </div>

                            {/* Planche */}
                            {culture.planche && (
                              <Link href={`/planches/${encodeURIComponent(culture.planche.id)}`}>
                                <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200">
                                  {culture.planche.id}
                                </Badge>
                              </Link>
                            )}

                            {/* Bouton arroser */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => marquerArrosee(culture.id)}
                              className="h-8 w-8 p-0 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                              title="Marquer comme arrose"
                            >
                              <Droplet className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
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
