"use client"

/**
 * DEV3 #7 - Audit Marc 2026-05-14
 * Widget compteur cuivre Bio, indicatif.
 *
 * Affiche par parcelle :
 *   - kg Cu métal / ha / an (repère 4, plafond seulement si l'AMM le fixe)
 *   - kg Cu métal / ha sur 7 ans glissants (repère 28)
 *   - Barre de progression colorée (vert / orange / rouge)
 *
 * Revue réglementaire du 2026-11-12 (C6) : un cumul partiel ou estimé n'est
 * plus présenté comme un total connu, et aucun « OK » n'est affiché quand un
 * apport cuivré ne se calcule pas. Règles : `src/lib/phyto/cuivre.ts`.
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Droplet, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react"
import { LIBELLES_HYPOTHESES_CUIVRE, type HypotheseCuivre, type StatutCuivre } from "@/lib/phyto/cuivre"

interface CuivreParcelle {
  parcelleId: string
  parcelleNom: string
  surfaceHa: number
  cumulAnnuelKg: number
  cumul7ansKg: number
  cuivreKgParHaAn: number
  cuivreKgParHa7ans: number
  statut: StatutCuivre
  partiel?: boolean
  hypotheses?: HypotheseCuivre[]
  nbTraitementsCuivreSansDose7ans?: number
}

interface CuivreData {
  asOf: string
  plafondAnnuel: number
  plafond7ans: number
  parcelles: CuivreParcelle[]
}

function StatutBadge({ statut, estime }: { statut: StatutCuivre; estime: boolean }) {
  if (statut === "alert") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />
        {estime ? "Dépassement estimé" : "Dépassement"}
      </Badge>
    )
  }
  if (statut === "indetermine") {
    return (
      <Badge className="bg-amber-500 text-[10px] gap-1">
        <HelpCircle className="h-3 w-3" />
        Indéterminé
      </Badge>
    )
  }
  if (statut === "inconnu") {
    return (
      <Badge className="bg-amber-500 text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />
        Surface inconnue
      </Badge>
    )
  }
  if (statut === "warn") {
    return (
      <Badge className="bg-amber-500 text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />
        {estime ? "Vigilance (estimation)" : "Vigilance"}
      </Badge>
    )
  }
  if (statut === "estime") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 text-amber-800 border-amber-300">
        <HelpCircle className="h-3 w-3" />
        Estimation
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 border-emerald-200">
      <ShieldCheck className="h-3 w-3" />
      Sous les repères
    </Badge>
  )
}

function ProgressBar({ value, max, label, partiel }: { value: number; max: number; label: string; partiel: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">
          {partiel ? "au moins " : ""}{value.toFixed(2)} / {max} kg/ha
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CuivreCounterCard() {
  const [data, setData] = React.useState<CuivreData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoading(true)
    fetch("/api/phyto/cuivre")
      .then((r) => {
        if (!r.ok) throw new Error("API")
        return r.json()
      })
      .then((d: CuivreData) => setData(d))
      .catch(() => setError("Impossible de charger le compteur cuivre"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Droplet className="h-4 w-4 text-orange-500" />
            Compteur cuivre Bio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500">Calcul en cours…</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="py-3">
          <p className="text-xs text-red-700">{error ?? "Erreur"}</p>
        </CardContent>
      </Card>
    )
  }

  if (data.parcelles.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Compteur cuivre Bio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-emerald-700">
            Aucun traitement cuivré enregistré dans Gleba sur les 7 dernières années.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Droplet className="h-4 w-4 text-orange-600" />
          Compteur cuivre Bio
          <Badge variant="outline" className="text-[10px] ml-auto">
            Repères {data.plafond7ans} kg/ha/7 ans · {data.plafondAnnuel} kg/ha/an
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-slate-500 mt-1">
          Calcul indicatif, par parcelle, en cuivre métal. La limite qui s&apos;applique est celle de l&apos;AMM de
          chaque produit : le règl. UE 2018/1981 autorise au plus {data.plafond7ans} kg/ha sur 7 ans, et le plafond
          annuel de {data.plafondAnnuel} kg/ha ne vaut que si l&apos;AMM le fixe.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.parcelles.map((p) => (
          <div key={p.parcelleId} className="rounded-md border p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{p.parcelleNom}</span>
                <span className="text-[11px] text-slate-500">
                  {p.surfaceHa.toFixed(2)} ha
                </span>
              </div>
              <StatutBadge statut={p.statut} estime={(p.hypotheses?.length ?? 0) > 0} />
            </div>
            {p.statut === "inconnu" ? (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {p.cumulAnnuelKg.toFixed(2)} kg de cuivre cette année ({p.cumul7ansKg.toFixed(2)} kg sur 7 ans), mais la
                surface de la parcelle est inconnue : rattachez la planche ou l&apos;arbre à une parcelle de surface connue
                pour vérifier le plafond.
              </p>
            ) : null}
            <ProgressBar value={p.cuivreKgParHaAn} max={data.plafondAnnuel} label="Année courante" partiel={Boolean(p.partiel)} />
            <ProgressBar value={p.cuivreKgParHa7ans} max={data.plafond7ans} label="7 ans glissants" partiel={Boolean(p.partiel)} />
            {p.hypotheses && p.hypotheses.length > 0 ? (
              <p className="text-[11px] text-amber-800 flex items-start gap-1">
                <HelpCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Estimation : {p.hypotheses.map((h) => LIBELLES_HYPOTHESES_CUIVRE[h]).join(" ; ")}. Renseignez la
                  teneur en cuivre du produit et une dose en kg pour un calcul exact.
                </span>
              </p>
            ) : null}
            {/* Bug #12 — traitements cuivrés saisis mais incomplets
                (dose ou surface manquante) : signaler pour ne pas faire
                croire à une conformité maximale par défaut. */}
            {p.nbTraitementsCuivreSansDose7ans && p.nbTraitementsCuivreSansDose7ans > 0 ? (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {p.nbTraitementsCuivreSansDose7ans} traitement{p.nbTraitementsCuivreSansDose7ans > 1 ? 's' : ''} cuivré{p.nbTraitementsCuivreSansDose7ans > 1 ? 's' : ''} non
                calculable{p.nbTraitementsCuivreSansDose7ans > 1 ? 's' : ''} (dose, unité, surface ou volume de bouillie manquant) : le
                cumul affiché est partiel. Complétez la saisie pour le calculer.
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
