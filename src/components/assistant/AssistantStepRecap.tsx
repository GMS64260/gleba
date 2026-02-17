"use client"

/**
 * Etape 4 : Recapitulatif et creation
 * - Resume des choix (planche, culture, dates, quantites)
 * - Alertes (stock, associations, irrigation)
 * - Creation de la planche et culture via API
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertTriangle,
  Calendar,
  Check,
  Grid3X3,
  Heart,
  Leaf,
  LayoutGrid,
  Loader2,
  Sprout,
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  estimerNombrePlants,
  necesiteIrrigation,
} from "@/lib/assistant-helpers"
import type { AssistantState } from "./AssistantDialog"
import { useToast } from "@/hooks/use-toast"

interface AssistantStepRecapProps {
  state: AssistantState
  onSuccess: (plancheId?: string, cultureId?: number) => void
}

interface AssociationReco {
  id: string
  nom: string
  description?: string
}

export function AssistantStepRecap({ state, onSuccess }: AssistantStepRecapProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [associations, setAssociations] = React.useState<AssociationReco[]>([])
  const [stockCheck, setStockCheck] = React.useState<{
    suffisant: boolean
    stockActuel: number
    besoin: number
    unite: string // 'g' ou 'plants'
  } | null>(null)

  const { planche, culture, espece, itp, variete } = state

  // Calculer le nombre de plants
  const nbPlants = React.useMemo(() => {
    return estimerNombrePlants(
      culture.longueur || planche.longueur || 0,
      planche.largeur || 0,
      culture.nbRangs || 1,
      culture.espacement || 30
    )
  }, [culture.longueur, planche.longueur, planche.largeur, culture.nbRangs, culture.espacement])

  // Verifier le stock (graines OU plants selon la variete)
  React.useEffect(() => {
    if (!variete) {
      setStockCheck(null)
      return
    }

    const stockGraines = variete.userStockGraines ?? variete.stockGraines ?? 0
    const stockPlants = variete.userStockPlants ?? variete.stockPlants ?? 0
    const grainesParPlant = itp?.nbGrainesPlant || culture.itp?.nbGrainesPlant || 0

    // Determiner si on est en mode "plants" ou "graines"
    // Mode plants: pas de graines/g defini, ou stock plants > 0 et pas de graines
    const modeGraines = grainesParPlant > 0 && stockGraines > 0

    if (modeGraines) {
      // Verif en grammes de graines
      const besoin = nbPlants * grainesParPlant
      setStockCheck({
        suffisant: stockGraines >= besoin,
        stockActuel: stockGraines,
        besoin,
        unite: 'g',
      })
    } else if (stockPlants > 0 || stockGraines === 0) {
      // Verif en nombre de plants/caieux/bulbes
      setStockCheck({
        suffisant: stockPlants >= nbPlants,
        stockActuel: stockPlants,
        besoin: nbPlants,
        unite: 'plants',
      })
    } else {
      // Fallback graines sans nbGrainesPlant connu → besoin = nbPlants (1 graine/plant)
      setStockCheck({
        suffisant: stockGraines >= nbPlants,
        stockActuel: stockGraines,
        besoin: nbPlants,
        unite: 'g',
      })
    }
  }, [variete, nbPlants, itp?.nbGrainesPlant, culture.itp?.nbGrainesPlant])

  // Charger les associations recommandees
  React.useEffect(() => {
    async function fetchAssociations() {
      const especeId = espece?.id || culture.especeId
      if (!especeId) return
      try {
        const res = await fetch(`/api/associations?especeId=${encodeURIComponent(especeId)}`)
        if (res.ok) {
          const data = await res.json()
          const associationsList = Array.isArray(data) ? data : (data.data || [])
          setAssociations(associationsList.slice(0, 3))
        }
      } catch (e) {
        console.error('Error fetching associations:', e)
      }
    }
    fetchAssociations()
  }, [espece?.id, culture.especeId])

  // Creer la planche et/ou la culture
  const handleCreate = async () => {
    setLoading(true)
    try {
      let plancheId = planche.id || state.selectedPlancheId

      // 1. Creer la planche si nouvelle
      if (state.mode === 'new-planche' && !planche.id) {
        const basePlancheData = {
          largeur: planche.largeur,
          longueur: planche.longueur,
          surface: planche.surface,
          ilot: planche.ilot || null,
          type: planche.type || null,
          irrigation: planche.irrigation || null,
          typeSol: planche.typeSol || null,
          retentionEau: planche.retentionEau || null,
        }

        // Creer la planche (names are now per-user unique, no need for suffix retry)
        const plancheName = planche.nom || 'Planche'
        const plancheRes = await fetch('/api/planches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePlancheData, nom: plancheName }),
        })

        if (plancheRes.ok) {
          const newPlanche = await plancheRes.json()
          plancheId = newPlanche.id // cuid for FK
          toast({
            title: "Planche creee",
            description: `La planche "${plancheName}" a ete creee`,
          })
        } else if (plancheRes.status === 409) {
          // Name already exists for this user — fetch and reuse
          const existingRes = await fetch(`/api/planches/${encodeURIComponent(plancheName)}`)
          if (existingRes.ok) {
            const existingPlanche = await existingRes.json()
            plancheId = existingPlanche.id // cuid for FK
          } else {
            throw new Error(`La planche "${plancheName}" existe deja`)
          }
        } else {
          const err = await plancheRes.json()
          throw new Error(err.error || 'Erreur creation planche')
        }
      }

      // 2. Creer la culture
      const especeRef = espece || culture.espece
      const aIrriguer = especeRef ? necesiteIrrigation(especeRef) : false

      // Convertir les dates de maniere robuste (string ou Date)
      const toISO = (d: any) => {
        if (!d) return null
        if (d instanceof Date) return d.toISOString()
        if (typeof d === 'string') return new Date(d).toISOString()
        return null
      }

      const cultureBody = {
        especeId: espece?.id || culture.especeId,
        varieteId: variete?.id || culture.varieteId || null,
        itpId: itp?.id || culture.itpId || null,
        plancheId: plancheId || null,
        annee: culture.annee,
        dateSemis: toISO(culture.dateSemis),
        datePlantation: toISO(culture.datePlantation),
        dateRecolte: toISO(culture.dateRecolte),
        nbRangs: culture.nbRangs || null,
        longueur: culture.longueur || null,
        espacement: culture.espacement || null,
        aIrriguer,
        semisFait: false,
        plantationFaite: false,
        recolteFaite: false,
      }

      const cultureRes = await fetch('/api/cultures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cultureBody),
      })

      if (!cultureRes.ok) {
        const err = await cultureRes.json()
        const errorMsg = err.error || 'Erreur creation culture'
        const details = err.details ? JSON.stringify(err.details) : ''
        throw new Error(`${errorMsg}${details ? ' - ' + details : ''}`)
      }

      const newCulture = await cultureRes.json()

      toast({
        title: "Culture creee",
        description: `La culture de ${espece?.id || culture.especeId} a ete creee`,
      })

      onSuccess(plancheId || undefined, newCulture.id)
    } catch (error) {
      console.error('Error creating:', error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : 'Erreur lors de la creation',
      })
    } finally {
      setLoading(false)
    }
  }

  // Display helpers
  const especeId = espece?.id || culture.especeId || '-'
  const itpId = itp?.id || culture.itpId || '-'
  const varieteId = variete?.id || culture.varieteId || 'Non definie'
  const especeRef = espece || culture.espece

  return (
    <div className="space-y-4">
      {/* Resume Planche */}
      {(state.mode === 'new-planche' || planche.id || state.selectedPlancheId) && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-amber-600" />
              Planche
              {state.mode === 'new-planche' && (
                <Badge variant="secondary" className="text-xs">Nouvelle</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Nom:</span>{' '}
                <span className="font-medium">{planche.nom || planche.id || state.selectedPlancheId}</span>
              </div>
              {planche.surface && (
                <div>
                  <span className="text-muted-foreground">Surface:</span>{' '}
                  <span className="font-medium">{planche.surface.toFixed(1)} m2</span>
                </div>
              )}
              {planche.ilot && (
                <div>
                  <span className="text-muted-foreground">Ilot:</span>{' '}
                  <span className="font-medium">{planche.ilot}</span>
                </div>
              )}
              {planche.type && (
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">{planche.type}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resume Culture */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sprout className="h-4 w-4 text-green-600" />
            Culture
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Espece:</span>{' '}
              <span className="font-medium">{especeId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ITP:</span>{' '}
              <span className="font-medium">{itpId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Variete:</span>{' '}
              <span className="font-medium">{varieteId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Annee:</span>{' '}
              <span className="font-medium">{culture.annee}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Semis:</span>{' '}
                <span className="font-medium">
                  {culture.dateSemis ? format(culture.dateSemis, "dd/MM", { locale: fr }) : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Plant.:</span>{' '}
                <span className="font-medium">
                  {culture.datePlantation ? format(culture.datePlantation, "dd/MM", { locale: fr }) : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rec.:</span>{' '}
                <span className="font-medium">
                  {culture.dateRecolte ? format(culture.dateRecolte, "dd/MM", { locale: fr }) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Quantites */}
          <div className="flex items-center gap-4 text-sm">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <span>
              {culture.nbRangs || '-'} rangs x {culture.longueur || '-'}m
              ({culture.espacement || '-'}cm esp.)
              = ~{nbPlants} plants
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Alerte stock insuffisant */}
      {stockCheck && !stockCheck.suffisant && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stock insuffisant</AlertTitle>
          <AlertDescription>
            Stock actuel: {stockCheck.stockActuel}{stockCheck.unite === 'g' ? 'g' : ' plants'} - Besoin estime: {stockCheck.besoin.toFixed(0)}{stockCheck.unite === 'g' ? 'g' : ' plants'}
          </AlertDescription>
        </Alert>
      )}

      {/* Associations recommandees */}
      {associations.length > 0 && (
        <Card className="bg-pink-50 border-pink-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-600" />
              Associations recommandees
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3">
            <div className="flex flex-wrap gap-2">
              {associations.map(a => (
                <Badge key={a.id} variant="outline" className="text-pink-700 border-pink-300">
                  {a.nom}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Irrigation auto */}
      {especeRef && necesiteIrrigation(especeRef) && (
        <Alert>
          <Leaf className="h-4 w-4" />
          <AlertTitle>Irrigation automatique</AlertTitle>
          <AlertDescription>
            Cette espece a un besoin en eau eleve. La culture sera marquee "a irriguer".
          </AlertDescription>
        </Alert>
      )}

      {/* Bouton creation */}
      <div className="pt-4">
        <Button
          onClick={handleCreate}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creation en cours...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Creer la culture
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
