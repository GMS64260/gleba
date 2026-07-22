"use client"

/**
 * Calculateur de ration caprine — PROMPT 25.
 *
 * Besoins UFL/PDI d'une chèvre (poids, lait, TB, gestation) vs apports d'une
 * ration composée des aliments de l'exploitation (valeurs INRA saisies sur
 * l'aliment). Affiche la couverture, le facteur limitant PDIN/PDIE et le coût.
 */

import * as React from "react"
import { Scale, Info, Save, FolderOpen, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { besoinsChevre, bilanRation, type StadeGestation, type LigneRation } from "@/lib/elevage/ration"

type Aliment = {
  id: string
  nom: string
  ufl: number | null
  pdin: number | null
  pdie: number | null
  uel: number | null
  prix: number | null
}

type LotOption = { id: number; nom: string | null; especeAnimale?: { nom?: string } }
type CompositionLigne = { alimentId: string; quantiteKg: number }
type RationEnregistree = {
  id: string
  nom: string
  lotId: number | null
  stade: string
  poidsVif: number
  litresLait: number
  tauxButyreux: number
  stadeGestation: string
  composition: CompositionLigne[]
}

const STADES = [
  { v: "lactation", l: "Lactation" },
  { v: "tarissement", l: "Tarissement" },
  { v: "gestation", l: "Gestation" },
  { v: "croissance", l: "Croissance" },
  { v: "entretien", l: "Entretien" },
]

export function RationSubTab() {
  const [aliments, setAliments] = React.useState<Aliment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [poids, setPoids] = React.useState(60)
  const [lait, setLait] = React.useState(3)
  const [tb, setTb] = React.useState(35)
  const [gestation, setGestation] = React.useState<StadeGestation>("aucune")
  const [quantites, setQuantites] = React.useState<Record<string, number>>({})
  const { toast } = useToast()
  // Persistance : plans enregistrés + cible/label du plan courant
  const [lots, setLots] = React.useState<LotOption[]>([])
  const [rations, setRations] = React.useState<RationEnregistree[]>([])
  const [nom, setNom] = React.useState("")
  const [lotId, setLotId] = React.useState("")
  const [stade, setStade] = React.useState("lactation")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const reloadRations = React.useCallback(() => {
    fetch("/api/elevage/rations")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setRations(j.data) })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    Promise.all([
      fetch("/api/elevage/aliments").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/elevage/lots?statut=actif").then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([a, l]) => { setAliments(a.data || []); setLots(l.data || []) })
      .finally(() => setLoading(false))
    reloadRations()
  }, [reloadRations])

  const chargerRation = (r: RationEnregistree) => {
    setEditingId(r.id)
    setNom(r.nom)
    setLotId(r.lotId ? String(r.lotId) : "")
    setStade(r.stade || "lactation")
    setPoids(r.poidsVif)
    setLait(r.litresLait)
    setTb(r.tauxButyreux)
    setGestation((r.stadeGestation as StadeGestation) || "aucune")
    const q: Record<string, number> = {}
    for (const c of r.composition || []) q[c.alimentId] = c.quantiteKg
    setQuantites(q)
    toast({ title: "Ration chargée", description: r.nom })
  }

  const enregistrerRation = async () => {
    if (!nom.trim()) { toast({ variant: "destructive", title: "Nom requis", description: "Donnez un nom au plan (ex. « Laitières en production »)." }); return }
    setSaving(true)
    const composition: CompositionLigne[] = aliments
      .filter((a) => (quantites[a.id] || 0) > 0)
      .map((a) => ({ alimentId: a.id, quantiteKg: quantites[a.id] }))
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      nom: nom.trim(),
      lotId: lotId ? parseInt(lotId, 10) : null,
      stade,
      poidsVif: poids,
      litresLait: lait,
      tauxButyreux: tb,
      stadeGestation: gestation,
      composition,
    }
    try {
      const res = await fetch("/api/elevage/rations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) { toast({ variant: "destructive", title: "Erreur", description: j.error || "Échec" }); return }
      setEditingId(j.data?.id ?? editingId)
      toast({ title: editingId ? "Ration mise à jour" : "Ration enregistrée", description: nom.trim() })
      reloadRations()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Enregistrement impossible" })
    } finally {
      setSaving(false)
    }
  }

  const supprimerRation = async (r: RationEnregistree) => {
    const res = await fetch(`/api/elevage/rations?id=${r.id}`, { method: "DELETE" })
    if (res.ok) {
      if (editingId === r.id) setEditingId(null)
      toast({ title: "Ration supprimée" })
      reloadRations()
    } else {
      toast({ variant: "destructive", title: "Erreur", description: "Suppression impossible" })
    }
  }

  const nouvelleRation = () => {
    setEditingId(null); setNom(""); setLotId(""); setStade("lactation"); setQuantites({})
  }

  const besoins = React.useMemo(
    () => besoinsChevre({ poidsVif: poids, litresLait: lait, tauxButyreux: tb, stadeGestation: gestation }),
    [poids, lait, tb, gestation]
  )

  const lignes: LigneRation[] = React.useMemo(
    () =>
      aliments
        .filter((a) => (quantites[a.id] || 0) > 0)
        .map((a) => ({ ufl: a.ufl, pdin: a.pdin, pdie: a.pdie, uel: a.uel, prix: a.prix, quantiteKg: quantites[a.id] })),
    [aliments, quantites]
  )
  const bilan = React.useMemo(() => bilanRation(lignes, besoins), [lignes, besoins])

  const alimentsRenseignes = aliments.filter((a) => a.ufl != null || a.pdin != null)

  const couvClass = (v: number | null) =>
    v == null ? "" : v >= 95 && v <= 115 ? "text-emerald-700" : v < 95 ? "text-red-700" : "text-amber-700"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-emerald-600" />
          Calculateur de ration
        </CardTitle>
        <CardDescription>
          Besoins UFL/PDI d'une chèvre selon son stade, comparés aux apports de la ration composée à partir de vos
          aliments. Renseignez les valeurs INRA (UFL, PDIN, PDIE) sur chaque aliment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Plans de ration enregistrés */}
        {rations.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Plans enregistrés
            </div>
            <div className="flex flex-wrap gap-2">
              {rations.map((r) => {
                const lotNom = r.lotId ? (lots.find((l) => l.id === r.lotId)?.nom || `Lot #${r.lotId}`) : null
                const stadeLabel = STADES.find((s) => s.v === r.stade)?.l || r.stade
                return (
                  <div
                    key={r.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border pl-3 pr-1.5 py-1 text-xs ${
                      editingId === r.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                    }`}
                  >
                    <button className="font-medium text-slate-700 hover:text-emerald-700" onClick={() => chargerRation(r)} title="Charger ce plan">
                      {r.nom}
                    </button>
                    <span className="text-slate-400">{stadeLabel}{lotNom ? ` · ${lotNom}` : ""}</span>
                    <button onClick={() => supprimerRation(r)} className="text-slate-400 hover:text-red-600" title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Profil animal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Poids vif (kg)</Label>
            <Input type="number" min="10" value={poids} onChange={(e) => setPoids(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Lait (L/j)</Label>
            <Input type="number" min="0" step="0.1" value={lait} onChange={(e) => setLait(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">TB (g/L)</Label>
            <Input type="number" min="20" step="0.5" value={tb} onChange={(e) => setTb(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Gestation</Label>
            <select
              className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white text-sm"
              value={gestation}
              onChange={(e) => setGestation(e.target.value as StadeGestation)}
            >
              <option value="aucune">Aucune</option>
              <option value="gestation_moyenne">Moyenne (~4e mois)</option>
              <option value="gestation_finale">Finale (dernier mois)</option>
            </select>
          </div>
        </div>

        {/* Besoins */}
        <div className="rounded-lg border p-3 bg-slate-50">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Besoins journaliers</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span><b>{besoins.ufl}</b> UFL</span>
            <span><b>{besoins.pdi}</b> g PDI</span>
            <span className="text-slate-400">
              (entretien {besoins.detail.entretien.ufl} UFL · lait {besoins.detail.lait.ufl} UFL
              {besoins.detail.gestation.ufl > 0 ? ` · gestation ${besoins.detail.gestation.ufl} UFL` : ""})
            </span>
          </div>
        </div>

        {/* Composition de la ration */}
        {loading ? (
          <div className="text-sm text-slate-500">Chargement des aliments…</div>
        ) : alimentsRenseignes.length === 0 ? (
          <div className="text-sm text-slate-500 bg-amber-50 border border-amber-200 p-3 rounded flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            Aucun aliment ne porte de valeurs INRA (UFL/PDI). Ajoutez-les sur vos aliments (onglet Stocks → Ajouter) pour
            composer une ration.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-2 text-left">Aliment</th>
                  <th className="p-2 text-right">UFL/kg</th>
                  <th className="p-2 text-right">PDIN/PDIE</th>
                  <th className="p-2 text-right">€/kg</th>
                  <th className="p-2 text-right w-28">Quantité (kg)</th>
                </tr>
              </thead>
              <tbody>
                {alimentsRenseignes.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">{a.nom}</td>
                    <td className="p-2 text-right text-slate-600">{a.ufl ?? "—"}</td>
                    <td className="p-2 text-right text-slate-600">{a.pdin ?? "—"} / {a.pdie ?? "—"}</td>
                    <td className="p-2 text-right text-slate-600">{a.prix != null ? a.prix.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={quantites[a.id] ?? ""}
                        onChange={(e) =>
                          setQuantites((q) => ({ ...q, [a.id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-24 h-8 text-right ml-auto"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bilan */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-slate-500">Apport UFL</div>
            <div className="text-lg font-semibold">{bilan.ufl}</div>
            <div className={`text-xs font-medium ${couvClass(bilan.couvertureUFL)}`}>
              {bilan.couvertureUFL != null ? `${bilan.couvertureUFL} % des besoins` : "—"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-slate-500">Apport PDI</div>
            <div className="text-lg font-semibold">{bilan.pdi} g</div>
            <div className={`text-xs font-medium ${couvClass(bilan.couverturePDI)}`}>
              {bilan.couverturePDI != null ? `${bilan.couverturePDI} % des besoins` : "—"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-slate-500">Équilibre PDIN/PDIE</div>
            <div className="text-lg font-semibold">{bilan.pdin} / {bilan.pdie}</div>
            <div className="text-xs text-slate-400">
              {bilan.equilibrePDIN_PDIE === "équilibré" ? "équilibré" : `limité par ${bilan.equilibrePDIN_PDIE}`}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-slate-500">Coût ration / jour</div>
            <div className="text-lg font-semibold">{bilan.cout.toFixed(2)} €</div>
            <div className="text-xs text-slate-400">{bilan.uel > 0 ? `${bilan.uel} UEL` : ""}</div>
          </div>
        </div>

        {/* Enregistrer le plan */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> {editingId ? "Mettre à jour le plan" : "Enregistrer ce plan"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input placeholder="Nom (ex. Laitières en prod.)" value={nom} onChange={(e) => setNom(e.target.value)} className="sm:col-span-2" />
            <select className="h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">Sans lot</option>
              {lots.map((l) => <option key={l.id} value={l.id}>{l.nom || `Lot #${l.id}`}</option>)}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-2 bg-white text-sm" value={stade} onChange={(e) => setStade(e.target.value)}>
              {STADES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            {editingId && (
              <Button variant="outline" size="sm" onClick={nouvelleRation}>Nouveau</Button>
            )}
            <Button size="sm" onClick={enregistrerRation} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />{editingId ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Repères INRA caprin indicatifs (entretien 0,033 UFL/kg PV<sup>0,75</sup>, lait 0,44 UFL + 48 g PDI/L à 35 g TB).
          L'apport PDI d'une ration = min(PDIN, PDIE). À ajuster au troupeau et à la qualité réelle des fourrages.
        </p>
      </CardContent>
    </Card>
  )
}
