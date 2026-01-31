"use client"

/**
 * Étape 5 : Sélection de la variété (optionnel)
 * - Liste des variétés pour l'espèce
 * - Infos sur le stock
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Leaf, Package, ShoppingBag, Sparkles, X } from "lucide-react"
import type { VarieteData } from "./AssistantDialog"

interface AssistantStepVarieteProps {
  especeId?: string
  selectedId?: string | null
  onSelect: (variete: VarieteData | null) => void
}

export function AssistantStepVariete({ especeId, selectedId, onSelect }: AssistantStepVarieteProps) {
  const [varietes, setVarietes] = React.useState<VarieteData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [skipVariete, setSkipVariete] = React.useState(selectedId === null)

  // Charger les variétés pour l'espèce
  React.useEffect(() => {
    async function fetchVarietes() {
      if (!especeId) return

      setLoading(true)
      try {
        const res = await fetch(`/api/varietes?especeId=${encodeURIComponent(especeId)}&pageSize=50`)
        if (res.ok) {
          const data = await res.json()
          setVarietes(data.data || [])
        }
      } catch (e) {
        console.error('Error fetching varietes:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchVarietes()
  }, [especeId])

  // Gérer le skip
  const handleSkipChange = (checked: boolean) => {
    setSkipVariete(checked)
    if (checked) {
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
              const hasStock = (v.stockGraines && v.stockGraines > 0) || (v.stockPlants && v.stockPlants > 0)

              return (
                <Card
                  key={v.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
                  }`}
                  onClick={() => onSelect(v)}
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
                          </div>
                          {v.fournisseurId && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              {v.fournisseurId}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stock */}
                      <div className="text-right">
                        {hasStock ? (
                          <div className="text-xs space-y-1">
                            {v.stockGraines && v.stockGraines > 0 && (
                              <div className="flex items-center gap-1 text-green-600">
                                <Package className="h-3 w-3" />
                                {v.stockGraines}g graines
                              </div>
                            )}
                            {v.stockPlants && v.stockPlants > 0 && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Sparkles className="h-3 w-3" />
                                {v.stockPlants} plants
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600">
                            Stock vide
                          </Badge>
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
                onClick={() => onSelect(null)}
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
