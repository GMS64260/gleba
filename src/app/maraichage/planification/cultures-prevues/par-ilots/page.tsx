"use client"

/**
 * Page Cultures prevues par ilot
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Map, CheckCircle2, XCircle } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useAnneePlanification } from "@/hooks/use-annee-planification"

interface CulturePrevue {
  plancheId: string
  ilot: string | null
  especeId: string | null
  especeNom?: string | null
  especeCouleur: string | null
  itpId: string | null
  itpNom?: string | null
  annee: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  surface: number
  existante: boolean
}


const columns: ColumnDef<CulturePrevue>[] = [
  {
    accessorKey: "ilot",
    header: "Îlot",
    cell: ({ getValue }) => {
      const ilot = getValue() as string | null
      return ilot ? (
        <Badge variant="outline" className="font-medium">
          {ilot}
        </Badge>
      ) : (
        <span className="text-muted-foreground">Sans îlot</span>
      )
    },
  },
  {
    accessorKey: "plancheId",
    header: "Planche",
    cell: ({ row }) => (
      <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
        <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">
          {row.original.plancheId}
        </Badge>
      </Link>
    ),
  },
  {
    accessorKey: "especeId",
    header: "Espèce",
    cell: ({ row }) => {
      const culture = row.original
      return (
        <div className="flex items-center gap-2">
          {culture.especeCouleur && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: culture.especeCouleur }}
            />
          )}
          <span>{culture.especeNom ?? culture.especeId ?? "-"}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "semaineSemis",
    header: "Semis",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "semaineRecolte",
    header: "Récolte",
    cell: ({ getValue }) => formatSemaine(getValue() as number | null),
  },
  {
    accessorKey: "surface",
    header: "Surface",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m2`,
  },
  {
    accessorKey: "existante",
    header: "Statut",
    cell: ({ getValue }) => {
      const existante = getValue() as boolean
      return existante ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-slate-400" />
      )
    },
  },
]

function CulturesPrevuesParIlotsContent() {
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  const [stats, setStats] = React.useState<{ parIlot: Record<string, number> }>({ parIlot: {} })


  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}&groupBy=ilot`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures prévues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    // Ne pas charger la saison courante avant d'avoir restauré la saison
    // mémorisée : la réponse tardive écraserait les données de la bonne année.
    if (!anneePrete) return
    fetchData()
  }, [anneePrete, fetchData])

  const handleExport = () => {
    const headers = ["Îlot", "Planche", "Espèce", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m2)", "Statut"]
    const rows = data.map(c => [
      c.ilot || "Sans îlot",
      c.plancheId,
      c.especeNom ?? c.especeId ?? "",
      c.semaineSemis?.toString() || "",
      c.semainePlantation?.toString() || "",
      c.semaineRecolte?.toString() || "",
      c.surface.toFixed(1),
      c.existante ? "Créée" : "À créer",
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cultures-prevues-ilots-${annee}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        {/* Responsive 360px — retour + titre débordent sinon */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/?tab=planification">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Planification
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 text-amber-600" />
            <h1 className="text-xl font-bold">Cultures prévues par ilot</h1>
          </div>
        </div>

        {/* Responsive 360px — badges îlots + select ne tiennent pas sur une ligne */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {Object.entries(stats.parIlot).slice(0, 3).map(([ilot, count]) => (
              <Badge key={ilot} variant="outline">
                {ilot}: {count}
              </Badge>
            ))}
          </div>
          <Select
            value={annee.toString()}
            onValueChange={(value) => definirAnnee(parseInt(value))}
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

      <main>
        {/* Onglets */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Link href={`/maraichage/planification/cultures-prevues?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par espèce
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-ilots?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par ilots
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par planches
            </Button>
          </Link>
        </div>

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pageCount={1}
          pageIndex={0}
          pageSize={data.length || 50}
          onPaginationChange={() => {}}
          onRefresh={fetchData}
          onExport={handleExport}
          searchPlaceholder="Rechercher..."
          emptyMessage="Aucune culture prévue."
        />
      </main>
    </div>
  )
}

export default function CulturesPrevuesParIlotsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesParIlotsContent />
    </Suspense>
  )
}
