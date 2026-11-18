"use client"

/**
 * Page Cultures prevues par espece
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { formatSemaine } from "@/lib/assistant-helpers"
import { Skeleton } from "@/components/ui/skeleton"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Leaf, CheckCircle2, XCircle, Info } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAnneePlanification, useChargementPlanification } from "@/hooks/use-annee-planification"
import {
  ErreurChargementPlanification,
  SelecteurAnneePlanification,
} from "@/components/maraichage/SelecteurAnneePlanification"
import { telechargerCsv } from "../export-csv"

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
    // Tri et recherche sur le NOM affiché : l'identifiant d'une espèce ou d'un
    // itinéraire personnel est un cuid, introuvable par son nom.
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
    id: "itpId",
    accessorFn: (culture) => culture.itpNom ?? culture.itpId ?? "",
    header: "ITP",
    cell: ({ row }) => row.original.itpNom ?? row.original.itpId ?? "-",
  },
  {
    accessorKey: "plancheId",
    header: "Planche",
    // QA cmsw8wni8 — une culture sans planche est désormais listée : pas de
    // lien vers une fiche planche inexistante dans ce cas.
    cell: ({ row }) =>
      row.original.plancheId ? (
        <Link href={`/maraichage/planches/${encodeURIComponent(row.original.plancheId)}`}>
          <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">
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
    accessorKey: "semaineSemis",
    header: "Semis",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "semainePlantation",
    header: "Plantation",
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "semaineRecolte",
    header: "Récolte",
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="text-xs">
        {formatSemaine(getValue() as number | null)}
      </Badge>
    ),
  },
  {
    accessorKey: "surface",
    header: "Surface",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m²`,
  },
  {
    accessorKey: "existante",
    header: "Statut",
    cell: ({ getValue }) => {
      const existante = getValue() as boolean
      return existante ? (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Créée
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          À créer
        </Badge>
      )
    },
  },
]

type StatsCulturesPrevues = { total: number; existantes: number; aCreer: number; etapesNonSuivies?: number }
const STATS_VIDES: StatsCulturesPrevues = { total: 0, existantes: 0, aCreer: 0 }
const AUCUNE_CULTURE: CulturePrevue[] = []

function CulturesPrevuesContent() {
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  // Rien n'est demandé avant la restauration de la saison mémorisée ; une
  // réponse ne vaut que pour la saison qui l'a demandée.
  const { resultat, chargement: isLoading, erreur, recharger } = useChargementPlanification<{
    data: CulturePrevue[]
    stats: StatsCulturesPrevues
  }>(
    anneePrete ? `/api/planification/cultures-prevues?annee=${annee}&groupBy=espece` : null,
    "Impossible de charger les cultures prévues",
  )
  const data = resultat?.data ?? AUCUNE_CULTURE
  const stats = resultat?.stats ?? STATS_VIDES

  const handleExport = () => {
    telechargerCsv(`cultures-prevues-${annee}.csv`, [
      ["Espèce", "ITP", "Planche", "Îlot", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m²)", "Statut"],
      ...data.map((c) => [
        c.especeNom ?? c.especeId ?? "",
        c.itpNom ?? c.itpId ?? "",
        c.plancheId,
        c.ilot || "",
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
            <Leaf className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-bold">Cultures prévues par espèce</h1>
          </div>
        </div>

        {/* Responsive 360px — 3 badges + select ne tiennent pas sur une ligne */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge variant="outline">{stats.total} cultures</Badge>
            <Badge variant="default" className="bg-green-600">{stats.existantes} créées</Badge>
            <Badge variant="secondary">{stats.aCreer} à créer</Badge>
            {/* QA cmv2r2rl8 — étape de rotation que la planche ne suit pas. */}
            {!!stats.etapesNonSuivies && (
              <Link href={`/maraichage/planification/creer-cultures?annee=${annee}`}>
                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100">
                  {stats.etapesNonSuivies} culture{stats.etapesNonSuivies > 1 ? "s" : ""} de la rotation non créée{stats.etapesNonSuivies > 1 ? "s" : ""}
                </Badge>
              </Link>
            )}
          </div>
          <SelecteurAnneePlanification annee={annee} annees={annees} onChange={definirAnnee} />
        </div>
      </div>

      <main>
        {/* Onglets */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Link href={`/maraichage/planification/cultures-prevues?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par espèce
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-ilots?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par îlots
            </Button>
          </Link>
          <Link href={`/maraichage/planification/cultures-prevues/par-planches?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par planches
            </Button>
          </Link>
        </div>

        {/* Note testeur 2026-05-31 — clarifier l'écart avec la liste Cultures :
            cet écran agrège le réel (créées) + le prévisionnel des rotations (à
            créer), donc son total dépasse normalement la liste des cultures. */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
          <p>
            Cet écran combine les cultures <span className="font-medium text-green-700">déjà créées</span> et
            les cultures <span className="font-medium text-slate-700">prévues par vos rotations</span> mais
            pas encore créées. Le total peut donc dépasser celui de la liste <em>Cultures</em>, qui ne montre
            que les cultures réellement enregistrées. Une même planche peut apparaître deux fois (culture réelle
            + étape de rotation) tant que la culture prévue n&apos;a pas été créée.
          </p>
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
          emptyMessage={erreur ? "Chargement impossible." : "Aucune culture prévue. Assignez des rotations à vos planches."}
        />
      </main>
    </div>
  )
}


export default function CulturesPrevuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesContent />
    </Suspense>
  )
}
