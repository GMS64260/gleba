"use client"

/**
 * Étape 4 : Sélection de l'ITP (Itinéraire Technique de Plante)
 * - Comparaison des ITPs disponibles
 * - Informations sur les périodes
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CalendarDays, Clock, Grid3X3, Info, Sprout } from "lucide-react"
import { formatSemaine } from "@/lib/assistant-helpers"
import type { ITPData } from "./AssistantDialog"

interface AssistantStepITPProps {
  especeId?: string
  selectedId?: string
  onSelect: (itp: ITPData) => void
}

export function AssistantStepITP({ especeId, selectedId, onSelect }: AssistantStepITPProps) {
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [loading, setLoading] = React.useState(true)

  // Charger les ITPs pour l'espèce
  React.useEffect(() => {
    async function fetchItps() {
      if (!especeId) return

      setLoading(true)
      try {
        const res = await fetch(`/api/itps?especeId=${encodeURIComponent(especeId)}&pageSize=50`)
        if (res.ok) {
          const data = await res.json()
          setItps(data.data || [])

          // Auto-sélection si un seul ITP
          if (data.data?.length === 1 && !selectedId) {
            onSelect(data.data[0])
          }
        }
      } catch (e) {
        console.error('Error fetching ITPs:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchItps()
  }, [especeId, selectedId, onSelect])

  // Détermine le type de culture
  const getTypeCulture = (itp: ITPData): string => {
    if (itp.semaineSemis && itp.semainePlantation && itp.dureePepiniere) {
      return 'Semis en pépinière'
    }
    if (itp.semaineSemis && !itp.semainePlantation) {
      return 'Semis direct'
    }
    if (itp.semainePlantation && !itp.semaineSemis) {
      return 'Plantation directe'
    }
    return 'Non défini'
  }

  // Calcule la durée totale estimée
  const getDureeEstimee = (itp: ITPData): string | null => {
    if (itp.dureeCulture) {
      return `${itp.dureeCulture} jours`
    }
    if (itp.semaineSemis && itp.semaineRecolte) {
      const semaines = itp.semaineRecolte - itp.semaineSemis
      if (semaines > 0) {
        return `~${semaines} semaines`
      }
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Chargement des itinéraires...
      </div>
    )
  }

  if (itps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <Info className="h-8 w-8 mb-2 opacity-50" />
        <p>Aucun itinéraire technique trouvé pour cette espèce</p>
        <p className="text-xs mt-2">
          Vous pouvez en créer un dans la section ITPs
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {itps.length === 1
          ? "Un seul itinéraire disponible pour cette espèce:"
          : `${itps.length} itinéraires disponibles. Choisissez celui qui correspond à votre situation:`}
      </p>

      <ScrollArea className="h-[320px] pr-4">
        <div className="space-y-3">
          {itps.map(itp => {
            const isSelected = selectedId === itp.id
            const typeCulture = getTypeCulture(itp)
            const duree = getDureeEstimee(itp)

            return (
              <Card
                key={itp.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
                onClick={() => onSelect(itp)}
              >
                <CardHeader className="py-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sprout className="h-4 w-4 text-green-600" />
                      {itp.id}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {typeCulture}
                    </Badge>
                  </div>
                  {itp.typePlanche && (
                    <CardDescription className="text-xs">
                      {itp.typePlanche}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="py-2 px-4">
                  {/* Périodes */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 bg-orange-50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Semis</div>
                      <div className="font-medium text-orange-700">
                        {formatSemaine(itp.semaineSemis)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Plantation</div>
                      <div className="font-medium text-green-700">
                        {formatSemaine(itp.semainePlantation)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Récolte</div>
                      <div className="font-medium text-amber-700">
                        {formatSemaine(itp.semaineRecolte)}
                        {itp.dureeRecolte && itp.dureeRecolte > 1 && (
                          <span className="text-xs font-normal ml-1">
                            ({itp.dureeRecolte}s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Infos complémentaires */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {duree && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {duree}
                      </div>
                    )}
                    {itp.dureePepiniere && (
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Pépinière: {itp.dureePepiniere}j
                      </div>
                    )}
                    {itp.nbRangs && (
                      <div className="flex items-center gap-1">
                        <Grid3X3 className="h-3 w-3" />
                        {itp.nbRangs} rangs
                      </div>
                    )}
                    {itp.espacement && (
                      <div className="flex items-center gap-1">
                        Esp: {itp.espacement}cm
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {itp.notes && (
                    <div className="mt-2 text-xs italic text-muted-foreground border-t pt-2">
                      {itp.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </ScrollArea>

      {/* Aide */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Conseil:</strong> L'itinéraire technique définit les périodes de semis, plantation
          et récolte. Choisissez celui adapté à votre contexte (serre, plein champ, etc.).
        </p>
      </div>
    </div>
  )
}
