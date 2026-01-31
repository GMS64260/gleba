"use client"

/**
 * Étape 3 : Sélection de l'espèce à cultiver
 * - Recherche par nom
 * - Filtres par type
 * - Suggestions saisonnières
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Leaf, Search, Sprout, Trees, Sparkles } from "lucide-react"
import { getWeek } from "date-fns"
import { CATEGORIES_ESPECES, NIVEAUX_DIFFICULTE, filtrerEspecesSaison } from "@/lib/assistant-helpers"
import type { EspeceData } from "./AssistantDialog"

interface AssistantStepEspeceProps {
  selectedId?: string
  onSelect: (espece: EspeceData) => void
}

type EspeceType = 'all' | 'legume' | 'aromatique' | 'engrais_vert'

export function AssistantStepEspece({ selectedId, onSelect }: AssistantStepEspeceProps) {
  const [especes, setEspeces] = React.useState<EspeceData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<EspeceType>('all')
  const [showSaisonOnly, setShowSaisonOnly] = React.useState(false)

  const semaineCourante = getWeek(new Date(), { weekStartsOn: 1 })

  // Charger les espèces avec leurs ITPs
  React.useEffect(() => {
    async function fetchEspeces() {
      setLoading(true)
      try {
        const res = await fetch('/api/especes?pageSize=500')
        if (res.ok) {
          const data = await res.json()
          // Charger aussi les ITPs pour les suggestions saisonnières
          const itpsRes = await fetch('/api/itps?pageSize=500')
          const itpsData = itpsRes.ok ? await itpsRes.json() : { data: [] }

          // Associer les ITPs aux espèces
          const especesWithItps = (data.data || []).map((e: EspeceData) => ({
            ...e,
            itps: (itpsData.data || []).filter((itp: { especeId?: string }) => itp.especeId === e.id),
          }))

          setEspeces(especesWithItps)
        }
      } catch (e) {
        console.error('Error fetching especes:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchEspeces()
  }, [])

  // Filtrer les espèces
  const filteredEspeces = React.useMemo(() => {
    let result = especes

    // Filtre par type
    if (typeFilter !== 'all') {
      result = result.filter(e => e.type === typeFilter)
    }

    // Filtre par recherche
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(e =>
        e.id.toLowerCase().includes(searchLower) ||
        e.nomLatin?.toLowerCase().includes(searchLower) ||
        e.categorie?.toLowerCase().includes(searchLower)
      )
    }

    // Filtre par saison
    if (showSaisonOnly) {
      result = filtrerEspecesSaison(result, semaineCourante)
    }

    return result
  }, [especes, typeFilter, search, showSaisonOnly, semaineCourante])

  // Espèces recommandées pour la saison (top 6)
  const especesSaison = React.useMemo(() => {
    return filtrerEspecesSaison(especes, semaineCourante).slice(0, 6)
  }, [especes, semaineCourante])

  const getCategorie = (type?: string) => {
    return CATEGORIES_ESPECES[type as keyof typeof CATEGORIES_ESPECES] || CATEGORIES_ESPECES.autre
  }

  const getNiveau = (niveau?: string | null) => {
    if (!niveau) return null
    return NIVEAUX_DIFFICULTE[niveau as keyof typeof NIVEAUX_DIFFICULTE]
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une espèce..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtres par type */}
      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as EspeceType)}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            <Leaf className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Tous</span>
          </TabsTrigger>
          <TabsTrigger value="legume" className="flex-1">
            <span className="mr-1">🥬</span>
            <span className="hidden sm:inline">Légumes</span>
          </TabsTrigger>
          <TabsTrigger value="aromatique" className="flex-1">
            <span className="mr-1">🌿</span>
            <span className="hidden sm:inline">Arom.</span>
          </TabsTrigger>
          <TabsTrigger value="engrais_vert" className="flex-1">
            <Sprout className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Eng. vert</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Suggestions saisonnières */}
      {!search && typeFilter === 'all' && especesSaison.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Suggestions de saison (S{semaineCourante})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3">
            <div className="flex flex-wrap gap-2">
              {especesSaison.map(e => (
                <Badge
                  key={e.id}
                  variant={selectedId === e.id ? "default" : "outline"}
                  className="cursor-pointer hover:bg-amber-100"
                  onClick={() => onSelect(e)}
                >
                  {getCategorie(e.type).emoji} {e.id}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des espèces */}
      <ScrollArea className="h-[280px] pr-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Chargement...
          </div>
        ) : filteredEspeces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Trees className="h-8 w-8 mb-2 opacity-50" />
            <p>Aucune espèce trouvée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEspeces.map(e => {
              const cat = getCategorie(e.type)
              const niveau = getNiveau(e.niveau)
              const isSelected = selectedId === e.id

              return (
                <Card
                  key={e.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
                  }`}
                  onClick={() => onSelect(e)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.emoji}</span>
                        <div>
                          <div className="font-medium">{e.id}</div>
                          {e.nomLatin && (
                            <div className="text-xs text-muted-foreground italic">
                              {e.nomLatin}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {niveau && (
                          <Badge variant="outline" className={`text-xs ${niveau.color}`}>
                            {niveau.label}
                          </Badge>
                        )}
                        {e.itps && e.itps.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {e.itps.length} ITP
                          </Badge>
                        )}
                        {e.famille && e.famille.couleur && (
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: e.famille.couleur }}
                            title={`Famille: ${e.familleId}`}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Résumé */}
      <div className="text-xs text-muted-foreground text-center">
        {filteredEspeces.length} espèce(s) {search || typeFilter !== 'all' ? 'filtrée(s)' : ''}
      </div>
    </div>
  )
}
