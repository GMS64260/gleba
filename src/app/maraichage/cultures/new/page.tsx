"use client"

/**
 * Page de création d'une nouvelle culture
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sprout, Save } from "lucide-react"
import { formatSemaine } from "@/lib/assistant-helpers"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { createCultureSchema, type CreateCultureInput } from "@/lib/validations"
import { estimerNombrePlantsStrict } from "@/lib/assistant-helpers"
import { RotationAdviceCompact } from "@/components/planche"
import { EspeceCombobox, type EspeceOption } from "@/components/especes/EspeceCombobox"
import { AdjacenceAdvisor } from "@/components/cultures/AdjacenceAdvisor"

// Bug #1 — payload de violation renvoyé par POST /api/cultures (status 409).
type RotationViolation = {
  rotationId: string
  etapeAttendue: number
  familleAttendue: string | null
  familleDemandee: string | null
  message: string
}

// Convertir un numéro de semaine (1-52) en date pour une annee donnée
function weekToDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  return monday
}

interface ITPData {
  id: string
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  nbRangs: number | null
  espacement: number | null
  espacementRangs: number | null
}

export default function NewCulturePage() {
  const router = useRouter()
  const { toast } = useToast()
  // Bug #12 — charger aussi le type d'espèce pour le combobox filtrable.
  const [especes, setEspeces] = React.useState<EspeceOption[]>([])
  const [varietes, setVarietes] = React.useState<{ id: string; especeId: string }[]>([])
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [planches, setPlanches] = React.useState<{ id: string; nom?: string; longueur: number | null }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  // Bug #1 — modale violation rotation (renvoyée par le backend en 409).
  const [rotationWarning, setRotationWarning] = React.useState<{
    payload: CreateCultureInput
    violation: RotationViolation
  } | null>(null)
  // Bug #33 — message informatif quand la date ITP a été dépassée et rectifiée.
  const [dateSemisInfo, setDateSemisInfo] = React.useState<string | null>(null)

  const form = useForm<CreateCultureInput>({
    resolver: zodResolver(createCultureSchema),
    defaultValues: {
      especeId: "",
      varieteId: null,
      itpId: null,
      plancheId: null,
      annee: new Date().getFullYear(),
      dateSemis: null,
      datePlantation: null,
      dateRecolte: null,
      semisFait: false,
      plantationFaite: false,
      recolteFaite: false,
      terminee: null,
      quantite: null,
      nbRangs: null,
      longueur: null,
      espacement: null,
      notes: null,
    },
  })

  const selectedEspece = form.watch("especeId")
  const selectedPlanche = form.watch("plancheId")
  const selectedAnnee = form.watch("annee")
  const selectedItp = form.watch("itpId")
  const watchedNbRangs = form.watch("nbRangs")
  const watchedLongueur = form.watch("longueur")
  const watchedEspacement = form.watch("espacement")

  // Charger les données de reference
  React.useEffect(() => {
    Promise.all([
      fetch("/api/especes?pageSize=500").then((r) => r.json()),
      fetch("/api/planches?pageSize=500").then((r) => r.json()),
    ])
      .then(([especesData, planchesData]) => {
        setEspeces(especesData.data || [])
        setPlanches(planchesData.data || [])
      })
      .catch(() => {
        setEspeces([])
        setPlanches([])
      })
  }, [])

  // Charger les varietes et ITPs quand l'espece change
  React.useEffect(() => {
    if (selectedEspece) {
      Promise.all([
        fetch(`/api/especes/${encodeURIComponent(selectedEspece)}`).then((r) => r.json()),
        fetch(`/api/itps?especeId=${encodeURIComponent(selectedEspece)}&pageSize=500`).then((r) => r.json()),
      ])
        .then(([especeData, itpsData]) => {
          setVarietes(especeData.varietes || [])
          const loadedItps = itpsData.data || []
          setItps(loadedItps)
          // Auto-sélectionner le premier ITP disponible
          if (loadedItps.length > 0) {
            form.setValue("itpId", loadedItps[0].id)
          } else {
            form.setValue("itpId", null)
          }
        })
        .catch(() => {
          setVarietes([])
          setItps([])
          form.setValue("itpId", null)
        })
    } else {
      setVarietes([])
      setItps([])
    }
  }, [selectedEspece, form])

  // PROMPT 20b — Auto-remplissage ITP → dates de culture
  // L'année est dans les deps : changer d'année recalcule les dates si ITP fixé.
  const selectedYear = form.watch("annee")
  React.useEffect(() => {
    if (!selectedItp) return
    const itp = itps.find((i) => i.id === selectedItp)
    if (!itp) return

    const year = selectedYear || new Date().getFullYear()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    setDateSemisInfo(null)

    // Bug #33 + bug Ail #509 — Calculer les dates ITP brutes et, si la première
    // jalon (semis ou plantation) est passée pour l'année courante, décaler
    // l'ENSEMBLE du cycle uniformément. Sinon on cassait le cycle : ex. semis
    // remplacé par today, plantation par today, récolte laissée à la date ITP
    // qui tombait par hasard sur today → cycle d'1 jour.
    let semisDate = itp.semaineSemis ? weekToDate(year, itp.semaineSemis) : null
    let plantationDate = itp.semainePlantation ? weekToDate(year, itp.semainePlantation) : null
    let recolteDate = itp.semaineRecolte ? weekToDate(year, itp.semaineRecolte) : null

    if (year === today.getFullYear()) {
      const firstAnchor = semisDate ?? plantationDate
      if (firstAnchor && firstAnchor < today) {
        const offsetMs = today.getTime() - firstAnchor.getTime()
        if (semisDate) semisDate = new Date(semisDate.getTime() + offsetMs)
        if (plantationDate) plantationDate = new Date(plantationDate.getTime() + offsetMs)
        if (recolteDate) recolteDate = new Date(recolteDate.getTime() + offsetMs)
        const decalageJours = Math.ceil(offsetMs / 86400000)
        const semaineLabel = itp.semaineSemis
          ? formatSemaine(itp.semaineSemis)
          : itp.semainePlantation
            ? formatSemaine(itp.semainePlantation)
            : ""
        setDateSemisInfo(
          `Fenêtre ITP ${semaineLabel} dépassée — cycle décalé de ${decalageJours} j (semis/plantation/récolte alignés).`
        )
      }
    }

    if (semisDate) form.setValue("dateSemis", semisDate)
    if (plantationDate) form.setValue("datePlantation", plantationDate)
    if (recolteDate) form.setValue("dateRecolte", recolteDate)
    if (itp.nbRangs) {
      form.setValue("nbRangs", itp.nbRangs)
    }
    // Bug #29 — Pré-remplir espacement depuis l'ITP. Fallback sur espacementRangs
    // si espacement (sur le rang) absent, pour ne pas laisser le champ vide alors
    // que le calcul "Quantité plants" l'utilise.
    const espVal = itp.espacement ?? itp.espacementRangs
    if (espVal) {
      form.setValue("espacement", Math.round(espVal))
    }
  }, [selectedItp, selectedYear, itps, form])

  // Mettre à jour la longueur quand la planche change
  React.useEffect(() => {
    if (selectedPlanche) {
      const planche = planches.find((p) => p.id === selectedPlanche)
      if (planche?.longueur) {
        form.setValue("longueur", planche.longueur)
      }
    }
  }, [selectedPlanche, planches, form])

  // Auto-calculer la quantité de plants (BUG-10 : null si inputs incomplets).
  React.useEffect(() => {
    const quantite = estimerNombrePlantsStrict(
      watchedLongueur ?? null,
      watchedNbRangs ?? null,
      watchedEspacement ?? null
    )
    form.setValue("quantite", quantite)
  }, [watchedNbRangs, watchedLongueur, watchedEspacement, form])

  /**
   * Bug #1 — Soumission avec gestion du 409 rotationViolation.
   * Si `confirmRotation` est true, on bypass le warning et flag rotationViolee
   * côté serveur. Sinon, on ouvre la modale et on attend l'arbitrage user.
   */
  const submitCulture = async (data: CreateCultureInput, confirmRotation = false) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/cultures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, confirmRotation }),
      })

      if (response.status === 409) {
        const payload = await response.json()
        if (payload?.rotationViolation) {
          setRotationWarning({ payload: data, violation: payload.rotationViolation })
          return
        }
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la création")
      }

      const culture = await response.json()
      toast({
        title: "Culture créée",
        description: `La culture #${culture.id} a été créée avec succès`,
      })
      // Audit Marc 2026-05-14 — Bug 04 : afficher les warnings ITP non
      // bloquants ("Semis le 01/06 hors fenêtre ITP recommandée mars–avril")
      if (Array.isArray(culture.warnings) && culture.warnings.length > 0) {
        for (const w of culture.warnings) {
          toast({
            variant: "default",
            title: "Avertissement agronomique",
            description: w,
          })
        }
      }
      router.push("/maraichage/cultures")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = (data: CreateCultureInput) => submitCulture(data, false)

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/maraichage/cultures">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-bold">Nouvelle culture</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plante et emplacement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="especeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espèce *</FormLabel>
                      <FormControl>
                        {/* Bug #12 + Bug #31 — Combobox searchable, défaut = types
                            potager (le verger reste accessible via l'onglet). */}
                        <EspeceCombobox
                          options={especes}
                          value={field.value || null}
                          onChange={(id) => field.onChange(id || "")}
                          defaultTypes={["legume", "aromatique", "engrais_vert"]}
                          recentStorageKey="espece-recents-maraichage"
                          placeholder="Rechercher une espèce…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="varieteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variété</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!selectedEspece || varietes.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={varietes.length === 0 ? "Aucune variété" : "Sélectionner"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {varietes.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itpId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Itinéraire technique (ITP)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!selectedEspece || itps.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={itps.length === 0 ? "Aucun ITP" : "Sélectionner un ITP"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {itps.map((itp) => (
                            <SelectItem key={itp.id} value={itp.id}>
                              {itp.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plancheId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planche</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une planche" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {planches.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom || p.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Conseils de rotation */}
                {selectedPlanche && (
                  <RotationAdviceCompact
                    plancheId={planches.find(p => p.id === selectedPlanche)?.nom || selectedPlanche}
                    especeId={selectedEspece || undefined}
                    year={selectedAnnee || undefined}
                  />
                )}

                {/* Bug #10 — Compatibilités voisinage (planches du même îlot). */}
                {selectedEspece && selectedPlanche && (
                  <AdjacenceAdvisor especeId={selectedEspece} plancheId={selectedPlanche} />
                )}

                <FormField
                  control={form.control}
                  name="annee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Année</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="2000"
                          max="2100"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dates prévisionnelles</CardTitle>
                {selectedItp && (() => {
                  const itp = itps.find((i) => i.id === selectedItp)
                  if (!itp || (!itp.semaineSemis && !itp.semainePlantation && !itp.semaineRecolte)) return null
                  return (
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded p-2 mt-2">
                      <span>
                        💡 Dates pré-remplies depuis l'ITP <strong>{itp.id}</strong> (
                        {[
                          itp.semaineSemis ? `${formatSemaine(itp.semaineSemis)} semis` : null,
                          itp.semainePlantation ? `${formatSemaine(itp.semainePlantation)} plantation` : null,
                          itp.semaineRecolte ? `${formatSemaine(itp.semaineRecolte)} récolte` : null,
                        ].filter(Boolean).join(" · ")}). Modifiable.
                      </span>
                      <button
                        type="button"
                        className="text-blue-700 underline hover:text-blue-900"
                        onClick={() => {
                          const year = form.getValues("annee") || new Date().getFullYear()
                          if (itp.semaineSemis) form.setValue("dateSemis", weekToDate(year, itp.semaineSemis))
                          if (itp.semainePlantation) form.setValue("datePlantation", weekToDate(year, itp.semainePlantation))
                          if (itp.semaineRecolte) form.setValue("dateRecolte", weekToDate(year, itp.semaineRecolte))
                        }}
                      >
                        Resynchroniser
                      </button>
                    </div>
                  )
                })()}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="dateSemis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date semis</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              field.onChange(e.target.value ? new Date(e.target.value) : null)
                              setDateSemisInfo(null)
                            }}
                          />
                        </FormControl>
                        {dateSemisInfo && (
                          <p className="text-xs text-amber-700 mt-1">{dateSemisInfo}</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="datePlantation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date plantation</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? new Date(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateRecolte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date récolte</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? new Date(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quantités</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="longueur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longueur (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nbRangs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nb rangs</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="espacement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espacement (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel
                          title="Formule : nbRangs × ⌊longueur (cm) ÷ espacement⌋. Si vous modifiez ce champ, la valeur n'est plus recalculée."
                          className="cursor-help"
                        >
                          Quantité / plants (auto) ⓘ
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Notes sur cette culture..."
                          rows={3}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Link href="/maraichage/cultures">
                <Button variant="outline">Annuler</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </main>

      {/* Bug #1 — Modale alerte violation de rotation. */}
      <Dialog
        open={rotationWarning !== null}
        onOpenChange={(open) => {
          if (!open) setRotationWarning(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚠️ Plan de rotation non respecté
            </DialogTitle>
            <DialogDescription>
              Cette planche suit un plan de rotation qui prévoit une autre famille botanique cette année.
            </DialogDescription>
          </DialogHeader>
          {rotationWarning && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900">
                {rotationWarning.violation.message}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Famille attendue</div>
                  <div className="font-medium">
                    {rotationWarning.violation.familleAttendue ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Famille demandée</div>
                  <div className="font-medium">
                    {rotationWarning.violation.familleDemandee ?? "—"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Si vous continuez, la culture sera créée mais marquée « rotation violée » pour traçabilité.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRotationWarning(null)}>
              Annuler
            </Button>
            {rotationWarning && (
              <Link
                href={`/maraichage/rotations/${encodeURIComponent(rotationWarning.violation.rotationId)}`}
                target="_blank"
              >
                <Button variant="outline">Voir la rotation</Button>
              </Link>
            )}
            <Button
              variant="default"
              onClick={() => {
                if (!rotationWarning) return
                const payload = rotationWarning.payload
                setRotationWarning(null)
                void submitCulture(payload, true)
              }}
              disabled={isSubmitting}
            >
              Continuer quand même
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
