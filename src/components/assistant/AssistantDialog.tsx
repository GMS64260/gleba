"use client"

/**
 * Assistant Maraîcher - Dialog principal
 * Guide pas-à-pas pour créer une planche et/ou une culture
 */

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight, X, Wand2 } from "lucide-react"

import { AssistantStepMode } from "./AssistantStepMode"
import { AssistantStepPlanche } from "./AssistantStepPlanche"
import { AssistantStepEspece } from "./AssistantStepEspece"
import { AssistantStepITP } from "./AssistantStepITP"
import { AssistantStepVariete } from "./AssistantStepVariete"
import { AssistantStepDates } from "./AssistantStepDates"
import { AssistantStepRecap } from "./AssistantStepRecap"
import { AssistantStepSuccess } from "./AssistantStepSuccess"

// Types pour l'état de l'assistant
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
  step: number
  mode: AssistantMode
  planche: PlancheData
  culture: CultureData
  createdPlancheId?: string
  createdCultureId?: number
}

const INITIAL_STATE: AssistantState = {
  step: 1,
  mode: null,
  planche: {},
  culture: {
    annee: new Date().getFullYear(),
    decalage: 0,
  },
}

const STORAGE_KEY = 'gleba-assistant-state'

// Noms des étapes
const STEP_NAMES: Record<number, string> = {
  1: "Mode",
  2: "Planche",
  3: "Espèce",
  4: "ITP",
  5: "Variété",
  6: "Dates",
  7: "Récap",
  8: "Terminé",
}

interface AssistantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssistantDialog({ open, onOpenChange }: AssistantDialogProps) {
  // État principal
  const [state, setState] = React.useState<AssistantState>(INITIAL_STATE)

  // Fonctions de navigation
  const nextStep = () => {
    setState(prev => {
      let nextStepNum = prev.step + 1

      // Skip étape planche si mode "add-culture" et planche déjà sélectionnée
      if (nextStepNum === 2 && prev.mode === 'add-culture' && prev.planche.id) {
        nextStepNum = 3
      }

      return { ...prev, step: nextStepNum }
    })
  }

  const prevStep = () => {
    setState(prev => {
      let prevStepNum = prev.step - 1

      // Skip étape planche si mode "add-culture"
      if (prevStepNum === 2 && prev.mode === 'add-culture') {
        prevStepNum = 1
      }

      return { ...prev, step: Math.max(1, prevStepNum) }
    })
  }

  const updateState = (updates: Partial<AssistantState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  const updatePlanche = (updates: Partial<PlancheData>) => {
    setState(prev => ({
      ...prev,
      planche: { ...prev.planche, ...updates },
    }))
  }

  const updateCulture = (updates: Partial<CultureData>) => {
    setState(prev => ({
      ...prev,
      culture: { ...prev.culture, ...updates },
    }))
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setState(INITIAL_STATE)
  }

  const handleClose = () => {
    // Garder l'état pour reprise
    onOpenChange(false)
  }

  const handleReset = () => {
    reset()
    onOpenChange(false)
  }

  // Calcul de la progression
  const totalSteps = 8
  const progressPercent = ((state.step - 1) / (totalSteps - 1)) * 100

  // Titre dynamique
  const getTitle = () => {
    switch (state.step) {
      case 1: return "Que souhaitez-vous faire ?"
      case 2: return state.mode === 'new-planche' ? "Créer une nouvelle planche" : "Choisir une planche"
      case 3: return "Choisir une espèce à cultiver"
      case 4: return "Choisir l'itinéraire technique"
      case 5: return "Choisir une variété (optionnel)"
      case 6: return "Dates et quantités"
      case 7: return "Récapitulatif"
      case 8: return "Culture créée !"
      default: return "Assistant"
    }
  }

  // Vérifier si l'étape actuelle est valide pour continuer
  const canContinue = () => {
    switch (state.step) {
      case 1:
        // Mode doit être sélectionné
        if (!state.mode) return false
        // Si mode nécessite planche existante, elle doit être sélectionnée
        if (state.mode === 'existing-planche' || state.mode === 'add-culture') {
          return !!state.planche.id
        }
        return true
      case 2: return state.planche.id || (state.planche.nom && state.planche.largeur && state.planche.longueur)
      case 3: return !!state.culture.especeId
      case 4: return !!state.culture.itpId
      case 5: return true // Variété optionnelle
      case 6: return true // Dates calculées automatiquement
      case 7: return true // Récap toujours valide
      default: return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="h-5 w-5 text-green-600" />
            <DialogTitle>{getTitle()}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Assistant pas-à-pas pour créer une culture
          </DialogDescription>

          {/* Indicateur de progression */}
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(step => (
                <span
                  key={step}
                  className={`${
                    step === state.step
                      ? 'font-medium text-green-600'
                      : step < state.step
                        ? 'text-green-500'
                        : ''
                  }`}
                >
                  {step <= state.step ? STEP_NAMES[step] : ''}
                </span>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Contenu de l'étape */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {state.step === 1 && (
            <AssistantStepMode
              mode={state.mode}
              plancheId={state.planche.id}
              onModeChange={(mode) => updateState({ mode })}
              onPlancheSelect={(planche) => updatePlanche(planche)}
            />
          )}
          {state.step === 2 && (
            <AssistantStepPlanche
              mode={state.mode}
              planche={state.planche}
              onPlancheChange={updatePlanche}
            />
          )}
          {state.step === 3 && (
            <AssistantStepEspece
              selectedId={state.culture.especeId}
              onSelect={(espece) => updateCulture({
                especeId: espece.id,
                espece,
                // Reset ITP et variété si espèce change
                itpId: undefined,
                itp: undefined,
                varieteId: undefined,
                variete: undefined,
              })}
            />
          )}
          {state.step === 4 && (
            <AssistantStepITP
              especeId={state.culture.especeId}
              selectedId={state.culture.itpId}
              onSelect={(itp) => updateCulture({
                itpId: itp.id,
                itp,
                nbRangs: itp.nbRangs || undefined,
                espacement: itp.espacement || undefined,
              })}
            />
          )}
          {state.step === 5 && (
            <AssistantStepVariete
              especeId={state.culture.especeId}
              selectedId={state.culture.varieteId}
              onSelect={(variete) => updateCulture({
                varieteId: variete?.id || null,
                variete: variete || null,
              })}
            />
          )}
          {state.step === 6 && (
            <AssistantStepDates
              culture={state.culture}
              planche={state.planche}
              onCultureChange={updateCulture}
            />
          )}
          {state.step === 7 && (
            <AssistantStepRecap
              state={state}
              onSuccess={(plancheId, cultureId) => {
                updateState({
                  step: 8,
                  createdPlancheId: plancheId,
                  createdCultureId: cultureId,
                })
                localStorage.removeItem(STORAGE_KEY)
              }}
            />
          )}
          {state.step === 8 && (
            <AssistantStepSuccess
              cultureId={state.createdCultureId}
              plancheId={state.createdPlancheId}
              onAddAnother={() => {
                setState({
                  ...INITIAL_STATE,
                  mode: state.mode,
                  planche: state.planche,
                })
              }}
              onClose={handleReset}
            />
          )}
        </div>

        {/* Footer avec navigation */}
        {state.step < 8 && (
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
              {state.step < 7 && (
                <Button onClick={nextStep} disabled={!canContinue()}>
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

// Bouton pour ouvrir l'assistant (à utiliser dans les headers)
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
