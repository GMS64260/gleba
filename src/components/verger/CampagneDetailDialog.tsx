"use client"

/**
 * Détail d'une campagne de plantation : etapes (Gantt simplifié) + observations
 */

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Check,
  TreeDeciduous,
  CalendarClock,
  Eye,
  Plus,
  Trash2,
  Sprout,
  Edit2,
  Save,
  X,
  HelpCircle,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { getAidesByType, NIVEAU_LIBELLE } from "@/data/aides-plantation"

const ETAPE_LIBELLES: Record<string, string> = {
  preparation_sol: "Préparation du sol",
  plantation: "Plantation",
  regarnissage: "Regarnissage",
  degagement: "Dégagement",
  elagage_formation: "Élagage de formation",
  protection_gibier: "Protection gibier",
  fertilisation: "Fertilisation",
  arrosage: "Arrosage",
  evaluation: "Évaluation de reprise",
}

interface Campagne {
  id: number
  nom: string
  typeFormation: string
  nature: string
  cause: string | null
  peuplementPrecedent: string | null
  essencePrecedente: string | null
  ageAvantCoupe: number | null
  surfacePrecedenteHa: number | null
  productionBoisId: number | null
  productionBois: { id: number; type: string; date: string; volumeM3: number | null; arbre: { id: number; nom: string } | null } | null
  statut: string
  surfaceHa: number | null
  nombrePlants: number | null
  densitePlantsParHa: number | null
  tauxReprise: number | null
  datePlantationPrevue: string | null
  datePlantationReelle: string | null
  essenceLibre: string | null
  varieteOuProvenance: string | null
  pepiniere: string | null
  budgetPrevu: number | null
  coutReel: number | null
  aidesObtenues: string | null
  montantAides: number | null
  protectionType: string | null
  objectifs: string | null
  notes: string | null
  parcelleGeo: { id: string; nom: string } | null
  zoneVerger: { id: number; nom: string } | null
  espece: { id: string; nomLatin: string | null } | null
  etapes: Etape[]
  observations: Observation[]
}

const CAUSE_LIBELLES: Record<string, string> = {
  coupe_programmee: "Coupe programmée",
  scolytes: "Scolytes",
  tempete: "Tempête / Chablis",
  secheresse: "Sécheresse / Dépérissement",
  incendie: "Incendie",
  maladie: "Maladie",
  echec_plantation: "Échec plantation précédente",
  renouvellement_normal: "Renouvellement de cycle",
  autre: "Autre",
}

const NATURE_LIBELLES: Record<string, string> = {
  boisement: "Boisement (terrain nu)",
  replantation_apres_coupe: "Replantation après coupe",
  replantation_apres_mortalite: "Replantation après mortalité",
  regarnissage: "Regarnissage",
  renouvellement: "Renouvellement progressif",
  // Legacy
  reboisement: "Reboisement",
  remplacement: "Remplacement",
}

// Feedback Marc 2026-05-16 — Bug 09 : l'aperçu campagne affichait
// `forestier_futaie` / `planifiee` (valeurs brutes DB) alors que la
// liste utilise les libellés humains. On centralise les labels ici.
const TYPE_FORMATION_LIBELLES: Record<string, string> = {
  forestier_futaie: "Forestier — futaie",
  forestier_taillis: "Forestier — taillis",
  agroforesterie: "Agroforesterie",
  haie_bocagere: "Haie bocagère",
  verger_fruitier: "Verger fruitier",
  verger_petits_fruits: "Verger petits fruits",
  pre_verger: "Pré-verger",
  ripisylve: "Ripisylve",
  autre: "Autre",
}

const STATUT_LIBELLES: Record<string, string> = {
  planifiee: "Planifiée",
  prep_sol: "Préparation du sol",
  plantation: "Plantation",
  suivi: "Suivi",
  terminee: "Terminée",
  echec: "Échec",
}

function labelTypeFormation(v: string): string {
  return TYPE_FORMATION_LIBELLES[v] ?? v.replace(/_/g, " ")
}

function labelStatut(v: string): string {
  return STATUT_LIBELLES[v] ?? v.replace(/_/g, " ")
}

interface Etape {
  id: number
  type: string
  ordre: number
  description: string | null
  datePrevue: string | null
  dateRealisation: string | null
  fait: boolean
  cout: number | null
  notes: string | null
}

interface Observation {
  id: number
  date: string
  nbVivants: number | null
  nbMorts: number | null
  nbManquants: number | null
  tauxReprise: number | null
  hauteurMoyenneCm: number | null
  vigueur: string | null
  problemes: string | null
  notes: string | null
}

