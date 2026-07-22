"use client"

/**
 * Sous-onglet Économie lait & fromage — PROMPT 22.
 *
 * MCA (marge sur coût alimentaire), coût de revient du litre, rendement
 * fromager et coût de revient du kg, marge par type de fromage. Comble le trou
 * de `analyse-couts` (œuf/viande) pour une exploitation laitière.
 */

import * as React from "react"
import { Euro, TrendingUp, Milk, FileText, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Economie = {
  annee: number
  production: {
    litresProduits: number
    litresTransformes: number
    litresVendusCru: number
    litresLivres: number
    litresEcartes: number
    kgFromage: number
  }
  couts: { alimentaire: number; sanitaire: number }
  valorisation: { laitCru: number; laitLivre: number; fromage: number }
  indicateurs: {
    valorisation: number
    coutTotal: number
    marge: number
    mca: number
    mcaPour1000L: number | null
    coutAlimentaireLitre: number | null
    coutRevientLitre: number | null
    prixMoyenLitreValorise: number | null
    rendementFromager: number | null
    litresParKgFromage: number | null
    coutRevientKgFromage: number | null
  }
  fromages: {
    type: string
    volumeLaitL: number
    kg: number
    pieces: number
    rendementKgParL: number | null
    litresParKg: number | null
    ca: number
    prixMoyenKg: number | null
  }[]
  methode: { partGlobaleLaitiere: number; tetesLaitieres: number; tetesTotales: number; note: string }
}

const eur = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : `${v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`

export function EconomieLaitSubTab({ year }: { year?: number } = {}) {
  const [annee, setAnnee] = React.useState(year ?? new Date().getFullYear())
  const [data, setData] = React.useState<Economie | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (year) setAnnee(year)
  }, [year])

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/elevage/economie-lait?annee=${annee}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [annee])

  if (loading) return <div className="text-sm text-slate-500 p-4">Chargement…</div>
  if (!data) return <div className="text-sm text-slate-500 p-4">Données indisponibles.</div>

  const i = data.indicateurs
  const aucuneDonnee = data.production.litresProduits === 0 && i.valorisation === 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-emerald-600" />
                Économie lait & fromage {data.annee}
              </CardTitle>
              <CardDescription>
                Marge sur coût alimentaire, coût de revient du litre et du kg de fromage, rendement de transformation.
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
          {aucuneDonnee ? (
            <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">
              Aucune donnée laitière pour {data.annee}. Saisissez des collectes de lait, des fabrications de fromage et
              leurs ventes pour activer l'analyse économique.
            </div>
          ) : (
            <>
              {/* Indicateurs clés */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile
                  label="MCA (marge / coût alim.)"
                  value={eur(i.mca)}
                  sub={i.mcaPour1000L != null ? `${eur(i.mcaPour1000L)} / 1000 L` : undefined}
                  tone={i.mca >= 0 ? "good" : "bad"}
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                />
                <KpiTile
                  label="Coût alim. / litre"
                  value={i.coutAlimentaireLitre != null ? `${i.coutAlimentaireLitre.toFixed(3)} €` : "—"}
                  sub={i.coutRevientLitre != null ? `revient : ${i.coutRevientLitre.toFixed(3)} €/L` : undefined}
                  tone="neutral"
                />
                <KpiTile
                  label="Prix moyen valorisé"
                  value={i.prixMoyenLitreValorise != null ? `${i.prixMoyenLitreValorise.toFixed(3)} €/L` : "—"}
                  tone="neutral"
                />
                <KpiTile
                  label="Marge nette"
                  value={eur(i.marge)}
                  sub={`valorisation ${eur(i.valorisation)}`}
                  tone={i.marge >= 0 ? "good" : "bad"}
                />
              </div>

              {/* Production / Valorisation / Coûts */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Milk className="h-4 w-4 text-blue-600" /> Production
                  </div>
                  <Ligne label="Litres produits" value={`${data.production.litresProduits.toLocaleString("fr-FR")} L`} />
                  <Ligne label="Transformés en fromage" value={`${data.production.litresTransformes.toLocaleString("fr-FR")} L`} />
                  <Ligne label="Vendus en lait cru" value={`${data.production.litresVendusCru.toLocaleString("fr-FR")} L`} />
                  <Ligne label="Livrés (laiterie)" value={`${data.production.litresLivres.toLocaleString("fr-FR")} L`} />
                  <Ligne label="Écartés (attente véto)" value={`${data.production.litresEcartes.toLocaleString("fr-FR")} L`} />
                  <Ligne label="Fromage fabriqué" value={`${data.production.kgFromage.toLocaleString("fr-FR")} kg`} strong />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" /> Valorisation
                  </div>
                  <Ligne label="Ventes fromage" value={eur(data.valorisation.fromage)} />
                  <Ligne label="Ventes lait cru" value={eur(data.valorisation.laitCru)} />
                  <Ligne label="Lait livré (laiterie)" value={eur(data.valorisation.laitLivre)} />
                  <Ligne label="Total" value={eur(i.valorisation)} strong />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Euro className="h-4 w-4 text-red-600" /> Coûts affectés
                  </div>
                  <Ligne label="Alimentaire" value={eur(data.couts.alimentaire)} />
                  <Ligne label="Sanitaire" value={eur(data.couts.sanitaire)} />
                  <Ligne label="Total" value={eur(i.coutTotal)} strong />
                </div>
              </div>

              {/* Rendement & marge par type de fromage */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <FileText className="h-4 w-4 text-amber-600" /> Rendement & valorisation par type de fromage
                </div>
                {data.fromages.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded">Aucune fabrication cette année.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-right">Lait utilisé</th>
                          <th className="p-2 text-right">Fromage</th>
                          <th className="p-2 text-right">Pièces</th>
                          <th className="p-2 text-right">Rendement</th>
                          <th className="p-2 text-right">L / kg</th>
                          <th className="p-2 text-right">CA</th>
                          <th className="p-2 text-right">Prix moy. /kg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.fromages.map((f) => (
                          <tr key={f.type} className="border-b hover:bg-slate-50">
                            <td className="p-2 font-medium">{f.type}</td>
                            <td className="p-2 text-right">{f.volumeLaitL.toLocaleString("fr-FR")} L</td>
                            <td className="p-2 text-right">{f.kg.toLocaleString("fr-FR")} kg</td>
                            <td className="p-2 text-right text-slate-500">{f.pieces || "—"}</td>
                            <td className="p-2 text-right">
                              {f.rendementKgParL != null ? `${(f.rendementKgParL * 100).toFixed(1)} %` : "—"}
                            </td>
                            <td className="p-2 text-right text-slate-600">{f.litresParKg ?? "—"}</td>
                            <td className="p-2 text-right">{eur(f.ca)}</td>
                            <td className="p-2 text-right font-semibold">
                              {f.prixMoyenKg != null ? eur(f.prixMoyenKg, 2) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {i.coutRevientKgFromage != null && (
                  <p className="text-xs text-slate-500 mt-2">
                    Coût de revient moyen du kg de fromage (coûts alloués au prorata des litres transformés) :{" "}
                    <span className="font-semibold text-slate-700">{eur(i.coutRevientKgFromage, 2)}/kg</span>
                    {i.rendementFromager != null && (
                      <> · rendement global {(i.rendementFromager * 100).toFixed(1)} % ({i.litresParKgFromage} L/kg)</>
                    )}
                  </p>
                )}
              </div>

              {/* Méthode d'affectation */}
              <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded p-3">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {data.methode.note}{" "}
                  {data.methode.tetesTotales > 0 && (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      part laitière {Math.round(data.methode.partGlobaleLaitiere * 100)} % ({data.methode.tetesLaitieres}/
                      {data.methode.tetesTotales} têtes)
                    </Badge>
                  )}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string
  value: string
  sub?: string
  tone: "good" | "bad" | "neutral"
  icon?: React.ReactNode
}) {
  const toneCls =
    tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-800"
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function Ligne({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${strong ? "font-semibold border-t mt-1 pt-1.5" : ""}`}>
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}
