"use client"

/**
 * Onglet Especes - Referentiel des especes animales
 */

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  Settings,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Bird,
  ArrowRight,
  Calculator,
  BarChart3,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  OrigineControls,
  useReferentielActions,
  FiltreOrigine,
  filtrerParOrigine,
  type FiltreOrigineValue,
} from "@/components/referentiel/catalogue-communaute"
import { useElevageModes } from "@/hooks/use-elevage-modes"
import { FILIERE_LABELS, type Filiere } from "@/lib/elevage/filiere"
import { capacites } from "@/lib/elevage/filiere-ui"
import { useFiliereSelection, filiereMatch } from "@/lib/elevage/filiere-context"

interface EspeceAnimale {
  id: string
  nom: string
  type: string
  filiere: string
  production: string
  dureeGestation: number | null
  dureeCouvaison: number | null
  dureeElevage: number | null
  poidsAdulte: number | null
  rendementCarcasse: number | null
  ponteAnnuelle: number | null
  consommationJour: number | null
  prixAchat: number | null
  couleur: string | null
  description: string | null
  userId: string | null
  partageCommunaute: boolean
  _count: { animaux: number; lots: number }
}

const TYPE_LABELS: Record<string, string> = {
  volaille: "Volaille",
  mammifere_petit: "Petit mammifère",
  mammifere_grand: "Grand mammifère",
  autre: "Autre",
}

const PRODUCTION_LABELS: Record<string, string> = {
  oeufs: "Œufs",
  viande: "Viande",
  lait: "Lait",
  laine: "Laine",
  mixte: "Mixte",
}

const TYPE_COLORS: Record<string, string> = {
  volaille: "bg-yellow-100 text-yellow-800",
  mammifere_petit: "bg-purple-100 text-purple-800",
  mammifere_grand: "bg-blue-100 text-blue-800",
  autre: "bg-slate-100 text-slate-800",
}

const ESPECE_TYPES = [
  { value: "all", label: "Tous" },
  { value: "volaille", label: "Volailles" },
  { value: "mammifere_petit", label: "Petits mammifères" },
  { value: "mammifere_grand", label: "Grands mammifères" },
  { value: "autre", label: "Autres" },
] as const

const emptyForm = {
  id: "", nom: "", type: "volaille", filiere: "rente", production: "viande",
  dureeGestation: "", dureeCouvaison: "", dureeElevage: "",
  poidsAdulte: "", rendementCarcasse: "", ponteAnnuelle: "",
  consommationJour: "", prixAchat: "", couleur: "#F59E0B", description: "",
  partageCommunaute: false,
}

/**
 * QA 2026-07-30 — L'identifiant dérivé du nom perdait les séparateurs : « Caille
 * QA 300726-79575 » donnait `caille_qa_30072679575` (tiret supprimé au lieu
 * d'être converti). Les suites de caractères non alphanumériques deviennent un
 * seul « _ », sans souligné en tête ni en fin.
 */
