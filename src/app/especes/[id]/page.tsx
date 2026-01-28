"use client"

/**
 * Page d'édition d'une espèce
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { updateEspeceSchema, type UpdateEspeceInput } from "@/lib/validations"

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
    },
  })

  // Charger les données
  React.useEffect(() => {
    Promise.all([
      fetch("/api/familles").then((res) => res.json()),
      fetch(`/api/especes/${encodeURIComponent(especeId)}`).then((res) => {
        if (!res.ok) throw new Error("Espèce non trouvée")
        return res.json()
      }),
    ])
      .then(([famillesData, especeData]) => {
        setFamilles(Array.isArray(famillesData) ? famillesData : [])
        // Remplir le formulaire avec les données existantes
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
        throw new Error(error.error || "Erreur lors de la mise à jour")
      }

      toast({
        title: "Espèce modifiée",
        description: `L'espèce "${especeId}" a été mise à jour`,
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
    if (!confirm(`Supprimer l'espèce "${especeId}" ?`)) return

    try {
      const response = await fetch(`/api/especes/${encodeURIComponent(especeId)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la suppression")
      }

      toast({
        title: "Espèce supprimée",
        description: `L'espèce "${especeId}" a été supprimée`,
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
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Nom de l&apos;espèce</p>
                  <p className="font-medium">{especeId}</p>
                </div>

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
                            <SelectValue placeholder="Sélectionner une famille" />
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

                <div className="flex gap-4">
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
                        <FormLabel className="!mt-0">À planifier</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Caractéristiques agronomiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="rendement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rendement (kg/m²)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Ex: 5"
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

                <FormField
                  control={form.control}
                  name="couleur"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Couleur (hex)</FormLabel>
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

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Notes, conseils de culture..."
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
