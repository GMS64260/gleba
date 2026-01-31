"use client"

/**
 * Étape 6 : Dates et quantités
 * - Calcul automatique des dates depuis l'ITP
 * - Ajustement possible
 * - Estimation du rendement
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar, Grid3X3, HelpCircle, Ruler, Sprout, TrendingUp, CalendarDays } from "lucide-react"
import { format, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import {
  calculerDatesCulture,
  estimerNombrePlants,
  estimerRendement,
  formatSemaine,
} from "@/lib/assistant-helpers"
import type { CultureData, PlancheData } from "./AssistantDialog"

interface AssistantStepDatesProps {
  culture: CultureData
  planche: PlancheData
  onCultureChange: (updates: Partial<CultureData>) => void
}

export function AssistantStepDates({ culture, planche, onCultureChange }: AssistantStepDatesProps) {
  const annee = culture.annee || new Date().getFullYear()
  const itp = culture.itp

  // Calcul des dates depuis l'ITP avec décalage
  const datesCalculees = React.useMemo(() => {
    if (!itp) return { dateSemis: null, datePlantation: null, dateRecolte: null }
    return calculerDatesCulture(itp, annee, culture.decalage || 0)
  }, [itp, annee, culture.decalage])

  // Mettre à jour les dates quand le calcul change
  React.useEffect(() => {
    onCultureChange({
      dateSemis: datesCalculees.dateSemis,
      datePlantation: datesCalculees.datePlantation,
      dateRecolte: datesCalculees.dateRecolte,
    })
  }, [datesCalculees, onCultureChange])

  // Calculs de surface et rendement
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
    return estimerRendement(culture.espece?.rendement, surface)
  }, [culture.espece?.rendement, surface])

  // Décalage max depuis ITP
  const decalageMax = itp?.decalageMax || 4

  return (
    <TooltipProvider>
      <div className="space-y-4">
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

        {/* Dates calculées */}
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

        {/* Quantités */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="nbRangs">Nombre de rangs</Label>
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
              value={culture.nbRangs || itp?.nbRangs || ''}
              onChange={(e) => onCultureChange({ nbRangs: parseInt(e.target.value) || undefined })}
              placeholder={itp?.nbRangs?.toString() || '1'}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="longueur">Longueur cultivée (m)</Label>
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
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="espacement">Espacement entre plants (cm)</Label>
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
            value={culture.espacement || itp?.espacement || ''}
            onChange={(e) => onCultureChange({ espacement: parseInt(e.target.value) || undefined })}
            placeholder={itp?.espacement?.toString() || '30'}
          />
        </div>

        {/* Estimations */}
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