function normaliserIdentifiantEspece(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function EspecesTab() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [isLoading, setIsLoading] = React.useState(true)
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [filteredEspeces, setFilteredEspeces] = React.useState<EspeceAnimale[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  // Une fois l'identifiant saisi à la main, le champ Nom ne l'écrase plus.
  const [idModifieManuellement, setIdModifieManuellement] = React.useState(false)
  const [especeSubmitError, setEspeceSubmitError] = React.useState<string | null>(null)
  const [isSavingEspece, setIsSavingEspece] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState(emptyForm)
  const [selectedType, setSelectedType] = React.useState("all")
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")
  // Modes d'élevage actifs → filières sélectionnables (toujours 'rente' + optionnelles).
  const { filieres } = useElevageModes()
  const filiereSel = useFiliereSelection()
  const prodRente = capacites((formData.filiere || "rente") as Filiere).productionRente

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/elevage/especes-animales')
      if (res.ok) {
        const result = await res.json()
        setEspeces(result.data)
      } else {
        throw new Error("Erreur de chargement")
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les espèces" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const referentielActions = useReferentielActions("/api/elevage/especes-animales", fetchData, toast)

  React.useEffect(() => {
    if (selectedType === "all") {
      setFilteredEspeces(especes)
    } else {
      setFilteredEspeces(especes.filter(e => e.type === selectedType))
    }
  }, [selectedType, especes])

  // Filtre d'origine (Gleba / communauté / perso) appliqué par-dessus le filtre de type.
  // On ne montre que les filières RÉELLEMENT actives pour l'utilisateur
  // (rente + modes activés) : sans ça, les espèces compagnie/équin/NAC du
  // catalogue officiel partagé pollueraient la liste d'un éleveur 100 % rente.
  // Le sélecteur d'atelier restreint ensuite à l'intérieur de ce périmètre.
  const displayedEspeces = React.useMemo(
    () =>
      filtrerParOrigine(filteredEspeces, filtreOrigine, currentUserId).filter(
        (e) => filieres.includes((e.filiere || "rente") as Filiere) && filiereMatch(filiereSel, e.filiere)
      ),
    [filteredEspeces, filtreOrigine, currentUserId, filiereSel, filieres]
  )

  const openCreate = () => {
    setEditingId(null)
    setIdModifieManuellement(false)
    setEspeceSubmitError(null)
    // Pré-remplit la filière avec celle sélectionnée en tête de module.
    setFormData({ ...emptyForm, filiere: filiereSel !== "toutes" ? filiereSel : "rente" })
    setIsDialogOpen(true)
  }

  const openEdit = (e: EspeceAnimale) => {
    setEditingId(e.id)
    setEspeceSubmitError(null)
    setFormData({
      id: e.id, nom: e.nom, type: e.type, filiere: e.filiere || "rente", production: e.production,
      dureeGestation: e.dureeGestation?.toString() || "",
      dureeCouvaison: e.dureeCouvaison?.toString() || "",
      dureeElevage: e.dureeElevage?.toString() || "",
      poidsAdulte: e.poidsAdulte?.toString() || "",
      rendementCarcasse: e.rendementCarcasse?.toString() || "",
      ponteAnnuelle: e.ponteAnnuelle?.toString() || "",
      consommationJour: e.consommationJour?.toString() || "",
      prixAchat: e.prixAchat?.toString() || "",
      couleur: e.couleur || "#F59E0B",
      description: e.description || "",
      partageCommunaute: e.partageCommunaute,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEspeceSubmitError(null)
    setIsSavingEspece(true)
    try {
      const payload: any = {
        id: normaliserIdentifiantEspece(formData.id),
        nom: formData.nom, type: formData.type, filiere: formData.filiere,
        production: capacites((formData.filiere || 'rente') as Filiere).productionRente ? formData.production : 'compagnie',
        couleur: formData.couleur || null, description: formData.description || null,
        // Bug cmp8sg697 — pas de gestation pour les volailles
        dureeGestation: formData.type === 'volaille'
          ? null
          : (formData.dureeGestation ? parseInt(formData.dureeGestation) : null),
        dureeCouvaison: formData.dureeCouvaison ? parseInt(formData.dureeCouvaison) : null,
        dureeElevage: formData.dureeElevage ? parseInt(formData.dureeElevage) : null,
        poidsAdulte: formData.poidsAdulte ? parseFloat(formData.poidsAdulte) : null,
        rendementCarcasse: formData.rendementCarcasse ? parseFloat(formData.rendementCarcasse) : null,
        ponteAnnuelle: formData.ponteAnnuelle ? parseInt(formData.ponteAnnuelle) : null,
        consommationJour: formData.consommationJour ? parseFloat(formData.consommationJour) : null,
        prixAchat: formData.prixAchat ? parseFloat(formData.prixAchat) : null,
        partageCommunaute: formData.partageCommunaute,
      }

      const isEdit = editingId !== null
      const url = isEdit
        ? `/api/elevage/especes-animales/${encodeURIComponent(editingId)}`
        : '/api/elevage/especes-animales'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.error || 'Erreur')
      }

      toast({ title: isEdit ? "Profil modifié" : "Profil créé", description: formData.nom })
      setIsDialogOpen(false)
      setFormData(emptyForm)
      setEditingId(null)
      fetchData()
    } catch (error: any) {
      const message = error.message || "Impossible de sauvegarder"
      // Le message reste dans le formulaire : un toast seul disparaît et laisse
      // croire à une saisie perdue.
      setEspeceSubmitError(message)
      toast({ variant: "destructive", title: "Erreur", description: message })
    } finally {
      setIsSavingEspece(false)
    }
  }

  const NAV_CARDS = [
    {
      title: "Animaux par espèce",
      description: `${especes.reduce((s, e) => s + e._count.animaux, 0)} animaux, ${especes.reduce((s, e) => s + e._count.lots, 0)} lots`,
      icon: Bird,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      onClick: () => setSelectedType("all"),
    },
    {
      title: "Paramètres zootechniques",
      description: "Poids, ponte, gestation, conso/jour",
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      onClick: () => {},
    },
    {
      title: "Ajouter une espèce",
      description: "Volaille, mammifère, autre",
      icon: Plus,
      color: "text-green-600",
      bgColor: "bg-green-100",
      onClick: openCreate,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Cartes de navigation */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        {NAV_CARDS.map((item) => (
          <button
            key={item.title}
            onClick={item.onClick}
            className="text-left"
          >
            <Card className="h-full hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {item.title}
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>

      {/* Filtres par type */}
      <div className="flex items-center justify-between">
        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <TabsList className="flex-wrap h-auto gap-1">
            {ESPECE_TYPES.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Filtre par origine (catalogue Gleba / communauté / mes espèces) */}
      <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes profils" />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Couleur</TableHead>
                  <TableHead>Profil d&apos;élevage</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Production</TableHead>
                  <TableHead className="text-right">Poids adulte</TableHead>
                  <TableHead className="text-right">Conso/jour</TableHead>
                  <TableHead className="text-right">Ponte/an</TableHead>
                  <TableHead className="text-right">Prix achat</TableHead>
                  <TableHead className="text-right">Animaux</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedEspeces.map((esp) => (
                  <TableRow key={esp.id}>
                    <TableCell>
                      <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: esp.couleur || '#ccc' }} />
                    </TableCell>
                    <TableCell className="font-medium">{esp.nom}</TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[esp.type] || "bg-slate-100"} variant="secondary">
                        {TYPE_LABELS[esp.type] || esp.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{esp.filiere && esp.filiere !== 'rente' ? <span className="text-muted-foreground">—</span> : (PRODUCTION_LABELS[esp.production] || esp.production)}</TableCell>
                    <TableCell className="text-right">{esp.poidsAdulte ? `${esp.poidsAdulte} kg` : '-'}</TableCell>
                    <TableCell className="text-right">{esp.consommationJour ? `${esp.consommationJour} kg` : '-'}</TableCell>
                    <TableCell className="text-right">{esp.ponteAnnuelle || '-'}</TableCell>
                    <TableCell className="text-right">{esp.prixAchat ? `${esp.prixAchat} \u20ac` : '-'}</TableCell>
                    <TableCell className="text-right">
                      {esp._count.animaux + esp._count.lots > 0 ? (
                        <Badge variant="outline">
                          {esp._count.animaux} ind. / {esp._count.lots}{" "}
                          {esp._count.lots > 1 ? "lots" : "lot"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OrigineControls
                        entree={{ id: esp.id, userId: esp.userId, partageCommunaute: esp.partageCommunaute }}
                        nom={esp.nom}
                        currentUserId={currentUserId}
                        actions={referentielActions}
                        showRemove={false}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {(isAdmin || esp.userId === currentUserId) && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(esp)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => referentielActions.remove(esp.id, esp.nom)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {displayedEspeces.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Aucun profil d&apos;élevage configuré</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Creer/Modifier */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le profil d’élevage" : "Nouveau profil d’élevage"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifier ce couple espèce et orientation" : "Ajouter un couple espèce et orientation au référentiel"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => {
                    const nom = e.target.value
                    setFormData(f => ({
                      ...f, nom,
                      ...(editingId || idModifieManuellement ? {} : { id: normaliserIdentifiantEspece(nom) }),
                    }))
                  }}
                  placeholder="Poule pondeuse"
                />
              </div>
              <div className="space-y-2">
                <Label>Identifiant</Label>
                <Input
                  value={formData.id}
                  onChange={(e) => {
                    setIdModifieManuellement(true)
                    setFormData(f => ({ ...f, id: e.target.value }))
                  }}
                  placeholder="poule_pondeuse"
                  disabled={editingId !== null}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Filière *</Label>
                <Select value={formData.filiere} onValueChange={(v) => setFormData(f => ({ ...f, filiere: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {filieres.map((f) => (
                      <SelectItem key={f} value={f}>{FILIERE_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volaille">Volaille</SelectItem>
                    <SelectItem value="mammifere_petit">Petit mammifère</SelectItem>
                    <SelectItem value="mammifere_grand">Grand mammifère</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <Input type="color" value={formData.couleur} onChange={(e) => setFormData(f => ({ ...f, couleur: e.target.value }))} className="h-10 p-1" />
              </div>
            </div>
            {/* Production : notion de rente uniquement (masquée pour compagnie/équin/NAC) */}
            {prodRente && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Production *</Label>
                  <Select value={formData.production} onValueChange={(v) => setFormData(f => ({ ...f, production: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oeufs">Œufs</SelectItem>
                      <SelectItem value="viande">Viande</SelectItem>
                      <SelectItem value="lait">Lait</SelectItem>
                      <SelectItem value="laine">Laine</SelectItem>
                      <SelectItem value="mixte">Mixte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {/* Bug cmp8sg697 (Marc 2026-05-16) — Gestation est sans sens pour
                une volaille (poule, oie...). On affiche selon le type :
                volaille → Couvaison + Élevage ; mammifère → Gestation +
                Élevage. Évite de stocker des valeurs absurdes (31j gestation
                pour Poule Marans) qui faussent les calculs de mise-bas. */}
            <div className="grid grid-cols-3 gap-4">
              {formData.type === 'volaille' ? (
                <div className="space-y-2"><Label>Couvaison (j)</Label><Input type="number" min="0" value={formData.dureeCouvaison} onChange={(e) => setFormData(f => ({ ...f, dureeCouvaison: e.target.value }))} placeholder="21" /></div>
              ) : (
                <div className="space-y-2"><Label>Gestation (j)</Label><Input type="number" min="0" value={formData.dureeGestation} onChange={(e) => setFormData(f => ({ ...f, dureeGestation: e.target.value }))} placeholder="31" /></div>
              )}
              <div className="space-y-2"><Label>Élevage (j)</Label><Input type="number" min="0" value={formData.dureeElevage} onChange={(e) => setFormData(f => ({ ...f, dureeElevage: e.target.value }))} placeholder="90" /></div>
              <div /> {/* placeholder pour conserver la grille à 3 cols */}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Poids adulte (kg)</Label><Input type="number" min="0" step="0.1" value={formData.poidsAdulte} onChange={(e) => setFormData(f => ({ ...f, poidsAdulte: e.target.value }))} placeholder="3.5" /></div>
              {prodRente && <div className="space-y-2"><Label>Rendement carc. (%)</Label><Input type="number" min="0" max="1" step="0.01" value={formData.rendementCarcasse} onChange={(e) => setFormData(f => ({ ...f, rendementCarcasse: e.target.value }))} placeholder="0.72" /></div>}
              {prodRente && <div className="space-y-2"><Label>Ponte/an</Label><Input type="number" min="0" value={formData.ponteAnnuelle} onChange={(e) => setFormData(f => ({ ...f, ponteAnnuelle: e.target.value }))} placeholder="280" /></div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {prodRente && <div className="space-y-2"><Label>Conso/jour (kg)</Label><Input type="number" min="0" step="0.01" value={formData.consommationJour} onChange={(e) => setFormData(f => ({ ...f, consommationJour: e.target.value }))} placeholder="0.12" /></div>}
              <div className="space-y-2"><Label>Prix d'achat (&euro;)</Label><Input type="number" min="0" step="0.5" value={formData.prixAchat} onChange={(e) => setFormData(f => ({ ...f, prixAchat: e.target.value }))} placeholder="15" /></div>
            </div>
            {!isAdmin ? (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox
                  checked={formData.partageCommunaute}
                  onCheckedChange={(v) => setFormData(f => ({ ...f, partageCommunaute: v === true }))}
                />
                Proposer à la communauté Gleba
              </label>
            ) : !editingId ? (
              /* QA 2026-07-30 — Une création par un compte admin rejoint le
                 catalogue Gleba officiel (userId null) et n'apparaît donc jamais
                 sous « Mes profils » : sans cette mention, l'enregistrement
                 semblait perdu. */
              <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                Compte administrateur : cette espèce rejoindra le <strong>catalogue Gleba
                officiel</strong>. Elle n&apos;apparaîtra pas sous « Mes profils ».
              </p>
            ) : null}
            {/* QA 2026-07-30 — Deux créations successives (caille, escargot) ont
                été rapportées « perdues » alors qu'aucune requête n'a atteint le
                serveur : le bouton était en bas d'un formulaire long dans un
                dialogue défilant, et rien n'expliquait sa désactivation. Même
                traitement que le dialogue « Ajouter un animal » : pied de
                formulaire collant, motif de blocage explicite, erreur inline. */}
            <div className="sticky bottom-0 -mx-6 mt-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background px-6 py-3">
              {especeSubmitError && (
                <p role="alert" className="mr-auto text-sm text-red-600">{especeSubmitError}</p>
              )}
              {!especeSubmitError && (!formData.nom || !formData.id) && (
                <p className="mr-auto text-sm text-muted-foreground">
                  Renseignez le nom pour activer la création.
                </p>
              )}
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSavingEspece}>Annuler</Button>
              <Button
                type="submit"
                disabled={isSavingEspece || !formData.nom || !formData.id}
                title={!formData.nom
                  ? "Renseignez le nom de l'espèce"
                  : !formData.id
                    ? "Renseignez l'identifiant technique"
                    : undefined}
              >
                {isSavingEspece ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
