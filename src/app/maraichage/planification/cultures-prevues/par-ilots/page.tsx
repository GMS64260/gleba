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
import { Skeleton } from "@/components/ui/skeleton"
import { useAnneePlanification, useChargementPlanification } from "@/hooks/use-annee-planification"
import {
  ErreurChargementPlanification,
  SelecteurAnneePlanification,
} from "@/components/maraichage/SelecteurAnneePlanification"
import { telechargerCsv } from "../../export-csv"

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
    // Une culture sans planche est listée (QA cmsw8wni8) : ni badge vide ni
    // lien vers une fiche planche inexistante.
    cell: ({ row }) =>
      row.original.plancheId ? (
        <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
          <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200">
            {row.original.plancheId}
          </Badge>
        </Link>
      ) : (
        <Badge variant="secondary">sans planche</Badge>
      ),
  },
  {
    // Tri et recherche sur le NOM affiché : l'identifiant d'une espèce
    // personnelle est un cuid, introuvable par son nom.
    id: "especeId",
    accessorFn: (culture) => culture.especeNom ?? culture.especeId ?? "",
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

const AUCUNE_CULTURE: CulturePrevue[] = []
const STATS_VIDES: { parIlot: Record<string, number> } = { parIlot: {} }

function CulturesPrevuesParIlotsContent() {
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  // Rien n'est demandé avant la restauration de la saison mémorisée ; une
  // réponse ne vaut que pour la saison qui l'a demandée.
  const { resultat, chargement: isLoading, erreur, recharger } = useChargementPlanification<{
    data: CulturePrevue[]
    stats: { parIlot: Record<string, number> }
  }>(
    anneePrete ? `/api/planification/cultures-prevues?annee=${annee}&groupBy=ilot` : null,
    "Impossible de charger les cultures prévues",
  )
  const data = resultat?.data ?? AUCUNE_CULTURE
  const stats = resultat?.stats ?? STATS_VIDES

  const handleExport = () => {
    telechargerCsv(`cultures-prevues-ilots-${annee}.csv`, [
      ["Îlot", "Planche", "Espèce", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m2)", "Statut"],
      ...data.map((c) => [
        c.ilot || "Sans îlot",
        c.plancheId,
        c.especeNom ?? c.especeId ?? "",
        c.semaineSemis?.toString() || "",
        c.semainePlantation?.toString() || "",
        c.semaineRecolte?.toString() || "",
        c.surface.toFixed(1),
        c.existante ? "Créée" : "À créer",
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
            <Map className="h-6 w-6 text-amber-600" />
            <h1 className="text-xl font-bold">Cultures prévues par îlot</h1>
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
          <SelecteurAnneePlanification annee={annee} annees={annees} onChange={definirAnnee} />
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
              Par îlots
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par planches
            </Button>
          </Link>
        </div>

        {erreur && (
          <ErreurChargementPlanification
            message={`Les cultures prévues de ${annee} n’ont pas pu être chargées.`}
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
          emptyMessage={erreur ? "Chargement impossible." : "Aucune culture prévue."}
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
