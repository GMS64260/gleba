"use client"

/**
 * Page edition d'une Rotation
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, RefreshCw, Save, Plus, Trash2, LayoutGrid } from "lucide-react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { updateRotationSchema, type UpdateRotationInput } from "@/lib/validations"

interface ITP {
  id: string
  especeId: string | null
  espece: {
    id: string
    couleur: string | null
    famille: { id: string } | null
  } | null
}

interface Planche {
  id: string
  ilot: string | null
  longueur: number | null
  largeur: number | null
}

interface RotationData {
  id: string
  active: boolean
  nbAnnees: number | null
  notes: string | null
  details: {
    id: number
    annee: number
    itpId: string | null
    itp: ITP | null
  }[]
  planches: Planche[]
  _count: { planches: number }
}

export default function EditRotationPage() {
  const router = useRouter()
  const params = useParams()
  const id = decodeURIComponent(params.id as string)
  const { toast } = useToast()

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [itps, setItps] = React.useState<ITP[]>([])
  const [rotationData, setRotationData] = React.useState<RotationData | null>(null)
  // PROMPT 12 — gestion du rattachement multi-planches
  const [allPlanches, setAllPlanches] = React.useState<Array<{ id: string; nom: string; ilot: string | null; rotationId: string | null }>>([])
  const [selectedPlancheIds, setSelectedPlancheIds] = React.useState<Set<string>>(new Set())
  const [isSavingPlanches, setIsSavingPlanches] = React.useState(false)

  const form = useForm<UpdateRotationInput>({
    resolver: zodResolver(updateRotationSchema),
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  })

  // Charger les donnees
  React.useEffect(() => {
    async function loadData() {
      try {
        const [itpsRes, rotationRes, planchesRes] = await Promise.all([
          fetch("/api/itps?pageSize=500"),
          fetch(`/api/rotations/${encodeURIComponent(id)}`),
          fetch("/api/planches?pageSize=500"),
        ])

        if (planchesRes.ok) {
          const planchesData = await planchesRes.json()
          const planchesList = (planchesData?.data || []) as typeof allPlanches
          setAllPlanches(planchesList)
        }

        if (itpsRes.ok) {
          const itpsData = await itpsRes.json()
          setItps(itpsData.data)
        }

        if (!rotationRes.ok) {
          throw new Error("Rotation non trouvee")
        }

        const rotation: RotationData = await rotationRes.json()
        setRotationData(rotation)
        // PROMPT 12 — pré-cocher les planches déjà rattachées.
        setSelectedPlancheIds(new Set(rotation.planches.map((p) => p.id)))

        // Remplir le formulaire
        form.reset({
          active: rotation.active,
          nbAnnees: rotation.nbAnnees,
          notes: rotation.notes,
          details: rotation.details.length > 0
            ? rotation.details.map(d => ({ annee: d.annee, itpId: d.itpId }))
            : [{ annee: 1, itpId: null }],
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger la rotation",
        })
        router.push("/rotations")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id, form, toast, router])

  const handleSavePlanches = async () => {
    setIsSavingPlanches(true)
    try {
      const res = await fetch(`/api/rotations/${encodeURIComponent(id)}/planches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plancheIds: [...selectedPlancheIds] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast({ title: `${data.count} planche(s) rattachée(s) à la rotation` })
      // Refresh rotationData planches
      if (rotationData) setRotationData({ ...rotationData, planches: data.planches, _count: { planches: data.count } })
    } catch {
      toast({ variant: "destructive", title: "Erreur lors du rattachement" })
    } finally {
      setIsSavingPlanches(false)
    }
  }

  const togglePlanche = (plancheId: string) => {
    setSelectedPlancheIds((prev) => {
      const next = new Set(prev)
      if (next.has(plancheId)) next.delete(plancheId)
      else next.add(plancheId)
      return next
    })
  }

  const onSubmit = async (data: UpdateRotationInput) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/rotations/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        // Le superRefine Zod retourne details.fieldErrors par champ.
        const fieldErrors = error?.details?.fieldErrors as Record<string, string[]> | undefined
        const messages = fieldErrors
          ? Object.values(fieldErrors).flat().join(" · ")
          : error.error
        throw new Error(messages || "Erreur lors de la mise à jour")
      }

      toast({
        title: "Rotation mise à jour",
        description: `La rotation "${id}" a été modifiée`,
      })
      router.push("/maraichage/rotations")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la mise à jour",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!rotationData) return

    if (rotationData._count.planches > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `Cette rotation est utilisee par ${rotationData._count.planches} planche(s)`,
      })
      return
    }

    if (!confirm(`Supprimer la rotation "${id}" ?`)) return

    try {
      const response = await fetch(`/api/rotations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression")
      }

      toast({
        title: "Rotation supprimée",
        description: `La rotation "${id}" a ete supprimee`,
      })
      router.push("/rotations")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la rotation",
      })
    }
  }

  const addYear = () => {
    const nextYear = fields.length + 1
    append({ annee: nextYear, itpId: null })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/maraichage/rotations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Rotations
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-6 w-6 text-orange-600" />
              <h1 className="text-xl font-bold">{id}</h1>
            </div>
          </div>
          {rotationData && (
            <Badge variant="outline">
              <LayoutGrid className="h-3 w-3 mr-1" />
              {rotationData._count.planches} planche(s)
            </Badge>
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
                <CardDescription>État de la rotation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-slate-100 rounded-md">
                  <span className="text-sm text-slate-500">Identifiant: </span>
                  <span className="font-medium">{id}</span>
                </div>

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => {
                    // Bug #1 — Active désactivable uniquement si plan complet.
                    const details = form.watch("details") ?? []
                    const planComplet = details.length > 0 && details.some((d) => d.itpId)
                    const cycleCoherent =
                      !form.watch("nbAnnees") || form.watch("nbAnnees") === details.length
                    const peutActiver = planComplet && cycleCoherent
                    return (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            {peutActiver
                              ? "Rotation utilisable pour la planification"
                              : "Plan incomplet : impossible d'activer cette rotation"}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              if (checked && !peutActiver) {
                                toast({
                                  variant: "destructive",
                                  title: "Plan incomplet",
                                  description:
                                    "Ajoutez au moins une étape avec un ITP et vérifiez que le cycle correspond.",
                                })
                                return
                              }
                              field.onChange(checked)
                            }}
                            disabled={!peutActiver && !field.value}
                          />
                        </FormControl>
                      </FormItem>
                    )
                  }}
                />
              </CardContent>
            </Card>

            {/* Plan de rotation */}
            <Card>
              <CardHeader>
                <CardTitle>Plan de rotation</CardTitle>
                <CardDescription>
                  ITP pour chaque annee du cycle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
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
                                <SelectValue placeholder="Sélectionner un ITP" />
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

            {/* Planches utilisant cette rotation (PROMPT 12 — gestion multi-planches) */}
            <Card>
              <CardHeader>
                <CardTitle>Planches associées</CardTitle>
                <CardDescription>
                  {selectedPlancheIds.size} planche(s) cochée(s) · cochez les planches sur lesquelles appliquer cette rotation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const cycle = form.watch("nbAnnees") ?? rotationData?.nbAnnees ?? null
                  const nbEtapes = form.watch("details")?.length ?? rotationData?.details.length ?? 0
                  if (cycle && nbEtapes > 0 && cycle !== nbEtapes) {
                    return (
                      <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                        ⚠ Le cycle déclaré ({cycle} ans) ne correspond pas au nombre d'étapes saisies ({nbEtapes}).
                        Ajoutez une étape manquante ou ajustez le cycle.
                      </div>
                    )
                  }
                  return null
                })()}
                {allPlanches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune planche disponible.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto rounded border p-2">
                    {allPlanches.map((p) => {
                      const checked = selectedPlancheIds.has(p.id)
                      const usedElsewhere = !checked && p.rotationId && p.rotationId !== id
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePlanche(p.id)}
                            className="h-4 w-4"
                          />
                          <span className="font-medium">{p.nom}</span>
                          {p.ilot && <span className="text-muted-foreground text-xs">({p.ilot})</span>}
                          {usedElsewhere && (
                            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                              déjà sur {p.rotationId}
                            </Badge>
                          )}
                          <Link
                            href={`/maraichage/planches/${encodeURIComponent(p.id)}`}
                            className="ml-auto text-xs text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            voir
                          </Link>
                        </label>
                      )
                    })}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSavePlanches}
                    disabled={isSavingPlanches}
                    size="sm"
                  >
                    {isSavingPlanches ? "Sauvegarde…" : "Enregistrer les planches"}
                  </Button>
                </div>
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
            <div className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={!rotationData || rotationData._count.planches > 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <div className="flex gap-4">
                <Link href="/maraichage/rotations">
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
