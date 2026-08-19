"use client"

/**
 * Onglet Arbres - Liste des arbres avec filtres par type et dialog d'ajout
 */

import * as React from "react"
import { urlApercu } from "@/lib/apercu-document"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { TreeDeciduous, Leaf, Cherry, Fence, Flower2, Shrub, CalendarPlus, Map as MapIcon, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/tables/DataTable"
import { Combobox } from "@/components/ui/combobox"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { GpsPositionButton } from "@/components/gps/GpsPositionButton"
import { GpsMapPickerDialog } from "@/components/gps/GpsMapPickerDialog"
import { ReleveGpsDialog } from "@/components/verger/ReleveGpsDialog"
import { roundCoord } from "@/lib/geolocation"
import { adequationEspece } from "@/lib/adequation-zone"
import { CONDUITES_ARBRE } from "@/lib/verger/arbre-constants"
import type { ZoneClimat } from "@/lib/terroir"
import { Snowflake } from "lucide-react"

/**
 * QA cmswxinhf — l'avertissement annonçait la purge des observations et des
 * opérations sans distinguer les traitements phyto, que la suppression effaçait
 * réellement du registre réglementaire. Ils sont désormais conservés quelle que
 * soit leur saisie d'origine (voir src/lib/verger/preserver-traces-phyto.ts).
 */
const AVERTISSEMENT_SUPPRESSION_ARBRE =
  "Bio/HVE : la suppression purge les récoltes, ainsi que les opérations et observations SANS traitement. " +
  "Tous les traitements phytosanitaires restent au registre (détachés de l'arbre, nom snapshoté), comme les lots de bois. " +
  "Préférez « Archiver » pour conserver toute la traçabilité."

const TYPES_ARBRES = [
  { value: "all", label: "Tous", icon: TreeDeciduous },
  { value: "fruitier", label: "Fruitiers", icon: Cherry },
  { value: "petit_fruit", label: "Petits fruits", icon: Shrub },
  { value: "forestier", label: "Forestiers", icon: Leaf },
  { value: "ornement", label: "Ornementaux", icon: Flower2 },
  { value: "haie", label: "Haies", icon: Fence },
] as const

const TYPES_ARBRES_FORM = [
  { value: "fruitier", label: "Fruitier" },
  { value: "petit_fruit", label: "Petit fruit" },
  { value: "forestier", label: "Forestier" },
  { value: "ornement", label: "Ornemental" },
  { value: "haie", label: "Haie" },
]

const ETATS_ARBRE = [
  { value: "excellent", label: "Excellent" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
]

const TYPE_LABELS: Record<string, string> = {
  fruitier: "Fruitier",
  petit_fruit: "Petit fruit",
  forestier: "Forestier",
  ornement: "Ornemental",
  haie: "Haie",
}

const etatColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-700",
  bon: "bg-lime-100 text-lime-700",
  moyen: "bg-yellow-100 text-yellow-700",
  mauvais: "bg-red-100 text-red-700",
}

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  datePlantation: string | null
  etat: string | null
  productif: boolean
  fournisseur?: string | null
  // PROMPT 10 — fiche complète
  portGreffe?: string | null
  porteGreffeId?: string | null
  porteGreffeRef?: { id: string; nom: string; vigueur?: number | null } | null
  gpsLat?: number | null
  gpsLng?: number | null
  // Retour utilisateur 2026-07-27 — rattachement parcellaire visible et
  // corrigeable en masse depuis la liste.
  parcelleGeoId?: string | null
  parcelleGeo?: { id: string; nom: string } | null
  _count?: {
    recoltesArbres: number
    operationsArbres: number
    observationsSante: number
  }
}

interface ParcelleVerger {
  id: string
  nom: string
  usage?: string | null
  couches?: string[]
}

const estParcelleVerger = (parcelle: ParcelleVerger) =>
  parcelle.couches?.includes("VERGER") || parcelle.usage?.split(",").some((usage) => usage.trim().toLowerCase() === "verger")

interface LotArbres {
  id: number
  nom: string
  espece: string
  variete: string | null
  effectif: number
  parcelleGeoId: string
  parcelleGeo: { id: string; nom: string }
}

interface EspeceRef {
  id: string
  type: string
  // Référentiel géographique : adéquation à la zone climatique.
  zonesAdaptees?: string | null
  besoinFroid?: string | null
}

interface VarieteRef {
  id: string
  especeId: string
}

// Map du type d'arbre (form) vers le type d'espece (referentiel)
const TYPE_TO_REF: Record<string, string> = {
  fruitier: "arbre_fruitier",
  petit_fruit: "petit_fruit",
}

