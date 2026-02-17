"use client"

/**
 * Étape 5 : Sélection de la variété (optionnel)
 * - Liste des variétés pour l'espèce, triées par stock décroissant
 * - Auto-sélection de la variété avec le meilleur stock
 * - Badges "En stock" / "Rupture"
 */

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Leaf, Package, ShoppingBag, Sparkles, X, Zap } from "lucide-react"
import type { VarieteData } from "./AssistantDialog"

interface AssistantStepVarieteProps {
  especeId?: string
  selectedId?: string | null
  onSelect: (variete: VarieteData | null) => void
}

/**
 * Calcule le stock total d'une variété.
 * Priorité au stock per-user (userStockGraines/userStockPlants),
 * fallback sur le stock global (stockGraines/stockPlants).
 */
function getTotalStock(v: VarieteData): number {
  const graines = v.userStockGraines ?? v.stockGraines ?? 0
  const plants = v.userStockPlants ?? v.stockPlants ?? 0
  return graines + plants
}

/** Retourne le stock graines effectif (user > global) */
function getEffectiveGraines(v: VarieteData): number {
  return v.userStockGraines ?? v.stockGraines ?? 0
}

/** Retourne le stock plants effectif (user > global) */
function getEffectivePlants(v: VarieteData): number {
  return v.userStockPlants ?? v.stockPlants ?? 0
}

export function AssistantStepVariete({ especeId, selectedId, onSelect }: AssistantStepVarieteProps) {
  const [varietes, setVarietes] = React.useState<VarieteData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [skipVariete, setSkipVariete] = React.useState(selectedId === null)
  const [autoSelected, setAutoSelected] = React.useState(false)

  // Charger les variétés pour l'espèce
  React.useEffect(() => {
    async function fetchVarietes() {
      if (!especeId) return

      setLoading(true)
      setAutoSelected(false)
      try {
        const res = await fetch(`/api/varietes?especeId=${encodeURIComponent(especeId)}&pageSize=50`)
        if (res.ok) {
          const data = await res.json()
          const raw: VarieteData[] = data.data || []

          // Trier : variétés avec stock en premier, puis par stock total décroissant
          const sorted = [...raw].sort((a, b) => {
            const hasA = (getEffectiveGraines(a) > 0 || getEffectivePlants(a) > 0) ? 1 : 0
            const hasB = (getEffectiveGraines(b) > 0 || getEffectivePlants(b) > 0) ? 1 : 0
            // D'abord celles avec stock, puis par stock décroissant
            if (hasA !== hasB) return hasB - hasA
            return getTotalStock(b) - getTotalStock(a)
          })

          setVarietes(sorted)

          // Auto-sélection : seulement si aucune sélection existante et pas en mode skip
          if (!selectedId && sorted.length > 0) {
            const best = sorted[0]
            if (getEffectiveGraines(best) > 0 || getEffectivePlants(best) > 0) {
              onSelect(best)
              setAutoSelected(true)
            }
          }
        }
      } catch (e) {
        console.error('Error fetching varietes:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchVarietes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especeId])

  // Quand l'utilisateur change manuellement la sélection, désactiver le message d'auto-sélection
  const handleSelect = (v: VarieteData) => {
    setAutoSelected(false)
    onSelect(v)
  }

  const handleClear = () => {
    setAutoSelected(false)
    onSelect(null)
  }

  // Gérer le skip
  const handleSkipChange = (checked: boolean) => {
    setSkipVariete(checked)
    if (checked) {
      setAutoSelected(false)
      onSelect(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Chargement des variétés...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {varietes.length === 0
          ? "Aucune variété enregistrée pour cette espèce."
          : `${varietes.length} variété(s) disponible(s). Cette étape est optionnelle.`}
      </p>

      {/* Message d'auto-sélection */}
      {autoSelected && selectedId && !skipVariete && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Zap className="h-4 w-4 flex-shrink-0" />
          <span>Sélection automatique : meilleur stock disponible</span>
        </div>
      )}

      {/* Option pour passer */}
      <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
        <Checkbox
          id="skip-variete"
          checked={skipVariete}
          onCheckedChange={handleSkipChange}
        />
        <Label
          htmlFor="skip-variete"
          className="text-sm cursor-pointer flex-1"
        >
          Je ne connais pas encore la variété
        </Label>
      </div>

      {!skipVariete && varietes.length > 0 && (
        <ScrollArea className="h-[260px] pr-4">
          <div className="space-y-2">
            {varietes.map(v => {
              const isSelected = selectedId === v.id
              const stockGraines = getEffectiveGraines(v)
              const stockPlants = getEffectivePlants(v)
              const hasGraines = stockGraines > 0
              const hasPlants = stockPlants > 0
              const hasStock = hasGraines || hasPlants

              return (
                <Card
                  key={v.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
                  }`}
                  onClick={() => handleSelect(v)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${v.bio ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Leaf className={`h-4 w-4 ${v.bio ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {v.id}
                            {v.bio && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                Bio
                              </Badge>
                            )}
                            {/* Badge stock */}
                            {hasStock ? (
                              <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 border-green-300" variant="outline">
                                {hasGraines && hasPlants
                                  ? "En stock"
                                  : hasGraines
                                    ? "En stock (graines)"
                                    : "En stock (plants)"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-500 border-gray-300 bg-gray-50">
                                Rupture
                              </Badge>
                            )}
                          </div>
                          {v.fournisseurId && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              {v.fournisseurId}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Détail du stock */}
                      <div className="text-right">
                        {hasStock ? (
                          <div className="text-xs space-y-1">
                            {stockGraines > 0 && (
                              <div className="flex items-center gap-1 text-green-600">
                                <Package className="h-3 w-3" />
                                {stockGraines}g graines
                              </div>
                            )}
                            {stockPlants > 0 && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Sparkles className="h-3 w-3" />
                                {stockPlants} plants
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Stock vide
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {!skipVariete && varietes.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
          <Package className="h-8 w-8 mb-2 opacity-50" />
          <p>Aucune variété disponible</p>
          <p className="text-xs mt-2">
            Vous pouvez continuer sans variété
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => handleSkipChange(true)}
          >
            Continuer sans variété
          </Button>
        </div>
      )}

      {/* Sélection actuelle */}
      {selectedId && !skipVariete && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-2 px-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                Variété sélectionnée: <strong>{selectedId}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aide */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Conseil:</strong> Choisir une variété permet de suivre votre stock de semences.
          Si vous n'avez pas encore décidé, vous pourrez modifier ce choix plus tard.
        </p>
      </div>
    </div>
  )
}
