"use client"

/**
 * Onglet Reproduction - Naissances + Calculateur gestation
 */

import * as React from "react"
import {
  Baby,
  Plus,
  Pencil,
  RefreshCw,
  Calendar,
  Calculator,
  Trash2,
  Heart,
  Activity,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts"
import { todayLocalISO } from '@/lib/format-utils'

// ============================================================
// Types
// ============================================================

interface Naissance {
  id: number
  date: string
  nombreNes: number
  nombreVivants: number
  nombreMales: number | null
  nombreFemelles: number | null
  poidsTotal: number | null
  pereIdentifiant: string | null
  identifiantsProvisoires: string | null
  identifiantsDefinitifs: string | null
  notes: string | null
  mereId: number | null
  lotId: number | null
  lot: { id: number; nom: string | null; especeAnimale?: { nom: string } } | null
  mere: {
    id: number
    nom: string | null
    identifiant: string | null
    race: string | null
    especeAnimale: {
      id: string
      nom: string
      dureeGestation: number | null
      dureeCouvaison: number | null
    }
  } | null
}

interface NaissanceStats {
  totalNaissances: number
  totalNes: number
  totalVivants: number
  totalMales: number
  totalFemelles: number
  tauxSurvie: number | null
  parMois: { mois: number; nes: number; vivants: number }[]
}

interface AnimalFemelle {
  id: number
  nom: string | null
  identifiant: string | null
  race: string | null
  especeAnimale: {
    id: string
    nom: string
    dureeGestation: number | null
    dureeCouvaison: number | null
  }
}

const MOIS_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']

// ============================================================
// Composant principal
// ============================================================

export function ReproductionTab() {
  return (
    <Tabs defaultValue="saillies" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-y-1">
        <TabsTrigger value="saillies" className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" />
          Saillies
        </TabsTrigger>
        <TabsTrigger value="naissances" className="flex items-center gap-1.5">
          <Baby className="h-4 w-4" />
          Naissances
        </TabsTrigger>
        <TabsTrigger value="calculateur" className="flex items-center gap-1.5">
          <Calculator className="h-4 w-4" />
          Calculateur
        </TabsTrigger>
        <TabsTrigger value="campagnes" className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Campagnes
        </TabsTrigger>
        <TabsTrigger value="indicateurs" className="flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          Indicateurs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="saillies">
        <SailliesSubTab />
      </TabsContent>
      <TabsContent value="naissances">
        <NaissancesSubTab />
      </TabsContent>
      <TabsContent value="calculateur">
        <CalculateurSubTab />
      </TabsContent>
      <TabsContent value="campagnes">
        <CampagnesSubTab />
      </TabsContent>
      <TabsContent value="indicateurs">
        <IndicateursSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Campagnes de lutte / reproduction (PROMPT 24)
// ============================================================

type Campagne = {
  id: string
  nom: string
  typeConduite: string
  espece: string | null
  especeAnimaleId: string | null
  dateDebut: string
  dateFin: string | null
  objectifMiseBas: string | null
  notes: string | null
  nbSaillies: number
  tauxReussite: number | null
}
const TYPES_CONDUITE = [
  "Monte naturelle",
  "Désaisonnement lumineux",
  "Traitement hormonal",
  "Effet bouc",
  "IA",
] as const

function CampagnesSubTab() {
  const { toast } = useToast()
  const [campagnes, setCampagnes] = React.useState<Campagne[]>([])
  const [especes, setEspeces] = React.useState<{ id: string; nom: string }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const EMPTY = { nom: "", typeConduite: "Monte naturelle", especeAnimaleId: "", dateDebut: todayLocalISO(), dateFin: "", objectifMiseBas: "", notes: "" }
  const [form, setForm] = React.useState(EMPTY)
  const [saving, setSaving] = React.useState(false)

  const reload = React.useCallback(() => {
    setLoading(true)
    fetch("/api/elevage/campagnes")
      .then((r) => r.json())
      .then((j) => setCampagnes(j.data || []))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    reload()
    fetch("/api/elevage/especes-animales")
      .then((r) => r.json())
      .then((j) => setEspeces((j.data || []).map((e: { id: string; nom: string }) => ({ id: e.id, nom: e.nom }))))
      .catch(() => {})
  }, [reload])

  const submit = async () => {
    if (!form.nom.trim()) {
      toast({ variant: "destructive", title: "Nom requis" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/elevage/campagnes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom,
          typeConduite: form.typeConduite,
          especeAnimaleId: form.especeAnimaleId || null,
          dateDebut: form.dateDebut,
          dateFin: form.dateFin || null,
          objectifMiseBas: form.objectifMiseBas || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        toast({ variant: "destructive", title: "Erreur", description: j.error || "Échec" })
      } else {
        toast({ title: "Campagne créée" })
        setOpen(false)
        setForm(EMPTY)
        reload()
      }
    } finally {
      setSaving(false)
    }
  }

  const supprimer = async (c: Campagne) => {
    if (!(await confirmDialog(`Supprimer la campagne « ${c.nom} » ? Les saillies rattachées seront détachées.`))) return
    const res = await fetch(`/api/elevage/campagnes?id=${c.id}`, { method: "DELETE" })
    if (res.ok) reload()
    else toast({ variant: "destructive", title: "Suppression impossible" })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-rose-600" />
              Campagnes de lutte
            </CardTitle>
            <CardDescription>
              Planifiez les périodes de lutte (monte, désaisonnement, effet bouc) pour étaler les mises-bas et suivre la
              réussite par groupe. Rattachez-y les saillies dans l'onglet Saillies.
            </CardDescription>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle campagne
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : campagnes.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">
            Aucune campagne. Créez-en une pour planifier une période de lutte et regrouper les saillies.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-2 text-left">Campagne</th>
                  <th className="p-2 text-left">Conduite</th>
                  <th className="p-2 text-left">Période</th>
                  <th className="p-2 text-left">Mise-bas visée</th>
                  <th className="p-2 text-center">Saillies</th>
                  <th className="p-2 text-center">Réussite</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {campagnes.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">
                      {c.nom}
                      {c.espece && <span className="text-xs text-slate-400 ml-1">· {c.espece}</span>}
                    </td>
                    <td className="p-2"><Badge variant="outline">{c.typeConduite}</Badge></td>
                    <td className="p-2 text-slate-600">
                      {new Date(c.dateDebut).toLocaleDateString("fr-FR")}
                      {c.dateFin ? ` → ${new Date(c.dateFin).toLocaleDateString("fr-FR")}` : ""}
                    </td>
                    <td className="p-2 text-slate-600">
                      {c.objectifMiseBas ? new Date(c.objectifMiseBas).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="p-2 text-center">{c.nbSaillies}</td>
                    <td className="p-2 text-center">
                      {c.tauxReussite != null ? (
                        <Badge variant="outline" className={c.tauxReussite >= 80 ? "bg-emerald-50 text-emerald-700" : c.tauxReussite >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}>
                          {c.tauxReussite} %
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => supprimer(c)} title="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle campagne de lutte</DialogTitle>
            <DialogDescription>Regroupe une période de reproduction et ses saillies.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nom</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Lutte printemps 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conduite</Label>
                <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.typeConduite} onChange={(e) => setForm({ ...form, typeConduite: e.target.value })}>
                  {TYPES_CONDUITE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Espèce (option.)</Label>
                <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.especeAnimaleId} onChange={(e) => setForm({ ...form, especeAnimaleId: e.target.value })}>
                  <option value="">— Toutes —</option>
                  {especes.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Début</Label>
                <Input type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
              </div>
              <div>
                <Label>Fin (option.)</Label>
                <Input type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Mise-bas visée (option.)</Label>
              <Input type="date" value={form.objectifMiseBas} onChange={(e) => setForm({ ...form, objectifMiseBas: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "…" : "Créer"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============================================================
// Indicateurs de reproduction (PROMPT 23)
// ============================================================

type ReproData = {
  annee: number
  periode: {
    nbSaillies: number
    nbSailliesAvecIssue: number
    nbMiseBas: number
    tauxFertilite: number | null
    prolificite: number | null
    prolificiteVivants: number | null
    mortaliteNaissance: number | null
  }
  historique: {
    ivvMoyenJours: number | null
    nbFemellesIvv: number
    agePremierPartJours: number | null
    nbFemellesAgePremierPart: number
  }
}

function joursEnLisible(j: number | null): string {
  if (j == null) return "—"
  if (j >= 365) {
    const ans = Math.floor(j / 365)
    const mois = Math.round((j % 365) / 30)
    return mois > 0 ? `${ans} an${ans > 1 ? "s" : ""} ${mois} mois` : `${ans} an${ans > 1 ? "s" : ""}`
  }
  if (j >= 60) return `${Math.round(j / 30)} mois`
  return `${j} j`
}

type EtatTroupeau = {
  data: { id: number; nom: string | null; identifiant: string | null; espece: string | null; etat: string; label: string }[]
  repartition: Record<string, number>
  labels: Record<string, string>
}
const ETAT_COULEUR: Record<string, string> = {
  lactation: "bg-blue-100 text-blue-800 border-blue-200",
  lactation_gestante: "bg-violet-100 text-violet-800 border-violet-200",
  gestante_tarie: "bg-amber-100 text-amber-800 border-amber-200",
  vide: "bg-slate-100 text-slate-700 border-slate-200",
  nullipare: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

function IndicateursSubTab() {
  const [data, setData] = React.useState<ReproData | null>(null)
  const [etat, setEtat] = React.useState<EtatTroupeau | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(new Date().getFullYear())

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/elevage/repro-indicateurs?annee=${annee}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [annee])

  React.useEffect(() => {
    fetch(`/api/elevage/etat-physiologique`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setEtat(j) })
      .catch(() => {})
  }, [])

  const p = data?.periode
  const h = data?.historique

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-rose-600" />
              Indicateurs de reproduction
            </CardTitle>
            <CardDescription>
              Fertilité, prolificité et mortinatalité sur l'année ; intervalle entre mises-bas (IVV) et âge au premier
              part sur tout l'historique.
            </CardDescription>
          </div>
          <select
            className="h-9 rounded-md border border-slate-300 px-2 bg-white text-sm"
            value={annee}
            onChange={(e) => setAnnee(parseInt(e.target.value, 10))}
          >
            {[0, -1, -2, -3].map((d) => (
              <option key={d} value={new Date().getFullYear() + d}>
                {new Date().getFullYear() + d}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : !p || !h ? (
          <div className="text-sm text-slate-500">Données indisponibles.</div>
        ) : (
          <>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Campagne {data?.annee}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ReproTile
                  label="Fertilité"
                  value={p.tauxFertilite != null ? `${p.tauxFertilite} %` : "—"}
                  sub={`${p.nbSailliesAvecIssue} saillie(s) avec issue`}
                />
                <ReproTile
                  label="Prolificité"
                  value={p.prolificite != null ? `${p.prolificite}` : "—"}
                  sub={p.prolificiteVivants != null ? `${p.prolificiteVivants} vivants / MB` : "nés par mise-bas"}
                />
                <ReproTile
                  label="Mortinatalité"
                  value={p.mortaliteNaissance != null ? `${p.mortaliteNaissance} %` : "—"}
                  tone={p.mortaliteNaissance != null && p.mortaliteNaissance > 15 ? "bad" : "neutral"}
                  sub="nés − vivants"
                />
                <ReproTile label="Mises-bas" value={`${p.nbMiseBas}`} sub={`${p.nbSaillies} saillie(s)`} />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Structurel (historique)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ReproTile
                  label="IVV moyen"
                  value={joursEnLisible(h.ivvMoyenJours)}
                  sub={`${h.nbFemellesIvv} femelle(s) suivie(s)`}
                />
                <ReproTile
                  label="Âge au 1er part"
                  value={joursEnLisible(h.agePremierPartJours)}
                  sub={`${h.nbFemellesAgePremierPart} femelle(s)`}
                />
              </div>
            </div>
            {etat && etat.data.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">État physiologique du troupeau</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(etat.repartition)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <Badge key={k} variant="outline" className={ETAT_COULEUR[k] || ""}>
                        {etat.labels[k] || k} : {n}
                      </Badge>
                    ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <tbody>
                      {etat.data.map((f) => (
                        <tr key={f.id} className="border-b">
                          <td className="p-1.5 font-medium">{f.nom || f.identifiant || `#${f.id}`}</td>
                          <td className="p-1.5 text-slate-500 text-xs">{f.espece}</td>
                          <td className="p-1.5">
                            <Badge variant="outline" className={ETAT_COULEUR[f.etat] || ""}>{f.label}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Fertilité = saillies fécondantes / saillies avec issue connue. IVV = intervalle moyen entre deux
              mises-bas successives. État physiologique déduit des mises-bas, saillies gestantes et dernières traites.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ReproTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string
  value: string
  sub?: string
  tone?: "neutral" | "bad"
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${tone === "bad" ? "text-red-700" : "text-slate-800"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ============================================================
// Naissances
// ============================================================

function NaissancesSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [naissances, setNaissances] = React.useState<Naissance[]>([])
  const [stats, setStats] = React.useState<NaissanceStats | null>(null)
  const [femelles, setFemelles] = React.useState<AnimalFemelle[]>([])
  // Lots actifs pour rattacher une portée (élevage en lot, cmpm79lql)
  const [lots, setLots] = React.useState<{ id: number; nom: string | null; especeAnimale: { nom: string } }[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  // QA 2026-05-15 — édition par ligne
  const [editingNaissId, setEditingNaissId] = React.useState<number | null>(null)

  const EMPTY_NAISS_FORM = {
    mereId: "", lotId: "", pereIdentifiant: "", identifiantsProvisoires: "", identifiantsDefinitifs: "",
    date: todayLocalISO(),
    nombreNes: "", nombreVivants: "",
    nombreMales: "", nombreFemelles: "",
    poidsTotal: "", notes: "",
  }
  const [formData, setFormData] = React.useState(EMPTY_NAISS_FORM)

  const resetNaissForm = () => {
    setEditingNaissId(null)
    setFormData(EMPTY_NAISS_FORM)
  }

  const handleEditNaiss = (n: Naissance) => {
    setEditingNaissId(n.id)
    setFormData({
      mereId: n.mereId ? n.mereId.toString() : "",
      lotId: n.lotId ? n.lotId.toString() : "",
      pereIdentifiant: n.pereIdentifiant ?? "",
      identifiantsProvisoires: n.identifiantsProvisoires ?? "",
      identifiantsDefinitifs: n.identifiantsDefinitifs ?? "",
      date: n.date.split('T')[0],
      nombreNes: n.nombreNes.toString(),
      nombreVivants: n.nombreVivants.toString(),
      nombreMales: n.nombreMales != null ? n.nombreMales.toString() : "",
      nombreFemelles: n.nombreFemelles != null ? n.nombreFemelles.toString() : "",
      poidsTotal: n.poidsTotal != null ? n.poidsTotal.toString() : "",
      notes: n.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [naissRes, animauxRes, lotsRes] = await Promise.all([
        fetch('/api/elevage/naissances'),
        fetch('/api/elevage/animaux?statut=actif&sexe=femelle'),
        fetch('/api/elevage/lots?statut=actif'),
      ])

      if (naissRes.ok) {
        const result = await naissRes.json()
        setNaissances(result.data)
        setStats(result.stats)
      }
      if (animauxRes.ok) {
        const result = await animauxRes.json()
        setFemelles(result.data || [])
      }
      if (lotsRes.ok) {
        const result = await lotsRes.json()
        setLots(result.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const isEdit = editingNaissId !== null
      // Feedback Marc 2026-05-16 — Naissance : le formulaire stocke
      // tous ses champs en chaîne (Select & Input) mais l'API attend
      // des nombres (Zod `z.number()`). Avant cette normalisation, le
      // POST renvoyait systématiquement 400 « Données invalides » et
      // l'utilisateur voyait juste « Impossible d'enregistrer ». On
      // convertit explicitement chaque champ vers son type cible.
      const toIntOrNull = (s: string) => {
        if (!s || s.trim() === "") return null
        const n = parseInt(s, 10)
        return Number.isFinite(n) ? n : null
      }
      const toFloatOrNull = (s: string) => {
        if (!s || s.trim() === "") return null
        const n = parseFloat(s)
        return Number.isFinite(n) ? n : null
      }
      const payload = {
        ...(isEdit ? { id: editingNaissId } : {}),
        mereId: toIntOrNull(formData.mereId),
        lotId: toIntOrNull(formData.lotId),
        pereIdentifiant: formData.pereIdentifiant?.trim() || null,
        identifiantsProvisoires: formData.identifiantsProvisoires?.trim() || null,
        identifiantsDefinitifs: formData.identifiantsDefinitifs?.trim() || null,
        date: formData.date || undefined,
        nombreNes: toIntOrNull(formData.nombreNes) ?? 0,
        nombreVivants: toIntOrNull(formData.nombreVivants) ?? 0,
        nombreMales: toIntOrNull(formData.nombreMales),
        nombreFemelles: toIntOrNull(formData.nombreFemelles),
        poidsTotal: toFloatOrNull(formData.poidsTotal),
        notes: formData.notes?.trim() || null,
      }
      const response = await fetch('/api/elevage/naissances', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        // Récupérer le détail d'erreur (Zod) pour informer précisément.
        let description = "Impossible d'enregistrer"
        try {
          const err = await response.json()
          if (err?.error) description = String(err.error)
          if (err?.details?.fieldErrors) {
            const firstField = Object.entries(err.details.fieldErrors)[0]
            if (firstField && Array.isArray(firstField[1]) && firstField[1].length > 0) {
              description = `${firstField[0]} : ${firstField[1][0]}`
            }
          }
        } catch { /* ignore */ }
        throw new Error(description)
      }
      toast({
        title: isEdit ? "Naissance mise à jour" : "Naissance enregistrée",
        description: `${payload.nombreNes} né(s), ${payload.nombreVivants} vivant(s)`,
      })
      setIsDialogOpen(false)
      resetNaissForm()
      fetchData()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Supprimer cette naissance ?"))) return
    try {
      const res = await fetch(`/api/elevage/naissances?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: "Naissance supprimée" })
        fetchData()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de supprimer la naissance" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Preparer donnees graphique
  const chartData = React.useMemo(() => {
    if (!stats?.parMois) return []
    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      nes: stats.parMois[i]?.nes || 0,
      vivants: stats.parMois[i]?.vivants || 0,
    }))
  }, [stats])

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && stats.totalNaissances > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-pink-400 to-pink-500 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-pink-100 text-xs">Naissances</CardDescription>
              <CardTitle className="text-2xl">{stats.totalNaissances}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xs text-pink-100">mises bas / éclosions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Total nés</CardDescription>
              <CardTitle className="text-2xl">{stats.totalNes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Vivants</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.totalVivants}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Taux survie</CardDescription>
              <CardTitle className={`text-2xl ${(stats.tauxSurvie || 0) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                {stats.tauxSurvie !== null ? `${stats.tauxSurvie}%` : '-'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Sexes</CardDescription>
              <CardTitle className="text-lg">
                {stats.totalMales > 0 && <span className="text-blue-600">{stats.totalMales}M</span>}
                {stats.totalMales > 0 && stats.totalFemelles > 0 && ' / '}
                {stats.totalFemelles > 0 && <span className="text-pink-600">{stats.totalFemelles}F</span>}
                {stats.totalMales === 0 && stats.totalFemelles === 0 && '-'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Graphique naissances par mois */}
      {stats && stats.totalNaissances > 0 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm">Naissances par mois</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            <ChartContainer config={{}} className="h-[200px] aspect-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {/* Légende pour distinguer les 2 séries (cmpmr6l75) : sans
                      elle, les 2 barres d'un même mois semblaient être 2 mois. */}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="nes" fill="#f472b6" radius={[4, 4, 0, 0]} name="Nés" />
                  <Bar dataKey="vivants" fill="#34d399" radius={[4, 4, 0, 0]} name="Vivants" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetNaissForm() }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingNaissId(null)}><Plus className="h-4 w-4 mr-1" />Nouvelle naissance</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingNaissId ? "Modifier la naissance" : "Enregistrer une naissance"}</DialogTitle>
              <DialogDescription>{editingNaissId ? `Édition de la naissance #${editingNaissId}` : "Mise bas ou éclosion"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mère</Label>
                  <Select value={formData.mereId} onValueChange={(v) => setFormData(f => ({ ...f, mereId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner la mère..." /></SelectTrigger>
                    <SelectContent>
                      {femelles.map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          {a.nom || a.identifiant || `#${a.id}`} ({a.especeAnimale.nom})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Rattachement à un lot (élevage en lot sans mère
                    nominative, ex. lapins) — cmpm79lql. La portée est
                    alors comptée dans l'effectif du lot. */}
                <div className="space-y-2">
                  <Label>Lot des petits (optionnel)</Label>
                  <Select value={formData.lotId} onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Aucun lot — rattacher plus tard" /></SelectTrigger>
                    <SelectContent>
                      {lots.map(l => (
                        <SelectItem key={l.id} value={l.id.toString()}>
                          {l.nom || `Lot #${l.id}`} ({l.especeAnimale.nom})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choisissez par exemple « Chevreaux 2026 ». Aucun lot n’est créé automatiquement.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Boucles provisoires</Label><Input value={formData.identifiantsProvisoires} onChange={(e) => setFormData(f => ({ ...f, identifiantsProvisoires: e.target.value }))} placeholder="Une ou plusieurs, séparées par des virgules" /></div>
                <div className="space-y-2"><Label>Boucles définitives</Label><Input value={formData.identifiantsDefinitifs} onChange={(e) => setFormData(f => ({ ...f, identifiantsDefinitifs: e.target.value }))} placeholder="À compléter lors de la pose" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Père (identifiant)</Label>
                  <Input value={formData.pereIdentifiant} onChange={(e) => setFormData(f => ({ ...f, pereIdentifiant: e.target.value }))} placeholder="Optionnel" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre nés *</Label>
                  <Input type="number" min="0" value={formData.nombreNes} onChange={(e) => setFormData(f => ({ ...f, nombreNes: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre vivants *</Label>
                  <Input type="number" min="0" value={formData.nombreVivants} onChange={(e) => setFormData(f => ({ ...f, nombreVivants: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Mâles</Label>
                  <Input type="number" min="0" value={formData.nombreMales} onChange={(e) => setFormData(f => ({ ...f, nombreMales: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Femelles</Label>
                  <Input type="number" min="0" value={formData.nombreFemelles} onChange={(e) => setFormData(f => ({ ...f, nombreFemelles: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Poids total (kg)</Label>
                  <Input type="number" step="0.01" value={formData.poidsTotal} onChange={(e) => setFormData(f => ({ ...f, poidsTotal: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Complications, observations..." />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.nombreNes || !formData.nombreVivants}>
                  {editingNaissId ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Historique des naissances</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mère</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Espèce</TableHead>
                  <TableHead className="text-right">Nés</TableHead>
                  <TableHead className="text-right">Vivants</TableHead>
                  <TableHead className="text-right">M / F</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead>Boucles</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {naissances.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{new Date(n.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">
                      {n.mere ? (n.mere.nom || n.mere.identifiant || `#${n.mere.id}`) : '-'}
                    </TableCell>
                    <TableCell>{n.lot ? (n.lot.nom || `Lot #${n.lot.id}`) : '-'}</TableCell>
                    <TableCell>{n.mere?.especeAnimale.nom || n.lot?.especeAnimale?.nom || '-'}</TableCell>
                    <TableCell className="text-right font-bold">{n.nombreNes}</TableCell>
                    <TableCell className="text-right text-green-600 font-bold">{n.nombreVivants}</TableCell>
                    <TableCell className="text-right">
                      {n.nombreMales !== null || n.nombreFemelles !== null
                        ? `${n.nombreMales || 0}M / ${n.nombreFemelles || 0}F`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">{n.poidsTotal ? `${n.poidsTotal} kg` : '-'}</TableCell>
                    <TableCell className="text-xs"><div>{n.identifiantsProvisoires ? `Prov. ${n.identifiantsProvisoires}` : '—'}</div>{n.identifiantsDefinitifs && <div>Déf. {n.identifiantsDefinitifs}</div>}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{n.notes || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditNaiss(n)} title="Modifier" className="text-slate-600 hover:text-slate-900">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(n.id)} className="text-red-600 hover:text-red-700" title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {naissances.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Aucune naissance enregistrée</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Calculateur de gestation / couvaison
// ============================================================

function CalculateurSubTab() {
  const [especes, setEspeces] = React.useState<{ id: string; nom: string; type: string; dureeGestation: number | null; dureeCouvaison: number | null }[]>([])
  const [selectedEspece, setSelectedEspece] = React.useState<string>("")
  const [dateAccouplement, setDateAccouplement] = React.useState(todayLocalISO())

  React.useEffect(() => {
    fetch('/api/elevage/especes-animales')
      .then(res => res.ok ? res.json() : null)
      .then(result => { if (result?.data) setEspeces(result.data) })
      .catch(() => {})
  }, [])

  const espece = especes.find(e => e.id === selectedEspece)
  const duree = espece?.type === 'volaille' ? espece.dureeCouvaison : espece?.dureeGestation
  const typeLabel = espece?.type === 'volaille' ? 'Couvaison' : 'Gestation'

  const dateNaissancePrevue = React.useMemo(() => {
    if (!duree || !dateAccouplement) return null
    const d = new Date(dateAccouplement)
    d.setDate(d.getDate() + duree)
    return d
  }, [duree, dateAccouplement])

  const joursRestants = React.useMemo(() => {
    if (!dateNaissancePrevue) return null
    const diff = dateNaissancePrevue.getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }, [dateNaissancePrevue])

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4 text-pink-600" />
            Calculateur de gestation / couvaison
          </CardTitle>
          <CardDescription>
            Estimez la date de naissance en fonction de l'espèce et la date d'accouplement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Espèce</Label>
            <Select value={selectedEspece} onValueChange={setSelectedEspece}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {especes.filter(e => e.dureeGestation || e.dureeCouvaison).map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom} ({e.type === 'volaille' ? `${e.dureeCouvaison || '?'}j couvaison` : `${e.dureeGestation || '?'}j gestation`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date d'accouplement / mise en couveuse</Label>
            <Input type="date" value={dateAccouplement} onChange={(e) => setDateAccouplement(e.target.value)} />
          </div>

          {espece && duree && dateNaissancePrevue && (
            <div className="bg-pink-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Baby className="h-5 w-5 text-pink-600" />
                <span className="font-medium text-pink-700">{typeLabel} : {duree} jours</span>
              </div>
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground">Date prévue de naissance</p>
                <p className="text-2xl font-bold text-pink-700">
                  {dateNaissancePrevue.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {joursRestants !== null && (
                  <Badge className={`mt-2 ${joursRestants <= 0 ? 'bg-green-100 text-green-800' : joursRestants <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-pink-100 text-pink-800'}`}>
                    {joursRestants <= 0 ? 'Terme depasse !' : joursRestants === 1 ? 'Demain !' : `Dans ${joursRestants} jours`}
                  </Badge>
                )}
              </div>

              {/* Barre de progression */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Accouplement</span>
                  <span>Naissance</span>
                </div>
                <div className="h-3 bg-pink-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, ((duree - (joursRestants || 0)) / duree) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Jour {Math.max(0, duree - (joursRestants || 0))} / {duree}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// PROMPT 18 — Saillies / IA / Transferts d'embryon
// ============================================================

interface SaillieRow {
  id: string
  date: string
  type: string
  femelle: { id: number; nom: string | null; identifiant: string | null; race: string | null; especeAnimale: { id: string; nom: string } }
  male: { id: number; nom: string | null; identifiant: string | null; race: string | null } | null
  agentInseminateur: string | null
  semenceLot: string | null
  pereExterneRef: string | null
  confirmationGestation: string | null
  dateMiseBasAttendue: string
  dateTarissementPrevue: string | null
  statut: string
  notes: string | null
  miseBas: { id: number; date: string; nombreNes: number; nombreVivants: number } | null
}

function SailliesSubTab() {
  const { toast } = useToast()
  const [saillies, setSaillies] = React.useState<SaillieRow[]>([])
  const [animaux, setAnimaux] = React.useState<{ id: number; nom: string | null; identifiant: string | null; sexe: string | null; race: string | null }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const [filtreStatut, setFiltreStatut] = React.useState<string>("")
  // QA 2026-05-15 — saillie en cours d'édition (null = mode création)
  const [editingSaillie, setEditingSaillie] = React.useState<SaillieRow | null>(null)

  const reload = React.useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtreStatut) params.set("statut", filtreStatut)
    Promise.all([
      fetch(`/api/elevage/saillies?${params.toString()}`).then((r) => r.json()),
      fetch("/api/elevage/animaux?statut=actif").then((r) => r.json()),
    ])
      .then(([s, a]) => {
        setSaillies(s.data || [])
        setAnimaux(a.data || [])
      })
      .finally(() => setLoading(false))
  }, [filtreStatut])

  React.useEffect(() => {
    reload()
  }, [reload])

  // Review caprin 2026-07-21 — confirmer l'issue d'une saillie depuis la liste.
  // Sans ça, toute saillie restait « En attente » à vie → alertes mise-bas /
  // tarissement, état physiologique « gestante » et taux de fertilité jamais
  // déclenchés. Passer à « Gestante » horodate aussi la confirmation.
  const STATUTS = ["En attente", "Gestante", "Non gestante", "Avortement", "Mise-bas réalisée"]
  const changerStatut = async (s: SaillieRow, statut: string) => {
    if (statut === s.statut) return
    const body: Record<string, unknown> = { id: s.id, statut }
    if (statut === "Gestante" && !s.confirmationGestation) {
      body.confirmationGestation = new Date().toISOString()
    }
    const res = await fetch("/api/elevage/saillies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast({ title: "Statut mis à jour", description: statut === "Gestante" ? "Gestation confirmée — alertes mise-bas et tarissement activées." : undefined })
      reload()
    } else {
      const j = await res.json().catch(() => ({}))
      toast({ variant: "destructive", title: "Erreur", description: j.error })
    }
  }

  // Alertes : mises-bas dans les 7 prochains jours, tarissements à programmer (≤14j)
  const now = new Date()
  const dans7j = new Date(now.getTime() + 7 * 86_400_000)
  const dans14j = new Date(now.getTime() + 14 * 86_400_000)
  const misesBasImminentes = saillies.filter(
    (s) => s.statut === "Gestante" && new Date(s.dateMiseBasAttendue) <= dans7j && new Date(s.dateMiseBasAttendue) >= now
  )
  const tarissementsAProgrammer = saillies.filter(
    (s) =>
      s.statut === "Gestante" &&
      s.dateTarissementPrevue &&
      new Date(s.dateTarissementPrevue) <= dans14j &&
      new Date(s.dateTarissementPrevue) >= now
  )

  return (
    <div className="space-y-4">
      {(misesBasImminentes.length > 0 || tarissementsAProgrammer.length > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm space-y-1">
            {misesBasImminentes.length > 0 && (
              <div>
                <strong>⚠ Mises-bas attendues dans les 7 jours :</strong>{" "}
                {misesBasImminentes.map((s) => `${s.femelle.nom || s.femelle.identifiant || `#${s.femelle.id}`} (${new Date(s.dateMiseBasAttendue).toLocaleDateString("fr-FR")})`).join(", ")}
              </div>
            )}
            {tarissementsAProgrammer.length > 0 && (
              <div>
                <strong>🥛 Tarissements à programmer (≤14 j) :</strong>{" "}
                {tarissementsAProgrammer.map((s) => `${s.femelle.nom || s.femelle.identifiant || `#${s.femelle.id}`} (${new Date(s.dateTarissementPrevue!).toLocaleDateString("fr-FR")})`).join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-600" />
                Saillies
              </CardTitle>
              <CardDescription>
                Date de mise-bas attendue calculée automatiquement selon la durée de gestation de l'espèce.
                Alerte consanguinité au moment de la création.
              </CardDescription>
            </div>
            <div className="flex items-end gap-2">
              <select
                className="h-9 rounded-md border border-slate-300 px-2 bg-white text-sm"
                value={filtreStatut}
                onChange={(e) => setFiltreStatut(e.target.value)}
              >
                <option value="">Tous statuts</option>
                <option value="En attente">En attente</option>
                <option value="Gestante">Gestante</option>
                <option value="Non gestante">Non gestante</option>
                <option value="Mise-bas réalisée">Mise-bas réalisée</option>
                <option value="Avortement">Avortement</option>
              </select>
              <a
                href={`/api/elevage/carnet-saillies?year=${new Date().getFullYear()}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" title="Carnet de saillies PDF">
                  <Calendar className="h-4 w-4 mr-1" />
                  Carnet PDF
                </Button>
              </a>
              <Button size="sm" onClick={() => { setEditingSaillie(null); setOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle saillie
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : saillies.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Aucune saillie enregistrée.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Femelle</th>
                    <th className="p-2 text-left">Mâle / IA</th>
                    <th className="p-2 text-left">Mise-bas att.</th>
                    <th className="p-2 text-left">Tariss.</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {saillies.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{new Date(s.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2">{s.type}</td>
                      <td className="p-2">{s.femelle.nom || s.femelle.identifiant || `#${s.femelle.id}`}</td>
                      <td className="p-2">
                        {s.male
                          ? s.male.nom || s.male.identifiant || `#${s.male.id}`
                          : s.pereExterneRef || (s.agentInseminateur ? `IA ${s.agentInseminateur}` : "—")}
                      </td>
                      <td className="p-2">{new Date(s.dateMiseBasAttendue).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 text-xs">
                        {s.dateTarissementPrevue ? new Date(s.dateTarissementPrevue).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="p-2">
                        <select
                          className={`text-xs rounded border px-1.5 py-1 cursor-pointer ${
                            s.statut === "Gestante" ? "bg-blue-50 border-blue-200 text-blue-800" :
                            s.statut === "Mise-bas réalisée" ? "bg-green-50 border-green-200 text-green-800" :
                            s.statut === "Avortement" ? "bg-red-50 border-red-200 text-red-800" :
                            s.statut === "Non gestante" ? "bg-slate-50 border-slate-200 text-slate-600" :
                            "bg-amber-50 border-amber-200 text-amber-800"
                          }`}
                          value={s.statut}
                          onChange={(e) => changerStatut(s, e.target.value)}
                          title="Confirmer l'issue de la saillie"
                        >
                          {STATUTS.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Modifier"
                            className="text-slate-600 hover:text-slate-900"
                            onClick={() => { setEditingSaillie(s); setOpen(true) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!(await confirmDialog("Supprimer cette saillie ?"))) return
                              const res = await fetch(`/api/elevage/saillies?id=${s.id}`, { method: "DELETE" })
                              if (res.ok) reload()
                              else {
                                const j = await res.json()
                                toast({ variant: "destructive", title: "Refusé", description: j.error })
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogSaillie
        open={open}
        onOpenChange={(b) => { setOpen(b); if (!b) setEditingSaillie(null) }}
        animaux={animaux}
        onCreated={reload}
        editingSaillie={editingSaillie}
      />
    </div>
  )
}

// QA 2026-05-15 — édition par ligne pour SailliesSubTab
function DialogSaillie(props: {
  open: boolean
  onOpenChange: (b: boolean) => void
  animaux: { id: number; nom: string | null; identifiant: string | null; sexe: string | null; race: string | null }[]
  onCreated: () => void
  editingSaillie?: SaillieRow | null
}) {
  const { toast } = useToast()
  const isEdit = !!props.editingSaillie
  const [form, setForm] = React.useState({
    date: todayLocalISO(),
    femelleId: 0,
    maleId: 0,
    type: "Monte naturelle",
    agentInseminateur: "",
    semenceLot: "",
    pereExterneRef: "",
    notes: "",
  })

  // Pré-remplir depuis editingSaillie quand on ouvre en mode édition
  React.useEffect(() => {
    if (props.open && props.editingSaillie) {
      const s = props.editingSaillie
      setForm({
        date: s.date.split("T")[0],
        femelleId: s.femelle.id,
        maleId: s.male?.id ?? 0,
        type: s.type ?? "Monte naturelle",
        agentInseminateur: s.agentInseminateur ?? "",
        semenceLot: s.semenceLot ?? "",
        pereExterneRef: s.pereExterneRef ?? "",
        notes: s.notes ?? "",
      })
    } else if (props.open && !props.editingSaillie) {
      setForm({
        date: todayLocalISO(),
        femelleId: 0, maleId: 0, type: "Monte naturelle",
        agentInseminateur: "", semenceLot: "", pereExterneRef: "", notes: "",
      })
    }
  }, [props.open, props.editingSaillie])
  const [warning, setWarning] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const femelles = props.animaux.filter((a) => a.sexe === "femelle")
  const males = props.animaux.filter((a) => a.sexe === "male")

  // Détection consanguinité à la volée
  React.useEffect(() => {
    if (!form.femelleId || !form.maleId) {
      setWarning(null)
      return
    }
    fetch(`/api/elevage/consanguinite?femelleId=${form.femelleId}&maleId=${form.maleId}`)
      .then((r) => r.json())
      .then((j) => {
        setWarning(j.consanguinite ? `⚠ Ancêtre(s) commun(s) sur 3 générations (animaux #${j.ancetresCommuns.join(", #")})` : null)
      })
  }, [form.femelleId, form.maleId])

  const submit = async () => {
    if (!form.femelleId) {
      toast({ variant: "destructive", title: "Femelle requise" })
      return
    }
    setSaving(true)
    try {
      const body = {
        ...(isEdit ? { id: props.editingSaillie!.id } : {}),
        date: form.date,
        femelleId: form.femelleId,
        maleId: form.type === "Monte naturelle" && form.maleId ? form.maleId : null,
        type: form.type,
        agentInseminateur: form.type === "IA" ? form.agentInseminateur || null : null,
        semenceLot: form.type === "IA" ? form.semenceLot || null : null,
        pereExterneRef: form.pereExterneRef || null,
        notes: form.notes || null,
      }
      const res = await fetch("/api/elevage/saillies", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: json.error || "Échec" })
      } else {
        if (json.warnings?.length > 0) {
          toast({ title: isEdit ? "Saillie mise à jour" : "Saillie enregistrée", description: json.warnings[0].message })
        } else {
          toast({ title: isEdit ? "Saillie mise à jour" : "Saillie enregistrée" })
        }
        props.onOpenChange(false)
        props.onCreated()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Modifier la saillie #${props.editingSaillie!.id}` : "Nouvelle saillie"}</DialogTitle>
          <DialogDescription>
            La date de mise-bas attendue sera recalculée automatiquement selon l'espèce de la femelle.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date saillie</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>Type</Label>
            <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="Monte naturelle">Monte naturelle</option>
              <option value="IA">Insémination artificielle</option>
              <option value="Transfert embryon">Transfert d'embryon</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label>Femelle *</Label>
            <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.femelleId} onChange={(e) => setForm({ ...form, femelleId: parseInt(e.target.value) || 0 })}>
              <option value="0">— Sélectionner —</option>
              {femelles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom || a.identifiant || `#${a.id}`} {a.race ? `(${a.race})` : ""}
                </option>
              ))}
            </select>
          </div>
          {form.type === "Monte naturelle" && (
            <div className="col-span-2">
              <Label>Mâle (cheptel)</Label>
              <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.maleId} onChange={(e) => setForm({ ...form, maleId: parseInt(e.target.value) || 0 })}>
                <option value="0">— Aucun (saillie externe) —</option>
                {males.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom || a.identifiant || `#${a.id}`} {a.race ? `(${a.race})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.type === "IA" && (
            <>
              <div>
                <Label>Agent inséminateur</Label>
                <Input value={form.agentInseminateur} onChange={(e) => setForm({ ...form, agentInseminateur: e.target.value })} placeholder="n° agrément" />
              </div>
              <div>
                <Label>Lot semence</Label>
                <Input value={form.semenceLot} onChange={(e) => setForm({ ...form, semenceLot: e.target.value })} />
              </div>
            </>
          )}
          {form.type !== "Monte naturelle" && (
            <div className="col-span-2">
              <Label>Référence père externe (optionnel)</Label>
              <Input value={form.pereExterneRef} onChange={(e) => setForm({ ...form, pereExterneRef: e.target.value })} placeholder="Nom, n° taureau, ..." />
            </div>
          )}
          <div className="col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {warning && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded text-sm mt-2">{warning}</div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {!isEdit && <Plus className="h-4 w-4 mr-1" />}
            {isEdit ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
