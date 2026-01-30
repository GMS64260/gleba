"use client"

/**
 * Page Recoltes prevues par semaine
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarRange } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  especes: { especeId: string; especeCouleur: string | null; quantite: number }[]
  totalKg: number
}

function RecoltesPrevuesParSemainesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<RecoltePrevue[]>([])
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
      const response = await fetch(`/api/planification/recoltes-prevues?annee=${annee}&groupBy=semaine`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
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

  // Filtrer les semaines avec des recoltes
  const semainesAvecRecoltes = data.filter(r => r.totalKg > 0)
  const totalAnnee = data.reduce((sum, r) => sum + r.totalKg, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/planification">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Planification
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <CalendarRange className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-bold">Recoltes prevues par semaine</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg">
              {totalAnnee.toFixed(1)} kg/an
            </Badge>
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
            <Button variant="outline" size="sm">
              Par mois
            </Button>
          </Link>
          <Link href={`/planification/recoltes-prevues/par-semaines?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par semaines
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-4 text-sm text-muted-foreground">
          {semainesAvecRecoltes.length} semaines avec des recoltes prevues
        </div>

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Calendrier des recoltes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead className="w-[80px]">Semaine</TableHead>
                      <TableHead>Especes</TableHead>
                      <TableHead className="text-right w-[100px]">Total (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((r) => (
                      <TableRow
                        key={r.periode}
                        className={r.totalKg === 0 ? "opacity-30 h-8" : ""}
                      >
                        <TableCell className="font-medium">{r.periode}</TableCell>
                        <TableCell>
                          {r.totalKg > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.especes.map((e) => (
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
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {r.totalKg > 0 ? r.totalKg.toFixed(1) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function RecoltesPrevuesParSemainesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <RecoltesPrevuesParSemainesContent />
    </Suspense>
  )
}
