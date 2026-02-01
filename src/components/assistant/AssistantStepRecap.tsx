"use client"

/**
 * Étape 7 : Récapitulatif et création
 * - Résumé des choix
 * - Alertes (stock, associations)
 * - Création de la planche et culture
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Package,
  Sprout,
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  estimerNombrePlants,
  necesiteIrrigation,
  verifierStockSemences,
} from "@/lib/assistant-helpers"
import { peutAjouterCulture, suggererAjustements } from "@/lib/planche-validation"
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
  } | null>(null)
  const [plancheCheck, setPlancheCheck] = React.useState<{
    possible: boolean
    message?: string
    suggestions?: string[]
  } | null>(null)

  const { planche, culture } = state

  // Calculer le nombre de plants
  const nbPlants = React.useMemo(() => {
    return estimerNombrePlants(
      culture.longueur || planche.longueur || 0,
      planche.largeur || 0,
      culture.nbRangs || 1,
      culture.espacement || 30
    )
  }, [culture, planche])

  // Vérifier le stock de semences
  React.useEffect(() => {
    if (culture.variete) {
      const check = verifierStockSemences(
        culture.variete.stockGraines,
        nbPlants,
        culture.itp?.nbGrainesPlant || 1
      )
      setStockCheck(check)
    }
  }, [culture.variete, nbPlants, culture.itp?.nbGrainesPlant])

  // Vérifier si la culture rentre dans la planche
  React.useEffect(() => {
    async function checkPlanche() {
      if (!planche.id || !culture.nbRangs || !culture.itp?.espacementRangs) {
        setPlancheCheck(null)
        return
      }

      try {
        // Récupérer les cultures existantes de la planche
        const res = await fetch(`/api/planches/${encodeURIComponent(planche.id)}`)
        if (!res.ok) return

        const plancheData = await res.json()

        const culturesExistantes = (plancheData.cultures || [])
          .filter((c: any) => c.terminee === null)
          .map((c: any) => ({
            nbRangs: c.nbRangs || 1,
            espacementRangs: c.itp?.espacementRangs || 30,
          }))

        const nouvelleCulture = {
          nbRangs: culture.nbRangs || 1,
          espacementRangs: culture.itp.espacementRangs || 30,
          longueur: culture.longueur || undefined,
        }

        const validation = peutAjouterCulture(
          {
            largeur: plancheData.largeur || 0.8,
            longueur: plancheData.longueur || 2,
          },
          culturesExistantes,
          nouvelleCulture
        )

        if (!validation.possible) {
          const suggestions = suggererAjustements(
            {
              largeur: plancheData.largeur || 0.8,
              longueur: plancheData.longueur || 2,
            },
            culturesExistantes,
            nouvelleCulture
          )

          setPlancheCheck({
            possible: false,
            message: validation.message,
            suggestions: suggestions.map(s => s.message),
          })
        } else {
          setPlancheCheck({ possible: true })
        }
      } catch (e) {
        console.error('Error checking planche:', e)
      }
    }
    checkPlanche()
  }, [planche.id, culture.nbRangs, culture.itp?.espacementRangs])

  // Charger les associations recommandées
  React.useEffect(() => {
    async function fetchAssociations() {
      if (!culture.especeId) return
      try {
        const res = await fetch(`/api/associations?especeId=${encodeURIComponent(culture.especeId)}`)
        if (res.ok) {
          const data = await res.json()
          // L'API retourne directement un tableau, pas { data: [...] }
          const associationsList = Array.isArray(data) ? data : (data.data || [])
          setAssociations(associationsList.slice(0, 3))
        }
      } catch (e) {
        console.error('Error fetching associations:', e)
      }
    }
    fetchAssociations()
  }, [culture.especeId])

  // Créer la planche et/ou la culture
  const handleCreate = async () => {
    setLoading(true)
    try {
      let plancheId = planche.id

      // 1. Créer la planche si nouvelle
      console.log('🔍 Mode:', state.mode, '| planche.id:', planche.id, '| planche.nom:', planche.nom)
      if (state.mode === 'new-planche' && !planche.id) {
        console.log('➡️ Creating new planche...')
        const plancheData = {
          id: planche.nom,
          largeur: planche.largeur,
          longueur: planche.longueur,
          surface: planche.surface,
          ilot: planche.ilot || null,
          type: planche.type || null,
          irrigation: planche.irrigation || null,
        }
        console.log('📤 Planche data:', plancheData)

        const plancheRes = await fetch('/api/planches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plancheData),
        })

        console.log('📥 Planche response status:', plancheRes.status, plancheRes.ok)

        if (!plancheRes.ok) {
          const err = await plancheRes.json()
          console.error('❌ Planche creation failed:', err)
          throw new Error(err.error || 'Erreur création planche')
        }

        const newPlanche = await plancheRes.json()
        plancheId = newPlanche.id
        console.log('✅ Planche created with ID:', plancheId)

        toast({
          title: "Planche créée",
          description: `La planche "${plancheId}" a été créée`,
        })
      } else {
        console.log('⏭️ Skipping planche creation (existing or already has ID)')
      }

      // 2. Créer la culture
      const aIrriguer = culture.espece ? necesiteIrrigation(culture.espece) : false

      const cultureRes = await fetch('/api/cultures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especeId: culture.especeId,
          varieteId: culture.varieteId || null,
          itpId: culture.itpId || null,
          plancheId: plancheId || null,
          annee: culture.annee,
          dateSemis: culture.dateSemis?.toISOString() || null,
          datePlantation: culture.datePlantation?.toISOString() || null,
          dateRecolte: culture.dateRecolte?.toISOString() || null,
          nbRangs: culture.nbRangs || null,
          longueur: culture.longueur || null,
          espacement: culture.espacement || null,
          aIrriguer,
          // Champs requis par le schéma
          semisFait: false,
          plantationFaite: false,
          recolteFaite: false,
        }),
      })

      if (!cultureRes.ok) {
        const err = await cultureRes.json()
        console.error('API Error details:', err)
        const errorMsg = err.error || 'Erreur création culture'
        const details = err.details ? JSON.stringify(err.details) : ''
        throw new Error(`${errorMsg}${details ? ' - ' + details : ''}`)
      }

      const newCulture = await cultureRes.json()

      toast({
        title: "Culture créée",
        description: `La culture de ${culture.especeId} a été créée`,
      })

      onSuccess(plancheId, newCulture.id)
    } catch (error) {
      console.error('Error creating:', error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : 'Erreur lors de la création',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Résumé Planche */}
      {(state.mode === 'new-planche' || planche.id) && (
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
                <span className="font-medium">{planche.nom || planche.id}</span>
              </div>
              {planche.surface && (
                <div>
                  <span className="text-muted-foreground">Surface:</span>{' '}
                  <span className="font-medium">{planche.surface.toFixed(1)} m²</span>
                </div>
              )}
              {planche.ilot && (
                <div>
                  <span className="text-muted-foreground">Îlot:</span>{' '}
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

      {/* Résumé Culture */}
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
              <span className="text-muted-foreground">Espèce:</span>{' '}
              <span className="font-medium">{culture.especeId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ITP:</span>{' '}
              <span className="font-medium">{culture.itpId || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Variété:</span>{' '}
              <span className="font-medium">{culture.varieteId || 'Non définie'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Année:</span>{' '}
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
                <span className="text-muted-foreground">Réc.:</span>{' '}
                <span className="font-medium">
                  {culture.dateRecolte ? format(culture.dateRecolte, "dd/MM", { locale: fr }) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Quantités */}
          <div className="flex items-center gap-4 text-sm">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <span>
              {culture.nbRangs || '-'} rangs × {culture.longueur || '-'}m
              ({culture.espacement || '-'}cm esp.)
              = ~{nbPlants} plants
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Alertes */}
      {plancheCheck && !plancheCheck.possible && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>La culture ne rentre pas dans la planche</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{plancheCheck.message}</p>
            {plancheCheck.suggestions && plancheCheck.suggestions.length > 0 && (
              <div className="text-xs mt-2 space-y-1">
                <p className="font-medium">Suggestions:</p>
                <ul className="list-disc list-inside">
                  {plancheCheck.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {stockCheck && !stockCheck.suffisant && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stock insuffisant</AlertTitle>
          <AlertDescription>
            Stock actuel: {stockCheck.stockActuel}g - Besoin estimé: {stockCheck.besoin.toFixed(0)}g
          </AlertDescription>
        </Alert>
      )}

      {/* Associations recommandées */}
      {associations.length > 0 && (
        <Card className="bg-pink-50 border-pink-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-600" />
              Associations recommandées
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
      {culture.espece && necesiteIrrigation(culture.espece) && (
        <Alert>
          <Leaf className="h-4 w-4" />
          <AlertTitle>Irrigation automatique</AlertTitle>
          <AlertDescription>
            Cette espèce a un besoin en eau élevé. La culture sera marquée "à irriguer".
          </AlertDescription>
        </Alert>
      )}

      {/* Bouton création */}
      <div className="pt-4">
        <Button
          onClick={handleCreate}
          disabled={loading || (plancheCheck !== null && !plancheCheck.possible)}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Créer la culture
            </>
          )}
        </Button>
        {plancheCheck && !plancheCheck.possible && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Modifiez le nombre de rangs ou l'espacement pour continuer
          </p>
        )}
      </div>
    </div>
  )
}
