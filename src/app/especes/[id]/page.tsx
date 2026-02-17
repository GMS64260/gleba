"use client"

/**
 * Page d'edition d'une espece - Version enrichie avec onglets
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Leaf, Save, Trash2, Plus, Pencil } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  updateEspeceSchema,
  type UpdateEspeceInput,
  ESPECE_CATEGORIES,
  ESPECE_NIVEAUX,
  ESPECE_IRRIGATION,
} from "@/lib/validations/espece"

interface Variete {
  id: string
  especeId: string
  fournisseurId: string | null
  fournisseur: { id: string } | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  nbGrainesG: number | null
  prixGraine: number | null
  stockGraines: number | null
  stockPlants: number | null
  bio: boolean
  description: string | null
  _count?: { cultures: number }
}

const EMPTY_VARIETE_FORM = {
  id: "",
  fournisseurId: "",
  bio: false,
  semaineRecolte: "",
  dureeRecolte: "",
  nbGrainesG: "",
  prixGraine: "",
  stockGraines: "",
  stockPlants: "",
  description: "",
}

export default function EditEspecePage() {
  const router = useRouter()
  const params = useParams()
  const especeId = decodeURIComponent(params.id as string)
  const { toast } = useToast()
  const [familles, setFamilles] = React.useState<{ id: string }[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Variétés
  const [varietes, setVarietes] = React.useState<Variete[]>([])
  const [fournisseurs, setFournisseurs] = React.useState<{ id: string }[]>([])
  const [showVarieteDialog, setShowVarieteDialog] = React.useState(false)
  const [editingVariete, setEditingVariete] = React.useState<Variete | null>(null)
  const [varieteForm, setVarieteForm] = React.useState(EMPTY_VARIETE_FORM)

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
      fetch("/api/comptabilite/fournisseurs?pageSize=500").then((res) => res.json()).catch(() => ({ data: [] })),
    ])
      .then(([famillesData, especeData, fournisseursData]) => {
        setFamilles(Array.isArray(famillesData) ? famillesData : [])
        setVarietes(especeData.varietes || [])
        setFournisseurs(fournisseursData.data || fournisseursData || [])
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

  // --- Variétés handlers ---
  const resetVarieteForm = () => {
    setVarieteForm(EMPTY_VARIETE_FORM)
    setEditingVariete(null)
  }

  const openEditVariete = (v: Variete) => {
    setEditingVariete(v)
    setVarieteForm({
      id: v.id,
      fournisseurId: v.fournisseurId || "",
      bio: v.bio,
      semaineRecolte: v.semaineRecolte?.toString() || "",
      dureeRecolte: v.dureeRecolte?.toString() || "",
      nbGrainesG: v.nbGrainesG?.toString() || "",
      prixGraine: v.prixGraine?.toString() || "",
      stockGraines: v.stockGraines?.toString() || "",
      stockPlants: v.stockPlants?.toString() || "",
      description: v.description || "",
    })
    setShowVarieteDialog(true)
  }

  const handleVarieteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingVariete) {
        // PUT
        const res = await fetch(`/api/varietes/${encodeURIComponent(editingVariete.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            especeId,
            fournisseurId: varieteForm.fournisseurId || null,
            bio: varieteForm.bio,
            semaineRecolte: varieteForm.semaineRecolte ? parseInt(varieteForm.semaineRecolte) : null,
            dureeRecolte: varieteForm.dureeRecolte ? parseInt(varieteForm.dureeRecolte) : null,
            nbGrainesG: varieteForm.nbGrainesG ? parseFloat(varieteForm.nbGrainesG) : null,
            prixGraine: varieteForm.prixGraine ? parseFloat(varieteForm.prixGraine) : null,
            stockGraines: varieteForm.stockGraines ? parseFloat(varieteForm.stockGraines) : null,
            stockPlants: varieteForm.stockPlants ? parseInt(varieteForm.stockPlants) : null,
            description: varieteForm.description || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Erreur")
        }
        const updated = await res.json()
        setVarietes(varietes.map((v) => (v.id === updated.id ? updated : v)))
        toast({ title: "Variete modifiee" })
      } else {
        // POST
        if (!varieteForm.id.trim()) return
        const res = await fetch("/api/varietes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: varieteForm.id.trim(),
            especeId,
            fournisseurId: varieteForm.fournisseurId || null,
            bio: varieteForm.bio,
            semaineRecolte: varieteForm.semaineRecolte ? parseInt(varieteForm.semaineRecolte) : null,
            dureeRecolte: varieteForm.dureeRecolte ? parseInt(varieteForm.dureeRecolte) : null,
            nbGrainesG: varieteForm.nbGrainesG ? parseFloat(varieteForm.nbGrainesG) : null,
            prixGraine: varieteForm.prixGraine ? parseFloat(varieteForm.prixGraine) : null,
            stockGraines: varieteForm.stockGraines ? parseFloat(varieteForm.stockGraines) : null,
            stockPlants: varieteForm.stockPlants ? parseInt(varieteForm.stockPlants) : null,
            description: varieteForm.description || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Erreur")
        }
        const created = await res.json()
        setVarietes([...varietes, created])
        toast({ title: "Variete ajoutee" })
      }
      setShowVarieteDialog(false)
      resetVarieteForm()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    }
  }

  const handleVarieteDelete = async (v: Variete) => {
    if (!confirm(`Supprimer la variete "${v.id}" ?`)) return
    try {
      const res = await fetch(`/api/varietes/${encodeURIComponent(v.id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erreur")
      }
      setVarietes(varietes.filter((x) => x.id !== v.id))
      toast({ title: "Variete supprimee" })
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="culture">Culture</TabsTrigger>
                <TabsTrigger value="recolte">Recolte</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="varietes">Varietes ({varietes.length})</TabsTrigger>
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

              {/* Onglet Varietes */}
              <TabsContent value="varietes">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Varietes de {especeId}</CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        resetVarieteForm()
                        setShowVarieteDialog(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {varietes.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Aucune variete pour cette espece</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Fournisseur</TableHead>
                            <TableHead>Bio</TableHead>
                            <TableHead className="text-right">Stock graines (g)</TableHead>
                            <TableHead className="text-right">Stock plants</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {varietes.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-medium">{v.id}</TableCell>
                              <TableCell>{v.fournisseur?.id || "-"}</TableCell>
                              <TableCell>{v.bio ? "Oui" : "-"}</TableCell>
                              <TableCell className="text-right">{v.stockGraines ?? "-"}</TableCell>
                              <TableCell className="text-right">{v.stockPlants ?? "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                                    onClick={() => openEditVariete(v)}
                                    title="Modifier"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                                    onClick={() => handleVarieteDelete(v)}
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
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

        {/* Dialog Variete */}
        <Dialog open={showVarieteDialog} onOpenChange={(open) => {
          setShowVarieteDialog(open)
          if (!open) resetVarieteForm()
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingVariete ? `Modifier : ${editingVariete.id}` : "Nouvelle variete"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleVarieteSubmit} className="space-y-4">
              {!editingVariete && (
                <div>
                  <Label>Nom de la variete *</Label>
                  <Input
                    value={varieteForm.id}
                    onChange={(e) => setVarieteForm({ ...varieteForm, id: e.target.value })}
                    placeholder="Ex: Coeur de boeuf"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fournisseur</Label>
                  <Select
                    value={varieteForm.fournisseurId}
                    onValueChange={(v) => setVarieteForm({ ...varieteForm, fournisseurId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      {fournisseurs.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="variete-bio"
                      checked={varieteForm.bio}
                      onCheckedChange={(checked) => setVarieteForm({ ...varieteForm, bio: checked === true })}
                    />
                    <label htmlFor="variete-bio" className="text-sm">Bio</label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Semaine recolte (1-52)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="52"
                    value={varieteForm.semaineRecolte}
                    onChange={(e) => setVarieteForm({ ...varieteForm, semaineRecolte: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Duree recolte (sem.)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="52"
                    value={varieteForm.dureeRecolte}
                    onChange={(e) => setVarieteForm({ ...varieteForm, dureeRecolte: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Graines/gramme</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={varieteForm.nbGrainesG}
                    onChange={(e) => setVarieteForm({ ...varieteForm, nbGrainesG: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Prix graines (euro)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={varieteForm.prixGraine}
                    onChange={(e) => setVarieteForm({ ...varieteForm, prixGraine: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stock graines (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={varieteForm.stockGraines}
                    onChange={(e) => setVarieteForm({ ...varieteForm, stockGraines: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Stock plants</Label>
                  <Input
                    type="number"
                    min="0"
                    value={varieteForm.stockPlants}
                    onChange={(e) => setVarieteForm({ ...varieteForm, stockPlants: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={varieteForm.description}
                  onChange={(e) => setVarieteForm({ ...varieteForm, description: e.target.value })}
                  rows={2}
                  placeholder="Notes sur cette variete..."
                />
              </div>

              <Button type="submit" className="w-full">
                {editingVariete ? "Enregistrer" : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
