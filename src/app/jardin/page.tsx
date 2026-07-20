"use client"

/**
 * Page Plan du jardin - Visualisation 2D avec éditeur complet
 */

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Box, CalendarClock, ChevronDown, Download, Image as ImageIcon, Layers as LayersIcon, Map as MapIcon, Maximize2, Minimize2, RotateCcw, Ruler, Upload, ZoomIn, ZoomOut, Plus, Crosshair, Trash2, X, RotateCw, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"
import { Slider } from "@/components/ui/slider"
import {
  GardenView,
  DEFAULT_LAYERS,
  type GardenLayers,
  type GardenTool,
  type LiaisonAssociation,
  type SelectionItem,
} from "@/components/garden/GardenView"
import { useFondPlan } from "@/hooks/use-fond-plan"
import { calibrerFond, distance, formatDistance } from "@/lib/plan-fond-utils"
import { croissanceCulture, envergureArbreADate } from "@/lib/plan-croissance"

// Palier 4 (perf) : dialogs lourds chargés à la demande, hors du bundle
// initial de l'éditeur (le plus gros écran client de l'app).
const NewCultureDialog = dynamic(
  () => import("@/components/garden/NewCultureDialog").then((m) => m.NewCultureDialog),
  { ssr: false }
)
const PluviometriePlanche = dynamic(
  () => import("@/components/meteo/PluviometriePlanche").then((m) => m.PluviometriePlanche),
  { ssr: false }
)
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"
import { useSettings } from "@/hooks/use-settings"
import { confirmDialog } from "@/lib/global-dialog"
import { todayLocalISO } from '@/lib/format-utils'

interface PlancheWithCulture {
  id: string
  nom: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  ilot: string | null
  type: string | null
  cultures: {
    id: number
    nbRangs: number | null
    espacement: number | null
    dateSemis: string | null
    datePlantation: string | null
    dateRecolte: string | null
    finRecolte: string | null
    itp: {
      espacementRangs: number | null
      espacement: number | null
      dureeCulture: number | null
      dureeRecolte: number | null
    } | null
    espece: {
      id: string
      nom: string | null
      couleur: string | null
      etalement: number | null
      famille: { id: string; couleur: string | null } | null
    }
  }[]
}

interface RegleAssociation {
  type: string
  details: { especeId: string | null; familleId: string | null }[]
}

interface ObjetJardin {
  id: number
  nom: string | null
  type: string
  largeur: number
  longueur: number
  posX: number
  posY: number
  rotation2D: number
  couleur: string | null
}

interface Espece {
  id: string
  couleur: string | null
}

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  fournisseur: string | null
  datePlantation: string | null
  posX: number
  posY: number
  envergure: number
  envergureAdulte: number | null
  especeEtalement: number | null
  couleur: string | null
  notes: string | null
}

const TYPES_OBJETS = [
  { value: "allee", label: "Allée", color: "#d4a574" },
  { value: "passage", label: "Passage", color: "#a8a29e" },
  { value: "bordure", label: "Bordure", color: "#78716c" },
  { value: "serre", label: "Serre", color: "#93c5fd" },
  { value: "compost", label: "Compost", color: "#854d0e" },
  { value: "eau", label: "Point d'eau", color: "#60a5fa" },
  { value: "autre", label: "Autre", color: "#d1d5db" },
]

const TYPES_ARBRES = [
  { value: "fruitier", label: "Arbre fruitier", color: "#22c55e" },
  { value: "petit_fruit", label: "Petit fruit", color: "#ef4444" },
  { value: "ornement", label: "Ornement", color: "#a855f7" },
  { value: "haie", label: "Haie", color: "#84cc16" },
]

interface ParcelleOption {
  id: string
  nom: string
  usage: string | null
  plancheCount: number
}

export default function JardinPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen">Chargement...</div>}>
      <JardinContent />
    </React.Suspense>
  )
}

function JardinContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [parcelles, setParcelles] = React.useState<ParcelleOption[]>([])
  const [selectedParcelleId, setSelectedParcelleId] = React.useState<string | null>(null)
  const settings = useSettings(selectedParcelleId)
  const [planches, setPlanches] = React.useState<PlancheWithCulture[]>([])
  const [objets, setObjets] = React.useState<ObjetJardin[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [especes, setEspeces] = React.useState<Espece[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [scale, setScale] = React.useState(16)
  const [isPlanFullscreen, setIsPlanFullscreen] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)

  // Image de fond persistée côté serveur (satellite/drone) + outils du plan
  const { fond, majReglages, televerserImage, supprimerImage } = useFondPlan(selectedParcelleId)
  const [tool, setTool] = React.useState<GardenTool>('select')

  // Plan vivant : date affichée (null = aujourd'hui) + calques togglables
  const [dateVue, setDateVue] = React.useState<Date | null>(null)
  const [layers, setLayers] = React.useState<GardenLayers>(DEFAULT_LAYERS)
  const [reglesAssociations, setReglesAssociations] = React.useState<RegleAssociation[]>([])
  const [showFondDialog, setShowFondDialog] = React.useState(false)
  const [calibPoints, setCalibPoints] = React.useState<{ p1: { x: number; y: number }; p2: { x: number; y: number } } | null>(null)
  const [calibDistance, setCalibDistance] = React.useState("")
  const [exportingPng, setExportingPng] = React.useState(false)
  const fondFileInputRef = React.useRef<HTMLInputElement>(null)
  const planContainerRef = React.useRef<HTMLDivElement>(null)

  // Échap quitte l'outil mesure/calibration
  React.useEffect(() => {
    if (tool === 'select') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTool('select')
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [tool])

  React.useEffect(() => {
    if (!isPlanFullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPlanFullscreen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isPlanFullscreen])

  // Lire la parcelle depuis l'URL si presente (?parcelle=ID ou ?usage=culture|verger)
  // Bug feedback cmpkyc0qy — Sur ?usage=culture, le `find` retournait la 1re parcelle
  // marquée "culture" indépendamment de son contenu (Demo-C tunnel = 0 planche).
  // L'utilisateur voyait un canvas vide alors que Demo-A avait 11 planches.
  // On préfère désormais la parcelle qui a déjà des planches assignées.
  //
  // Bug feedback testeur 2026-05-26 (cmpm769mw) — Si plusieurs parcelles
  // matchent l'usage (le user a Nath et Luc + autres), sélectionner UNE
  // parcelle cache les autres. On bascule sur "Toutes les parcelles"
  // (selectedParcelleId=null) quand ≥ 2 parcelles correspondent à l'usage,
  // pour ne plus rater 12 planches sur 13.
  const urlAutoSelectDone = React.useRef(false)
  React.useEffect(() => {
    if (urlAutoSelectDone.current) return
    const p = searchParams.get('parcelle')
    if (p) {
      setSelectedParcelleId(p)
      urlAutoSelectDone.current = true
      return
    }
    const usage = searchParams.get('usage')
    if (usage && parcelles.length > 0) {
      const matches = parcelles.filter(pa =>
        pa.usage?.split(',').map(u => u.trim()).includes(usage)
      )
      if (matches.length >= 2) {
        // Plusieurs parcelles culture → on laisse "Toutes les parcelles"
        // pour ne pas cacher l'inventaire complet.
        setSelectedParcelleId(null)
      } else {
        const match = matches.find(pa => pa.plancheCount > 0) ?? matches[0]
        if (match) setSelectedParcelleId(match.id)
      }
      urlAutoSelectDone.current = true
    }
  }, [searchParams, parcelles])
  const [saving, setSaving] = React.useState(false)
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sélection multi-éléments
  const [selection, setSelection] = React.useState<SelectionItem[]>([])

  // Valeurs dérivées pour la sidebar (quand 1 seul sélectionné)
  const selectedPlanche = selection.length === 1 && selection[0].type === 'planche' ? selection[0].id as string : null
  const selectedObjet = selection.length === 1 && selection[0].type === 'objet' ? selection[0].id as number : null
  const selectedArbre = selection.length === 1 && selection[0].type === 'arbre' ? selection[0].id as number : null
  const [showNewPlancheDialog, setShowNewPlancheDialog] = React.useState(false)
  const [showNewObjetDialog, setShowNewObjetDialog] = React.useState(false)
  const [showNewArbreDialog, setShowNewArbreDialog] = React.useState(false)
  const [showNewCultureDialog, setShowNewCultureDialog] = React.useState(false)
  const [newPlanche, setNewPlanche] = React.useState({ nom: "", largeur: settings.defaultPlancheLargeur, longueur: settings.defaultPlancheLongueur })
  const [newObjet, setNewObjet] = React.useState({ nom: "", type: "allee", largeur: 0.5, longueur: 5 })
  const [newArbre, setNewArbre] = React.useState({ nom: "", type: "fruitier", espece: "", variete: "", fournisseur: "", envergure: 2, envergureAdulte: "" })

  // Mettre à jour les valeurs par défaut quand les settings changent
  React.useEffect(() => {
    setNewPlanche(prev => ({
      ...prev,
      largeur: prev.nom ? prev.largeur : settings.defaultPlancheLargeur,
      longueur: prev.nom ? prev.longueur : settings.defaultPlancheLongueur,
    }))
  }, [settings.defaultPlancheLargeur, settings.defaultPlancheLongueur])

  // Ref pour toast (evite les re-renders)
  const toastRef = React.useRef(toast)
  toastRef.current = toast

  // Charger les planches
  const fetchPlanches = React.useCallback(async () => {
    try {
      const params = selectedParcelleId ? `?parcelle=${selectedParcelleId}` : ''
      const response = await fetch(`/api/jardin${params}`)
      if (!response.ok) throw new Error("Erreur chargement")
      let data: PlancheWithCulture[] = await response.json()

      // Auto-positionner les planches sans position
      let needsPositioning = false
      const positioned = data.filter(p => p.posX !== null && p.posY !== null)
      const unpositioned = data.filter(p => p.posX === null || p.posY === null)

      if (unpositioned.length > 0) {
        needsPositioning = true
        // Trouver la prochaine position libre
        let maxY = 0
        positioned.forEach(p => {
          const bottom = (p.posY || 0) + (p.longueur || 2)
          if (bottom > maxY) maxY = bottom
        })

        unpositioned.forEach((p, i) => {
          p.posX = (i % 3) * 2
          p.posY = maxY + Math.floor(i / 3) * 3 + 0.5
        })
        data = [...positioned, ...unpositioned]
      }

      setPlanches(data)
      // QA Camille 2026-05-15 — bonus : ne plus marquer `hasChanges`
      // sur un simple repositionnement auto au chargement. Avant,
      // ouvrir /jardin déclenchait un PUT cascade sur toutes les
      // planches sans qu'aucune action utilisateur ait été faite.
      // Désormais, le positionnement auto est idempotent et n'est
      // persisté qu'au prochain mouvement réel (handleSave).
      // if (needsPositioning) setHasChanges(true)
    } catch (error) {
      toastRef.current({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger le plan du jardin"
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedParcelleId])

  // Charger les objets du jardin
  const fetchObjets = React.useCallback(async () => {
    try {
      const params = selectedParcelleId ? `?parcelle=${selectedParcelleId}` : ''
      const response = await fetch(`/api/objets-jardin${params}`)
      if (!response.ok) return
      const data = await response.json()
      setObjets(data || [])
    } catch (error) {
      // Ignorer
    }
  }, [selectedParcelleId])

  // Charger les especes pour la création de cultures
  const fetchEspeces = React.useCallback(async () => {
    try {
      const response = await fetch("/api/especes?pageSize=200")
      if (!response.ok) return
      const data = await response.json()
      setEspeces(data.data || [])
    } catch (error) {
      // Ignorer
    }
  }, [])

  // Charger les arbres
  // Feedback Marc 2026-05-16 — V3 Bug 1 : avant ce fix, on chargeait
  // TOUS les arbres sans filtre, donc les 20 fruitiers du Verger
  // apparaissaient aussi dans le Tunnel maraîcher et sur "Toutes les
  // parcelles". On filtre désormais par `parcelle_geo_id` quand une
  // parcelle est sélectionnée ; côté front, on garantit aussi un
  // 2e filet en cas de réponse partielle.
  const fetchArbres = React.useCallback(async () => {
    try {
      // La route /api/arbres filtre via `?parcelle=<id>` (et accepte
      // `parcelle=none` pour les arbres sans rattachement parcellaire).
      const params = selectedParcelleId ? `?parcelle=${selectedParcelleId}` : ''
      const response = await fetch(`/api/arbres${params}`)
      if (!response.ok) return
      const data = await response.json()
      const rows = Array.isArray(data) ? data : data.data || []
      // Le filtre « Non assigné » (selectedParcelleId='none') vise les arbres
      // sans parcelle (parcelleGeoId=null). L'ancien `=== 'none'` ne matchait
      // jamais null → tous les arbres masqués (audit 2026-07, #30).
      const filtered = !selectedParcelleId
        ? rows
        : selectedParcelleId === 'none'
          ? rows.filter((a: { parcelleGeoId?: string | null }) => !a.parcelleGeoId)
          : rows.filter((a: { parcelleGeoId?: string | null }) => a.parcelleGeoId === selectedParcelleId)
      setArbres(filtered)
    } catch (error) {
      // Ignorer
    }
  }, [selectedParcelleId])

  // Charger les parcelles
  const fetchParcelles = React.useCallback(async () => {
    try {
      const response = await fetch("/api/carte")
      if (!response.ok) return
      const data = await response.json()
      setParcelles(data.map((p: any) => ({
        id: p.id,
        nom: p.nom,
        usage: p.usage,
        plancheCount: p._count?.planches ?? 0,
      })))
    } catch {
      // Ignorer
    }
  }, [])

  const [arbreEspecesRef, setArbreEspecesRef] = React.useState<string[]>([])
  const [arbreVarietesRef, setArbreVarietesRef] = React.useState<string[]>([])
  const [arbreFournisseursRef, setArbreFournisseursRef] = React.useState<string[]>([])

  React.useEffect(() => {
    Promise.all([
      fetch("/api/especes?type=all_arbres&pageSize=500").then(r => r.json()).catch(() => null),
      fetch("/api/varietes?pageSize=1000").then(r => r.json()).catch(() => null),
      fetch("/api/comptabilite/fournisseurs?actif=true").then(r => r.json()).catch(() => null),
    ]).then(([especesRes, varietesRes, fournisseursRes]) => {
      const especes = (especesRes?.data || []).map((e: any) => e.id).filter(Boolean)
      setArbreEspecesRef(especes)
      const especesSet = new Set(especes)
      const varietes = (varietesRes?.data || [])
        .filter((v: any) => especesSet.has(v.especeId))
        .map((v: any) => v.id)
        .filter(Boolean)
      setArbreVarietesRef(varietes)
      const fournisseurs = (fournisseursRes?.data || []).map((f: any) => f.id).filter(Boolean)
      setArbreFournisseursRef(fournisseurs)
    })
  }, [])

  const arbreEspeceOptions = React.useMemo(() => {
    const userEspeces = arbres.map(a => a.espece).filter(Boolean) as string[]
    return [...new Set([...arbreEspecesRef, ...userEspeces])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [arbres, arbreEspecesRef])

  const arbreVarieteOptions = React.useMemo(() => {
    const userVarietes = arbres.map(a => a.variete).filter(Boolean) as string[]
    return [...new Set([...arbreVarietesRef, ...userVarietes])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [arbres, arbreVarietesRef])

  const arbreFournisseurOptions = React.useMemo(() => {
    const userFournisseurs = arbres.map(a => a.fournisseur).filter(Boolean) as string[]
    return [...new Set([...arbreFournisseursRef, ...userFournisseurs])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [arbres, arbreFournisseursRef])

  // Charger planches et objets quand la parcelle change
  React.useEffect(() => {
    setIsLoading(true)
    Promise.all([fetchPlanches(), fetchObjets()])
  }, [fetchPlanches, fetchObjets])

  // Charger arbres et données de reference une seule fois
  React.useEffect(() => {
    Promise.all([fetchArbres(), fetchEspeces(), fetchParcelles()])
  }, [fetchArbres, fetchEspeces, fetchParcelles])

  // Règles d'association (calque liaisons favorables/défavorables)
  React.useEffect(() => {
    fetch("/api/associations")
      .then(r => (r.ok ? r.json() : []))
      .then((data) => {
        if (!Array.isArray(data)) return
        setReglesAssociations(
          data.map((a: { type: string; details?: { especeId: string | null; familleId: string | null }[] }) => ({
            type: a.type,
            details: (a.details || []).map(d => ({ especeId: d.especeId, familleId: d.familleId })),
          }))
        )
      })
      .catch(() => {})
  }, [])

  // --- Plan vivant : tailles à la date affichée -------------------------

  const dateAffichee = React.useMemo(() => dateVue ?? new Date(), [dateVue])

  // Cultures présentes à la date affichée, avec leur fraction de croissance
  const planchesAffichees = React.useMemo(() => {
    return planches.map(p => ({
      ...p,
      cultures: p.cultures
        .map(c => ({ ...c, croissance: croissanceCulture(c, dateAffichee) }))
        .filter(c => c.croissance !== null),
    }))
  }, [planches, dateAffichee])

  // Arbres : envergure dessinée à la date affichée (mesure du jour par défaut)
  const arbresAffiches = React.useMemo(() => {
    if (!dateVue) return arbres
    const aujourdHui = new Date()
    return arbres
      .map(a => ({ ...a, envergure: envergureArbreADate(a, dateAffichee, aujourdHui) }))
      .filter(a => a.envergure > 0.05)
  }, [arbres, dateVue, dateAffichee])

  // Liaisons d'association entre planches voisines (centres < 4 m)
  const liaisons = React.useMemo<LiaisonAssociation[]>(() => {
    if (!layers.associations || reglesAssociations.length === 0) return []
    const matche = (
      details: RegleAssociation["details"],
      espece: { id: string; famille: { id: string } | null }
    ) =>
      details.some(
        d =>
          (d.especeId && d.especeId === espece.id) ||
          (d.familleId && espece.famille && d.familleId === espece.famille.id)
      )
    const actives = planchesAffichees.filter(p => p.cultures.length > 0 && p.posX !== null && p.posY !== null)
    const result: LiaisonAssociation[] = []
    for (let i = 0; i < actives.length; i++) {
      for (let j = i + 1; j < actives.length; j++) {
        const a = actives[i]
        const b = actives[j]
        const ax = (a.posX ?? 0) + (a.largeur ?? 0.8) / 2
        const ay = (a.posY ?? 0) + (a.longueur ?? 2) / 2
        const bx = (b.posX ?? 0) + (b.largeur ?? 0.8) / 2
        const by = (b.posY ?? 0) + (b.longueur ?? 2) / 2
        if (Math.hypot(bx - ax, by - ay) > 4) continue
        let type: LiaisonAssociation["type"] | null = null
        for (const regle of reglesAssociations) {
          if (regle.type !== "favorable" && regle.type !== "incompatible") continue
          const concerne = a.cultures.some(c1 =>
            b.cultures.some(
              c2 =>
                c1.espece.id !== c2.espece.id &&
                matche(regle.details, c1.espece) &&
                matche(regle.details, c2.espece)
            )
          )
          if (concerne) {
            type = regle.type
            if (type === "incompatible") break // l'avertissement prime
          }
        }
        if (type) result.push({ x1: ax, y1: ay, x2: bx, y2: by, type })
      }
    }
    return result
  }, [layers.associations, reglesAssociations, planchesAffichees])

  // Données de l'element selectionne
  const selectedPlancheData = planches.find(p => p.id === selectedPlanche)
  const selectedObjetData = objets.find(o => o.id === selectedObjet)
  const selectedArbreData = arbres.find(a => a.id === selectedArbre)

  // Déplacer une planche
  const handlePlancheMove = (id: string, x: number, y: number) => {
    setPlanches(prev => prev.map(p =>
      p.id === id ? { ...p, posX: x, posY: y } : p
    ))
    setHasChanges(true)
  }

  // Déplacer un objet
  const handleObjetMove = (id: number, x: number, y: number) => {
    setObjets(prev => prev.map(o =>
      o.id === id ? { ...o, posX: x, posY: y } : o
    ))
    setHasChanges(true)
  }

  // Déplacer un arbre
  const handleArbreMove = (id: number, x: number, y: number) => {
    setArbres(prev => prev.map(a =>
      a.id === id ? { ...a, posX: x, posY: y } : a
    ))
    setHasChanges(true)
  }

  // Gestion de la selection
  const handleSelectionChange = React.useCallback((newSelection: SelectionItem[]) => {
    setSelection(newSelection)
  }, [])

  // Déplacement groupé
  const handleGroupMove = React.useCallback((dx: number, dy: number) => {
    const selPlanches = new Set(selection.filter(s => s.type === 'planche').map(s => s.id as string))
    const selObjets = new Set(selection.filter(s => s.type === 'objet').map(s => s.id as number))
    const selArbres = new Set(selection.filter(s => s.type === 'arbre').map(s => s.id as number))

    if (selPlanches.size > 0) {
      setPlanches(prev => prev.map(p =>
        selPlanches.has(p.id) ? { ...p, posX: (p.posX ?? 0) + dx, posY: (p.posY ?? 0) + dy } : p
      ))
    }
    if (selObjets.size > 0) {
      setObjets(prev => prev.map(o =>
        selObjets.has(o.id) ? { ...o, posX: o.posX + dx, posY: o.posY + dy } : o
      ))
    }
    if (selArbres.size > 0) {
      setArbres(prev => prev.map(a =>
        selArbres.has(a.id) ? { ...a, posX: a.posX + dx, posY: a.posY + dy } : a
      ))
    }
    setHasChanges(true)
  }, [selection])

  // Normalise un angle dans [0, 360). Le modulo JS garde le signe : une
  // rotation antihoraire (degrees < 0) produisait un angle négatif rejeté
  // par le schéma Zod (min 0) → sauvegarde en échec (audit 2026-07, #24).
  const normaliserAngle = (deg: number) => ((deg % 360) + 360) % 360

  // Tourner une planche
  const handleRotatePlanche = (degrees: number) => {
    if (!selectedPlanche) return
    setPlanches(prev => prev.map(p =>
      p.id === selectedPlanche
        ? { ...p, rotation2D: normaliserAngle((p.rotation2D || 0) + degrees) }
        : p
    ))
    setHasChanges(true)
  }

  // Tourner un objet
  const handleRotateObjet = (degrees: number) => {
    if (!selectedObjet) return
    setObjets(prev => prev.map(o =>
      o.id === selectedObjet
        ? { ...o, rotation2D: normaliserAngle(o.rotation2D + degrees) }
        : o
    ))
    setHasChanges(true)
  }

  // Sauvegarder les positions
  const handleSave = async () => {
    setSaving(true)
    try {
      const planchePromises = planches.map(p =>
        fetch(`/api/planches/${encodeURIComponent(p.nom || p.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posX: p.posX,
            posY: p.posY,
            rotation2D: p.rotation2D,
            largeur: p.largeur,
            longueur: p.longueur
          })
        })
      )

      const objetPromises = objets.map(o =>
        fetch(`/api/objets-jardin/${o.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom: o.nom,
            type: o.type,
            largeur: o.largeur,
            longueur: o.longueur,
            posX: o.posX,
            posY: o.posY,
            rotation2D: o.rotation2D,
            couleur: o.couleur
          })
        })
      )

      const arbrePromises = arbres.map(a =>
        fetch(`/api/arbres/${a.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom: a.nom,
            type: a.type,
            espece: a.espece,
            variete: a.variete,
            fournisseur: a.fournisseur,
            posX: a.posX,
            posY: a.posY,
            envergure: a.envergure,
            envergureAdulte: a.envergureAdulte,
            couleur: a.couleur,
            notes: a.notes
          })
        })
      )

      const results = await Promise.all([...planchePromises, ...objetPromises, ...arbrePromises])

      if (results.every(r => r.ok)) {
        toast({
          title: "Plan sauvegardé",
          description: "Les positions ont été enregistrées"
        })
        setHasChanges(false)
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Certaines positions n'ont pas pu être enregistrées"
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder le plan"
      })
    } finally {
      setSaving(false)
    }
  }

  // Auto-save débounced (1s après le dernier changement)
  React.useEffect(() => {
    if (!hasChanges || saving) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      handleSave()
    }, 1000)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, planches, objets, arbres])

  // Réorganiser en grille
  const handleReset = () => {
    const cols = Math.ceil(Math.sqrt(planches.length))
    const spacing = 0.5
    setPlanches(prev => prev.map((p, i) => ({
      ...p,
      posX: (i % cols) * ((p.largeur || 0.8) + spacing),
      posY: Math.floor(i / cols) * ((p.longueur || 2) + spacing)
    })))
    setHasChanges(true)
  }

  // Recentrer la vue
  const handleRecenter = () => {
    // Reset scale et laisser le GardenView recalculer le viewBox
    setScale(16)
  }

  // Créer une nouvelle planche
  const handleCreatePlanche = async () => {
    if (!newPlanche.nom.trim()) {
      toast({ variant: "destructive", title: "Nom requis" })
      return
    }

    try {
      // Trouver une position libre
      let maxY = 0
      planches.forEach(p => {
        const bottom = (p.posY || 0) + (p.longueur || 2)
        if (bottom > maxY) maxY = bottom
      })

      const response = await fetch("/api/planches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newPlanche.nom,
          largeur: newPlanche.largeur,
          longueur: newPlanche.longueur,
          surface: newPlanche.largeur * newPlanche.longueur,
          posX: 0,
          posY: maxY + 0.5,
          parcelleGeoId: selectedParcelleId || undefined,
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur création")
      }

      toast({ title: "Planche créée", description: newPlanche.nom })
      setShowNewPlancheDialog(false)
      setNewPlanche({ nom: "", largeur: settings.defaultPlancheLargeur, longueur: settings.defaultPlancheLongueur })
      fetchPlanches()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Supprimer la planche sélectionnée
  const handleDeletePlanche = async () => {
    if (!selectedPlanche) return
    const plancheNom = selectedPlancheData?.nom || selectedPlanche
    if (!(await confirmDialog(`Supprimer la planche "${plancheNom}" ?`))) return

    try {
      const response = await fetch(`/api/planches/${encodeURIComponent(plancheNom)}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur suppression")
      }

      toast({ title: "Planche supprimée" })
      setSelection([])
      fetchPlanches()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Dupliquer la planche sélectionnée
  const handleDuplicatePlanche = async () => {
    if (!selectedPlanche) return
    const source = planches.find(p => p.id === selectedPlanche)
    if (!source) return

    // Générer un nom unique basé sur l'original
    const sourceName = source.nom || source.id
    let newName = sourceName + "-copie"
    let suffix = 2
    while (planches.some(p => (p.nom || p.id) === newName)) {
      newName = sourceName + "-copie" + suffix
      suffix++
    }

    try {
      const response = await fetch("/api/planches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newName,
          largeur: source.largeur,
          longueur: source.longueur,
          surface: (source.largeur || 0) * (source.longueur || 0),
          posX: (source.posX ?? 0) + 1,
          posY: (source.posY ?? 0) + 1,
          rotation2D: source.rotation2D,
          parcelleGeoId: selectedParcelleId || undefined,
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur duplication")
      }

      const created = await response.json()
      toast({ title: "Planche dupliquée", description: newName })
      await fetchPlanches()
      setSelection([{ type: 'planche', id: created.id }])
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Créer un nouvel objet
  const handleCreateObjet = async () => {
    // Audit #35 : refuser les dimensions nulles (un champ vidé donnait 0 via
    // `parseFloat("")||0`) → objet créé mais invisible sur le plan.
    if (!newObjet.largeur || newObjet.largeur <= 0 || !newObjet.longueur || newObjet.longueur <= 0) {
      toast({ variant: "destructive", title: "Dimensions requises", description: "Largeur et longueur doivent être supérieures à 0." })
      return
    }
    try {
      // Trouver une position libre
      let maxY = 0
      planches.forEach(p => {
        const bottom = (p.posY || 0) + (p.longueur || 2)
        if (bottom > maxY) maxY = bottom
      })
      objets.forEach(o => {
        const bottom = o.posY + o.longueur
        if (bottom > maxY) maxY = bottom
      })

      const response = await fetch("/api/objets-jardin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newObjet.nom || null,
          type: newObjet.type,
          largeur: newObjet.largeur,
          longueur: newObjet.longueur,
          posX: 0,
          posY: maxY + 0.5,
          parcelleGeoId: selectedParcelleId || undefined,
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur création")
      }

      toast({ title: "Objet créé" })
      setShowNewObjetDialog(false)
      setNewObjet({ nom: "", type: "allee", largeur: 0.5, longueur: 5 })
      fetchObjets()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Supprimer l'objet sélectionné
  const handleDeleteObjet = async () => {
    if (!selectedObjet) return
    if (!(await confirmDialog("Supprimer cet objet ?"))) return

    try {
      const response = await fetch(`/api/objets-jardin/${selectedObjet}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur suppression")
      }

      toast({ title: "Objet supprimé" })
      setSelection([])
      fetchObjets()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Dupliquer l'objet sélectionné
  const handleDuplicateObjet = async () => {
    if (!selectedObjet) return
    const source = objets.find(o => o.id === selectedObjet)
    if (!source) return

    try {
      const response = await fetch("/api/objets-jardin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: source.nom ? source.nom + " (copie)" : null,
          type: source.type,
          largeur: source.largeur,
          longueur: source.longueur,
          posX: source.posX + 1,
          posY: source.posY + 1,
          rotation2D: source.rotation2D,
          couleur: source.couleur,
          parcelleGeoId: selectedParcelleId || undefined,
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur duplication")
      }

      const created = await response.json()
      toast({ title: "Objet dupliqué" })
      await fetchObjets()
      setSelection([{ type: 'objet', id: created.id }])
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Créer un nouvel arbre
  const handleCreateArbre = async () => {
    if (!newArbre.nom.trim()) {
      toast({ variant: "destructive", title: "Nom requis" })
      return
    }

    try {
      // Trouver une position libre
      let maxY = 0
      planches.forEach(p => {
        const bottom = (p.posY || 0) + (p.longueur || 2)
        if (bottom > maxY) maxY = bottom
      })
      objets.forEach(o => {
        const bottom = o.posY + o.longueur
        if (bottom > maxY) maxY = bottom
      })
      arbres.forEach(a => {
        const bottom = a.posY + a.envergure / 2
        if (bottom > maxY) maxY = bottom
      })

      const response = await fetch("/api/arbres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newArbre.nom.trim(),
          type: newArbre.type,
          espece: newArbre.espece || null,
          variete: newArbre.variete || null,
          fournisseur: newArbre.fournisseur || null,
          envergure: newArbre.envergure,
          envergureAdulte: newArbre.envergureAdulte || null,
          posX: 2,
          posY: maxY + 1,
          // datePlantation est requise par l'API ; la création rapide depuis
          // le plan ne la demande pas → date du jour par défaut (audit #22).
          datePlantation: todayLocalISO(),
          parcelleGeoId: selectedParcelleId || undefined,
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur création")
      }

      // Avertissement d'adéquation géographique (ex. fruitier à besoin de froid
      // en zone tropicale) renvoyé par l'API — non bloquant.
      const created = await response.json().catch(() => null)
      if (created?.avertissementZone) {
        toast({
          title: "Arbre créé — attention à votre climat",
          description: `${newArbre.espece} : ${created.avertissementZone}.`,
        })
      } else {
        toast({ title: "Arbre créé", description: newArbre.nom })
      }
      setShowNewArbreDialog(false)
      setNewArbre({ nom: "", type: "fruitier", espece: "", variete: "", fournisseur: "", envergure: 2, envergureAdulte: "" })
      fetchArbres()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // Supprimer l'arbre sélectionné
  const handleDeleteArbre = async () => {
    if (!selectedArbre) return
    const arbre = arbres.find(a => a.id === selectedArbre)
    if (!(await confirmDialog(`Supprimer l'arbre "${arbre?.nom}" ?`))) return

    try {
      const response = await fetch(`/api/arbres/${selectedArbre}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erreur suppression")
      }

      toast({ title: "Arbre supprimé" })
      setSelection([])
      fetchArbres()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue"
      })
    }
  }

  // --- Image de fond : upload, suppression, calibration 2 points ---

  const handleFondFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fondFileInputRef.current) fondFileInputRef.current.value = ""
    if (!file) return
    const result = await televerserImage(file)
    if (result.ok) {
      toast({
        title: "Image de fond enregistrée",
        description: "Calibrez maintenant l'échelle en cliquant 2 repères connus du plan.",
      })
    } else {
      toast({ variant: "destructive", title: "Erreur", description: result.erreur })
    }
  }

  const handleFondRemove = async () => {
    if (!fond) return
    const cible = fond.source === 'global' ? "le fond commun à toutes les parcelles" : "le fond de cette parcelle"
    if (!(await confirmDialog(`Supprimer ${cible} ?`))) return
    const ok = await supprimerImage()
    toast(ok ? { title: "Image de fond supprimée" } : { variant: "destructive", title: "Erreur", description: "Suppression impossible" })
  }

  // 2 points cliqués sur le plan → demander la distance réelle
  const handleCalibrate = React.useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    setCalibPoints({ p1, p2 })
    setCalibDistance("")
  }, [])

  const handleCalibrateApply = async () => {
    if (!calibPoints || !fond) return
    const distanceReelle = parseFloat(calibDistance.replace(",", "."))
    if (!Number.isFinite(distanceReelle) || distanceReelle <= 0) {
      toast({ variant: "destructive", title: "Distance invalide", description: "Saisissez la distance réelle en mètres." })
      return
    }
    // Dimensions naturelles de l'image (data URL locale, chargement immédiat)
    const img = new window.Image()
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Image illisible"))
        img.src = fond.image
      })
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de lire l'image de fond" })
      return
    }
    const reglages = calibrerFond({
      p1: calibPoints.p1,
      p2: calibPoints.p2,
      distanceReelle,
      fond,
      imageWidth: img.naturalWidth,
      imageHeight: img.naturalHeight,
    })
    if (!reglages) {
      toast({ variant: "destructive", title: "Calibration impossible", description: "Les deux points sont trop proches." })
      return
    }
    majReglages(reglages)
    setCalibPoints(null)
    setTool('select')
    toast({
      title: "Échelle calibrée",
      description: `1 pixel de l'image = ${reglages.scale.toFixed(3)} m. Le plan respecte maintenant l'échelle réelle.`,
    })
  }

  // Export PNG du plan : sérialise le SVG (fond inclus, en data URL) puis
  // rastérise sur canvas. Plafonné à ~8k px pour rester dans les limites canvas.
  const handleExportPng = async () => {
    const svg = planContainerRef.current?.querySelector("svg")
    if (!svg) {
      toast({ variant: "destructive", title: "Erreur", description: "Aucun plan à exporter" })
      return
    }
    setExportingPng(true)
    let svgUrl: string | null = null
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      const wPx = svg.width.baseVal.value
      const hPx = svg.height.baseVal.value
      const facteur = Math.max(0.5, Math.min(2, 8192 / Math.max(wPx, hPx)))
      const xml = new XMLSerializer().serializeToString(clone)
      svgUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }))
      const img = new window.Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Rendu du plan impossible"))
        img.src = svgUrl!
      })
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(wPx * facteur)
      canvas.height = Math.round(hPx * facteur)
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas indisponible")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("Export PNG impossible")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `plan-jardin-${todayLocalISO()}.png`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(a.href)
      document.body.removeChild(a)
      toast({ title: "Plan exporté", description: "Image PNG téléchargée" })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Export impossible",
      })
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl)
      setExportingPng(false)
    }
  }

  // Menu des calques d'affichage (utilisé dans les deux barres d'outils)
  const calquesMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Calques d'affichage" title="Calques d'affichage">
          <LayersIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuCheckboxItem
          checked={layers.fond}
          onCheckedChange={(v) => setLayers(l => ({ ...l, fond: !!v }))}
        >
          Image de fond
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={layers.grille}
          onCheckedChange={(v) => setLayers(l => ({ ...l, grille: !!v }))}
        >
          Grille
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={layers.etiquettes}
          onCheckedChange={(v) => setLayers(l => ({ ...l, etiquettes: !!v }))}
        >
          Étiquettes
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={layers.projectionAdulte}
          onCheckedChange={(v) => setLayers(l => ({ ...l, projectionAdulte: !!v }))}
        >
          Projection adulte des arbres
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={layers.associations}
          onCheckedChange={(v) => setLayers(l => ({ ...l, associations: !!v }))}
        >
          Associations entre planches
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Légende des couleurs - toutes les cultures
  const legendItems = React.useMemo(() => {
    const items = new Map<string, { especeId: string; color: string; name: string; count: number }>()
    planches.forEach(p => {
      p.cultures.forEach(c => {
        const espece = c.espece
        const color = espece.couleur || espece.famille?.couleur || "#22c55e"
        const existing = items.get(espece.id)
        if (existing) {
          existing.count++
        } else {
          items.set(espece.id, { especeId: espece.id, color, name: espece.nom ?? espece.id, count: 1 })
        }
      })
    })
    return Array.from(items.values()).sort((a, b) => b.count - a.count)
  }, [planches])

  // Surbrillance depuis la légende : planches portant chaque espèce
  const planchesParEspece = React.useMemo(() => {
    const map = new Map<string, string[]>()
    planches.forEach(p => {
      p.cultures.forEach(c => {
        const ids = map.get(c.espece.id) ?? []
        if (!ids.includes(p.id)) ids.push(p.id)
        map.set(c.espece.id, ids)
      })
    })
    return map
  }, [planches])

  const selectionPlancheIds = React.useMemo(
    () => new Set(selection.filter(s => s.type === 'planche').map(s => s.id as string)),
    [selection]
  )

  // Vrai si la sélection courante est exactement « les planches de cette espèce »
  const especeEnSurbrillance = React.useCallback(
    (especeId: string) => {
      const ids = planchesParEspece.get(especeId) ?? []
      return ids.length > 0 && selection.length === ids.length && ids.every(id => selectionPlancheIds.has(id))
    },
    [planchesParEspece, selection, selectionPlancheIds]
  )

  // Clic sur la légende : sélectionne les planches de l'espèce (re-clic = désélection)
  const handleLegendClick = React.useCallback(
    (especeId: string) => {
      const ids = planchesParEspece.get(especeId) ?? []
      if (ids.length === 0) return
      setSelection(
        especeEnSurbrillance(especeId) ? [] : ids.map(id => ({ type: 'planche' as const, id }))
      )
    },
    [planchesParEspece, especeEnSurbrillance]
  )

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          {/* xl:min-w-fit : le bloc titre ne se compresse jamais sur grand
              écran — si la barre d'outils manque de place, elle passe sur sa
              propre ligne (flex-wrap du parent) au lieu de chevaucher le titre. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-4 xl:min-w-fit xl:flex-nowrap">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:flex-nowrap">
              <MapIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
              {/* Bug cmp8rs6uh (Marc 2026-05-16) — titre cassé sur 3 lignes
                  quand le sélecteur de parcelle pousse la ligne : on bloque
                  le wrap du titre et on laisse le flex-wrap se faire entre
                  bloc-titre et bloc-actions. */}
              <h1 className="text-xl font-bold whitespace-nowrap">Plan du jardin</h1>

              {/* Selecteur de parcelle */}
              {parcelles.length > 0 && (
                <Select
                  value={selectedParcelleId ?? "all"}
                  onValueChange={(v) => setSelectedParcelleId(v === "all" ? null : v === "none" ? "none" : v)}
                >
                  <SelectTrigger className="w-full min-w-0 sm:ml-2 sm:w-[200px]">
                    <SelectValue placeholder="Toutes les parcelles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les parcelles</SelectItem>
                    {parcelles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom}{p.usage ? ` (${p.usage})` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">Non assigné</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Barre complète sur grand écran. En dessous de 1280 px, une version
              compacte évite tout débordement et conserve des cibles tactiles de 40 px.
              flex-wrap : si la place manque quand même (fenêtre ~1280 px), les
              boutons passent à la ligne au lieu de chevaucher le titre. */}
          <div className="hidden flex-wrap items-center justify-end gap-2 xl:flex">
            {/* Zoom */}
            <Button variant="outline" size="icon" aria-label="Dézoomer" onClick={() => setScale(s => Math.max(6, s - 5))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-16 text-center">{scale}px/m</span>
            <Button variant="outline" size="icon" aria-label="Zoomer" onClick={() => setScale(s => Math.min(120, s + 5))}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-slate-300 mx-2" />

            {/* Recentrer */}
            <Button variant="outline" size="sm" onClick={handleRecenter}>
              <Crosshair className="h-4 w-4 mr-2" />
              Recentrer
            </Button>

            <Button variant="outline" size="sm" onClick={() => setIsPlanFullscreen(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Plein écran
            </Button>

            {/* Cartographie */}
            <Link href="/jardin/carte">
              <Button variant="outline" size="sm">
                <MapIcon className="h-4 w-4 mr-2" />
                Cartographie
              </Button>
            </Link>

            {/* Vue 3D (nouveauté) */}
            <Link
              href={
                selectedParcelleId && selectedParcelleId !== "none"
                  ? `/jardin/3d?parcelle=${encodeURIComponent(selectedParcelleId)}`
                  : "/jardin/3d"
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Box className="h-4 w-4 mr-2" />
                Vue 3D
              </Button>
            </Link>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Outils : mesure, image de fond, export — icônes seules pour ne
                pas faire déborder la barre (libellés en tooltip/aria-label) */}
            <Button
              variant={tool === 'measure' ? "default" : "outline"}
              size="icon"
              onClick={() => setTool(t => t === 'measure' ? 'select' : 'measure')}
              aria-label="Mesurer une distance"
              title="Mesurer une distance sur le plan"
            >
              <Ruler className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFondDialog(true)}
              aria-label="Image de fond"
              title="Image de fond (satellite, drone)"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleExportPng}
              disabled={exportingPng}
              aria-label="Exporter le plan en PNG"
              title="Exporter le plan en PNG"
            >
              <Download className="h-4 w-4" />
            </Button>
            {calquesMenu}

            <div className="w-px h-6 bg-slate-300 mx-1" />

            <Button variant="outline" size="sm" onClick={() => setShowNewPlancheDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Planche
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewObjetDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Objet
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewArbreDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Arbre
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réorg.
            </Button>
            {saving && (
              <span className="text-xs text-muted-foreground animate-pulse">Sauvegarde...</span>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 xl:hidden">
            <div className="flex h-10 items-center rounded-md border bg-white">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Dézoomer"
                onClick={() => setScale(s => Math.max(6, s - 5))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-14 text-center text-xs tabular-nums">{scale}px/m</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Zoomer"
                onClick={() => setScale(s => Math.min(120, s + 5))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleRecenter} aria-label="Recentrer le plan">
              <Crosshair className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setIsPlanFullscreen(true)} aria-label="Afficher le plan en plein écran">
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" className="h-10 w-10" asChild>
              <Link href="/jardin/carte" aria-label="Ouvrir la cartographie">
                <MapIcon className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant={tool === 'measure' ? "default" : "outline"}
              size="icon"
              className="h-10 w-10"
              onClick={() => setTool(t => t === 'measure' ? 'select' : 'measure')}
              aria-label="Mesurer une distance"
            >
              <Ruler className="h-4 w-4" />
            </Button>

            {calquesMenu}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setShowNewPlancheDialog(true)}>
                  <Plus /> Nouvelle planche
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowNewObjetDialog(true)}>
                  <Plus /> Nouvel objet
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowNewArbreDialog(true)}>
                  <Plus /> Nouvel arbre
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShowFondDialog(true)}>
                  <ImageIcon /> Image de fond…
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportPng} disabled={exportingPng}>
                  <Download /> Exporter en PNG
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleReset}>
                  <RotateCcw /> Réorganiser le plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {saving && (
              <span className="w-full text-xs text-muted-foreground animate-pulse">Sauvegarde...</span>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-2 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* Plan */}
          <Card className={isPlanFullscreen ? "fixed inset-0 z-[100] overflow-hidden rounded-none border-0 bg-emerald-50" : "overflow-hidden"}>
            <CardContent className={isPlanFullscreen ? "relative h-[100dvh] p-0" : "relative h-[max(420px,calc(100dvh-250px))] p-0 sm:h-[max(500px,calc(100dvh-200px))]"}>
              {isPlanFullscreen && (
                <>
                  <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border bg-white/95 p-1.5 shadow-lg backdrop-blur sm:right-4 sm:top-4 sm:gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setScale(s => Math.max(6, s - 5))} aria-label="Dézoomer">
                      <ZoomOut className="h-5 w-5" />
                    </Button>
                    <span className="min-w-12 text-center text-xs font-medium tabular-nums">{scale}px/m</span>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setScale(s => Math.min(120, s + 5))} aria-label="Zoomer">
                      <ZoomIn className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleRecenter} aria-label="Recentrer">
                      <Crosshair className="h-5 w-5" />
                    </Button>
                    <Button
                      variant={tool === 'measure' ? "default" : "ghost"}
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setTool(t => t === 'measure' ? 'select' : 'measure')}
                      aria-label="Mesurer une distance"
                    >
                      <Ruler className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setIsPlanFullscreen(false)} aria-label="Quitter le plein écran">
                      <Minimize2 className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/75 px-3 py-1.5 text-xs text-white shadow sm:bottom-4">
                    1 doigt pour déplacer · 2 doigts pour zoomer
                  </div>
                </>
              )}
              {tool !== 'select' && (
                <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/80 py-1.5 pl-3 pr-1.5 text-xs text-white shadow">
                  <span className="whitespace-nowrap">
                    {tool === 'measure'
                      ? "Mesure : touchez 2 points du plan"
                      : "Calibration : touchez 2 repères dont vous connaissez la distance réelle"}
                  </span>
                  <button
                    type="button"
                    className="rounded-full bg-white/20 p-1 hover:bg-white/30"
                    onClick={() => setTool('select')}
                    aria-label="Quitter l'outil"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : planches.length === 0 && arbres.length === 0 && objets.length === 0 && !fond ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MapIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p>Aucun élément sur cette parcelle</p>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <Button variant="link" onClick={() => setShowNewPlancheDialog(true)}>
                      Créer une planche
                    </Button>
                    <Button variant="link" onClick={() => setShowFondDialog(true)}>
                      Importer une image de fond
                    </Button>
                  </div>
                </div>
              ) : (
                <div ref={planContainerRef} className="h-full w-full">
                  <GardenView
                    planches={planchesAffichees}
                    objets={objets}
                    arbres={arbresAffiches}
                    editable
                    selection={selection}
                    onSelectionChange={handleSelectionChange}
                    onGroupMove={handleGroupMove}
                    onPlancheMove={handlePlancheMove}
                    onObjetMove={handleObjetMove}
                    onArbreMove={handleArbreMove}
                    scale={scale}
                    onScaleChange={setScale}
                    plancheColor={settings.plancheColor}
                    selectedColor={settings.plancheSelectedColor}
                    gridColor={settings.gridColor}
                    tool={tool}
                    onCalibrate={handleCalibrate}
                    layers={layers}
                    liaisons={liaisons}
                    backgroundImage={fond ? {
                      image: fond.image,
                      opacity: fond.opacity,
                      scale: fond.scale,
                      offsetX: fond.offsetX,
                      offsetY: fond.offsetY,
                      rotation: fond.rotation,
                      contour: fond.contour,
                    } : undefined}
                  />
                </div>
              )}

              {/* Plan vivant : curseur temporel (masqué en plein écran) */}
              {!isPlanFullscreen && !isLoading && (planches.length > 0 || arbres.length > 0) && (
                <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur">
                  <CalendarClock className={`h-4 w-4 shrink-0 ${dateVue ? "text-amber-600" : "text-emerald-700"}`} />
                  <input
                    type="range"
                    min={0}
                    max={364}
                    value={Math.max(0, Math.min(364, Math.floor(
                      (dateAffichee.getTime() - new Date(dateAffichee.getFullYear(), 0, 1).getTime()) / 86400000
                    )))}
                    onChange={(e) => {
                      setDateVue(new Date(dateAffichee.getFullYear(), 0, 1 + parseInt(e.target.value)))
                    }}
                    className="w-32 accent-emerald-600 sm:w-48"
                    aria-label="Date affichée sur le plan"
                  />
                  <span className="w-[92px] text-center text-xs font-medium tabular-nums">
                    {dateAffichee.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => {
                      const d = new Date(dateAffichee)
                      d.setFullYear(d.getFullYear() + 1)
                      setDateVue(d)
                    }}
                    title="Projeter le verger un an plus tard"
                  >
                    +1 an
                  </Button>
                  {dateVue && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-emerald-700"
                      onClick={() => setDateVue(null)}
                    >
                      Aujourd&apos;hui
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Planche sélectionnée */}
            {selectedPlancheData ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedPlancheData.nom || selectedPlancheData.id}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelection([])}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="text-muted-foreground block text-xs">Largeur (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        className="w-full border rounded px-2 py-1 text-sm font-medium"
                        value={selectedPlancheData.largeur || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setPlanches(prev => prev.map(p =>
                            p.id === selectedPlancheData.id ? { ...p, largeur: val } : p
                          ))
                          setHasChanges(true)
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block text-xs">Longueur (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        className="w-full border rounded px-2 py-1 text-sm font-medium"
                        value={selectedPlancheData.longueur || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setPlanches(prev => prev.map(p =>
                            p.id === selectedPlancheData.id ? { ...p, longueur: val } : p
                          ))
                          setHasChanges(true)
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Surface:</span>
                      <span className="ml-1 font-medium">
                        {((selectedPlancheData.largeur || 0) * (selectedPlancheData.longueur || 0)).toFixed(1)} m²
                      </span>
                    </div>
                  </div>

                  {selectedPlancheData.cultures.length > 0 ? (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Culture{selectedPlancheData.cultures.length > 1 ? 's' : ''} ({selectedPlancheData.cultures.length}):
                      </span>
                      <div className="space-y-1.5 mt-1">
                        {selectedPlancheData.cultures.map((culture) => {
                          const espacementRangs = culture.itp?.espacementRangs || 30
                          const largeurNecessaire = ((culture.nbRangs || 1) - 1) * espacementRangs / 100
                          const largeurPlanche = selectedPlancheData.largeur || 0.8
                          const ajuste = largeurNecessaire > largeurPlanche

                          return (
                            <Link
                              key={culture.id}
                              href={`/maraichage/cultures/${culture.id}`}
                              className="block"
                            >
                              <div className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 transition-colors">
                                <div
                                  className="w-4 h-4 rounded flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      culture.espece.couleur ||
                                      culture.espece.famille?.couleur ||
                                      "#22c55e"
                                  }}
                                />
                                <div className="flex-1">
                                  <span className="font-medium text-sm block">{culture.espece.nom ?? culture.espece.id}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {culture.nbRangs || 1} rang{(culture.nbRangs || 1) > 1 ? 's' : ''} × {espacementRangs}cm
                                    {ajuste && <span className="text-orange-600 ml-1">⚠ ajusté</span>}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Aucune culture</p>
                  )}

                  {/* Pluviométrie */}
                  <div className="pt-2 border-t">
                    <PluviometriePlanche
                      plancheId={selectedPlancheData.id}
                      typePlanche={selectedPlancheData.type}
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    {/* Rotation */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Rotation: {selectedPlancheData.rotation2D || 0}°</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotatePlanche(-15)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotatePlanche(15)}>
                          <RotateCw className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotatePlanche(90)}>
                          90°
                        </Button>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowNewCultureDialog(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Culture
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDuplicatePlanche} title="Dupliquer">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeletePlanche}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : selectedObjetData ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {selectedObjetData.nom || TYPES_OBJETS.find(t => t.value === selectedObjetData.type)?.label || "Objet"}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelection([])}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {/* Type */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select
                        value={selectedObjetData.type}
                        onValueChange={(v) => {
                          setObjets(prev => prev.map(o =>
                            o.id === selectedObjet ? { ...o, type: v } : o
                          ))
                          setHasChanges(true)
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPES_OBJETS.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: t.color }} />
                                {t.label}
                              </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Nom */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Nom (optionnel)</Label>
                        <Input
                          className="h-8 text-sm"
                          value={selectedObjetData.nom || ""}
                          onChange={(e) => {
                            setObjets(prev => prev.map(o =>
                              o.id === selectedObjet ? { ...o, nom: e.target.value || null } : o
                            ))
                            setHasChanges(true)
                          }}
                          placeholder="Ex: Allee principale"
                        />
                      </div>

                      {/* Dimensions */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Largeur (m)</Label>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={selectedObjetData.largeur}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0.1
                              setObjets(prev => prev.map(o =>
                                o.id === selectedObjet ? { ...o, largeur: val } : o
                              ))
                              setHasChanges(true)
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Longueur (m)</Label>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={selectedObjetData.longueur}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0.1
                              setObjets(prev => prev.map(o =>
                                o.id === selectedObjet ? { ...o, longueur: val } : o
                              ))
                              setHasChanges(true)
                            }}
                          />
                        </div>
                      </div>

                      {/* Couleur personnalisee */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Couleur</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={selectedObjetData.couleur || TYPES_OBJETS.find(t => t.value === selectedObjetData.type)?.color || "#d1d5db"}
                            onChange={(e) => {
                              setObjets(prev => prev.map(o =>
                                o.id === selectedObjet ? { ...o, couleur: e.target.value } : o
                              ))
                              setHasChanges(true)
                            }}
                            className="h-8 w-12 rounded border border-slate-300 cursor-pointer"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setObjets(prev => prev.map(o =>
                                o.id === selectedObjet ? { ...o, couleur: null } : o
                              ))
                              setHasChanges(true)
                            }}
                          >
                            Par defaut
                          </Button>
                        </div>
                      </div>

                      {/* Rotation */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Rotation: {selectedObjetData.rotation2D}°</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotateObjet(-15)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotateObjet(15)}>
                            <RotateCw className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleRotateObjet(90)}>
                            90°
                          </Button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDuplicateObjet} className="flex-1">
                          <Copy className="h-4 w-4 mr-2" />
                          Dupliquer
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteObjet} className="flex-1">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : selectedArbreData ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedArbreData.nom}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelection([])}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {/* Nom */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Nom</Label>
                      <Input
                        className="h-8 text-sm"
                        value={selectedArbreData.nom}
                          onChange={(e) => {
                            setArbres(prev => prev.map(a =>
                              a.id === selectedArbre ? { ...a, nom: e.target.value } : a
                            ))
                            setHasChanges(true)
                          }}
                        />
                      </div>

                      {/* Type */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Select
                          value={selectedArbreData.type}
                          onValueChange={(v) => {
                            setArbres(prev => prev.map(a =>
                              a.id === selectedArbre ? { ...a, type: v } : a
                            ))
                            setHasChanges(true)
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPES_ARBRES.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                                  {t.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Espece & Variete */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Espèce</Label>
                          <Combobox
                            value={selectedArbreData.espece || ""}
                            onValueChange={(v) => {
                              setArbres(prev => prev.map(a =>
                                a.id === selectedArbre ? { ...a, espece: v || null } : a
                              ))
                              setHasChanges(true)
                            }}
                            options={arbreEspeceOptions}
                            placeholder="Ex: Pommier"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Variété</Label>
                          <Combobox
                            value={selectedArbreData.variete || ""}
                            onValueChange={(v) => {
                              setArbres(prev => prev.map(a =>
                                a.id === selectedArbre ? { ...a, variete: v || null } : a
                              ))
                              setHasChanges(true)
                            }}
                            options={arbreVarieteOptions}
                            placeholder="Ex: Golden"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* Fournisseur */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Fournisseur</Label>
                        <Combobox
                          value={selectedArbreData.fournisseur || ""}
                          onValueChange={(v) => {
                            setArbres(prev => prev.map(a =>
                              a.id === selectedArbre ? { ...a, fournisseur: v || null } : a
                            ))
                            setHasChanges(true)
                          }}
                          options={arbreFournisseurOptions}
                          placeholder="Ex: Pépinière locale"
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Envergure actuelle + projection adulte (cercle pointillé) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Envergure (m)</Label>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={selectedArbreData.envergure}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1
                              setArbres(prev => prev.map(a =>
                                a.id === selectedArbre ? { ...a, envergure: val } : a
                              ))
                              setHasChanges(true)
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Adulte (m)</Label>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={selectedArbreData.envergureAdulte ?? ""}
                            placeholder={selectedArbreData.especeEtalement ? String(selectedArbreData.especeEtalement) : "—"}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null
                              setArbres(prev => prev.map(a =>
                                a.id === selectedArbre ? { ...a, envergureAdulte: Number.isFinite(val as number) ? val : null } : a
                              ))
                              setHasChanges(true)
                            }}
                          />
                        </div>
                        <p className="col-span-2 text-[11px] leading-snug text-muted-foreground">
                          La taille adulte s&apos;affiche en pointillés sur le plan
                          {selectedArbreData.especeEtalement ? " (héritée de l'espèce si vide)" : ""}.
                        </p>
                      </div>

                      {/* Couleur personnalisee */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Couleur</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={selectedArbreData.couleur || TYPES_ARBRES.find(t => t.value === selectedArbreData.type)?.color || "#22c55e"}
                            onChange={(e) => {
                              setArbres(prev => prev.map(a =>
                                a.id === selectedArbre ? { ...a, couleur: e.target.value } : a
                              ))
                              setHasChanges(true)
                            }}
                            className="h-8 w-12 rounded border border-slate-300 cursor-pointer"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setArbres(prev => prev.map(a =>
                                a.id === selectedArbre ? { ...a, couleur: null } : a
                              ))
                              setHasChanges(true)
                            }}
                          >
                            Par defaut
                          </Button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <Input
                          className="h-8 text-sm"
                          value={selectedArbreData.notes || ""}
                          onChange={(e) => {
                            setArbres(prev => prev.map(a =>
                              a.id === selectedArbre ? { ...a, notes: e.target.value || null } : a
                            ))
                            setHasChanges(true)
                          }}
                          placeholder="Notes..."
                        />
                      </div>

                      {/* Bouton supprimer */}
                    <Button variant="destructive" size="sm" onClick={handleDeleteArbre} className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : selection.length > 1 ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selection.length} éléments</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setSelection([])}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {(() => {
                    const nbP = selection.filter(s => s.type === 'planche').length
                    const nbO = selection.filter(s => s.type === 'objet').length
                    const nbA = selection.filter(s => s.type === 'arbre').length
                    return (
                      <>
                        {nbP > 0 && <div>{nbP} planche{nbP > 1 ? 's' : ''}</div>}
                        {nbO > 0 && <div>{nbO} objet{nbO > 1 ? 's' : ''}</div>}
                        {nbA > 0 && <div>{nbA} arbre{nbA > 1 ? 's' : ''}</div>}
                      </>
                    )
                  })()}
                  <p className="text-xs text-muted-foreground pt-2">
                    Glissez pour déplacer le groupe
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Cliquez sur un élément pour voir ses details
                </CardContent>
              </Card>
            )}

            {/* Légende */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cultures en cours</CardTitle>
              </CardHeader>
              <CardContent>
                {legendItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune culture active</p>
                ) : (
                  <ul className="space-y-0.5">
                    {legendItems.map(item => {
                      const active = especeEnSurbrillance(item.especeId)
                      return (
                        <li key={item.especeId}>
                          <button
                            type="button"
                            onClick={() => handleLegendClick(item.especeId)}
                            title={active ? "Retirer la surbrillance" : "Mettre les planches de cette culture en surbrillance"}
                            className={`flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors ${
                              active
                                ? "bg-blue-50 ring-1 ring-inset ring-blue-300"
                                : "hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: item.color }} />
                              <span className="truncate">{item.name}</span>
                            </div>
                            {item.count > 1 && (
                              <span className="text-xs text-muted-foreground">×{item.count}</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planches</span>
                  <span className="font-medium">{planches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cultivées</span>
                  <span className="font-medium">{planches.filter(p => p.cultures.length > 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surface planches</span>
                  <span className="font-medium">
                    {planches.reduce((sum, p) => sum + (p.largeur || 0) * (p.longueur || 0), 0).toFixed(1)} m²
                  </span>
                </div>
                {arbres.length > 0 && (
                  <>
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-muted-foreground">Arbres</span>
                      <span className="font-medium">{arbres.length}</span>
                    </div>
                    {/* Feedback Marc 2026-05-16 — Bug 06 : la tuile Surface
                        n'affichait que les planches et tombait à 0 quand le
                        verger n'a pas de planches mais des arbres. On
                        ajoute une estimation surface canopée (envergure²). */}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Surface canopée</span>
                      <span className="font-medium">
                        {arbres.reduce((sum, a) => sum + (a.envergure || 0) ** 2, 0).toFixed(1)} m²
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Aide</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>• Glissez un élément pour le déplacer</p>
                <p>• Shift+clic pour multi-sélection</p>
                <p>• Dessinez un rectangle pour sélectionner un groupe</p>
                <p>• Glissez un élément du groupe pour tout déplacer</p>
                <p className="border-t pt-2 mt-2">
                  <span className="font-medium text-slate-700">Photo satellite en fond :</span>{" "}
                  dessinez votre parcelle dans la{" "}
                  <Link href="/jardin/carte" className="font-medium text-emerald-700 underline">
                    cartographie
                  </Link>{" "}
                  puis « Capturer le fond satellite » — la photo arrive ici avec l&apos;échelle
                  et le contour de la parcelle déjà calés.
                </p>
                <p>
                  • Vous pouvez aussi importer votre propre image (photo de drone…) via le
                  bouton « Fond », puis caler l&apos;échelle en cliquant 2 repères connus.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Dialog création planche */}
      <Dialog open={showNewPlancheDialog} onOpenChange={setShowNewPlancheDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle planche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="planche-id">Nom</Label>
              <Input
                id="planche-id"
                value={newPlanche.nom}
                onChange={e => setNewPlanche(p => ({ ...p, nom: e.target.value }))}
                placeholder="Ex: P1, A-Nord..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planche-largeur">Largeur (m)</Label>
                <Input
                  id="planche-largeur"
                  type="number"
                  step="0.1"
                  value={newPlanche.largeur}
                  onChange={e => setNewPlanche(p => ({ ...p, largeur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="planche-longueur">Longueur (m)</Label>
                <Input
                  id="planche-longueur"
                  type="number"
                  step="0.1"
                  value={newPlanche.longueur}
                  onChange={e => setNewPlanche(p => ({ ...p, longueur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Surface: {(newPlanche.largeur * newPlanche.longueur).toFixed(1)} m²
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPlancheDialog(false)}>Annuler</Button>
            <Button onClick={handleCreatePlanche}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog création objet */}
      <Dialog open={showNewObjetDialog} onOpenChange={setShowNewObjetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel objet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="objet-type">Type</Label>
              <Select value={newObjet.type} onValueChange={v => setNewObjet(o => ({ ...o, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_OBJETS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="objet-nom">Nom (optionnel)</Label>
              <Input
                id="objet-nom"
                value={newObjet.nom}
                onChange={e => setNewObjet(o => ({ ...o, nom: e.target.value }))}
                placeholder="Ex: Allée principale..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="objet-largeur">Largeur (m)</Label>
                <Input
                  id="objet-largeur"
                  type="number"
                  step="0.1"
                  value={newObjet.largeur}
                  onChange={e => setNewObjet(o => ({ ...o, largeur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="objet-longueur">Longueur (m)</Label>
                <Input
                  id="objet-longueur"
                  type="number"
                  step="0.1"
                  value={newObjet.longueur}
                  onChange={e => setNewObjet(o => ({ ...o, longueur: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewObjetDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateObjet}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog création arbre */}
      <Dialog open={showNewArbreDialog} onOpenChange={setShowNewArbreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel arbre / arbuste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="arbre-nom">Nom *</Label>
              <Input
                id="arbre-nom"
                value={newArbre.nom}
                onChange={e => setNewArbre(a => ({ ...a, nom: e.target.value }))}
                placeholder="Ex: Pommier Golden, Framboisier..."
              />
            </div>
            <div>
              <Label htmlFor="arbre-type">Type</Label>
              <Select value={newArbre.type} onValueChange={v => setNewArbre(a => ({ ...a, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_ARBRES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="arbre-espece">Espèce</Label>
                <Combobox
                  value={newArbre.espece}
                  onValueChange={v => setNewArbre(a => ({ ...a, espece: v }))}
                  options={arbreEspeceOptions}
                  placeholder="Ex: Pommier"
                />
              </div>
              <div>
                <Label htmlFor="arbre-variete">Variété</Label>
                <Combobox
                  value={newArbre.variete}
                  onValueChange={v => setNewArbre(a => ({ ...a, variete: v }))}
                  options={arbreVarieteOptions}
                  placeholder="Ex: Golden"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="arbre-fournisseur">Fournisseur / Lieu d'achat</Label>
              <Combobox
                value={newArbre.fournisseur}
                onValueChange={v => setNewArbre(a => ({ ...a, fournisseur: v }))}
                options={arbreFournisseurOptions}
                placeholder="Ex: Pépinière du coin"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="arbre-envergure">Envergure (m)</Label>
                <Input
                  id="arbre-envergure"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={newArbre.envergure}
                  onChange={e => setNewArbre(a => ({ ...a, envergure: parseFloat(e.target.value) || 2 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Diamètre actuel de la couronne</p>
              </div>
              <div>
                <Label htmlFor="arbre-envergure-adulte">Envergure adulte (m)</Label>
                <Input
                  id="arbre-envergure-adulte"
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder="Ex : 4"
                  value={newArbre.envergureAdulte}
                  onChange={e => setNewArbre(a => ({ ...a, envergureAdulte: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Projection en pointillés (sinon héritée de l&apos;espèce)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewArbreDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateArbre}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog image de fond (satellite / drone) */}
      <Dialog open={showFondDialog} onOpenChange={setShowFondDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Image de fond du plan</DialogTitle>
          </DialogHeader>
          <input
            ref={fondFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFondFileChange}
          />
          {fond ? (
            <div className="space-y-4 py-2">
              <div className="relative overflow-hidden rounded-lg border bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fond.image}
                  alt="Image de fond du plan"
                  className="mx-auto max-h-44 w-auto object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {fond.source === 'parcelle'
                  ? "Fond propre à la parcelle sélectionnée."
                  : "Fond commun à toutes les parcelles."}{" "}
                Échelle actuelle : {fond.scale.toFixed(3)} m/pixel.
              </p>
              <div>
                <Label className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Opacité</span>
                  <span>{Math.round(fond.opacity * 100)}%</span>
                </Label>
                <Slider
                  value={[fond.opacity]}
                  onValueChange={([v]) => majReglages({ opacity: v })}
                  min={0.1}
                  max={1}
                  step={0.05}
                />
              </div>
              <div>
                <Label className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Rotation</span>
                  <span>{Math.round(fond.rotation)}°</span>
                </Label>
                <Slider
                  value={[fond.rotation]}
                  onValueChange={([v]) => majReglages({ rotation: v })}
                  min={-180}
                  max={180}
                  step={1}
                />
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowFondDialog(false)
                    setTool('calibrate')
                  }}
                >
                  <Ruler className="h-4 w-4 mr-2" />
                  Calibrer l&apos;échelle (2 points)
                </Button>
                <Button variant="outline" size="sm" onClick={() => fondFileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Remplacer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleFondRemove}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </div>
              {selectedParcelleId && selectedParcelleId !== 'none' && fond.source === 'global' && (
                <p className="text-xs text-muted-foreground">
                  Remplacer l&apos;image créera un fond propre à la parcelle sélectionnée ; les autres
                  parcelles garderont le fond commun.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div
                onClick={() => fondFileInputRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-green-500 hover:bg-green-50"
              >
                <ImageIcon className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Cliquez pour importer une capture satellite (Google Maps, IGN…) ou une photo de drone
                </p>
                <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP — max 10 Mo</p>
              </div>
              <p className="text-xs text-muted-foreground">
                L&apos;image s&apos;affiche sous le plan, puis vous calez l&apos;échelle réelle en cliquant
                2 repères dont vous connaissez la distance (façade, portail…). Elle est enregistrée sur
                votre compte et synchronisée entre vos appareils.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog calibration 2 points */}
      <Dialog open={!!calibPoints} onOpenChange={(open) => { if (!open) setCalibPoints(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calibrer l&apos;échelle du fond</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Distance actuelle entre les 2 points sur le plan :{" "}
              <span className="font-medium text-foreground">
                {calibPoints ? formatDistance(distance(calibPoints.p1, calibPoints.p2)) : "–"}
              </span>
            </p>
            <div>
              <Label htmlFor="calib-distance">Distance réelle entre ces 2 points (m)</Label>
              <Input
                id="calib-distance"
                type="text"
                inputMode="decimal"
                placeholder="Ex : 12,5"
                value={calibDistance}
                onChange={(e) => setCalibDistance(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                L&apos;image sera redimensionnée pour respecter l&apos;échelle réelle ; le premier point
                cliqué reste en place.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalibPoints(null)}>Annuler</Button>
            <Button onClick={handleCalibrateApply}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nouvelle culture sur planche */}
      {selectedPlancheData && (
        <NewCultureDialog
          open={showNewCultureDialog}
          onOpenChange={setShowNewCultureDialog}
          plancheId={selectedPlancheData.id}
          plancheNom={selectedPlancheData.nom || selectedPlancheData.id}
          plancheLongueur={selectedPlancheData.longueur}
          onCreated={fetchPlanches}
        />
      )}
    </div>
  )
}
