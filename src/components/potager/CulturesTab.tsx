"use client"

/**
 * Onglet Cultures - Liste des cultures avec actions rapides
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CloudRain, Droplets, Leaf, ListTodo, Sprout, TreeDeciduous, Apple, CheckCircle, CalendarClock, RefreshCw } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import type { PluviometrieBulkItem } from "@/app/api/meteo/pluviometrie-bulk/route"

const CULTURE_ETATS = [
  { value: "all", label: "Toutes", icon: Leaf },
  { value: "Planifiée", label: "Planifiées", icon: ListTodo },
  { value: "Semée", label: "Semées", icon: Sprout },
  { value: "Plantée", label: "Plantées", icon: TreeDeciduous },
  { value: "En récolte", label: "En récolte", icon: Apple },
  { value: "Terminée", label: "Terminées", icon: CheckCircle },
] as const

interface CultureWithRelations {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  annee: number | null
  dateSemis: string | null
  datePlantation: string | null
  dateRecolte: string | null
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  terminee: string | null
  notes: string | null
  etat: string
  type: string
  espece: {
    id: string
    nom: string | null
    famille: { id: string; couleur: string | null } | null
  }
  variete: { id: string; nom: string | null; isPlaceholder?: boolean } | null
  planche: { id: string; nom?: string } | null
  // Présent au runtime (GET /api/cultures fait `include: { itp: true }`) mais
  // absent du type historique : seul `semainePlantation` nous intéresse pour
  // savoir si l'itinéraire porte un jalon de plantation (cmsoaedw2).
  itp?: { semainePlantation: number | null } | null
  _count: { recoltes: number }
}

// Un ITP en semis direct (aucune semaine de plantation) ne doit pas proposer
// « Marquer la plantation faite » : la colonne Plantation affiche « - » et
// taches-potager ne génère jamais de tâche plantation pour ces cultures.
// On garde l'action si l'étape est déjà cochée (pour pouvoir l'annuler) ou si
// la culture n'a pas d'ITP (saisie libre).
export function masquerActionPlantation(culture: {
  plantationFaite: boolean
  datePlantation: string | null
  itp?: { semainePlantation: number | null } | null
}): boolean {
  return (
    !culture.plantationFaite &&
    culture.itp != null &&
    culture.itp.semainePlantation == null &&
    culture.datePlantation == null
  )
}

const FIELD_LABELS: Record<string, string> = {
  semisFait: "le semis",
  plantationFaite: "la plantation",
  recolteFaite: "la récolte",
}

// Friction 2026-08-23 — sans action de report, une culture en retard n'offrait
// que « fait » ou la suppression : un maraîcher a supprimé ses cultures en
// retard puis recréé les mêmes variétés. La prochaine étape reportable est la
// première non faite qui porte une date (rien à déplacer sinon).
export type EtapeReportable = "semis" | "plantation" | "recolte"
export function prochaineEtapeReportable(culture: {
  terminee: string | null
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  dateSemis: string | null
  datePlantation: string | null
  dateRecolte: string | null
}): { etape: EtapeReportable; date: string } | null {
  if (culture.terminee != null) return null
  const etapes: Array<{ etape: EtapeReportable; fait: boolean; date: string | null }> = [
    { etape: "semis", fait: culture.semisFait, date: culture.dateSemis },
    { etape: "plantation", fait: culture.plantationFaite, date: culture.datePlantation },
    { etape: "recolte", fait: culture.recolteFaite, date: culture.dateRecolte },
  ]
  const prochaine = etapes.find((e) => !e.fait && e.date)
  return prochaine ? { etape: prochaine.etape, date: prochaine.date! } : null
}

const LIBELLE_ETAPE_REPORT: Record<EtapeReportable, string> = {
  semis: "le semis",
  plantation: "la plantation",
  recolte: "la récolte",
}

const etatColors: Record<string, string> = {
  Planifiée: "bg-blue-100 text-blue-800",
  Semée: "bg-green-100 text-green-800",
  Plantée: "bg-lime-100 text-lime-800",
  "En récolte": "bg-amber-100 text-amber-800",
  Terminée: "bg-slate-100 text-slate-800",
}

// Audit Marc 2026-05-14 — Bug 32 : la colonne "Pluie 7j" affichait la
// même valeur sur les 19 lignes du tableau (toutes les planches d'une
// exploitation partagent le même centroïde météo). C'est du bruit qui
// ne porte aucune info par ligne. On la sort du tableau et on affiche
// l'info une seule fois en bandeau au-dessus.
function createColumns(
  onQuickUpdate: (id: number, field: string, value: boolean) => void,
  onReport: (culture: CultureWithRelations, etape: EtapeReportable) => void
): ColumnDef<CultureWithRelations>[] {
  return [
    {
      accessorKey: "id",
      header: "#",
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-muted-foreground">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: "espece.id",
      header: "Espèce",
      cell: ({ row }) => {
        const espece = row.original.espece
        const couleur = espece?.famille?.couleur || "#888888"
        return (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
            <span className="font-medium">{espece?.nom ?? espece?.id}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "variete.id",
      header: "Variété",
      cell: ({ row }) => {
        const v = row.original.variete
        if (!v || v.isPlaceholder) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              À renseigner
            </span>
          )
        }
        return <span>{v.nom ?? v.id}</span>
      },
    },
    {
      accessorKey: "planche.nom",
      header: "Planche",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "annee",
      header: "Année",
    },
    {
      id: "actions_rapides",
      header: "Actions",
      cell: ({ row }) => {
        const culture = row.original
        // QA cmsio768u / cmsio8o54 (2026-08-07) — ces boutons sont des bascules :
        // sur une étape déjà faite, le clic l'ANNULE. L'infobulle annonçait
        // pourtant l'état (« Semis fait ») et non l'effet du clic, ce qui se
        // lisait comme un simple badge. Elle nomme désormais l'action.
        const etapes = [
          {
            champ: "semisFait" as const,
            faite: culture.semisFait,
            Icone: Sprout,
            actif: "bg-orange-100 text-orange-600 hover:bg-orange-200",
            libelle: "le semis",
            participe: "fait",
          },
          {
            champ: "plantationFaite" as const,
            faite: culture.plantationFaite,
            Icone: TreeDeciduous,
            actif: "bg-green-100 text-green-600 hover:bg-green-200",
            libelle: "la plantation",
            participe: "faite",
          },
          {
            champ: "recolteFaite" as const,
            faite: culture.recolteFaite,
            Icone: Apple,
            actif: "bg-amber-100 text-amber-600 hover:bg-amber-200",
            libelle: "la récolte",
            participe: "faite",
          },
        ]
        // cmsoaedw2 — pas d'action plantation sur un ITP en semis direct.
        const etapesVisibles = etapes.filter(
          (e) => e.champ !== "plantationFaite" || !masquerActionPlantation(culture)
        )
        return (
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {etapesVisibles.map(({ champ, faite, Icone, actif, libelle, participe }) => {
                const action = faite ? `Annuler ${libelle}` : `Marquer ${libelle} ${participe}`
                return (
                  <Tooltip key={champ}>
                    <TooltipTrigger asChild>
                      <button
                        aria-label={action}
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickUpdate(culture.id, champ, !faite)
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          faite ? actif : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        <Icone className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{action}</TooltipContent>
                  </Tooltip>
                )
              })}
              {(() => {
                const reportable = prochaineEtapeReportable(culture)
                if (!reportable) return null
                const libelle = `Reporter ${LIBELLE_ETAPE_REPORT[reportable.etape]}…`
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        aria-label={libelle}
                        onClick={(e) => {
                          e.stopPropagation()
                          onReport(culture, reportable.etape)
                        }}
                        className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-slate-200"
                      >
                        <CalendarClock className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{libelle}</TooltipContent>
                  </Tooltip>
                )
              })()}
            </div>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: "dateSemis",
      header: "Semis",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
      },
    },
    {
      accessorKey: "datePlantation",
      header: "Plantation",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
      },
    },
    {
      accessorKey: "dateRecolte",
      header: "Récolte",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? format(new Date(date), "dd/MM", { locale: fr }) : "-"
      },
    },
    {
      accessorKey: "etat",
      header: "État",
      cell: ({ getValue }) => {
        const etat = getValue() as string
        return (
          <Badge variant="outline" className={etatColors[etat] || ""}>
            {etat}
          </Badge>
        )
      },
    },
    {
      accessorKey: "_count.recoltes",
      header: "Récoltes",
      cell: ({ getValue }) => getValue() || 0,
    },
  ]
}

// QA Camille 2026-05-15 — Bug #2 : le tableau cultures ne se mettait
// pas à jour au changement d'année (le composant n'avait aucune prop
// year et `/api/cultures` n'était pas filtré). On accepte désormais
// `year` et on le pousse en query string vers l'API.
interface CulturesTabProps {
  year?: number
}

export function CulturesTab({ year }: CulturesTabProps = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<CultureWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [selectedEtat, setSelectedEtat] = React.useState("all")
  const [pluieMap, setPluieMap] = React.useState<Map<string, PluviometrieBulkItem>>(new Map())
  const [cultureToDelete, setCultureToDelete] = React.useState<CultureWithRelations | null>(null)
  const [pendingUpdate, setPendingUpdate] = React.useState<{
    id: number
    field: string
    value: boolean
    message: string
  } | null>(null)
  // Friction 2026-08-23 — report d'une étape en retard sans suppression.
  const [reportCible, setReportCible] = React.useState<{
    culture: CultureWithRelations
    etape: EtapeReportable
  } | null>(null)
  const [reportDate, setReportDate] = React.useState("")
  const [reportLoading, setReportLoading] = React.useState(false)
  const latestRequestRef = React.useRef(0)
  const pageSize = 50

  const executeQuickUpdate = React.useCallback(
    async (id: number, field: string, value: boolean) => {
      try {
        const response = await fetch(`/api/cultures/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        })
        if (!response.ok) {
          // Le serveur refuse les régressions qui contrediraient les récoltes
          // enregistrées (409) : son message est la seule explication utile.
          const detail = await response.json().catch(() => null)
          throw new Error(detail?.error || "Erreur")
        }
        setData((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c
            const updated = { ...c, [field]: value }
            updated.etat = updated.terminee
              ? "Terminée"
              : updated.recolteFaite
                ? "En récolte"
                : updated.plantationFaite
                  ? "Plantée"
                  : updated.semisFait
                    ? "Semée"
                    : "Planifiée"
            return updated
          })
        )
        toast({ title: value ? "Fait !" : "Annulé" })
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Changement refusé",
          description: e instanceof Error ? e.message : "Erreur",
        })
      }
    },
    [toast]
  )

  // QA cmsio768u / cmsio8o54 (2026-08-07) — annuler une étape est destructif et
  // se faisait en un clic. On confirme, en nommant les récoltes déjà saisies :
  // c'est ce que l'utilisateur risque de contredire sans le voir.
  const handleQuickUpdate = React.useCallback(
    (id: number, field: string, value: boolean) => {
      if (value) {
        void executeQuickUpdate(id, field, value)
        return
      }
      const culture = data.find((c) => c.id === id)
      const sujet = FIELD_LABELS[field] ?? field
      const nbRecoltes = culture?._count?.recoltes ?? 0
      const rappelRecoltes =
        nbRecoltes > 0
          ? ` Cette culture porte ${nbRecoltes} récolte${nbRecoltes > 1 ? "s" : ""} enregistrée${nbRecoltes > 1 ? "s" : ""}.`
          : ""
      setPendingUpdate({
        id,
        field,
        value,
        message: `Annuler ${sujet} de la culture #${id} ?${rappelRecoltes}`,
      })
    },
    [data, executeQuickUpdate]
  )

  const handleReport = React.useCallback((culture: CultureWithRelations, etape: EtapeReportable) => {
    setReportDate(format(new Date(), "yyyy-MM-dd"))
    setReportCible({ culture, etape })
  }, [])

  const columns = React.useMemo(
    () => createColumns(handleQuickUpdate, handleReport),
    [handleQuickUpdate, handleReport]
  )

  // Bug 32 — Résumé pluie global (au lieu de la colonne dupliquée 19×).
  // On prend la médiane des planches en plein air (les planches sous abri
  // ne reçoivent pas de pluie directe et sont exclues).
  const pluieResume = React.useMemo(() => {
    const items = Array.from(pluieMap.values()).filter((p) => !p.sousAbri && p.total7j !== null)
    if (items.length === 0) return null
    const total7j = items.reduce((s, i) => s + (i.total7j ?? 0), 0) / items.length
    const joursSansPluie = Math.max(...items.map((i) => i.joursSansPluie ?? 0))
    return { total7j: Math.round(total7j * 10) / 10, joursSansPluie, nbPlanches: items.length }
  }, [pluieMap])

  const fetchData = React.useCallback(async () => {
    const requestId = ++latestRequestRef.current
    setIsLoading(true)
    try {
      let url = `/api/cultures?page=${pageIndex + 1}&pageSize=${pageSize}`
      if (year) {
        url += `&annee=${year}`
      }
      if (selectedEtat && selectedEtat !== "all") {
        url += `&etat=${encodeURIComponent(selectedEtat)}`
      }
      const response = await fetch(url)
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      // Le dashboard restaure l'année persistée après le premier rendu. La
      // requête de l'année courante peut alors finir après celle de l'année
      // choisie et écraser ses résultats. Seule la réponse la plus récente
      // est autorisée à modifier la table.
      if (requestId !== latestRequestRef.current) return
      const cultures: CultureWithRelations[] = result.data
      setData(cultures)
      setPageCount(result.totalPages)

      // Fetch pluviométrie pour les planches uniques (en arrière-plan)
      const plancheIds = [...new Set(
        cultures.map(c => c.planche?.id).filter(Boolean) as string[]
      )]
      if (plancheIds.length > 0) {
        fetch(`/api/meteo/pluviometrie-bulk?ids=${plancheIds.join(',')}`)
          .then(r => r.json())
          .then((items: PluviometrieBulkItem[]) => {
            if (requestId !== latestRequestRef.current) return
            const map = new Map<string, PluviometrieBulkItem>()
            items.forEach(item => map.set(item.plancheId, item))
            setPluieMap(map)
          })
          .catch(() => { /* silencieux */ })
      } else {
        setPluieMap(new Map())
      }
    } catch {
      if (requestId !== latestRequestRef.current) return
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les cultures" })
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false)
      }
    }
  }, [pageIndex, selectedEtat, year, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const executerReport = React.useCallback(async () => {
    if (!reportCible || !reportDate) return
    setReportLoading(true)
    try {
      const res = await fetch(`/api/cultures/${reportCible.culture.id}/reporter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etape: reportCible.etape, date: reportDate }),
      })
      if (!res.ok) {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Report refusé", description: p?.error || "Erreur" })
        return
      }
      const payload = await res.json().catch(() => null)
      const fmt = (d: string | Date) =>
        new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
      const suite = (payload?.decalages ?? [])
        .slice(1)
        .map((d: { etape: string; a: string }) => `${d.etape} au ${fmt(d.a)}`)
        .join(", ")
      toast({
        title: "Échéance reportée",
        description: suite ? `Le cycle suit : ${suite}.` : undefined,
      })
      setReportCible(null)
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de reporter l'échéance" })
    } finally {
      setReportLoading(false)
    }
  }, [reportCible, reportDate, toast, fetchData])

  const handleEtatChange = (etat: string) => {
    setSelectedEtat(etat)
    setPageIndex(0)
  }

  return (
    <div className="space-y-4">
      {/* Bug 32 — Bandeau pluie (avant : colonne dupliquée sur chaque
          ligne, info inutile car identique pour toutes les planches). */}
      {pluieResume && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md border bg-slate-50 text-xs text-slate-600">
          {pluieResume.total7j >= 5 ? (
            <CloudRain className="h-4 w-4 text-blue-600 flex-shrink-0" />
          ) : (
            <Droplets className="h-4 w-4 text-amber-600 flex-shrink-0" />
          )}
          <span>
            <strong>{pluieResume.total7j} mm</strong> de pluie cumulée sur 7 j
            {pluieResume.joursSansPluie > 0 && (
              <> · {pluieResume.joursSansPluie} jour{pluieResume.joursSansPluie > 1 ? "s" : ""} sans pluie</>
            )}
            <span className="text-muted-foreground"> (moyenne {pluieResume.nbPlanches} planches plein air)</span>
          </span>
        </div>
      )}

      {/* Filtres par état */}
      <Tabs value={selectedEtat} onValueChange={handleEtatChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          {CULTURE_ETATS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              title={label}
              className="flex items-center gap-1"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={(page) => setPageIndex(page)}
        onAdd={() => router.push(
          year
            ? `/maraichage/cultures/new?annee=${year}`
            : "/maraichage/cultures/new"
        )}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/maraichage/cultures/${row.id}`)}
        onRowEdit={(row) => router.push(`/maraichage/cultures/${row.id}`)}
        onRowDelete={(row) => setCultureToDelete(row)}
        searchPlaceholder="Rechercher une culture..."
        emptyMessage="Aucune culture trouvée."
      />

      <DeleteConfirmDialog
        open={cultureToDelete !== null}
        onOpenChange={(open) => !open && setCultureToDelete(null)}
        entityLabel={cultureToDelete ? `la culture #${cultureToDelete.id}` : ""}
        dependencies={
          cultureToDelete
            ? [{ label: "récoltes liées", count: cultureToDelete._count?.recoltes ?? 0 }]
            : []
        }
        onConfirm={async () => {
          if (!cultureToDelete) return
          try {
            const res = await fetch(`/api/cultures/${cultureToDelete.id}`, { method: "DELETE" })
            if (res.ok) {
              toast({ title: "Culture supprimée" })
              fetchData()
            } else {
              const p = await res.json().catch(() => null)
              toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de supprimer la culture" })
            }
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
      />

      {/* Confirmation de l'annulation d'une étape du cycle (QA cmsio768u). */}
      <ConfirmDialog
        open={pendingUpdate !== null}
        onOpenChange={(open) => !open && setPendingUpdate(null)}
        title="Annuler cette étape ?"
        description={pendingUpdate?.message ?? ""}
        confirmLabel="Annuler l'étape"
        cancelLabel="Conserver"
        variant="destructive"
        onConfirm={async () => {
          if (pendingUpdate) {
            await executeQuickUpdate(pendingUpdate.id, pendingUpdate.field, pendingUpdate.value)
          }
          setPendingUpdate(null)
        }}
      />

      {/* Friction 2026-08-23 — report d'une étape : l'issue non destructrice
          au retard (avant : cocher « fait » ou supprimer la culture). */}
      <Dialog open={reportCible !== null} onOpenChange={(open) => {
        if (!open && !reportLoading) setReportCible(null)
      }}>
        <DialogContent className="sm:max-w-[430px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
              <CalendarClock className="h-5 w-5 text-slate-600" />
            </div>
            <DialogTitle>
              Reporter {reportCible ? LIBELLE_ETAPE_REPORT[reportCible.etape] : "l'étape"}
            </DialogTitle>
            <DialogDescription>
              {reportCible
                ? `Culture #${reportCible.culture.id} — ${reportCible.culture.espece?.nom ?? reportCible.culture.especeId}. Les étapes suivantes du cycle seront décalées d'autant, sans rien supprimer.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <Label htmlFor="culture-report-date">Nouvelle date</Label>
            <Input
              id="culture-report-date"
              type="date"
              autoFocus
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") executerReport()
              }}
              className="h-11 bg-white text-base"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setReportCible(null)} disabled={reportLoading}>
              Retour
            </Button>
            <Button onClick={executerReport} disabled={reportLoading || !reportDate}>
              {reportLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Reporter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
