"use client"

/**
 * Sous-onglet Lait — PROMPT 17.
 *
 * Trois vues :
 *  - Collecte : calendrier biquotidien (7 derniers jours × Matin/Soir) avec
 *    saisie rapide volume + bouton "Idem hier"
 *  - Fabrications : liste LotFromage + création depuis collectes non affectées
 *  - Courbe lactation : par animal (305 j depuis dernière mise-bas)
 */

import * as React from "react"
import { Milk, FileText, LineChart, Plus, Copy, Loader2, Download, Trash2, ShieldAlert, TrendingUp, TrendingDown, Minus, Trophy, Truck, Warehouse } from "lucide-react"
import { LivraisonLaitSubTab } from "./LivraisonLaitSubTab"
import { AffinageSubTab } from "./AffinageSubTab"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { todayLocalISO } from '@/lib/format-utils'

type Animal = { id: number; nom: string | null; identifiant: string | null; especeAnimale?: { production?: string; nom?: string } }
type Lot = { id: number; nom: string | null; especeAnimale?: { production?: string; nom?: string } }
type Collecte = {
  id: string
  date: string
  traite: "Matin" | "Soir" | "Unique"
  animalId: number | null
  lotId: number | null
  quantiteLitres: string | number
  ecarteAttente: boolean
  lotFromageId: string | null
  lotFromage: { id: string; numeroLot: string; typeFromage: string } | null
  animal: { id: number; nom: string | null; identifiant: string | null } | null
  lot: { id: number; nom: string | null } | null
}
type LotFromage = {
  id: string
  numeroLot: string
  dateFabrication: string
  typeFromage: string
  volumeLaitUtiliseL: string
  nbPieces: number
  poidsTotalKg: string
  dluo: string | null
  statutBioSnapshot: string | null
  traitementThermique: string
  collectes: { id: string }[]
  ventesProduit: { id: number }[]
}

function todayIso(): string {
  return todayLocalISO()
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split("T")[0]
}

