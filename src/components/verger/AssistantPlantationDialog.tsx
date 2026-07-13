"use client"

/**
 * Assistant Verger / Plantation - Wizard pas-à-pas en 5 etapes
 *
 * Flow: Type de projet -> Localisation -> Essences & densité -> Calendrier -> Récap + Aides
 *
 * Conçu pour les replantations forestières, haies, agroforesterie, vergers.
 */

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  X,
  Wand2,
  Trees,
  MapPin,
  Sprout,
  CalendarClock,
  CheckSquare,
  PartyPopper,
  Check,
  Apple,
  Fence,
  Leaf,
  TreeDeciduous,
  HelpCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  ESSENCES_FORESTIERES,
  DENSITES_DEFAUT,
  ETAPES_TYPES,
  type TypeFormation,
} from "@/data/essences-forestieres"
import { getAidesByType, NIVEAU_LIBELLE } from "@/data/aides-plantation"

const TYPES_PROJET: Array<{ value: TypeFormation; label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = [
  { value: "forestier_futaie", label: "Futaie forestière", icon: Trees, description: "Bois d'œuvre, cycle long (50-150 ans). Ex : chêne, hêtre, douglas." },
  { value: "forestier_taillis", label: "Taillis forestier", icon: TreeDeciduous, description: "Bois de chauffage, coupe rase 20-30 ans. Ex : châtaignier, charme." },
  { value: "agroforesterie", label: "Agroforesterie", icon: Leaf, description: "Arbres dans parcelle agricole, faible densité (40-100/ha)." },
  { value: "haie", label: "Haie / Bocage", icon: Fence, description: "Plantation linéaire, brise-vent, biodiversité, 3-5 plants/m." },
  { value: "bosquet", label: "Bosquet / Îlot boisé", icon: TreeDeciduous, description: "Petit massif boisé < 4 ha, biodiversité, ombre animaux." },
  { value: "verger", label: "Verger fruitier", icon: Apple, description: "Production fruits, gestion individuelle des arbres." },
]

const NATURES: Array<{ value: string; label: string; description: string }> = [
  { value: "replantation_apres_coupe", label: "Replantation après coupe", description: "Replanter après une coupe rase, programmée ou non (scolytes, tempête, etc.)" },
  { value: "boisement", label: "Boisement (terrain nu)", description: "Première plantation sur terrain non boisé (prairie, friche)" },
  { value: "replantation_apres_mortalite", label: "Replantation après mortalité", description: "Remplacer des arbres morts ou improductifs (sécheresse, maladie)" },
  { value: "regarnissage", label: "Regarnissage", description: "Compléter les manquants d'une plantation existante" },
  { value: "renouvellement", label: "Renouvellement progressif", description: "Renouveler progressivement un peuplement (futaie irrégulière)" },
]

const CAUSES: Array<{ value: string; label: string; description: string }> = [
  { value: "premiere_plantation", label: "Première plantation", description: "Plantation sur terrain non boisé (prairie, friche, parcelle nue) — aucune coupe préalable" },
  { value: "coupe_programmee", label: "Coupe rase programmée", description: "Coupe d'exploitation prévue dans le plan de gestion" },
  { value: "scolytes", label: "Scolytes", description: "Attaque parasitaire (épicéa, douglas, sapin, frêne)" },
  { value: "tempete", label: "Tempête / Chablis", description: "Arbres renversés par le vent" },
  { value: "secheresse", label: "Sécheresse / Dépérissement", description: "Mortalité due au stress hydrique ou au changement climatique" },
  { value: "incendie", label: "Incendie", description: "Replantation après destruction par le feu" },
  { value: "maladie", label: "Maladie", description: "Chalarose du frêne, encre du châtaignier, etc." },
  { value: "echec_plantation", label: "Échec plantation précédente", description: "La plantation précédente n'a pas pris" },
  { value: "renouvellement_normal", label: "Renouvellement de cycle", description: "Fin de cycle naturel du peuplement" },
  { value: "autre", label: "Autre", description: "Préciser dans les notes" },
]

const TYPES_PLANT = ["Scion", "Fléché", "Baliveau", "Haute-tige", "Demi-tige", "Basse-tige"] as const
const CONDUITES = ["Gobelet", "Axe central", "Palmette", "Espalier", "Libre"] as const
const LABELS_PROVENANCE = [
  "MFR contrôlé",
  "Végétal Local",
  "Plante Bleue",
  "Pépinière certifiée Bio",
  "Aucun",
] as const

type EssenceItem = {
  source: "forestiere" | "fruitier" | "bocagere"
  id: string
  nom: string
  nomLatin: string
  croissance?: string
  conseils?: string
  porteGreffeRequis?: boolean
}

const STEPS = [
  { label: "Type", icon: Trees },
  { label: "Localisation", icon: MapPin },
  { label: "Essences", icon: Sprout },
  { label: "Calendrier", icon: CalendarClock },
  { label: "Récap", icon: CheckSquare },
] as const

interface WizardState {
  step: number
  nom: string
  typeFormation: TypeFormation | ""
  nature: string
  // Contexte replantation
  cause: string
  peuplementPrecedent: string
  essencePrecedente: string
  ageAvantCoupe: string
  surfacePrecedenteHa: string
  productionBoisId: string
  // Localisation
  parcelleGeoId: string
  zoneVergerId: string
  surfaceHa: string
  essenceId: string
  essenceLibre: string
  varieteOuProvenance: string
  // PROMPT 09 — Champs verger fruitier / agroforesterie fruitière
  porteGreffeId: string
  typePlant: string
  conduite: string
  labelProvenance: string
  nombrePlants: string
  densitePlantsParHa: string
  ecartementRang: string
  ecartementPlant: string
  pepiniere: string
  prixUnitaire: string
  budgetPrevu: string
  datePlantationPrevue: string
  protectionType: string
  objectifs: string
  notes: string
}

const INITIAL: WizardState = {
  step: 1,
  nom: "",
  typeFormation: "",
  nature: "replantation_apres_coupe",
  cause: "",
  peuplementPrecedent: "",
  essencePrecedente: "",
  ageAvantCoupe: "",
  surfacePrecedenteHa: "",
  productionBoisId: "",
  parcelleGeoId: "",
  zoneVergerId: "",
  surfaceHa: "",
  essenceId: "",
  essenceLibre: "",
  varieteOuProvenance: "",
  porteGreffeId: "",
  typePlant: "",
  conduite: "",
  labelProvenance: "",
  nombrePlants: "",
  densitePlantsParHa: "",
  ecartementRang: "",
  ecartementPlant: "",
  pepiniere: "",
  prixUnitaire: "",
  budgetPrevu: "",
  datePlantationPrevue: "",
  protectionType: "",
  objectifs: "",
  notes: "",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  /** État initial pour pré-remplir le wizard (ex: depuis une coupe) */
  prefill?: Partial<WizardState>
}

export function AssistantPlantationDialog({ open, onOpenChange, onSuccess, prefill }: Props) {
  const { toast } = useToast()
  const [state, setState] = React.useState<WizardState>(() => ({ ...INITIAL, ...(prefill || {}) }))
  const [parcelles, setParcelles] = React.useState<Array<{ id: string; nom: string; surface: number | null }>>([])
  const [zonesVerger, setZonesVerger] = React.useState<Array<{ id: number; nom: string }>>([])
  const [coupes, setCoupes] = React.useState<Array<{ id: number; date: string; volumeM3: number | null; arbre: { nom: string; espece: string | null } | null }>>([])
  const [submitting, setSubmitting] = React.useState(false)
  // PROMPT 09 — essences contextuelles (forestières + fruitiers + bocagères)
  const [essencesDispo, setEssencesDispo] = React.useState<EssenceItem[]>([])
  const [portesGreffe, setPortesGreffe] = React.useState<
    Array<{ id: string; nom: string; vigueur: number; precocite: number; notes: string | null }>
  >([])

  React.useEffect(() => {
    if (!open) return
    fetch("/api/parcelles")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setParcelles(Array.isArray(d) ? d : d.data || []))
      .catch(() => setParcelles([]))
    fetch("/api/arbres/zones")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setZonesVerger(Array.isArray(d) ? d : []))
      .catch(() => setZonesVerger([]))
    // Coupes (abattages) pour le workflow "replanter après coupe"
    fetch("/api/arbres/bois?type=abattage")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCoupes(Array.isArray(d) ? d : []))
      .catch(() => setCoupes([]))
  }, [open])

  // Appliquer prefill si fourni à l'ouverture
  React.useEffect(() => {
    if (open && prefill) {
      setState((s) => ({ ...s, ...prefill }))
    }
  }, [open, prefill])

  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setState({ ...INITIAL, ...(prefill || {}) })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, prefill])

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }))

  const canContinue = (): boolean => {
    switch (state.step) {
      case 1:
        return !!state.typeFormation && !!state.nom.trim()
      case 2:
        return true // localisation optionnelle
      case 3:
        return !!state.essenceId || !!state.essenceLibre.trim()
      case 4:
        return !!state.datePlantationPrevue
      default:
        return true
    }
  }

  const next = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, 6) }))
  const prev = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 1) }))

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Résolution du nom d'essence à persister selon la source sélectionnée.
      const selectedItem = essencesDispo.find((e) => e.id === state.essenceId)
      const essenceLibre = selectedItem ? selectedItem.nom : state.essenceLibre || null
      // Si essence fruitière → on persiste aussi son especeId (champ Espece.id).
      const especeIdFruitier =
        selectedItem?.source === "fruitier"
          ? selectedItem.id.replace(/^fruitier::/, "")
          : null

      // Verger : une essence fruitière saisie en libre (ex. Maracuja, absente du
      // catalogue) devient une espèce perso réutilisable, retrouvable ensuite.
      let especeId = especeIdFruitier
      const estContexteFruitier =
        state.typeFormation === "verger" || state.typeFormation === "agroforesterie"
      if (!especeId && estContexteFruitier && state.essenceLibre.trim()) {
        try {
          const r = await fetch("/api/especes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: state.essenceLibre.trim(),
              type: "arbre_fruitier",
              uniteRendement: "kg_arbre",
              vivace: true,
              aPlanifier: false,
            }),
          })
          if (r.ok) {
            const created = await r.json().catch(() => null)
            if (created?.id) especeId = created.id
          }
        } catch {
          // non bloquant : l'arbre gardera l'essence en texte libre.
        }
      }

      const payload = {
        nom: state.nom.trim(),
        typeFormation: state.typeFormation,
        nature: state.nature,
        cause: state.cause || null,
        peuplementPrecedent: state.peuplementPrecedent || null,
        essencePrecedente: state.essencePrecedente || null,
        ageAvantCoupe: state.ageAvantCoupe || null,
        surfacePrecedenteHa: state.surfacePrecedenteHa || null,
        productionBoisId: state.productionBoisId || null,
        parcelleGeoId: state.parcelleGeoId || null,
        zoneVergerId: state.zoneVergerId || null,
        surfaceHa: state.surfaceHa || null,
        especeId,
        essenceLibre,
        varieteOuProvenance: state.varieteOuProvenance || null,
        porteGreffeId: state.porteGreffeId || null,
        typePlant: state.typePlant || null,
        conduite: state.conduite || null,
        labelProvenance: state.labelProvenance || null,
        nombrePlants: state.nombrePlants || null,
        densitePlantsParHa: state.densitePlantsParHa || null,
        ecartementRang: state.ecartementRang || null,
        ecartementPlant: state.ecartementPlant || null,
        pepiniere: state.pepiniere || null,
        prixUnitaire: state.prixUnitaire || null,
        budgetPrevu: state.budgetPrevu || null,
        datePlantationPrevue: state.datePlantationPrevue || null,
        protectionType: state.protectionType || null,
        objectifs: state.objectifs || null,
        notes: state.notes || null,
        genererEtapes: true,
      }
      const res = await fetch("/api/arbres/campagnes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await res.json()
        setState((s) => ({ ...s, step: 6 }))
        onSuccess?.()
      } else {
        const err = await res.json().catch(() => null)
        toast({ title: "Erreur", description: err?.error || "Création impossible", variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur réseau lors de la création de la campagne", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // PROMPT 09 — Charger les essences contextuelles selon typeFormation.
  React.useEffect(() => {
    if (!state.typeFormation) {
      setEssencesDispo([])
      return
    }
    fetch(`/api/verger/essences-disponibles?type=${state.typeFormation}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setEssencesDispo(d.data || []))
      .catch(() => setEssencesDispo([]))
    // reset des sélections dépendantes du type
    setPortesGreffe([])
    if (state.essenceId) update({ essenceId: "", porteGreffeId: "" })
  }, [state.typeFormation]) // eslint-disable-line react-hooks/exhaustive-deps

  // PROMPT 09 — Quand essence fruitière sélectionnée, charger ses porte-greffes.
  const essenceItemSelectionnee = essencesDispo.find((e) => e.id === state.essenceId)
  React.useEffect(() => {
    if (!essenceItemSelectionnee || essenceItemSelectionnee.source !== "fruitier") {
      setPortesGreffe([])
      if (state.porteGreffeId) update({ porteGreffeId: "" })
      return
    }
    const especeId = essenceItemSelectionnee.id.replace(/^fruitier::/, "")
    fetch(`/api/verger/porte-greffes?especeId=${encodeURIComponent(especeId)}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setPortesGreffe(d.data || []))
      .catch(() => setPortesGreffe([]))
  }, [state.essenceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calcul densité par défaut quand on choisit le type
  // Bug densité haie : le référentiel exprime les haies en plants/100m
  // linéaires (100 m ≈ 0,01 ha) alors que le champ est en plants/ha →
  // conversion ×100 à l'injection, sans toucher au fichier data partagé.
  const facteurDensite = state.typeFormation === "haie" ? 100 : 1
  React.useEffect(() => {
    if (!state.typeFormation || state.densitePlantsParHa) return
    const def = DENSITES_DEFAUT[state.typeFormation as TypeFormation]
    if (def) {
      const facteur = state.typeFormation === "haie" ? 100 : 1
      const moyen = Math.round(((def.min + def.max) / 2) * facteur)
      update({ densitePlantsParHa: moyen.toString() })
    }
  }, [state.typeFormation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calcul nombre de plants si surface * densité
  React.useEffect(() => {
    if (state.surfaceHa && state.densitePlantsParHa && !state.nombrePlants) {
      const s = parseFloat(state.surfaceHa)
      const d = parseFloat(state.densitePlantsParHa)
      if (s > 0 && d > 0) update({ nombrePlants: Math.round(s * d).toString() })
    }
  }, [state.surfaceHa, state.densitePlantsParHa]) // eslint-disable-line react-hooks/exhaustive-deps

  const progress = ((state.step - 1) / STEPS.length) * 100

  const aides = state.typeFormation ? getAidesByType(state.typeFormation) : []
  // essencesDispo + porteGreffe désormais dans le state (chargés via API).
  const etapesTypes = state.typeFormation ? ETAPES_TYPES[state.typeFormation as TypeFormation] || [] : []
  const showPorteGreffe = essenceItemSelectionnee?.source === "fruitier"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-green-600" />
            <DialogTitle>
              {state.step === 6 ? "Campagne créée !" : "Assistant Plantation"}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Assistant pas-à-pas pour préparer une campagne de plantation
          </DialogDescription>

          {state.step < 6 && (
            <div className="space-y-2">
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between">
                {STEPS.map((stepDef, index) => {
                  const stepNum = index + 1
                  const isCurrent = stepNum === state.step
                  const isDone = stepNum < state.step
                  const Icon = stepDef.icon
                  return (
                    <div
                      key={stepDef.label}
                      className={`flex flex-col items-center gap-1 text-xs ${isCurrent ? "text-green-600 font-medium" : isDone ? "text-green-500" : "text-muted-foreground"}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isCurrent ? "border-green-500 bg-green-500 text-white" : isDone ? "border-green-500 bg-green-50 text-green-600" : "border-slate-300 bg-white text-slate-400"}`}>
                        {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      </div>
                      <span className="hidden sm:inline">{stepDef.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4">
          {/* Step 1: Type de projet + Nature (replantation ou non) */}
          {state.step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Nom de la campagne <span className="text-red-500">*</span></Label>
                <Input
                  value={state.nom}
                  onChange={(e) => update({ nom: e.target.value })}
                  placeholder="ex: Replantation parcelle Nord 2026"
                />
              </div>
              <div>
                <Label>Nature de l'opération <span className="text-red-500">*</span></Label>
                <Select value={state.nature} onValueChange={(v) => update({ nature: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NATURES.map((n) => (
                      <SelectItem key={n.value} value={n.value}>
                        <div className="flex flex-col">
                          <span>{n.label}</span>
                          <span className="text-xs text-muted-foreground">{n.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de plantation <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {TYPES_PROJET.map(({ value, label, icon: Icon, description }) => {
                    const selected = state.typeFormation === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => update({ typeFormation: value })}
                        className={`text-left p-3 rounded-lg border-2 transition-all ${selected ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-sm">{label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Localisation + Contexte replantation (si applicable) */}
          {state.step === 2 && (
            <div className="space-y-4">
              {/* Bloc Contexte de replantation - affiché uniquement pour les natures de replantation */}
              {(state.nature === "replantation_apres_coupe" || state.nature === "replantation_apres_mortalite") && (
                <Card className="border-amber-300 bg-amber-50/50">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-amber-900">
                      <HelpCircle className="h-4 w-4" />
                      Contexte de la replantation
                    </p>

                    <div>
                      <Label>Cause de la replantation</Label>
                      <Select value={state.cause || "_none"} onValueChange={(v) => update({ cause: v === "_none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Non précisée" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Non précisée</SelectItem>
                          {CAUSES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <div className="flex flex-col">
                                <span>{c.label}</span>
                                <span className="text-xs text-muted-foreground">{c.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {coupes.length > 0 && (
                      <div>
                        <Label>Lier à une coupe / abattage déjà enregistré (optionnel)</Label>
                        <Select value={state.productionBoisId || "_none"} onValueChange={(v) => update({ productionBoisId: v === "_none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Aucune coupe liée" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Aucune coupe</SelectItem>
                            {coupes.slice(0, 30).map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {new Date(c.date).toLocaleDateString("fr-FR")}
                                {c.arbre?.nom ? ` — ${c.arbre.nom}` : ""}
                                {c.volumeM3 ? ` (${c.volumeM3} m³)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Essence précédente</Label>
                        <Input
                          value={state.essencePrecedente}
                          onChange={(e) => update({ essencePrecedente: e.target.value })}
                          placeholder="ex: Épicéa commun"
                        />
                      </div>
                      <div>
                        <Label>Âge au moment de la coupe (années)</Label>
                        <Input
                          type="number"
                          value={state.ageAvantCoupe}
                          onChange={(e) => update({ ageAvantCoupe: e.target.value })}
                          placeholder="ex: 50"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Surface initiale (ha) avant la coupe</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={state.surfacePrecedenteHa}
                        onChange={(e) => update({ surfacePrecedenteHa: e.target.value })}
                        placeholder="ex: 2.5"
                      />
                    </div>

                    <div>
                      <Label>Description du peuplement précédent</Label>
                      <Textarea
                        value={state.peuplementPrecedent}
                        onChange={(e) => update({ peuplementPrecedent: e.target.value })}
                        rows={2}
                        placeholder="ex: Pessière pure de 50 ans, détruite par scolytes. Sol acide, exposition Nord."
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <p className="text-sm text-muted-foreground">
                Rattacher la campagne à une parcelle géoréférencée ou une zone de verger (optionnel).
              </p>

              {parcelles.length > 0 && (
                <div>
                  <Label>Parcelle géoréférencée</Label>
                  <Select value={state.parcelleGeoId || "_none"} onValueChange={(v) => update({ parcelleGeoId: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Aucune parcelle</SelectItem>
                      {parcelles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom}{p.surface ? ` — ${p.surface.toFixed(2)} ha` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {zonesVerger.length > 0 && (
                <div>
                  <Label>Zone de verger</Label>
                  <Select value={state.zoneVergerId || "_none"} onValueChange={(v) => update({ zoneVergerId: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Aucune zone</SelectItem>
                      {zonesVerger.map((z) => (
                        <SelectItem key={z.id} value={String(z.id)}>{z.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Surface à replanter (hectares)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={state.surfaceHa}
                  onChange={(e) => update({ surfaceHa: e.target.value })}
                  placeholder="ex: 1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pour une haie, 100 mètres linéaires ≈ 0,01 ha de reference. La surface sert au calcul de densité.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Essences & densité */}
          {state.step === 3 && (
            <div className="space-y-4">
              <div>
                <Label>Essence principale <span className="text-red-500">*</span></Label>
                {essencesDispo.length === 0 && state.typeFormation && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Chargement des essences disponibles…
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">
                  {essencesDispo.map((e) => {
                    const selected = state.essenceId === e.id
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          update({ essenceId: e.id, essenceLibre: "" })
                          // Auto-remplir densité depuis le référentiel forestier
                          // (seules les essences forestières exposent densitesParHa).
                          if (e.source === "forestiere") {
                            const fid = e.id.replace(/^forestiere::/, "")
                            const forest = ESSENCES_FORESTIERES.find((x) => x.id === fid)
                            if (forest) {
                              const d = forest.densitesParHa
                              if (state.typeFormation === "forestier_futaie" && d.futaie) {
                                update({ densitePlantsParHa: String(Math.round((d.futaie[0] + d.futaie[1]) / 2)) })
                              } else if (state.typeFormation === "forestier_taillis" && d.taillis) {
                                update({ densitePlantsParHa: String(Math.round((d.taillis[0] + d.taillis[1]) / 2)) })
                              } else if (state.typeFormation === "agroforesterie" && d.agroforesterie) {
                                update({ densitePlantsParHa: String(Math.round((d.agroforesterie[0] + d.agroforesterie[1]) / 2)) })
                              }
                            }
                          }
                        }}
                        className={`text-left p-2 rounded-lg border-2 text-sm transition-all ${selected ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{e.nom}</span>
                          {e.source === "fruitier" && (
                            <Badge variant="outline" className="text-[10px] bg-rose-50 border-rose-200 text-rose-700">Fruitier</Badge>
                          )}
                          {e.source === "bocagere" && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">Bocagère</Badge>
                          )}
                        </div>
                        {e.nomLatin && <div className="text-xs text-muted-foreground italic">{e.nomLatin}</div>}
                        {e.croissance && <Badge variant="outline" className="text-xs mt-1">{e.croissance}</Badge>}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3">
                  <Label className="text-xs">Ou saisir une essence libre</Label>
                  <Input
                    value={state.essenceLibre}
                    onChange={(e) => update({ essenceLibre: e.target.value, essenceId: "" })}
                    placeholder="ex: Mélange feuillus, ou nom d'essence non listée"
                  />
                </div>
              </div>

              {essenceItemSelectionnee?.conseils && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3 text-sm flex gap-2">
                    <HelpCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-900">{essenceItemSelectionnee.conseils}</p>
                  </CardContent>
                </Card>
              )}

              {/* Bloc fruitier : porte-greffe + type de plant + conduite */}
              {showPorteGreffe && (
                <Card className="bg-rose-50/40 border-rose-200">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-rose-900">
                      <Apple className="h-4 w-4" />
                      Spécificités fruitier
                    </p>
                    <div>
                      <Label className="text-xs">Porte-greffe</Label>
                      <Select value={state.porteGreffeId} onValueChange={(v) => update({ porteGreffeId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder={portesGreffe.length === 0 ? "Aucun porte-greffe au référentiel pour cette espèce" : "Choisir un porte-greffe"} />
                        </SelectTrigger>
                        <SelectContent>
                          {portesGreffe.map((pg) => (
                            <SelectItem key={pg.id} value={pg.id}>
                              <div className="flex flex-col">
                                <span>{pg.nom}</span>
                                <span className="text-xs text-muted-foreground">Vigueur {pg.vigueur}/5 — Précocité {pg.precocite}/5</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Type de plant</Label>
                        <Select value={state.typePlant} onValueChange={(v) => update({ typePlant: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {TYPES_PLANT.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Conduite</Label>
                        <Select value={state.conduite} onValueChange={(v) => update({ conduite: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {CONDUITES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label>Variété / Provenance</Label>
                <Input
                  value={state.varieteOuProvenance}
                  onChange={(e) => update({ varieteOuProvenance: e.target.value })}
                  placeholder="ex: Chêne sessile RPV Nord, Douglas Washington"
                />
              </div>

              <div>
                <Label>Label de provenance</Label>
                <Select value={state.labelProvenance} onValueChange={(v) => update({ labelProvenance: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {LABELS_PROVENANCE.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Densité (plants/ha)</Label>
                  <Input
                    type="number"
                    value={state.densitePlantsParHa}
                    onChange={(e) => update({ densitePlantsParHa: e.target.value })}
                  />
                  {state.typeFormation && DENSITES_DEFAUT[state.typeFormation as TypeFormation] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommandé : {DENSITES_DEFAUT[state.typeFormation as TypeFormation].min * facteurDensite} - {DENSITES_DEFAUT[state.typeFormation as TypeFormation].max * facteurDensite} plants/ha
                      {state.typeFormation === "haie" && (
                        <> (soit {DENSITES_DEFAUT.haie.min} - {DENSITES_DEFAUT.haie.max} {DENSITES_DEFAUT.haie.unite})</>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Nombre total de plants</Label>
                  <Input
                    type="number"
                    value={state.nombrePlants}
                    onChange={(e) => update({ nombrePlants: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Espacement rang (m)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={state.ecartementRang}
                    onChange={(e) => update({ ecartementRang: e.target.value })}
                    placeholder="ex: 3"
                  />
                </div>
                <div>
                  <Label>Espacement plant (m)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={state.ecartementPlant}
                    onChange={(e) => update({ ecartementPlant: e.target.value })}
                    placeholder="ex: 2"
                  />
                </div>
              </div>

              <div>
                <Label>Pépinière / Fournisseur</Label>
                <Input
                  value={state.pepiniere}
                  onChange={(e) => update({ pepiniere: e.target.value })}
                  placeholder="ex: Pépinières de Normandie"
                />
              </div>
            </div>
          )}

          {/* Step 4: Calendrier */}
          {state.step === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Date prévue de plantation <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={state.datePlantationPrevue}
                  onChange={(e) => update({ datePlantationPrevue: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Le calendrier des etapes (préparation sol, plantation, regarnissage, dégagements) sera généré automatiquement à partir de cette date.
                </p>
              </div>

              {etapesTypes.length > 0 && state.datePlantationPrevue && (
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      Étapes auto-générées pour {state.typeFormation.replace(/_/g, " ")}
                    </p>
                    <div className="space-y-1.5">
                      {etapesTypes.map((etape, idx) => {
                        const baseDate = new Date(state.datePlantationPrevue)
                        const etapeDate = new Date(baseDate.getTime() + etape.offsetJours * 24 * 60 * 60 * 1000)
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                            <span className="text-muted-foreground w-24 flex-shrink-0">
                              {etapeDate.toLocaleDateString("fr-FR")}
                            </span>
                            <span>{etape.libelle}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label>Protection prévue</Label>
                <Select value={state.protectionType || "_none"} onValueChange={(v) => update({ protectionType: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucune</SelectItem>
                    <SelectItem value="manchon">Manchon individuel</SelectItem>
                    <SelectItem value="filet">Filet anti-gibier</SelectItem>
                    <SelectItem value="cloture">Clôture périphérique</SelectItem>
                    <SelectItem value="paillage">Paillage uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Prix unitaire (€/plant)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={state.prixUnitaire}
                  onChange={(e) => {
                    update({ prixUnitaire: e.target.value })
                    // Auto-calcul budget si nombre de plants connu
                    if (state.nombrePlants && e.target.value) {
                      const n = parseInt(state.nombrePlants)
                      const p = parseFloat(e.target.value)
                      if (n > 0 && p > 0) update({ budgetPrevu: (n * p).toFixed(2) })
                    }
                  }}
                  placeholder="ex: 1.20"
                />
              </div>

              <div>
                <Label>Budget total prévu (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={state.budgetPrevu}
                  onChange={(e) => update({ budgetPrevu: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Step 5: Récap */}
          {state.step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vérifiez les informations et créez la campagne.
              </p>

              <Card>
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <Recap label="Nom" value={state.nom} />
                  <Recap label="Type" value={TYPES_PROJET.find((t) => t.value === state.typeFormation)?.label || "—"} />
                  <Recap label="Nature" value={NATURES.find((n) => n.value === state.nature)?.label || "—"} />
                  {(state.nature === "replantation_apres_coupe" || state.nature === "replantation_apres_mortalite") && (
                    <>
                      <Recap label="Cause" value={CAUSES.find((c) => c.value === state.cause)?.label || "—"} />
                      <Recap label="Essence précédente" value={state.essencePrecedente || "—"} />
                    </>
                  )}
                  <Recap label="Surface" value={state.surfaceHa ? `${state.surfaceHa} ha` : "—"} />
                  <Recap label="Essence" value={essenceItemSelectionnee?.nom || state.essenceLibre || "—"} />
                  <Recap label="Variété/Provenance" value={state.varieteOuProvenance || "—"} />
                  {showPorteGreffe && (
                    <>
                      <Recap label="Porte-greffe" value={portesGreffe.find((p) => p.id === state.porteGreffeId)?.nom || "—"} />
                      <Recap label="Type de plant" value={state.typePlant || "—"} />
                      <Recap label="Conduite" value={state.conduite || "—"} />
                    </>
                  )}
                  <Recap label="Label de provenance" value={state.labelProvenance || "—"} />
                  <Recap label="Nombre de plants" value={state.nombrePlants ? Number(state.nombrePlants).toLocaleString("fr-FR") : "—"} />
                  <Recap label="Densité" value={state.densitePlantsParHa ? `${state.densitePlantsParHa}/ha` : "—"} />
                  <Recap label="Date plantation" value={state.datePlantationPrevue ? new Date(state.datePlantationPrevue).toLocaleDateString("fr-FR") : "—"} />
                  <Recap label="Budget" value={state.budgetPrevu ? `${state.budgetPrevu} €` : "—"} />
                </CardContent>
              </Card>

              <div>
                <Label>Objectifs</Label>
                <Input
                  value={state.objectifs}
                  onChange={(e) => update({ objectifs: e.target.value })}
                  placeholder="ex: bois d'oeuvre, biodiversité, brise-vent"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={state.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  rows={2}
                />
              </div>

              {aides.length > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2 text-amber-900">
                      <HelpCircle className="h-4 w-4" />
                      {aides.length} aide{aides.length > 1 ? "s" : ""} financière{aides.length > 1 ? "s" : ""} compatible{aides.length > 1 ? "s" : ""} avec votre projet
                    </p>
                    <ul className="space-y-1 text-xs">
                      {aides.slice(0, 4).map((a) => (
                        <li key={a.id} className="flex items-start gap-2">
                          <Badge variant="outline" className="text-xs flex-shrink-0">{NIVEAU_LIBELLE[a.niveau]}</Badge>
                          <span><strong>{a.nom}</strong> — {a.tauxAide || "Voir conditions"}</span>
                        </li>
                      ))}
                      {aides.length > 4 && <li className="text-muted-foreground">+ {aides.length - 4} autres</li>}
                    </ul>
                    <p className="text-xs mt-2 text-amber-800">
                      → Consulter le catalogue complet depuis la page "Aides à la plantation".
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 6: Succès */}
          {state.step === 6 && (
            <div className="text-center py-8 space-y-4">
              <PartyPopper className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-semibold">Campagne créée !</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Votre campagne de plantation est enregistrée. Le calendrier des etapes a été généré automatiquement.
                Vous pouvez maintenant suivre la progression et enregistrer vos observations de reprise.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" onClick={() => setState({ ...INITIAL, ...(prefill || {}) })}>
                  Nouvelle campagne
                </Button>
                <Button onClick={() => onOpenChange(false)} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  Voir mes campagnes
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        {state.step < 6 && (
          <div className="flex-shrink-0 flex items-center justify-between border-t pt-4">
            <div>
              {state.step > 1 && (
                <Button variant="ghost" onClick={prev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Retour
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-1" />Annuler
              </Button>
              {state.step < 5 ? (
                <Button onClick={next} disabled={!canContinue()}>
                  Suivant<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  {submitting ? "Création..." : "Créer la campagne"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
