"use client"

/**
 * DEV3 #7 - Audit Marc 2026-05-14
 * Widget compteur cuivre Bio.
 *
 * Affiche par parcelle :
 *   - kg Cu métal / ha / an (plafond 4)
 *   - kg Cu métal / ha sur 7 ans glissants (plafond 28)
 *   - Barre de progression colorée (vert / orange / rouge)
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Droplet, AlertTriangle, ShieldCheck } from "lucide-react"

interface CuivreParcelle {
  parcelleId: string
  parcelleNom: string
  surfaceHa: number
  cumulAnnuelKg: number
  cumul7ansKg: number
  cuivreKgParHaAn: number
  cuivreKgParHa7ans: number
  statut: "ok" | "warn" | "alert"
}

interface CuivreData {
  asOf: string
  plafondAnnuel: number
  plafond7ans: number
  parcelles: CuivreParcelle[]
}

function StatutBadge({ statut }: { statut: CuivreParcelle["statut"] }) {
  if (statut === "alert") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />
        Dépassement
      </Badge>
    )
  }
  if (statut === "warn") {
    return (
      <Badge className="bg-amber-500 text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />
        Vigilance
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 border-emerald-200">
      <ShieldCheck className="h-3 w-3" />
      OK
    </Badge>
  )
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">
          {value.toFixed(2)} / {max} kg/ha
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
            Aucun traitement cuivré sur les 7 dernières années. Conformité maximale.
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
            Plafond {data.plafondAnnuel} kg/ha/an · {data.plafond7ans} kg/ha/7 ans
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-slate-500 mt-1">
          Règl. UE 2018/1981 — par parcelle, cuivre métal cumulé.
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
              <StatutBadge statut={p.statut} />
            </div>
            <ProgressBar value={p.cuivreKgParHaAn} max={data.plafondAnnuel} label="Année courante" />
            <ProgressBar value={p.cuivreKgParHa7ans} max={data.plafond7ans} label="7 ans glissants" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
