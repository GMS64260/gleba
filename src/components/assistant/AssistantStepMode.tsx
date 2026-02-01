"use client"

/**
 * Étape 1 : Choix du mode
 * - Créer une nouvelle planche
 * - Configurer une planche existante
 * - Ajouter une culture sur une planche
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutGrid, PlusCircle, Sprout } from "lucide-react"
import type { AssistantMode, PlancheData } from "./AssistantDialog"

interface PlancheOption {
  id: string
  ilot: string | null
  surface: number | null
  _count?: { cultures: number }
}

interface AssistantStepModeProps {
  mode: AssistantMode
  plancheId?: string
  onModeChange: (mode: AssistantMode) => void
  onPlancheSelect: (planche: PlancheData) => void
}

export function AssistantStepMode({ mode, plancheId, onModeChange, onPlancheSelect }: AssistantStepModeProps) {
  const [planches, setPlanches] = React.useState<PlancheOption[]>([])
  const [loading, setLoading] = React.useState(false)

  // Charger les planches existantes
  React.useEffect(() => {
    async function fetchPlanches() {
      setLoading(true)
      try {
        const res = await fetch('/api/planches?pageSize=200')
        if (res.ok) {
          const data = await res.json()
          setPlanches(data.data || [])
        }
      } catch (e) {
        console.error('Error fetching planches:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchPlanches()
  }, [])

  const modes = [
    {
      value: 'new-planche' as const,
      label: 'Créer une nouvelle planche',
      description: 'Définir une nouvelle parcelle de culture',
      icon: PlusCircle,
      color: 'bg-green-50 border-green-200 hover:border-green-400',
      iconColor: 'text-green-600',
    },
    {
      value: 'existing-planche' as const,
      label: 'Configurer une planche existante',
      description: 'Modifier ou ajouter une culture',
      icon: LayoutGrid,
      color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
      iconColor: 'text-amber-600',
    },
    {
      value: 'add-culture' as const,
      label: 'Ajouter une culture',
      description: 'Ajouter rapidement une culture sur une planche',
      icon: Sprout,
      color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
      iconColor: 'text-blue-600',
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choisissez ce que vous souhaitez faire. L'assistant vous guidera étape par étape.
      </p>

      <div className="grid gap-3">
        {modes.map((m) => (
          <Card
            key={m.value}
            className={`cursor-pointer transition-all ${m.color} ${
              mode === m.value ? 'ring-2 ring-offset-2 ring-green-500' : ''
            }`}
            onClick={() => onModeChange(m.value)}
          >
            <CardHeader className="py-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white ${m.iconColor}`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
                  <CardDescription className="text-xs">{m.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Sélecteur de planche pour les modes qui en ont besoin */}
      {(mode === 'existing-planche' || mode === 'add-culture') && (
        <div className="pt-4 space-y-2">
          <Label htmlFor="planche-select" className="flex items-center gap-1">
            Sélectionner une planche
            <span className="text-red-500">*</span>
          </Label>
          <Select
            value={plancheId || ''}
            onValueChange={(value) => {
              const planche = planches.find(p => p.id === value)
              if (planche) {
                onPlancheSelect({
                  id: planche.id,
                  nom: planche.id,
                  surface: planche.surface || undefined,
                  ilot: planche.ilot || undefined,
                  isNew: false,
                })
              }
            }}
            disabled={loading}
          >
            <SelectTrigger
              id="planche-select"
              className={!plancheId ? 'border-red-300' : ''}
            >
              <SelectValue placeholder={loading ? "Chargement..." : "Choisir une planche..."} />
            </SelectTrigger>
            <SelectContent>
              {planches.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{p.id}</span>
                    {p.ilot && <span className="text-muted-foreground text-xs">({p.ilot})</span>}
                    {p.surface && <span className="text-muted-foreground text-xs">- {p.surface.toFixed(0)} m²</span>}
                    {p._count && p._count.cultures > 0 && (
                      <span className="text-xs text-green-600">{p._count.cultures} culture(s)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!plancheId && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <span className="font-medium">→</span>
              Veuillez sélectionner une planche pour continuer
            </p>
          )}
          {planches.length === 0 && !loading && (
            <p className="text-sm text-amber-600">
              Aucune planche existante. Créez d'abord une nouvelle planche.
            </p>
          )}
        </div>
      )}

      {/* Aide contextuelle */}
      <div className="mt-6 p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Conseil :</strong> Si vous débutez, commencez par créer une nouvelle planche.
          Vous pourrez ensuite y ajouter des cultures selon vos besoins.
        </p>
      </div>
    </div>
  )
}
