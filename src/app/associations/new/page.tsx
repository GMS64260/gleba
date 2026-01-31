"use client"

/**
 * Page creation d'une nouvelle association de plantes
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Heart, Save, Plus, Trash2 } from "lucide-react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createAssociationSchema, type CreateAssociationInput } from "@/lib/validations/association"

interface Espece {
  id: string
  familleId: string | null
}

interface Famille {
  id: string
}

export default function NewAssociationPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [especes, setEspeces] = React.useState<Espece[]>([])
  const [familles, setFamilles] = React.useState<Famille[]>([])

  // Charger les especes et familles
  React.useEffect(() => {
    async function loadData() {
      try {
        const [especesRes, famillesRes] = await Promise.all([
          fetch("/api/especes?pageSize=500"),
          fetch("/api/familles"),
        ])
        if (especesRes.ok) {
          const data = await especesRes.json()
          setEspeces(data.data || data)
        }
        if (famillesRes.ok) {
          const data = await famillesRes.json()
          setFamilles(data)
        }
      } catch (error) {
        console.error("Erreur chargement donnees:", error)
      }
    }
    loadData()
  }, [])

  const form = useForm<CreateAssociationInput>({
    resolver: zodResolver(createAssociationSchema),
    defaultValues: {
      nom: "",
      description: null,
      notes: null,
      details: [{ especeId: null, familleId: null, groupe: null, requise: false, notes: null }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  })

  const onSubmit = async (data: CreateAssociationInput) => {
    setIsSubmitting(true)
    try {
      // Filtrer les details vides
      const filteredDetails = data.details?.filter(
        (d) => d.especeId || d.familleId || d.groupe
      )

      const response = await fetch("/api/associations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, details: filteredDetails }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la creation")
      }

      toast({
        title: "Association creee",
        description: `L'association "${data.nom}" a ete creee avec succes`,
      })
      router.push("/associations")
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
          <Link href="/associations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-600" />
            <h1 className="text-xl font-bold">Nouvelle association</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Informations generales */}
            <Card>
              <CardHeader>
                <CardTitle>Informations generales</CardTitle>
                <CardDescription>
                  Nom et description de l'association
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Tomates-Basilic" {...field} />
                      </FormControl>
                      <FormDescription>
                        Nom unique pour identifier cette association
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Description de l'association..."
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

            {/* Details - Especes/Familles */}
            <Card>
              <CardHeader>
                <CardTitle>Plantes associees</CardTitle>
                <CardDescription>
                  Ajoutez les especes ou familles qui font partie de cette association.
                  Cochez "Requise" si c'est une association necessaire.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name={`details.${index}.especeId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Espece</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v === "_none_" ? null : v)}
                              value={field.value || "_none_"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="_none_">Aucune</SelectItem>
                                {especes.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`details.${index}.familleId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Famille</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v === "_none_" ? null : v)}
                              value={field.value || "_none_"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="_none_">Aucune</SelectItem>
                                {familles.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`details.${index}.groupe`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Groupe (libre)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: Liliacees"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`details.${index}.requise`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-xs !mt-0">Requise</FormLabel>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-6"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ especeId: null, familleId: null, groupe: null, requise: false, notes: null })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une plante
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
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
                          placeholder="Notes complementaires..."
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

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/associations")}
              >
                Annuler
              </Button>
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
