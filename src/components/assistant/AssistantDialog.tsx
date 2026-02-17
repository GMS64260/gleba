"use client"

/**
 * Assistant Maraîcher - Dialog principal
 * Guide pas-à-pas en 5 étapes pour créer une planche et/ou une culture
 *
 * Flow: Emplacement -> Plante -> Planning -> Récapitulatif -> Terminé
 */

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  X,
  Wand2,
  MapPin,
  Leaf,
  Calendar,
  CheckSquare,
  PartyPopper,
  Check,
  RotateCcw,
} from "lucide-react"

import { AssistantStepEmplacement } from "./AssistantStepEmplacement"
import { AssistantStepPlante } from "./AssistantStepPlante"
import { AssistantStepDates } from "./AssistantStepDates"
import { AssistantStepRecap } from "./AssistantStepRecap"
import { AssistantStepSuccess } from "./AssistantStepSuccess"

// ---- Types pour l'état de l'assistant ----

export type AssistantMode = 'new-planche' | 'existing-planche' | 'add-culture' | null

export interface PlancheData {
  id?: string
  nom?: string
  largeur?: number
  longueur?: number
  surface?: number
  ilot?: string
  type?: string
  irrigation?: string
  typeSol?: string
  retentionEau?: string
  isNew?: boolean
}

export interface EspeceData {
  id: string
  type?: string
  familleId?: string
  famille?: { id: string; couleur?: string | null }
  nomLatin?: string
  rendement?: number | null
  besoinEau?: number | null
  irrigation?: string | null
  niveau?: string | null
  categorie?: string | null
  itps?: ITPData[]
}

export interface ITPData {
  id: string
  especeId?: string
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
  dureeRecolte?: number | null
  dureePepiniere?: number | null
  dureeCulture?: number | null
  nbRangs?: number | null
  espacement?: number | null
  espacementRangs?: number | null
  typePlanche?: string | null
  notes?: string | null
  decalageMax?: number | null
  nbGrainesPlant?: number | null
}

export interface VarieteData {
  id: string
  especeId: string
  fournisseurId?: string | null
  stockGraines?: number | null
  stockPlants?: number | null
  userStockGraines?: number | null
  userStockPlants?: number | null
  bio?: boolean
}

export interface CultureData {
  especeId?: string
  espece?: EspeceData
  itpId?: string
  itp?: ITPData
  varieteId?: string | null
  variete?: VarieteData | null
  plancheId?: string
  annee?: number
  dateSemis?: Date | null
  datePlantation?: Date | null
  dateRecolte?: Date | null
  nbRangs?: number
  longueur?: number
  espacement?: number
  decalage?: number
}

export interface AssistantState {
  step: number // 1-5
  mode: 'new-planche' | 'existing-planche' | 'add-culture'
  planche: PlancheData
  selectedPlancheId: string | null
  espece: EspeceData | null
  itp: ITPData | null
  variete: VarieteData | null
  skipVariete: boolean
  culture: CultureData
  cultureId: number | null
  plancheId: string | null
}

const INITIAL_STATE: AssistantState = {
  step: 1,
  mode: 'new-planche',
  planche: {},
  selectedPlancheId: null,
  espece: null,
  itp: null,
  variete: null,
  skipVariete: false,
  culture: {
    annee: new Date().getFullYear(),
    decalage: 0,
  },
  cultureId: null,
  plancheId: null,
}

const STORAGE_KEY = 'gleba-assistant-state'

// ---- Steps definition ----

const STEPS = [
  { label: 'Emplacement', icon: MapPin },
  { label: 'Plante', icon: Leaf },
  { label: 'Planning', icon: Calendar },
  { label: 'Recapitulatif', icon: CheckSquare },
  { label: 'Termine', icon: PartyPopper },
] as const

// ---- Props ----

interface AssistantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---- Serialisation helpers ----
// Dates are serialised as ISO strings by JSON.stringify; we need to
// revive them when restoring from localStorage.

function reviveDates(state: any): AssistantState {
  const dateFields: (keyof CultureData)[] = ['dateSemis', 'datePlantation', 'dateRecolte']
  if (state.culture) {
    for (const field of dateFields) {
      if (typeof state.culture[field] === 'string') {
        state.culture[field] = new Date(state.culture[field])
      }
    }
  }
  return state as AssistantState
}

// ---- Component ----

