"use client"

/**
 * Étape Plante fusionnée : Espèce + ITP + Variété
 * Combine les anciennes étapes 3, 4 et 5 en une seule page déroulante.
 * - Section 1 : Sélection de l'espèce (toujours visible)
 * - Section 2 : Sélection de l'ITP (apparaît après sélection espèce)
 * - Section 3 : Sélection de la variété (apparaît après sélection ITP)
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Search,
  Leaf,
  Sprout,
  Zap,
  Info,
  AlertCircle,
  RefreshCw,
  Check,
  ChevronDown,
  Sparkles,
  Trees,
  CalendarDays,
  Clock,
  Grid3X3,
  Package,
  ShoppingBag,
} from "lucide-react"
import { getWeek } from "date-fns"
import {
  filtrerEspecesSaison,
  CATEGORIES_ESPECES,
  NIVEAUX_DIFFICULTE,
  formatSemaine,
  getSemaineDepuisDate,
} from "@/lib/assistant-helpers"
import type { EspeceData, ITPData, VarieteData, CultureData } from "./AssistantDialog"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssistantStepPlanteProps {
  especes: EspeceData[]
  espece: EspeceData | null
  itp: ITPData | null
  variete: VarieteData | null
  skipVariete: boolean
  onEspeceChange: (espece: EspeceData | null) => void
  onItpChange: (itp: ITPData | null) => void
  onVarieteChange: (variete: VarieteData | null) => void
  onSkipVarieteChange: (skip: boolean) => void
  onCultureChange: (data: Partial<CultureData>) => void
}

// ---------------------------------------------------------------------------
// Helpers (stock)
// ---------------------------------------------------------------------------

function getEffectiveGraines(v: VarieteData): number {
  return v.userStockGraines ?? v.stockGraines ?? 0
}

function getEffectivePlants(v: VarieteData): number {
  return v.userStockPlants ?? v.stockPlants ?? 0
}

function getTotalStock(v: VarieteData): number {
  return getEffectiveGraines(v) + getEffectivePlants(v)
}

// ---------------------------------------------------------------------------
// ITP helpers
// ---------------------------------------------------------------------------

function getTypeCulture(itp: ITPData): string {
  if (itp.semaineSemis && itp.semainePlantation && itp.dureePepiniere) {
    return "Semis en pépinière"
  }
  if (itp.semaineSemis && !itp.semainePlantation) {
    return "Semis direct"
  }
  if (itp.semainePlantation && !itp.semaineSemis) {
    return "Plantation directe"
  }
  return "Non défini"
}

function getDureeEstimee(itp: ITPData): string | null {
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

// ---------------------------------------------------------------------------
// Espece helpers
// ---------------------------------------------------------------------------

type EspeceType = "all" | "legume" | "aromatique" | "engrais_vert"

function getCategorie(type?: string) {
  return CATEGORIES_ESPECES[type as keyof typeof CATEGORIES_ESPECES] || CATEGORIES_ESPECES.autre
}

function getNiveau(niveau?: string | null) {
  if (!niveau) return null
  return NIVEAUX_DIFFICULTE[niveau as keyof typeof NIVEAUX_DIFFICULTE] || null
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <AlertCircle className="h-8 w-8 mb-2 text-destructive opacity-70" />
      <p className="text-sm mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-1" />
        Réessayer
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssistantStepPlante({
  especes,
  espece,
  itp,
  variete,
  skipVariete,
  onEspeceChange,
  onItpChange,
  onVarieteChange,
  onSkipVarieteChange,
  onCultureChange,
}: AssistantStepPlanteProps) {
  // ---- Espece local state ----
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<EspeceType>("all")

  // ---- ITP state ----
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [itpsLoading, setItpsLoading] = React.useState(false)
  const [itpsError, setItpsError] = React.useState<string | null>(null)

  // ---- Variete state ----
  const [varietes, setVarietes] = React.useState<VarieteData[]>([])
  const [varietesLoading, setVarietesLoading] = React.useState(false)
  const [varietesError, setVarietesError] = React.useState<string | null>(null)
  const [autoSelectedVariete, setAutoSelectedVariete] = React.useState(false)

  // ---- Refs for scroll into view ----
  const itpSectionRef = React.useRef<HTMLDivElement>(null)
  const varieteSectionRef = React.useRef<HTMLDivElement>(null)

  const semaineCourante = getWeek(new Date(), { weekStartsOn: 1 })

  // =========================================================================
  // Espece filtering
  // =========================================================================

  const filteredEspeces = React.useMemo(() => {
    let result = especes

    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.id.toLowerCase().includes(searchLower) ||
          e.nomLatin?.toLowerCase().includes(searchLower) ||
          e.categorie?.toLowerCase().includes(searchLower)
      )
    }

    return result
  }, [especes, typeFilter, search])

  const especesSaison = React.useMemo(() => {
    return filtrerEspecesSaison(especes, semaineCourante).slice(0, 6)
  }, [especes, semaineCourante])

  // =========================================================================
  // Fetch ITPs when espece changes
  // =========================================================================

  const fetchItps = React.useCallback(
    async (especeId: string) => {
      setItpsLoading(true)
      setItpsError(null)
      try {
        const res = await fetch(
          `/api/itps?especeId=${encodeURIComponent(especeId)}&pageSize=50`
        )
        if (!res.ok) throw new Error("Erreur lors du chargement des ITPs")
        const data = await res.json()
        const fetched: ITPData[] = data.data || []
        setItps(fetched)

        // Auto-select if only one ITP
        if (fetched.length === 1) {
          onItpChange(fetched[0])
          onCultureChange({
            itpId: fetched[0].id,
            itp: fetched[0],
            nbRangs: fetched[0].nbRangs || undefined,
            espacement: fetched[0].espacement || undefined,
          })
        }
      } catch (e) {
        console.error("Error fetching ITPs:", e)
        setItpsError("Impossible de charger les itinéraires techniques.")
        setItps([])
      } finally {
        setItpsLoading(false)
      }
    },
    [onItpChange, onCultureChange]
  )

  // =========================================================================
  // Fetch varietes when espece changes
  // =========================================================================

  const fetchVarietes = React.useCallback(
    async (especeId: string) => {
      setVarietesLoading(true)
      setVarietesError(null)
      setAutoSelectedVariete(false)
      try {
        const res = await fetch(
          `/api/varietes?especeId=${encodeURIComponent(especeId)}&pageSize=50`
        )
        if (!res.ok)
          throw new Error("Erreur lors du chargement des variétés")
        const data = await res.json()
        const raw: VarieteData[] = data.data || []

        // Sort: stock first, then by total descending
        const sorted = [...raw].sort((a, b) => {
          const hasA =
            getEffectiveGraines(a) > 0 || getEffectivePlants(a) > 0 ? 1 : 0
          const hasB =
            getEffectiveGraines(b) > 0 || getEffectivePlants(b) > 0 ? 1 : 0
          if (hasA !== hasB) return hasB - hasA
          return getTotalStock(b) - getTotalStock(a)
        })

        setVarietes(sorted)

        // Auto-select best stock variant if no variete already selected
        if (!variete && sorted.length > 0 && !skipVariete) {
          const best = sorted[0]
          if (getTotalStock(best) > 0) {
            onVarieteChange(best)
            setAutoSelectedVariete(true)
          }
        }
      } catch (e) {
        console.error("Error fetching varietes:", e)
        setVarietesError("Impossible de charger les variétés.")
        setVarietes([])
      } finally {
        setVarietesLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skipVariete]
  )

  // =========================================================================
  // Effects: fetch on espece change
  // =========================================================================

  React.useEffect(() => {
    if (!espece) {
      setItps([])
      setVarietes([])
      return
    }
    fetchItps(espece.id)
    fetchVarietes(espece.id)
  }, [espece?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll ITP section into view when espece selected
  React.useEffect(() => {
    if (espece && itpSectionRef.current) {
      // Small delay for DOM update
      const timer = setTimeout(() => {
        itpSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [espece?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll variete section into view when ITP selected
  React.useEffect(() => {
    if (itp && varieteSectionRef.current) {
      const timer = setTimeout(() => {
        varieteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [itp?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleEspeceSelect = (selected: EspeceData) => {
    // Toggle: re-click deselects
    if (selected.id === espece?.id) {
      onEspeceChange(null)
      onItpChange(null)
      onVarieteChange(null)
      onSkipVarieteChange(false)
      setAutoSelectedVariete(false)
      onCultureChange({
        especeId: undefined,
        espece: undefined,
        itpId: undefined,
        itp: undefined,
        varieteId: undefined,
        variete: undefined,
      })
      return
    }
    // Reset downstream
    onItpChange(null)
    onVarieteChange(null)
    onSkipVarieteChange(false)
    setAutoSelectedVariete(false)
    onEspeceChange(selected)
    onCultureChange({
      especeId: selected.id,
      espece: selected,
      itpId: undefined,
      itp: undefined,
      varieteId: undefined,
      variete: undefined,
    })
  }

  const handleItpSelect = (selected: ITPData) => {
    // Toggle: re-click deselects
    if (selected.id === itp?.id) {
      onItpChange(null)
      onCultureChange({
        itpId: undefined,
        itp: undefined,
      })
      return
    }
    onItpChange(selected)
    onCultureChange({
      itpId: selected.id,
      itp: selected,
      nbRangs: selected.nbRangs || undefined,
      espacement: selected.espacement || undefined,
    })
  }

  const handleVarieteSelect = (selected: VarieteData) => {
    // Toggle: re-click deselects
    if (selected.id === variete?.id) {
      setAutoSelectedVariete(false)
      onVarieteChange(null)
      onCultureChange({ varieteId: null, variete: null })
      return
    }
    setAutoSelectedVariete(false)
    onVarieteChange(selected)
    onCultureChange({
      varieteId: selected.id,
      variete: selected,
    })
  }

  const handleVarieteClear = () => {
    setAutoSelectedVariete(false)
    onVarieteChange(null)
    onCultureChange({ varieteId: null, variete: null })
  }

  const handleSkipChange = (checked: boolean) => {
    onSkipVarieteChange(checked)
    if (checked) {
      setAutoSelectedVariete(false)
      onVarieteChange(null)
      onCultureChange({ varieteId: null, variete: null })
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* =================================================================
          SECTION 1 : ESPECE
          ================================================================= */}
      <section className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une espèce..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type filter tabs */}
        <Tabs
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as EspeceType)}
        >
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

        {/* Seasonal suggestions */}
        {!search && typeFilter === "all" && especesSaison.length > 0 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Suggestions de saison (S{semaineCourante})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="flex flex-wrap gap-2">
                {especesSaison.map((e) => (
                  <Badge
                    key={e.id}
                    variant={espece?.id === e.id ? "default" : "outline"}
                    className="cursor-pointer hover:bg-amber-100"
                    onClick={() => handleEspeceSelect(e)}
                  >
                    {getCategorie(e.type).emoji} {e.id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Species list */}
        <ScrollArea className="h-[300px] pr-4">
          {especes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <SkeletonList count={5} />
            </div>
          ) : filteredEspeces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Trees className="h-8 w-8 mb-2 opacity-50" />
              <p>Aucune espèce trouvée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEspeces.map((e) => {
                const cat = getCategorie(e.type)
                const niveau = getNiveau(e.niveau)
                const isSelected = espece?.id === e.id

                return (
                  <Card
                    key={e.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? "ring-2 ring-green-500 bg-green-50" : ""
                    }`}
                    onClick={() => handleEspeceSelect(e)}
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
                            <Badge
                              variant="outline"
                              className={`text-xs ${niveau.color}`}
                            >
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
                          {isSelected && (
                            <Check className="h-4 w-4 text-green-600" />
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

        {/* Summary */}
        <div className="text-xs text-muted-foreground text-center">
          {filteredEspeces.length} espèce(s){" "}
          {search || typeFilter !== "all" ? "filtrée(s)" : ""}
        </div>
      </section>

      {/* =================================================================
          SECTION 2 : ITP
          ================================================================= */}
      <div
        ref={itpSectionRef}
        className={`transition-all duration-300 ease-in-out ${
          espece
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden"
        }`}
      >
        {espece && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                <Sprout className="h-4 w-4 text-green-600" />
                Itinéraire technique
              </span>
              <Separator className="flex-1" />
            </div>

            {itpsLoading ? (
              <SkeletonList count={3} />
            ) : itpsError ? (
              <ErrorBlock
                message={itpsError}
                onRetry={() => fetchItps(espece.id)}
              />
            ) : itps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Info className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucun itinéraire technique trouvé pour cette espèce</p>
                <p className="text-xs mt-1">
                  Vous pouvez en créer un dans la section ITPs
                </p>
              </div>
            ) : (
              <>
                {/* Auto-select toast */}
                {itps.length === 1 && itp?.id === itps[0].id && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <Info className="h-4 w-4 flex-shrink-0" />
                    <span>ITP auto-sélectionné (seul disponible)</span>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {itps.length === 1
                    ? "Un seul itinéraire disponible pour cette espèce :"
                    : `${itps.length} itinéraires disponibles. Choisissez celui qui correspond à votre situation :`}
                </p>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-3 pr-4">
                    {itps.map((itpItem) => {
                      const isSelected = itp?.id === itpItem.id
                      const typeCulture = getTypeCulture(itpItem)
                      const duree = getDureeEstimee(itpItem)

                      return (
                        <Card
                          key={itpItem.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isSelected
                              ? "ring-2 ring-green-500 bg-green-50"
                              : ""
                          }`}
                          onClick={() => handleItpSelect(itpItem)}
                        >
                          <CardHeader className="py-3 pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Sprout className="h-4 w-4 text-green-600" />
                                {itpItem.id}
                                {isSelected && (
                                  <Check className="h-4 w-4 text-green-600" />
                                )}
                              </CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {typeCulture}
                              </Badge>
                            </div>
                            {itpItem.typePlanche && (
                              <p className="text-xs text-muted-foreground">
                                {itpItem.typePlanche}
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="py-2 px-4">
                            {/* Periods */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="text-center p-2 bg-orange-50 rounded-lg">
                                <div className="text-xs text-muted-foreground mb-1">
                                  Semis
                                </div>
                                <div className="font-medium text-orange-700">
                                  {formatSemaine(itpItem.semaineSemis)}
                                </div>
                              </div>
                              <div className="text-center p-2 bg-green-50 rounded-lg">
                                <div className="text-xs text-muted-foreground mb-1">
                                  Plantation
                                </div>
                                <div className="font-medium text-green-700">
                                  {formatSemaine(itpItem.semainePlantation)}
                                </div>
                              </div>
                              <div className="text-center p-2 bg-amber-50 rounded-lg">
                                <div className="text-xs text-muted-foreground mb-1">
                                  Récolte
                                </div>
                                <div className="font-medium text-amber-700">
                                  {formatSemaine(itpItem.semaineRecolte)}
                                  {itpItem.dureeRecolte &&
                                    itpItem.dureeRecolte > 1 && (
                                      <span className="text-xs font-normal ml-1">
                                        ({itpItem.dureeRecolte}s)
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Extra info */}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {duree && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {duree}
                                </div>
                              )}
                              {itpItem.dureePepiniere && (
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  Pépinière: {itpItem.dureePepiniere}j
                                </div>
                              )}
                              {itpItem.nbRangs && (
                                <div className="flex items-center gap-1">
                                  <Grid3X3 className="h-3 w-3" />
                                  {itpItem.nbRangs} rangs
                                </div>
                              )}
                              {itpItem.espacement && (
                                <div className="flex items-center gap-1">
                                  Esp: {itpItem.espacement}cm
                                </div>
                              )}
                            </div>

                            {/* Notes */}
                            {itpItem.notes && (
                              <div className="mt-2 text-xs italic text-muted-foreground border-t pt-2">
                                {itpItem.notes}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </section>
        )}
      </div>

      {/* =================================================================
          SECTION 3 : VARIETE
          ================================================================= */}
      <div
        ref={varieteSectionRef}
        className={`transition-all duration-300 ease-in-out ${
          espece && itp
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden"
        }`}
      >
        {espece && itp && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-green-600" />
                Variété (optionnel)
              </span>
              <Separator className="flex-1" />
            </div>

            {/* Skip checkbox */}
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="skip-variete"
                checked={skipVariete}
                onCheckedChange={(checked) =>
                  handleSkipChange(checked === true)
                }
              />
              <Label
                htmlFor="skip-variete"
                className="text-sm cursor-pointer flex-1"
              >
                Pas de variété spécifique
              </Label>
            </div>

            {!skipVariete && (
              <>
                {varietesLoading ? (
                  <SkeletonList count={3} />
                ) : varietesError ? (
                  <ErrorBlock
                    message={varietesError}
                    onRetry={() => fetchVarietes(espece.id)}
                  />
                ) : varietes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <Package className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Aucune variété disponible</p>
                    <p className="text-xs mt-1">
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
                ) : (
                  <>
                    {/* Auto-select toast */}
                    {autoSelectedVariete && variete && (
                      <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                        <Zap className="h-4 w-4 flex-shrink-0" />
                        <span>
                          Sélection automatique : meilleur stock disponible
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      {varietes.length} variété(s) disponible(s).
                    </p>

                    <ScrollArea className="h-[240px] pr-4">
                      <div className="space-y-2">
                        {varietes.map((v) => {
                          const isSelected = variete?.id === v.id
                          const stockGraines = getEffectiveGraines(v)
                          const stockPlants = getEffectivePlants(v)
                          const hasGraines = stockGraines > 0
                          const hasPlants = stockPlants > 0
                          const hasStock = hasGraines || hasPlants

                          return (
                            <Card
                              key={v.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                isSelected
                                  ? "ring-2 ring-green-500 bg-green-50"
                                  : ""
                              }`}
                              onClick={() => handleVarieteSelect(v)}
                            >
                              <CardContent className="py-3 px-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`p-2 rounded-lg ${
                                        v.bio ? "bg-green-100" : "bg-gray-100"
                                      }`}
                                    >
                                      <Leaf
                                        className={`h-4 w-4 ${
                                          v.bio
                                            ? "text-green-600"
                                            : "text-gray-500"
                                        }`}
                                      />
                                    </div>
                                    <div>
                                      <div className="font-medium flex items-center gap-2">
                                        {v.id}
                                        {v.bio && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs text-green-600 border-green-600"
                                          >
                                            Bio
                                          </Badge>
                                        )}
                                        {hasStock ? (
                                          <Badge
                                            className="text-xs bg-green-100 text-green-700 hover:bg-green-100 border-green-300"
                                            variant="outline"
                                          >
                                            En stock
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="text-xs text-gray-500 border-gray-300 bg-gray-50"
                                          >
                                            Rupture
                                          </Badge>
                                        )}
                                        {isSelected && (
                                          <Check className="h-4 w-4 text-green-600" />
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

                                  {/* Stock detail */}
                                  <div className="text-right">
                                    {hasStock ? (
                                      <div className="text-xs space-y-1">
                                        {hasGraines && (
                                          <div className="flex items-center gap-1 text-green-600">
                                            <Package className="h-3 w-3" />
                                            {stockGraines}g graines
                                          </div>
                                        )}
                                        {hasPlants && (
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
                  </>
                )}
              </>
            )}

            {/* Advice */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Conseil :</strong> Choisir une variété permet de suivre
                votre stock de semences. Si vous n'avez pas encore décidé, vous
                pourrez modifier ce choix plus tard.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
