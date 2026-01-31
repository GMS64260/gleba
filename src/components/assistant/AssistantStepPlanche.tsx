"use client"

/**
 * Étape 2 : Configuration de la planche
 * - Nouvelle planche : saisie des infos
 * - Planche existante : affichage des infos
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { HelpCircle, LayoutGrid, Ruler } from "lucide-react"
import { TYPES_PLANCHE, TYPES_IRRIGATION } from "@/lib/assistant-helpers"
import type { AssistantMode, PlancheData } from "./AssistantDialog"

interface AssistantStepPlancheProps {
  mode: AssistantMode
  planche: PlancheData
  onPlancheChange: (updates: Partial<PlancheData>) => void
}

export function AssistantStepPlanche({ mode, planche, onPlancheChange }: AssistantStepPlancheProps) {
  const [ilots, setIlots] = React.useState<string[]>([])

  // Charger les îlots existants pour suggestions
  React.useEffect(() => {
    async function fetchIlots() {
      try {
        const res = await fetch('/api/planches?pageSize=200')
        if (res.ok) {
          const data = await res.json()
          const uniqueIlots = [...new Set(
            (data.data || [])
              .map((p: { ilot?: string | null }) => p.ilot)
              .filter(Boolean)
          )] as string[]
          setIlots(uniqueIlots)
        }
      } catch (e) {
        console.error('Error fetching ilots:', e)
      }
    }
    fetchIlots()
  }, [])

  // Calcul automatique de la surface
  const calculatedSurface = React.useMemo(() => {
    if (planche.largeur && planche.longueur) {
      return planche.largeur * planche.longueur
    }
    return null
  }, [planche.largeur, planche.longueur])

  // Mise à jour de la surface calculée
  React.useEffect(() => {
    if (calculatedSurface !== null) {
      onPlancheChange({ surface: calculatedSurface })
    }
  }, [calculatedSurface, onPlancheChange])

  const isNewPlanche = mode === 'new-planche'

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {isNewPlanche ? (
          <>
            {/* Nom de la planche */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="planche-nom">Nom de la planche *</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Un identifiant unique pour cette planche. Ex: "P1", "Potager-Nord", "Serre-1"
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="planche-nom"
                value={planche.nom || ''}
                onChange={(e) => onPlancheChange({ nom: e.target.value, id: e.target.value })}
                placeholder="Ex: P1, Potager-Nord..."
              />
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="planche-largeur">Largeur (m) *</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Largeur de la planche en mètres. Standard maraîcher: 0.75m à 1.20m
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="planche-largeur"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={planche.largeur || ''}
                  onChange={(e) => onPlancheChange({ largeur: parseFloat(e.target.value) || undefined })}
                  placeholder="0.80"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="planche-longueur">Longueur (m) *</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Longueur de la planche en mètres
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="planche-longueur"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={planche.longueur || ''}
                  onChange={(e) => onPlancheChange({ longueur: parseFloat(e.target.value) || undefined })}
                  placeholder="10"
                />
              </div>
            </div>

            {/* Aperçu surface */}
            {calculatedSurface && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <Ruler className="h-5 w-5 text-green-600" />
                    <div>
                      <span className="font-medium">Surface: {calculatedSurface.toFixed(1)} m²</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({planche.largeur} x {planche.longueur} m)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Îlot */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="planche-ilot">Îlot / Zone (optionnel)</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Regroupement de planches. Ex: "Potager", "Serre principale", "Verger"
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="planche-ilot"
                value={planche.ilot || ''}
                onChange={(e) => onPlancheChange({ ilot: e.target.value })}
                placeholder="Ex: Potager, Serre..."
                list="ilots-list"
              />
              {ilots.length > 0 && (
                <datalist id="ilots-list">
                  {ilots.map(i => <option key={i} value={i} />)}
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
                        Type de culture: plein champ (extérieur), serre (chauffée ou non), tunnel...
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={planche.type || ''}
                  onValueChange={(value) => onPlancheChange({ type: value })}
                >
                  <SelectTrigger id="planche-type">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_PLANCHE.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                        Système d'arrosage installé sur cette planche
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={planche.irrigation || ''}
                  onValueChange={(value) => onPlancheChange({ irrigation: value })}
                >
                  <SelectTrigger id="planche-irrigation">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_IRRIGATION.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : (
          /* Affichage planche existante */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-amber-600" />
                {planche.id || planche.nom}
              </CardTitle>
              <CardDescription>Planche sélectionnée</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {planche.ilot && (
                  <div>
                    <span className="text-muted-foreground">Îlot:</span>{' '}
                    <span className="font-medium">{planche.ilot}</span>
                  </div>
                )}
                {planche.surface && (
                  <div>
                    <span className="text-muted-foreground">Surface:</span>{' '}
                    <span className="font-medium">{planche.surface.toFixed(1)} m²</span>
                  </div>
                )}
                {planche.type && (
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-medium">{planche.type}</span>
                  </div>
                )}
                {planche.irrigation && (
                  <div>
                    <span className="text-muted-foreground">Irrigation:</span>{' '}
                    <span className="font-medium">{planche.irrigation}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aide contextuelle */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            {isNewPlanche ? (
              <>
                <strong>Conseil:</strong> Une largeur de 0.80m à 1.20m est idéale pour
                travailler confortablement des deux côtés. Les planches permanentes de
                10m facilitent les rotations.
              </>
            ) : (
              <>
                <strong>Info:</strong> Vous allez ajouter une culture sur cette planche.
                Les informations affichées sont les caractéristiques actuelles de la planche.
              </>
            )}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