function makeColumns(onGenererCalendrier: (arbre: Arbre) => void): ColumnDef<Arbre>[] {
  return [
    {
      accessorKey: "nom",
      header: "Nom",
      // QA cmsp5yry4 — sur mobile les colonnes Espèce et Variété sont masquées :
      // on les replie sous le nom pour ne rien perdre de l'identification.
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.nom}</span>
          <span className="block text-xs text-muted-foreground md:hidden">
            {[row.original.espece, row.original.variete].filter(Boolean).join(" · ") || "—"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      meta: { className: "hidden md:table-cell" },
      cell: ({ getValue }) => {
        const type = getValue() as string
        return (
          <Badge variant="outline" className="text-xs">
            {TYPE_LABELS[type] || type}
          </Badge>
        )
      },
    },
    {
      accessorKey: "espece",
      header: "Espèce",
      meta: { className: "hidden md:table-cell" },
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "variete",
      header: "Variété",
      meta: { className: "hidden md:table-cell" },
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      // QA Hélène 2026-05-15 — Bug #7 : colonne Porte-greffe ajoutée
      // au menu Colonnes. Le filtre "Sans porte-greffe" existait déjà
      // mais la donnée n'était pas affichable depuis la liste.
      // QA 2026-07-30 — On lit d'abord le référentiel (seul renseigné depuis la
      // refonte), puis le texte libre historique pour les arbres anciens.
      id: "portGreffe",
      accessorFn: (arbre) => arbre.porteGreffeRef?.nom ?? arbre.portGreffe ?? null,
      header: "Porte-greffe",
      meta: { className: "hidden md:table-cell" },
      cell: ({ getValue }) => (getValue() as string | null) || "-",
    },
    {
      accessorKey: "datePlantation",
      header: "Plantation",
      meta: { className: "hidden md:table-cell" },
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? new Date(date).toLocaleDateString("fr-FR") : "-"
      },
    },
    {
      // Retour utilisateur 2026-07-27 — sans cette colonne, impossible de
      // repérer d'un coup d'œil les arbres non rattachés à une parcelle.
      id: "parcelle",
      accessorFn: (arbre) => arbre.parcelleGeo?.nom ?? null,
      header: "Parcelle",
      meta: { className: "hidden md:table-cell" },
      cell: ({ getValue }) => {
        const nom = getValue() as string | null
        return nom || <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: "etat",
      header: "État",
      cell: ({ getValue }) => {
        const etat = getValue() as string | null
        if (!etat) return "-"
        return (
          <Badge variant="outline" className={etatColors[etat] || ""}>
            {etat}
          </Badge>
        )
      },
    },
    {
      accessorKey: "productif",
      header: "Productif",
      meta: { className: "hidden md:table-cell" },
      // Bug #13 — On affichait "—" dès que datePlantation manquait, même
      // pour des arbres marqués productif=true par l'utilisateur. C'est
      // la donnée saisie qui prime ; on signale juste les dates futures
      // (arbre pas encore planté) avec un libellé clair.
      cell: ({ row }) => {
        const a = row.original
        if (a.datePlantation) {
          const d = new Date(a.datePlantation)
          if (d.getTime() > Date.now()) {
            return <span className="text-muted-foreground" title="Date de plantation dans le futur">Non (pas planté)</span>
          }
        }
        return a.productif ? "Oui" : "Non"
      },
    },
    {
      id: "calendrier",
      header: "",
      // Masquée sur mobile : le raccourci reste accessible depuis la fiche.
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => {
        const arbre = row.original
        if (!arbre.espece) return null
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            onClick={(e) => {
              e.stopPropagation()
              onGenererCalendrier(arbre)
            }}
            title="Générer le calendrier d'entretien"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </Button>
        )
      },
    },
  ]
}

