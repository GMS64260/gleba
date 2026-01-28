"use client"

/**
 * Page de création d'une nouvelle planche
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, LayoutGrid, Save } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { createPlancheSchema, type CreatePlancheInput } from "@/lib/validations"

export default function NewPlanchePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<CreatePlancheInput>({
    resolver: zodResolver(createPlancheSchema),
    defaultValues: {
      id: "",
      largeur: 0.8,
      longueur: 10,
      ilot: null,
      notes: null,
    },
  })

  const largeur = form.watch("largeur")
  const longueur = form.watch("longueur")
  const surface = (largeur || 0) * (longueur || 0)

  const onSubmit = async (data: CreatePlancheInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/planches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          surface: (data.largeur || 0) * (data.longueur || 0),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la création")
      }

      toast({
        title: "Planche créée",
        description: `La planche "${data.id}" a été créée avec succès`,
      })
      router.push("/planches")
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
          <Link href="/planches">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-amber-600" />
            <h1 className="text-xl font-bold">Nouvelle planche</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-6 max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la planche *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: P01, A-1, Nord-1..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ilot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Îlot / Zone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Nord, Serre, Jardin..."
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

            <Card>
              <CardHeader>
                <CardTitle>Dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="largeur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Largeur (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
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
                    name="longueur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longueur (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
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

                <div className="p-4 bg-gray-100 rounded-lg text-center">
                  <div className="text-sm text-muted-foreground">Surface calculée</div>
                  <div className="text-2xl font-bold">{surface.toFixed(1)} m²</div>
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
                          placeholder="Notes sur cette planche..."
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
              <Link href="/planches">
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
