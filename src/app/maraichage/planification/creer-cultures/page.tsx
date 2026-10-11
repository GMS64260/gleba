"use client"

/**
 * Page Créer les cultures
 * Permet de créer les cultures à partir du plan de rotation
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft, FileStack, CheckCircle2, Plus, Loader2 } from "lucide-react"
import { formatSemaine } from "@/lib/assistant-helpers"
import { useAnneePlanification } from "@/hooks/use-annee-planification"
import { SelecteurAnneePlanification } from "@/components/maraichage/SelecteurAnneePlanification"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface CulturePrevue {
  plancheId: string
  ilot: string | null
  especeId: string | null
  especeNom?: string | null
  especeCouleur: string | null
  itpId: string | null
  itpNom?: string | null
  annee: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  surface: number
  existante: boolean
}

/** QA cmv2r2rl8 — étape de rotation prévue que la planche ne suit pas. */
interface EtapeNonSuivie {
  plancheId: string
  ilot: string | null
  especeId: string | null
  especeNom?: string | null
  especeCouleur: string | null
  itpId: string | null
  itpNom?: string | null
  annee: number
  rotationAnnee: number
  rotationNbAnnees: number
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  especesPresentes: string[]
  etapeEntamee?: boolean
}

function CreerCulturesContent() {
  const { toast } = useToast()

  const [data, setData] = React.useState<CulturePrevue[]>([])
  const [etapesNonSuivies, setEtapesNonSuivies] = React.useState<EtapeNonSuivie[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreating, setIsCreating] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  // QA cmswunyun — même motif que cultures-prevues (cmsp5p3v4) : l'URL est
  // la source de vérité de l'année. Le repli silencieux sur l'année courante
  // affichait « Total prévues 0 » (2026, tout créé) alors que l'écran voisin
  // listait 13 cultures 2028.
  const [hasError, setHasError] = React.useState(false)
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setSelectedIds(new Set())
    try {
      const response = await fetch(`/api/planification/cultures-prevues?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setEtapesNonSuivies(Array.isArray(result.etapesNonSuivies) ? result.etapesNonSuivies : [])
      setHasError(false)
    } catch {
      // QA cmswunyun — un échec de chargement laissait data=[] et l'écran
      // affichait « Total prévues 0 » : l'erreur reste visible après le toast.
      setHasError(true)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures prévues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    // Ne pas charger la saison courante avant d'avoir restauré la saison
    // mémorisée : la réponse tardive écraserait les données de la bonne année.
    if (!anneePrete) return
    fetchData()
  }, [anneePrete, fetchData])


  // Cultures à créer (non existantes avec un ITP)
  const culturesACreer = data.filter(c => !c.existante && c.itpId)

  // Generer un ID unique pour chaque culture
  const getCultureKey = (c: CulturePrevue) => `${c.plancheId}|${c.itpId}|${c.annee}`
  // Les étapes non suivies se cochent une à une (« créer quand même ») : elles
  // ne rejoignent jamais « tout sélectionner », la planche étant déjà occupée.
  const getEtapeKey = (e: EtapeNonSuivie) => `non-suivie|${e.plancheId}|${e.itpId}|${e.annee}`
  const etapesCreables = etapesNonSuivies.filter((e) => e.itpId)

  // Toggle selection
  const toggleSelection = (key: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedIds(newSelected)
  }

  // Sélectionner tout (les cultures à créer du plan, pas les étapes non suivies)
  const toutesCochees = culturesACreer.length > 0 && culturesACreer.every((c) => selectedIds.has(getCultureKey(c)))
  const selectAll = () => {
    const suivantes = new Set(selectedIds)
    for (const c of culturesACreer) {
      if (toutesCochees) suivantes.delete(getCultureKey(c))
      else suivantes.add(getCultureKey(c))
    }
    setSelectedIds(suivantes)
  }

  // Créer les cultures sélectionnées
  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Sélectionnez au moins une culture à créer",
      })
      return
    }

    setIsCreating(true)
    try {
      const culturesToCreate = [
        ...culturesACreer.filter(c => selectedIds.has(getCultureKey(c))),
        ...etapesCreables.filter(e => selectedIds.has(getEtapeKey(e))),
      ].map(c => ({
        plancheId: c.plancheId,
        itpId: c.itpId!,
        annee: c.annee,
      }))

      const response = await fetch("/api/planification/creer-cultures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultures: culturesToCreate }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la création")
      }

      const result = await response.json()
      // Le serveur écarte silencieusement une ligne dont l'itinéraire n'est plus
      // utilisable, dont la planche n'est pas la vôtre, ou déjà couverte par une
      // culture existante. On disait « 3 créées » sans dire que 5 étaient
      // demandées : l'écart est désormais nommé, motif par motif.
      const ignorees: { plancheId: string; itpId: string; motif: string }[] = result.ignorees ?? []
      if (ignorees.length > 0) {
        // Un motif par planche : un refus de largeur porte ses propres chiffres,
        // deux refus juxtaposés ne disaient plus lequel allait avec quelle planche.
        toast({
          variant: result.created > 0 ? "default" : "destructive",
          title:
            result.created > 0
              ? `${result.created} culture(s) créée(s), ${ignorees.length} écartée(s)`
              : "Aucune culture créée",
          description: ignorees.map((i) => `${i.plancheId} : ${i.motif}`).join(" ; ") + ".",
        })
      } else {
        toast({
          title: "Cultures créées",
          description: `${result.created} culture(s) créée(s) avec succès`,
        })
      }

      // Recharger les données
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la création",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        {/* Responsive 360px — retour + titre débordent sinon */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/maraichage?tab=planification">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Planification
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileStack className="h-6 w-6 text-teal-600" />
            <h1 className="text-xl font-bold">Créer les cultures</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <SelecteurAnneePlanification annee={annee} annees={annees} onChange={definirAnnee} />
        </div>
      </div>

      <main>
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total prévues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Déjà créées</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {data.filter(c => c.existante).length}
              </p>
            </CardContent>
          </Card>
          <Card className={culturesACreer.length > 0 ? "border-teal-200 bg-teal-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">À créer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-teal-600">{culturesACreer.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* QA cmv2r2rl8 — étapes de rotation que la planche ne suit pas cette
            année : nommées au lieu d'être comptées comme créées. */}
        {!isLoading && !hasError && etapesNonSuivies.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-900">
                {etapesNonSuivies.length} culture{etapesNonSuivies.length > 1 ? "s" : ""} de la rotation non créée{etapesNonSuivies.length > 1 ? "s" : ""} en {annee}
              </CardTitle>
              <CardDescription className="text-amber-900/80">
                La rotation prévoit ces cultures, mais la planche porte déjà d&apos;autres cultures cette saison.
                Elles ne sont pas comptées comme créées. Cochez-en une pour la créer quand même (la largeur de la
                planche est vérifiée), ou adaptez la rotation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {etapesNonSuivies.map((e) => {
                  const key = getEtapeKey(e)
                  return (
                    <li key={key} className="flex flex-wrap items-start gap-3 rounded-md border border-amber-200 bg-white p-3 text-sm">
                      {e.itpId ? (
                        <Checkbox
                          checked={selectedIds.has(key)}
                          onCheckedChange={() => toggleSelection(key)}
                          aria-label={`Créer quand même ${e.especeNom ?? e.especeId ?? "la culture"} sur ${e.plancheId}`}
                          className="mt-0.5"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          <Link href={`/maraichage/planches/${encodeURIComponent(e.plancheId)}`} className="underline-offset-2 hover:underline">
                            {e.plancheId}
                          </Link>
                          {" · "}étape {e.rotationAnnee}/{e.rotationNbAnnees} : {e.especeNom ?? e.especeId ?? "espèce inconnue"}
                          {e.itpNom ? <span className="text-muted-foreground"> ({e.itpNom})</span> : null}
                        </p>
                        <p className="text-muted-foreground">
                          {e.especesPresentes.length > 0
                            ? `Déjà sur la planche en ${e.annee} : ${e.especesPresentes.join(", ")}.`
                            : e.etapeEntamee
                              ? "Une autre culture de cette étape est déjà créée sur la planche."
                              : `Planche déjà occupée en ${e.annee}.`}
                          {" "}Semis {formatSemaine(e.semaineSemis)}, plantation {formatSemaine(e.semainePlantation)}, récolte {formatSemaine(e.semaineRecolte)}.
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(culturesACreer.length > 0 || selectedIds.size > 0) && (
          <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-4">
              {culturesACreer.length > 0 && (
                <Checkbox
                  checked={toutesCochees}
                  onCheckedChange={selectAll}
                  aria-label="Tout sélectionner"
                />
              )}
              <span className="text-sm">
                {selectedIds.size} / {culturesACreer.length + etapesCreables.length} sélectionnée(s)
              </span>
            </div>
            <Button
              onClick={handleCreate}
              disabled={selectedIds.size === 0 || isCreating}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer {selectedIds.size} culture(s)
            </Button>
          </div>
        )}

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Cultures à créer</CardTitle>
            <CardDescription>
              Sélectionnez les cultures à créer à partir du plan de rotation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : hasError ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-medium text-red-600">Chargement impossible</p>
                <p className="mt-2">Les cultures prévues n&apos;ont pas pu être chargées.</p>
                <Button variant="outline" className="mt-4" onClick={fetchData}>
                  Réessayer
                </Button>
              </div>
            ) : culturesACreer.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <p className="text-lg font-medium">
                  {etapesNonSuivies.length > 0
                    ? "Toutes les cultures du plan sont créées, sauf celles de la rotation listées plus haut"
                    : "Toutes les cultures sont déjà créées"}
                </p>
                <p className="mt-2">
                  {etapesNonSuivies.length > 0
                    ? "La planche de ces cultures est déjà occupée cette saison."
                    : "Ou aucune planche n'a de rotation assignée."}
                </p>
                <Link href="/maraichage/planches" className="mt-4 inline-block">
                  <Button variant="outline">
                    Gérer les planches
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Planche</TableHead>
                    <TableHead>Îlot</TableHead>
                    <TableHead>Espèce</TableHead>
                    <TableHead>ITP</TableHead>
                    <TableHead>Semis</TableHead>
                    <TableHead>Plantation</TableHead>
                    <TableHead>Récolte</TableHead>
                    <TableHead>Surface</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {culturesACreer.map((c) => {
                    const key = getCultureKey(c)
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(key)}
                            onCheckedChange={() => toggleSelection(key)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link href={`/maraichage/planches/${encodeURIComponent(c.plancheId)}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">
                              {c.plancheId}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>{c.ilot || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.especeCouleur && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: c.especeCouleur }}
                              />
                            )}
                            {c.especeNom ?? c.especeId ?? "-"}
                          </div>
                        </TableCell>
                        <TableCell>{c.itpNom ?? c.itpId ?? "-"}</TableCell>
                        <TableCell>{formatSemaine(c.semaineSemis)}</TableCell>
                        <TableCell>{formatSemaine(c.semainePlantation)}</TableCell>
                        <TableCell>{formatSemaine(c.semaineRecolte)}</TableCell>
                        <TableCell>{c.surface.toFixed(1)} m²</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function CreerCulturesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CreerCulturesContent />
    </Suspense>
  )
}
