"use client"

/**
 * Calculateur de ration caprine — PROMPT 25.
 *
 * Besoins UFL/PDI d'une chèvre (poids, lait, TB, gestation) vs apports d'une
 * ration composée des aliments de l'exploitation (valeurs INRA saisies sur
 * l'aliment). Affiche la couverture, le facteur limitant PDIN/PDIE et le coût.
 */

import * as React from "react"
import { Scale, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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

export function RationSubTab() {
  const [aliments, setAliments] = React.useState<Aliment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [poids, setPoids] = React.useState(60)
  const [lait, setLait] = React.useState(3)
  const [tb, setTb] = React.useState(35)
  const [gestation, setGestation] = React.useState<StadeGestation>("aucune")
  const [quantites, setQuantites] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    fetch("/api/elevage/aliments")
      .then((r) => r.json())
      .then((j) => setAliments(j.data || []))
      .finally(() => setLoading(false))
  }, [])

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

        <p className="text-xs text-slate-400">
          Repères INRA caprin indicatifs (entretien 0,033 UFL/kg PV<sup>0,75</sup>, lait 0,44 UFL + 48 g PDI/L à 35 g TB).
          L'apport PDI d'une ration = min(PDIN, PDIE). À ajuster au troupeau et à la qualité réelle des fourrages.
        </p>
      </CardContent>
    </Card>
  )
}
