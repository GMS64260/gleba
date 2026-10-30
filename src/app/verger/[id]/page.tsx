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
import { ArrowLeft, TreeDeciduous, Save, Trash2, AlertTriangle, Map as MapIcon } from "lucide-react"
import { checkProductifCoherence } from "@/lib/tree-care-calendar"
import { Combobox } from "@/components/ui/combobox"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { GpsPositionButton } from "@/components/gps/GpsPositionButton"
import { GpsMapPickerDialog } from "@/components/gps/GpsMapPickerDialog"
import { roundCoord } from "@/lib/geolocation"
import { parcelleCompatibleVerger } from "@/lib/verger/lot-arbres"
import { avertissementSuppressionArbre, CONDUITES_ARBRE, ETATS_ARBRE as ETATS } from "@/lib/verger/arbre-constants"
import { labelStatutRecolteArbre } from "@/lib/verger/statut-recolte-arbre"
import { TYPES_ARBRE, categoriesEspecePourTypeArbre, estTypeArbre, libelleTypeArbre } from "@/lib/verger/types-arbre"
import { libelleVarieteOption } from "@/lib/verger/variete-arbre"
import { lienOperationsArbre } from "@/lib/verger/lien-operations-arbre"
import { ChampPorteGreffe } from "@/components/verger/ChampPorteGreffe"

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  portGreffe: string | null
  // Bug #1 — Champs saisis à la création mais non restitués sur la fiche détail.
  porteGreffeId: string | null
  porteGreffeRef?: { id: string; nom: string } | null
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
  parcelleGeoId: string | null
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

interface ParcelleVerger {
  id: string
  nom: string
  usage: string | null
  couches: string[]
}

interface EspeceRef {
  id: string
  type: string
}

interface VarieteRef {
  id: string
  nom?: string | null
  especeId: string
}

interface FournisseurRef {
  id?: string | null
}

// Types d'arbre et catégories d'espèce proposées par type : liste unique
// (src/lib/verger/types-arbre.ts), partagée avec l'onglet Arbres et le plan.
// Une valeur héritée hors liste reste affichée, pour ne pas vider le champ.
function optionsTypesArbre(typeCourant: string | null | undefined) {
  const options: Array<{ value: string; label: string }> = TYPES_ARBRE.map((t) => ({ value: t.value, label: t.label }))
  if (typeCourant && !estTypeArbre(typeCourant)) {
    options.push({ value: typeCourant, label: libelleTypeArbre(typeCourant) })
  }
  return options
}


