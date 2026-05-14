"use client"

/**
 * Page creation d'un nouvel ITP
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Route, Save } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { createITPSchema, type CreateITPInput } from "@/lib/validations"

interface Espece {
  id: string
  type: string
  famille: { id: string } | null
}

export default function NewITPPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [especes, setEspeces] = React.useState<Espece[]>([])

  // Charger les especes
  React.useEffect(() => {
    async function loadEspeces() {
      try {
        const response = await fetch("/api/especes?pageSize=500")
        if (response.ok) {
          const data = await response.json()
          setEspeces(data.data)
        }
      } catch (error) {
        console.error("Erreur chargement especes:", error)
      }
    }
    loadEspeces()
  }, [])

  const form = useForm<CreateITPInput>({
    resolver: zodResolver(createITPSchema),
    defaultValues: {
      id: "",
      especeId: null,
      semaineSemis: null,
      semainePlantation: null,
      semaineRecolte: null,
      dureePepiniere: null,
      dureeCulture: null,
      nbRangs: null,
      espacement: null,
      notes: null,
    },
  })

  const onSubmit = async (data: CreateITPInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/itps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la creation")
      }

      toast({
        title: "ITP cree",
        description: `L'ITP "${data.id}" a été créé avec succès`,
      })
      router.push("/itps")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la creation",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/maraichage/itps">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              ITPs
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Route className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold">Nouvel ITP</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Identification */}
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
                <CardDescription>Nom et espèce associée</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l'ITP *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Tomate-precoce" {...field} />
                      </FormControl>
                      <FormDescription>
                        Identifiant unique (ex: Espèce-variante)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="especeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espèce</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "_none" ? null : value)}
                        value={field.value || "_none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une espèce" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Aucune</SelectItem>
                          {especes.map((espece) => (
                            <SelectItem key={espece.id} value={espece.id}>
                              {espece.id} {espece.famille ? `(${espece.famille.id})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Calendrier */}
            <Card>
              <CardHeader>
                <CardTitle>Calendrier</CardTitle>
                <CardDescription>Semaines de semis, plantation et récolte (1-52)</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="semaineSemis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semaine semis</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          placeholder="1-52"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="semainePlantation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semaine plantation</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          placeholder="1-52"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="semaineRecolte"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semaine récolte</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          placeholder="1-52"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Durees */}
            <Card>
              <CardHeader>
                <CardTitle>Durées</CardTitle>
                <CardDescription>Durées en jours</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dureePepiniere"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée pepiniere (jours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          placeholder="Jours en pepiniere"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormDescription>Entre semis et plantation</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dureeCulture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée culture (jours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          placeholder="Jours en planche"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormDescription>Entre plantation et fin</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Parametres de plantation */}
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de plantation</CardTitle>
                <CardDescription>Configuration des rangs et espacements</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nbRangs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de rangs</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          placeholder="Rangs par planche"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="espacement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espacement (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={200}
                          step={0.5}
                          placeholder="Entre plants"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormDescription>Espacement sur le rang</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          placeholder="Notes, conseils, particularites..."
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Link href="/maraichage/itps">
                <Button variant="outline" type="button">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creation..." : "Créer l'ITP"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  )
}
