"use client"

/**
 * Onglet Opérations - Liste des opérations avec filtres et dialog d'ajout
 */

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ColumnDef } from "@tanstack/react-table"
import { Wrench, ListTodo, Check, CheckCircle, AlertTriangle, X } from "lucide-react"
import { checkOperationSaison } from "@/lib/tree-care-calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectNatif } from "@/components/ui/select-natif"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/tables/DataTable"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { WeatherFieldset, EMPTY_WEATHER, type WeatherData } from "@/components/phyto/WeatherFieldset"
import { MaterielFieldset } from "@/components/phyto/MaterielFieldset"
import { libelleOperationArbre } from "@/lib/verger/operation-label"
import { statutOperationArbre } from "@/lib/operation-arbre-statut"
import {
  anneeOperationArbre,
  dateReferenceOperationArbre,
  operationArbreDansAnnee,
  resumeCoutOperations,
} from "@/lib/verger/annee-operation"
import { formatMontantDevise } from "@/lib/format-utils"
import { updateDashboardSearchParams } from "@/lib/dashboard-navigation"
import { lireArbreOuverture, operationsDeLArbre } from "@/lib/verger/lien-operations-arbre"

const FILTER_STATES = [
  { value: "all", label: "Toutes", icon: Wrench },
  { value: "afaire", label: "À faire", icon: ListTodo },
  { value: "fait", label: "Réalisées", icon: CheckCircle },
] as const

const TYPES_OPERATIONS = [
  { value: "taille", label: "Taille" },
  { value: "greffe", label: "Greffe" },
  { value: "traitement", label: "Traitement" },
  { value: "fertilisation", label: "Fertilisation" },
  { value: "autre", label: "Autre" },
]

interface Arbre {
  id: number
  nom: string
  type: string
  espece?: string | null
  variete?: string | null
}

interface OperationArbre {
  id: number
  arbreId: number
  date: string
  type: string
  description: string | null
  produit: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  datePrevue: string | null
  fenetreDebut: string | null
  dateLimite: string | null
  abandonneeLe: string | null
  fait: boolean
  notes: string | null
  arbre: Arbre
}

function createColumns(
  onToggleFait: (op: OperationArbre) => void
): ColumnDef<OperationArbre>[] {
  return [
    {
      id: "fait_toggle",
      header: "Fait",
      cell: ({ row }) => {
        const op = row.original
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFait(op)
            }}
          >
            {op.fait ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <div className="h-4 w-4 border-2 rounded" />
            )}
          </Button>
        )
      },
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        // Bug #8 — Pour une opération non faite, c'est la `datePrevue` qui
        // porte la date métier (la `date` colonne est juste un default now()
        // au moment du seed, raison pour laquelle 7 ops Boskoop étaient
        // toutes affichées au 14/05).
        // Bug feedback testeur 2026-05-26 (cmplp0rb) — Ajout du badge "En
        // retard" pour les opérations non faites dont datePrevue est
        // dépassée.
        // Fenêtre saisonnière (2026-08-03) : le badge suit désormais la règle
        // partagée. Une opération générée dont la fenêtre est ouverte n'est pas
        // en retard, et une fenêtre refermée est un rendez-vous manqué pour la
        // saison, pas un retard qui s'aggrave chaque jour.
        // QA 2026-10-19 — même date que celle qui range l'opération dans une
        // année (src/lib/verger/annee-operation.ts).
        const op = row.original
        const effective = dateReferenceOperationArbre(op)
        const label = effective ? effective.toLocaleDateString("fr-FR") : "-"
        const statut = statutOperationArbre(op)
        return (
          <span className={!op.fait ? "text-slate-600" : ""}>
            {label}
            {statut === "a_venir" || statut === "a_faire" ? (
              <span className="ml-1 text-[10px] text-slate-400">(prévu)</span>
            ) : null}
            {statut === "en_retard" ? (
              <Badge className="ml-1 bg-red-100 text-red-700 text-[10px] border border-red-300" variant="outline">
                En retard
              </Badge>
            ) : null}
            {statut === "fenetre_depassee" ? (
              <Badge className="ml-1 bg-amber-100 text-amber-800 text-[10px] border border-amber-300" variant="outline">
                Fenêtre dépassée
              </Badge>
            ) : null}
            {statut === "soldee" ? (
              <Badge className="ml-1 bg-slate-100 text-slate-600 text-[10px] border border-slate-300" variant="outline">
                Soldée
              </Badge>
            ) : null}
          </span>
        )
      },
    },
    {
      accessorKey: "arbre.nom",
      header: "Arbre",
      cell: ({ row }) => <span className="font-medium">{row.original.arbre.nom}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ getValue }) => {
        // Bug #17 — mapping code → label accentué (les codes en DB sont
        // sans accents pour rester compatibles avec les seeds historiques).
        const label = libelleOperationArbre((getValue() as string) ?? "")
        return (
          <Badge variant="outline" className="text-xs capitalize">
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "produit",
      header: "Produit",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      id: "quantiteUnite",
      header: "Qte",
      cell: ({ row }) => {
        const op = row.original
        if (!op.quantite) return "-"
        return `${op.quantite}${op.unite ? ` ${op.unite}` : ""}`
      },
    },
    {
      accessorKey: "cout",
      header: "Coût",
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        return val ? `${val} €` : "-"
      },
    },
  ]
}

