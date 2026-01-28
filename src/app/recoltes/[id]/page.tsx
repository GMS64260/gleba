"use client"

/**
 * Page d'édition d'une récolte
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, BarChart3, Save, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { format } from "date-fns"

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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface RecolteFormData {
  date: string
  quantite: number
  notes: string | null
}

export default function EditRecoltePage() {
  const router = useRouter()
  const params = useParams()
  const recolteId = params.id as string
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [recolteInfo, setRecolteInfo] = React.useState<{
    especeId: string
    cultureId: number
  } | null>(null)

  const form = useForm<RecolteFormData>({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      quantite: 0,
      notes: null,
    },
  })

  // Charger les données
  React.useEffect(() => {
    fetch(`/api/recoltes/${recolteId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Récolte non trouvée")
        return res.json()
      })
      .then((data) => {
        setRecolteInfo({
          especeId: data.especeId,
          cultureId: data.cultureId,
        })
        form.reset({
          date: data.date ? format(new Date(data.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          quantite: data.quantite || 0,
          notes: data.notes || null,
        })
        setIsLoading(false)
      })
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message,
        })
        router.push("/recoltes")
      })
  }, [recolteId, form, router, toast])

  const onSubmit = async (data: RecolteFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/recoltes/${recolteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          date: new Date(data.date).toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la mise à jour")
      }

      toast({
        title: "Récolte modifiée",
      })
      router.push("/recoltes")
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
    if (!confirm(`Supprimer cette récolte ?`)) return

    try {
      const response = await fetch(`/api/recoltes/${recolteId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la suppression")
      }

      toast({
        title: "Récolte supprimée",
      })
      router.push("/recoltes")
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
        <main className="container mx-auto px-4 py-6 max-w-md">
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
            <Link href="/recoltes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Modifier récolte #{recolteId}</h1>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-6 max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Détails de la récolte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recolteInfo && (
                  <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Espèce:</span>{" "}
                      <span className="font-medium">{recolteInfo.especeId}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Culture:</span>{" "}
                      <span className="font-medium">#{recolteInfo.cultureId}</span>
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>Quantité (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : 0
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notes..."
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
              <Link href="/recoltes">
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
