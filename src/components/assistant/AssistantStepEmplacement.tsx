"use client"

/**
 * Etape fusionnee : Emplacement
 * Combine le choix du mode (new-planche, existing-planche, add-culture)
 * et la configuration de la planche dans un seul ecran scrollable.
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Plus,
  Map,
  Zap,
  ChevronDown,
  ChevronUp,
  Ruler,
  Droplets,
  Info,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  HelpCircle,
} from "lucide-react"
import {
  PRESETS_DIMENSIONS_PLANCHE,
  TYPES_PLANCHE,
  TYPES_IRRIGATION,
  PLANCHE_DEFAUT_LARGEUR,
  PLANCHE_DEFAUT_LONGUEUR,
} from "@/lib/assistant-helpers"
import type { PlancheData } from "./AssistantDialog"

// ---------- Types ----------

interface PlancheOption {
  id: string
  nom: string
  ilot: string | null
  surface: number | null
  largeur: number | null
  longueur: number | null
  type: string | null
  irrigation: string | null
  _count?: { cultures: number }
}

interface AssistantStepEmplacementProps {
  mode: "new-planche" | "existing-planche" | "add-culture"
  planche: PlancheData
  selectedPlancheId: string | null
  planches: any[]
  onModeChange: (mode: string) => void
  onPlancheChange: (data: Partial<PlancheData>) => void
  onSelectedPlancheIdChange: (id: string | null) => void
}

// ---------- Mode cards definition ----------

const MODES = [
  {
    value: "new-planche" as const,
    label: "Nouvelle planche",
    description: "Creer une planche et y ajouter une culture",
    icon: Plus,
    color: "bg-green-50 border-green-200 hover:border-green-400",
    iconColor: "text-green-600",
    ringColor: "ring-green-500",
  },
  {
    value: "existing-planche" as const,
    label: "Planche existante",
    description: "Ajouter une culture sur une planche existante",
    icon: LayoutGrid,
    color: "bg-amber-50 border-amber-200 hover:border-amber-400",
    iconColor: "text-amber-600",
    ringColor: "ring-amber-500",
  },
  {
    value: "add-culture" as const,
    label: "Ajout rapide",
    description: "Ajouter rapidement une culture sur une planche",
    icon: Zap,
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    iconColor: "text-blue-600",
    ringColor: "ring-blue-500",
  },
] as const

// ---------- Component ----------

export function AssistantStepEmplacement({
  mode,
  planche,
  selectedPlancheId,
  planches: externalPlanches,
  onModeChange,
  onPlancheChange,
  onSelectedPlancheIdChange,
}: AssistantStepEmplacementProps) {
  // Local state
  const [planches, setPlanches] = React.useState<PlancheOption[]>([])
  const [ilots, setIlots] = React.useState<string[]>([])
  const [plancheCount, setPlancheCount] = React.useState<number>(0)
  const [loading, setLoading] = React.useState(false)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [solOpen, setSolOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const defaultsAppliedRef = React.useRef(false)
  const nameAppliedRef = React.useRef(false)

  // ---------- Data fetching ----------

  const fetchPlanches = React.useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/planches?pageSize=200")
      if (!res.ok) throw new Error("Erreur serveur")
      const data = await res.json()
      const list: PlancheOption[] = data.data || []
      setPlanches(list)
      setPlancheCount(data.total || 0)

      const uniqueIlots = [
        ...new Set(
          list
            .map((p) => p.ilot)
            .filter(Boolean) as string[]
        ),
      ]
      setIlots(uniqueIlots)
    } catch (e) {
      console.error("Error fetching planches:", e)
      setFetchError("Impossible de charger les planches.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPlanches()
  }, [fetchPlanches])

  // ---------- Default values for new-planche ----------

  React.useEffect(() => {
    if (mode === "new-planche" && !defaultsAppliedRef.current) {
      defaultsAppliedRef.current = true
      const updates: Partial<PlancheData> = {}
      if (!planche.largeur) updates.largeur = PLANCHE_DEFAUT_LARGEUR
      if (!planche.longueur) updates.longueur = PLANCHE_DEFAUT_LONGUEUR
      if (Object.keys(updates).length > 0) {
        onPlancheChange(updates)
      }
    }
  }, [mode, planche.largeur, planche.longueur, onPlancheChange])

  // Auto-suggest planche name
  React.useEffect(() => {
    if (mode === "new-planche" && !planche.nom && !nameAppliedRef.current && plancheCount >= 0 && !loading) {
      nameAppliedRef.current = true
      onPlancheChange({ nom: `Planche ${plancheCount + 1}` })
    }
  }, [plancheCount, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Computed ----------

  const calculatedSurface = React.useMemo(() => {
    if (planche.largeur && planche.longueur) {
      return planche.largeur * planche.longueur
    }
    return null
  }, [planche.largeur, planche.longueur])

  React.useEffect(() => {
    if (calculatedSurface !== null) {
      onPlancheChange({ surface: calculatedSurface })
    }
  }, [calculatedSurface, onPlancheChange])

  // Apply a dimension preset
  const applyPreset = (preset: (typeof PRESETS_DIMENSIONS_PLANCHE)[number]) => {
    onPlancheChange({ largeur: preset.largeur, longueur: preset.longueur })
  }

  // Selected planche details
  const selectedPlanche = React.useMemo(() => {
    if (!selectedPlancheId) return null
    return planches.find((p) => p.id === selectedPlancheId) || null
  }, [selectedPlancheId, planches])

  // Filtered planches for search
  const filteredPlanches = React.useMemo(() => {
    if (!searchQuery.trim()) return planches
    const q = searchQuery.toLowerCase()
    return planches.filter(
      (p) =>
        (p.nom || p.id).toLowerCase().includes(q) ||
        (p.ilot && p.ilot.toLowerCase().includes(q))
    )
  }, [planches, searchQuery])

  // ---------- Handlers ----------

  const handlePlancheSelect = (plancheId: string) => {
    const p = planches.find((pl) => pl.id === plancheId)
    if (p) {
      onSelectedPlancheIdChange(plancheId)
      onPlancheChange({
        id: p.id,
        nom: p.nom || p.id,
        surface: p.surface || undefined,
        ilot: p.ilot || undefined,
        largeur: p.largeur || undefined,
        longueur: p.longueur || undefined,
        type: p.type || undefined,
        irrigation: p.irrigation || undefined,
        isNew: false,
      })
    }
  }

  // ---------- Render ----------

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ===== Section 1: Mode de creation ===== */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">Mode de creation</Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODES.map((m) => (
              <Card
                key={m.value}
                className={`cursor-pointer transition-all ${m.color} ${
                  mode === m.value
                    ? `ring-2 ring-offset-2 ${m.ringColor}`
                    : ""
                }`}
                onClick={() => onModeChange(m.value)}
              >
                <CardHeader className="p-3">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div
                      className={`p-2 rounded-lg bg-white ${m.iconColor}`}
                    >
                      <m.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {m.label}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {m.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* ===== Section 2: Configuration ===== */}
        <div className="space-y-4 transition-all duration-300 ease-in-out">
          {mode === "new-planche" && (
            <NewPlancheForm
              planche={planche}
              ilots={ilots}
              calculatedSurface={calculatedSurface}
              solOpen={solOpen}
              onSolToggle={() => setSolOpen(!solOpen)}
              onPlancheChange={onPlancheChange}
              onApplyPreset={applyPreset}
            />
          )}

          {(mode === "existing-planche" || mode === "add-culture") && (
            <ExistingPlancheSelector
              loading={loading}
              fetchError={fetchError}
              planches={filteredPlanches}
              allPlanchesCount={planches.length}
              selectedPlancheId={selectedPlancheId}
              selectedPlanche={selectedPlanche}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handlePlancheSelect}
              onRetry={fetchPlanches}
              onSwitchToNew={() => onModeChange("new-planche")}
            />
          )}
        </div>

        {/* ===== Aide contextuelle ===== */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            {mode === "new-planche" ? (
              <>
                <strong>Conseil :</strong> Une largeur de 0.80m a 1.20m est
                ideale pour travailler confortablement des deux cotes. Les
                planches permanentes de 10m facilitent les rotations.
              </>
            ) : (
              <>
                <strong>Conseil :</strong> Si vous debutez, commencez par
                creer une nouvelle planche. Vous pourrez ensuite y ajouter des
                cultures selon vos besoins.
              </>
            )}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ============================================================
// Sub-component: New Planche Form
// ============================================================

interface NewPlancheFormProps {
  planche: PlancheData
  ilots: string[]
  calculatedSurface: number | null
  solOpen: boolean
  onSolToggle: () => void
  onPlancheChange: (updates: Partial<PlancheData>) => void
  onApplyPreset: (preset: (typeof PRESETS_DIMENSIONS_PLANCHE)[number]) => void
}

function NewPlancheForm({
  planche,
  ilots,
  calculatedSurface,
  solOpen,
  onSolToggle,
  onPlancheChange,
  onApplyPreset,
}: NewPlancheFormProps) {
  return (
    <div className="space-y-4">
      {/* Nom de la planche */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="planche-nom" className="flex items-center gap-1">
            Nom de la planche
            <span className="text-red-500">*</span>
          </Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Un identifiant unique pour cette planche. Ex: &quot;P1&quot;,
                &quot;Potager-Nord&quot;, &quot;Serre-1&quot;
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          id="planche-nom"
          value={planche.nom || ""}
          onChange={(e) => onPlancheChange({ nom: e.target.value })}
          placeholder="Ex: P1, Potager-Nord..."
          className={!planche.nom ? "border-red-300 focus:border-red-500" : ""}
        />
      </div>

      {/* Presets de dimensions */}
      <div className="space-y-2">
        <Label className="text-sm">Dimensions rapides</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS_DIMENSIONS_PLANCHE.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant={
                planche.largeur === preset.largeur &&
                planche.longueur === preset.longueur
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => onApplyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Dimensions cote a cote */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="planche-largeur" className="flex items-center gap-1">
              Largeur (m)
              <span className="text-red-500">*</span>
            </Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Largeur de la planche en metres. Standard maraicher: 0.75m a
                  1.20m
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="planche-largeur"
            type="number"
            step="0.1"
            min="0.1"
            value={planche.largeur || ""}
            onChange={(e) =>
              onPlancheChange({
                largeur: parseFloat(e.target.value) || undefined,
              })
            }
            placeholder="0.80"
            className={
              !planche.largeur ? "border-red-300 focus:border-red-500" : ""
            }
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="planche-longueur" className="flex items-center gap-1">
              Longueur (m)
              <span className="text-red-500">*</span>
            </Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Longueur de la planche en metres
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="planche-longueur"
            type="number"
            step="0.5"
            min="0.5"
            value={planche.longueur || ""}
            onChange={(e) =>
              onPlancheChange({
                longueur: parseFloat(e.target.value) || undefined,
              })
            }
            placeholder="10"
            className={
              !planche.longueur ? "border-red-300 focus:border-red-500" : ""
            }
          />
        </div>
      </div>

      {/* Surface auto-calculee */}
      {calculatedSurface !== null && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-100 border border-gray-200">
          <Ruler className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <span className="font-medium">
              Surface : {calculatedSurface.toFixed(1)} m²
            </span>
            <span className="text-sm text-muted-foreground ml-2">
              ({planche.largeur} x {planche.longueur} m)
            </span>
          </div>
        </div>
      )}

      {/* Ilot / Zone */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="planche-ilot">Ilot / Zone (optionnel)</Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Regroupement de planches. Ex: &quot;Potager&quot;, &quot;Serre
                principale&quot;, &quot;Verger&quot;
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          id="planche-ilot"
          value={planche.ilot || ""}
          onChange={(e) => onPlancheChange({ ilot: e.target.value })}
          placeholder="Ex: Potager, Serre..."
          list="ilots-list"
        />
        {ilots.length > 0 && (
          <datalist id="ilots-list">
            {ilots.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        )}
      </div>

      {/* Type et Irrigation */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="planche-type">Type</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Type de culture: plein champ (exterieur), serre (chauffee ou
                  non), tunnel...
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={planche.type || ""}
            onValueChange={(value) => onPlancheChange({ type: value })}
          >
            <SelectTrigger id="planche-type">
              <SelectValue placeholder="Selectionner..." />
            </SelectTrigger>
            <SelectContent>
              {TYPES_PLANCHE.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="planche-irrigation">Irrigation</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Systeme d&apos;arrosage installe sur cette planche
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={planche.irrigation || ""}
            onValueChange={(value) => onPlancheChange({ irrigation: value })}
          >
            <SelectTrigger id="planche-irrigation">
              <SelectValue placeholder="Selectionner..." />
            </SelectTrigger>
            <SelectContent>
              {TYPES_IRRIGATION.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Collapsible: Qualite du sol */}
      <div className="border rounded-lg">
        <button
          type="button"
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors rounded-lg"
          onClick={onSolToggle}
        >
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <span>Qualite du sol (optionnel)</span>
          </div>
          {solOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {solOpen && (
          <div className="px-4 pb-4 space-y-4 border-t">
            <div className="grid grid-cols-2 gap-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="type-sol">Type de sol</Label>
                <Select
                  value={planche.typeSol || ""}
                  onValueChange={(value) =>
                    onPlancheChange({
                      typeSol: value,
                      retentionEau: undefined,
                    })
                  }
                >
                  <SelectTrigger id="type-sol" className="text-sm">
                    <SelectValue placeholder="Non renseigne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Argileux">Argileux (lourd)</SelectItem>
                    <SelectItem value="Limoneux">
                      Limoneux (equilibre)
                    </SelectItem>
                    <SelectItem value="Sableux">Sableux (leger)</SelectItem>
                    <SelectItem value="Mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retention-eau">Retention eau</Label>
                <Select
                  value={planche.retentionEau || ""}
                  onValueChange={(value) =>
                    onPlancheChange({ retentionEau: value })
                  }
                >
                  <SelectTrigger id="retention-eau" className="text-sm">
                    <SelectValue placeholder="Non renseigne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Faible">Faible (arroser+)</SelectItem>
                    <SelectItem value="Moyenne">Moyenne</SelectItem>
                    <SelectItem value="Élevée">Elevee (arroser-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
              <strong>Astuce</strong> : Sol sableux (leger) = arrosage
              frequent. Sol argileux (lourd) = arrosage espace.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Sub-component: Existing Planche Selector
// ============================================================

interface ExistingPlancheSelectorProps {
  loading: boolean
  fetchError: string | null
  planches: PlancheOption[]
  allPlanchesCount: number
  selectedPlancheId: string | null
  selectedPlanche: PlancheOption | null
  searchQuery: string
  onSearchChange: (q: string) => void
  onSelect: (plancheId: string) => void
  onRetry: () => void
  onSwitchToNew: () => void
}

function ExistingPlancheSelector({
  loading,
  fetchError,
  planches,
  allPlanchesCount,
  selectedPlancheId,
  selectedPlanche,
  searchQuery,
  onSearchChange,
  onSelect,
  onRetry,
  onSwitchToNew,
}: ExistingPlancheSelectorProps) {
  // Error state
  if (fetchError) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{fetchError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reessayer
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-3">
        <Label>Selectionner une planche</Label>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // No planches
  if (allPlanchesCount === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-amber-50 border border-amber-200 text-center">
          <Info className="h-8 w-8 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Aucune planche creee
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Vous devez d&apos;abord creer une planche avant de pouvoir y
              ajouter une culture.
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={onSwitchToNew}
            className="mt-1"
          >
            <Plus className="h-4 w-4 mr-1" />
            Creer une nouvelle planche
          </Button>
        </div>
      </div>
    )
  }

  // Normal selector
  return (
    <div className="space-y-4">
      {/* Search + Select */}
      <div className="space-y-2">
        <Label htmlFor="planche-select" className="flex items-center gap-1">
          Selectionner une planche
          <span className="text-red-500">*</span>
        </Label>

        {/* Search input for filtering */}
        {allPlanchesCount > 8 && (
          <Input
            placeholder="Rechercher une planche..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="mb-2"
          />
        )}

        <Select
          value={selectedPlancheId || ""}
          onValueChange={onSelect}
        >
          <SelectTrigger
            id="planche-select"
            className={!selectedPlancheId ? "border-red-300" : ""}
          >
            <SelectValue placeholder="Choisir une planche..." />
          </SelectTrigger>
          <SelectContent>
            {planches.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{p.nom || p.id}</span>
                  {p.ilot && (
                    <span className="text-muted-foreground text-xs">
                      ({p.ilot})
                    </span>
                  )}
                  {p.surface != null && (
                    <span className="text-muted-foreground text-xs">
                      - {p.surface.toFixed(0)} m²
                    </span>
                  )}
                  {p._count && p._count.cultures > 0 && (
                    <span className="text-xs text-green-600">
                      {p._count.cultures} culture(s)
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
            {planches.length === 0 && searchQuery && (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                Aucun resultat pour &quot;{searchQuery}&quot;
              </div>
            )}
          </SelectContent>
        </Select>

        {!selectedPlancheId && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <span className="font-medium">-&gt;</span>
            Veuillez selectionner une planche pour continuer
          </p>
        )}
      </div>

      {/* Info card showing selected planche details */}
      {selectedPlanche && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LayoutGrid className="h-4 w-4 text-amber-600" />
              {selectedPlanche.nom || selectedPlanche.id}
            </CardTitle>
            <CardDescription className="text-xs">
              Planche selectionnee
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {selectedPlanche.ilot && (
                <div>
                  <span className="text-muted-foreground">Ilot :</span>{" "}
                  <span className="font-medium">{selectedPlanche.ilot}</span>
                </div>
              )}
              {selectedPlanche.largeur && selectedPlanche.longueur && (
                <div>
                  <span className="text-muted-foreground">Dimensions :</span>{" "}
                  <span className="font-medium">
                    {selectedPlanche.largeur} x {selectedPlanche.longueur} m
                  </span>
                </div>
              )}
              {selectedPlanche.surface != null && (
                <div>
                  <span className="text-muted-foreground">Surface :</span>{" "}
                  <span className="font-medium">
                    {selectedPlanche.surface.toFixed(1)} m²
                  </span>
                </div>
              )}
              {selectedPlanche.type && (
                <div>
                  <span className="text-muted-foreground">Type :</span>{" "}
                  <span className="font-medium">{selectedPlanche.type}</span>
                </div>
              )}
              {selectedPlanche.irrigation && (
                <div>
                  <span className="text-muted-foreground">Irrigation :</span>{" "}
                  <span className="font-medium">
                    {selectedPlanche.irrigation}
                  </span>
                </div>
              )}
              {selectedPlanche._count && selectedPlanche._count.cultures > 0 && (
                <div>
                  <span className="text-muted-foreground">Cultures :</span>{" "}
                  <Badge variant="secondary" className="text-xs">
                    {selectedPlanche._count.cultures}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
