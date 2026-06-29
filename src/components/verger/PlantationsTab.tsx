"use client"

/**
 * Onglet Plantations - Gestion des campagnes de plantation forestière, haie, agroforesterie
 */

import * as React from "react"
import Link from "next/link"
import {
  TreeDeciduous,
  Sprout,
  CalendarClock,
  TrendingUp,
  Plus,
  HelpCircle,
  Trees,
  Fence,
  Apple,
  Leaf,
  Eye,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { AssistantPlantationDialog } from "./AssistantPlantationDialog"
import { CampagneDetailDialog } from "./CampagneDetailDialog"

const TYPES_LIBELLE: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  verger: { label: "Verger", icon: Apple, color: "text-lime-600" },
  haie: { label: "Haie", icon: Fence, color: "text-emerald-600" },
  agroforesterie: { label: "Agroforesterie", icon: Leaf, color: "text-teal-600" },
  forestier_futaie: { label: "Futaie forestière", icon: Trees, color: "text-amber-700" },
  forestier_taillis: { label: "Taillis forestier", icon: TreeDeciduous, color: "text-amber-800" },
  bosquet: { label: "Bosquet", icon: TreeDeciduous, color: "text-green-700" },
  miscanthus: { label: "Miscanthus", icon: Sprout, color: "text-yellow-600" },
}

const STATUTS_LIBELLE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  planifiee: { label: "Planifiée", variant: "outline" },
  prep_sol: { label: "Prépa. sol", variant: "secondary" },
  plantation: { label: "Plantation", variant: "secondary" },
  suivi: { label: "Suivi", variant: "default" },
  terminee: { label: "Terminée", variant: "default" },
  echec: { label: "Échec", variant: "destructive" },
}

const NATURE_LIBELLE: Record<string, string> = {
  boisement: "Boisement (terrain nu)",
  replantation_apres_coupe: "Replantation après coupe",
  replantation_apres_mortalite: "Replantation après mortalité",
  regarnissage: "Regarnissage",
  renouvellement: "Renouvellement progressif",
  // Legacy
  reboisement: "Reboisement (après coupe)",
  remplacement: "Remplacement",
}

interface Campagne {
  id: number
  nom: string
  typeFormation: string
  nature: string
  statut: string
  surfaceHa: number | null
  nombrePlants: number | null
  densitePlantsParHa: number | null
  tauxReprise: number | null
  datePlantationPrevue: string | null
  datePlantationReelle: string | null
  essenceLibre: string | null
  varieteOuProvenance: string | null
  budgetPrevu: number | null
  coutReel: number | null
  parcelleGeo: { id: string; nom: string; surface: number | null } | null
  zoneVerger: { id: number; nom: string } | null
  espece: { id: string; nomLatin: string | null } | null
  _count: { etapes: number; observations: number }
}

