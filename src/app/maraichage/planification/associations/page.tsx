"use client"

/**
 * Page Associations de cultures
 * Affiche les cultures sur planches voisines
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Users } from "lucide-react"

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

interface AssociationCulture {
  plancheId: string
  ilot: string | null
  cultureEspeceId: string | null
  cultureSemaine: number | null
  planchesVoisines: string[]
  culturesVoisines: {
    plancheId: string
    especeId: string | null
    eval: "favorable" | "defavorable" | "neutre"
    evalMessage: string | null
  }[]
  scoreAssociation: "favorable" | "defavorable" | "mixte" | "neutre"
}

const columns: ColumnDef<AssociationCulture>[] = [
  {
    accessorKey: "plancheId",
    header: "Planche",
    cell: ({ row }) => (
      <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
        <Badge variant="default" className="cursor-pointer">
          {row.original.plancheId}
        </Badge>
      </Link>
    ),
  },
  {
    accessorKey: "ilot",
    header: "Îlot",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "cultureEspeceId",
    header: "Culture",
    cell: ({ row }) => {
      const { cultureEspeceId, cultureSemaine } = row.original
      if (!cultureEspeceId) return "-"
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{cultureEspeceId}</span>
          {cultureSemaine && (
            <Badge variant="outline" className="text-xs">
              S{cultureSemaine}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "planchesVoisines",
    header: "Planches voisines",
    cell: ({ row }) => {
      const voisines = row.original.planchesVoisines
      if (voisines.length === 0) return <span className="text-muted-foreground">Aucune</span>
      return (
        <div className="flex flex-wrap gap-1">
          {voisines.map((p) => (
            <Link key={p} href={`/maraichage/planches/${encodeURIComponent(p)}`}>
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-slate-200">
                {p}
              </Badge>
            </Link>
          ))}
        </div>
      )
    },
  },
  {
    id: "culturesVoisines",
    header: "Cultures voisines",
    cell: ({ row }) => {
      const voisines = row.original.culturesVoisines
      if (voisines.length === 0) return <span className="text-muted-foreground">Aucune</span>
      // Bug #6 — Badge coloré + emoji selon l'évaluation pour donner
      // immédiatement la lecture bénéfique/néfaste promise par le bandeau.
      const colorByEval = {
        favorable: "bg-green-50 border-green-300 text-green-800",
        defavorable: "bg-red-50 border-red-300 text-red-800",
        neutre: "",
      } as const
      const iconByEval = {
        favorable: "🟢",
        defavorable: "🔴",
        neutre: "",
      } as const
      return (
        <div className="flex flex-wrap gap-1">
          {voisines.map((cv) => (
            <Badge
              key={cv.plancheId}
              variant="outline"
              className={`text-xs ${colorByEval[cv.eval]}`}
              title={cv.evalMessage || undefined}
            >
              {iconByEval[cv.eval]} {cv.plancheId}: {cv.especeId || "?"}
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    id: "scoreAssociation",
    header: "Bilan",
    cell: ({ row }) => {
      const s = row.original.scoreAssociation
      if (s === "favorable") return <Badge className="bg-green-600 text-white">🟢 Favorable</Badge>
      if (s === "defavorable") return <Badge className="bg-red-600 text-white">🔴 Défavorable</Badge>
      if (s === "mixte") return <Badge className="bg-amber-500 text-white">🟠 Mixte</Badge>
      return <Badge variant="outline" className="text-slate-500">Neutre</Badge>
    },
  },
]

function AssociationsContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<AssociationCulture[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [stats, setStats] = React.useState<{ totalPlanches: number; planchesAvecVoisins: number }>({
    totalPlanches: 0,
    planchesAvecVoisins: 0,
  })

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/associations?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les associations",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    const headers = ["Planche", "Îlot", "Culture", "Semaine", "Planches voisines", "Cultures voisines", "Bilan"]
    const rows = data.map(a => [
      a.plancheId,
      a.ilot || "",
      a.cultureEspeceId || "",
      a.cultureSemaine?.toString() || "",
      a.planchesVoisines.join(", "),
      a.culturesVoisines.map(cv => `${cv.eval === "favorable" ? "+" : cv.eval === "defavorable" ? "-" : "="} ${cv.plancheId}:${cv.especeId || "?"}`).join(", "),
      a.scoreAssociation,
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `associations-${annee}.csv`
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
            <Users className="h-6 w-6 text-pink-600" />
            <h1 className="text-xl font-bold">Associations de cultures</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {stats.planchesAvecVoisins} / {stats.totalPlanches} avec voisins
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

      <main>
        {/* Info — Bug cmp8sbe6d (Marc 2026-05-16) : accents + clarification.
            Les voisinages sont désormais dérivés automatiquement de la
            proximité géographique (positions sur le Plan du jardin). */}
        <div className="mb-4 p-4 bg-pink-50 rounded-lg border border-pink-200">
          <p className="text-sm text-pink-800">
            Cette page affiche les cultures prévues et leurs voisines, dérivées
            de la <Link href="/jardin" className="underline">cartographie du jardin</Link> :
            deux planches sont considérées voisines si elles partagent un côté ou
            se trouvent à moins de 2 m l&apos;une de l&apos;autre. Cela permet
            de vérifier les associations bénéfiques ou néfastes entre cultures.
          </p>
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
          emptyMessage="Aucune association trouvée. Définissez les planches influencées dans les paramètres des planches."
        />
      </main>
    </div>
  )
}

export default function AssociationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <AssociationsContent />
    </Suspense>
  )
}
