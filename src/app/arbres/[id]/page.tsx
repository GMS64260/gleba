"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, TreeDeciduous, Save, Trash2 } from "lucide-react"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  portGreffe: string | null
  fournisseur: string | null
  dateAchat: string | null
  prixAchat: number | null
  datePlantation: string | null
  age: number | null
  posX: number
  posY: number
  envergure: number
  hauteur: number | null
  etat: string | null
  pollinisateur: string | null
  couleur: string | null
  notes: string | null
  productif: boolean
  anneeProduction: number | null
  rendementMoyen: number | null
}

const TYPES_ARBRES = [
  { value: "fruitier", label: "Fruitier" },
  { value: "petit_fruit", label: "Petit fruit" },
  { value: "forestier", label: "Forestier" },
  { value: "ornement", label: "Ornement" },
  { value: "haie", label: "Haie" },
]

const ETATS = [
  { value: "excellent", label: "Excellent" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
  { value: "mort", label: "Mort" },
]

export default function DetailArbrePage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [arbre, setArbre] = React.useState<Arbre | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<{especes: string[], varietes: string[], fournisseurs: string[], portGreffes: string[]}>({especes: [], varietes: [], fournisseurs: [], portGreffes: []})

  React.useEffect(() => {
    fetch("/api/arbres").then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setSuggestions({
          especes: [...new Set(data.map((a: any) => a.espece).filter(Boolean))].sort() as string[],
          varietes: [...new Set(data.map((a: any) => a.variete).filter(Boolean))].sort() as string[],
          fournisseurs: [...new Set(data.map((a: any) => a.fournisseur).filter(Boolean))].sort() as string[],
          portGreffes: [...new Set(data.map((a: any) => a.portGreffe).filter(Boolean))].sort() as string[],
        })
      }
    })
  }, [])

  React.useEffect(() => {
    const fetchArbre = async () => {
      try {
        const res = await fetch(`/api/arbres/${id}`)
        if (res.ok) {
          setArbre(await res.json())
        } else {
          router.push("/arbres?tab=arbres")
        }
      } catch (err) {
        console.error("Erreur chargement:", err)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user && id) fetchArbre()
  }, [session?.user, id, router])

  const handleSave = async () => {
    if (!arbre) return
    setSaving(true)

    try {
      const res = await fetch(`/api/arbres/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arbre),
      })

      if (res.ok) {
        toast({ title: "Arbre mis à jour" })
      } else {
        toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" })
      }
    } catch (err) {
      console.error("Erreur sauvegarde:", err)
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Supprimer cet arbre ? Cette action est irréversible.")) return

    try {
      const res = await fetch(`/api/arbres/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Arbre supprimé" })
        router.push("/arbres?tab=arbres")
      }
    } catch (err) {
      console.error("Erreur suppression:", err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  if (!arbre) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Arbre non trouvé</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-[1000px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/arbres?tab=arbres">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <TreeDeciduous className="h-5 w-5 text-lime-600" />
              <h1 className="text-xl font-semibold">{arbre.nom}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </div>

        {/* Contenu */}
        <Tabs defaultValue="fiche">
          <TabsList className="mb-4">
            <TabsTrigger value="fiche">Fiche</TabsTrigger>
            <TabsTrigger value="recoltes">Récoltes</TabsTrigger>
            <TabsTrigger value="operations">Opérations</TabsTrigger>
          </TabsList>

          <TabsContent value="fiche">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Identité */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nom *</Label>
                    <Input
                      value={arbre.nom}
                      onChange={(e) => setArbre({ ...arbre, nom: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Type *</Label>
                    <Select
                      value={arbre.type}
                      onValueChange={(v) => setArbre({ ...arbre, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES_ARBRES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Espèce</Label>
                    <Combobox
                      value={arbre.espece || ""}
                      onValueChange={(v) => setArbre({ ...arbre, espece: v })}
                      options={suggestions.especes.map(v => ({ value: v, label: v }))}
                      placeholder="Ex: Pommier"
                    />
                  </div>
                  <div>
                    <Label>Variété</Label>
                    <Combobox
                      value={arbre.variete || ""}
                      onValueChange={(v) => setArbre({ ...arbre, variete: v })}
                      options={suggestions.varietes.map(v => ({ value: v, label: v }))}
                      placeholder="Ex: Golden"
                    />
                  </div>
                  <div>
                    <Label>Porte-greffe</Label>
                    <Combobox
                      value={arbre.portGreffe || ""}
                      onValueChange={(v) => setArbre({ ...arbre, portGreffe: v })}
                      options={suggestions.portGreffes.map(v => ({ value: v, label: v }))}
                      placeholder="Ex: M26"
                    />
                  </div>
                </div>

                {/* Dates, provenance et achat */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date plantation</Label>
                    <Input
                      type="date"
                      value={arbre.datePlantation?.split("T")[0] || ""}
                      onChange={(e) => setArbre({ ...arbre, datePlantation: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Âge à la plantation (ans)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={arbre.age || ""}
                      onChange={(e) =>
                        setArbre({ ...arbre, age: e.target.value ? parseInt(e.target.value) : null })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Fournisseur / Pépinière</Label>
                    <Combobox
                      value={arbre.fournisseur || ""}
                      onValueChange={(v) => setArbre({ ...arbre, fournisseur: v })}
                      options={suggestions.fournisseurs.map(v => ({ value: v, label: v }))}
                      placeholder="Ex: Pépinière du Morvan"
                    />
                  </div>
                  <div>
                    <Label>Date d'achat</Label>
                    <Input
                      type="date"
                      value={arbre.dateAchat?.split("T")[0] || ""}
                      onChange={(e) => setArbre({ ...arbre, dateAchat: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Prix d'achat (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={arbre.prixAchat || ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          prixAchat: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Caractéristiques physiques */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Envergure (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={arbre.envergure}
                      onChange={(e) =>
                        setArbre({ ...arbre, envergure: parseFloat(e.target.value) || 2 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Hauteur (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={arbre.hauteur || ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          hauteur: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>État</Label>
                    <Select
                      value={arbre.etat || ""}
                      onValueChange={(v) => setArbre({ ...arbre, etat: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {ETATS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>
                            {e.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Production */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Productif</Label>
                    <Select
                      value={arbre.productif ? "oui" : "non"}
                      onValueChange={(v) => setArbre({ ...arbre, productif: v === "oui" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oui">Oui</SelectItem>
                        <SelectItem value="non">Non</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Première année de production</Label>
                    <Input
                      type="number"
                      min="1900"
                      max="2100"
                      value={arbre.anneeProduction || ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          anneeProduction: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Rendement moyen (kg/an)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={arbre.rendementMoyen || ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          rendementMoyen: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Pollinisateur */}
                <div>
                  <Label>Variété pollinisatrice</Label>
                  <Combobox
                    value={arbre.pollinisateur || ""}
                    onValueChange={(v) => setArbre({ ...arbre, pollinisateur: v })}
                    options={suggestions.varietes.map(v => ({ value: v, label: v }))}
                    placeholder="Ex: Granny Smith"
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={arbre.notes || ""}
                    onChange={(e) => setArbre({ ...arbre, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recoltes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récoltes de cet arbre</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Consultez les récoltes de cet arbre dans la page dédiée.
                </p>
                <Link href="/arbres?tab=productions">
                  <Button variant="outline">Voir les récoltes</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Opérations sur cet arbre</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Consultez les opérations de cet arbre dans la page dédiée.
                </p>
                <Link href="/arbres?tab=operations">
                  <Button variant="outline">Voir les opérations</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
