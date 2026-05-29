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
import { ArrowLeft, TreeDeciduous, Save, Trash2, AlertTriangle } from "lucide-react"
import { checkProductifCoherence } from "@/lib/tree-care-calendar"
import { Combobox } from "@/components/ui/combobox"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { useToast } from "@/hooks/use-toast"

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  portGreffe: string | null
  // Bug #1 — Champs saisis à la création mais non restitués sur la fiche détail.
  porteGreffeId: string | null
  circonferenceCm: number | null
  gpsLat: number | null
  gpsLng: number | null
  formeTaille: string | null
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
  // Feedback Marc 2026-05-16 — V4 Bug 1 : on récupère le détail
  // des dépendances pour afficher le warning « X récoltes seront
  // supprimées en cascade » dans la confirmation de suppression.
  _count?: {
    recoltesArbres?: number
    operationsArbres?: number
    observationsSante?: number
  }
}

// Mêmes valeurs que ArbresTab (création) pour cohérence.
const CONDUITES_ARBRE = ["Gobelet", "Axe central", "Palmette", "Espalier", "Libre"] as const

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
  const [especesRef, setEspecesRef] = React.useState<{id: string, type: string}[]>([])
  const [varietesRef, setVarietesRef] = React.useState<{id: string, especeId: string}[]>([])
  const [fournisseursRef, setFournisseursRef] = React.useState<string[]>([])
  // Bug #1 — Référentiel des porte-greffes compatibles avec l'espèce.
  const [portesGreffesRef, setPortesGreffesRef] = React.useState<Array<{ id: string; nom: string; vigueur: number | null; precocite: number | null }>>([])

  React.useEffect(() => {
    // Suggestions issues des arbres déjà saisis
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

    // Référentiel global des especes arbres + varietes + fournisseurs
    Promise.all([
      fetch("/api/especes?type=all_arbres&pageSize=500").then(r => r.json()).catch(() => null),
      fetch("/api/varietes?pageSize=1000").then(r => r.json()).catch(() => null),
      fetch("/api/comptabilite/fournisseurs?actif=true").then(r => r.json()).catch(() => null),
    ]).then(([especesRes, varietesRes, fournisseursRes]) => {
      const especes = especesRes?.data || []
      setEspecesRef(especes.map((e: any) => ({ id: e.id, type: e.type })))
      const especesIds = new Set(especes.map((e: any) => e.id))
      const varietes = (varietesRes?.data || [])
        .filter((v: any) => especesIds.has(v.especeId))
        .map((v: any) => ({ id: v.id, especeId: v.especeId }))
      setVarietesRef(varietes)
      const fournisseurs = (fournisseursRes?.data || [])
        .map((f: any) => f.id)
        .filter(Boolean)
      setFournisseursRef(fournisseurs)
    })
  }, [])

  const TYPE_TO_REF: Record<string, string> = { fruitier: "arbre_fruitier", petit_fruit: "petit_fruit" }

  const especeOptions = React.useMemo(() => {
    const refType = arbre ? TYPE_TO_REF[arbre.type] : null
    const refEspeces = refType
      ? especesRef.filter(e => e.type === refType).map(e => e.id)
      : especesRef.map(e => e.id)
    return [...new Set([...refEspeces, ...suggestions.especes])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [especesRef, suggestions.especes, arbre?.type])

  const varieteOptions = React.useMemo(() => {
    const refVarietes = arbre?.espece
      ? varietesRef.filter(v => v.especeId === arbre.espece).map(v => v.id)
      : varietesRef.map(v => v.id)
    return [...new Set([...refVarietes, ...suggestions.varietes])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [varietesRef, suggestions.varietes, arbre?.espece])

  const fournisseurOptions = React.useMemo(() => {
    return [...new Set([...fournisseursRef, ...suggestions.fournisseurs])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [fournisseursRef, suggestions.fournisseurs])

  React.useEffect(() => {
    const fetchArbre = async () => {
      try {
        const res = await fetch(`/api/arbres/${id}`)
        if (res.ok) {
          setArbre(await res.json())
        } else {
          router.push("/verger?tab=arbres")
        }
      } catch (err) {
        console.error("Erreur chargement:", err)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user && id) fetchArbre()
  }, [session?.user, id, router])

  // Bug feedback testeur 2026-05-26 (cmpm7260v) — l'onglet « Récoltes »
  // renvoyait vers la liste globale non filtrée. On charge ici les
  // récoltes de CET arbre (route déjà filtrable par arbreId).
  const [recoltesArbre, setRecoltesArbre] = React.useState<
    Array<{ id: number; date: string; quantite: number; qualite: string | null; statut: string }>
  >([])
  const [recoltesLoading, setRecoltesLoading] = React.useState(true)
  React.useEffect(() => {
    if (!session?.user || !id) return
    setRecoltesLoading(true)
    fetch(`/api/arbres/recoltes?arbreId=${id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRecoltesArbre(Array.isArray(d) ? d : []))
      .catch(() => setRecoltesArbre([]))
      .finally(() => setRecoltesLoading(false))
  }, [session?.user, id])

  // Bug #1 — Recharger la liste des porte-greffes quand l'espèce change.
  // L'API filtre par especeId via la table porte_greffe_especes.
  React.useEffect(() => {
    if (!arbre?.espece) {
      setPortesGreffesRef([])
      return
    }
    fetch(`/api/verger/porte-greffes?especeId=${encodeURIComponent(arbre.espece)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setPortesGreffesRef(res?.data || []))
      .catch(() => setPortesGreffesRef([]))
  }, [arbre?.espece])

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

  // Feedback Marc 2026-05-16 — V4 Bug 1 : avant ce fix, la
  // suppression d'un arbre passait par un `confirm()` browser qui
  // peut être supprimé par certaines extensions / contextes mobiles,
  // ou simplement skippé par l'utilisateur fatigué. Or l'API DELETE
  // cascade sur recoltes_arbres / operations_arbres / observations
  // → 12,5 kg de récoltes disparaissaient sans avertissement. On
  // utilise désormais `DeleteConfirmDialog` qui liste les dépendances.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)
  const handleDelete = () => {
    setConfirmDeleteOpen(true)
  }
  const performDelete = async () => {
    try {
      const res = await fetch(`/api/arbres/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Arbre supprimé" })
        router.push("/verger?tab=arbres")
      } else {
        toast({ variant: "destructive", title: "Erreur", description: "Suppression refusée" })
      }
    } catch (err) {
      console.error("Erreur suppression:", err)
      toast({ variant: "destructive", title: "Erreur" })
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
            <Link href="/verger?tab=arbres">
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
                      options={especeOptions}
                      placeholder="Ex: Pommier"
                    />
                  </div>
                  <div>
                    <Label>Variété</Label>
                    <Combobox
                      value={arbre.variete || ""}
                      onValueChange={(v) => setArbre({ ...arbre, variete: v })}
                      options={varieteOptions}
                      placeholder="Ex: Golden"
                    />
                  </div>
                  <div>
                    <Label>Porte-greffe</Label>
                    {/* Bug #1 — Select sur le référentiel (M9/M26/MM106…) avec
                        fallback Combobox texte libre si aucune correspondance
                        pour l'espèce. portGreffe texte libre conservé pour
                        rétro-compat. */}
                    {portesGreffesRef.length > 0 ? (
                      <Select
                        value={arbre.porteGreffeId || "_none"}
                        onValueChange={(v) =>
                          setArbre({
                            ...arbre,
                            porteGreffeId: v === "_none" ? null : v,
                            // Reflet texte libre pour rétro-compat affichage.
                            portGreffe:
                              v === "_none"
                                ? null
                                : portesGreffesRef.find((p) => p.id === v)?.nom ?? null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">— Aucun</SelectItem>
                          {portesGreffesRef.map((pg) => (
                            <SelectItem key={pg.id} value={pg.id}>
                              {pg.nom}
                              {pg.vigueur != null && (
                                <span className="text-muted-foreground text-xs ml-2">
                                  vigueur {pg.vigueur}/5
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Combobox
                        value={arbre.portGreffe || ""}
                        onValueChange={(v) => setArbre({ ...arbre, portGreffe: v })}
                        options={suggestions.portGreffes.map((v) => ({ value: v, label: v }))}
                        placeholder="Ex: M26"
                      />
                    )}
                  </div>
                </div>

                {/* Bug #1 — Conduite (formeTaille) + Circonférence + GPS lat/lng */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Conduite</Label>
                    <Select
                      value={arbre.formeTaille || "_none"}
                      onValueChange={(v) =>
                        setArbre({ ...arbre, formeTaille: v === "_none" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Non défini</SelectItem>
                        {CONDUITES_ARBRE.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Circonférence tronc (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={arbre.circonferenceCm ?? ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          circonferenceCm: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="ex: 15 (utile PCAE/HVE)"
                    />
                  </div>
                  <div>{/* spacer */}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>GPS Latitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={arbre.gpsLat ?? ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          gpsLat: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="ex: 49.183456"
                    />
                  </div>
                  <div>
                    <Label>GPS Longitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={arbre.gpsLng ?? ""}
                      onChange={(e) =>
                        setArbre({
                          ...arbre,
                          gpsLng: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="ex: 0.345678"
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
                      options={fournisseurOptions}
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
                    {/* Avertissement cohérence productif/âge (cmpmqv4og). */}
                    {(() => {
                      const w = checkProductifCoherence(arbre.espece, arbre.datePlantation, arbre.productif)
                      if (!w) return null
                      return (
                        <p className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{w.message}</span>
                        </p>
                      )
                    })()}
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
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Récoltes de cet arbre</span>
                  {recoltesArbre.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      Total {Math.round(recoltesArbre.reduce((s, r) => s + (r.quantite || 0), 0) * 100) / 100} kg
                      {" · "}
                      {recoltesArbre.length} récolte{recoltesArbre.length > 1 ? "s" : ""}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recoltesLoading ? (
                  <p className="text-muted-foreground text-sm">Chargement…</p>
                ) : recoltesArbre.length === 0 ? (
                  <p className="text-muted-foreground text-sm mb-4">
                    Aucune récolte enregistrée pour cet arbre.
                  </p>
                ) : (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-2 font-medium">Date</th>
                          <th className="p-2 font-medium text-right">Quantité</th>
                          <th className="p-2 font-medium">Qualité</th>
                          <th className="p-2 font-medium">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recoltesArbre.map((r) => (
                          <tr key={r.id} className="border-b hover:bg-slate-50">
                            <td className="p-2 whitespace-nowrap">
                              {new Date(r.date).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="p-2 text-right font-medium">{r.quantite} kg</td>
                            <td className="p-2">{r.qualite || "—"}</td>
                            <td className="p-2">{r.statut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Link href="/verger?tab=productions">
                  <Button variant="outline" size="sm">Voir toutes les récoltes</Button>
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
                <Link href="/verger?tab=operations">
                  <Button variant="outline">Voir les opérations</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Feedback Marc 2026-05-16 — V4 Bug 1 : confirmation explicite
          avec liste des récoltes/opérations/observations qui seront
          supprimées en cascade. */}
      <DeleteConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        entityLabel={`l'arbre "${arbre.nom}"`}
        dependencies={
          arbre._count
            ? [
                { label: "récoltes", count: arbre._count.recoltesArbres ?? 0 },
                { label: "opérations (taille, traitement, greffe…)", count: arbre._count.operationsArbres ?? 0 },
                { label: "observations de santé", count: arbre._count.observationsSante ?? 0 },
              ]
            : []
        }
        onConfirm={performDelete}
      />
    </div>
  )
}