interface OperationsTabProps {
  /** Année du sélecteur du verger (URL `?annee=`, voir useAnneeModule). */
  annee: number
}

export function OperationsTab({ annee }: OperationsTabProps) {
  const { toast } = useToast()
  const [data, setData] = React.useState<OperationArbre[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filterFait, setFilterFait] = React.useState("all")
  // QA cmvnorxov — arbre choisi depuis sa fiche (« Voir les opérations »),
  // comparé par identifiant. Paramètre d'ouverture `?arbreId=` lu au montage
  // puis retiré de l'URL, le reste de la requête gardé (motif 7) ; le filtre
  // vit ensuite dans l'état de l'onglet et se retire par son bouton.
  const [arbreFiltreId, setArbreFiltreId] = React.useState<number | null>(null)
  const [showDialog, setShowDialog] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [newOperation, setNewOperation] = React.useState({
    arbreId: "",
    // Date locale (toISOString donnait la veille en UTC entre minuit et 2h FR)
    date: format(new Date(), "yyyy-MM-dd"),
    type: "taille",
    description: "",
    produit: "",
    quantite: "",
    unite: "",
    cout: "",
    datePrevue: "",
    fait: true,
    notes: "",
    // DEV3 #6
    operateur: "" as string,
    tempsHeures: "" as string,
  })
  const [opWeather, setOpWeather] = React.useState<WeatherData>(EMPTY_WEATHER)
  const [opMateriel, setOpMateriel] = React.useState<string[]>([])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      // QA 2026-10-19 — la liste et le coût suivent l'année du sélecteur du
      // verger : la route filtre par la règle partagée (annee-operation.ts).
      const [opsRes, arbresRes] = await Promise.all([
        fetch(`/api/arbres/operations?annee=${annee}`),
        fetch("/api/arbres"),
      ])
      // QA cmsnnybbg — un GET en échec laissait la table sur « Aucune
      // opération trouvée », indiscernable d'un verger vide.
      if (opsRes.ok) {
        setData(await opsRes.json())
      } else {
        toast({ variant: "destructive", title: "Impossible de charger les opérations", description: `Erreur ${opsRes.status}` })
      }
      if (arbresRes.ok) setArbres(await arbresRes.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les opérations" })
    } finally {
      setIsLoading(false)
    }
  }, [toast, annee])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  React.useEffect(() => {
    const { arbreId, requete } = lireArbreOuverture(window.location.search)
    if (requete === null) return
    if (arbreId !== null) setArbreFiltreId(arbreId)
    // Nettoyage par l'API History, état `null` (cf. dashboard-navigation.ts).
    updateDashboardSearchParams(new URLSearchParams(requete), "replace")
  }, [])

  const dataArbre = React.useMemo(() => operationsDeLArbre(data, arbreFiltreId), [data, arbreFiltreId])

  const filteredData = React.useMemo(() => {
    if (filterFait === "fait") return dataArbre.filter((op) => op.fait)
    if (filterFait === "afaire") return dataArbre.filter((op) => !op.fait)
    return dataArbre
  }, [dataArbre, filterFait])

  // Nom affiché du filtre : la liste des arbres du compte, à défaut une
  // opération chargée de cet arbre. Un arbre introuvable n'a pas de fiche à
  // ouvrir : son libellé reste un texte simple.
  const nomArbreConnu =
    arbreFiltreId === null
      ? null
      : arbres.find((a) => a.id === arbreFiltreId)?.nom ??
        data.find((op) => op.arbreId === arbreFiltreId)?.arbre.nom ??
        null
  const nomArbreFiltre =
    arbreFiltreId === null
      ? null
      : nomArbreConnu ?? (isLoading ? "…" : `n° ${arbreFiltreId} (introuvable)`)

  const coutAnnee = resumeCoutOperations(dataArbre)

  const handleToggleFait = React.useCallback(
    async (op: OperationArbre) => {
      // Feedback Marc 2026-05-16 — V2 Bug 2 : la précédente version
      // utilisait `!op.fait` à la fois pour le corps PUT, pour le
      // setData et pour le toast. Si plusieurs clics enchaînés ou un
      // état désynchronisé survenaient, le `op.fait` capturé dans la
      // closure ne reflétait plus l'état réel → "Fait !" affiché mais
      // bouton restant orange. On verrouille désormais la nouvelle
      // valeur (`nextFait`) en lecture d'état au moment du clic, on
      // utilise la réponse serveur comme source de vérité et on
      // corrige aussi l'accent ("Annule" → "Annulé").
      const nextFait = !op.fait
      // Bug feedback testeur 2026-05-26 (cmpm70td5) — au passage "fait", on
      // enregistre la date RÉELLE de réalisation (aujourd'hui) au lieu de
      // laisser la date prévue ; à l'annulation, on revient à la date prévue
      // si elle existe. La datePrevue reste inchangée (planification).
      const today = format(new Date(), "yyyy-MM-dd")
      const nextDate = nextFait
        ? today
        : (op.datePrevue ? op.datePrevue.split("T")[0] : undefined)
      try {
        const res = await fetch(`/api/arbres/operations/${op.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fait: nextFait, ...(nextDate ? { date: nextDate } : {}) }),
        })
        if (!res.ok) {
          toast({ variant: "destructive", title: "Erreur", description: "Mise à jour refusée" })
          return
        }
        const updated = (await res.json().catch(() => null)) as OperationArbre | null
        const suivante: OperationArbre = { ...op, ...(updated ?? {}), fait: updated?.fait ?? nextFait }
        // QA 2026-10-19 — réalisée aujourd'hui, une opération prévue une autre
        // année change d'exercice : elle quitte la liste, et on le dit.
        const anneeSuivante = anneeOperationArbre(suivante)
        setData((prev) =>
          prev
            .map((o) => (o.id === op.id ? suivante : o))
            .filter((o) => o.id !== op.id || operationArbreDansAnnee(o, annee))
        )
        toast({
          title: nextFait ? "Fait !" : "Annulé",
          description:
            anneeSuivante !== null && anneeSuivante !== annee
              ? `Opération désormais rangée en ${anneeSuivante} : choisissez cette année pour la retrouver.`
              : undefined,
        })
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      }
    },
    [toast, annee]
  )

  const columns = React.useMemo(() => createColumns(handleToggleFait), [handleToggleFait])

  const resetForm = () => {
    setNewOperation({
      arbreId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      type: "taille",
      description: "",
      produit: "",
      quantite: "",
      unite: "",
      cout: "",
      datePrevue: "",
      fait: true,
      notes: "",
      operateur: "",
      tempsHeures: "",
    })
    setOpWeather(EMPTY_WEATHER)
    setOpMateriel([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    const submitted = new FormData(e.currentTarget as HTMLFormElement)
    // Certains agents/navigateurs remplissent input[type=date] juste avant le
    // submit sans déclencher l'état React. Le DOM soumis est la source finale.
    const submittedDate = String(submitted.get("date") || "").trim()
    const submittedDatePrevue = String(submitted.get("datePrevue") || "").trim()
    const date = submittedDate || newOperation.date
    const datePrevue = submittedDatePrevue || newOperation.datePrevue
    // QA cmsnnybbg — l'arbre affiché dans le champ gagne sur l'état React.
    // QA cmv2r0t6a — sûr depuis le <select> natif : sans choix, l'option vide
    // (désactivée, donc absente du FormData) laisse l'état vide, et la garde
    // ci-dessous refuse au lieu d'envoyer le premier arbre de la liste.
    const arbreId = String(submitted.get("arbreId") || "").trim() || newOperation.arbreId
    const typeOperation = String(submitted.get("type") || "").trim() || newOperation.type

    // Famille C — au lieu d'un bouton grisé muet, on valide explicitement
    // l'arbre requis avec un message clair.
    if (!arbreId) {
      toast({ title: "Sélectionnez un arbre", variant: "destructive" })
      return
    }
    if (!newOperation.fait && !datePrevue) {
      toast({
        title: "Date prévue requise",
        description: "Une opération à faire doit avoir une date de planification.",
        variant: "destructive",
      })
      return
    }
    setIsSubmitting(true)
    try {
      // Bug feedback testeur 2026-05-26 (cmpmqugqr) — un traitement phyto sans
      // produit/dose rend le registre non conforme (Bio/HVE). On confirme
      // explicitement avant d'enregistrer une fiche incomplète.
      if (typeOperation === "traitement" && (!newOperation.produit.trim() || !newOperation.quantite.trim())) {
        const ok = await confirmDialog(
          "Traitement sans produit et/ou dose : la fiche sera incomplète et non conforme au registre phytosanitaire (Bio/HVE). Enregistrer quand même ?",
          { title: "Traitement incomplet", confirmLabel: "Enregistrer quand même", variant: "warning" }
        )
        if (!ok) return
      }
      const res = await fetch("/api/arbres/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arbreId: parseInt(arbreId),
          // `date` est non nullable en base. Pour une tâche à faire, on y
          // conserve aussi la date prévue afin que les anciens écrans restent
          // cohérents, tout en gardant `datePrevue` explicite.
          date: newOperation.fait ? (date || format(new Date(), "yyyy-MM-dd")) : datePrevue,
          type: typeOperation,
          description: newOperation.description || null,
          produit: newOperation.produit || null,
          quantite: newOperation.quantite ? parseFloat(newOperation.quantite) : null,
          unite: newOperation.unite || null,
          cout: newOperation.cout ? parseFloat(newOperation.cout) : null,
          datePrevue: datePrevue || null,
          fait: newOperation.fait,
          notes:
            [
              newOperation.notes.trim(),
              newOperation.operateur.trim() ? `Opérateur : ${newOperation.operateur.trim()}` : "",
            ]
              .filter(Boolean)
              .join(" — ") || null,
          // DEV3 #6 — opérateur + temps + météo + matériel
          // Note : `operateur` est ici en texte libre (pas FK) alors que l'API
          // n'accepte que `operateurId` (FK User). Pour une vraie intégration
          // FK, créer un dropdown utilisateurs ; en attendant on concatène le
          // label dans `notes` (ci-dessus) pour traçabilité simple.
          tempsHeures: newOperation.tempsHeures || null,
          temperatureC: opWeather.temperatureC,
          ventKmh: opWeather.ventKmh,
          hygrometriePct: opWeather.hygrometriePct,
          pluie24h: opWeather.pluie24h,
          pluie24hMm: opWeather.pluie24hMm,
          materiel: opMateriel,
        }),
      })

      if (res.ok) {
        // QA 2026-10-19 — une opération d'une autre année que celle affichée
        // n'apparaît pas dans la liste : le dire plutôt que la laisser « disparaître ».
        const anneeCreee = anneeOperationArbre({
          fait: newOperation.fait,
          date: newOperation.fait ? date || null : datePrevue || null,
          datePrevue: datePrevue || null,
        })
        setShowDialog(false)
        resetForm()
        toast({
          title: "Opération enregistrée",
          description:
            anneeCreee !== null && anneeCreee !== annee
              ? `Rangée en ${anneeCreee} : choisissez cette année dans le sélecteur pour la voir.`
              : undefined,
        })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de l'enregistrement", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats cout de l'année (QA 2026-10-19 : suit le sélecteur d'année) */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Coût des opérations {annee}
              {nomArbreFiltre !== null ? ` pour ${nomArbreFiltre}` : ""}
            </p>
            <p className="text-xl font-bold" data-testid="cout-operations-annee">{formatMontantDevise(coutAnnee.total)}</p>
          </div>
          {coutAnnee.prevu > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              dont {formatMontantDevise(coutAnnee.realise)} réalisés et {formatMontantDevise(coutAnnee.prevu)} prévus
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Année {annee} : opérations réalisées en {annee}, et opérations à faire prévues en {annee}.
            Une opération à faire d&apos;une autre année reste rangée sous son année ; le Calendrier
            regroupe tout ce qui reste à faire.
          </p>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Tabs value={filterFait} onValueChange={setFilterFait}>
        <TabsList className="flex-wrap h-auto gap-1">
          {/* QA cmswxt8a8 — sous 640 px, le libellé était masqué sans aucun
              équivalent accessible : trois icônes ambiguës (clé, liste, coche)
              pour « Toutes / À faire / Réalisées ». Les trois libellés tiennent
              largement dans 375 px, on les garde ; l'aria-label couvre les
              lecteurs d'écran et l'affichage compact éventuel. */}
          {FILTER_STATES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              title={label}
              className="flex items-center gap-1 text-xs sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {arbreFiltreId !== null && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-lime-200 bg-lime-50 px-3 py-2 text-sm"
          data-testid="filtre-arbre-operations"
        >
          <span>
            Opérations de l&apos;arbre{" "}
            {nomArbreConnu !== null ? (
              <Link href={`/verger/${arbreFiltreId}`} className="font-medium text-lime-800 underline">
                {nomArbreConnu}
              </Link>
            ) : (
              <span className="font-medium">{nomArbreFiltre}</span>
            )}{" "}
            en {annee}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setArbreFiltreId(null)}
            title="Retirer le filtre sur l'arbre"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Tous les arbres
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        onAdd={() => setShowDialog(true)}
        onRefresh={fetchData}
        onRowDelete={async (row) => {
          if (!(await confirmDialog("Supprimer cette opération ?"))) return
          try {
            const res = await fetch(`/api/arbres/operations/${row.id}`, { method: "DELETE" })
            if (!res.ok) {
              const p = await res.json().catch(() => null)
              toast({ variant: "destructive", title: "Erreur", description: p?.error || "Suppression impossible" })
              return
            }
            toast({ title: "Opération supprimée" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher une opération..."
        emptyMessage={
          arbreFiltreId !== null ? `Aucune opération de cet arbre en ${annee}.` : "Aucune opération trouvée."
        }
        tableClassName="min-w-[820px]"
      />

      {/* Dialog nouvelle operation */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enregistrer une opération</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="operation-arbre">Arbre *</Label>
                {/* QA cmv2r0t6a — <select> natif avec une option vide : le
                    select caché du Select Radix n'en avait pas tant que rien
                    n'était choisi, le navigateur y sélectionnait donc le
                    premier arbre, que la relecture FormData envoyait. */}
                <SelectNatif
                  id="operation-arbre"
                  name="arbreId"
                  value={newOperation.arbreId}
                  onChange={(e) => {
                    const arbreId = e.target.value
                    setNewOperation((prev) => ({ ...prev, arbreId }))
                  }}
                >
                  <option value="" disabled>
                    — Sélectionner un arbre —
                  </option>
                  {arbres.map((a) => (
                    <option key={a.id} value={a.id.toString()}>
                      {a.nom}
                    </option>
                  ))}
                </SelectNatif>
              </div>
              <div>
                <Label htmlFor="operation-type">Type *</Label>
                {/* Même motif que l'arbre (cmv2r0t6a) : le type, relu dans le
                    FormData à l'envoi, passe en <select> natif. */}
                <SelectNatif
                  id="operation-type"
                  name="type"
                  value={newOperation.type}
                  onChange={(e) => {
                    const type = e.target.value
                    setNewOperation((prev) => ({ ...prev, type }))
                  }}
                >
                  {/* Un type hors liste (ligne ancienne) reste affiché tel
                      quel : un <select> natif retomberait sur « Taille » et le
                      renverrait à l'enregistrement. */}
                  {newOperation.type && !TYPES_OPERATIONS.some((t) => t.value === newOperation.type) && (
                    <option value={newOperation.type}>{newOperation.type}</option>
                  )}
                  {TYPES_OPERATIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </SelectNatif>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date réalisation</Label>
                <Input
                  name="date"
                  type="date"
                  value={newOperation.date}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, date: e.target.value }))}
                  onBlur={(e) => {
                    // Un remplissage programmatique (agent, autofill) pose la
                    // valeur DOM sans onChange : on resynchronise l'état pour
                    // que le prochain re-render ne l'efface pas (cmsoaxmok).
                    const v = e.target.value
                    if (v) setNewOperation((prev) => (prev.date === v ? prev : { ...prev, date: v }))
                  }}
                />
              </div>
              <div>
                <Label>Date prévue</Label>
                <Input
                  name="datePrevue"
                  type="date"
                  value={newOperation.datePrevue}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, datePrevue: e.target.value }))}
                  onBlur={(e) => {
                    const v = e.target.value
                    if (v) setNewOperation((prev) => (prev.datePrevue === v ? prev : { ...prev, datePrevue: v }))
                  }}
                />
              </div>
            </div>
            {/* Alerte agronomique hors-saison (cmpmqshr3, cmpm719ks) — non
                bloquante, basée sur le calendrier d'entretien par espèce. */}
            {(() => {
              const arbre = arbres.find((a) => a.id.toString() === newOperation.arbreId)
              // QA cmsqn4nmi — quand on PLANIFIE (« réalisée » décochée), la
              // date qui compte est la date prévue : l'alerte regardait
              // `date` (pré-remplie à aujourd'hui) et criait « hors période »
              // pour une taille planifiée en plein janvier. À force de crier
              // au loup à chaque planification, elle aurait été ignorée.
              const dateRef = newOperation.fait
                ? (newOperation.date || newOperation.datePrevue)
                : (newOperation.datePrevue || newOperation.date)
              const w = arbre
                ? checkOperationSaison(arbre.espece, newOperation.type, dateRef, arbre.variete)
                : null
              if (!w) return null
              return (
                <div
                  className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                    w.niveau === "alerte"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-amber-300 bg-amber-50 text-amber-700"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              )
            })()}
            <div>
              <Label>Description</Label>
              <Input
                value={newOperation.description}
                onChange={(e) => setNewOperation((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Produit utilisé</Label>
                <Input
                  value={newOperation.produit}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, produit: e.target.value }))}
                  placeholder="Ex: Bouillie bordelaise"
                />
              </div>
              <div>
                <Label>Quantité</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newOperation.quantite}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, quantite: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unité</Label>
                <Input
                  value={newOperation.unite}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, unite: e.target.value }))}
                  placeholder="L, kg, g"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Coût (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOperation.cout}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, cout: e.target.value }))}
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fait"
                    checked={newOperation.fait}
                    onCheckedChange={(checked) =>
                      setNewOperation((prev) => ({ ...prev, fait: !!checked }))
                    }
                  />
                  <Label htmlFor="fait">Opération réalisée</Label>
                </div>
              </div>
            </div>
            {/* DEV3 #6 — Opérateur + temps de travail (audit Marc 2026-05-14) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Opérateur</Label>
                <Input
                  value={newOperation.operateur}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, operateur: e.target.value }))}
                  placeholder="Nom de l'opérateur"
                />
              </div>
              <div>
                <Label>Temps de travail (h)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={newOperation.tempsHeures}
                  onChange={(e) => setNewOperation((prev) => ({ ...prev, tempsHeures: e.target.value }))}
                  placeholder="2.5"
                />
              </div>
            </div>

            {/* DEV3 #6 — Bloc Météo (composant partagé avec registre phyto) */}
            <WeatherFieldset value={opWeather} onChange={setOpWeather} legend="Météo de l'opération" />

            {/* DEV3 #6 — Matériel utilisé (multi-select libre) */}
            <MaterielFieldset value={opMateriel} onChange={setOpMateriel} />

            {/* DEV3 #6 — Si type = Traitement, redirige vers le formulaire phyto complet */}
            {newOperation.type === "traitement" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
                <p className="font-semibold text-amber-800 mb-1">⚠ Type Traitement</p>
                <p className="text-amber-700">
                  Pour saisir un traitement phytosanitaire complet (Certiphyto, ZNT, EPI),
                  utilisez plutôt l&apos;onglet <strong>Santé &amp; Phyto</strong> qui ouvre le
                  formulaire conforme à l&apos;arrêté du 4 mai 2017 modifié.
                </p>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Input
                value={newOperation.notes}
                onChange={(e) => setNewOperation((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
