"use client"

/**
 * Page Plants nécessaires
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useAnneePlanification, useChargementPlanification } from "@/hooks/use-annee-planification"
import {
  ErreurChargementPlanification,
  SelecteurAnneePlanification,
} from "@/components/maraichage/SelecteurAnneePlanification"
import { telechargerCsv } from "../export-csv"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Package, AlertTriangle, Leaf } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface BesoinPlant {
  especeId: string
  especeNom?: string
  especeCouleur: string | null
  varieteId: string | null
  varieteNom?: string | null
  nbPlants: number
  semainePlantation: number | null
  stockActuel: number
  aCommander: number
  cultures: { plancheId: string; surface: number; nbPlants: number }[]
}

interface Stats {
  nbEspeces: number
  totalPlants: number
  totalCultures: number
  totalACommander: number
  especesSansStock: number
  parSemaine: Record<number, number>
}

const columns: ColumnDef<BesoinPlant>[] = [
  {
    // Tri et recherche sur le NOM affiché : l'identifiant d'une espèce ou
    // d'une variété personnelle est un cuid, introuvable par son nom.
    id: "especeId",
    accessorFn: (b) => b.especeNom ?? b.especeId,
    header: "Espèce",
    cell: ({ row }) => {
      const b = row.original
      return (
        <div className="flex items-center gap-2">
          {b.especeCouleur && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: b.especeCouleur }}
            />
          )}
          <span className="font-medium">{b.especeNom ?? b.especeId}</span>
        </div>
      )
    },
  },
  {
    id: "varieteId",
    accessorFn: (b) => b.varieteNom ?? b.varieteId ?? "",
    header: "Variété",
    cell: ({ row }) => row.original.varieteNom ?? row.original.varieteId ?? "-",
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => {
      const s = getValue() as number | null
      return s ? (
        <Badge variant="outline">S{s}</Badge>
      ) : "-"
    },
  },
  {
    accessorKey: "nbPlants",
    header: "Nb plants",
    cell: ({ getValue }) => (
      <span className="font-medium">{(getValue() as number).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "stockActuel",
    header: "Stock",
    cell: ({ getValue }) => {
      const val = getValue() as number
      return val > 0 ? val.toLocaleString() : "-"
    },
  },
  {
    accessorKey: "aCommander",
    header: "À commander",
    cell: ({ row }) => {
      const val = row.original.aCommander
      if (val <= 0) {
        return <Badge variant="default" className="bg-green-600">OK</Badge>
      }
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {val.toLocaleString()}
        </Badge>
      )
    },
  },
  {
    id: "cultures",
    header: "Planches",
    cell: ({ row }) => {
      const cultures = row.original.cultures
      return (
        <div className="flex flex-wrap gap-1">
          {/* Deux cultures d'une même ligne peuvent partager une planche, ou
              n'en avoir aucune : la clé porte le rang, et une culture sans
              planche n'a ni badge vide ni lien vers une fiche inexistante. */}
          {cultures.slice(0, 4).map((c, i) =>
            c.plancheId ? (
              <Link key={`${c.plancheId}-${i}`} href={`/maraichage/planches/${encodeURIComponent(c.plancheId)}`}>
                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-slate-200">
                  {c.plancheId} ({c.nbPlants})
                </Badge>
              </Link>
            ) : (
              <Badge key={`sans-planche-${i}`} variant="secondary" className="text-xs">
                sans planche ({c.nbPlants})
              </Badge>
            ),
          )}
          {cultures.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{cultures.length - 4}
            </Badge>
          )}
        </div>
      )
    },
  },
]

const AUCUN_BESOIN: BesoinPlant[] = []

function PlantsContent() {
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  // Rien n'est demandé avant la restauration de la saison mémorisée ; une
  // réponse ne vaut que pour la saison qui l'a demandée.
  const { resultat, chargement: isLoading, erreur, recharger } = useChargementPlanification<{
    data: BesoinPlant[]
    stats: Stats
  }>(
    anneePrete ? `/api/planification/plants?annee=${annee}` : null,
    "Impossible de charger les besoins en plants",
  )
  const data = resultat?.data ?? AUCUN_BESOIN
  const stats = resultat?.stats ?? null

  const handleExport = () => {
    telechargerCsv(`plants-necessaires-${annee}.csv`, [
      ["Espèce", "Variété", "Semaine plantation", "Nb plants", "Stock", "À commander", "Planches"],
      ...data.map((b) => [
        b.especeNom ?? b.especeId,
        b.varieteNom ?? b.varieteId ?? "",
        b.semainePlantation?.toString() || "",
        b.nbPlants,
        b.stockActuel,
        b.aCommander,
        b.cultures.map((c) => c.plancheId || "sans planche").join(", "),
      ]),
    ])
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
            <Leaf className="h-6 w-6 text-cyan-600" />
            <h1 className="text-xl font-bold">Plants nécessaires</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/maraichage/stocks">
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Gérer stocks
            </Button>
          </Link>
          <SelecteurAnneePlanification annee={annee} annees={annees} onChange={definirAnnee} />
        </div>
      </div>

      <main>
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Espèces</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.nbEspeces}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Plants total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalPlants.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Cultures</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalCultures}</p>
              </CardContent>
            </Card>
            <Card className={stats.especesSansStock > 0 ? "border-red-200 bg-red-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">À commander</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalACommander.toLocaleString()}</p>
                {stats.especesSansStock > 0 && (
                  <p className="text-sm text-red-600">{stats.especesSansStock} espèce(s) sans stock</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info */}
        <div className="mb-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <p className="text-sm text-cyan-800">
            Cette page liste les plants à produire ou à acheter pour les cultures repiquées (hors semis
            direct, bulbes et caïeux). Le nombre de plants est celui enregistré sur la fiche de la culture ;
            à défaut, il est calculé à partir de la longueur, du nombre de rangs et de l&apos;espacement.
            «&nbsp;À commander&nbsp;» ajoute 10&nbsp;% de marge pour les pertes, puis déduit le stock de plants.
          </p>
        </div>

        {erreur && (
          <ErreurChargementPlanification
            message={`Les besoins en plants de ${annee} n’ont pas pu être chargés.`}
            onReessayer={recharger}
          />
        )}

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pageCount={1}
          pageIndex={0}
          pageSize={data.length || 50}
          onPaginationChange={() => {}}
          onRefresh={recharger}
          onExport={handleExport}
          searchPlaceholder="Rechercher..."
          emptyMessage={erreur ? "Chargement impossible." : "Aucun besoin en plants calculé."}
        />
      </main>
    </div>
  )
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <PlantsContent />
    </Suspense>
  )
}
