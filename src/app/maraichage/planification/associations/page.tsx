"use client"

/**
 * Page Associations de cultures
 * Affiche les cultures sur planches voisines
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useAnneePlanification } from "@/hooks/use-annee-planification"
import { SelecteurAnneePlanification } from "@/components/maraichage/SelecteurAnneePlanification"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Users } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { telechargerCsv } from "@/app/maraichage/planification/export-csv"
import { libelleBilan, lignesCsvVoisinage, texteCulturesVoisines } from "./texte-voisinage"

interface AssociationCulture {
  plancheId: string
  ilot: string | null
  cultureEspeceId: string | null
  cultureEspeceNom?: string | null
  cultureSemaine: number | null
  planchesVoisines: string[]
  culturesVoisines: {
    plancheId: string
    especeId: string | null
    especeNom?: string | null
    memePlanche?: boolean
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
    id: "cultureEspeceId",
    // Le nom, pas l'identifiant technique d'une espèce personnelle.
    accessorFn: (a) => a.cultureEspeceNom || a.cultureEspeceId || "",
    header: "Culture",
    cell: ({ row }) => {
      const { cultureEspeceId, cultureEspeceNom, cultureSemaine } = row.original
      if (!cultureEspeceId) return "-"
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{cultureEspeceNom || cultureEspeceId}</span>
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
    // Valeur texte : sans elle la colonne n'est ni cherchable ni triable.
    accessorFn: (a) => texteCulturesVoisines(a),
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
          {voisines.map((cv, i) => (
            <Badge
              // Deux successions de la même espèce sur la planche voisine : l'index départage.
              key={`${cv.plancheId}:${cv.especeId ?? "?"}:${i}`}
              variant="outline"
              className={`text-xs ${colorByEval[cv.eval]}`}
              title={cv.evalMessage || undefined}
            >
              {iconByEval[cv.eval]} {cv.memePlanche ? "même planche" : cv.plancheId}: {cv.especeNom || cv.especeId || "?"}
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    id: "scoreAssociation",
    // Permet d'isoler les lignes « Défavorable » par la recherche ou le tri.
    accessorFn: (a) => libelleBilan(a.scoreAssociation),
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
  const { toast } = useToast()

  const [data, setData] = React.useState<AssociationCulture[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [erreur, setErreur] = React.useState(false)
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  const [stats, setStats] = React.useState<{ totalPlanches: number; planchesAvecVoisins: number }>({
    totalPlanches: 0,
    planchesAvecVoisins: 0,
  })


  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setErreur(false)
    try {
      const response = await fetch(`/api/planification/associations?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch {
      // Un échec ne doit pas se lire comme « aucune culture prévue ».
      setErreur(true)
      setData([])
      setStats({ totalPlanches: 0, planchesAvecVoisins: 0 })
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
    // Ne pas charger la saison courante avant d'avoir restauré la saison
    // mémorisée : la réponse tardive écraserait les données de la bonne année.
    if (!anneePrete) return
    fetchData()
  }, [anneePrete, fetchData])

  const handleExport = () => {
    telechargerCsv(`associations-${annee}.csv`, lignesCsvVoisinage(data))
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        {/* Responsive 360px — retour + titre débordent sinon */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/maraichage?tab=planification">
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
            {/* Le compte porte sur les cultures prévues, pas sur les planches. */}
            {stats.planchesAvecVoisins} / {stats.totalPlanches} cultures avec planches voisines
          </Badge>
          <SelecteurAnneePlanification annee={annee} annees={annees} onChange={definirAnnee} />
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
            se trouvent à moins de 2 m l&apos;une de l&apos;autre. Seules les cultures
            en place en même temps sont comparées, y compris sur une même planche.
            Cela permet de vérifier les associations bénéfiques ou néfastes entre cultures.
          </p>
        </div>

        {erreur && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <span>Les associations de {annee} n&apos;ont pas pu être chargées.</span>
            <Button variant="outline" size="sm" onClick={fetchData}>
              Réessayer
            </Button>
          </div>
        )}

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
          emptyMessage={
            erreur
              ? "Chargement impossible."
              : `Aucune culture prévue en ${annee}. Les voisinages se lisent sur les cultures planifiées et la position des planches sur le plan du jardin.`
          }
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