export function ArbresTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<Arbre[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")
  const [showDialog, setShowDialog] = React.useState(false)
  const [arbreToDelete, setArbreToDelete] = React.useState<Arbre | null>(null)
  const [especesRef, setEspecesRef] = React.useState<EspeceRef[]>([])
  const [varietesRef, setVarietesRef] = React.useState<VarieteRef[]>([])
  const [fournisseursRef, setFournisseursRef] = React.useState<string[]>([])
  const [parcelles, setParcelles] = React.useState<ParcelleVerger[]>([])
  const [lotsArbres, setLotsArbres] = React.useState<LotArbres[]>([])
  const [lotDrafts, setLotDrafts] = React.useState<Record<number, { effectif: string; parcelleGeoId: string }>>({})
  // Zone climatique de l'utilisateur (référentiel géographique) : sert à
  // avertir quand on plante un fruitier à besoin de froid en climat tropical.
  const [userZone, setUserZone] = React.useState<ZoneClimat | null>(null)
  // PROMPT 10 — porte-greffes filtrés par espèce courante du formulaire
  const [portesGreffeOptions, setPortesGreffeOptions] = React.useState<
    Array<{ id: string; nom: string; vigueur: number; precocite: number }>
  >([])
  // PROMPT 10 — filtres "fiche incomplète"
  const [filtreCompletude, setFiltreCompletude] = React.useState<"all" | "sansPorteGreffe" | "sansGps" | "sansParcelle" | "sansEspece">("all")
  // Retour utilisateur 2026-07-27 — rattachement en masse à une parcelle
  const [bulkParcelleId, setBulkParcelleId] = React.useState("")
  const [bulkSaving, setBulkSaving] = React.useState(false)
  // Feedback LVBB40430 — saisie GPS assistée (géoloc, carte, relevé en série)
  const [mapPickerOpen, setMapPickerOpen] = React.useState(false)
  const [releveGpsOpen, setReleveGpsOpen] = React.useState(false)
  const [newArbreGpsAccuracy, setNewArbreGpsAccuracy] = React.useState<number | null>(null)
  const [newArbre, setNewArbre] = React.useState({
    nom: "",
    type: "fruitier",
    espece: "",
    variete: "",
    fournisseur: "",
    dateAchat: "",
    prixAchat: "",
    datePlantation: "",
    etat: "bon",
    // PROMPT 10 — fiche complète
    porteGreffeId: "",
    envergure: "",
    hauteur: "",
    conduite: "",
    anneeProduction: "",
    rendementMoyen: "",
    pollinisateur: "",
    circonferenceCm: "",
    gpsLat: "",
    gpsLng: "",
    parcelleGeoId: "",
  })
  // PROMPT 10 — mode batch "N arbres identiques"
  const [batchMode, setBatchMode] = React.useState(false)
  const [batchPrefix, setBatchPrefix] = React.useState("")
  const [batchCount, setBatchCount] = React.useState("5")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  // QA cmsp5gx9u — les refus de validation ne vivaient que dans un toast de
  // 5 s (voire dans une bulle native hors écran) : erreur persistante rendue
  // en role="alert" près du bouton de soumission.
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  // Deux requêtes simultanées (double-clic) peuvent entrelacer le
  // deleteMany/createMany du serveur et dupliquer les opérations.
  const generatingRef = React.useRef<Set<number>>(new Set())
  const handleGenererCalendrier = React.useCallback(async (arbre: Arbre) => {
    if (generatingRef.current.has(arbre.id)) return
    generatingRef.current.add(arbre.id)
    try {
      const res = await fetch(`/api/arbres/${arbre.id}/generer-calendrier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: `Calendrier généré pour ${data.espece}`, description: `${data.count} opérations créées` })
      } else {
        const err = await res.json()
        toast({ title: "Calendrier non disponible", description: err.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      generatingRef.current.delete(arbre.id)
    }
  }, [toast])

  const columns = React.useMemo(() => makeColumns(handleGenererCalendrier), [handleGenererCalendrier])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      // La liste individuelle est la donnée principale. Une erreur du module
      // optionnel « lots » ne doit jamais vider les arbres déjà chargés.
      const [arbresResult, lotsResult] = await Promise.allSettled([
        fetch("/api/arbres").then(async (response) => {
          if (!response.ok) throw new Error(`arbres:${response.status}`)
          return response.json()
        }),
        fetch("/api/arbres/lots").then(async (response) => {
          if (!response.ok) throw new Error(`lots:${response.status}`)
          return response.json()
        }),
      ])

      if (arbresResult.status !== "fulfilled" || !Array.isArray(arbresResult.value)) {
        throw new Error("Impossible de charger les arbres")
      }
      setData(arbresResult.value)

      if (lotsResult.status === "fulfilled" && Array.isArray(lotsResult.value)) {
        const lots = lotsResult.value as LotArbres[]
        setLotsArbres(lots)
        setLotDrafts(Object.fromEntries(lots.map((lot) => [
          lot.id,
          { effectif: String(lot.effectif), parcelleGeoId: lot.parcelleGeoId },
        ])))
      } else {
        setLotsArbres([])
        setLotDrafts({})
      }
    } catch {
      setData([])
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les arbres" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Retour utilisateur 2026-07-27 — rattacher N arbres sélectionnés à une
  // parcelle en un appel, au lieu de N passages par la fiche arbre.
  const handleBulkParcelle = React.useCallback(
    async (rows: Arbre[], clearSelection: () => void) => {
      if (!bulkParcelleId) return
      setBulkSaving(true)
      try {
        const res = await fetch("/api/arbres/bulk-parcelle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arbreIds: rows.map((a) => a.id),
            parcelleGeoId: bulkParcelleId === "__detacher__" ? null : bulkParcelleId,
          }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast({ title: "Rattachement impossible", description: payload.error, variant: "destructive" })
          return
        }
        const morceaux: string[] = [`${payload.updated} arbre(s) mis à jour`]
        if (payload.conflits?.length) {
          morceaux.push(
            `${payload.conflits.length} refusé(s) : espèce déjà suivie en lot agrégé sur cette parcelle`,
          )
        }
        toast({
          title: bulkParcelleId === "__detacher__" ? "Arbres détachés" : "Arbres rattachés",
          description: [payload.avertissement, morceaux.join(" · ")].filter(Boolean).join(" "),
        })
        clearSelection()
        setBulkParcelleId("")
        fetchData()
      } catch {
        toast({ title: "Erreur", variant: "destructive" })
      } finally {
        setBulkSaving(false)
      }
    },
    [bulkParcelleId, fetchData, toast],
  )

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Zone climatique effective de l'utilisateur (pour l'avertissement plantation).
  React.useEffect(() => {
    fetch("/api/calendrier-climat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setUserZone((d.zone ?? null) as ZoneClimat | null) })
      .catch(() => {})
  }, [])

  // Charger le referentiel des especes arbres + leurs varietes
  React.useEffect(() => {
    Promise.all([
      fetch("/api/especes?type=all_arbres&pageSize=500").then(r => r.json()).catch(() => null),
      fetch("/api/varietes?pageSize=1000").then(r => r.json()).catch(() => null),
      fetch("/api/comptabilite/fournisseurs?actif=true").then(r => r.json()).catch(() => null),
      fetch("/api/carte").then(r => r.json()).catch(() => []),
    ]).then(([especesRes, varietesRes, fournisseursRes, parcellesRes]) => {
      const especes = especesRes?.data || []
      setEspecesRef(especes.map((e: any) => ({ id: e.id, type: e.type, zonesAdaptees: e.zonesAdaptees, besoinFroid: e.besoinFroid })))
      const especesIds = new Set(especes.map((e: any) => e.id))
      const varietes = (varietesRes?.data || [])
        .filter((v: any) => especesIds.has(v.especeId))
        .map((v: any) => ({ id: v.id, especeId: v.especeId }))
      setVarietesRef(varietes)
      const fournisseurs = (fournisseursRes?.data || [])
        .map((f: any) => f.id)
        .filter(Boolean)
      setFournisseursRef(fournisseurs)
      setParcelles((Array.isArray(parcellesRes) ? parcellesRes : []).map((p: ParcelleVerger) => ({ id: p.id, nom: p.nom, usage: p.usage, couches: p.couches ?? [] })))
    })
  }, [])

  const filteredData = React.useMemo(() => {
    let filtered = data
    if (selectedType !== "all") {
      filtered = filtered.filter((a) => a.type === selectedType)
    }
    // PROMPT 10 — filtres complétude
    if (filtreCompletude === "sansPorteGreffe") {
      filtered = filtered.filter((a) => !a.porteGreffeId && !a.portGreffe)
    } else if (filtreCompletude === "sansGps") {
      filtered = filtered.filter((a) => a.gpsLat == null || a.gpsLng == null)
    } else if (filtreCompletude === "sansParcelle") {
      filtered = filtered.filter((a) => !a.parcelleGeoId)
    } else if (filtreCompletude === "sansEspece") {
      filtered = filtered.filter((a) => !a.espece?.trim())
    }
    return filtered
  }, [selectedType, data, filtreCompletude])

  // PROMPT 10 — Charger les porte-greffes adaptés à l'espèce courante du formulaire.
  React.useEffect(() => {
    if (!newArbre.espece) {
      setPortesGreffeOptions([])
      return
    }
    fetch(`/api/verger/porte-greffes?especeId=${encodeURIComponent(newArbre.espece)}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setPortesGreffeOptions(d.data || []))
      .catch(() => setPortesGreffeOptions([]))
  }, [newArbre.espece])

  const especeOptions = React.useMemo(() => {
    const refType = TYPE_TO_REF[newArbre.type]
    const refEspeces = refType
      ? especesRef.filter(e => e.type === refType).map(e => e.id)
      : especesRef.map(e => e.id)
    const userEspeces = data.map(a => a.espece).filter(Boolean) as string[]
    const unique = [...new Set([...refEspeces, ...userEspeces])]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data, especesRef, newArbre.type])

  const varieteOptions = React.useMemo(() => {
    const refVarietes = newArbre.espece
      ? varietesRef.filter(v => v.especeId === newArbre.espece).map(v => v.id)
      : varietesRef.map(v => v.id)
    const userVarietes = data.map(a => a.variete).filter(Boolean) as string[]
    const unique = [...new Set([...refVarietes, ...userVarietes])]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data, varietesRef, newArbre.espece])

  // Avertissement d'adéquation : l'espèce sélectionnée est-elle peu adaptée à la
  // zone de l'utilisateur ? (ex : fruitier à besoin de froid en climat tropical).
  // Non bloquant — le membre peut planter quand même (microclimat d'altitude…).
  const avertissementZone = React.useMemo(() => {
    if (!newArbre.espece || !userZone) return null
    const ref = especesRef.find(e => e.id === newArbre.espece)
    if (!ref) return null
    const { statut, raison } = adequationEspece({
      zonesAdaptees: ref.zonesAdaptees,
      besoinFroid: ref.besoinFroid,
      userZone,
    })
    return statut === 'peu_adaptee' ? raison : null
  }, [newArbre.espece, especesRef, userZone])

  const fournisseurOptions = React.useMemo(() => {
    const userFournisseurs = data.map((a: any) => a.fournisseur).filter(Boolean) as string[]
    const unique = [...new Set([...fournisseursRef, ...userFournisseurs])]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data, fournisseursRef])

  // Feedback LVBB40430 — arbres déjà géolocalisés : repères bleus du sélecteur carte
  const arbresAvecGps = React.useMemo(
    () =>
      data
        .filter((a) => a.gpsLat != null && a.gpsLng != null)
        .map((a) => ({ lat: a.gpsLat as number, lng: a.gpsLng as number, label: a.nom })),
    [data]
  )

  // File du relevé en série : arbres sans coordonnées (filtre type courant respecté)
  const arbresSansGps = React.useMemo(() => {
    let list = data.filter((a) => a.gpsLat == null || a.gpsLng == null)
    if (selectedType !== "all") list = list.filter((a) => a.type === selectedType)
    return [...list]
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
      .map((a) => ({ id: a.id, nom: a.nom, espece: a.espece, variete: a.variete }))
  }, [data, selectedType])

  const handleGpsSaved = React.useCallback((arbreId: number, lat: number, lng: number) => {
    setData((prev) => prev.map((a) => (a.id === arbreId ? { ...a, gpsLat: lat, gpsLng: lng } : a)))
  }, [])

  const resetForm = () => {
    setNewArbre({
      nom: "",
      type: "fruitier",
      espece: "",
      variete: "",
      fournisseur: "",
      dateAchat: "",
      prixAchat: "",
      datePlantation: "",
      etat: "bon",
      porteGreffeId: "",
      envergure: "",
      hauteur: "",
      conduite: "",
      anneeProduction: "",
      rendementMoyen: "",
      pollinisateur: "",
      circonferenceCm: "",
      gpsLat: "",
      gpsLng: "",
      parcelleGeoId: "",
    })
    setBatchMode(false)
    setBatchPrefix("")
    setBatchCount("5")
    setNewArbreGpsAccuracy(null)
  }

  const buildArbrePayload = (overrideNom?: string, overrideDatePlantation?: string, overrideDateAchat?: string) => ({
    nom: overrideNom ?? newArbre.nom,
    type: newArbre.type,
    espece: newArbre.espece || null,
    variete: newArbre.variete || null,
    fournisseur: newArbre.fournisseur || null,
    dateAchat: overrideDateAchat || newArbre.dateAchat || null,
    prixAchat: newArbre.prixAchat || null,
    datePlantation: overrideDatePlantation || newArbre.datePlantation || null,
    etat: newArbre.etat,
    // PROMPT 10
    porteGreffeId: newArbre.porteGreffeId || null,
    envergure: newArbre.envergure ? parseFloat(newArbre.envergure) : null,
    hauteur: newArbre.hauteur ? parseFloat(newArbre.hauteur) : null,
    formeTaille: newArbre.conduite || null,
    anneeProduction: newArbre.anneeProduction ? parseInt(newArbre.anneeProduction) : null,
    rendementMoyen: newArbre.rendementMoyen ? parseFloat(newArbre.rendementMoyen) : null,
    pollinisateur: newArbre.pollinisateur || null,
    circonferenceCm: newArbre.circonferenceCm ? parseFloat(newArbre.circonferenceCm) : null,
    gpsLat: newArbre.gpsLat ? parseFloat(newArbre.gpsLat) : null,
    gpsLng: newArbre.gpsLng ? parseFloat(newArbre.gpsLng) : null,
    parcelleGeoId: newArbre.parcelleGeoId || null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Un double-clic sur « Ajouter l'arbre » envoyait deux POST et créait
    // deux arbres identiques (constaté en prod le 2026-08-10).
    if (isSubmitting) return
    // Source de secours : certains navigateurs/agents remplissent
    // `input[type=date]` juste avant le submit, alors que la mise à jour React
    // contrôlée n'est pas encore visible dans la closure courante.
    // Ticket cmsoeu32c — même traitement pour TOUS les input[type=date] du
    // formulaire : la date d'achat, sans `name`, partait vide à la création.
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const datePlantation =
      String(formData.get("datePlantation") || "").trim() || newArbre.datePlantation
    const dateAchat =
      String(formData.get("dateAchat") || "").trim() || newArbre.dateAchat
    setSubmitError(null)
    const nom = String(formData.get("nom") || "").trim() || newArbre.nom.trim()
    if (!nom && !batchMode) {
      setSubmitError("Le nom est requis.")
      toast({ title: "Le nom est requis", variant: "destructive" })
      return
    }
    // Bug #2 — Date plantation requise (audit Marc 2026-05-14 : sans elle,
    // le calendrier d'entretien, la pyramide d'âge et les aides PCAE/HVE
    // ne fonctionnent pas).
    if (!datePlantation) {
      setSubmitError("Date de plantation requise : elle conditionne le calendrier d'entretien et les calculs d'âge.")
      toast({
        title: "Date de plantation requise",
        description: "Renseignez la date de plantation pour activer le calendrier d'entretien et les calculs d'âge.",
        variant: "destructive",
      })
      return
    }
    // Friction du 2026-08-12 — Espèce requise, même motif que la date de
    // plantation : sans elle, pas de calendrier d'entretien, pas d'âge
    // d'entrée en production (l'arbre sortait « Productif » le jour de sa
    // plantation) et pas de contrôle d'adéquation au climat. Le lot agrégé
    // l'exigeait déjà côté serveur, l'arbre individuel non.
    if (!newArbre.espece.trim()) {
      setSubmitError("Espèce requise : elle conditionne le calendrier d'entretien, l'âge d'entrée en production et l'adéquation au climat.")
      toast({
        title: "Espèce requise",
        description: "Renseignez l'espèce pour générer le calendrier d'entretien et situer l'entrée en production.",
        variant: "destructive",
      })
      return
    }
    if (batchMode) {
      const n = parseInt(batchCount)
      if (!batchPrefix.trim() || !n || n < 1 || n > 200) {
        setSubmitError("Préfixe + quantité (1-200) requis pour la création en lot.")
        toast({ title: "Préfixe + quantité (1-200) requis pour la création en lot", variant: "destructive" })
        return
      }
    }

    setIsSubmitting(true)
    try {
      if (batchMode) {
        const n = parseInt(batchCount)
        const res = await fetch("/api/arbres/lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nom: batchPrefix.trim(), espece: newArbre.espece, variete: newArbre.variete, effectif: n, parcelleGeoId: newArbre.parcelleGeoId, datePlantation }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSubmitError(payload.error || "Création du lot impossible.")
          toast({ title: "Création du lot impossible", description: payload.error, variant: "destructive" })
          return
        }
        setShowDialog(false)
        resetForm()
        toast({ title: `Lot agrégé créé — ${n} arbres`, description: "Aucune fiche d’arbre individuelle n’a été générée." })
        fetchData()
        return
      }

      const res = await fetch("/api/arbres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildArbrePayload(nom, datePlantation, dateAchat)),
      })

      if (res.ok) {
        const created = await res.json()
        setShowDialog(false)
        resetForm()
        toast({ title: created.calendrierGenere ? `Arbre ajouté — calendrier d'entretien généré pour ${newArbre.espece}` : "Arbre ajouté" })
        fetchData()
      } else {
        const error = await res.json().catch(() => ({}))
        setSubmitError(error.error || "Ajout impossible.")
        toast({ title: "Erreur", description: error.error, variant: "destructive" })
      }
    } catch {
      setSubmitError("Ajout impossible : erreur réseau.")
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TYPES_ARBRES.map(({ value, label, icon: Icon }) => (
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

      {/* PROMPT 10 — Filtres complétude */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Complétude :</span>
        <Button
          variant={filtreCompletude === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltreCompletude("all")}
        >
          Tous
        </Button>
        <Button
          variant={filtreCompletude === "sansPorteGreffe" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltreCompletude("sansPorteGreffe")}
        >
          Sans porte-greffe
        </Button>
        <Button
          variant={filtreCompletude === "sansGps" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltreCompletude("sansGps")}
        >
          Sans GPS
        </Button>
        {/* Retour utilisateur 2026-07-27 — repérer les arbres orphelins, puis
            les rattacher en masse via la sélection multiple du tableau. */}
        <Button
          variant={filtreCompletude === "sansParcelle" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltreCompletude("sansParcelle")}
        >
          Sans parcelle{(() => {
            const n = data.filter((a) => !a.parcelleGeoId).length
            return n > 0 ? ` (${n})` : ""
          })()}
        </Button>
        {/* Friction du 2026-08-12 — l'espèce est désormais requise à la
            création, mais les arbres saisis avant restent muets (pas de
            calendrier d'entretien). Ce filtre n'apparaît que s'il en reste :
            c'est le seul moyen pour l'utilisateur de les retrouver. */}
        {(() => {
          const n = data.filter((a) => !a.espece?.trim()).length
          if (n === 0) return null
          return (
            <Button
              variant={filtreCompletude === "sansEspece" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltreCompletude("sansEspece")}
            >
              Sans espèce ({n})
            </Button>
          )
        })()}
        {/* Feedback LVBB40430 — géolocaliser les arbres en enchaînant, sans
            recopier de coordonnées depuis une autre application. */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReleveGpsOpen(true)}
          disabled={arbresSansGps.length === 0}
          className="text-lime-700 border-lime-300 hover:bg-lime-50 hover:text-lime-800"
          title={
            arbresSansGps.length === 0
              ? "Tous les arbres affichés ont déjà des coordonnées GPS"
              : "Enchaîner la géolocalisation des arbres sans coordonnées, arbre par arbre"
          }
        >
          <MapPin className="h-4 w-4 mr-1" />
          Relevé GPS en série{arbresSansGps.length > 0 ? ` (${arbresSansGps.length})` : ""}
        </Button>
        {/* Bug #8 — Planche A4 QR codes pour étiqueter les arbres.
            Lien désactivé si sélection vide ou > 60 arbres (limite de la
            planche) plutôt que d'imprimer silencieusement TOUS les arbres. */}
        <a
          href={urlApercu(
            `/api/verger/etiquettes-planche?ids=${filteredData.map((a) => a.id).join(",")}`,
            `Étiquettes QR — ${filteredData.length} arbre${filteredData.length > 1 ? "s" : ""}`,
          )}
          target="_blank"
          rel="noreferrer"
          aria-disabled={filteredData.length === 0 || filteredData.length > 60}
          className={`ml-auto inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 ${
            filteredData.length === 0 || filteredData.length > 60
              ? "pointer-events-none opacity-50"
              : ""
          }`}
          title={
            filteredData.length === 0
              ? "Aucun arbre dans la sélection filtrée"
              : filteredData.length > 60
                ? "Planche limitée à 60 arbres : affinez les filtres pour réduire la sélection"
                : "Imprimer une planche A4 d'étiquettes QR codes (6 par page)"
          }
        >
          📥 Planche QR codes
        </a>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        // QA cmsp5yry4 — largeur forcée seulement à partir de md : en mobile les
        // colonnes secondaires sont masquées, la liste doit tenir dans l'écran.
        tableClassName="md:min-w-[985px]"
        onAdd={() => {
          setSubmitError(null)
          setShowDialog(true)
        }}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/verger/${row.id}`)}
        onRowEdit={(row) => router.push(`/verger/${row.id}`)}
        onRowDelete={(row) => setArbreToDelete(row)}
        searchPlaceholder="Rechercher un arbre..."
        emptyMessage="Aucun arbre trouvé."
        enableRowSelection
        bulkActions={(rows, clearSelection) => (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bulkParcelleId} onValueChange={setBulkParcelleId}>
              <SelectTrigger className="h-8 w-[240px]" aria-label="Parcelle de rattachement">
                <SelectValue placeholder="Choisir une parcelle…" />
              </SelectTrigger>
              <SelectContent>
                {/* Toutes les parcelles sont proposées : une parcelle sans la
                    couche VERGER reste rattachable (signalée « hors verger »),
                    sinon les utilisateurs qui en ont le plus besoin ne voient
                    aucune option (cause racine du blocage utilisateur). */}
                {parcelles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}{!estParcelleVerger(p) ? " (hors verger)" : ""}
                  </SelectItem>
                ))}
                <SelectItem value="__detacher__">Aucune parcelle (détacher)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!bulkParcelleId || bulkSaving}
              onClick={() => handleBulkParcelle(rows, clearSelection)}
            >
              {bulkSaving ? "Rattachement…" : "Rattacher"}
            </Button>
          </div>
        )}
      />

      {lotsArbres.length > 0 && (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" aria-label="Lots d’arbres agrégés">
          <div><h3 className="font-semibold text-emerald-950">Lots agrégés</h3><p className="text-xs text-emerald-800">Effectifs suivis sans créer de fiches individuelles.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            {lotsArbres.map((lot) => {
              const draft = lotDrafts[lot.id] ?? { effectif: String(lot.effectif), parcelleGeoId: lot.parcelleGeoId }
              return <div key={lot.id} className="space-y-2 rounded-lg border bg-white p-3">
                <p className="font-medium">{lot.nom} · {lot.espece}{lot.variete ? ` ${lot.variete}` : ""}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input aria-label={`Effectif ${lot.nom}`} type="number" min="1" step="1" value={draft.effectif} onChange={(e) => setLotDrafts((all) => ({ ...all, [lot.id]: { ...draft, effectif: e.target.value } }))} />
                  <Select value={draft.parcelleGeoId} onValueChange={(value) => setLotDrafts((all) => ({ ...all, [lot.id]: { ...draft, parcelleGeoId: value } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{parcelles.filter(estParcelleVerger).map((p) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  const res = await fetch("/api/arbres/lots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lot.id, effectif: Number(draft.effectif), parcelleGeoId: draft.parcelleGeoId }) })
                  const payload = await res.json().catch(() => ({}))
                  if (!res.ok) return toast({ title: "Modification impossible", description: payload.error, variant: "destructive" })
                  toast({ title: "Lot mis à jour" }); fetchData()
                }}>Enregistrer le lot</Button>
              </div>
            })}
          </div>
        </section>
      )}

      {/* Confirmation suppression avec dépendances + alternative d'archivage
          (bug feedback testeur 2026-05-25 cmplk9y7q — la suppression cascade
          des récoltes/traitements casse la traçabilité Bio/HVE). */}
      <DeleteConfirmDialog
        open={arbreToDelete !== null}
        onOpenChange={(open) => !open && setArbreToDelete(null)}
        entityLabel={arbreToDelete ? `l'arbre "${arbreToDelete.nom}"` : ""}
        dependencies={
          arbreToDelete?._count
            ? [
                { label: "récoltes", count: arbreToDelete._count.recoltesArbres },
                { label: "opérations (taille, traitement, greffe…)", count: arbreToDelete._count.operationsArbres },
                { label: "observations de santé", count: arbreToDelete._count.observationsSante },
              ]
            : []
        }
        warning={AVERTISSEMENT_SUPPRESSION_ARBRE}
        onConfirm={async () => {
          if (!arbreToDelete) return
          try {
            const res = await fetch(`/api/arbres/${arbreToDelete.id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("delete failed")
            toast({ title: "Arbre supprimé" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur lors de la suppression" })
          }
        }}
        onArchive={async () => {
          if (!arbreToDelete) return
          try {
            const res = await fetch(`/api/arbres/${arbreToDelete.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ etat: "mort" }),
            })
            if (!res.ok) throw new Error("archive failed")
            toast({
              title: "Arbre archivé",
              description: "Récoltes, opérations et observations conservées.",
            })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur d'archivage" })
          }
        }}
      />

      {/* Dialog nouvel arbre */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un arbre</DialogTitle>
          </DialogHeader>
          {/* noValidate : la validation native bloquait le submit sans message
              visible (bulle hors écran dans le dialog scrollable), rendant
              « Ajouter l'arbre » muet (QA cmsp5gx9u). handleSubmit valide et
              affiche l'erreur. Même traitement qu'AnimauxTab. */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input
                name="nom"
                value={newArbre.nom}
                onChange={(e) => {
                  const value = e.currentTarget.value
                  setNewArbre((current) => ({ ...current, nom: value }))
                }}
                placeholder="Ex: Pommier du verger nord"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={newArbre.type}
                  onValueChange={(v) => setNewArbre((current) => ({ ...current, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_ARBRES_FORM.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>État</Label>
                <Select
                  value={newArbre.etat}
                  onValueChange={(v) => setNewArbre((current) => ({ ...current, etat: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETATS_ARBRE.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Espèce *</Label>
                <Combobox
                  value={newArbre.espece}
                  onValueChange={(v) => setNewArbre((current) => ({ ...current, espece: v }))}
                  options={especeOptions}
                  placeholder="Ex : Pommier, Chêne…"
                />
                {avertissementZone && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                    <Snowflake className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>Peu adaptée à votre zone : {avertissementZone}. Vous pouvez planter quand même (microclimat, altitude…).</span>
                  </p>
                )}
              </div>
              <div>
                <Label>Variété</Label>
                <Combobox
                  value={newArbre.variete}
                  onValueChange={(v) => setNewArbre((current) => ({ ...current, variete: v }))}
                  options={varieteOptions}
                  placeholder="Ex: Golden, Sessile..."
                />
              </div>
            </div>
            <div>
              <Label>Fournisseur / Pépinière</Label>
              <Combobox
                value={newArbre.fournisseur}
                onValueChange={(v) => setNewArbre((current) => ({ ...current, fournisseur: v }))}
                options={fournisseurOptions}
                placeholder="Ex: Pépinière du Morvan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date d'achat</Label>
                <Input
                  type="date"
                  name="dateAchat"
                  value={newArbre.dateAchat}
                  onChange={(e) => {
                    const value = e.currentTarget.value
                    setNewArbre((current) => ({ ...current, dateAchat: value }))
                  }}
                  onBlur={(e) => {
                    const value = e.currentTarget.value
                    if (value) setNewArbre((current) => (current.dateAchat === value ? current : { ...current, dateAchat: value }))
                  }}
                />
              </div>
              <div>
                <Label>Prix d'achat (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newArbre.prixAchat}
                  onChange={(e) => setNewArbre((current) => ({ ...current, prixAchat: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Date de plantation *</Label>
              <Input
                type="date"
                name="datePlantation"
                required
                value={newArbre.datePlantation}
                onChange={(e) => {
                  const value = e.currentTarget.value
                  setNewArbre((current) => ({ ...current, datePlantation: value }))
                }}
                onBlur={(e) => {
                  // QA cmsp5gx9u — un remplissage programmatique (agent, autofill)
                  // pose la valeur DOM sans onChange : on resynchronise l'état
                  // pour que le prochain re-render (choix de la parcelle) ne
                  // l'efface pas.
                  const value = e.currentTarget.value
                  if (value) setNewArbre((current) => (current.datePlantation === value ? current : { ...current, datePlantation: value }))
                }}
              />
            </div>

            {/* PROMPT 10 — Spécificités fruitier / agroforesterie */}
            {(newArbre.type === "fruitier" || newArbre.type === "petit_fruit") && (
              <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
                <Label className="text-sm font-medium text-rose-900">Porte-greffe & conduite</Label>
                <div>
                  <Label className="text-xs">Porte-greffe</Label>
                  <Select
                    // Radix Select contrôlé : une valeur "" ne correspond à aucun
                    // SelectItem et empêche la sélection de s'afficher. On utilise
                    // le sentinel "_none" (même pattern que la fiche détail arbre).
                    value={newArbre.porteGreffeId || "_none"}
                    onValueChange={(v) => setNewArbre((current) => ({ ...current, porteGreffeId: v === "_none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        portesGreffeOptions.length === 0
                          ? newArbre.espece ? "Aucun porte-greffe au référentiel pour cette espèce" : "Choisissez d'abord l'espèce"
                          : "Choisir un porte-greffe"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Aucun</SelectItem>
                      {portesGreffeOptions.map((pg) => (
                        <SelectItem key={pg.id} value={pg.id}>
                          {pg.nom} (V{pg.vigueur}/P{pg.precocite})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Conduite</Label>
                  <Select
                    // Même sentinel "_none" que le Select porte-greffe ci-dessus :
                    // permet de revenir à « aucune » après avoir choisi une conduite.
                    value={newArbre.conduite || "_none"}
                    onValueChange={(v) => setNewArbre((current) => ({ ...current, conduite: v === "_none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Aucune</SelectItem>
                      {CONDUITES_ARBRE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Variété pollinisatrice</Label>
                  <Input
                    value={newArbre.pollinisateur}
                    onChange={(e) => setNewArbre((current) => ({ ...current, pollinisateur: e.target.value }))}
                    placeholder="ex: Granny Smith (pour Golden)"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Envergure (m)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={newArbre.envergure}
                  onChange={(e) => setNewArbre((current) => ({ ...current, envergure: e.target.value }))}
                  placeholder="2.5"
                />
              </div>
              <div>
                <Label>Hauteur (m)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={newArbre.hauteur}
                  onChange={(e) => setNewArbre((current) => ({ ...current, hauteur: e.target.value }))}
                  placeholder="3"
                />
              </div>
              <div>
                <Label>Circonférence tronc (cm)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={newArbre.circonferenceCm}
                  onChange={(e) => setNewArbre((current) => ({ ...current, circonferenceCm: e.target.value }))}
                  placeholder="ex: 15 (utile PCAE/HVE)"
                />
              </div>
              <div>
                <Label>1ère année de production</Label>
                <Input
                  type="number" min="1900" max="2100"
                  value={newArbre.anneeProduction}
                  onChange={(e) => setNewArbre((current) => ({ ...current, anneeProduction: e.target.value }))}
                  placeholder="2028"
                />
              </div>
              <div className="col-span-2">
                <Label>Rendement moyen attendu (kg/an)</Label>
                <Input
                  type="number" step="0.5" min="0"
                  value={newArbre.rendementMoyen}
                  onChange={(e) => setNewArbre((current) => ({ ...current, rendementMoyen: e.target.value }))}
                  placeholder="ex: 50"
                />
              </div>
              <div>
                <Label>Latitude GPS</Label>
                <Input
                  type="number" step="0.000001"
                  value={newArbre.gpsLat}
                  onChange={(e) => {
                    setNewArbre((current) => ({ ...current, gpsLat: e.target.value }))
                    setNewArbreGpsAccuracy(null)
                  }}
                  placeholder="48.8566"
                />
              </div>
              <div>
                <Label>Longitude GPS</Label>
                <Input
                  type="number" step="0.000001"
                  value={newArbre.gpsLng}
                  onChange={(e) => {
                    setNewArbre((current) => ({ ...current, gpsLng: e.target.value }))
                    setNewArbreGpsAccuracy(null)
                  }}
                  placeholder="2.3522"
                />
              </div>
              {/* Feedback LVBB40430 — plus de recopie manuelle : géolocalisation
                  en un tap ou pointage sur l'orthophoto IGN. */}
              <div className="col-span-2 flex flex-wrap items-center gap-2">
                <GpsPositionButton
                  onPosition={(fix) => {
                    setNewArbre((prev) => ({
                      ...prev,
                      gpsLat: String(roundCoord(fix.lat)),
                      gpsLng: String(roundCoord(fix.lng)),
                    }))
                    setNewArbreGpsAccuracy(fix.accuracy)
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setMapPickerOpen(true)}>
                  <MapIcon className="h-4 w-4 mr-1.5" />
                  Choisir sur la carte
                </Button>
                {newArbreGpsAccuracy != null && (
                  <span className="text-xs text-muted-foreground">
                    précision ± {Math.round(newArbreGpsAccuracy)} m
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <Label>Parcelle du verger (optionnel)</Label>
              <Select
                value={newArbre.parcelleGeoId || "__none__"}
                onValueChange={(v) => setNewArbre((current) => ({ ...current, parcelleGeoId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Aucune parcelle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune parcelle</SelectItem>
                  {parcelles.filter(estParcelleVerger).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}{p.usage ? ` — ${p.usage}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                En mode lot agrégé, cet effectif sera rattaché à la parcelle sans créer d’arbres individuels.
              </p>
            </div>

            {/* PROMPT 10 — Mode batch */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="h-4 w-4"
                />
                Créer plusieurs arbres identiques (lot)
              </label>
              {batchMode && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Le champ « Nom » sera ignoré au profit d'un nommage automatique
                    {' '}<code className="text-[10px]">prefix-01</code>, <code className="text-[10px]">prefix-02</code>…
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Préfixe (ex: P-RR-2026)</Label>
                      <Input
                        value={batchPrefix}
                        onChange={(e) => setBatchPrefix(e.target.value)}
                        placeholder="P-RR-2026"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quantité (1-200)</Label>
                      <Input
                        type="number" min="1" max="200"
                        value={batchCount}
                        onChange={(e) => setBatchCount(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">{submitError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : batchMode ? `Créer ${batchCount} arbres` : "Ajouter l'arbre"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback LVBB40430 — sélecteur de position sur carte (modale d'ajout) */}
      <GpsMapPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialLat={newArbre.gpsLat ? parseFloat(newArbre.gpsLat) : null}
        initialLng={newArbre.gpsLng ? parseFloat(newArbre.gpsLng) : null}
        contextPoints={arbresAvecGps}
        onConfirm={(lat, lng) => {
          setNewArbre((prev) => ({ ...prev, gpsLat: String(lat), gpsLng: String(lng) }))
          setNewArbreGpsAccuracy(null)
        }}
      />

      {/* Feedback LVBB40430 — relevé GPS en série des arbres sans coordonnées */}
      <ReleveGpsDialog
        open={releveGpsOpen}
        onOpenChange={setReleveGpsOpen}
        arbres={arbresSansGps}
        onSaved={handleGpsSaved}
      />
    </div>
  )
}
