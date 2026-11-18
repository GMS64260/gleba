"use client"

/**
 * Page Cultures prevues par planche
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, LayoutGrid, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

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
import { statutsAgro, type StatutAgro } from "./statut-agro"

interface CulturePrevue {
  plancheId: string
  ilot: string | null
  especeId: string | null
  especeNom?: string | null
  especeCouleur: string | null
  itpId: string | null
  itpNom?: string | null
  rotationId: string | null
  rotationAnnee: number
  rotationNbAnnees?: number | null
  rotationAncrage?: number | null
  annee: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  surface: number
  existante: boolean
}

/** Ligne du tableau : la culture et son statut, calculé une fois par jeu de données. */
type LigneCulture = CulturePrevue & { statut: StatutAgro }

const columns: ColumnDef<LigneCulture>[] = [
  {
    accessorKey: "plancheId",
    header: "Planche",
    // Une culture sans planche est listée (QA cmsw8wni8) : ni badge vide ni
    // lien vers une fiche planche inexistante.
    cell: ({ row }) =>
      row.original.plancheId ? (
        <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
          <Badge variant="default" className="cursor-pointer">
            {row.original.plancheId}
          </Badge>
        </Link>
      ) : (
        <Badge variant="secondary">sans planche</Badge>
      ),
  },
  {
    accessorKey: "ilot",
    header: "Îlot",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "rotationId",
    header: "Rotation",
    cell: ({ row }) => {
      const { rotationId, rotationAnnee, rotationNbAnnees, rotationAncrage } = row.original
      if (!rotationId) return "-"
      // QA cmswy9fyr — deux planches sur la MÊME rotation peuvent légitimement
      // être à des étapes différentes : la phase est ancrée sur l'année de
      // départ du cycle de la planche. Rien ne l'exposait, et une planche sans
      // ancrage retombe sur un epoch arbitraire. On nomme donc la position dans
      // le cycle et son ancrage, ou l'absence d'ancrage.
      const etape =
        rotationAnnee > 0
          ? rotationNbAnnees
            ? `étape ${rotationAnnee}/${rotationNbAnnees}`
            : `étape ${rotationAnnee}`
          : null
      return (
        <div className="text-sm">
          <Link href={`/maraichage/rotations/${encodeURIComponent(rotationId)}`}>
            <span className="text-blue-600 hover:underline">{rotationId}</span>
          </Link>
          {etape && (
            <span className="block text-xs text-muted-foreground">
              {etape}
              {rotationAncrage
                ? ` · départ ${rotationAncrage}`
                : " · départ non défini (phase arbitraire)"}
            </span>
          )}
        </div>
      )
    },
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
          <span className="font-medium">{culture.especeNom ?? culture.especeId ?? "-"}</span>
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
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m²`,
  },
  {
    id: "statut",
    header: "Statut",
    cell: ({ row }) => {
      const statut = row.original.statut
      if (statut === 'overlap') {
        return (
          <span className="inline-flex items-center gap-1 text-amber-700" title="Chevauchement avec une autre culture sur cette planche">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Chevauchement</span>
          </span>
        )
      }
      if (statut === 'empty') {
        return (
          <span className="inline-flex items-center gap-1 text-orange-600" title="Aucune date de semis/plantation/récolte renseignée">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Dates vides</span>
          </span>
        )
      }
      if (statut === 'todo') {
        return (
          <span className="inline-flex items-center gap-1 text-slate-400" title="Culture planifiée à créer">
            <XCircle className="h-4 w-4" />
            <span className="text-xs">À créer</span>
          </span>
        )
      }
      return (
        <span className="inline-flex items-center gap-1 text-green-600" title="Plan agronomique cohérent">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs">OK</span>
        </span>
      )
    },
  },
]

const AUCUNE_CULTURE: CulturePrevue[] = []

function CulturesPrevuesParPlanchesContent() {
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  // Rien n'est demandé avant la restauration de la saison mémorisée ; une
  // réponse ne vaut que pour la saison qui l'a demandée.
  const { resultat, chargement: isLoading, erreur, recharger } = useChargementPlanification<{
    data: CulturePrevue[]
    stats: { total: number }
  }>(
    anneePrete ? `/api/planification/cultures-prevues?annee=${annee}&groupBy=planche` : null,
    "Impossible de charger les cultures prévues",
  )
  const cultures = resultat?.data ?? AUCUNE_CULTURE
  const total = resultat?.stats.total ?? 0
  const data = React.useMemo<LigneCulture[]>(() => {
    const statuts = statutsAgro(cultures)
    return cultures.map((c, i) => ({ ...c, statut: statuts[i] }))
  }, [cultures])

  const handleExport = () => {
    telechargerCsv(`cultures-prevues-planches-${annee}.csv`, [
      ["Planche", "Îlot", "Rotation", "Année Rot.", "Espèce", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m²)", "Statut"],
      ...data.map((c) => [
        c.plancheId,
        c.ilot || "",
        c.rotationId || "",
        c.rotationAnnee.toString(),
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
            <LayoutGrid className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Cultures prévues par planche</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline">{total} cultures</Badge>
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
            <Button variant="outline" size="sm">
              Par îlots
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="default" size="sm">
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

export default function CulturesPrevuesParPlanchesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesParPlanchesContent />
    </Suspense>
  )
}
