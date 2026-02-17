"use client"

/**
 * Page d'édition d'une culture
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Sprout, Save, Trash2 } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { updateCultureSchema, type UpdateCultureInput } from "@/lib/validations"

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

export default function EditCulturePage() {
  const router = useRouter()
  const params = useParams()
  const cultureId = params.id as string
  const { toast } = useToast()
  const [especes, setEspeces] = React.useState<{ id: string }[]>([])
  const [varietes, setVarietes] = React.useState<{ id: string; especeId: string }[]>([])
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [planches, setPlanches] = React.useState<{ id: string; nom?: string; longueur: number | null }[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  // Empêcher l'auto-remplissage au chargement initial
  const initialLoadDone = React.useRef(false)
  const initialItpId = React.useRef<string | null>(null)
  // Mémoriser les valeurs de l'ITP précédent pour la logique d'écrasement intelligent
  const prevItpNbRangs = React.useRef<number | null>(null)
  const prevItpEspacement = React.useRef<number | null>(null)

  const form = useForm<UpdateCultureInput>({
    resolver: zodResolver(updateCultureSchema),
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
  const selectedItp = form.watch("itpId")
  const watchedNbRangs = form.watch("nbRangs")
  const watchedLongueur = form.watch("longueur")
  const watchedEspacement = form.watch("espacement")

  // ITP actuellement sélectionné (pour indicateurs "depuis l'ITP")
  const currentItp = React.useMemo(() => itps.find((i) => i.id === selectedItp), [itps, selectedItp])
  const nbRangsDepuisITP = !!currentItp?.nbRangs && watchedNbRangs === currentItp.nbRangs
  const espacementDepuisITP = !!currentItp?.espacement && watchedEspacement === Math.round(currentItp.espacement)

  // Charger les données
  React.useEffect(() => {
    Promise.all([
      fetch("/api/especes?pageSize=500").then((r) => r.json()),
      fetch("/api/planches?pageSize=500").then((r) => r.json()),
      fetch(`/api/cultures/${cultureId}`).then((res) => {
        if (!res.ok) throw new Error("Culture non trouvée")
        return res.json()
      }),
    ])
      .then(([especesData, planchesData, cultureData]) => {
        setEspeces(especesData.data || [])
        setPlanches(planchesData.data || [])

        // Mémoriser l'ITP initial pour ne pas écraser les données existantes
        initialItpId.current = cultureData.itpId || null
        // Mémoriser les valeurs initiales de nbRangs/espacement de l'ITP
        prevItpNbRangs.current = cultureData.nbRangs || null
        prevItpEspacement.current = cultureData.espacement || null

        // Remplir le formulaire
        form.reset({
          especeId: cultureData.especeId || "",
          varieteId: cultureData.varieteId || null,
          itpId: cultureData.itpId || null,
          plancheId: cultureData.plancheId || null,
          annee: cultureData.annee || new Date().getFullYear(),
          dateSemis: cultureData.dateSemis || null,
          datePlantation: cultureData.datePlantation || null,
          dateRecolte: cultureData.dateRecolte || null,
          semisFait: cultureData.semisFait || false,
          plantationFaite: cultureData.plantationFaite || false,
          recolteFaite: cultureData.recolteFaite || false,
          terminee: cultureData.terminee || null,
          quantite: cultureData.quantite || null,
          nbRangs: cultureData.nbRangs || null,
          longueur: cultureData.longueur || null,
          espacement: cultureData.espacement || null,
          notes: cultureData.notes || null,
        })
        setIsLoading(false)
        // Marquer le chargement initial comme terminé après le prochain cycle de rendu
        setTimeout(() => { initialLoadDone.current = true }, 100)
      })
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message,
        })
        router.push("/cultures")
      })
  }, [cultureId, form, router, toast])

  // Charger les variétés et ITPs quand l'espèce change
  React.useEffect(() => {
    if (selectedEspece) {
      Promise.all([
        fetch(`/api/especes/${encodeURIComponent(selectedEspece)}`).then((r) => r.json()),
        fetch(`/api/itps?especeId=${encodeURIComponent(selectedEspece)}&pageSize=500`).then((r) => r.json()),
      ])
        .then(([especeData, itpsData]) => {
          setVarietes(especeData.varietes || [])
          setItps(itpsData.data || [])
        })
        .catch(() => {
          setVarietes([])
          setItps([])
        })
    } else {
      setVarietes([])
      setItps([])
    }
  }, [selectedEspece])

  // Quand l'ITP change (seulement si c'est un changement utilisateur, pas le chargement initial)
  React.useEffect(() => {
    if (!initialLoadDone.current) return
    if (!selectedItp) return
    // Si c'est le même ITP qu'au chargement, ne rien écraser
    if (selectedItp === initialItpId.current) return

    const itp = itps.find((i) => i.id === selectedItp)
    if (!itp) return

    const year = form.getValues("annee") || new Date().getFullYear()

    if (itp.semaineSemis) {
      form.setValue("dateSemis", weekToDate(year, itp.semaineSemis))
    }
    if (itp.semainePlantation) {
      form.setValue("datePlantation", weekToDate(year, itp.semainePlantation))
    }
    if (itp.semaineRecolte) {
      form.setValue("dateRecolte", weekToDate(year, itp.semaineRecolte))
    }

    // Auto-remplir nbRangs seulement si vide ou encore égal à la valeur de l'ITP précédent
    const currentNbRangs = form.getValues("nbRangs")
    if (itp.nbRangs && (!currentNbRangs || currentNbRangs === prevItpNbRangs.current)) {
      form.setValue("nbRangs", itp.nbRangs)
    }

    // Auto-remplir espacement seulement si vide ou encore égal à la valeur de l'ITP précédent
    const currentEspacement = form.getValues("espacement")
    const itpEspacement = itp.espacement ? Math.round(itp.espacement) : null
    if (itpEspacement && (!currentEspacement || currentEspacement === prevItpEspacement.current)) {
      form.setValue("espacement", itpEspacement)
    }

    // Mémoriser les valeurs de cet ITP pour la prochaine comparaison
    prevItpNbRangs.current = itp.nbRangs ?? null
    prevItpEspacement.current = itpEspacement

    // Mettre à jour la référence pour les changements suivants
    initialItpId.current = selectedItp
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
    if (!initialLoadDone.current) return
    if (watchedNbRangs && watchedLongueur && watchedEspacement && watchedEspacement > 0) {
      const quantite = watchedNbRangs * Math.floor((watchedLongueur * 100) / watchedEspacement)
      form.setValue("quantite", quantite)
    }
  }, [watchedNbRangs, watchedLongueur, watchedEspacement, form])

  const onSubmit = async (data: UpdateCultureInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/cultures/${cultureId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la mise à jour")
      }

      toast({
        title: "Culture modifiée",
        description: `La culture #${cultureId} a été mise à jour`,
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

  const handleDelete = async () => {
    if (!confirm(`Supprimer la culture #${cultureId} ?`)) return

    try {
      const response = await fetch(`/api/cultures/${cultureId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la suppression")
      }

      toast({
        title: "Culture supprimée",
      })
      router.push("/cultures")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cultures">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sprout className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Modifier culture #{cultureId}</h1>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
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
                <CardTitle>Dates et état</CardTitle>
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
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? e.target.value : null)
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
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? e.target.value : null)
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
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? e.target.value : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                  <FormField
                    control={form.control}
                    name="semisFait"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Semis fait</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plantationFaite"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Plantation faite</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recolteFaite"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Récolte faite</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="terminee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terminée</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Non terminée" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="x">Terminée</SelectItem>
                          <SelectItem value="v">Vivace (continue)</SelectItem>
                          <SelectItem value="NS">Non significative</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        {nbRangsDepuisITP && (
                          <p className="text-xs text-blue-600">depuis l'ITP</p>
                        )}
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
                        {espacementDepuisITP && (
                          <p className="text-xs text-blue-600">depuis l'ITP</p>
                        )}
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
