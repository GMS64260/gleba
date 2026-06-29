"use client"

/**
 * Onglet Arbres - Liste des arbres avec filtres par type et dialog d'ajout
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { TreeDeciduous, Leaf, Cherry, Fence, Flower2, Shrub, CalendarPlus } from "lucide-react"
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
  gpsLat?: number | null
  gpsLng?: number | null
  _count?: {
    recoltesArbres: number
    operationsArbres: number
    observationsSante: number
  }
}

const CONDUITES_ARBRE = ["Gobelet", "Axe central", "Palmette", "Espalier", "Libre"] as const

interface EspeceRef {
  id: string
  type: string
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
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
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
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "variete",
      header: "Variété",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      // QA Hélène 2026-05-15 — Bug #7 : colonne Porte-greffe ajoutée
      // au menu Colonnes. Le filtre "Sans porte-greffe" existait déjà
      // mais la donnée n'était pas affichable depuis la liste.
      accessorKey: "portGreffe",
      header: "Porte-greffe",
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "datePlantation",
      header: "Plantation",
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return date ? new Date(date).toLocaleDateString("fr-FR") : "-"
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
  const [filteredData, setFilteredData] = React.useState<Arbre[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")
  const [showDialog, setShowDialog] = React.useState(false)
  const [arbreToDelete, setArbreToDelete] = React.useState<Arbre | null>(null)
  const [especesRef, setEspecesRef] = React.useState<EspeceRef[]>([])
  const [varietesRef, setVarietesRef] = React.useState<VarieteRef[]>([])
  const [fournisseursRef, setFournisseursRef] = React.useState<string[]>([])
  // PROMPT 10 — porte-greffes filtrés par espèce courante du formulaire
  const [portesGreffeOptions, setPortesGreffeOptions] = React.useState<
    Array<{ id: string; nom: string; vigueur: number; precocite: number }>
  >([])
  // PROMPT 10 — filtres "fiche incomplète"
  const [filtreCompletude, setFiltreCompletude] = React.useState<"all" | "sansPorteGreffe" | "sansGps">("all")
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
  })
  // PROMPT 10 — mode batch "N arbres identiques"
  const [batchMode, setBatchMode] = React.useState(false)
  const [batchPrefix, setBatchPrefix] = React.useState("")
  const [batchCount, setBatchCount] = React.useState("5")

  const handleGenererCalendrier = React.useCallback(async (arbre: Arbre) => {
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
    }
  }, [toast])

  const columns = React.useMemo(() => makeColumns(handleGenererCalendrier), [handleGenererCalendrier])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/arbres")
      if (!response.ok) throw new Error("Erreur")
      const items = await response.json()
      setData(items)
      setFilteredData(items)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les arbres" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Charger le referentiel des especes arbres + leurs varietes
  React.useEffect(() => {
    Promise.all([
      fetch("/api/especes?type=all_arbres&pageSize=500").then(r => r.json()).catch(() => null),
      fetch("/api/varietes?pageSize=1000").then(r => r.json()).catch(() => null),
      fetch("/api/comptabilite/fournisseurs?actif=true").then(r => r.json()).catch(() => null),
    ]).then(([especesRes, varietesRes, fournisseursRes]) => {
      const especes = especesRes?.data || []
      setEspecesRef(especes.map((e: any) => ({ id: e.id, type: e.type })))
      const especesIds = new Set(especes.map((e: any) => e.id))
      const varietes = (varietesRes?.data || [])
        .filter((v: any) => especesIds.has(v.especeId))
        .map((v: any) => ({ id: v.id, especeId: v.especeId }))
      setVarietesRef(varietes)
      const fournisseurs = (fournisseursRes?.data || [])
        .map((f: any) => f.id)
        .filter(Boolean)
      setFournisseursRef(fournisseurs)
    })
  }, [])

  React.useEffect(() => {
    let filtered = data
    if (selectedType !== "all") {
      filtered = filtered.filter((a) => a.type === selectedType)
    }
    // PROMPT 10 — filtres complétude
    if (filtreCompletude === "sansPorteGreffe") {
      filtered = filtered.filter((a) => !a.porteGreffeId && !a.portGreffe)
    } else if (filtreCompletude === "sansGps") {
      filtered = filtered.filter((a) => a.gpsLat == null || a.gpsLng == null)
    }
    setFilteredData(filtered)
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

  const fournisseurOptions = React.useMemo(() => {
    const userFournisseurs = data.map((a: any) => a.fournisseur).filter(Boolean) as string[]
    const unique = [...new Set([...fournisseursRef, ...userFournisseurs])]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data, fournisseursRef])

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
    })
    setBatchMode(false)
    setBatchPrefix("")
    setBatchCount("5")
  }

  const buildArbrePayload = (overrideNom?: string) => ({
    nom: overrideNom ?? newArbre.nom,
    type: newArbre.type,
    espece: newArbre.espece || null,
    variete: newArbre.variete || null,
    fournisseur: newArbre.fournisseur || null,
    dateAchat: newArbre.dateAchat || null,
    prixAchat: newArbre.prixAchat || null,
    datePlantation: newArbre.datePlantation || null,
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
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newArbre.nom.trim() && !batchMode) {
      toast({ title: "Le nom est requis", variant: "destructive" })
      return
    }
    // Bug #2 — Date plantation requise (audit Marc 2026-05-14 : sans elle,
    // le calendrier d'entretien, la pyramide d'âge et les aides PCAE/HVE
    // ne fonctionnent pas).
    if (!newArbre.datePlantation) {
      toast({
        title: "Date de plantation requise",
        description: "Renseignez la date de plantation pour activer le calendrier d'entretien et les calculs d'âge.",
        variant: "destructive",
      })
      return
    }
    if (batchMode) {
      const n = parseInt(batchCount)
      if (!batchPrefix.trim() || !n || n < 1 || n > 200) {
        toast({ title: "Préfixe + quantité (1-200) requis pour la création en lot", variant: "destructive" })
        return
      }
    }

    try {
      if (batchMode) {
        // PROMPT 10 — Création en lot : N arbres identiques, suffixés -01..-NN
        const n = parseInt(batchCount)
        const pad = n >= 100 ? 3 : 2
        let okCount = 0
        let calendrierCount = 0
        for (let i = 1; i <= n; i++) {
          const suffix = String(i).padStart(pad, "0")
          const nom = `${batchPrefix.trim()}-${suffix}`
          const res = await fetch("/api/arbres", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildArbrePayload(nom)),
          })
          if (res.ok) {
            const created = await res.json()
            okCount += 1
            if (created.calendrierGenere) calendrierCount += 1
          }
        }
        setShowDialog(false)
        resetForm()
        toast({
          title: `${okCount}/${n} arbres créés`,
          description: calendrierCount > 0 ? `${calendrierCount} calendriers d'entretien générés` : undefined,
        })
        fetchData()
        return
      }

      const res = await fetch("/api/arbres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildArbrePayload()),
      })

      if (res.ok) {
        const created = await res.json()
        setShowDialog(false)
        resetForm()
        toast({ title: created.calendrierGenere ? `Arbre ajouté — calendrier d'entretien généré pour ${newArbre.espece}` : "Arbre ajouté" })
        fetchData()
      } else {
        const error = await res.json()
        toast({ title: "Erreur", description: error.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TYPES_ARBRES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-1">
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
        {/* Bug #8 — Planche A4 QR codes pour étiqueter les arbres.
            Lien désactivé si sélection vide ou > 60 arbres (limite de la
            planche) plutôt que d'imprimer silencieusement TOUS les arbres. */}
        <a
          href={`/api/verger/etiquettes-planche?ids=${filteredData.map((a) => a.id).join(",")}`}
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
        onAdd={() => setShowDialog(true)}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/verger/${row.id}`)}
        onRowEdit={(row) => router.push(`/verger/${row.id}`)}
        onRowDelete={(row) => setArbreToDelete(row)}
        searchPlaceholder="Rechercher un arbre..."
        emptyMessage="Aucun arbre trouvé."
      />

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
        warning="Bio/HVE : la suppression purge le registre phyto et l'historique. Préférez « Archiver » pour conserver la traçabilité."
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={newArbre.nom}
                onChange={(e) => setNewArbre({ ...newArbre, nom: e.target.value })}
                placeholder="Ex: Pommier du verger nord"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={newArbre.type}
                  onValueChange={(v) => setNewArbre({ ...newArbre, type: v })}
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
                  onValueChange={(v) => setNewArbre({ ...newArbre, etat: v })}
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
                <Label>Espèce</Label>
                <Combobox
                  value={newArbre.espece}
                  onValueChange={(v) => setNewArbre({ ...newArbre, espece: v })}
                  options={especeOptions}
                  placeholder="Ex: Pommier, Chene..."
                />
              </div>
              <div>
                <Label>Variété</Label>
                <Combobox
                  value={newArbre.variete}
                  onValueChange={(v) => setNewArbre({ ...newArbre, variete: v })}
                  options={varieteOptions}
                  placeholder="Ex: Golden, Sessile..."
                />
              </div>
            </div>
            <div>
              <Label>Fournisseur / Pépinière</Label>
              <Combobox
                value={newArbre.fournisseur}
                onValueChange={(v) => setNewArbre({ ...newArbre, fournisseur: v })}
                options={fournisseurOptions}
                placeholder="Ex: Pépinière du Morvan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date d'achat</Label>
                <Input
                  type="date"
                  value={newArbre.dateAchat}
                  onChange={(e) => setNewArbre({ ...newArbre, dateAchat: e.target.value })}
                />
              </div>
              <div>
                <Label>Prix d'achat (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newArbre.prixAchat}
                  onChange={(e) => setNewArbre({ ...newArbre, prixAchat: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Date de plantation *</Label>
              <Input
                type="date"
                required
                value={newArbre.datePlantation}
                onChange={(e) => setNewArbre({ ...newArbre, datePlantation: e.target.value })}
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
                    onValueChange={(v) => setNewArbre({ ...newArbre, porteGreffeId: v === "_none" ? "" : v })}
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
                    onValueChange={(v) => setNewArbre({ ...newArbre, conduite: v === "_none" ? "" : v })}
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
                    onChange={(e) => setNewArbre({ ...newArbre, pollinisateur: e.target.value })}
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
                  onChange={(e) => setNewArbre({ ...newArbre, envergure: e.target.value })}
                  placeholder="2.5"
                />
              </div>
              <div>
                <Label>Hauteur (m)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={newArbre.hauteur}
                  onChange={(e) => setNewArbre({ ...newArbre, hauteur: e.target.value })}
                  placeholder="3"
                />
              </div>
              <div>
                <Label>Circonférence tronc (cm)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={newArbre.circonferenceCm}
                  onChange={(e) => setNewArbre({ ...newArbre, circonferenceCm: e.target.value })}
                  placeholder="ex: 15 (utile PCAE/HVE)"
                />
              </div>
              <div>
                <Label>1ère année de production</Label>
                <Input
                  type="number" min="1900" max="2100"
                  value={newArbre.anneeProduction}
                  onChange={(e) => setNewArbre({ ...newArbre, anneeProduction: e.target.value })}
                  placeholder="2028"
                />
              </div>
              <div className="col-span-2">
                <Label>Rendement moyen attendu (kg/an)</Label>
                <Input
                  type="number" step="0.5" min="0"
                  value={newArbre.rendementMoyen}
                  onChange={(e) => setNewArbre({ ...newArbre, rendementMoyen: e.target.value })}
                  placeholder="ex: 50"
                />
              </div>
              <div>
                <Label>Latitude GPS</Label>
                <Input
                  type="number" step="0.000001"
                  value={newArbre.gpsLat}
                  onChange={(e) => setNewArbre({ ...newArbre, gpsLat: e.target.value })}
                  placeholder="48.8566"
                />
              </div>
              <div>
                <Label>Longitude GPS</Label>
                <Input
                  type="number" step="0.000001"
                  value={newArbre.gpsLng}
                  onChange={(e) => setNewArbre({ ...newArbre, gpsLng: e.target.value })}
                  placeholder="2.3522"
                />
              </div>
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

            <Button type="submit" className="w-full">
              {batchMode ? `Créer ${batchCount} arbres` : "Ajouter l'arbre"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