export function PlantationsTab() {
  const { toast } = useToast()
  const [campagnes, setCampagnes] = React.useState<Campagne[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filterStatut, setFilterStatut] = React.useState<string>("all")
  const [filterType, setFilterType] = React.useState<string>("all")
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [campagneToDelete, setCampagneToDelete] = React.useState<Campagne | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatut !== "all") params.set("statut", filterStatut)
      if (filterType !== "all") params.set("type", filterType)
      const res = await fetch(`/api/arbres/campagnes?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCampagnes(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterStatut, filterType])

  React.useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    if (!campagneToDelete) return
    const res = await fetch(`/api/arbres/campagnes/${campagneToDelete.id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Campagne supprimée" })
      load()
    } else {
      toast({ title: "Erreur", description: "Suppression impossible", variant: "destructive" })
    }
  }

  // KPI
  const kpi = React.useMemo(() => {
    const total = campagnes.length
    const enCours = campagnes.filter((c) => ["planifiee", "prep_sol", "plantation", "suivi"].includes(c.statut)).length
    const surfaceTotale = campagnes.reduce((s, c) => s + (c.surfaceHa || 0), 0)
    const plantsTotal = campagnes.reduce((s, c) => s + (c.nombrePlants || 0), 0)
    const reprises = campagnes.filter((c) => c.tauxReprise !== null).map((c) => c.tauxReprise as number)
    const tauxMoyen = reprises.length > 0 ? reprises.reduce((a, b) => a + b, 0) / reprises.length : null
    return { total, enCours, surfaceTotale, plantsTotal, tauxMoyen }
  }, [campagnes])

  return (
    <div className="space-y-6">
      {/* Header avec boutons */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trees className="h-5 w-5 text-lime-600" />
            Campagnes de plantation
          </h2>
          <p className="text-sm text-muted-foreground">
            Verger, haie, agroforesterie, replantation forestière
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/verger/aides">
            <Button variant="outline" size="sm">
              <HelpCircle className="h-4 w-4 mr-1" />
              Aides financières
            </Button>
          </Link>
          <Button
            onClick={() => setWizardOpen(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle plantation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Campagnes actives</p>
                <p className="text-2xl font-bold text-lime-700">{kpi.enCours}</p>
                <p className="text-xs text-muted-foreground">/ {kpi.total} total</p>
              </div>
              <CalendarClock className="h-8 w-8 text-lime-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Surface plantée</p>
                <p className="text-2xl font-bold text-emerald-700">{kpi.surfaceTotale.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">hectares</p>
              </div>
              <Sprout className="h-8 w-8 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Plants totaux</p>
                <p className="text-2xl font-bold text-amber-700">{kpi.plantsTotal.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">plants commandés</p>
              </div>
              <TreeDeciduous className="h-8 w-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Taux de reprise moyen</p>
                <p className="text-2xl font-bold text-teal-700">
                  {kpi.tauxMoyen !== null ? `${kpi.tauxMoyen.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">sur observations</p>
              </div>
              <TrendingUp className="h-8 w-8 text-teal-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUTS_LIBELLE).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {Object.entries(TYPES_LIBELLE).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : campagnes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trees className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              Aucune campagne de plantation. Lancez votre première replantation avec l'assistant.
            </p>
            <Button onClick={() => setWizardOpen(true)} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <Plus className="h-4 w-4 mr-1" />
              Lancer une campagne
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campagnes.map((c) => {
            const typeInfo = TYPES_LIBELLE[c.typeFormation] || { label: c.typeFormation, icon: TreeDeciduous, color: "text-slate-600" }
            const statutInfo = STATUTS_LIBELLE[c.statut] || { label: c.statut, variant: "outline" as const }
            const Icon = typeInfo.icon
            return (
              <Card
                key={c.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedId(c.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`h-5 w-5 flex-shrink-0 ${typeInfo.color}`} />
                      <span className="font-semibold truncate" title={c.nom}>{c.nom}</span>
                    </div>
                    <Badge variant={statutInfo.variant} className="flex-shrink-0">{statutInfo.label}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="outline" className={typeInfo.color}>{typeInfo.label}</Badge>
                    <Badge variant="outline">{NATURE_LIBELLE[c.nature] || c.nature}</Badge>
                  </div>

                  {(c.essenceLibre || c.espece?.nomLatin) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {c.essenceLibre || c.espece?.nomLatin}
                      {c.varieteOuProvenance && ` — ${c.varieteOuProvenance}`}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <p className="text-muted-foreground">Surface</p>
                      <p className="font-medium">{c.surfaceHa ? `${c.surfaceHa} ha` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plants</p>
                      <p className="font-medium">{c.nombrePlants?.toLocaleString("fr-FR") || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reprise</p>
                      <p className="font-medium">{c.tauxReprise !== null ? `${c.tauxReprise.toFixed(0)}%` : "—"}</p>
                    </div>
                  </div>

                  {(c.parcelleGeo || c.zoneVerger) && (
                    <p className="text-xs text-muted-foreground truncate">
                      📍 {c.parcelleGeo?.nom || c.zoneVerger?.nom}
                    </p>
                  )}

                  {c.datePlantationPrevue && (
                    <p className="text-xs text-muted-foreground">
                      Prévue : {new Date(c.datePlantationPrevue).toLocaleDateString("fr-FR")}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {c._count.etapes} étapes · {c._count.observations} obs.
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(c.id)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCampagneToDelete(c)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Wizard */}
      <AssistantPlantationDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          // Ne pas fermer ici : le wizard affiche son écran de succès (étape 6),
          // la fermeture est gérée par son bouton « Voir mes campagnes ».
          load()
        }}
      />

      {/* Détail */}
      {selectedId !== null && (
        <CampagneDetailDialog
          campagneId={selectedId}
          open={selectedId !== null}
          onOpenChange={(open) => !open && setSelectedId(null)}
          onUpdate={load}
        />
      )}

      <DeleteConfirmDialog
        open={campagneToDelete !== null}
        onOpenChange={(open) => !open && setCampagneToDelete(null)}
        entityLabel={campagneToDelete ? `la campagne "${campagneToDelete.nom}"` : ""}
        dependencies={
          campagneToDelete
            ? [
                { label: "étapes du calendrier", count: campagneToDelete._count.etapes },
                { label: "observations de suivi de reprise", count: campagneToDelete._count.observations },
              ]
            : []
        }
        onConfirm={confirmDelete}
      />
    </div>
  )
}
