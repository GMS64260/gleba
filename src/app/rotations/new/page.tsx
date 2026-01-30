"use client"

/**
 * Page creation d'une nouvelle Rotation
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw, Save, Plus, Trash2 } from "lucide-react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { createRotationSchema, type CreateRotationInput } from "@/lib/validations"

interface ITP {
  id: string
  especeId: string | null
  espece: {
    id: string
    couleur: string | null
    famille: { id: string } | null
  } | null
}

export default function NewRotationPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [itps, setItps] = React.useState<ITP[]>([])

  // Charger les ITPs
  React.useEffect(() => {
    async function loadItps() {
      try {
        const response = await fetch("/api/itps?pageSize=500")
        if (response.ok) {
          const data = await response.json()
          setItps(data.data)
        }
      } catch (error) {
        console.error("Erreur chargement ITPs:", error)
      }
    }
    loadItps()
  }, [])

  const form = useForm<CreateRotationInput>({
    resolver: zodResolver(createRotationSchema),
    defaultValues: {
      id: "",
      active: true,
      nbAnnees: null,
      notes: null,
      details: [{ annee: 1, itpId: null }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  })

  const onSubmit = async (data: CreateRotationInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/rotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la creation")
      }

      toast({
        title: "Rotation creee",
        description: `La rotation "${data.id}" a ete creee avec succes`,
      })
      router.push("/rotations")
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

  const addYear = () => {
    const nextYear = fields.length + 1
    append({ annee: nextYear, itpId: null })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/rotations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Rotations
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-bold">Nouvelle rotation</h1>
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
                <CardDescription>Nom et etat de la rotation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la rotation *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Rotation-A, Solanacees-4ans" {...field} />
                      </FormControl>
                      <FormDescription>
                        Identifiant unique de la rotation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Rotation utilisable pour la planification
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Plan de rotation */}
            <Card>
              <CardHeader>
                <CardTitle>Plan de rotation</CardTitle>
                <CardDescription>
                  Definissez l'ITP pour chaque annee du cycle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <Badge variant="outline" className="shrink-0">
                      Annee {index + 1}
                    </Badge>
                    <FormField
                      control={form.control}
                      name={`details.${index}.itpId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={(value) => field.onChange(value === "_none" ? null : value)}
                            value={field.value || "_none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectionner un ITP" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_none">
                                <span className="text-muted-foreground">Aucun (jachere)</span>
                              </SelectItem>
                              {itps.map((itp) => (
                                <SelectItem key={itp.id} value={itp.id}>
                                  <div className="flex items-center gap-2">
                                    {itp.espece?.couleur && (
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: itp.espece.couleur }}
                                      />
                                    )}
                                    {itp.id}
                                    {itp.espece && (
                                      <span className="text-muted-foreground">
                                        ({itp.espece.id})
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="shrink-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addYear}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une annee
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
                          placeholder="Notes, objectifs de la rotation..."
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
              <Link href="/rotations">
                <Button variant="outline" type="button">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creation..." : "Creer la rotation"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  )
}
