"use client"

/**
 * Page d'edition d'une espece - Version enrichie avec onglets
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Leaf, Save, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  updateEspeceSchema,
  type UpdateEspeceInput,
  ESPECE_CATEGORIES,
  ESPECE_NIVEAUX,
  ESPECE_IRRIGATION,
} from "@/lib/validations/espece"

export default function EditEspecePage() {
  const router = useRouter()
  const params = useParams()
  const especeId = decodeURIComponent(params.id as string)
  const { toast } = useToast()
  const [familles, setFamilles] = React.useState<{ id: string }[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<UpdateEspeceInput>({
    resolver: zodResolver(updateEspeceSchema),
    defaultValues: {
      familleId: null,
      nomLatin: null,
      rendement: null,
      vivace: false,
      besoinN: null,
      besoinP: null,
      besoinK: null,
      besoinEau: null,
      aPlanifier: true,
      couleur: null,
      description: null,
      categorie: null,
      niveau: null,
      densite: null,
      doseSemis: null,
      tauxGermination: null,
      temperatureGerm: null,
      joursLevee: null,
      irrigation: null,
      conservation: null,
      effet: null,
      usages: null,
      objectifAnnuel: null,
      prixKg: null,
      semaineTaille: null,
    },
  })

  // Charger les donnees
  React.useEffect(() => {
    Promise.all([
      fetch("/api/familles").then((res) => res.json()),
      fetch(`/api/especes/${encodeURIComponent(especeId)}`).then((res) => {
        if (!res.ok) throw new Error("Espece non trouvee")
        return res.json()
      }),
    ])
      .then(([famillesData, especeData]) => {
        setFamilles(Array.isArray(famillesData) ? famillesData : [])
        form.reset({
          familleId: especeData.familleId || null,
          nomLatin: especeData.nomLatin || null,
          rendement: especeData.rendement || null,
          vivace: especeData.vivace || false,
          besoinN: especeData.besoinN || null,
          besoinP: especeData.besoinP || null,
          besoinK: especeData.besoinK || null,
          besoinEau: especeData.besoinEau || null,
          aPlanifier: especeData.aPlanifier ?? true,
          couleur: especeData.couleur || null,
          description: especeData.description || null,
          categorie: especeData.categorie || null,
          niveau: especeData.niveau || null,
          densite: especeData.densite || null,
          doseSemis: especeData.doseSemis || null,
          tauxGermination: especeData.tauxGermination || null,
          temperatureGerm: especeData.temperatureGerm || null,
          joursLevee: especeData.joursLevee || null,
          irrigation: especeData.irrigation || null,
          conservation: especeData.conservation || null,
          effet: especeData.effet || null,
          usages: especeData.usages || null,
          objectifAnnuel: especeData.objectifAnnuel || null,
          prixKg: especeData.prixKg || null,
          semaineTaille: especeData.semaineTaille || null,
        })
        setIsLoading(false)
      })
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message,
        })
        router.push("/especes")
      })
  }, [especeId, form, router, toast])

  const onSubmit = async (data: UpdateEspeceInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/especes/${encodeURIComponent(especeId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la mise a jour")
      }

      toast({
        title: "Espece modifiee",
        description: `L'espece "${especeId}" a ete mise a jour`,
      })
      router.push("/especes")
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
    if (!confirm(`Supprimer l'espece "${especeId}" ?`)) return

    try {
      const response = await fetch(`/api/especes/${encodeURIComponent(especeId)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la suppression")
      }

      toast({
        title: "Espece supprimee",
        description: `L'espece "${especeId}" a ete supprimee`,
      })
      router.push("/especes")
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
        <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
          <Skeleton className="h-64 w-full" />
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
            <Link href="/especes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Leaf className="h-6 w-6 text-emerald-600" />
              <h1 className="text-xl font-bold">Modifier : {especeId}</h1>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="culture">Culture</TabsTrigger>
                <TabsTrigger value="recolte">Recolte</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              {/* Onglet General */}
              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations generales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Nom de l&apos;espece</p>
                      <p className="font-medium">{especeId}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="familleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Famille botanique</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {familles.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.id}
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
                        name="categorie"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categorie</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ESPECE_CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="nomLatin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom latin</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: Solanum lycopersicum"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="niveau"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Niveau de difficulte</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ESPECE_NIVEAUX.map((n) => (
                                  <SelectItem key={n} value={n}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-6">
                      <FormField
                        control={form.control}
                        name="vivace"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Vivace</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="aPlanifier"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">A planifier</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="conservation"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Se conserve</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="couleur"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Couleur d&apos;affichage</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                className="w-12 h-10 p-1"
                                value={field.value || "#22c55e"}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                              <Input
                                placeholder="#22c55e"
                                {...field}
                                value={field.value || ""}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Culture */}
              <TabsContent value="culture">
                <Card>
                  <CardHeader>
                    <CardTitle>Parametres de culture</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="densite"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Densite (plants/m2)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 4"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="doseSemis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dose semis (g/m2)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 2.5"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="irrigation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Besoin irrigation</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ESPECE_IRRIGATION.map((i) => (
                                  <SelectItem key={i} value={i}>
                                    {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="tauxGermination"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taux germination (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Ex: 85"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="temperatureGerm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Temperature germination</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: 15-25C"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="joursLevee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jours de levee</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Ex: 7"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="besoinN"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Besoin N (1-5)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="besoinP"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Besoin P (1-5)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="besoinK"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Besoin K (1-5)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="besoinEau"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Besoin eau (1-5)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="semaineTaille"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Semaine de taille (1-52)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="52"
                              placeholder="Ex: 10"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value) : null)
                              }
                            />
                          </FormControl>
                          <FormDescription>Pour les arbres et arbustes</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Onglet Recolte */}
              <TabsContent value="recolte">
                <Card>
                  <CardHeader>
                    <CardTitle>Recolte et valorisation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="rendement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rendement (kg/m2)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 5"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="objectifAnnuel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Objectif annuel (kg)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 50"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
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
                        name="prixKg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prix de vente (euro/kg)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 3.50"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="inventaire"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stock actuel (kg)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 10"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
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
              </TabsContent>

              {/* Onglet Notes */}
              <TabsContent value="notes">
                <Card>
                  <CardHeader>
                    <CardTitle>Notes et informations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="effet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effet sur le sol / autres plantes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ex: Fixe l'azote, eloigne les pucerons..."
                              rows={3}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="usages"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usages culinaires</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ex: Salades, soupes, conserves..."
                              rows={3}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes generales</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Conseils de culture, particularites..."
                              rows={4}
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
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-4">
              <Link href="/especes">
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
