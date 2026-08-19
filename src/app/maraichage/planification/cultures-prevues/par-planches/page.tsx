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

// Bug cmp8sb0at (Marc 2026-05-16) — Le statut OK vert indiquait "ligne créée"
// pas "plan agronomique valide". On évalue désormais des conflits réels :
//  - empty : aucune date semis/plantation/récolte (kiwi sans planning)
//  - overlap : chevauchement temporel avec une autre culture de la même planche
//  - ok : sinon
type StatutAgro = 'empty' | 'overlap' | 'ok' | 'todo'

function periode(c: CulturePrevue): [number, number] | null {
  const debut = c.semaineSemis ?? c.semainePlantation
  const fin = c.semaineRecolte
  if (debut == null || fin == null) return null
  return [debut, Math.max(debut, fin)]
}

// Bug feedback testeur 2026-05-26 (cmpm6yi1d) — Avant, toute paire de
// cultures se touchant d'une seule semaine sur la même planche déclenchait
// "Chevauchement" (ex. fève S08-S20 + haricot vert S18-S30 : chevauchement
// de 2 semaines minime). 33/33 cultures étaient marquées → l'alerte
// perdait toute valeur. On exige désormais un chevauchement RÉEL > 2
// semaines pour signaler le conflit (tolérance pour les passations de
// culture en fin/début de saison).
const SEUIL_CHEVAUCHEMENT_SEM = 2

function evaluerStatut(c: CulturePrevue, toutes: CulturePrevue[]): StatutAgro {
  if (c.semaineSemis == null && c.semainePlantation == null && c.semaineRecolte == null) {
    return c.existante ? 'empty' : 'todo'
  }
  const p = periode(c)
  if (p) {
    const conflits = toutes.filter((o) => {
      if (o === c) return false
      if (o.plancheId !== c.plancheId) return false
      const op = periode(o)
      if (!op) return false
      // Largeur du chevauchement en semaines
      const overlapStart = Math.max(p[0], op[0])
      const overlapEnd = Math.min(p[1], op[1])
      return overlapEnd - overlapStart >= SEUIL_CHEVAUCHEMENT_SEM
    })
    if (conflits.length > 0) return 'overlap'
  }
  return c.existante ? 'ok' : 'todo'
}

const columns: ColumnDef<CulturePrevue>[] = [
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
    cell: ({ row, table }) => {
      const all = table.getCoreRowModel().rows.map((r) => r.original as CulturePrevue)
      const statut = evaluerStatut(row.original, all)
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

function CulturesPrevuesParPlanchesContent() {
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()
  const [stats, setStats] = React.useState<{ total: number }>({ total: 0 })


  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}&groupBy=planche`)
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
    const headers = ["Planche", "Îlot", "Rotation", "Année Rot.", "Espèce", "S.Semis", "S.Plantation", "S.Récolte", "Surface (m²)", "Statut"]
    const rows = data.map(c => [
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
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cultures-prevues-planches-${annee}.csv`
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
            <LayoutGrid className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Cultures prévues par planche</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline">{stats.total} cultures</Badge>
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

export default function CulturesPrevuesParPlanchesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesPrevuesParPlanchesContent />
    </Suspense>
  )
}
