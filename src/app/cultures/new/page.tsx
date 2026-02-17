"use client"

/**
 * Page de création d'une nouvelle culture
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sprout, Save } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { createCultureSchema, type CreateCultureInput } from "@/lib/validations"
import { RotationAdviceCompact } from "@/components/planche"

// Convertir un numéro de semaine (1-52) en date pour une année donnée
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
  const [especes, setEspeces] = React.useState<{ id: string }[]>([])
  const [varietes, setVarietes] = React.useState<{ id: string; especeId: string }[]>([])
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [planches, setPlanches] = React.useState<{ id: string; nom?: string; longueur: number | null }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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

  // Charger les données de référence
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

  // Charger les variétés et ITPs quand l'espèce change
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

  // Quand un ITP est sélectionné : remplir dates, nbRangs, espacement
  React.useEffect(() => {
    if (!selectedItp) return
    const itp = itps.find((i) => i.id === selectedItp)
    if (!itp) return

    const year = form.getValues("annee") || new Date().getFullYear()

    // Dates prévisionnelles depuis les semaines ITP
    if (itp.semaineSemis) {
      form.setValue("dateSemis", weekToDate(year, itp.semaineSemis))
    }
    if (itp.semainePlantation) {
      form.setValue("datePlantation", weekToDate(year, itp.semainePlantation))
    }
    if (itp.semaineRecolte) {
      form.setValue("dateRecolte", weekToDate(year, itp.semaineRecolte))
    }

    // Nb rangs et espacement depuis l'ITP
    if (itp.nbRangs) {
      form.setValue("nbRangs", itp.nbRangs)
    }
    if (itp.espacement) {
      form.setValue("espacement", Math.round(itp.espacement))
    }
  }, [selectedItp, itps, form])

  // Mettre à jour la longueur quand la planche change
  React.useEffect(() => {
    if (selectedPlanche) {
      const planche = planches.find((p) => p.id === selectedPlanche)
      if (planche?.longueur) {
        form.setValue("longueur", planche.longueur)
      }
    }
  }, [selectedPlanche, planches, form])

  // Auto-calculer la quantité de plants
  React.useEffect(() => {
    if (watchedNbRangs && watchedLongueur && watchedEspacement && watchedEspacement > 0) {
      const quantite = watchedNbRangs * Math.floor((watchedLongueur * 100) / watchedEspacement)
      form.setValue("quantite", quantite)
    }
  }, [watchedNbRangs, watchedLongueur, watchedEspacement, form])

  const onSubmit = async (data: CreateCultureInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/cultures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la création")
      }

      const culture = await response.json()
      toast({
        title: "Culture créée",
        description: `La culture #${culture.id} a été créée avec succès`,
      })
      router.push("/cultures")
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cultures">
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une espèce" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {especes.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.id}
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
                        <FormLabel>Quantité / plants (auto)</FormLabel>
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
              <Link href="/cultures">
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
    </div>
  )
}