export function AssistantDialog({ open, onOpenChange }: AssistantDialogProps) {
  const [state, setState] = React.useState<AssistantState>(INITIAL_STATE)
  const [restored, setRestored] = React.useState(false)

  // Data fetched on mount
  const [especes, setEspeces] = React.useState<EspeceData[]>([])
  const [planches, setPlanches] = React.useState<any[]>([])

  // ---- Data fetching ----

  React.useEffect(() => {
    if (!open) return

    // Fetch especes and planches in parallel
    const fetchEspeces = fetch('/api/especes?pageSize=500')
      .then(res => res.ok ? res.json() : { data: [] })
      .then(data => setEspeces(data.data || []))
      .catch(() => setEspeces([]))

    const fetchPlanches = fetch('/api/planches?pageSize=200')
      .then(res => res.ok ? res.json() : { data: [] })
      .then(data => setPlanches(data.data || []))
      .catch(() => setPlanches([]))
  }, [open])

  // ---- localStorage Persistence ----

  // Restore from localStorage on mount
  React.useEffect(() => {
    if (!open) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const revived = reviveDates(parsed)
        // Only restore if not on success step
        if (revived.step < 5) {
          setState(revived)
          setRestored(true)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [open])

  // Save state on every change (except step 5)
  React.useEffect(() => {
    if (state.step < 5) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  // ---- Navigation ----

  const nextStep = () => {
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, 5) }))
  }

  const prevStep = () => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }))
  }

  const goToStep = (step: number) => {
    // Only allow going back to completed steps (not forward)
    if (step < state.step) {
      setState(prev => ({ ...prev, step }))
    }
  }

  // ---- State updaters ----

  const handleModeChange = React.useCallback((mode: string) => {
    setState(prev => ({ ...prev, mode: mode as AssistantState['mode'] }))
  }, [])

  const handlePlancheChange = React.useCallback((data: Partial<PlancheData>) => {
    setState(prev => ({ ...prev, planche: { ...prev.planche, ...data } }))
  }, [])

  const handleSelectedPlancheIdChange = React.useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedPlancheId: id }))
  }, [])

  const handleEspeceChange = React.useCallback((espece: EspeceData | null) => {
    setState(prev => ({
      ...prev,
      espece,
      itp: null,
      variete: null,
      culture: {
        ...prev.culture,
        especeId: espece?.id,
        espece: espece || undefined,
        itpId: undefined,
        itp: undefined,
        varieteId: undefined,
        variete: undefined,
      },
    }))
  }, [])

  const handleItpChange = React.useCallback((itp: ITPData | null) => {
    setState(prev => ({
      ...prev,
      itp,
      culture: {
        ...prev.culture,
        itpId: itp?.id,
        itp: itp || undefined,
        nbRangs: itp?.nbRangs || prev.culture.nbRangs,
        espacement: itp?.espacement ? Math.round(itp.espacement) : prev.culture.espacement,
      },
    }))
  }, [])

  const handleVarieteChange = React.useCallback((variete: VarieteData | null) => {
    setState(prev => ({
      ...prev,
      variete,
      culture: {
        ...prev.culture,
        varieteId: variete?.id || null,
        variete: variete || null,
      },
    }))
  }, [])

  const handleSkipVarieteChange = React.useCallback((skip: boolean) => {
    setState(prev => ({ ...prev, skipVariete: skip }))
  }, [])

  const updateCulture = React.useCallback((updates: Partial<CultureData>) => {
    setState(prev => ({
      ...prev,
      culture: { ...prev.culture, ...updates },
    }))
  }, [])

  // ---- canContinue logic ----

  const canContinue = (step: number): boolean => {
    switch (step) {
      case 1: {
        if (!state.mode) return false
        if (state.mode === 'existing-planche' || state.mode === 'add-culture') {
          return !!state.selectedPlancheId
        }
        if (state.mode === 'new-planche') {
          return !!(state.planche.nom && state.planche.largeur && state.planche.largeur > 0 && state.planche.longueur && state.planche.longueur > 0)
        }
        return true
      }
      case 2:
        return !!state.espece
      case 3:
        return true // Dates auto-calculated, validation is informational
      case 4:
        return true // Has its own create button
      default:
        return false
    }
  }

  // ---- Reset ----

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setState(INITIAL_STATE)
    setRestored(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleReset = () => {
    reset()
    onOpenChange(false)
  }

  const handleClearAndRestart = () => {
    reset()
  }

  // ---- Success handler ----

  const handleSuccess = (plancheId?: string, cultureId?: number) => {
    localStorage.removeItem(STORAGE_KEY)
    setState(prev => ({
      ...prev,
      step: 5,
      plancheId: plancheId || null,
      cultureId: cultureId ? Number(cultureId) : null,
    }))
  }

  // ---- Close from success ----

  const handleCloseFromSuccess = () => {
    localStorage.removeItem(STORAGE_KEY)
    reset()
    onOpenChange(false)
  }

  // ---- Progress ----

  const progressPercent = ((state.step - 1) / (STEPS.length - 1)) * 100

  // ---- Title ----

  const getTitle = (): string => {
    switch (state.step) {
      case 1: return "Emplacement"
      case 2: return "Choisir une plante"
      case 3: return "Planning"
      case 4: return "Recapitulatif"
      case 5: return "Culture creee !"
      default: return "Assistant"
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] !flex !flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="h-5 w-5 text-green-600" />
            <DialogTitle>{getTitle()}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Assistant pas-a-pas pour creer une culture
          </DialogDescription>

          {/* Restored session banner */}
          {restored && state.step < 5 && (
            <div className="flex items-center justify-between gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span>Session precedente restauree.</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                onClick={handleClearAndRestart}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Recommencer
              </Button>
            </div>
          )}

          {/* Progress bar - 5 steps */}
          <div className="space-y-2">
            {/* Step indicator bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Step labels */}
            <div className="flex justify-between">
              {STEPS.map((stepDef, index) => {
                const stepNum = index + 1
                const isCurrent = stepNum === state.step
                const isCompleted = stepNum < state.step
                const isClickable = isCompleted

                return (
                  <button
                    key={stepDef.label}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && goToStep(stepNum)}
                    className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                      isClickable ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      isCurrent
                        ? 'text-green-600 font-medium'
                        : isCompleted
                          ? 'text-green-500 hover:text-green-700'
                          : 'text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-colors ${
                        isCurrent
                          ? 'border-green-500 bg-green-500 text-white'
                          : isCompleted
                            ? 'border-green-500 bg-green-50 text-green-600'
                            : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <stepDef.icon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="hidden sm:inline">{stepDef.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Content area with scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-4 pr-4">
            {/* Step 1: Emplacement */}
            {state.step === 1 && (
              <AssistantStepEmplacement
                mode={state.mode}
                planche={state.planche}
                selectedPlancheId={state.selectedPlancheId}
                planches={planches}
                onModeChange={handleModeChange}
                onPlancheChange={handlePlancheChange}
                onSelectedPlancheIdChange={handleSelectedPlancheIdChange}
              />
            )}

            {/* Step 2: Plante */}
            {state.step === 2 && (
              <AssistantStepPlante
                especes={especes}
                espece={state.espece}
                itp={state.itp}
                variete={state.variete}
                skipVariete={state.skipVariete}
                onEspeceChange={handleEspeceChange}
                onItpChange={handleItpChange}
                onVarieteChange={handleVarieteChange}
                onSkipVarieteChange={handleSkipVarieteChange}
                onCultureChange={updateCulture}
              />
            )}

            {/* Step 3: Planning / Dates */}
            {state.step === 3 && (
              <AssistantStepDates
                espece={state.espece}
                itp={state.itp}
                culture={state.culture}
                planche={state.planche}
                selectedPlancheId={state.selectedPlancheId || state.planche.id || null}
                mode={state.mode || ''}
                onCultureChange={updateCulture}
              />
            )}

            {/* Step 4: Recap */}
            {state.step === 4 && (
              <AssistantStepRecap
                state={state}
                onSuccess={handleSuccess}
              />
            )}

            {/* Step 5: Success */}
            {state.step === 5 && (
              <AssistantStepSuccess
                cultureId={state.cultureId ?? undefined}
                plancheId={state.plancheId ?? undefined}
                onAddAnother={() => {
                  const preservedMode = state.mode
                  const preservedPlanche = state.planche
                  const preservedSelectedPlancheId = state.selectedPlancheId
                  reset()
                  setState(prev => ({
                    ...prev,
                    mode: preservedMode,
                    planche: preservedPlanche,
                    selectedPlancheId: preservedSelectedPlancheId,
                  }))
                }}
                onClose={handleCloseFromSuccess}
              />
            )}
          </div>
        </div>

        {/* Footer navigation - hidden on success step */}
        {state.step < 5 && (
          <div className="flex-shrink-0 flex items-center justify-between border-t pt-4">
            <div>
              {state.step > 1 && (
                <Button variant="ghost" onClick={prevStep}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Retour
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleReset} size="sm">
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              {state.step < 4 && (
                <Button onClick={nextStep} disabled={!canContinue(state.step)}>
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Bouton pour ouvrir l'assistant (a utiliser dans les headers)
export function AssistantButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
    >
      <Wand2 className="h-4 w-4" />
      <span className="hidden sm:inline">Assistant</span>
    </Button>
  )
}