export default function DetailArbrePage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [arbre, setArbre] = React.useState<Arbre | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<{especes: string[], varietes: string[], fournisseurs: string[], portGreffes: string[]}>({especes: [], varietes: [], fournisseurs: [], portGreffes: []})
  const [especesRef, setEspecesRef] = React.useState<EspeceRef[]>([])
  const [varietesRef, setVarietesRef] = React.useState<VarieteRef[]>([])
  const [fournisseursRef, setFournisseursRef] = React.useState<string[]>([])
  const [parcelles, setParcelles] = React.useState<ParcelleVerger[]>([])
  const [parcellesLoading, setParcellesLoading] = React.useState(true)
  // Feedback LVBB40430 — saisie GPS assistée (géoloc directe + carte)
  const [gpsPickerOpen, setGpsPickerOpen] = React.useState(false)
  const [gpsAccuracy, setGpsAccuracy] = React.useState<number | null>(null)
  const [autresArbresGps, setAutresArbresGps] = React.useState<Array<{ lat: number; lng: number; label: string }>>([])

  React.useEffect(() => {
    // Suggestions issues des arbres déjà saisis
    fetch("/api/arbres").then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const arbres = data as Array<
          Pick<
            Arbre,
            "id" | "nom" | "espece" | "variete" | "fournisseur" | "portGreffe" | "gpsLat" | "gpsLng"
          >
        >
        setSuggestions({
          especes: [...new Set(arbres.map((a) => a.espece).filter(Boolean))].sort() as string[],
          varietes: [...new Set(arbres.map((a) => a.variete).filter(Boolean))].sort() as string[],
          fournisseurs: [...new Set(arbres.map((a) => a.fournisseur).filter(Boolean))].sort() as string[],
          portGreffes: [...new Set(arbres.map((a) => a.portGreffe).filter(Boolean))].sort() as string[],
        })
        // Feedback LVBB40430 — les autres arbres géolocalisés servent de
        // repères sur le sélecteur carte.
        setAutresArbresGps(
          arbres
            .filter((a) => a.gpsLat != null && a.gpsLng != null && a.id !== Number(id))
            .map((a) => ({ lat: a.gpsLat!, lng: a.gpsLng!, label: a.nom }))
        )
      }
    })

    // Référentiel global des especes arbres + varietes + fournisseurs
    Promise.all([
      fetch("/api/especes?type=all_arbres&pageSize=500").then(r => r.json()).catch(() => null),
      fetch("/api/varietes?pageSize=1000").then(r => r.json()).catch(() => null),
      fetch("/api/comptabilite/fournisseurs?actif=true").then(r => r.json()).catch(() => null),
      fetch("/api/carte").then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([especesRes, varietesRes, fournisseursRes, parcellesRes]) => {
      const especes = (Array.isArray(especesRes?.data) ? especesRes.data : []) as EspeceRef[]
      setEspecesRef(especes.map((e) => ({ id: e.id, type: e.type })))
      const especesIds = new Set(especes.map((e) => e.id))
      const varietes = (
        (Array.isArray(varietesRes?.data) ? varietesRes.data : []) as VarieteRef[]
      )
        .filter((v) => especesIds.has(v.especeId))
        .map((v) => ({ id: v.id, nom: v.nom ?? null, especeId: v.especeId }))
      setVarietesRef(varietes)
      const fournisseurs = (
        (Array.isArray(fournisseursRes?.data) ? fournisseursRes.data : []) as FournisseurRef[]
      )
        .map((f) => f.id)
        .filter((fournisseur): fournisseur is string => Boolean(fournisseur))
      setFournisseursRef(fournisseurs)
      setParcelles(
        (Array.isArray(parcellesRes) ? parcellesRes : []).map((p: ParcelleVerger) => ({
          id: p.id,
          nom: p.nom,
          usage: p.usage,
          couches: p.couches ?? [],
        }))
      )
    }).finally(() => {
      setParcellesLoading(false)
    })
  }, [id])

  const especeOptions = React.useMemo(() => {
    const refTypes = arbre ? categoriesEspecePourTypeArbre(arbre.type) : null
    const refEspeces = refTypes
      ? especesRef.filter(e => refTypes.includes(e.type)).map(e => e.id)
      : especesRef.map(e => e.id)
    return [...new Set([...refEspeces, ...suggestions.especes])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [especesRef, suggestions.especes, arbre])

  const varieteOptions = React.useMemo(() => {
    // QA 2026-10-19 — une variété personnelle se propose sous son nom, pas
    // sous son id technique (voir src/lib/verger/variete-arbre.ts).
    const refVarietes = arbre?.espece
      ? varietesRef.filter(v => v.especeId === arbre.espece).map(libelleVarieteOption)
      : varietesRef.map(libelleVarieteOption)
    return [...new Set([...refVarietes, ...suggestions.varietes])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [varietesRef, suggestions.varietes, arbre?.espece])

  const fournisseurOptions = React.useMemo(() => {
    return [...new Set([...fournisseursRef, ...suggestions.fournisseurs])]
      .sort()
      .map(v => ({ value: v, label: v }))
  }, [fournisseursRef, suggestions.fournisseurs])

  const parcellesVerger = React.useMemo(
    () =>
      parcelles
        .filter(
          (parcelle) =>
            parcelleCompatibleVerger(parcelle) || parcelle.id === arbre?.parcelleGeoId
        )
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [parcelles, arbre?.parcelleGeoId]
  )

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
        const updated = await res.json()
        setArbre((current) => current ? { ...current, ...updated } : current)
        toast({ title: "Arbre mis à jour" })
      } else {
        const data = await res.json().catch(() => null)
        toast({
          title: "Erreur lors de la sauvegarde",
          description: data?.error || "La modification n’a pas pu être enregistrée.",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Erreur sauvegarde:", err)
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Le serveur décide si l'historique permet la suppression ; son refus
  // reste visible pour que l'utilisateur sache pourquoi conserver la fiche.
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
        const payload = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Suppression refusée",
          description: typeof payload?.error === "string" ? payload.error : "La suppression n’a pas pu être effectuée." })
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
        {/* Responsive 360px — Supprimer/Sauvegarder passent à la ligne */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 mb-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        {optionsTypesArbre(arbre.type).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <Label htmlFor="arbre-porte-greffe">Porte-greffe</Label>
                    {/* Référentiel compatible avec l'espèce, texte libre à défaut :
                        même champ que l'inspecteur du plan (QA cmvkp3kqc). */}
                    <ChampPorteGreffe
                      id="arbre-porte-greffe"
                      espece={arbre.espece}
                      porteGreffeId={arbre.porteGreffeId}
                      portGreffe={arbre.portGreffe}
                      porteGreffeNom={arbre.porteGreffeRef?.nom ?? null}
                      suggestions={suggestions.portGreffes}
                      onChange={(v) =>
                        setArbre({
                          ...arbre,
                          ...v,
                          porteGreffeRef: v.porteGreffeId && v.portGreffe ? { id: v.porteGreffeId, nom: v.portGreffe } : null,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                  <Label>Parcelle du verger</Label>
                  <Select
                    value={arbre.parcelleGeoId || "__none__"}
                    onValueChange={(value) =>
                      setArbre({
                        ...arbre,
                        parcelleGeoId: value === "__none__" ? null : value,
                      })
                    }
                    disabled={parcellesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={parcellesLoading ? "Chargement…" : "Aucune parcelle"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune parcelle</SelectItem>
                      {parcellesVerger.map((parcelle) => (
                        <SelectItem key={parcelle.id} value={parcelle.id}>
                          {parcelle.nom}
                          {parcelle.usage ? ` — ${parcelle.usage}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez rattacher, déplacer ou retirer cet arbre d’une parcelle,
                    puis enregistrer avec « Sauvegarder ».
                  </p>
                  {!parcellesLoading && parcellesVerger.length === 0 && (
                    <p className="text-xs text-amber-700">
                      Aucune parcelle catégorisée Verger n’est disponible dans votre plan.
                    </p>
                  )}
                </div>

                {/* Bug #1 — Conduite (formeTaille) + Circonférence + GPS lat/lng */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>GPS Latitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={arbre.gpsLat ?? ""}
                      onChange={(e) => {
                        setArbre({
                          ...arbre,
                          gpsLat: e.target.value ? parseFloat(e.target.value) : null,
                        })
                        setGpsAccuracy(null)
                      }}
                      placeholder="ex: 49.183456"
                    />
                  </div>
                  <div>
                    <Label>GPS Longitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={arbre.gpsLng ?? ""}
                      onChange={(e) => {
                        setArbre({
                          ...arbre,
                          gpsLng: e.target.value ? parseFloat(e.target.value) : null,
                        })
                        setGpsAccuracy(null)
                      }}
                      placeholder="ex: 0.345678"
                    />
                  </div>
                </div>

                {/* Feedback LVBB40430 — plus de recopie manuelle : géolocalisation
                    en un tap ou pointage sur l'orthophoto IGN. */}
                <div className="-mt-2 flex flex-wrap items-center gap-2">
                  <GpsPositionButton
                    onPosition={(fix) => {
                      setArbre({
                        ...arbre,
                        gpsLat: roundCoord(fix.lat),
                        gpsLng: roundCoord(fix.lng),
                      })
                      setGpsAccuracy(fix.accuracy)
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setGpsPickerOpen(true)}>
                    <MapIcon className="h-4 w-4 mr-1.5" />
                    Choisir sur la carte
                  </Button>
                  {gpsAccuracy != null && (
                    <span className="text-xs text-muted-foreground">
                      précision ± {Math.round(gpsAccuracy)} m
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    — puis « Sauvegarder » en haut de page
                  </span>
                </div>

                {/* Dates, provenance et achat */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <Label>Date d’achat</Label>
                    <Input
                      type="date"
                      value={arbre.dateAchat?.split("T")[0] || ""}
                      onChange={(e) => setArbre({ ...arbre, dateAchat: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Prix d’achat (€)</Label>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                            <td className="p-2 capitalize">{r.qualite || "—"}</td>
                            <td className="p-2">{labelStatutRecolteArbre(r.statut)}</td>
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
                {/* QA cmvnorxov — le lien porte l'identifiant de l'arbre : l'onglet
                    Opérations s'ouvre filtré sur lui, et non sur tout le verger,
                    sur l'année civile en cours (pas l'année mémorisée). */}
                <Link href={lienOperationsArbre(arbre.id, new Date().getFullYear())}>
                  <Button variant="outline">Voir les opérations</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <DeleteConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        entityLabel={`l'arbre "${arbre.nom}"`}
        warning={avertissementSuppressionArbre(arbre)}
        onConfirm={performDelete}
      />

      {/* Feedback LVBB40430 — sélecteur de position sur carte satellite */}
      <GpsMapPickerDialog
        open={gpsPickerOpen}
        onOpenChange={setGpsPickerOpen}
        initialLat={arbre.gpsLat}
        initialLng={arbre.gpsLng}
        contextPoints={autresArbresGps}
        title={`Position de « ${arbre.nom} »`}
        onConfirm={(lat, lng) => {
          setArbre({ ...arbre, gpsLat: lat, gpsLng: lng })
          setGpsAccuracy(null)
        }}
      />
    </div>
  )
}
