"use client"

/**
 * Page edition d'un ITP
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Route, Save, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { updateITPSchema, type UpdateITPInput } from "@/lib/validations"

interface Espece {
  id: string
  type: string
  famille: { id: string } | null
}

interface ITPData {
  id: string
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureePepiniere: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  notes: string | null
  espece: { id: string; famille: { id: string } | null } | null
  _count: { cultures: number; rotationsDetails: number }
}

export default function EditITPPage() {
  const router = useRouter()
  const params = useParams()
  const id = decodeURIComponent(params.id as string)
  const { toast } = useToast()

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [especes, setEspeces] = React.useState<Espece[]>([])
  const [itpData, setItpData] = React.useState<ITPData | null>(null)

  const form = useForm<UpdateITPInput>({
    resolver: zodResolver(updateITPSchema),
  })

  // Charger les especes et l'ITP
  React.useEffect(() => {
    async function loadData() {
      try {
        const [especesRes, itpRes] = await Promise.all([
          fetch("/api/especes?pageSize=500"),
          fetch(`/api/itps/${encodeURIComponent(id)}`),
        ])

        if (especesRes.ok) {
          const especesData = await especesRes.json()
          setEspeces(especesData.data)
        }

        if (!itpRes.ok) {
          throw new Error("ITP non trouve")
        }

        const itp: ITPData = await itpRes.json()
        setItpData(itp)

        // Remplir le formulaire
        form.reset({
          especeId: itp.especeId,
          semaineSemis: itp.semaineSemis,
          semainePlantation: itp.semainePlantation,
          semaineRecolte: itp.semaineRecolte,
          dureePepiniere: itp.dureePepiniere,
          dureeCulture: itp.dureeCulture,
          nbRangs: itp.nbRangs,
          espacement: itp.espacement,
          notes: itp.notes,
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger l'ITP",
        })
        router.push("/itps")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id, form, toast, router])

  const onSubmit = async (data: UpdateITPInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/itps/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la mise a jour")
      }

      toast({
        title: "ITP mis a jour",
        description: `L'ITP "${id}" a ete modifie`,
      })
      router.push("/itps")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la mise a jour",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!itpData) return

    if (itpData._count.cultures > 0 || itpData._count.rotationsDetails > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `Cet ITP est utilise dans ${itpData._count.cultures} culture(s) et ${itpData._count.rotationsDetails} rotation(s)`,
      })
      return
    }

    if (!confirm(`Supprimer l'ITP "${id}" ?`)) return

    try {
      const response = await fetch(`/api/itps/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression")
      }

      toast({
        title: "ITP supprime",
        description: `L'ITP "${id}" a ete supprime`,
      })
      router.push("/itps")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'ITP",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
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
            <Link href="/itps">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                ITPs
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Route className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-bold">{id}</h1>
            </div>
          </div>
          {itpData && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {itpData._count.rotationsDetails} rotation(s)
              </Badge>
              <Badge variant="outline">
                {itpData._count.cultures} culture(s)
              </Badge>
            </div>
          )}
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
                <CardDescription>Espece associee</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-gray-100 rounded-md">
                  <span className="text-sm text-gray-500">Identifiant: </span>
                  <span className="font-medium">{id}</span>
                </div>

                <FormField
                  control={form.control}
                  name="especeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espece</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "_none" ? null : value)}
                        value={field.value || "_none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selectionner une espece" />
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
                <CardDescription>Semaines de semis, plantation et recolte (1-52)</CardDescription>
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
                      <FormLabel>Semaine recolte</FormLabel>
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
                <CardTitle>Durees</CardTitle>
                <CardDescription>Durees en jours</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dureePepiniere"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duree pepiniere (jours)</FormLabel>
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
                      <FormLabel>Duree culture (jours)</FormLabel>
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
                <CardTitle>Parametres de plantation</CardTitle>
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
            <div className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={!itpData || itpData._count.cultures > 0 || itpData._count.rotationsDetails > 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <div className="flex gap-4">
                <Link href="/itps">
                  <Button variant="outline" type="button">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </main>
    </div>
  )
}
