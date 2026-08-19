"use client"

/**
 * Page ITPs - Itinéraires Techniques de Plantes
 * Liste des ITPs avec filtrage par espece
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { formatSemaine } from "@/lib/assistant-helpers"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeft,
  Route,
  Calendar,
  Share2,
  Lock,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { AvisDialog } from "@/components/avis/AvisDialog"
import { AvisCell } from "@/components/avis/AvisCell"
import type { AvisStatsListe } from "@/lib/avis/types"
import { badgeOrigine } from "@/lib/referentiel-communaute"
import { libelleImplantationItp, nomAffichableItp } from "@/lib/itp-label"
import { dureeCycleItpJours } from "@/lib/cultures/dates-itp"
import { itpApplicableAZone } from "@/lib/calendrier-climat"
import type { ZoneClimat } from "@/lib/terroir"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"

// Type pour les ITPs avec relations
interface ITPWithRelations {
  id: string
  nom: string | null
  // Catalogue communautaire : userId null = Gleba officiel ; renseigné = perso
  // d'un membre. partageCommunaute = proposé/partagé à la communauté.
  userId: string | null
  partageCommunaute: boolean
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  semaineImplantationDebut: number | null
  semaineImplantationFin: number | null
  semaineRecolteFin: number | null
  dureePepiniere: number | null
  dureeCulture: number | null
  delaiPremiereRecolteAnnees: number | null
  nbRangs: number | null
  espacement: number | null
  notes: string | null
  typePlanche: string | null
  modeDemarrage: string | null
  implantation: string | null
  forcage: boolean | null
  zoneClimat: string | null
  sourceReference: string | null
  sourceUrl: string | null
  statutValidation: string
  espece: {
    id: string
    nom: string | null
    couleur: string | null
    famille: { id: string; couleur: string | null } | null
  } | null
  _count: { cultures: number; rotationsDetails: number }
  avisStats?: AvisStatsListe
}

// PROMPT 05 — Audit agronomique : ne plus exposer les identifiants techniques
// (ex. "ITP-AIL-01") en liste. La règle d'affichage d'un nom d'ITP est unique et
// partagée (src/lib/itp-label.ts) : elle rend tel quel le libellé saisi par un
// membre et ne « lisibilise » que les slugs du catalogue officiel.
const formatItpLabel = (itp: ITPWithRelations): string => nomAffichableItp(itp)

// Formatage semaine

// Colonnes du tableau
function colonnes(zoneUser: ZoneClimat | null): ColumnDef<ITPWithRelations>[] {
  return [
  {
    accessorKey: "id",
    header: "ITP",
    cell: ({ row }) => {
      const itp = row.original
      const couleur = itp.espece?.couleur || itp.espece?.famille?.couleur || '#888888'
      // Le catalogue liste TOUT le référentiel communautaire, y compris les
      // itinéraires tropicaux dédiés. La création d'une culture, elle, ne
      // propose que ceux applicables à la zone de l'exploitation : sans mention,
      // l'utilisateur cherchait en vain un itinéraire vu ici.
      const horsZone = !itpApplicableAZone(itp.zoneClimat, zoneUser)
      // L'identifiant interne reste accessible via `title` (debug, support).
      return (
        <div className="flex items-center gap-2" title={itp.id}>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: couleur }}
          />
          <span className="font-medium">{formatItpLabel(itp)}</span>
          {horsZone && (
            <Badge
              variant="outline"
              className="border-slate-300 text-[10px] text-slate-500"
              title="Itinéraire calé sur une autre zone climatique : il n'est pas proposé à la création d'une culture dans votre exploitation."
            >
              hors zone
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "espece.id",
    header: "Espèce",
    cell: ({ row }) => row.original.espece?.nom ?? row.original.espece?.id ?? "-",
  },
  {
    id: "implantationWindow",
    header: "Implantation",
    cell: ({ row }) => {
      const itp = row.original
      const start = itp.semaineImplantationDebut ?? itp.semainePlantation ?? itp.semaineSemis
      return (
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {itp.semaineImplantationFin
              ? `S${start}–S${itp.semaineImplantationFin}`
              : formatSemaine(start)}
          </Badge>
          <p className="text-[11px] text-muted-foreground">
            {libelleImplantationItp(itp)}
            {itp.forcage ? " · forcé" : ""}
          </p>
        </div>
      )
    },
  },
  {
    accessorKey: "semaineRecolte",
    header: "Récolte",
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {row.original.semaineRecolteFin
          ? `S${row.original.semaineRecolte}–S${row.original.semaineRecolteFin}`
          : formatSemaine(row.original.semaineRecolte)}
      </Badge>
    ),
  },
  {
    accessorKey: "dureePepiniere",
    header: "Pépinière",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? `${val}j` : "-"
    },
  },
  {
    accessorKey: "dureeCulture",
    header: "Culture",
    // La colonne affichait `dureeCulture` brut alors que les dates d'une culture
    // sont déduites de l'écart de semaines : 589 lignes portent deux durées
    // différentes, et l'écran annonçait celle qui ne sert pas. On affiche la
    // durée effectivement appliquée (`dureeCycleItpJours`, source unique), et on
    // nomme la valeur déclarée quand elle diverge.
    cell: ({ row }) => {
      const itp = row.original
      const effective = dureeCycleItpJours(itp)
      if (!effective) return itp.dureeCulture ? `${itp.dureeCulture}j` : "-"
      const declaree = itp.dureeCulture
      const diverge = declaree != null && declaree > 0 && declaree !== effective
      return (
        <span title={diverge ? `Durée déclarée sur la fiche : ${declaree} j` : undefined}>
          {effective}j{diverge ? " *" : ""}
        </span>
      )
    },
  },
  {
    accessorKey: "statutValidation",
    header: "Qualité",
    cell: ({ row }) => {
      const itp = row.original
      if (itp.statutValidation === "source_documentee") {
        return (
          <div className="space-y-1">
            <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <ShieldCheck className="h-3 w-3" />
              Sourcé
            </Badge>
            {itp.sourceUrl && (
              <a
                href={itp.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-emerald-700 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                INRAE <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )
      }
      if (itp.statutValidation === "personnel") {
        return <Badge variant="outline">Personnel</Badge>
      }
      return (
        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          À confirmer
        </Badge>
      )
    },
  },
  {
    accessorKey: "_count.rotationsDetails",
    header: "Rotations",
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
  ]
}

export default function ITPsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = session?.user.id
  const [data, setData] = React.useState<ITPWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [avisRef, setAvisRef] = React.useState<ITPWithRelations | null>(null)
  const [search, setSearch] = React.useState("")
  const [zoneUser, setZoneUser] = React.useState<ZoneClimat | null>(null)
  const deferredSearch = React.useDeferredValue(search)
  const pageSize = 50

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      // `calibre=1` : les semaines renvoyées sont celles de VOTRE zone, comme
      // dans Planification, le calendrier et le formulaire de culture. Sans ce
      // paramètre, cet écran affichait les semaines du climat source et le même
      // ITP n'avait pas les mêmes dates d'un écran à l'autre (QA cmsqmujo9).
      const params = new URLSearchParams({
        page: String(pageIndex + 1),
        pageSize: String(pageSize),
        avis: "1",
        calibre: "1",
      })
      if (deferredSearch.trim()) params.set("search", deferredSearch.trim())
      const url = `/api/itps?${params.toString()}`
      const response = await fetch(url)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setPageCount(result.totalPages)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les ITPs",
      })
    } finally {
      setIsLoading(false)
    }
  }, [pageIndex, deferredSearch, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  React.useEffect(() => {
    fetch("/api/calendrier-climat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setZoneUser((d.zone ?? null) as ZoneClimat | null))
      .catch(() => {})
  }, [])

  // Handlers
  const handleAdd = () => {
    router.push("/maraichage/itps/new")
  }

  const handleRowClick = (row: ITPWithRelations) => {
    router.push(`/maraichage/itps/${encodeURIComponent(row.id)}`)
  }

  const handleEdit = (row: ITPWithRelations) => {
    router.push(`/maraichage/itps/${encodeURIComponent(row.id)}`)
  }

  const handleDelete = async (row: ITPWithRelations) => {
    if (row._count.cultures > 0 || row._count.rotationsDetails > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `${formatItpLabel(row)} est utilise dans ${row._count.cultures} culture(s) et ${row._count.rotationsDetails} rotation(s)`,
      })
      return
    }

    if (!(await confirmDialog(`Supprimer l'ITP "${formatItpLabel(row)}" ?`))) return

    try {
      const response = await fetch(`/api/itps/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      })
      if (response.ok) {
        toast({
          title: "ITP supprime",
          description: `L'ITP "${formatItpLabel(row)}" a été supprimé`,
        })
        fetchData()
      } else {
        const p = await response.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: p?.error || "Impossible de supprimer l'ITP",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur réseau",
      })
    }
  }

  // Catalogue communautaire : proposer/retirer son ITP perso à la communauté.
  const handleTogglePartage = async (itp: ITPWithRelations) => {
    const next = !itp.partageCommunaute
    try {
      const res = await fetch(`/api/itps/${encodeURIComponent(itp.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partageCommunaute: next }),
      })
      if (res.ok) {
        toast({
          title: next ? "Proposé à la communauté" : "Rendu privé",
          description: `« ${formatItpLabel(itp)} »`,
        })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: p?.error || "Action impossible",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Action impossible" })
    }
  }

  // Suppression d'un ITP perso (auteur). Le 409 « utilisé par… » est affiché.
  const handlePersoDelete = async (itp: ITPWithRelations) => {
    if (!(await confirmDialog(`Supprimer votre ITP « ${formatItpLabel(itp)} » ?`))) return
    try {
      const res = await fetch(`/api/itps/${encodeURIComponent(itp.id)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "ITP supprimé", description: `« ${formatItpLabel(itp)} »` })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: p?.error || "Suppression impossible",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Suppression impossible" })
    }
  }

  // Export CSV
  //
  // L'export ne portait que la PAGE affichée (50 lignes sur 773) sous un nom de
  // fichier qui promettait le catalogue. On récupère l'ensemble du périmètre
  // courant — recherche comprise — avant d'écrire le fichier, et on exporte le
  // nom lisible en plus de l'identifiant technique.
  const handleExport = async () => {
    let lignes = data
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "1000", calibre: "1" })
      if (deferredSearch.trim()) params.set("search", deferredSearch.trim())
      const res = await fetch(`/api/itps?${params.toString()}`)
      if (res.ok) {
        const tout = await res.json()
        if (Array.isArray(tout?.data)) lignes = tout.data as ITPWithRelations[]
      }
    } catch {
      // Réseau indisponible : on exporte au moins ce qui est à l'écran.
    }

    const headers = ["ITP", "Identifiant technique", "Espèce", "Début implantation", "Fin implantation", "Début récolte", "Fin récolte", "Conduite", "Qualité", "Zone de calage", "Source"]
    const rows = lignes.map(i => [
      formatItpLabel(i),
      i.id,
      i.espece?.nom || i.espece?.id || "",
      (i.semaineImplantationDebut ?? i.semainePlantation ?? i.semaineSemis)?.toString() || "",
      i.semaineImplantationFin?.toString() || "",
      i.semaineRecolte?.toString() || "",
      i.semaineRecolteFin?.toString() || "",
      i.typePlanche || "",
      i.statutValidation,
      i.zoneClimat || "",
      i.sourceReference || "",
    ].map(champ => /[";\n]/.test(champ) ? `"${champ.replace(/"/g, '""')}"` : champ))

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "itps.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const columnsAvecAvis = React.useMemo<ColumnDef<ITPWithRelations>[]>(
    () => [
      ...colonnes(zoneUser),
      {
        id: "avis",
        header: "Avis",
        enableSorting: false,
        cell: ({ row }) => (
          <AvisCell
            stats={row.original.avisStats}
            onClick={(e) => {
              e.stopPropagation()
              setAvisRef(row.original)
            }}
          />
        ),
      },
      // Colonne « Origine » : badge Gleba/Perso/Communauté + actions sur son perso.
      {
        id: "origine",
        header: "Origine",
        enableSorting: false,
        cell: ({ row }) => {
          const itp = row.original
          const badge = badgeOrigine(itp, currentUserId)
          const mine = !!currentUserId && itp.userId === currentUserId
          return (
            <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
              {badge ? (
                <Badge variant="outline" className={`text-xs ${badge.cls}`}>{badge.label}</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Gleba</Badge>
              )}
              {mine && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                    title={itp.partageCommunaute ? "Rendre privé (retirer de la communauté)" : "Proposer à la communauté"}
                    onClick={() => handleTogglePartage(itp)}
                  >
                    {itp.partageCommunaute ? <Lock className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                    title="Supprimer"
                    onClick={() => handlePersoDelete(itp)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, zoneUser]
  )

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <AppHeader current="maraichage" showLune />
      <PageToolbar>
        {/* Responsive 360px — le titre « Itinéraires Techniques (ITP) » déborde sinon */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Route className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold">Itinéraires Techniques (ITP)</h1>
          </div>
        </div>
        <Link href="/maraichage/itps/calendrier">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Calendrier</span>
          </Button>
        </Link>
      </PageToolbar>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Info */}
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div className="text-sm text-indigo-800">
              <p className="font-medium">Qu&apos;est-ce qu&apos;un ITP ?</p>
              <p className="mt-1 text-indigo-700">
                Un Itinéraire Technique de Plante définit le calendrier cultural : semaines de semis, plantation et récolte,
                ainsi que les paramètres de culture (nombre de rangs, espacement). Les ITP sont utilisés dans les rotations
                pour planifier automatiquement les cultures.
              </p>
              <p className="mt-1 text-indigo-700">
                Les semaines affichées sont recalées depuis le climat de calage de chaque itinéraire vers celui de votre
                exploitation — ce sont donc les mêmes que dans la planification et la création d&apos;une culture. La fiche
                d&apos;un itinéraire montre, elle, les semaines de sa source.
              </p>
            </div>
          </div>
        </div>

        <DataTable
          columns={columnsAvecAvis}
          data={data}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={(page) => setPageIndex(page)}
          onSearch={(value) => {
            setSearch(value)
            setPageIndex(0)
          }}
          searchValue={search}
          onAdd={handleAdd}
          onRefresh={fetchData}
          onExport={handleExport}
          onRowClick={handleRowClick}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher un ITP..."
          emptyMessage="Aucun ITP trouve. Cliquez sur + pour en créer un."
        />

        <AvisDialog
          refType="ITP"
          refId={avisRef?.id ?? null}
          nom={avisRef ? formatItpLabel(avisRef) : undefined}
          open={avisRef !== null}
          onOpenChange={(o) => !o && setAvisRef(null)}
          onSaved={fetchData}
        />
      </main>
    </div>
  )
}
