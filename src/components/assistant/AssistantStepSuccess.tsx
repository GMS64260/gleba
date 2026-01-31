"use client"

/**
 * Étape 8 : Confirmation de succès
 * - Message de succès
 * - Actions suivantes
 */

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ExternalLink, Home, Plus, Sprout } from "lucide-react"

interface AssistantStepSuccessProps {
  cultureId?: number
  plancheId?: string
  onAddAnother: () => void
  onClose: () => void
}

export function AssistantStepSuccess({
  cultureId,
  plancheId,
  onAddAnother,
  onClose,
}: AssistantStepSuccessProps) {
  return (
    <div className="space-y-6 text-center py-4">
      {/* Icône de succès */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <Sprout className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>

      {/* Message */}
      <div>
        <h3 className="text-lg font-semibold text-green-700 mb-2">
          Culture créée avec succès !
        </h3>
        <p className="text-sm text-muted-foreground">
          Votre culture a été enregistrée et apparaît maintenant dans votre liste.
        </p>
      </div>

      {/* Références */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {cultureId && (
              <div>
                <span className="text-muted-foreground">Culture:</span>{' '}
                <span className="font-medium">#{cultureId}</span>
              </div>
            )}
            {plancheId && (
              <div>
                <span className="text-muted-foreground">Planche:</span>{' '}
                <span className="font-medium">{plancheId}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        {cultureId && (
          <Link href={`/cultures/${cultureId}`} className="block">
            <Button variant="default" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir la culture
            </Button>
          </Link>
        )}

        <Button
          variant="outline"
          onClick={onAddAnother}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une autre culture
        </Button>

        <Button
          variant="ghost"
          onClick={onClose}
          className="w-full"
        >
          <Home className="h-4 w-4 mr-2" />
          Retour au tableau de bord
        </Button>
      </div>

      {/* Conseil */}
      <div className="p-3 bg-green-50 rounded-lg border border-green-200 mt-6">
        <p className="text-xs text-green-700">
          <strong>Prochaine étape:</strong> Pensez à marquer votre culture comme "semée"
          quand vous aurez effectué le semis. L'application suivra automatiquement
          l'avancement de votre culture.
        </p>
      </div>
    </div>
  )
}