interface Props {
  campagneId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

export function CampagneDetailDialog({ campagneId, open, onOpenChange, onUpdate }: Props) {
  const { toast } = useToast()
  const [campagne, setCampagne] = React.useState<Campagne | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editingStatut, setEditingStatut] = React.useState(false)
  // Bug #ybnkt — Tabs en non-controlled re-démontaient sur chaque load(),
  // ramenant l'utilisateur à l'Aperçu après un toggle d'étape. On contrôle
  // l'onglet actif et on ne le reset que lorsque la modale s'ouvre.
  const [activeTab, setActiveTab] = React.useState<string>("apercu")
  React.useEffect(() => {
    if (open) setActiveTab("apercu")
  }, [open])

  // Nouvelle observation
  const [obsForm, setObsForm] = React.useState({
    nbVivants: "",
    nbMorts: "",
    nbManquants: "",
    hauteurMoyenneCm: "",
    vigueur: "",
    problemes: "",
    notes: "",
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/arbres/campagnes/${campagneId}`)
      if (res.ok) {
        const data = await res.json()
        setCampagne(data)
      }
    } finally {
      setLoading(false)
    }
  }, [campagneId])

  React.useEffect(() => {
    if (open) load()
  }, [open, load])

  const toggleEtape = async (etape: Etape) => {
    const newFait = !etape.fait
    const res = await fetch(`/api/arbres/campagnes/${campagneId}/etapes/${etape.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fait: newFait,
        dateRealisation: newFait ? new Date().toISOString() : null,
      }),
    })
    if (res.ok) {
      load()
      onUpdate?.()
      toast({ title: newFait ? "Étape marquée comme faite" : "Étape rouverte" })
    } else {
      toast({ title: "Échec de la mise à jour de l'étape", variant: "destructive" })
    }
  }

  const deleteEtape = async (etape: Etape) => {
    if (!confirm(`Supprimer l'etape "${etape.description || ETAPE_LIBELLES[etape.type]}" ?`)) return
    const res = await fetch(`/api/arbres/campagnes/${campagneId}/etapes/${etape.id}`, {
      method: "DELETE",
    })
    if (res.ok) load()
  }

  const submitObservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!obsForm.nbVivants && !obsForm.notes) {
      toast({ title: "Saisir au moins le nombre de plants vivants ou une note", variant: "destructive" })
      return
    }
    const res = await fetch(`/api/arbres/campagnes/${campagneId}/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obsForm),
    })
    if (res.ok) {
      toast({ title: "Observation enregistrée" })
      setObsForm({ nbVivants: "", nbMorts: "", nbManquants: "", hauteurMoyenneCm: "", vigueur: "", problemes: "", notes: "" })
      load()
      onUpdate?.()
    }
  }

  const updateStatut = async (statut: string) => {
    const res = await fetch(`/api/arbres/campagnes/${campagneId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    })
    if (res.ok) {
      setEditingStatut(false)
      load()
      onUpdate?.()
    }
  }

  if (!campagne && !loading) return null

  const aides = campagne ? getAidesByType(campagne.typeFormation) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TreeDeciduous className="h-5 w-5 text-lime-600" />
            {campagne?.nom || "Chargement..."}
            {/* Bug #7 — Export PDF dossier campagne (aides PCAE / Plantons en Normandie). */}
            {campagne && (
              <a
                href={`/api/arbres/campagnes/${campagne.id}/export`}
                className="ml-auto text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-normal"
                title="Télécharger le dossier complet pour montage d'aides"
              >
                📥 Dossier PDF
              </a>
            )}
          </DialogTitle>
          <DialogDescription>
            Suivi détaillé de la campagne de plantation
          </DialogDescription>
        </DialogHeader>

        {loading && !campagne ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : campagne ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="apercu">Aperçu</TabsTrigger>
              <TabsTrigger value="etapes">Étapes ({campagne.etapes.length})</TabsTrigger>
              <TabsTrigger value="suivi">Suivi reprise ({campagne.observations.length})</TabsTrigger>
              <TabsTrigger value="aides">Aides ({aides.length})</TabsTrigger>
            </TabsList>

            {/* Aperçu */}
            <TabsContent value="apercu" className="space-y-3">
              <Card>
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <Info label="Type" value={labelTypeFormation(campagne.typeFormation)} />
                  <Info label="Nature" value={NATURE_LIBELLES[campagne.nature] || campagne.nature.replace(/_/g, " ")} />
                  <div>
                    <p className="text-xs text-muted-foreground">Statut</p>
                    {editingStatut ? (
                      <div className="flex items-center gap-1">
                        <Select value={campagne.statut} onValueChange={updateStatut}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planifiee">Planifiée</SelectItem>
                            <SelectItem value="prep_sol">Prépa. sol</SelectItem>
                            <SelectItem value="plantation">Plantation</SelectItem>
                            <SelectItem value="suivi">Suivi</SelectItem>
                            <SelectItem value="terminee">Terminée</SelectItem>
                            <SelectItem value="echec">Échec</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => setEditingStatut(false)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Badge>{labelStatut(campagne.statut)}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => setEditingStatut(true)}><Edit2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                  <Info label="Surface" value={campagne.surfaceHa ? `${campagne.surfaceHa} ha` : "—"} />
                  <Info label="Plants prévus" value={campagne.nombrePlants?.toLocaleString("fr-FR") || "—"} />
                  <Info label="Densité" value={campagne.densitePlantsParHa ? `${Math.round(campagne.densitePlantsParHa)}/ha` : "—"} />
                  <Info label="Essence" value={campagne.essenceLibre || campagne.espece?.nomLatin || "—"} />
                  <Info label="Variété/Provenance" value={campagne.varieteOuProvenance || "—"} />
                  <Info label="Pépinière" value={campagne.pepiniere || "—"} />
                  <Info label="Date plantation prévue" value={campagne.datePlantationPrevue ? new Date(campagne.datePlantationPrevue).toLocaleDateString("fr-FR") : "—"} />
                  <Info label="Date plantation réelle" value={campagne.datePlantationReelle ? new Date(campagne.datePlantationReelle).toLocaleDateString("fr-FR") : "—"} />
                  <Info label="Taux de reprise" value={campagne.tauxReprise !== null ? `${campagne.tauxReprise.toFixed(1)}%` : "—"} />
                  <Info label="Localisation" value={campagne.parcelleGeo?.nom || campagne.zoneVerger?.nom || "—"} />
                  <Info label="Protection" value={campagne.protectionType || "—"} />
                  <Info label="Objectifs" value={campagne.objectifs || "—"} />
                  <Info label="Budget prévu" value={campagne.budgetPrevu ? `${campagne.budgetPrevu.toFixed(2)} €` : "—"} />
                  <Info label="Coût réel" value={campagne.coutReel ? `${campagne.coutReel.toFixed(2)} €` : "—"} />
                  <Info label="Aides perçues" value={campagne.montantAides ? `${campagne.montantAides.toFixed(2)} €` : "—"} />
                </CardContent>
              </Card>
              {/* Contexte de la replantation (si applicable) */}
              {(campagne.nature === "replantation_apres_coupe" || campagne.nature === "replantation_apres_mortalite" || campagne.cause || campagne.peuplementPrecedent) && (
                <Card className="border-amber-300 bg-amber-50/30">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium text-amber-900">Contexte de la replantation</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <Info label="Cause" value={campagne.cause ? (CAUSE_LIBELLES[campagne.cause] || campagne.cause) : "—"} />
                      <Info label="Essence précédente" value={campagne.essencePrecedente || "—"} />
                      <Info label="Âge à la coupe" value={campagne.ageAvantCoupe ? `${campagne.ageAvantCoupe} ans` : "—"} />
                      <Info label="Surface initiale" value={campagne.surfacePrecedenteHa ? `${campagne.surfacePrecedenteHa} ha` : "—"} />
                      {campagne.productionBois && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-xs text-muted-foreground">Coupe d'origine</p>
                          <p className="font-medium text-sm">
                            {new Date(campagne.productionBois.date).toLocaleDateString("fr-FR")}
                            {campagne.productionBois.arbre?.nom ? ` — ${campagne.productionBois.arbre.nom}` : ""}
                            {campagne.productionBois.volumeM3 ? ` (${campagne.productionBois.volumeM3} m³)` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                    {campagne.peuplementPrecedent && (
                      <div>
                        <p className="text-xs text-muted-foreground">Description peuplement précédent</p>
                        <p className="text-sm whitespace-pre-wrap">{campagne.peuplementPrecedent}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {campagne.notes && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{campagne.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Etapes */}
            <TabsContent value="etapes" className="space-y-3">
              {campagne.etapes.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune étape planifiée</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {campagne.etapes.map((etape) => (
                    <Card key={etape.id} className={etape.fait ? "bg-green-50/40" : ""}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEtape(etape)}
                          className="flex-shrink-0"
                        >
                          {etape.fait ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4 border-2 rounded" />
                          )}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${etape.fait ? "line-through text-muted-foreground" : ""}`}>
                              {etape.description || ETAPE_LIBELLES[etape.type] || etape.type}
                            </span>
                            <Badge variant="outline" className="text-xs">{ETAPE_LIBELLES[etape.type] || etape.type}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {etape.datePrevue && (
                              <span><CalendarClock className="h-3 w-3 inline mr-1" />Prévue : {new Date(etape.datePrevue).toLocaleDateString("fr-FR")}</span>
                            )}
                            {etape.dateRealisation && (
                              <span>✓ Réalisée : {new Date(etape.dateRealisation).toLocaleDateString("fr-FR")}</span>
                            )}
                            {etape.cout != null && <span>{etape.cout.toFixed(2)} €</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteEtape(etape)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Suivi reprise */}
            <TabsContent value="suivi" className="space-y-3">
              {/* Form nouvelle observation */}
              <Card>
                <CardContent className="p-4">
                  <form onSubmit={submitObservation} className="space-y-3">
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Nouvelle observation
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Plants vivants</Label>
                        <Input type="number" value={obsForm.nbVivants} onChange={(e) => setObsForm({ ...obsForm, nbVivants: e.target.value })} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Morts</Label>
                        <Input type="number" value={obsForm.nbMorts} onChange={(e) => setObsForm({ ...obsForm, nbMorts: e.target.value })} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Manquants</Label>
                        <Input type="number" value={obsForm.nbManquants} onChange={(e) => setObsForm({ ...obsForm, nbManquants: e.target.value })} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Hauteur moy. (cm)</Label>
                        <Input type="number" step="0.1" value={obsForm.hauteurMoyenneCm} onChange={(e) => setObsForm({ ...obsForm, hauteurMoyenneCm: e.target.value })} className="h-8" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Vigueur</Label>
                        <Select value={obsForm.vigueur} onValueChange={(v) => setObsForm({ ...obsForm, vigueur: v })}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellente">Excellente</SelectItem>
                            <SelectItem value="bonne">Bonne</SelectItem>
                            <SelectItem value="moyenne">Moyenne</SelectItem>
                            <SelectItem value="faible">Faible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Problèmes rencontrés</Label>
                        <Input
                          value={obsForm.problemes}
                          onChange={(e) => setObsForm({ ...obsForm, problemes: e.target.value })}
                          placeholder="gibier, sécheresse, ..."
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Notes</Label>
                      <Textarea
                        value={obsForm.notes}
                        onChange={(e) => setObsForm({ ...obsForm, notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <Button type="submit" size="sm">
                      <Save className="h-4 w-4 mr-1" />Enregistrer l'observation
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Liste observations */}
              {campagne.observations.length === 0 ? (
                <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">Aucune observation enregistrée</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {campagne.observations.map((obs) => (
                    <Card key={obs.id}>
                      <CardContent className="p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{new Date(obs.date).toLocaleDateString("fr-FR")}</span>
                          {obs.tauxReprise !== null && (
                            <Badge variant={obs.tauxReprise >= 80 ? "default" : obs.tauxReprise >= 60 ? "secondary" : "destructive"}>
                              Reprise : {obs.tauxReprise.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                          {obs.nbVivants !== null && <span>✓ {obs.nbVivants} vivants</span>}
                          {obs.nbMorts !== null && <span>✗ {obs.nbMorts} morts</span>}
                          {obs.nbManquants !== null && <span>? {obs.nbManquants} manquants</span>}
                          {obs.hauteurMoyenneCm !== null && <span>📏 {obs.hauteurMoyenneCm} cm</span>}
                          {obs.vigueur && <span>💪 {obs.vigueur}</span>}
                          {obs.problemes && <span>⚠️ {obs.problemes}</span>}
                        </div>
                        {obs.notes && <p className="mt-2 text-xs whitespace-pre-wrap">{obs.notes}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Aides */}
            <TabsContent value="aides" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Dispositifs d'aide compatibles avec ce type de plantation.
              </p>
              {aides.length === 0 ? (
                <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">Aucune aide spécifique référencée pour ce type. <Link href="/verger/aides" className="underline">Voir tout le catalogue</Link></CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {aides.map((aide) => (
                    <Card key={aide.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-sm">{aide.nom}</p>
                          <Badge variant="outline" className="text-xs flex-shrink-0">{NIVEAU_LIBELLE[aide.niveau]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{aide.organisme}</p>
                        <p className="text-xs mb-2">{aide.description}</p>
                        {aide.tauxAide && <p className="text-xs"><span className="font-medium">Taux :</span> {aide.tauxAide}</p>}
                        <a href={aide.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">En savoir plus →</a>
                      </CardContent>
                    </Card>
                  ))}
                  <div className="text-center pt-2">
                    <Link href="/verger/aides"><Button variant="outline" size="sm"><HelpCircle className="h-4 w-4 mr-1" />Voir tout le catalogue d'aides</Button></Link>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
