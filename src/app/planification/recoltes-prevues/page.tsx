"use client"

/**
 * Page Recoltes prevues par mois
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, BarChart3 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface RecoltePrevue {
  periode: string
  periodeNum: number
  especes: { especeId: string; especeCouleur: string | null; quantite: number; surface: number }[]
  totalKg: number
  totalSurface: number
}

interface Stats {
  totalAnnee: number
  surfaceTotale: number
  meilleurePeriode: string
  meilleureQuantite: number
}

function RecoltesPrevuesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<RecoltePrevue[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/recoltes-prevues?annee=${annee}&groupBy=mois`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les recoltes prevues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Preparer les donnees pour le graphique
  const chartData = data.map(r => ({
    mois: r.periode.substring(0, 3),
    quantite: Math.round(r.totalKg * 10) / 10,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/?tab=planification">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Planification
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold">Recoltes prevues par mois</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {stats && (
              <Badge variant="outline" className="text-lg">
                {stats.totalAnnee} kg/an
              </Badge>
            )}
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

      <main className="container mx-auto px-4 py-6">
        {/* Onglets */}
        <div className="flex gap-2 mb-4">
          <Link href={`/planification/recoltes-prevues?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par mois
            </Button>
          </Link>
          <Link href={`/planification/recoltes-prevues/par-semaines?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par semaines
            </Button>
          </Link>
        </div>

        {/* Graphique */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recoltes mensuelles prevues</CardTitle>
            <CardDescription>
              Quantite en kg par mois pour {annee}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis unit=" kg" />
                  <Tooltip
                    formatter={(value) => [`${value} kg`, "Recolte"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="quantite" fill="#9333ea" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Detail par mois</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead>Especes</TableHead>
                    <TableHead className="text-right">Quantite (kg)</TableHead>
                    <TableHead className="text-right">Surface (m2)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.periode} className={r.totalKg === 0 ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{r.periode}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.especes.slice(0, 5).map((e) => (
                            <Badge
                              key={e.especeId}
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: e.especeCouleur || undefined,
                                backgroundColor: e.especeCouleur ? `${e.especeCouleur}20` : undefined,
                              }}
                            >
                              {e.especeId}: {e.quantite.toFixed(1)} kg
                            </Badge>
                          ))}
                          {r.especes.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{r.especes.length - 5}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.totalKg.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.totalSurface.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function RecoltesPrevuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <RecoltesPrevuesContent />
    </Suspense>
  )
}