export function LaitSubTab() {
  return (
    <Tabs defaultValue="collecte" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-y-1">
        <TabsTrigger value="collecte" className="flex items-center gap-1.5">
          <Milk className="h-4 w-4" />
          Collecte
        </TabsTrigger>
        <TabsTrigger value="fabrications" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Fabrications
        </TabsTrigger>
        <TabsTrigger value="lactation" className="flex items-center gap-1.5">
          <LineChart className="h-4 w-4" />
          Lactation
        </TabsTrigger>
        <TabsTrigger value="qualite" className="flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4" />
          Qualité
        </TabsTrigger>
        <TabsTrigger value="palmares" className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4" />
          Palmarès
        </TabsTrigger>
        <TabsTrigger value="livraisons" className="flex items-center gap-1.5">
          <Truck className="h-4 w-4" />
          Livraisons
        </TabsTrigger>
        <TabsTrigger value="cave" className="flex items-center gap-1.5">
          <Warehouse className="h-4 w-4" />
          Cave
        </TabsTrigger>
      </TabsList>

      <TabsContent value="collecte">
        <CollecteView />
      </TabsContent>
      <TabsContent value="fabrications">
        <FabricationsView />
      </TabsContent>
      <TabsContent value="lactation">
        <LactationView />
      </TabsContent>
      <TabsContent value="qualite">
        <QualiteView />
      </TabsContent>
      <TabsContent value="palmares">
        <PalmaresView />
      </TabsContent>
      <TabsContent value="livraisons">
        <LivraisonLaitSubTab />
      </TabsContent>
      <TabsContent value="cave">
        <AffinageSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Vue Palmarès — classement des chèvres par lactation (PROMPT 21)
// ============================================================

type LactationSynthese = {
  rang: number | null
  debut: string
  fin: string | null
  enCours: boolean
  jours: number
  laitTotal: number
  lait305: number
  nbTraites: number
  moyenneJour: number
  pic: number
  tbMoyen: number | null
  tpMoyen: number | null
  cellulesMoy: number | null
}
type LignePalmares = {
  animalId: number
  nom: string | null
  identifiant: string | null
  espece: string | null
  nbLactations: number
  lactation: LactationSynthese
}
type StatsPalmares = {
  annee: number
  nbChevres: number
  lait305Moyen: number | null
  moyenneJourTroupeau: number | null
  meilleure: { nom: string | null; lait305: number } | null
}

type TriPalmares = "lait305" | "moyenneJour" | "pic" | "tbMoyen" | "tpMoyen"

function PalmaresView() {
  const [lignes, setLignes] = React.useState<LignePalmares[]>([])
  const [stats, setStats] = React.useState<StatsPalmares | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(new Date().getFullYear())
  const [tri, setTri] = React.useState<TriPalmares>("lait305")

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/elevage/palmares-lait?annee=${annee}`)
      .then((r) => r.json())
      .then((j) => {
        setLignes(j.data || [])
        setStats(j.stats || null)
      })
      .finally(() => setLoading(false))
  }, [annee])

  const triees = React.useMemo(() => {
    const val = (l: LignePalmares): number => {
      const v = l.lactation[tri]
      return typeof v === "number" ? v : -1
    }
    return [...lignes].sort((a, b) => val(b) - val(a))
  }, [lignes, tri])

  const moyenne305 = stats?.lait305Moyen ?? null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Palmarès des chèvres
            </CardTitle>
            <CardDescription>
              Classement par lactation (lait 305 j standardisé, pic, TB/TP) pour piloter réforme et renouvellement.
              La lactation de référence est celle de l'année sélectionnée.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && stats.nbChevres > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Chèvres suivies</div>
              <div className="text-xl font-semibold">{stats.nbChevres}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Lait 305 j moyen</div>
              <div className="text-xl font-semibold">{stats.lait305Moyen ?? "—"} <span className="text-sm text-slate-400">L</span></div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Moyenne troupeau</div>
              <div className="text-xl font-semibold">{stats.moyenneJourTroupeau ?? "—"} <span className="text-sm text-slate-400">L/j</span></div>
            </div>
            <div className="rounded-lg border p-3 bg-amber-50 border-amber-200">
              <div className="text-xs text-slate-500">Meilleure</div>
              <div className="text-base font-semibold truncate" title={stats.meilleure?.nom ?? ""}>
                {stats.meilleure?.nom ?? "—"}
              </div>
              <div className="text-xs text-amber-700">{stats.meilleure?.lait305 ?? 0} L / 305 j</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>Trier par :</span>
          {([
            ["lait305", "Lait 305 j"],
            ["moyenneJour", "Moyenne/j"],
            ["pic", "Pic"],
            ["tbMoyen", "TB"],
            ["tpMoyen", "TP"],
          ] as [TriPalmares, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTri(k)}
              className={`px-2 py-1 rounded border ${tri === k ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : triees.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">
            Aucune lactation exploitable pour {annee}. Enregistrez les mises-bas (onglet Reproduction) et les collectes
            de lait par animal pour bâtir le palmarès.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-2 text-left w-8">#</th>
                  <th className="p-2 text-left">Chèvre</th>
                  <th className="p-2 text-center">Lact.</th>
                  <th className="p-2 text-right">Lait 305 j</th>
                  <th className="p-2 text-right">Moyenne/j</th>
                  <th className="p-2 text-right">Pic</th>
                  <th className="p-2 text-right">TB / TP</th>
                  <th className="p-2 text-right">Cellules</th>
                  <th className="p-2 text-center">DIM</th>
                </tr>
              </thead>
              <tbody>
                {triees.map((l, i) => {
                  const sousMoyenne = moyenne305 != null && l.lactation.lait305 < moyenne305 * 0.7
                  return (
                    <tr key={l.animalId} className="border-b hover:bg-slate-50">
                      <td className="p-2 text-slate-400">{i + 1}</td>
                      <td className="p-2 font-medium">
                        {l.nom || l.identifiant || `#${l.animalId}`}
                        {sousMoyenne && (
                          <Badge variant="outline" className="ml-2 text-[10px] bg-red-50 text-red-700 border-red-200">
                            sous la moyenne
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-center text-slate-500">
                        {l.lactation.rang ?? "?"}
                        {l.nbLactations > 1 ? `/${l.nbLactations}` : ""}
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {l.lactation.lait305} L
                        {l.lactation.enCours && (
                          <span className="text-[10px] text-blue-600 ml-1" title="Lactation en cours">▸</span>
                        )}
                      </td>
                      <td className="p-2 text-right">{l.lactation.moyenneJour} L</td>
                      <td className="p-2 text-right text-slate-600">{l.lactation.pic} L</td>
                      <td className="p-2 text-right text-slate-600">
                        {l.lactation.tbMoyen ?? "—"} / {l.lactation.tpMoyen ?? "—"}
                      </td>
                      <td className="p-2 text-right text-slate-600">
                        {l.lactation.cellulesMoy != null ? fmtCellules(l.lactation.cellulesMoy) : "—"}
                      </td>
                      <td className="p-2 text-center text-slate-500">
                        {l.lactation.enCours ? `${l.lactation.jours} j` : `${l.lactation.jours} j`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">
              ▸ = lactation en cours (le lait 305 j n'est pas encore complet). TB/TP en g/L. « Lact. » = rang de lactation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Vue Qualité — cellules & mammites (PROMPT 20)
// ============================================================

type LigneQualite = {
  type: "animal" | "lot"
  id: number
  nom: string | null
  identifiant: string | null
  espece: string | null
  categorie: string
  seuils: { surveillance: number; alerte: number }
  derniere: { date: string; cellules: number | null; mg: number | null; mp: number | null } | null
  moyenneCellules: number | null
  moyenneMg: number | null
  moyenneMp: number | null
  nbMesures: number
  tendance: "hausse" | "baisse" | "stable" | null
  statut: "ok" | "surveillance" | "alerte"
}
type TroupeauQualite = {
  fenetreJours: number
  nbSuivis: number
  nbAvecMesure: number
  nbSansMesure: number
  cellulesMoyennes: number | null
  tbMoyen: number | null
  tpMoyen: number | null
  nbAlerte: number
  nbSurveillance: number
}

const STATUT_BADGE: Record<string, string> = {
  alerte: "bg-red-100 text-red-800 border-red-200",
  surveillance: "bg-amber-100 text-amber-800 border-amber-200",
  ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
}
const STATUT_LABEL: Record<string, string> = {
  alerte: "Alerte mammite",
  surveillance: "À surveiller",
  ok: "Correct",
}

/** Numération en ×10³/mL → libellé lisible (ex. 1 250 → « 1,25 M/mL »). */
function fmtCellules(v: number | null | undefined): string {
  if (v == null) return "—"
  if (v >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M/mL`
  return `${v.toLocaleString("fr-FR")} k/mL`
}

function TendanceIcon({ t }: { t: LigneQualite["tendance"] }) {
  if (t === "hausse") return <TrendingUp className="h-4 w-4 text-red-600" aria-label="En hausse" />
  if (t === "baisse") return <TrendingDown className="h-4 w-4 text-emerald-600" aria-label="En baisse" />
  if (t === "stable") return <Minus className="h-4 w-4 text-slate-400" aria-label="Stable" />
  return <span className="text-slate-300">—</span>
}

function QualiteView() {
  const [lignes, setLignes] = React.useState<LigneQualite[]>([])
  const [troupeau, setTroupeau] = React.useState<TroupeauQualite | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [fenetre, setFenetre] = React.useState(180)
  const [masquerSansMesure, setMasquerSansMesure] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/elevage/qualite-lait?fenetre=${fenetre}`)
      .then((r) => r.json())
      .then((j) => {
        setLignes(j.data || [])
        setTroupeau(j.troupeau || null)
      })
      .finally(() => setLoading(false))
  }, [fenetre])

  const visibles = masquerSansMesure ? lignes.filter((l) => l.nbMesures > 0) : lignes

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Cellules & qualité du lait
            </CardTitle>
            <CardDescription>
              Détection des mammites subcliniques à partir des analyses saisies (numération cellulaire, TB, TP).
              Seuils adaptés à la filière — la chèvre a une numération de base naturellement plus haute que la vache.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <select
              className="h-9 rounded-md border border-slate-300 px-2 bg-white text-sm"
              value={fenetre}
              onChange={(e) => setFenetre(parseInt(e.target.value, 10))}
            >
              <option value={90}>90 jours</option>
              <option value={180}>180 jours</option>
              <option value={365}>1 an</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Synthèse troupeau */}
        {troupeau && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">Cellules moyennes</div>
              <div className="text-xl font-semibold">{fmtCellules(troupeau.cellulesMoyennes)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-slate-500">TB / TP moyens</div>
              <div className="text-xl font-semibold">
                {troupeau.tbMoyen ?? "—"} <span className="text-sm text-slate-400">/</span> {troupeau.tpMoyen ?? "—"}
                <span className="text-xs text-slate-400 ml-1">g/L</span>
              </div>
            </div>
            <div className={`rounded-lg border p-3 ${troupeau.nbAlerte > 0 ? "border-red-200 bg-red-50" : ""}`}>
              <div className="text-xs text-slate-500">En alerte</div>
              <div className={`text-xl font-semibold ${troupeau.nbAlerte > 0 ? "text-red-700" : ""}`}>
                {troupeau.nbAlerte}
              </div>
            </div>
            <div className={`rounded-lg border p-3 ${troupeau.nbSurveillance > 0 ? "border-amber-200 bg-amber-50" : ""}`}>
              <div className="text-xs text-slate-500">À surveiller</div>
              <div className={`text-xl font-semibold ${troupeau.nbSurveillance > 0 ? "text-amber-700" : ""}`}>
                {troupeau.nbSurveillance}
              </div>
            </div>
          </div>
        )}

        {troupeau && troupeau.nbSansMesure > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={masquerSansMesure}
              onChange={(e) => setMasquerSansMesure(e.target.checked)}
            />
            Masquer les {troupeau.nbSansMesure} animaux sans analyse sur la période
          </label>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : visibles.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">
            Aucune analyse de lait saisie sur la période. Renseignez la numération cellulaire (et TB/TP) lors de la
            saisie des collectes pour activer la détection des mammites.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-2 text-left">Animal / Lot</th>
                  <th className="p-2 text-left">Statut</th>
                  <th className="p-2 text-right">Dernière numération</th>
                  <th className="p-2 text-center">Tendance</th>
                  <th className="p-2 text-right">Moyenne</th>
                  <th className="p-2 text-right">TB / TP</th>
                  <th className="p-2 text-center">Mesures</th>
                  <th className="p-2 text-right">Le</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => (
                  <tr key={`${l.type}-${l.id}`} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">
                      {l.nom || l.identifiant || `${l.type === "lot" ? "Lot" : "#"}${l.id}`}
                      {l.type === "lot" && <Badge variant="outline" className="ml-2 text-[10px]">Lot</Badge>}
                    </td>
                    <td className="p-2">
                      {l.nbMesures > 0 ? (
                        <Badge variant="outline" className={STATUT_BADGE[l.statut]}>
                          {STATUT_LABEL[l.statut]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">pas d'analyse</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {fmtCellules(l.derniere?.cellules)}
                    </td>
                    <td className="p-2 text-center">
                      <div className="inline-flex justify-center">
                        <TendanceIcon t={l.tendance} />
                      </div>
                    </td>
                    <td className="p-2 text-right text-slate-600">{fmtCellules(l.moyenneCellules)}</td>
                    <td className="p-2 text-right text-slate-600">
                      {l.derniere?.mg ?? l.moyenneMg ?? "—"} / {l.derniere?.mp ?? l.moyenneMp ?? "—"}
                    </td>
                    <td className="p-2 text-center text-slate-500">{l.nbMesures}</td>
                    <td className="p-2 text-right text-xs text-slate-500">
                      {l.derniere ? new Date(l.derniere.date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">
              Seuils indicatifs de conduite de troupeau (mammites subcliniques), pas des seuils réglementaires de paie du lait.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Vue Collecte — calendrier biquotidien
// ============================================================

function CollecteView() {
  const { toast } = useToast()
  const [animaux, setAnimaux] = React.useState<Animal[]>([])
  const [lots, setLots] = React.useState<Lot[]>([])
  const [collectes, setCollectes] = React.useState<Collecte[]>([])
  const [endDate, setEndDate] = React.useState(todayIso())
  const [loading, setLoading] = React.useState(true)
  const [savingKey, setSavingKey] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<"animal" | "lot">("animal")
  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  const days = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysIso(endDate, -i)).reverse()
  }, [endDate])

  const reload = React.useCallback(() => {
    setLoading(true)
    const from = addDaysIso(endDate, -6)
    const to = endDate
    Promise.all([
      fetch("/api/elevage/animaux?statut=actif").then((r) => r.json()),
      fetch("/api/elevage/lots?statut=actif").then((r) => r.json()),
      fetch(`/api/elevage/collectes-lait?from=${from}&to=${to}`).then((r) => r.json()),
    ])
      .then(([a, l, c]) => {
        const aList: Animal[] = (a.data || []).filter((x: Animal) =>
          (x.especeAnimale?.production || "").toLowerCase().includes("lait") ||
          (x.especeAnimale?.production || "").toLowerCase().includes("mixte")
        )
        const lList: Lot[] = (l.data || []).filter((x: Lot) =>
          (x.especeAnimale?.production || "").toLowerCase().includes("lait") ||
          (x.especeAnimale?.production || "").toLowerCase().includes("mixte")
        )
        setAnimaux(aList)
        setLots(lList)
        setCollectes(c.data || [])
        if (selectedId == null) {
          if (aList.length > 0) {
            setSelectedId(aList[0].id)
            setTarget("animal")
          } else if (lList.length > 0) {
            setSelectedId(lList[0].id)
            setTarget("lot")
          }
        }
      })
      .finally(() => setLoading(false))
  }, [endDate, selectedId])

  React.useEffect(() => {
    reload()
  }, [reload])

  const findCollecte = (day: string, traite: "Matin" | "Soir"): Collecte | undefined => {
    return collectes.find((c) => {
      const cDay = c.date.split("T")[0]
      if (cDay !== day || c.traite !== traite) return false
      if (target === "animal") return c.animalId === selectedId
      return c.lotId === selectedId
    })
  }

  const saveCollecte = async (day: string, traite: "Matin" | "Soir", quantite: number) => {
    if (selectedId == null) return
    const key = `${day}-${traite}`
    setSavingKey(key)
    try {
      const res = await fetch("/api/elevage/collectes-lait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: day,
          traite,
          animalId: target === "animal" ? selectedId : null,
          lotId: target === "lot" ? selectedId : null,
          quantiteLitres: quantite,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: json.error || "Échec de la saisie" })
      } else {
        reload()
      }
    } finally {
      setSavingKey(null)
    }
  }

  const idemHier = async (day: string, traite: "Matin" | "Soir") => {
    const prev = findCollecte(addDaysIso(day, -1), traite)
    if (!prev) return
    await saveCollecte(day, traite, Number(prev.quantiteLitres))
  }

  const totalMatin = collectes
    .filter((c) => c.traite === "Matin" && ((target === "animal" && c.animalId === selectedId) || (target === "lot" && c.lotId === selectedId)))
    .reduce((s, c) => s + Number(c.quantiteLitres), 0)
  const totalSoir = collectes
    .filter((c) => c.traite === "Soir" && ((target === "animal" && c.animalId === selectedId) || (target === "lot" && c.lotId === selectedId)))
    .reduce((s, c) => s + Number(c.quantiteLitres), 0)

  const selectedAnimal = animaux.find((a) => a.id === selectedId)
  const selectedLot = lots.find((l) => l.id === selectedId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Milk className="h-5 w-5 text-blue-600" />
          Calendrier de collecte
        </CardTitle>
        <CardDescription>
          Saisie biquotidienne (Matin / Soir) sur 7 jours glissants. Cliquez sur une case pour saisir le volume, "Idem hier" recopie la valeur de la veille.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélecteur cible + période */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Cible</Label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={target === "animal" ? "default" : "outline"}
                onClick={() => {
                  setTarget("animal")
                  setSelectedId(animaux[0]?.id ?? null)
                }}
                disabled={animaux.length === 0}
              >
                Animal
              </Button>
              <Button
                size="sm"
                variant={target === "lot" ? "default" : "outline"}
                onClick={() => {
                  setTarget("lot")
                  setSelectedId(lots[0]?.id ?? null)
                }}
                disabled={lots.length === 0}
              >
                Lot
              </Button>
            </div>
          </div>
          <div className="min-w-[200px]">
            <Label className="text-xs">{target === "animal" ? "Animal laitier" : "Lot laitier"}</Label>
            <select
              className="block h-9 w-full rounded-md border border-slate-300 px-2 bg-white"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(parseInt(e.target.value, 10) || null)}
            >
              {(target === "animal" ? animaux : lots).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nom || (target === "animal" ? (x as Animal).identifiant : `Lot #${x.id}`) || "—"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Fin de période</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rafraîchir"}
          </Button>
        </div>

        {animaux.length === 0 && lots.length === 0 && (
          <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">
            Aucun animal ou lot avec production "lait" ou "mixte" n'est encore enregistré.
            Configurez la production sur l'espèce dans l'onglet Espèces.
          </div>
        )}

        {/* Grille jours × traites */}
        {selectedId != null && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Jour</th>
                  {days.map((d) => (
                    <th key={d} className="p-2 text-center">
                      {new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </th>
                  ))}
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(["Matin", "Soir"] as const).map((traite) => {
                  const total = days.reduce((s, d) => s + Number(findCollecte(d, traite)?.quantiteLitres ?? 0), 0)
                  return (
                    <tr key={traite} className="border-b">
                      <td className="p-2 font-medium">{traite}</td>
                      {days.map((d) => {
                        const c = findCollecte(d, traite)
                        const key = `${d}-${traite}`
                        return (
                          <td key={d} className="p-1 text-center">
                            <CellSaisie
                              value={c ? Number(c.quantiteLitres) : null}
                              saving={savingKey === key}
                              ecarte={c?.ecarteAttente}
                              affecte={c?.lotFromage != null}
                              onSave={(v) => saveCollecte(d, traite, v)}
                              onIdemHier={() => idemHier(d, traite)}
                            />
                          </td>
                        )
                      })}
                      <td className="p-2 text-right font-semibold">{total.toFixed(2)} L</td>
                    </tr>
                  )
                })}
                <tr className="bg-slate-50">
                  <td className="p-2 font-semibold">Total / jour</td>
                  {days.map((d) => {
                    const total = (["Matin", "Soir"] as const).reduce(
                      (s, t) => s + Number(findCollecte(d, t)?.quantiteLitres ?? 0),
                      0
                    )
                    return (
                      <td key={d} className="p-2 text-center font-semibold">
                        {total > 0 ? `${total.toFixed(2)} L` : "—"}
                      </td>
                    )
                  })}
                  <td className="p-2 text-right font-bold text-blue-700">
                    {(totalMatin + totalSoir).toFixed(2)} L
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Légende */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm" />
            Lait écarté (temps d'attente vétérinaire)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-sm" />
            Affecté à un lot fromage
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function CellSaisie(props: {
  value: number | null
  saving: boolean
  ecarte?: boolean
  affecte?: boolean
  onSave: (v: number) => void
  onIdemHier: () => void
}) {
  const [v, setV] = React.useState<string>(props.value != null ? String(props.value) : "")
  React.useEffect(() => {
    setV(props.value != null ? String(props.value) : "")
  }, [props.value])
  const bg = props.ecarte ? "bg-amber-50" : props.affecte ? "bg-emerald-50" : ""
  return (
    <div className={`relative inline-flex flex-col items-center gap-0.5 p-1 rounded ${bg}`}>
      <input
        type="number"
        step="0.1"
        min="0"
        max="100"
        value={v}
        disabled={props.saving}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = parseFloat(v)
          if (!isNaN(n) && n !== props.value) props.onSave(n)
        }}
        className="w-16 h-7 text-xs text-center rounded border border-slate-200"
        placeholder="—"
      />
      {props.value == null && (
        <button
          type="button"
          onClick={props.onIdemHier}
          title="Recopier la valeur d'hier"
          className="text-[10px] text-slate-500 hover:text-slate-700"
        >
          <Copy className="inline h-2.5 w-2.5" /> hier
        </button>
      )}
    </div>
  )
}

// ============================================================
// Vue Fabrications
// ============================================================

function FabricationsView() {
  const { toast } = useToast()
  const [lots, setLots] = React.useState<LotFromage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [openCreate, setOpenCreate] = React.useState(false)
  const [year, setYear] = React.useState(new Date().getFullYear())

  const reload = React.useCallback(() => {
    setLoading(true)
    fetch(`/api/elevage/lots-fromage?year=${year}`)
      .then((r) => r.json())
      .then(({ data }) => setLots(data || []))
      .finally(() => setLoading(false))
  }, [year])

  React.useEffect(() => {
    reload()
  }, [reload])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Fabrications de fromage
            </CardTitle>
            <CardDescription>
              Numérotation auto L-AAAA-Www-NN. La création affecte les collectes sélectionnées au lot et préserve la traçabilité animal → lot → vente.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <select
              className="h-9 rounded-md border border-slate-300 px-2 bg-white"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              {[0, -1, -2].map((d) => (
                <option key={d} value={new Date().getFullYear() + d}>
                  {new Date().getFullYear() + d}
                </option>
              ))}
            </select>
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau lot
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : lots.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Aucune fabrication enregistrée pour {year}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-2 text-left">N° Lot</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-right">Volume</th>
                  <th className="p-2 text-right">Pièces</th>
                  <th className="p-2 text-right">Poids total</th>
                  <th className="p-2 text-center">Traitement</th>
                  <th className="p-2 text-center">Bio</th>
                  <th className="p-2 text-center">DLUO</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-mono">{l.numeroLot}</td>
                    <td className="p-2">{new Date(l.dateFabrication).toLocaleDateString("fr-FR")}</td>
                    <td className="p-2">{l.typeFromage}</td>
                    <td className="p-2 text-right">{Number(l.volumeLaitUtiliseL).toFixed(1)} L</td>
                    <td className="p-2 text-right">{l.nbPieces}</td>
                    <td className="p-2 text-right">{Number(l.poidsTotalKg).toFixed(2)} kg</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className="text-xs">{l.traitementThermique}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      {l.statutBioSnapshot && (
                        <Badge className={l.statutBioSnapshot === "AB" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                          {l.statutBioSnapshot}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-center text-xs">{l.dluo ? new Date(l.dluo).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="p-2 text-right">
                      <a href={`/api/elevage/lots-fromage/${l.id}/etiquette`} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" title="Étiquette PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Supprimer"
                        onClick={async () => {
                          if (!(await confirmDialog(`Supprimer ${l.numeroLot} ?`))) return
                          const res = await fetch(`/api/elevage/lots-fromage?id=${l.id}`, { method: "DELETE" })
                          if (res.ok) reload()
                          else {
                            const j = await res.json()
                            toast({ variant: "destructive", title: "Refusé", description: j.error })
                          }
                        }}
                      >
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
      <DialogCreationLot open={openCreate} onOpenChange={setOpenCreate} onCreated={reload} />
    </Card>
  )
}

function DialogCreationLot(props: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [collectesDispo, setCollectesDispo] = React.useState<Collecte[]>([])
  const [selection, setSelection] = React.useState<Set<string>>(new Set())
  const [form, setForm] = React.useState({
    dateFabrication: todayIso(),
    typeFromage: "Tomme",
    nbPieces: 1,
    poidsTotalKg: 1,
    dluo: "",
    traitementThermique: "cru",
    statutBioSnapshot: "",
    allergenes: "",
    numeroAgrement: "",
    notes: "",
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!props.open) return
    const from = addDaysIso(todayIso(), -60)
    fetch(`/api/elevage/collectes-lait?from=${from}`)
      .then((r) => r.json())
      .then(({ data }) => {
        const dispo = (data || []).filter((c: Collecte) => !c.lotFromageId && !c.ecarteAttente)
        setCollectesDispo(dispo)
        setSelection(new Set())
      })
  }, [props.open])

  const volumeSelection = collectesDispo
    .filter((c) => selection.has(c.id))
    .reduce((s, c) => s + Number(c.quantiteLitres), 0)

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/elevage/lots-fromage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFabrication: form.dateFabrication,
          typeFromage: form.typeFromage,
          volumeLaitUtiliseL: volumeSelection,
          nbPieces: form.nbPieces,
          poidsTotalKg: form.poidsTotalKg,
          dluo: form.dluo || null,
          traitementThermique: form.traitementThermique,
          statutBioSnapshot: form.statutBioSnapshot || null,
          allergenes: form.allergenes || null,
          numeroAgrement: form.numeroAgrement || null,
          notes: form.notes || null,
          collecteIds: Array.from(selection),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: json.error || "Échec" })
      } else {
        toast({ title: "Lot créé", description: json.data.numeroLot })
        props.onOpenChange(false)
        props.onCreated()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle fabrication</DialogTitle>
          <DialogDescription>
            Sélectionnez les collectes à affecter au lot. Le volume utilisé sera la somme des collectes sélectionnées.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Date de fabrication</Label>
            <Input type="date" value={form.dateFabrication} onChange={(e) => setForm({ ...form, dateFabrication: e.target.value })} />
          </div>
          <div>
            <Label>Type de fromage</Label>
            <Input value={form.typeFromage} onChange={(e) => setForm({ ...form, typeFromage: e.target.value })} placeholder="Tomme, Crottin..." />
          </div>
          <div>
            <Label>Nombre de pièces</Label>
            <Input type="number" min="1" value={form.nbPieces} onChange={(e) => setForm({ ...form, nbPieces: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <Label>Poids total (kg)</Label>
            <Input type="number" step="0.01" min="0" value={form.poidsTotalKg} onChange={(e) => setForm({ ...form, poidsTotalKg: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>DLUO</Label>
            <Input type="date" value={form.dluo} onChange={(e) => setForm({ ...form, dluo: e.target.value })} />
          </div>
          <div>
            <Label>Traitement thermique</Label>
            <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.traitementThermique} onChange={(e) => setForm({ ...form, traitementThermique: e.target.value })}>
              <option value="cru">au lait cru</option>
              <option value="thermise">au lait thermisé</option>
              <option value="pasteurise">au lait pasteurisé</option>
            </select>
          </div>
          <div>
            <Label>Statut Bio</Label>
            <select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.statutBioSnapshot} onChange={(e) => setForm({ ...form, statutBioSnapshot: e.target.value })}>
              <option value="">— Non renseigné —</option>
              <option value="AB">AB</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
              <option value="C3">C3</option>
              <option value="Conventionnel">Conventionnel</option>
            </select>
          </div>
          <div>
            <Label>N° agrément sanitaire</Label>
            <Input value={form.numeroAgrement} onChange={(e) => setForm({ ...form, numeroAgrement: e.target.value })} placeholder="CE FR XX-XXX-XXX (optionnel)" />
          </div>
          <div className="md:col-span-2">
            <Label>Allergènes additionnels</Label>
            <Input value={form.allergenes} onChange={(e) => setForm({ ...form, allergenes: e.target.value })} placeholder="(le lait est déjà mentionné par défaut)" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label>Collectes disponibles ({collectesDispo.length})</Label>
            <span className="text-sm font-semibold text-blue-700">
              Volume sélection : {volumeSelection.toFixed(2)} L
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto border rounded">
            {collectesDispo.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                Aucune collecte disponible (toutes affectées, écartées ou hors période 60 j).
              </div>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {collectesDispo.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selection.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selection)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            setSelection(next)
                          }}
                        />
                      </td>
                      <td className="p-2">{new Date(c.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2">{c.traite}</td>
                      <td className="p-2">
                        {c.animal ? c.animal.nom || c.animal.identifiant : c.lot ? c.lot.nom || `Lot #${c.lot.id}` : "—"}
                      </td>
                      <td className="p-2 text-right font-semibold">{Number(c.quantiteLitres).toFixed(2)} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving || volumeSelection === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Créer le lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Vue Lactation
// ============================================================

function LactationView() {
  const [animaux, setAnimaux] = React.useState<Animal[]>([])
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [data, setData] = React.useState<{
    dim: number | null
    courbe: { dim: number; date: string; volume: number; moyenne7j: number }[]
    moyenne7j?: number
    lactationLongue?: boolean
    suggererTarissement?: boolean
  } | null>(null)
  const [savingLL, setSavingLL] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/elevage/animaux?statut=actif")
      .then((r) => r.json())
      .then(({ data }) => {
        const list = (data || []).filter((a: Animal) =>
          (a.especeAnimale?.production || "").toLowerCase().includes("lait") ||
          (a.especeAnimale?.production || "").toLowerCase().includes("mixte")
        )
        setAnimaux(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
  }, [])

  const reloadLactation = React.useCallback(() => {
    if (selectedId == null) return
    fetch(`/api/elevage/lactation?animalId=${selectedId}`)
      .then((r) => r.json())
      .then(setData)
  }, [selectedId])

  React.useEffect(() => {
    reloadLactation()
  }, [reloadLactation])

  const toggleLactationLongue = async () => {
    if (selectedId == null || data == null) return
    setSavingLL(true)
    try {
      await fetch(`/api/elevage/animaux/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lactationLongue: !data.lactationLongue }),
      })
      reloadLactation()
    } finally {
      setSavingLL(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-purple-600" />
          Courbe de lactation 305 j
        </CardTitle>
        <CardDescription>
          DIM = jours depuis la dernière mise-bas. Suggestion de tarissement à DIM &gt; 270 ou production moyenne &lt; 0,5 L/j sur 7 j.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Animal laitier</Label>
          <select
            className="block h-9 w-full max-w-sm rounded-md border border-slate-300 px-2 bg-white"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(parseInt(e.target.value, 10) || null)}
          >
            {animaux.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom || a.identifiant || `#${a.id}`}
              </option>
            ))}
          </select>
        </div>

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline">DIM : {data.dim ?? "—"} j</Badge>
              <Badge variant="outline">Moyenne 7 j : {data.moyenne7j ?? 0} L/j</Badge>
              {data.suggererTarissement && (
                <Badge className="bg-amber-100 text-amber-800">⚠ Tarissement à envisager</Badge>
              )}
              {data.lactationLongue && (
                <Badge className="bg-violet-100 text-violet-800">Lactation longue</Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLactationLongue}
                disabled={savingLL}
                className="ml-auto text-xs"
              >
                {savingLL ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : data.lactationLongue ? (
                  "Repasser en lactation normale"
                ) : (
                  "Marquer en lactation longue"
                )}
              </Button>
            </div>
            <SparkLactation points={data.courbe} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SparkLactation(props: { points: { dim: number; volume: number; moyenne7j: number }[] }) {
  if (!props.points || props.points.length === 0) {
    return <div className="text-sm text-slate-500">Pas encore de données de collecte pour cet animal.</div>
  }
  const w = 720
  const h = 200
  const padX = 40
  const padY = 20
  const xs = props.points
  const maxV = Math.max(...xs.map((p) => p.volume), ...xs.map((p) => p.moyenne7j), 1)
  const x = (dim: number) => padX + ((dim / 305) * (w - 2 * padX))
  const y = (v: number) => h - padY - ((v / maxV) * (h - 2 * padY))

  const polyVol = xs.map((p) => `${x(p.dim)},${y(p.volume)}`).join(" ")
  const polyAvg = xs.map((p) => `${x(p.dim)},${y(p.moyenne7j)}`).join(" ")

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxWidth: w }}>
        {/* Grille horizontale */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <line key={r} x1={padX} y1={padY + r * (h - 2 * padY)} x2={w - padX} y2={padY + r * (h - 2 * padY)} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {/* Repère 100, 200, 305 DIM */}
        {[0, 100, 200, 305].map((d) => (
          <g key={d}>
            <line x1={x(d)} y1={padY} x2={x(d)} y2={h - padY} stroke="#e2e8f0" strokeWidth="0.5" />
            <text x={x(d)} y={h - 4} fontSize="9" textAnchor="middle" fill="#64748b">{d}j</text>
          </g>
        ))}
        {/* Polyline volume jour */}
        <polyline points={polyVol} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
        {/* Moyenne 7j */}
        <polyline points={polyAvg} fill="none" stroke="#7c3aed" strokeWidth="2" />
        {/* Axe Y */}
        <text x={4} y={padY + 4} fontSize="9" fill="#64748b">{maxV.toFixed(1)} L</text>
        <text x={4} y={h - padY} fontSize="9" fill="#64748b">0</text>
      </svg>
      <div className="text-xs text-slate-500 mt-1">
        Volume journalier (gris) — Moyenne mobile 7 j (violet)
      </div>
    </div>
  )
}
