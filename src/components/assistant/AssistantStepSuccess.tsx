"use client"

/**
 * Etape 5 : Confirmation de succes
 * - Message de succes
 * - Lien vers la culture
 * - Action "Marquer comme semee"
 * - Boutons pour ajouter une autre culture ou fermer
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
      {/* Icone de succes */}
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
          Culture creee avec succes !
        </h3>
        <p className="text-sm text-muted-foreground">
          Votre culture a ete enregistree et apparait maintenant dans votre liste.
        </p>
      </div>

      {/* References */}
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

        {cultureId && (
          <Link href={`/cultures/${cultureId}`} className="block">
            <Button variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50">
              <Sprout className="h-4 w-4 mr-2" />
              Marquer comme semee
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

      {/* Conseil actionnable */}
      <div className="p-3 bg-green-50 rounded-lg border border-green-200 mt-6">
        <p className="text-xs text-green-700">
          <strong>Prochaine etape :</strong> Rendez-vous sur la fiche de la culture
          pour marquer le semis comme effectue. L'application calculera automatiquement
          les dates de plantation et de recolte a partir de ce moment.
          Vous pouvez aussi suivre l'avancement depuis le tableau de bord.
        </p>
      </div>
    </div>
  )
}
