"use client"

/**
 * Page Creer les cultures
 * Permet de creer les cultures a partir du plan de rotation
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, FileStack, CheckCircle2, Plus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

interface CulturePrevue {
  plancheId: string
  ilot: string | null
  especeId: string | null
  especeCouleur: string | null
  itpId: string | null
  annee: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  surface: number
  existante: boolean
}

function CreerCulturesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreating, setIsCreating] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setSelectedIds(new Set())
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures prevues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Cultures a creer (non existantes avec un ITP)
  const culturesACreer = data.filter(c => !c.existante && c.itpId)

  // Generer un ID unique pour chaque culture
  const getCultureKey = (c: CulturePrevue) => `${c.plancheId}|${c.itpId}|${c.annee}`

  // Toggle selection
  const toggleSelection = (key: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedIds(newSelected)
  }

  // Selectionner tout
  const selectAll = () => {
    if (selectedIds.size === culturesACreer.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(culturesACreer.map(getCultureKey)))
    }
  }

  // Creer les cultures selectionnees
  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Selectionnez au moins une culture a creer",
      })
      return
    }

    setIsCreating(true)
    try {
      const culturesToCreate = culturesACreer
        .filter(c => selectedIds.has(getCultureKey(c)))
        .map(c => ({
          plancheId: c.plancheId,
          itpId: c.itpId!,
          annee: c.annee,
        }))

      const response = await fetch("/api/planification/creer-cultures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultures: culturesToCreate }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la creation")
      }

      const result = await response.json()
      toast({
        title: "Cultures creees",
        description: `${result.created} culture(s) creee(s) avec succes`,
      })

      // Recharger les donnees
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la creation",
      })
    } finally {
      setIsCreating(false)
    }
  }

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
              <FileStack className="h-6 w-6 text-teal-600" />
              <h1 className="text-xl font-bold">Creer les cultures</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total prevues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Deja creees</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {data.filter(c => c.existante).length}
              </p>
            </CardContent>
          </Card>
          <Card className={culturesACreer.length > 0 ? "border-teal-200 bg-teal-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">A creer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-teal-600">{culturesACreer.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        {culturesACreer.length > 0 && (
          <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedIds.size === culturesACreer.length && culturesACreer.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm">
                {selectedIds.size} / {culturesACreer.length} selectionnee(s)
              </span>
            </div>
            <Button
              onClick={handleCreate}
              disabled={selectedIds.size === 0 || isCreating}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Creer {selectedIds.size} culture(s)
            </Button>
          </div>
        )}

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Cultures a creer</CardTitle>
            <CardDescription>
              Selectionnez les cultures a creer a partir du plan de rotation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : culturesACreer.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <p className="text-lg font-medium">Toutes les cultures sont deja creees</p>
                <p className="mt-2">
                  Ou aucune planche n'a de rotation assignee.
                </p>
                <Link href="/planches" className="mt-4 inline-block">
                  <Button variant="outline">
                    Gerer les planches
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Planche</TableHead>
                    <TableHead>Ilot</TableHead>
                    <TableHead>Espece</TableHead>
                    <TableHead>ITP</TableHead>
                    <TableHead>Semis</TableHead>
                    <TableHead>Plantation</TableHead>
                    <TableHead>Recolte</TableHead>
                    <TableHead>Surface</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {culturesACreer.map((c) => {
                    const key = getCultureKey(c)
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(key)}
                            onCheckedChange={() => toggleSelection(key)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link href={`/planches/${encodeURIComponent(c.plancheId)}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                              {c.plancheId}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>{c.ilot || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.especeCouleur && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: c.especeCouleur }}
                              />
                            )}
                            {c.especeId || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{c.itpId || "-"}</TableCell>
                        <TableCell>{c.semaineSemis ? `S${c.semaineSemis}` : "-"}</TableCell>
                        <TableCell>{c.semainePlantation ? `S${c.semainePlantation}` : "-"}</TableCell>
                        <TableCell>{c.semaineRecolte ? `S${c.semaineRecolte}` : "-"}</TableCell>
                        <TableCell>{c.surface.toFixed(1)} m2</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function CreerCulturesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CreerCulturesContent />
    </Suspense>
  )
}
