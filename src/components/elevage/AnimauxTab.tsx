"use client"

/**
 * Onglet Animaux - Animaux individuels + Lots en sous-onglets
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Bird,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Filter,
  Stethoscope,
  Scissors,
  ShoppingCart,
  Skull,
  Trash2,
  Map as MapIcon,
  FileText,
  Archive,
  CheckCircle2,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { labelStatutAnimal, labelStatutLot } from "@/lib/elevage/labels"
import { confirmDialog } from "@/lib/global-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { especeBaseId, especeBaseLabel, listEspecesBasePresentes } from "@/lib/elevage/espece-base"
import { useFiliereSelection, filiereMatch } from "@/lib/elevage/filiere-context"
import { coerceFiliere, type Filiere } from "@/lib/elevage/filiere"
import { capacites } from "@/lib/elevage/filiere-ui"
import { useElevageModes } from "@/hooks/use-elevage-modes"
import { AnimalCombobox } from "./AnimalCombobox"
import { RaceCombobox } from "./RaceCombobox"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { todayLocalISO } from '@/lib/format-utils'
import { ImportAnimauxCsv } from './ImportAnimauxCsv'
import {
  isValidIdentifiant,
  placeholderIdentifiant,
  type TypeIdentifiant,
} from '@/lib/identification-animal'

// ============================================================
// Types
// ============================================================

interface Animal {
  id: number
  identifiant: string | null
  typeIdentifiant: string | null
  nom: string | null
  race: string | null
  raceAnimaleId: string | null
  raceAnimale: { id: string; nom: string } | null
  orientationProduction: string | null
  sexe: string | null
  dateNaissance: string | null
  dateArrivee: string | null
  statut: string
  poidsActuel: number | null
  provenance: string | null
  nExploitationOrigine: string | null
  statutSanitaire: string[]
  statutsSanitairesStructures: Array<{
    id: string
    statut: "indemne" | "en_cours" | "positif" | "inconnu"
    maladie: { id: string; nom: string }
  }>
  prixAchat: number | null
  prixAchatInclusDansLot: boolean
  notes: string | null
  mereId: number | null
  pereId: number | null
  pereIdentifiant: string | null
  mereIdentifiant: string | null
  especeAnimale: {
    id: string
    nom: string
    type: string
    filiere: string | null
    couleur: string | null
    poidsAdulte: number | null
  }
  lot: { id: number; nom: string } | null
  parcelleGeoId: string | null
  _count: {
    productionsOeufs: number
    soins: number
    enfants: number
  }
}

interface Lot {
  id: number
  nom: string | null
  dateArrivee: string | null
  quantiteInitiale: number
  quantiteActuelle: number
  provenance: string | null
  prixAchatTotal: number | null
  notes: string | null
  statut: string
  parcelleGeo: { id: string; nom: string } | null
  especeAnimale: { id: string; nom: string; type: string; filiere: string | null; couleur: string | null }
  _count: { animaux: number; productionsOeufs: number; soins: number }
}

interface Parcelle {
  id: string
  nom: string
}

interface EspeceAnimale {
  id: string
  nom: string
  type: string
  production?: string | null
  filiere?: string | null
}

interface RaceAnimaleOption {
  id: string
  nom: string
  especeAnimaleId: string
  origine?: string | null
  aptitudes?: string[]
}

const STATUT_COLORS: Record<string, string> = {
  actif: "bg-green-100 text-green-800",
  vendu: "bg-blue-100 text-blue-800",
  abattu: "bg-red-100 text-red-800",
  mort: "bg-slate-100 text-slate-800",
  reforme: "bg-orange-100 text-orange-800",
  termine: "bg-slate-100 text-slate-800",
}

// ============================================================
// Composant principal
// ============================================================

export function AnimauxTab() {
  // QA caprin cms1vps0c / cms1vc12t — sous-onglet Animaux/Lots piloté par
  // l'URL (?sub=lots). Lecture DANS un effet (jamais au render, cf. pattern
  // AlimentationTab), avec useSearchParams en dépendance pour resynchroniser
  // à chaque navigation interne (y compris le clic sur l'onglet déjà actif,
  // qui réécrit une URL propre et doit ramener au sous-onglet par défaut).
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeSub, setActiveSub] = React.useState<string>("animaux")
  React.useEffect(() => {
    const sub = searchParams.get("sub")
    setActiveSub(sub === "lots" ? "lots" : "animaux")
  }, [searchParams])

  const handleSubChange = React.useCallback((sub: string) => {
    const nextSub = sub === "lots" ? "lots" : "animaux"
    setActiveSub(nextSub)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "animaux")
    if (nextSub === "lots") params.set("sub", "lots")
    else params.delete("sub")
    router.replace(`/elevage?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  return (
    <Tabs value={activeSub} onValueChange={handleSubChange} className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="animaux" className="flex items-center gap-1.5">
          <Bird className="h-4 w-4" />
          Animaux
        </TabsTrigger>
        <TabsTrigger value="lots" className="flex items-center gap-1.5">
          <Bird className="h-4 w-4" />
          Lots
        </TabsTrigger>
      </TabsList>

      <TabsContent value="animaux">
        <AnimauxSubTab />
      </TabsContent>
      <TabsContent value="lots">
        <LotsSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Animaux individuels
// ============================================================

function AnimauxSubTab() {
  const { toast } = useToast()
  const router = useRouter()
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [animaux, setAnimaux] = React.useState<Animal[]>([])
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [search, setSearch] = React.useState("")
  const [filterEspece, setFilterEspece] = React.useState<string>("all")
  const filiereSel = useFiliereSelection()
  const { filieres } = useElevageModes()
  const [filterStatut, setFilterStatut] = React.useState<string>("actif")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  // QA 2026-05-15 — édition par ligne pour les animaux
  const [editingAnimalId, setEditingAnimalId] = React.useState<number | null>(null)

  const EMPTY_ANIMAL_FORM = {
    especeAnimaleId: "", identifiant: "", typeIdentifiant: "",
    nom: "", raceAnimaleId: "", raceHistorique: "", orientationProduction: "", sexe: "",
    dateNaissance: "", dateArrivee: todayLocalISO(),
    provenance: "", nExploitationOrigine: "",
    statutSanitaire: "",
    prixAchat: "", prixAchatInclusDansLot: false, poidsActuel: "", notes: "",
    mereId: "", pereId: "", pereIdentifiant: "", mereIdentifiant: "",
    lotId: "", parcelleGeoId: "",
  }
  const [formData, setFormData] = React.useState(EMPTY_ANIMAL_FORM)

  React.useEffect(() => {
    const action = new URLSearchParams(window.location.search).get("action")
    if (action !== "rechercher") return
    searchInputRef.current?.focus()
  }, [])

  const resetAnimalForm = () => {
    setEditingAnimalId(null)
    // Quand l'atelier courant ne contient qu'une espèce possible, on la
    // pré-sélectionne pour éviter tout choix ambigu ; sinon on laisse le
    // placeholder (le Select ne propose de toute façon que cet atelier).
    const defautEspece =
      especesPourAtelier.length === 1 ? especesPourAtelier[0].id : ""
    setFormData({ ...EMPTY_ANIMAL_FORM, especeAnimaleId: defautEspece })
  }

  const handleEditAnimal = (a: Animal) => {
    setEditingAnimalId(a.id)
    setFormData({
      especeAnimaleId: a.especeAnimale.id,
      identifiant: a.identifiant ?? "",
      typeIdentifiant: a.typeIdentifiant ?? "",
      nom: a.nom ?? "",
      raceAnimaleId: a.raceAnimaleId ?? (a.race ? "__legacy__" : ""),
      raceHistorique: a.raceAnimaleId ? "" : (a.race ?? ""),
      orientationProduction: a.orientationProduction ?? "",
      sexe: a.sexe ?? "",
      dateNaissance: a.dateNaissance ? a.dateNaissance.split('T')[0] : "",
      dateArrivee: a.dateArrivee ? a.dateArrivee.split('T')[0] : todayLocalISO(),
      provenance: a.provenance ?? "",
      nExploitationOrigine: a.nExploitationOrigine ?? "",
      statutSanitaire: a.statutSanitaire.join("\n"),
      prixAchat: a.prixAchat ? a.prixAchat.toString() : "",
      prixAchatInclusDansLot: a.prixAchatInclusDansLot,
      poidsActuel: a.poidsActuel ? a.poidsActuel.toString() : "",
      notes: a.notes ?? "",
      mereId: a.mereId ? String(a.mereId) : "",
      pereId: a.pereId ? String(a.pereId) : "",
      pereIdentifiant: a.pereIdentifiant ?? "",
      mereIdentifiant: a.mereIdentifiant ?? "",
      lotId: a.lot?.id ? String(a.lot.id) : "",
      parcelleGeoId: a.parcelleGeoId ?? "",
    })
    setIsDialogOpen(true)
  }

  // Deep-link ?edit=<id> — QA #10 : le bouton « Modifier » de la fiche
  // individuelle (/elevage/animaux/[id]) renvoie vers
  // /elevage?tab=animaux&edit=<id>. On ouvre le même formulaire d'édition que
  // le pinceau de la ligne, dès que la liste est chargée. Le ref empêche de
  // rouvrir le dialog à chaque refetch.
  const handledEditParamRef = React.useRef(false)
  React.useEffect(() => {
    if (handledEditParamRef.current || isLoading) return
    const editId = new URLSearchParams(window.location.search).get("edit")
    if (!editId) return
    const numId = Number(editId)
    if (Number.isNaN(numId)) return
    handledEditParamRef.current = true
    // Retire le param via le routeur (pas l'History API brute) pour qu'un
    // reload ne rouvre pas le dialog, sans désynchroniser l'App Router.
    const cleanupUrl = () => router.replace("/elevage?tab=animaux", { scroll: false })
    const target = animaux.find((a) => a.id === numId)
    if (target) {
      handleEditAnimal(target)
      cleanupUrl()
      return
    }
    // Ticket QA cmrz0glc — depuis la fiche, « Modifier » tombait parfois sur une
    // liste vide sans formulaire : l'animal n'est pas dans la liste chargée (filtre
    // statut « actif » qui masque un animal vendu/mort/réformé, ou liste
    // momentanément vide au chargement). On le récupère alors directement pour que
    // le formulaire s'ouvre toujours.
    ;(async () => {
      try {
        const res = await fetch(`/api/elevage/animaux/${numId}`)
        if (res.ok) {
          const { data } = await res.json()
          if (data) handleEditAnimal(data)
        }
      } catch {
        /* silencieux : l'utilisateur peut rouvrir via le pinceau de la ligne */
      } finally {
        cleanupUrl()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, animaux])

  // QA Julien 2026-05-15 — Bug #9 : on ne filtre plus serveur sur
  // l'espece+race exacte (Lacaune, Sussex…) mais sur l'espèce de base
  // (Poule, Brebis…), donc on charge la liste sans ce filtre et on
  // filtre côté client dans `filteredAnimaux`. Le filtre statut reste
  // serveur (volume potentiellement gros).
  // Bug feedback testeur 2026-05-26 (cmpm780qz) — Le filtre "espèces" ne
  // listait que celles des animaux nominatifs : un user qui gère tout son
  // troupeau en LOTS (poules, brebis, lapins) ne voyait que Chèvre et
  // Cochon. On fetch aussi les lots actifs pour agréger leurs espèces.
  const [lotsEspeceIds, setLotsEspeceIds] = React.useState<string[]>([])
  // Lots actifs, pour rattacher un animal à un lot depuis sa fiche. Feedback
  // éleveur 2026-07-21 (Cyril) : il n'existait aucune passerelle animal → lot
  // dans l'UI (ni sur la fiche animal, ni sur la page du lot).
  const [lotsActifs, setLotsActifs] = React.useState<Array<{ id: number; nom: string | null; especeAnimaleId: string; prixAchatTotal: number | null }>>([])
  const [races, setRaces] = React.useState<RaceAnimaleOption[]>([])
  // Parcelles géoréférencées, pour situer un animal sur la carte (cartographie
  // élevage 2026-07-21 : rattachement direct animal → parcelle, hors lot).
  const [parcellesList, setParcellesList] = React.useState<Array<{ id: string; nom: string }>>([])
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = '/api/elevage/animaux?'
      if (filterStatut !== 'all') url += `statut=${filterStatut}&`

      const [animauxRes, especesRes, lotsRes, parcellesRes, racesRes] = await Promise.all([
        fetch(url),
        fetch('/api/elevage/especes-animales'),
        fetch('/api/elevage/lots'),
        fetch('/api/carte'),
        fetch('/api/elevage/races'),
      ])

      if (animauxRes.ok) setAnimaux((await animauxRes.json()).data)
      if (especesRes.ok) setEspeces((await especesRes.json()).data)
      if (lotsRes.ok) {
        const lotsJson = await lotsRes.json()
        const lots: Array<{ id: number; nom: string | null; especeAnimaleId: string; statut: string; prixAchatTotal: number | null }> = lotsJson.data ?? []
        const actifs = lots.filter((l) => l.statut === "actif")
        setLotsEspeceIds(actifs.map((l) => l.especeAnimaleId))
        setLotsActifs(actifs.map((l) => ({ id: l.id, nom: l.nom, especeAnimaleId: l.especeAnimaleId, prixAchatTotal: l.prixAchatTotal })))
      }
      if (parcellesRes.ok) {
        const pj = await parcellesRes.json()
        setParcellesList((Array.isArray(pj) ? pj : []).map((p: { id: string; nom: string }) => ({ id: p.id, nom: p.nom })))
      }
      if (racesRes.ok) setRaces((await racesRes.json()).data ?? [])
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [filterStatut, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.especeAnimaleId) {
      toast({ title: "Sélectionnez une espèce", variant: "destructive" })
      return
    }
    // Bug cmp8sagud (Marc 2026-05-16) — Toast générique "Impossible
    // d'enregistrer" sans détail. On récupère désormais le message
    // d'erreur retourné par l'API (zod flatten ou message custom) pour
    // pointer le champ fautif.
    //
    // Bug feedback testeur 2026-05-26 (cmplohpya) — Sérialisation : les
    // champs numériques (prixAchat, poidsActuel) étaient envoyés en
    // string et rejetés par Zod, et typeIdentifiant="" ne match aucun
    // enum. On nettoie le payload avant envoi.
    try {
      const isEdit = editingAnimalId !== null
      const toNum = (v: string): number | null => {
        if (v === "" || v === null || v === undefined) return null
        const n = parseFloat(v)
        return Number.isNaN(n) ? null : n
      }
      const cleaned = {
        ...formData,
        typeIdentifiant: formData.typeIdentifiant || null,
        identifiant: formData.identifiant || null,
        // Bug testeur 2026-05-31 — on n'envoie plus de chaînes vides : un champ
        // texte vide est explicitement `null` (évite de stocker race='' qui
        // était lue comme « race non renseignée » alors que la saisie pouvait
        // être perdue en amont).
        raceAnimaleId: formData.raceAnimaleId === "__legacy__" ? undefined : (formData.raceAnimaleId || null),
        orientationProduction: formData.orientationProduction || null,
        sexe: formData.sexe || null,
        provenance: formData.provenance || null,
        nExploitationOrigine: formData.nExploitationOrigine || null,
        statutSanitaire: formData.statutSanitaire
          .split(/[\n,;]+/)
          .map((value) => value.trim())
          .filter(Boolean),
        prixAchat: toNum(formData.prixAchat as unknown as string),
        poidsActuel: toNum(formData.poidsActuel as unknown as string),
        dateNaissance: (formData as { dateNaissance?: string }).dateNaissance || null,
        lotId: formData.lotId ? parseInt(formData.lotId) : null,
        parcelleGeoId: formData.parcelleGeoId || null,
        mereId: formData.mereId ? parseInt(formData.mereId) : null,
        pereId: formData.pereId ? parseInt(formData.pereId) : null,
        pereIdentifiant: formData.pereIdentifiant || null,
        mereIdentifiant: formData.mereIdentifiant || null,
      }
      // Bug testeur 2026-05-31 — un nouvel animal est TOUJOURS créé actif. On
      // force le statut côté payload de création pour qu'aucune valeur résiduelle
      // ne puisse le faire naître « mort ». L'édition ne touche pas au statut ici
      // (géré par les actions dédiées vente/abattage/décès).
      const body = isEdit
        ? { id: editingAnimalId, ...cleaned }
        : { ...cleaned, statut: 'actif' }
      const response = await fetch('/api/elevage/animaux', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const fieldErrors = payload?.details?.fieldErrors as Record<string, string[]> | undefined
        const firstField = fieldErrors ? Object.entries(fieldErrors).find(([, v]) => v.length > 0) : null
        const description = firstField
          ? `${firstField[0]} : ${firstField[1][0]}`
          : payload?.error || "Impossible d'enregistrer"
        throw new Error(description)
      }
      const payload = await response.json().catch(() => ({}))
      toast({ title: isEdit ? "Animal mis à jour" : "Animal créé" })
      if (!isEdit && payload?.warning) {
        toast({
          variant: "destructive",
          title: "Prérequis réglementaire à compléter",
          description: payload.warning,
        })
      }
      setIsDialogOpen(false)
      resetAnimalForm()
      fetchData()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
    }
  }

  const [animalToDelete, setAnimalToDelete] = React.useState<Animal | null>(null)

  const handleDelete = (animal: Animal) => {
    setAnimalToDelete(animal)
  }

  const confirmDelete = async () => {
    if (!animalToDelete) return
    try {
      const res = await fetch(`/api/elevage/animaux/${animalToDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: "Animal supprimé" })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de supprimer l'animal" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // --- Dialogs abattage / vente / mort ---
  const [abattageDialog, setAbattageDialog] = React.useState<Animal | null>(null)
  const [abattageForm, setAbattageForm] = React.useState({
    date: todayLocalISO(),
    poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "",
  })

  const [venteDialog, setVenteDialog] = React.useState<Animal | null>(null)
  const [venteForm, setVenteForm] = React.useState({
    date: todayLocalISO(),
    prixUnitaire: "", client: "", description: "", notes: "",
  })

  const [mortDialog, setMortDialog] = React.useState<Animal | null>(null)
  const [mortForm, setMortForm] = React.useState({
    date: todayLocalISO(),
    cause: "", notes: "",
  })

  const handleAbattageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!abattageDialog) return
    try {
      const res = await fetch('/api/elevage/abattages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId: abattageDialog.id,
          date: abattageForm.date,
          quantite: 1,
          poidsVif: abattageForm.poidsVif ? parseFloat(abattageForm.poidsVif) : null,
          poidsCarcasse: abattageForm.poidsCarcasse ? parseFloat(abattageForm.poidsCarcasse) : null,
          destination: abattageForm.destination,
          prixVente: abattageForm.prixVente ? parseFloat(abattageForm.prixVente) : null,
          lieu: abattageForm.lieu || null,
          notes: abattageForm.notes || null,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: "Abattage enregistré", description: `${abattageDialog.nom || abattageDialog.identifiant || ''} marqué comme abattu` })
      setAbattageDialog(null)
      setAbattageForm({ date: todayLocalISO(), poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'abattage" })
    }
  }

  const handleVenteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!venteDialog) return
    if (!venteForm.prixUnitaire) {
      toast({ title: "Renseignez le prix de vente", variant: "destructive" })
      return
    }
    try {
      // Créer la vente
      const venteRes = await fetch('/api/elevage/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId: venteDialog.id, // requis par l'API pour type=animal_vivant (sinon 400)
          date: venteForm.date,
          type: "animal_vivant",
          description: venteForm.description || `${venteDialog.nom || venteDialog.identifiant || ''} (${venteDialog.especeAnimale.nom})`,
          quantite: 1,
          unite: "unite",
          prixUnitaire: venteForm.prixUnitaire ? parseFloat(venteForm.prixUnitaire) : 0,
          client: venteForm.client || null,
          paye: true,
          notes: venteForm.notes || null,
        }),
      })
      if (!venteRes.ok) throw new Error('Erreur vente')
      // Marquer l'animal comme vendu
      await fetch(`/api/elevage/animaux/${venteDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'vendu', dateSortie: venteForm.date }),
      })
      toast({ title: "Vente enregistrée", description: `${venteDialog.nom || venteDialog.identifiant || ''} marque comme vendu` })
      setVenteDialog(null)
      setVenteForm({ date: todayLocalISO(), prixUnitaire: "", client: "", description: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer la vente" })
    }
  }

  const handleMortSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mortDialog) return
    try {
      const res = await fetch(`/api/elevage/animaux/${mortDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statut: 'mort',
          dateSortie: mortForm.date,
          causeSortie: mortForm.cause || 'Mort',
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: "Décès enregistré", description: `${mortDialog.nom || mortDialog.identifiant || ''} marqué comme mort` })
      setMortDialog(null)
      setMortForm({ date: todayLocalISO(), cause: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // QA Julien 2026-05-15 — Bug #9 : on dérive l'espèce de base
  // (Poule, Brebis…) depuis l'id de l'espèce animale et on filtre
  // côté client. Liste des espèces présentes calculée sur l'ensemble
  // chargé (avant filtre espèce) → dropdown stable.
  const especesPresentes = React.useMemo(
    () =>
      listEspecesBasePresentes([
        ...animaux.map((a) => ({ especeAnimaleId: a.especeAnimale.id })),
        ...lotsEspeceIds.map((especeAnimaleId) => ({ especeAnimaleId })),
      ]),
    [animaux, lotsEspeceIds]
  )

  // Phase 0 modes d'élevage — le référentiel contient désormais les espèces
  // compagnie/équin/NAC (chien, cheval, pogona…). Un compte de rente qui n'a
  // coché aucun mode ne doit pas les voir dans « Profil animal ». On conserve
  // l'espèce déjà rattachée à l'animal en cours d'édition, sinon le Select
  // s'afficherait vide sur une fiche existante (mode désactivé = masquer, pas
  // casser). cf. docs/elevage-modes-phase0-spec.md §7
  // Espèces proposées dans le formulaire : filières actives ET restreintes à
  // l'atelier sélectionné (Cheptel / Chiens & chats / Équins / NAC). Sans ce
  // second filtre, « Ajouter » depuis l'atelier « Chiens & chats » proposait
  // encore les brebis, donnant l'impression d'ajouter un animal de cheptel
  // (feedback Guillaume 2026-07-25).
  const especesPourAtelier = React.useMemo(
    () =>
      especes.filter(
        (e) =>
          filieres.includes(coerceFiliere(e.filiere) as Filiere) &&
          filiereMatch(filiereSel, e.filiere)
      ),
    [especes, filieres, filiereSel]
  )
  // On garde en plus l'espèce de l'animal en cours d'édition, même hors atelier
  // courant, pour ne pas vider le Select d'une fiche existante.
  const especesProposables = React.useMemo(() => {
    if (
      formData.especeAnimaleId &&
      !especesPourAtelier.some((e) => e.id === formData.especeAnimaleId)
    ) {
      const courante = especes.find((e) => e.id === formData.especeAnimaleId)
      if (courante) return [...especesPourAtelier, courante]
    }
    return especesPourAtelier
  }, [especesPourAtelier, especes, formData.especeAnimaleId])

  const racesDeLEspece = React.useMemo(
    () => races.filter((race) => race.especeAnimaleId === formData.especeAnimaleId),
    [races, formData.especeAnimaleId]
  )

  // Bug feedback testeur 2026-05-26 (cmplpajvb) — la recherche était
  // sensible aux diacritiques : "bergere" sans accent → 0 résultat. On
  // normalise désormais en NFD + retrait des marques diacritiques pour
  // que "bergere"/"BERGÈRE"/"Bergère" matchent indifféremment.
  const normaliseRecherche = (s: string | null | undefined): string =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")

  const filteredAnimaux = animaux.filter(a => {
    if (!filiereMatch(filiereSel, a.especeAnimale.filiere)) return false
    if (filterEspece !== 'all' && especeBaseId(a.especeAnimale.id) !== filterEspece) {
      return false
    }
    if (!search) return true
    const s = normaliseRecherche(search)
    return (
      normaliseRecherche(a.nom).includes(s) ||
      normaliseRecherche(a.identifiant).includes(s) ||
      normaliseRecherche(a.race).includes(s) ||
      normaliseRecherche(a.especeAnimale.nom).includes(s)
    )
  })

  const typeIdentifiant = (formData.typeIdentifiant || null) as TypeIdentifiant | null
  const identifiantValide = isValidIdentifiant(formData.identifiant, typeIdentifiant)
  const aideIdentifiant = placeholderIdentifiant(typeIdentifiant)

  // Filière de l'espèce choisie dans le formulaire (fallback : atelier courant).
  // Pilote le vocabulaire et les champs affichés : un chien/chat n'a ni « N°
  // exploitation », ni « orientation de production », ni boucle IPG (feedback
  // Guillaume 2026-07-25). cf. docs/elevage-modes-phase0-spec.md
  const filiereForm: Filiere | null = React.useMemo(() => {
    const e = especes.find((x) => x.id === formData.especeAnimaleId)
    if (e) return coerceFiliere(e.filiere) as Filiere
    return filiereSel !== "toutes" ? (filiereSel as Filiere) : null
  }, [especes, formData.especeAnimaleId, filiereSel])
  const estRente = filiereForm === null || filiereForm === "rente"
  const estCompagnie = filiereForm === "compagnie"

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[200px]"
          />
        </div>
        {/* QA Julien 2026-05-15 — Bug #9 : on liste les espèces de
            base réellement présentes (Poule/Brebis/Chèvre/Cochon/Vache)
            au lieu de tout le référentiel races. */}
        <Select value={filterEspece} onValueChange={setFilterEspece}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Espèce" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les espèces</SelectItem>
            {especesPresentes.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="actif">Actifs</SelectItem>
            <SelectItem value="vendu">Vendus</SelectItem>
            <SelectItem value="abattu">Abattus</SelectItem>
            <SelectItem value="mort">Morts</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">
          {filteredAnimaux.length} animal(aux)
        </div>
        <a href="/api/elevage/inventaire-cheptel" target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" title="Inventaire complet des animaux présents"><Archive className="h-4 w-4 mr-1" />Inventaire complet</Button>
        </a>
        <a
          href={`/api/elevage/registre-elevage?year=${new Date().getFullYear()}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="outline" size="sm" title="Registre d'élevage PDF (arrêté 5 juin 2000)">
            <FileText className="h-4 w-4 mr-1" />
            Registre
          </Button>
        </a>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <ImportAnimauxCsv
          especes={especes}
          existingIdentifiers={animaux.flatMap((animal) => animal.identifiant ? [animal.identifiant] : [])}
          onImported={fetchData}
        />
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetAnimalForm() }}>
          <DialogTrigger asChild>
            {/* Cause racine bug « animal créé corrompu » (#54 Étoile) : le bouton
                ne remettait que editingAnimalId à null, PAS formData → un état
                résiduel d'une édition précédente (animal mort, autre espèce,
                identifiant déjà pris) était soumis tel quel à la création. On
                réinitialise désormais TOUT le formulaire à l'ouverture. */}
            <Button size="sm" onClick={() => resetAnimalForm()}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAnimalId ? "Modifier l'animal" : "Nouvel animal"}</DialogTitle>
              <DialogDescription>{editingAnimalId ? `Édition de l'animal #${editingAnimalId}` : "Ajouter un animal individuel"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Profil d&apos;élevage *</Label>
                <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v, raceAnimaleId: "" }))}>
                  <SelectTrigger><SelectValue placeholder="— Sélectionner une espèce —" /></SelectTrigger>
                  <SelectContent>
                    {especesProposables.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                      </SelectItem>
                    ))}
                    {/* QA caprin cms1vdadf — garder visible la sélection courante
                        même si la liste rechargée ne la contient pas/plus (sinon
                        Radix retombe sur le placeholder, state pourtant intact). */}
                    {formData.especeAnimaleId && !especesProposables.some(e => e.id === formData.especeAnimaleId) && (
                      <SelectItem value={formData.especeAnimaleId}>
                        {especes.find(e => e.id === formData.especeAnimaleId)?.nom ?? formData.especeAnimaleId}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Ce profil associe l&apos;espèce biologique et l&apos;orientation de production. La race est renseignée séparément.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Identifiant principal</Label>
                  <Input
                    value={formData.identifiant}
                    onChange={(e) => setFormData(f => ({ ...f, identifiant: e.target.value }))}
                    placeholder={aideIdentifiant || (estRente ? "BDNI/IPG/SIRE..." : estCompagnie ? "N° de puce (I-CAD) / tatouage" : "N° de puce / SIRE...")}
                    aria-invalid={!identifiantValide}
                    className={!identifiantValide ? "border-red-500 focus-visible:ring-red-500" : undefined}
                  />
                  {aideIdentifiant && (
                    <p className={`text-xs ${identifiantValide ? "text-muted-foreground" : "text-red-600"}`}>
                      {identifiantValide ? `Format attendu : ${aideIdentifiant}` : `Format invalide. Attendu : ${aideIdentifiant}`}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select className="w-full h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={formData.typeIdentifiant} onChange={(e) => setFormData(f => ({ ...f, typeIdentifiant: e.target.value }))}>
                    <option value="">— Non typé —</option>
                    <option value="BDNI bovin">BDNI bovin</option>
                    <option value="IPG ovin">IPG ovin</option>
                    <option value="IPG caprin">IPG caprin</option>
                    <option value="IPG porcin">IPG porcin</option>
                    <option value="SIRE équin">SIRE équin</option>
                    <option value="Bague volière">Bague volière</option>
                    <option value="Boucle aux.">Boucle aux.</option>
                    <option value="Puce RFID">Puce RFID</option>
                    <option value="Auxiliaire éleveur">Auxiliaire éleveur</option>
                  </select>
                </div>
              </div>
              <div className={`grid gap-4 ${estRente ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="space-y-2">
                  <Label>Nom (usuel)</Label>
                  <Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} />
                </div>
                {estRente && (
                  <div className="space-y-2">
                    <Label>N° exploitation origine</Label>
                    <Input value={formData.nExploitationOrigine} onChange={(e) => setFormData(f => ({ ...f, nExploitationOrigine: e.target.value }))} placeholder="(optionnel)" />
                  </div>
                )}
              </div>
              <div className={`grid gap-4 ${estRente ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                {estRente && (
                  <div className="space-y-2">
                    <Label>Orientation de production</Label>
                    <Select value={formData.orientationProduction || "__none__"} onValueChange={(v) => setFormData(f => ({ ...f, orientationProduction: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="À renseigner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">À ressaisir / non renseignée</SelectItem>
                        <SelectItem value="lait">Lait</SelectItem><SelectItem value="viande">Viande</SelectItem>
                        <SelectItem value="laine">Laine</SelectItem><SelectItem value="mixte">Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Race</Label>
                  {/* Référentiel enrichi (92 races canines, 52 félines…) : sélecteur
                      recherchable plutôt qu'une liste déroulante à faire défiler. */}
                  <RaceCombobox
                    races={racesDeLEspece}
                    value={formData.raceAnimaleId}
                    onChange={(id) => setFormData(f => ({ ...f, raceAnimaleId: id }))}
                    raceHistorique={formData.raceHistorique}
                    disabled={!formData.especeAnimaleId}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sexe</Label>
                  <Select value={formData.sexe} onValueChange={(v) => setFormData(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="femelle">Femelle</SelectItem>
                      <SelectItem value="male">Mâle</SelectItem>
                      <SelectItem value="inconnu">Inconnu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de naissance</Label>
                  <Input type="date" min="1990-01-01" max={todayLocalISO()} value={formData.dateNaissance} onChange={(e) => setFormData(f => ({ ...f, dateNaissance: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Date d&apos;arrivée</Label>
                  <Input type="date" min="1990-01-01" max={todayLocalISO()} value={formData.dateArrivee} onChange={(e) => setFormData(f => ({ ...f, dateArrivee: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prix achat</Label>
                  <Input type="number" min="0" step="0.01" value={formData.prixAchat} onChange={(e) => setFormData(f => ({ ...f, prixAchat: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Poids (kg)</Label>
                  <Input type="number" step="0.1" value={formData.poidsActuel} onChange={(e) => setFormData(f => ({ ...f, poidsActuel: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <Label>Génétique / filiation</Label>
                  <p className="text-xs text-muted-foreground">À renseigner aussi lors d’un achat si les parents sont connus.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{estRente ? "Mère dans le cheptel" : "Mère (dans l’élevage)"}</Label>
                    <AnimalCombobox
                      animaux={animaux.filter(a => a.id !== editingAnimalId && a.sexe === "femelle" && (!formData.especeAnimaleId || a.especeAnimale.id === formData.especeAnimaleId))}
                      value={formData.mereId}
                      onChange={(v) => setFormData(f => ({ ...f, mereId: v }))}
                      emptyLabel="Non renseignée"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{estRente ? "Père dans le cheptel" : "Père (dans l’élevage)"}</Label>
                    <AnimalCombobox
                      animaux={animaux.filter(a => a.id !== editingAnimalId && a.sexe === "male" && (!formData.especeAnimaleId || a.especeAnimale.id === formData.especeAnimaleId))}
                      value={formData.pereId}
                      onChange={(v) => setFormData(f => ({ ...f, pereId: v }))}
                      emptyLabel="Non renseigné"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Mère externe</Label><Input value={formData.mereIdentifiant} onChange={(e) => setFormData(f => ({ ...f, mereIdentifiant: e.target.value }))} placeholder={estRente ? "N° de boucle (mère décédée, autre élevage…)" : "N° LOF / puce, nom (autre élevage…)"} /></div>
                  <div className="space-y-2"><Label>Père externe / référence génétique</Label><Input value={formData.pereIdentifiant} onChange={(e) => setFormData(f => ({ ...f, pereIdentifiant: e.target.value }))} placeholder={estRente ? "N° de boucle, nom, centre d’insémination…" : estCompagnie ? "N° LOF, nom de l’étalon…" : "N° de puce, nom, saillie externe…"} /></div>
                </div>
              </div>
              {/* Feedback éleveur 2026-07-21 — rattachement de l'animal à un lot
                  directement depuis sa fiche (il n'y avait aucun moyen de le faire). */}
              <div className="space-y-2">
                <Label>Lot (optionnel)</Label>
                <Select
                  value={formData.lotId || "__none__"}
                  onValueChange={(v) => setFormData(f => ({ ...f, lotId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Aucun lot" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun lot</SelectItem>
                    {/* QA caprin cms1viq3c — comparer l'ESPÈCE DE BASE (cf. Bug #9) :
                        chevre_laitiere et chevre_alpine_chamoisee sont la même
                        espèce, l'égalité stricte d'id profil masquait le lot. */}
                    {lotsActifs
                      .filter((l) => !formData.especeAnimaleId || especeBaseId(l.especeAnimaleId) === especeBaseId(formData.especeAnimaleId))
                      .map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.nom || `Lot #${l.id}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.lotId && Number(formData.prixAchat || 0) > 0 && (
                <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={formData.prixAchatInclusDansLot}
                    onChange={(e) => setFormData((f) => ({ ...f, prixAchatInclusDansLot: e.target.checked }))}
                  />
                  <span>
                    Prix individuel inclus dans le prix total du lot
                    <span className="block text-xs text-muted-foreground">
                      Cochez cette case si ce montant est une ventilation informative : il ne sera pas compté une seconde fois.
                    </span>
                  </span>
                </label>
              )}
              {/* Le modèle possédait déjà `statutSanitaire`, mais aucun écran ne
                  permettait de le renseigner ni de le relire (cms1v8am6). Une
                  ligne par qualification garde la saisie simple tout en
                  permettant plusieurs statuts : CAEV, Visna-Maedi, tremblante,
                  brucellose, paratuberculose, etc. */}
              <div className="space-y-2">
                <Label>Statuts sanitaires</Label>
                <Textarea
                  value={formData.statutSanitaire}
                  onChange={(event) => setFormData((current) => ({
                    ...current,
                    statutSanitaire: event.target.value,
                  }))}
                  rows={3}
                  placeholder={"Un statut par ligne, par ex. :\nCAEV : indemne (analyse 2026-07-20)\nTremblante : génotype ARR/ARR"}
                />
                <p className="text-xs text-muted-foreground">
                  Indiquez la maladie, le résultat et la date ou référence du contrôle. Laissez vide si le statut est inconnu.
                </p>
              </div>
              {/* Cartographie élevage 2026-07-21 — situer l'animal sur une parcelle
                  (visible ensuite dans « Bétail présent » sur la carte). Sans objet
                  pour un chien/chat : masqué en filière compagnie. */}
              {!estCompagnie && (
                <div className="space-y-2">
                  <Label>Parcelle (optionnel)</Label>
                  <Select
                    value={formData.parcelleGeoId || "__none__"}
                    onValueChange={(v) => setFormData(f => ({ ...f, parcelleGeoId: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Aucune parcelle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune parcelle</SelectItem>
                      {parcellesList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit">
                  {editingAnimalId ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
            <div className="space-y-3 p-3 lg:hidden">
              {filteredAnimaux.map((animal) => (
                <article key={animal.id} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">
                        {animal.nom || animal.identifiant || `Animal #${animal.id}`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {animal.identifiant || "Identifiant non renseigné"} · {especeBaseLabel(animal.especeAnimale.id)}
                        {animal.race ? ` · ${animal.race}` : ""}
                      </p>
                    </div>
                    <Badge className={STATUT_COLORS[animal.statut] || ""}>{labelStatutAnimal(animal.statut)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {animal.statutsSanitairesStructures?.slice(0, 2).map((statut) => (
                      <Badge
                        key={statut.id}
                        variant="outline"
                        className={statut.statut === "positif" ? "border-red-200 bg-red-50 text-red-800" : statut.statut === "indemne" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}
                      >
                        {statut.maladie.nom} · {statut.statut === "en_cours" ? "en cours" : statut.statut}
                      </Badge>
                    ))}
                    {!animal.statutsSanitairesStructures?.length && animal.statutSanitaire.slice(0, 2).map((statut) => (
                      <Badge key={statut} variant="outline">{statut}</Badge>
                    ))}
                    {!animal.statutsSanitairesStructures?.length && !animal.statutSanitaire.length && (
                      <Badge variant="outline" className="text-muted-foreground">Sanitaire inconnu</Badge>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-slate-50 p-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Lot</dt>
                      <dd className="truncate font-medium">{animal.lot?.nom || "Aucun lot"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Poids</dt>
                      <dd className="font-medium">
                        {animal.poidsActuel
                          ? `${animal.poidsActuel} kg`
                          : animal.especeAnimale.poidsAdulte
                            ? `≈ ${animal.especeAnimale.poidsAdulte} kg (adulte)`
                            : "Non renseigné"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Link
                      href={`/elevage/animaux/${animal.id}#soins`}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                      <Stethoscope className="mr-2 h-4 w-4" />
                      Soins
                    </Link>
                    <Button className="min-h-11" variant="outline" onClick={() => handleEditAnimal(animal)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      Modifier
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="min-h-11" variant="outline">
                          <MoreHorizontal className="mr-1 h-4 w-4" />
                          Plus
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/elevage/animaux/${animal.id}`}>Voir la fiche complète</Link>
                        </DropdownMenuItem>
                        {animal.statut === "actif" ? (
                          <>
                            <DropdownMenuItem onClick={() => {
                              setVenteForm((form) => ({ ...form, date: todayLocalISO() }))
                              setVenteDialog(animal)
                            }}>
                              Vendre
                            </DropdownMenuItem>
                            {capacites(coerceFiliere(animal.especeAnimale.filiere)).abattage && (
                              <DropdownMenuItem onClick={() => {
                                setAbattageForm((form) => ({
                                  ...form,
                                  date: todayLocalISO(),
                                  poidsVif: animal.poidsActuel?.toString() || "",
                                }))
                                setAbattageDialog(animal)
                              }}>
                                Enregistrer un abattage
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setMortForm((form) => ({ ...form, date: todayLocalISO() }))
                              setMortDialog(animal)
                            }}>
                              Enregistrer un décès
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(animal)}>
                            Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              ))}
              {filteredAnimaux.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">Aucun animal trouvé</p>
              )}
            </div>
            <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifiant</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead>Race</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Sanitaire</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnimaux.map((animal) => (
                  <TableRow key={animal.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {/* Bug feedback testeur 2026-05-25 (cmplkdjtx/cmplk8k2h)
                          — la colonne montrait "-" sans signaler que le
                          champ pouvait être renseigné. On affiche "non
                          renseigné" en italique pour clarifier. */}
                      {animal.identifiant
                        ? animal.identifiant
                        : <span className="text-xs italic text-muted-foreground">non renseigné</span>}
                    </TableCell>
                    <TableCell>
                      {/* Bug #19 — Le nom n'était pas cliquable malgré
                          l'attente utilisateur (l'identifiant en fil
                          d'ariane est déjà un lien). */}
                      {animal.nom ? (
                        <Link href={`/elevage/animaux/${animal.id}`} className="hover:underline text-blue-700">
                          {animal.nom}
                        </Link>
                      ) : '-'}
                    </TableCell>
                    {/* QA Julien 2026-05-15 — Bug #10 : colonne Espèce
                        toujours visible et stable, affichage du libellé
                        de base (Poule / Brebis…) — la race est dans la
                        colonne suivante, plus de duplication "Poule
                        Marans · Marans". */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {animal.especeAnimale.couleur && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: animal.especeAnimale.couleur }} />
                        )}
                        {especeBaseLabel(animal.especeAnimale.id)}
                      </div>
                    </TableCell>
                    <TableCell>{animal.race || '-'}</TableCell>
                    <TableCell>
                      {animal.sexe === 'femelle' ? '\u2640' : animal.sexe === 'male' ? '\u2642' : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUT_COLORS[animal.statut] || ''}>{labelStatutAnimal(animal.statut)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {animal.statutsSanitairesStructures?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {animal.statutsSanitairesStructures.slice(0, 2).map((statut) => (
                            <Badge
                              key={statut.id}
                              variant="outline"
                              className={`max-w-[170px] truncate text-[10px] ${
                                statut.statut === "positif"
                                  ? "border-red-200 bg-red-50 text-red-800"
                                  : statut.statut === "indemne"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border-amber-200 bg-amber-50 text-amber-800"
                              }`}
                            >
                              {statut.maladie.nom} · {statut.statut === "en_cours" ? "en cours" : statut.statut}
                            </Badge>
                          ))}
                          {animal.statutsSanitairesStructures.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{animal.statutsSanitairesStructures.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : animal.statutSanitaire.length ? (
                        <div className="flex flex-wrap gap-1">
                          {animal.statutSanitaire.slice(0, 2).map((statut) => (
                            <Badge key={statut} variant="outline" className="max-w-[170px] truncate text-[10px]">
                              {statut}
                            </Badge>
                          ))}
                          {animal.statutSanitaire.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{animal.statutSanitaire.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inconnu</span>
                      )}
                    </TableCell>
                    <TableCell>{animal.lot?.nom || '-'}</TableCell>
                    <TableCell className="text-right">
                      {/* Bug cmp8sf92p (Marc 2026-05-16) — la colonne Poids
                          affichait "-" alors que la fiche montrait "Adulte:65kg".
                          On affiche le poids actuel s'il existe, sinon le poids
                          adulte de l'espèce comme référence avec une mise en
                          forme atténuée. */}
                      {animal.poidsActuel
                        ? `${animal.poidsActuel} kg`
                        : animal.especeAnimale.poidsAdulte
                          ? <span className="text-muted-foreground italic">≈{animal.especeAnimale.poidsAdulte} kg</span>
                          : '-'}
                    </TableCell>
                    <TableCell>
                      {animal.statut === 'actif' && (
                        <TooltipProvider delayDuration={100}>
                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {/* Bug #19 — Le tooltip "Fiche animal"
                                    sur un stéthoscope laissait croire à
                                    une saisie de soin. On clarifie + on
                                    ancre la fiche sur la section soins
                                    pour limiter le détour. */}
                                <Link
                                  href={`/elevage/animaux/${animal.id}#soins`}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 inline-flex"
                                >
                                  <Stethoscope className="h-3.5 w-3.5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>Fiche &amp; soins</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleEditAnimal(animal)}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Modifier la saisie</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setVenteForm(f => ({ ...f, date: todayLocalISO() })); setVenteDialog(animal) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Vendre</TooltipContent>
                            </Tooltip>
                            {/* Abattage réservé aux filières de rente (viande) :
                                sans objet — et illégal — pour un chien/chat de
                                compagnie (feedback Guillaume 2026-07-25). */}
                            {capacites(coerceFiliere(animal.especeAnimale.filiere)).abattage && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => { setAbattageForm(f => ({ ...f, date: todayLocalISO(), poidsVif: animal.poidsActuel?.toString() || "" })); setAbattageDialog(animal) }}
                                    className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
                                  >
                                    <Scissors className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Abattage</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setMortForm(f => ({ ...f, date: todayLocalISO() })); setMortDialog(animal) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                >
                                  <Skull className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Décès</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      )}
                      {animal.statut !== 'actif' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(animal)}
                          className="text-red-600 hover:text-red-700"
                        >
                          &times;
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAnimaux.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Aucun animal trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Abattage */}
      <Dialog open={!!abattageDialog} onOpenChange={(open) => { if (!open) setAbattageDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-red-500" />
              Enregistrer un abattage
            </DialogTitle>
            <DialogDescription>
              {abattageDialog?.nom || abattageDialog?.identifiant || ''} — {abattageDialog?.especeAnimale.nom} {abattageDialog?.race ? `(${abattageDialog.race})` : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAbattageSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={abattageForm.date} onChange={(e) => setAbattageForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Select value={abattageForm.destination} onValueChange={(v) => setAbattageForm(f => ({ ...f, destination: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_consommation">Auto-consommation</SelectItem>
                    <SelectItem value="vente">Vente</SelectItem>
                    <SelectItem value="don">Don</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poids vif (kg)</Label>
                <Input type="number" step="0.1" value={abattageForm.poidsVif} onChange={(e) => setAbattageForm(f => ({ ...f, poidsVif: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Poids carcasse (kg)</Label>
                <Input type="number" step="0.1" value={abattageForm.poidsCarcasse} onChange={(e) => setAbattageForm(f => ({ ...f, poidsCarcasse: e.target.value }))} />
              </div>
            </div>
            {abattageForm.poidsVif && abattageForm.poidsCarcasse && (
              <div className="text-center py-1 bg-slate-50 rounded text-sm text-muted-foreground">
                Rendement : {((parseFloat(abattageForm.poidsCarcasse) / parseFloat(abattageForm.poidsVif)) * 100).toFixed(1)}%
              </div>
            )}
            {abattageForm.destination === 'vente' && (
              <div className="space-y-2">
                <Label>Prix de vente (€)</Label>
                <Input type="number" step="0.01" value={abattageForm.prixVente} onChange={(e) => setAbattageForm(f => ({ ...f, prixVente: e.target.value }))} placeholder="Prix total" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Lieu</Label>
              <Input value={abattageForm.lieu} onChange={(e) => setAbattageForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Lieu d'abattage" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={abattageForm.notes} onChange={(e) => setAbattageForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAbattageDialog(null)}>Annuler</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">Enregistrer l'abattage</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Vente */}
      <Dialog open={!!venteDialog} onOpenChange={(open) => { if (!open) setVenteDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              Enregistrer une vente
            </DialogTitle>
            <DialogDescription>
              {venteDialog?.nom || venteDialog?.identifiant || ''} — {venteDialog?.especeAnimale.nom} {venteDialog?.race ? `(${venteDialog.race})` : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVenteSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={venteForm.date} onChange={(e) => setVenteForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Prix de vente (€) *</Label>
                <Input type="number" step="0.01" value={venteForm.prixUnitaire} onChange={(e) => setVenteForm(f => ({ ...f, prixUnitaire: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input value={venteForm.client} onChange={(e) => setVenteForm(f => ({ ...f, client: e.target.value }))} placeholder="Nom du client" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={venteForm.description} onChange={(e) => setVenteForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Poulet fermier plein air" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={venteForm.notes} onChange={(e) => setVenteForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setVenteDialog(null)}>Annuler</Button>
              <Button type="submit">Enregistrer la vente</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Mort */}
      <Dialog open={!!mortDialog} onOpenChange={(open) => { if (!open) setMortDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-slate-500" />
              Enregistrer un décès
            </DialogTitle>
            <DialogDescription>
              {mortDialog?.nom || mortDialog?.identifiant || ''} — {mortDialog?.especeAnimale.nom}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMortSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={mortForm.date} onChange={(e) => setMortForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cause du décès</Label>
              <Select value={mortForm.cause} onValueChange={(v) => setMortForm(f => ({ ...f, cause: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Maladie">Maladie</SelectItem>
                  <SelectItem value="Predateur">Prédateur</SelectItem>
                  <SelectItem value="Accident">Accident</SelectItem>
                  <SelectItem value="Vieillesse">Vieillesse</SelectItem>
                  <SelectItem value="Cause inconnue">Cause inconnue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={mortForm.notes} onChange={(e) => setMortForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Détails supplémentaires..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMortDialog(null)}>Annuler</Button>
              <Button type="submit" variant="destructive">Confirmer le décès</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={animalToDelete !== null}
        onOpenChange={(open) => !open && setAnimalToDelete(null)}
        entityLabel={
          animalToDelete
            ? `l'animal ${animalToDelete.nom || animalToDelete.identifiant || `#${animalToDelete.id}`}`
            : ""
        }
        dependencies={
          animalToDelete?._count
            ? [
                { label: "soins / traitements", count: animalToDelete._count.soins },
                { label: "productions d'œufs", count: animalToDelete._count.productionsOeufs },
                { label: "enregistrements de naissances (descendants)", count: animalToDelete._count.enfants },
              ]
            : []
        }
        warning={
          animalToDelete?._count?.enfants
            ? "Les liens de parenté seront rompus mais les descendants resteront enregistrés."
            : undefined
        }
        onConfirm={confirmDelete}
      />
    </div>
  )
}

// ============================================================
// Lots
// ============================================================

function LotsSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [lots, setLots] = React.useState<Lot[]>([])
  const filiereSel = useFiliereSelection()
  const { filieres } = useElevageModes()
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [parcelles, setParcelles] = React.useState<Parcelle[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  // QA 2026-05-15 — édition par ligne
  const [editingLotId, setEditingLotId] = React.useState<number | null>(null)

  const EMPTY_LOT_FORM = {
    especeAnimaleId: "", nom: "",
    dateArrivee: todayLocalISO(),
    quantiteInitiale: "", provenance: "", prixAchatTotal: "", notes: "",
    parcelleGeoId: "",
  }
  const [formData, setFormData] = React.useState(EMPTY_LOT_FORM)

  const resetLotForm = () => {
    setEditingLotId(null)
    const defautEspece =
      especesPourAtelier.length === 1 ? especesPourAtelier[0].id : ""
    setFormData({ ...EMPTY_LOT_FORM, especeAnimaleId: defautEspece })
  }

  const handleEditLot = (lot: Lot) => {
    setEditingLotId(lot.id)
    setFormData({
      especeAnimaleId: lot.especeAnimale.id,
      nom: lot.nom ?? "",
      dateArrivee: lot.dateArrivee ? lot.dateArrivee.split('T')[0] : todayLocalISO(),
      quantiteInitiale: lot.quantiteInitiale.toString(),
      provenance: lot.provenance ?? "",
      prixAchatTotal: lot.prixAchatTotal ? lot.prixAchatTotal.toString() : "",
      notes: lot.notes ?? "",
      parcelleGeoId: lot.parcelleGeo?.id ?? "",
    })
    setIsDialogOpen(true)
  }

  // Dialog abattage lot
  const [abatLotDialog, setAbatLotDialog] = React.useState<Lot | null>(null)
  const [abatLotForm, setAbatLotForm] = React.useState({
    date: todayLocalISO(),
    quantite: "1", poidsVif: "", poidsCarcasse: "",
    destination: "auto_consommation", prixVente: "", lieu: "", notes: "",
  })

  const handleAbatLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!abatLotDialog) return
    try {
      const res = await fetch('/api/elevage/abattages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: abatLotDialog.id,
          date: abatLotForm.date,
          quantite: parseInt(abatLotForm.quantite) || 1,
          poidsVif: abatLotForm.poidsVif ? parseFloat(abatLotForm.poidsVif) : null,
          poidsCarcasse: abatLotForm.poidsCarcasse ? parseFloat(abatLotForm.poidsCarcasse) : null,
          destination: abatLotForm.destination,
          prixVente: abatLotForm.prixVente ? parseFloat(abatLotForm.prixVente) : null,
          lieu: abatLotForm.lieu || null,
          notes: abatLotForm.notes || null,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: "Abattage enregistré", description: `${abatLotForm.quantite} animal(aux) du lot ${abatLotDialog.nom || `#${abatLotDialog.id}`}` })
      setAbatLotDialog(null)
      setAbatLotForm({ date: todayLocalISO(), quantite: "1", poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'abattage" })
    }
  }

  // Réforme d'un lot : sortie du cycle productif (ex. pondeuses en fin de ponte
  // conservées). Transition supportée par l'API (PATCH statut + dateReforme).
  const handleReformerLot = async (lot: Lot) => {
    if (!(await confirmDialog(`Réformer le lot ${lot.nom || `#${lot.id}`} ? Il sortira du cycle productif.`))) return
    try {
      const res = await fetch('/api/elevage/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, statut: 'reforme', dateReforme: new Date().toISOString() }),
      })
      if (res.ok) {
        toast({ title: "Lot réformé" })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de réformer le lot" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur réseau" })
    }
  }

  // Réactivation : annule une réforme/clôture (ex. lots créés par erreur puis
  // réformés « pour les cacher »). Repasse le statut à 'actif'. Feedback éleveur 2026-07-24.
  const handleReactiverLot = async (lot: Lot) => {
    try {
      const res = await fetch('/api/elevage/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, statut: 'actif', dateReforme: null }),
      })
      if (res.ok) {
        toast({ title: "Lot réactivé" })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de réactiver le lot" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur réseau" })
    }
  }

  // Suppression définitive d'un lot (ex. lot créé par erreur, sans animaux).
  // L'API refuse (409) si le lot porte des animaux/abattages/productions et
  // renvoie un message explicite. Feedback éleveur 2026-07-24.
  const handleSupprimerLot = async (lot: Lot) => {
    if (!(await confirmDialog(`Supprimer définitivement le lot ${lot.nom || `#${lot.id}`} ? Cette action est irréversible.`))) return
    try {
      const res = await fetch(`/api/elevage/lots?id=${lot.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: "Lot supprimé" })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Suppression impossible", description: p?.error || "Le lot est lié à des données." })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur réseau" })
    }
  }

  // Clôture d'un lot : marqué « terminé » (lot vendu en bloc, fusionné, vidé…).
  const handleCloturerLot = async (lot: Lot) => {
    if (!(await confirmDialog(`Clôturer le lot ${lot.nom || `#${lot.id}`} ? Il sera marqué terminé.`))) return
    try {
      const res = await fetch('/api/elevage/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, statut: 'termine' }),
      })
      if (res.ok) {
        toast({ title: "Lot clôturé" })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de clôturer le lot" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur réseau" })
    }
  }

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [lotsRes, especesRes, parcellesRes] = await Promise.all([
        fetch('/api/elevage/lots'),
        fetch('/api/elevage/especes-animales'),
        fetch('/api/carte'),
      ])
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
      if (especesRes.ok) setEspeces((await especesRes.json()).data)
      if (parcellesRes.ok) setParcelles(await parcellesRes.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  // Même règle que pour les animaux : filières actives ET restreintes à
  // l'atelier sélectionné, en gardant l'espèce du lot édité (cf. §7 de la spec).
  const especesPourAtelier = React.useMemo(
    () =>
      especes.filter(
        (e) =>
          filieres.includes(coerceFiliere(e.filiere) as Filiere) &&
          filiereMatch(filiereSel, e.filiere)
      ),
    [especes, filieres, filiereSel]
  )
  const especesProposables = React.useMemo(() => {
    if (
      formData.especeAnimaleId &&
      !especesPourAtelier.some((e) => e.id === formData.especeAnimaleId)
    ) {
      const courante = especes.find((e) => e.id === formData.especeAnimaleId)
      if (courante) return [...especesPourAtelier, courante]
    }
    return especesPourAtelier
  }, [especesPourAtelier, especes, formData.especeAnimaleId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.especeAnimaleId) {
      toast({ title: "Sélectionnez une espèce", variant: "destructive" })
      return
    }
    if (!formData.quantiteInitiale) {
      toast({ title: "Renseignez la quantité", variant: "destructive" })
      return
    }
    try {
      const isEdit = editingLotId !== null
      // Bug R17 : le schéma attend des nombres ; les Input renvoient des strings.
      // On convertit explicitement (sinon POST 400 « expected number »).
      const payload = {
        especeAnimaleId: formData.especeAnimaleId,
        nom: formData.nom || null,
        dateArrivee: formData.dateArrivee || undefined,
        quantiteInitiale: formData.quantiteInitiale ? parseInt(formData.quantiteInitiale, 10) : undefined,
        provenance: formData.provenance || null,
        prixAchatTotal: formData.prixAchatTotal ? parseFloat(formData.prixAchatTotal) : null,
        parcelleGeoId: formData.parcelleGeoId || null,
        notes: formData.notes || null,
      }
      const body = isEdit ? { id: editingLotId, ...payload } : payload
      const response = await fetch('/api/elevage/lots', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        // QA caprin cms1vdadf — même pattern que le formulaire animal : on lit
        // le corps de la 400 (zod flatten → details.fieldErrors, ou message
        // custom) pour pointer le champ fautif au lieu d'un « Erreur » muet.
        const errPayload = await response.json().catch(() => ({}))
        const fieldErrors = errPayload?.details?.fieldErrors as Record<string, string[]> | undefined
        const firstField = fieldErrors ? Object.entries(fieldErrors).find(([, v]) => v.length > 0) : null
        const description = firstField
          ? `${firstField[0]} : ${firstField[1][0]}`
          : errPayload?.error || "Impossible d'enregistrer"
        throw new Error(description)
      }
      toast({
        title: isEdit ? "Lot mis à jour" : "Lot créé",
        description: isEdit ? undefined : `${formData.quantiteInitiale} animaux ajoutés`,
      })
      setIsDialogOpen(false)
      resetLotForm()
      fetchData()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lots.length} lot(s) &bull; {lots.reduce((sum, l) => sum + ((l as typeof l & { effectifCalcule?: number }).effectifCalcule ?? l.quantiteActuelle), 0)} animaux au total
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetLotForm() }}>
            <DialogTrigger asChild>
              {/* Même cause racine que « + Ajouter » animal : réinitialiser TOUT
                  le formulaire (pas seulement l'editingLotId) pour ne pas hériter
                  d'un état résiduel d'édition lors d'une création. */}
              <Button size="sm" onClick={() => resetLotForm()}><Plus className="h-4 w-4 mr-1" />Nouveau lot</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingLotId ? "Modifier le lot" : "Créer un lot"}</DialogTitle>
                <DialogDescription>
                  {editingLotId
                    ? `Édition du lot #${editingLotId}`
                    : filiereSel === "rente"
                      ? "Lot de chèvres / cabris ou autres animaux d’élevage"
                      : "Lot / groupe d’animaux"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Profil d&apos;élevage *</Label>
                  <Select value={formData.especeAnimaleId} onValueChange={(v) => setFormData(f => ({ ...f, especeAnimaleId: v }))}>
                    <SelectTrigger><SelectValue placeholder="— Sélectionner une espèce —" /></SelectTrigger>
                    <SelectContent>
                      {especesProposables.map(e => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
                      {/* QA caprin cms1vdadf — si la liste (rechargée en async) ne
                          contient plus la valeur du state, Radix réaffiche le
                          placeholder alors que la sélection est intacte : on garde
                          un item pour la valeur courante. */}
                      {formData.especeAnimaleId && !especesProposables.some(e => e.id === formData.especeAnimaleId) && (
                        <SelectItem value={formData.especeAnimaleId}>
                          {especes.find(e => e.id === formData.especeAnimaleId)?.nom ?? formData.especeAnimaleId}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom du lot</Label>
                    <Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} placeholder="Lot pondeuses 2024" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantité *</Label>
                    <Input type="number" value={formData.quantiteInitiale} onChange={(e) => setFormData(f => ({ ...f, quantiteInitiale: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date d&apos;arrivée</Label>
                    <Input type="date" value={formData.dateArrivee} onChange={(e) => setFormData(f => ({ ...f, dateArrivee: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix total</Label>
                    <Input type="number" min="0" step="0.01" value={formData.prixAchatTotal} onChange={(e) => setFormData(f => ({ ...f, prixAchatTotal: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provenance</Label>
                    <Input value={formData.provenance} onChange={(e) => setFormData(f => ({ ...f, provenance: e.target.value }))} placeholder="Couvoir, éleveur..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelle</Label>
                    <Select value={formData.parcelleGeoId} onValueChange={(v) => setFormData(f => ({ ...f, parcelleGeoId: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {parcelles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit">
                    {editingLotId ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
            <div className="space-y-3 p-3 sm:hidden">
              {lots.filter((lot) => filiereMatch(filiereSel, lot.especeAnimale.filiere)).map((lot) => {
                const lotCalcule = lot as typeof lot & { effectifCalcule?: number }
                const effectif = lotCalcule.effectifCalcule ?? lot.quantiteActuelle
                return (
                  <article key={lot.id} className="rounded-lg border bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{lot.nom || `Lot #${lot.id}`}</h3>
                        <p className="text-sm text-muted-foreground">
                          {especeBaseLabel(lot.especeAnimale.id)} · {effectif} tête{effectif > 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge className={STATUT_COLORS[lot.statut] || ""}>{labelStatutLot(lot.statut)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        href={`/elevage/lots/${lot.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                      >
                        Ouvrir le lot
                      </Link>
                      <Button className="min-h-11" variant="outline" onClick={() => handleEditLot(lot)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </Button>
                    </div>
                  </article>
                )
              })}
              {lots.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">Aucun lot enregistré</p>
              )}
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead className="text-right">Initial</TableHead>
                  <TableHead className="text-right">Actuel</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Parcelle</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* QA Julien 2026-05-15 — Bug #11 : ligne lot cliquable
                    vers la fiche dédiée /elevage/lots/[id]. */}
                {lots.filter((lot) => filiereMatch(filiereSel, lot.especeAnimale.filiere)).map((lot) => (
                  <TableRow
                    key={lot.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => {
                      // Ne pas naviguer si l'utilisateur clique sur un
                      // lien interne ou un bouton (ex: parcelle, sortir)
                      if ((e.target as HTMLElement).closest('a, button')) return
                      window.location.href = `/elevage/lots/${lot.id}`
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/elevage/lots/${lot.id}`} className="hover:underline">
                        {lot.nom || `Lot #${lot.id}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {lot.especeAnimale.couleur && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lot.especeAnimale.couleur }} />}
                        {especeBaseLabel(lot.especeAnimale.id)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{lot.quantiteInitiale}</TableCell>
                    <TableCell className="text-right font-bold">
                      {(() => {
                        // Bug feedback testeur 2026-05-26 (cmpmr3837, cmpm7cssg)
                        // — on affiche l'effectif RECONSTITUÉ à partir des
                        // mouvements (initial + naissances − abattages), avec
                        // le détail en infobulle, au lieu du compteur stocké
                        // qui ne se décrémentait pas des abattages.
                        const l = lot as typeof lot & {
                          naissancesVivantes?: number
                          abattagesTotal?: number
                          effectifCalcule?: number
                        }
                        const naissances = l.naissancesVivantes ?? 0
                        const abattages = l.abattagesTotal ?? 0
                        const effectif = l.effectifCalcule ?? lot.quantiteActuelle
                        const parts = [`${lot.quantiteInitiale} initial`]
                        if (naissances > 0) parts.push(`+${naissances} naissance(s)`)
                        if (abattages > 0) parts.push(`−${abattages} abattage(s)`)
                        const title = parts.length > 1
                          ? `Mouvements : ${parts.join("  ")}  →  effectif ${effectif}`
                          : `Effectif ${effectif} (aucun mouvement enregistré)`
                        return (
                          <span title={title} className="inline-flex items-center gap-1 cursor-help">
                            {effectif}
                            {(naissances > 0 || abattages > 0) && (
                              <span className="text-muted-foreground text-[10px] font-normal">ⓘ</span>
                            )}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>{lot.dateArrivee ? new Date(lot.dateArrivee).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell>
                      {lot.parcelleGeo ? (
                        <Link href={`/jardin/carte?parcelle=${lot.parcelleGeo.id}`} className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 hover:underline">
                          <MapIcon className="h-3 w-3" />
                          {lot.parcelleGeo.nom}
                        </Link>
                      ) : (
                        <ParcelleAssignButton lotId={lot.id} parcelles={parcelles} onAssigned={fetchData} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">{lot.prixAchatTotal ? `${lot.prixAchatTotal.toFixed(2)} \u20ac` : '-'}</TableCell>
                    <TableCell><Badge className={STATUT_COLORS[lot.statut] || ''}>{labelStatutLot(lot.statut)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleEditLot(lot)}
                                className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-700"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier le lot</TooltipContent>
                          </Tooltip>
                          {lot.statut === 'actif' && lot.quantiteActuelle > 0 && capacites(coerceFiliere(lot.especeAnimale.filiere)).abattage && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setAbatLotForm(f => ({ ...f, date: todayLocalISO(), quantite: "1" })); setAbatLotDialog(lot) }}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
                                >
                                  <Scissors className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Abattage</TooltipContent>
                            </Tooltip>
                          )}
                          {lot.statut === 'actif' && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleReformerLot(lot)}
                                    className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-700"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Réformer le lot</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleCloturerLot(lot)}
                                    className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Clôturer (terminé)</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {lot.statut !== 'actif' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleReactiverLot(lot)}
                                  className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-green-100 hover:text-green-700"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Réactiver (repasser en actif)</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleSupprimerLot(lot)}
                                className="p-1.5 rounded-md transition-colors bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer le lot</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {lots.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun lot enregistré</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog abattage lot */}
      <Dialog open={!!abatLotDialog} onOpenChange={(open) => { if (!open) setAbatLotDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-red-500" />
              Abattage depuis un lot
            </DialogTitle>
            <DialogDescription>
              {abatLotDialog?.nom || `Lot #${abatLotDialog?.id}`} — {abatLotDialog?.especeAnimale.nom} ({abatLotDialog?.quantiteActuelle} restants)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAbatLotSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={abatLotForm.date} onChange={(e) => setAbatLotForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Quantité *</Label>
                <Input type="number" min="1" max={abatLotDialog?.quantiteActuelle || 999} value={abatLotForm.quantite} onChange={(e) => setAbatLotForm(f => ({ ...f, quantite: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Select value={abatLotForm.destination} onValueChange={(v) => setAbatLotForm(f => ({ ...f, destination: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_consommation">Auto-conso</SelectItem>
                    <SelectItem value="vente">Vente</SelectItem>
                    <SelectItem value="don">Don</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poids vif total (kg)</Label>
                <Input type="number" step="0.1" value={abatLotForm.poidsVif} onChange={(e) => setAbatLotForm(f => ({ ...f, poidsVif: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Poids carcasse total (kg)</Label>
                <Input type="number" step="0.1" value={abatLotForm.poidsCarcasse} onChange={(e) => setAbatLotForm(f => ({ ...f, poidsCarcasse: e.target.value }))} />
              </div>
            </div>
            {abatLotForm.destination === 'vente' && (
              <div className="space-y-2">
                <Label>Prix de vente total (€)</Label>
                <Input type="number" step="0.01" value={abatLotForm.prixVente} onChange={(e) => setAbatLotForm(f => ({ ...f, prixVente: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={abatLotForm.notes} onChange={(e) => setAbatLotForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAbatLotDialog(null)}>Annuler</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">Enregistrer l'abattage</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ParcelleAssignButton({ lotId, parcelles, onAssigned }: { lotId: number; parcelles: Parcelle[]; onAssigned: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)

  if (parcelles.length === 0) return <span className="text-muted-foreground text-xs">-</span>

  const handleAssign = async (parcelleGeoId: string) => {
    try {
      const res = await fetch('/api/elevage/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lotId, parcelleGeoId }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Parcelle assignee" })
      setOpen(false)
      onAssigned()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <Select open={open} onOpenChange={setOpen} onValueChange={handleAssign}>
      <SelectTrigger className="h-7 w-[130px] text-xs border-dashed">
        <SelectValue placeholder="Assigner..." />
      </SelectTrigger>
      <SelectContent>
        {parcelles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
