"use client"

/**
 * Étape 6 : Dates et quantités
 * - Mode calculé (depuis ITP) ou saisie manuelle des dates
 * - Validation temps réel de l'occupation de la planche
 * - Estimation du rendement
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangle,
  Calendar,
  Check,
  Grid3X3,
  HelpCircle,
  Ruler,
  Sprout,
  TrendingUp,
  CalendarDays,
  ToggleLeft,
  RefreshCw,
} from "lucide-react"
import { format, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import {
  calculerDatesCulture,
  estimerNombrePlants,
  estimerRendement,
  formatSemaine,
} from "@/lib/assistant-helpers"
import {
  peutAjouterCulture,
  calculerLargeurOccupee,
  suggererAjustements,
} from "@/lib/planche-validation"
import type { CultureData, PlancheData, EspeceData, ITPData } from "./AssistantDialog"

type DateMode = "calculated" | "manual"

interface PlancheValidation {
  possible: boolean
  largeurDisponible: number
  largeurNecessaire: number
  largeurOccupee: number
  largeurPlanche: number
  longueurOk: boolean
  message?: string
  suggestions?: string[]
  loading: boolean
  error?: string
}

interface AssistantStepDatesProps {
  espece: EspeceData | null
  itp: ITPData | null
  culture: CultureData
  planche: PlancheData
  selectedPlancheId: string | null
  mode: string
  onCultureChange: (updates: Partial<CultureData>) => void
}

export function AssistantStepDates({
  espece,
  itp: itpProp,
  culture,
  planche,
  selectedPlancheId,
  mode,
  onCultureChange,
}: AssistantStepDatesProps) {
  const annee = culture.annee || new Date().getFullYear()
  const itp = itpProp || culture.itp

  // --- Local state ---
  const [dateMode, setDateMode] = React.useState<DateMode>("calculated")
  const [nbRangsModifie, setNbRangsModifie] = React.useState(false)
  const [espacementModifie, setEspacementModifie] = React.useState(false)

  // Manual date strings (yyyy-MM-dd format for <input type="date">)
  const [manualSemis, setManualSemis] = React.useState("")
  const [manualPlantation, setManualPlantation] = React.useState("")
  const [manualRecolte, setManualRecolte] = React.useState("")

  // Planche validation state
  const [plancheValidation, setPlancheValidation] = React.useState<PlancheValidation | null>(null)

  // --- Pre-fill nbRangs and espacement from ITP ---
  React.useEffect(() => {
    if (!itp) return
    const updates: Partial<CultureData> = {}
    if (!culture.nbRangs && itp.nbRangs) {
      updates.nbRangs = itp.nbRangs
    }
    if (!culture.espacement && itp.espacement) {
      updates.espacement = Math.round(itp.espacement)
    }
    if (Object.keys(updates).length > 0) {
      onCultureChange(updates)
    }
  }, [itp]) // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if current values match ITP values
  const nbRangsDepuisITP = !nbRangsModifie && !!itp?.nbRangs && culture.nbRangs === itp.nbRangs
  const espacementDepuisITP = !espacementModifie && !!itp?.espacement && culture.espacement === Math.round(itp.espacement)

  // --- Calculated dates from ITP ---
  const datesCalculees = React.useMemo(() => {
    if (!itp) return { dateSemis: null, datePlantation: null, dateRecolte: null }
    return calculerDatesCulture(itp, annee, culture.decalage || 0)
  }, [itp, annee, culture.decalage])

  // Push calculated dates to parent when in calculated mode
  React.useEffect(() => {
    if (dateMode !== "calculated") return
    onCultureChange({
      dateSemis: datesCalculees.dateSemis,
      datePlantation: datesCalculees.datePlantation,
      dateRecolte: datesCalculees.dateRecolte,
    })
  }, [datesCalculees, dateMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Date mode toggle ---
  const handleDateModeChange = (newMode: DateMode) => {
    if (newMode === dateMode) return

    if (newMode === "manual") {
      // Switching to manual: pre-fill manual fields from current dates
      setManualSemis(culture.dateSemis ? format(culture.dateSemis, "yyyy-MM-dd") : "")
      setManualPlantation(culture.datePlantation ? format(culture.datePlantation, "yyyy-MM-dd") : "")
      setManualRecolte(culture.dateRecolte ? format(culture.dateRecolte, "yyyy-MM-dd") : "")
    } else {
      // Switching to calculated: recalculate from ITP
      onCultureChange({
        dateSemis: datesCalculees.dateSemis,
        datePlantation: datesCalculees.datePlantation,
        dateRecolte: datesCalculees.dateRecolte,
      })
    }

    setDateMode(newMode)
  }

  // --- Manual date handlers ---
  const handleManualDateChange = (field: "dateSemis" | "datePlantation" | "dateRecolte", value: string) => {
    switch (field) {
      case "dateSemis":
        setManualSemis(value)
        break
      case "datePlantation":
        setManualPlantation(value)
        break
      case "dateRecolte":
        setManualRecolte(value)
        break
    }
    const date = value ? new Date(value + "T00:00:00") : null
    onCultureChange({ [field]: date })
  }

  // --- Surface and yield calculations ---
  const surface = React.useMemo(() => {
    if (culture.longueur && planche.largeur) {
      return culture.longueur * planche.largeur
    }
    if (planche.surface) {
      return planche.surface
    }
    return 0
  }, [culture.longueur, planche.largeur, planche.surface])

  const nbPlants = React.useMemo(() => {
    return estimerNombrePlants(
      culture.longueur || planche.longueur || 0,
      planche.largeur || 0,
      culture.nbRangs || 1,
      culture.espacement || 30
    )
  }, [culture.longueur, planche.longueur, planche.largeur, culture.nbRangs, culture.espacement])

  const rendement = React.useMemo(() => {
    return estimerRendement(espece?.rendement ?? culture.espece?.rendement, surface)
  }, [espece?.rendement, culture.espece?.rendement, surface])

  // Décalage max from ITP
  const decalageMax = itp?.decalageMax || 4

  // --- Real-time planche validation ---
  const plancheId = selectedPlancheId || planche.id
  // For API URL lookups (expects nom), use planche.nom; for FK, use plancheId (cuid)
  const plancheNom = planche.nom || planche.id
  const hasPlancheDimensions = !!(planche.largeur && planche.longueur)

  React.useEffect(() => {
    let cancelled = false

    async function validatePlanche() {
      // Need either an existing planche ID or new-planche dimensions
      if (!plancheId && !hasPlancheDimensions) {
        setPlancheValidation(null)
        return
      }

      if (!culture.nbRangs) {
        setPlancheValidation(null)
        return
      }

      setPlancheValidation(prev => prev ? { ...prev, loading: true, error: undefined } : {
        possible: true,
        largeurDisponible: 0,
        largeurNecessaire: 0,
        largeurOccupee: 0,
        largeurPlanche: 0,
        longueurOk: true,
        loading: true,
      })

      try {
        let plancheLargeur = planche.largeur || 0.8
        let plancheLongueur = planche.longueur || 10
        let culturesExistantes: Array<{ nbRangs: number; espacementRangs: number }> = []

        // If existing planche, fetch its data for accurate validation
        if (plancheId) {
          const res = await fetch(`/api/planches/${encodeURIComponent(plancheNom || plancheId)}`)
          if (!res.ok) throw new Error("Erreur lors du chargement de la planche")
          if (cancelled) return

          const plancheData = await res.json()
          plancheLargeur = plancheData.largeur || plancheLargeur
          plancheLongueur = plancheData.longueur || plancheLongueur

          culturesExistantes = (plancheData.cultures || [])
            .filter((c: any) => c.terminee === null)
            .map((c: any) => ({
              nbRangs: c.nbRangs || 1,
              espacementRangs: c.itp?.espacementRangs || 30,
            }))
        }

        if (cancelled) return

        const espacementRangs = itp?.espacementRangs || culture.espacement || 30
        const nouvelleCulture = {
          nbRangs: culture.nbRangs || 1,
          espacementRangs,
          longueur: culture.longueur || undefined,
        }

        const validation = peutAjouterCulture(
          { largeur: plancheLargeur, longueur: plancheLongueur },
          culturesExistantes,
          nouvelleCulture
        )

        let suggestions: string[] = []
        if (!validation.possible) {
          const ajustements = suggererAjustements(
            { largeur: plancheLargeur, longueur: plancheLongueur },
            culturesExistantes,
            nouvelleCulture
          )
          suggestions = ajustements.map(s => s.message)
        }

        // Check longueur separately
        const longueurOk = !culture.longueur || culture.longueur <= plancheLongueur

        if (cancelled) return

        setPlancheValidation({
          possible: validation.possible && longueurOk,
          largeurDisponible: validation.largeurDisponible,
          largeurNecessaire: validation.largeurNecessaire,
          largeurOccupee: validation.largeurOccupee,
          largeurPlanche: plancheLargeur,
          longueurOk,
          message: validation.message || (!longueurOk
            ? `Longueur de culture (${culture.longueur}m) supérieure à la planche (${plancheLongueur}m)`
            : undefined),
          suggestions,
          loading: false,
        })
      } catch (err) {
        if (cancelled) return
        setPlancheValidation({
          possible: false,
          largeurDisponible: 0,
          largeurNecessaire: 0,
          largeurOccupee: 0,
          largeurPlanche: 0,
          longueurOk: true,
          loading: false,
          error: err instanceof Error ? err.message : "Erreur de validation",
        })
      }
    }

    validatePlanche()
    return () => { cancelled = true }
  }, [
    plancheId,
    plancheNom,
    hasPlancheDimensions,
    planche.largeur,
    planche.longueur,
    culture.nbRangs,
    culture.espacement,
    culture.longueur,
    itp?.espacementRangs,
  ])

  // --- Helpers for validation display ---
  const getUsagePercent = () => {
    if (!plancheValidation || plancheValidation.loading) return 0
    const total = plancheValidation.largeurPlanche - 0.2 // minus margin
    if (total <= 0) return 100
    const used = plancheValidation.largeurOccupee + plancheValidation.largeurNecessaire
    return Math.min(100, (used / total) * 100)
  }

  const getUsageColor = () => {
    if (!plancheValidation) return "bg-gray-200"
    if (!plancheValidation.possible) return "bg-red-500"
    const pct = getUsagePercent()
    if (pct > 80) return "bg-orange-500"
    return "bg-green-500"
  }

  const getUsageStatus = (): { label: string; variant: "success" | "warning" | "error" } | null => {
    if (!plancheValidation || plancheValidation.loading) return null
    if (plancheValidation.error) return { label: "Erreur de validation", variant: "error" }
    if (!plancheValidation.possible) return { label: "Espace insuffisant", variant: "error" }
    const pct = getUsagePercent()
    if (pct > 80) return { label: "Espace limité", variant: "warning" }
    return { label: "L'espace est suffisant", variant: "success" }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* ====== SECTION 1: DATES ====== */}

        {/* Date Mode Toggle */}
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => handleDateModeChange("calculated")}
            className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-colors font-medium ${
              dateMode === "calculated"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
            Calculer depuis l'ITP
          </button>
          <button
            type="button"
            onClick={() => handleDateModeChange("manual")}
            className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-colors font-medium ${
              dateMode === "manual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ToggleLeft className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
            Saisir manuellement
          </button>
        </div>

        {/* Calculated Mode Controls */}
        {dateMode === "calculated" && (
          <>
            {/* Année */}
            <div className="space-y-2">
              <Label>Année de culture</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={annee}
                  onChange={(e) => onCultureChange({ annee: parseInt(e.target.value) })}
                  className="w-24"
                  min={2020}
                  max={2100}
                />
                <span className="text-sm text-muted-foreground">
                  Semaine actuelle: S{getWeek(new Date(), { weekStartsOn: 1 })}
                </span>
              </div>
            </div>

            {/* Décalage */}
            {itp && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Décalage par rapport à l'ITP</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Décalez les dates de quelques semaines si nécessaire
                          (étalement des récoltes, conditions météo...)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Badge variant="outline">
                    {(culture.decalage || 0) > 0 ? '+' : ''}{culture.decalage || 0} semaine(s)
                  </Badge>
                </div>
                <Slider
                  value={[culture.decalage || 0]}
                  onValueChange={([v]) => onCultureChange({ decalage: v })}
                  min={-decalageMax}
                  max={decalageMax}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>-{decalageMax}s (précoce)</span>
                  <span>+{decalageMax}s (tardif)</span>
                </div>
              </div>
            )}

            {/* Dates calculées display */}
            {!itp ? (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Sélectionnez un ITP pour calculer les dates automatiquement,
                  ou passez en mode "Saisir manuellement".
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    Dates calculées
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-white rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Semis</div>
                      <div className="font-medium text-orange-700">
                        {datesCalculees.dateSemis
                          ? format(datesCalculees.dateSemis, "dd/MM", { locale: fr })
                          : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSemaine(itp?.semaineSemis ? itp.semaineSemis + (culture.decalage || 0) : null)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Plantation</div>
                      <div className="font-medium text-green-700">
                        {datesCalculees.datePlantation
                          ? format(datesCalculees.datePlantation, "dd/MM", { locale: fr })
                          : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSemaine(itp?.semainePlantation ? itp.semainePlantation + (culture.decalage || 0) : null)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Récolte</div>
                      <div className="font-medium text-amber-700">
                        {datesCalculees.dateRecolte
                          ? format(datesCalculees.dateRecolte, "dd/MM", { locale: fr })
                          : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSemaine(itp?.semaineRecolte ? itp.semaineRecolte + (culture.decalage || 0) : null)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Manual Mode Controls */}
        {dateMode === "manual" && (
          <>
            {/* Année (also shown in manual for context) */}
            <div className="space-y-2">
              <Label>Année de culture</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={annee}
                  onChange={(e) => onCultureChange({ annee: parseInt(e.target.value) })}
                  className="w-24"
                  min={2020}
                  max={2100}
                />
                <span className="text-sm text-muted-foreground">
                  Semaine actuelle: S{getWeek(new Date(), { weekStartsOn: 1 })}
                </span>
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Dates manuelles
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="manual-semis" className="text-xs text-muted-foreground">
                      Semis
                    </Label>
                    <Input
                      id="manual-semis"
                      type="date"
                      value={manualSemis}
                      onChange={(e) => handleManualDateChange("dateSemis", e.target.value)}
                      className="text-sm"
                    />
                    {manualSemis && (
                      <p className="text-xs text-muted-foreground text-center">
                        {formatSemaine(getWeek(new Date(manualSemis + "T00:00:00"), { weekStartsOn: 1 }))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manual-plantation" className="text-xs text-muted-foreground">
                      Plantation
                    </Label>
                    <Input
                      id="manual-plantation"
                      type="date"
                      value={manualPlantation}
                      onChange={(e) => handleManualDateChange("datePlantation", e.target.value)}
                      className="text-sm"
                    />
                    {manualPlantation && (
                      <p className="text-xs text-muted-foreground text-center">
                        {formatSemaine(getWeek(new Date(manualPlantation + "T00:00:00"), { weekStartsOn: 1 }))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manual-recolte" className="text-xs text-muted-foreground">
                      Récolte
                    </Label>
                    <Input
                      id="manual-recolte"
                      type="date"
                      value={manualRecolte}
                      onChange={(e) => handleManualDateChange("dateRecolte", e.target.value)}
                      className="text-sm"
                    />
                    {manualRecolte && (
                      <p className="text-xs text-muted-foreground text-center">
                        {formatSemaine(getWeek(new Date(manualRecolte + "T00:00:00"), { weekStartsOn: 1 }))}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ====== SECTION 2: QUANTITÉS ====== */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="nbRangs" className="flex items-center gap-1">
                Nombre de rangs
                <span className="text-red-500">*</span>
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Nombre de lignes de plants sur la planche
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="nbRangs"
              type="number"
              min={1}
              max={20}
              value={culture.nbRangs || ''}
              onChange={(e) => {
                setNbRangsModifie(true)
                onCultureChange({ nbRangs: parseInt(e.target.value) || undefined })
              }}
              placeholder={itp?.nbRangs?.toString() || '1'}
              className={!culture.nbRangs && !itp?.nbRangs ? 'border-red-300 focus:border-red-500' : ''}
            />
            {nbRangsDepuisITP && (
              <p className="text-xs text-blue-600">depuis l'ITP</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="longueur" className="flex items-center gap-1">
                Longueur cultivée (m)
                <span className="text-red-500">*</span>
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Longueur de planche utilisée pour cette culture
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="longueur"
              type="number"
              step="0.5"
              min={0.5}
              value={culture.longueur || ''}
              onChange={(e) => onCultureChange({ longueur: parseFloat(e.target.value) || undefined })}
              placeholder={planche.longueur?.toString() || '10'}
              className={!culture.longueur ? 'border-red-300 focus:border-red-500' : ''}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="espacement" className="flex items-center gap-1">
              Espacement entre plants (cm)
              <span className="text-red-500">*</span>
            </Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Distance entre chaque plant sur le rang
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="espacement"
            type="number"
            min={5}
            max={200}
            value={culture.espacement || ''}
            onChange={(e) => {
              setEspacementModifie(true)
              onCultureChange({ espacement: parseInt(e.target.value) || undefined })
            }}
            placeholder={itp?.espacement?.toString() || '30'}
            className={!culture.espacement && !itp?.espacement ? 'border-red-300 focus:border-red-500' : ''}
          />
          {espacementDepuisITP && (
            <p className="text-xs text-blue-600">depuis l'ITP</p>
          )}
        </div>

        {/* ====== SECTION 3: PLANCHE VALIDATION INDICATOR ====== */}
        {(plancheId || hasPlancheDimensions) && culture.nbRangs && (
          <PlancheValidationIndicator
            validation={plancheValidation}
            usagePercent={getUsagePercent()}
            usageColor={getUsageColor()}
            status={getUsageStatus()}
          />
        )}

        {/* ====== SECTION 4: ESTIMATIONS ====== */}
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Estimations
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <Ruler className="h-3 w-3" />
                  Surface
                </div>
                <div className="font-medium">{surface.toFixed(1)} m²</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <Sprout className="h-3 w-3" />
                  Plants
                </div>
                <div className="font-medium">{nbPlants}</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Rendement
                </div>
                <div className="font-medium">
                  {rendement > 0 ? `~${rendement.toFixed(1)} kg` : '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

// --- Sub-component: Planche Validation Indicator ---

function PlancheValidationIndicator({
  validation,
  usagePercent,
  usageColor,
  status,
}: {
  validation: PlancheValidation | null
  usagePercent: number
  usageColor: string
  status: { label: string; variant: "success" | "warning" | "error" } | null
}) {
  if (!validation) return null

  // Loading state
  if (validation.loading) {
    return (
      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  // Error state
  if (validation.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erreur de validation</AlertTitle>
        <AlertDescription className="text-xs">
          {validation.error}
        </AlertDescription>
      </Alert>
    )
  }

  const statusColorMap = {
    success: {
      border: "border-green-200",
      bg: "bg-green-50",
      icon: "text-green-600",
      text: "text-green-700",
    },
    warning: {
      border: "border-orange-200",
      bg: "bg-orange-50",
      icon: "text-orange-600",
      text: "text-orange-700",
    },
    error: {
      border: "border-red-200",
      bg: "bg-red-50",
      icon: "text-red-600",
      text: "text-red-700",
    },
  }

  const colors = status ? statusColorMap[status.variant] : statusColorMap.success

  const totalUsable = validation.largeurPlanche - 0.2
  const usedByExisting = validation.largeurOccupee
  const usedByNew = validation.largeurNecessaire
  const existingPct = totalUsable > 0 ? Math.min(100, (usedByExisting / totalUsable) * 100) : 0
  const newPct = totalUsable > 0 ? Math.min(100 - existingPct, (usedByNew / totalUsable) * 100) : 0

  return (
    <div className={`space-y-2 p-3 border rounded-lg ${colors.border} ${colors.bg}`}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status?.variant === "success" && <Check className={`h-4 w-4 ${colors.icon}`} />}
          {status?.variant === "warning" && <AlertTriangle className={`h-4 w-4 ${colors.icon}`} />}
          {status?.variant === "error" && <AlertTriangle className={`h-4 w-4 ${colors.icon}`} />}
          <span className={`text-sm font-medium ${colors.text}`}>
            {status?.label || "Validation planche"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {(usedByExisting + usedByNew).toFixed(2)}m / {totalUsable.toFixed(2)}m utilisé
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
        {usedByExisting > 0 && (
          <div
            className="h-full bg-gray-400 transition-all duration-300"
            style={{ width: `${existingPct}%` }}
            title={`Cultures existantes: ${usedByExisting.toFixed(2)}m`}
          />
        )}
        <div
          className={`h-full ${usageColor} transition-all duration-300`}
          style={{ width: `${newPct}%` }}
          title={`Cette culture: ${usedByNew.toFixed(2)}m`}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        {usedByExisting > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-gray-400" />
            Existant ({usedByExisting.toFixed(2)}m)
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className={`w-2.5 h-2.5 rounded-sm ${usageColor}`} />
          Cette culture ({usedByNew.toFixed(2)}m)
        </div>
      </div>

      {/* Suggestions if not possible */}
      {!validation.possible && validation.suggestions && validation.suggestions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-red-200">
          <p className="text-xs font-medium text-red-700 mb-1">Suggestions :</p>
          <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
            {validation.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warning message for non-length-related issues */}
      {validation.message && !validation.possible && (
        <p className="text-xs text-red-600 mt-1">{validation.message}</p>
      )}
    </div>
  )
}
