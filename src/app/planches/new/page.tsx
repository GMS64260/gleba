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
import { Combobox } from "@/components/ui/combobox"
import { Textarea } from "@/components/ui/textarea"
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
import { createPlancheSchema, type CreatePlancheInput } from "@/lib/validations"
import { TYPES_PLANCHE, TYPES_IRRIGATION, PRESETS_DIMENSIONS_PLANCHE } from "@/lib/assistant-helpers"

export default function NewPlanchePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [ilotOptions, setIlotOptions] = React.useState<{value: string, label: string}[]>([])

  React.useEffect(() => {
    fetch("/api/planches?pageSize=500").then(r => r.json()).then(data => {
      const planches = data.data || data || []
      const unique = [...new Set(planches.map((p: any) => p.ilot).filter(Boolean))] as string[]
      setIlotOptions(unique.sort().map(v => ({ value: v, label: v })))
    }).catch(() => {})
  }, [])

  const form = useForm<CreatePlancheInput>({
    resolver: zodResolver(createPlancheSchema),
    defaultValues: {
      nom: "",
      largeur: 0.8,
      longueur: 10,
      ilot: null,
      notes: null,
      type: null,
      irrigation: null,
      typeSol: null,
      retentionEau: null,
    },
  })

  // Suggérer un nom automatique basé sur le nombre de planches existantes
  React.useEffect(() => {
    async function fetchPlancheCount() {
      try {
        const res = await fetch('/api/planches?pageSize=1')
        if (res.ok) {
          const data = await res.json()
          const count = data.total || 0
          // Ne remplir que si le champ est encore vide
          if (!form.getValues('nom')) {
            form.setValue('nom', `Planche ${count + 1}`)
          }
        }
      } catch (e) {
        console.error('Error fetching planche count:', e)
      }
    }
    fetchPlancheCount()
  }, [form])

  // Appliquer un preset de dimensions
  const applyPreset = (preset: typeof PRESETS_DIMENSIONS_PLANCHE[number]) => {
    form.setValue('largeur', preset.largeur)
    form.setValue('longueur', preset.longueur)
  }

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
        description: `La planche "${data.nom}" a été créée avec succès`,
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
                  name="nom"
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
                        <Combobox
                          value={field.value || ""}
                          onValueChange={(v) => field.onChange(v || null)}
                          options={ilotOptions}
                          placeholder="Ex: Nord, Serre, Jardin..."
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
                {/* Presets de dimensions */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Dimensions rapides</div>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS_DIMENSIONS_PLANCHE.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant={
                          form.watch('largeur') === preset.largeur && form.watch('longueur') === preset.longueur
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

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
                <CardTitle>Infrastructure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TYPES_PLANCHE.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
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
                    name="irrigation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Irrigation</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TYPES_IRRIGATION.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Qualité du sol</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="typeSol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de sol</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value || null)
                            form.setValue("retentionEau", null)
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Non renseigné" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Argileux">Argileux (lourd)</SelectItem>
                            <SelectItem value="Limoneux">Limoneux (équilibré)</SelectItem>
                            <SelectItem value="Sableux">Sableux (léger)</SelectItem>
                            <SelectItem value="Mixte">Mixte</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retentionEau"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rétention eau</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Non renseigné" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Faible">Faible (arroser+)</SelectItem>
                            <SelectItem value="Moyenne">Moyenne</SelectItem>
                            <SelectItem value="Élevée">Élevée (arroser-)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sol sableux (léger) = arrosage fréquent. Sol argileux (lourd) = arrosage espacé.
                </p>
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
