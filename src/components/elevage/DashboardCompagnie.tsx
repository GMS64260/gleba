"use client"

/**
 * Tableau de bord « compagnie / équin / NAC » (Phase 0 modes d'élevage).
 *
 * Rendu à la place de DashboardTab quand la filière sélectionnée n'est pas la
 * rente (cf. capacitesSelection().dashboard === "compagnie"). Agrège depuis les
 * endpoints déjà scopables (animaux, naissances, saillies, rappels de soins)
 * filtrés par la filière courante — sans passer par la route stats orientée rente.
 *
 * cf. docs/elevage-modes-phase0-spec.md
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PawPrint, Baby, HeartPulse, Stethoscope, Search, Plus } from "lucide-react"
import { useFiliereSelection, filiereMatch } from "@/lib/elevage/filiere-context"
import { FILIERE_LABELS, type Filiere } from "@/lib/elevage/filiere"
import { kpiCardClass, kpiSubtleClass } from "@/lib/kpi-theme"
import {
  LIENS_RACCOURCIS_COMPAGNIE,
  urlNaissancesDashboardCompagnie,
} from "@/lib/elevage/dashboard-compagnie"

// Colle de données d'API loosement typées (4 formes : animaux/naissances/saillies/soins).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

async function fetchData(url: string): Promise<Row[]> {
  try {
    const r = await fetch(url, { cache: "no-store" })
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j?.data) ? j.data : []
  } catch {
    return []
  }
}

type StatsNaissances = {
  totalNaissances: number
  totalVivants: number
}

async function fetchStatsNaissances(url: string): Promise<StatsNaissances> {
  try {
    const r = await fetch(url, { cache: "no-store" })
    if (!r.ok) return { totalNaissances: 0, totalVivants: 0 }
    const j = await r.json()
    return {
      totalNaissances: Number(j?.stats?.totalNaissances ?? 0),
      totalVivants: Number(j?.stats?.totalVivants ?? 0),
    }
  } catch {
    return { totalNaissances: 0, totalVivants: 0 }
  }
}

export function DashboardCompagnie({ year }: { year: number }) {
  const filiereSel = useFiliereSelection()
  const [animaux, setAnimaux] = React.useState<Row[]>([])
  const [statsNaissances, setStatsNaissances] = React.useState<StatsNaissances>({
    totalNaissances: 0,
    totalVivants: 0,
  })
  const [saillies, setSaillies] = React.useState<Row[]>([])
  const [soins, setSoins] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancel = false
    setLoading(true)
    const filiereQuery = filiereSel !== "toutes" ? `&filiere=${encodeURIComponent(filiereSel)}` : ""
    Promise.all([
      fetchData("/api/elevage/animaux?statut=actif"),
      fetchStatsNaissances(urlNaissancesDashboardCompagnie(year, filiereSel)),
      fetchData("/api/elevage/saillies"),
      // Endpoint opérationnel sans borne d'année ni plafond arbitraire :
      // conserve les retards anciens et les rappels de l'année suivante.
      fetchData(`/api/elevage/soins?rappels=1${filiereQuery}`),
    ]).then(([a, n, s, so]) => {
      if (cancel) return
      setAnimaux(a); setStatsNaissances(n); setSaillies(s); setSoins(so)
      setLoading(false)
    })
    return () => { cancel = true }
  }, [filiereSel, year])

  const match = (f: string | null | undefined) => filiereMatch(filiereSel, f)
  const animauxF = animaux.filter((a) => match(a.especeAnimale?.filiere))
  const sailliesF = saillies.filter((s) => match(s.femelle?.especeAnimale?.filiere))
  const soinsF = soins.filter((x) => match(x.animal?.especeAnimale?.filiere ?? x.lot?.especeAnimale?.filiere))

  const auj = new Date(new Date().toDateString())
  const porteesAnnee = statsNaissances.totalNaissances
  const petitsVivants = statsNaissances.totalVivants
  const gestantes = sailliesF.filter((s) => s.statut === "Gestante")
  const misesBasAVenir = gestantes.filter((s) => s.dateMiseBasAttendue && new Date(s.dateMiseBasAttendue) >= auj)
  const rappels = soinsF.filter((s) => !s.fait && s.datePrevue && new Date(s.datePrevue) >= auj)
  const rappelsEnRetard = soinsF.filter((s) => !s.fait && s.datePrevue && new Date(s.datePrevue) < auj)

  const label = filiereSel !== "toutes" ? FILIERE_LABELS[filiereSel as Filiere] : "Compagnie"
  const dateLabel = auj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bandeau « Aujourd'hui » + raccourcis */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <PawPrint className="h-5 w-5 text-amber-600" />
                {label}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {rappelsEnRetard.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">
                  ⚠️ {rappelsEnRetard.length} rappel(s) en retard
                </span>
              ) : rappels.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {rappels.length} rappel(s) à venir
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Aucun rappel en attente
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Link href={LIENS_RACCOURCIS_COMPAGNIE.nouveauSoin}>
              <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-50"><Plus className="h-4 w-4 mr-1" />Soin</Button>
            </Link>
            <Link href={LIENS_RACCOURCIS_COMPAGNIE.nouvelleNaissance}>
              <Button variant="outline" size="sm" className="text-pink-700 border-pink-300 hover:bg-pink-50"><Baby className="h-4 w-4 mr-1" />Portée</Button>
            </Link>
            <Link href="/elevage?tab=animaux">
              <Button variant="outline" size="sm"><Search className="h-4 w-4 mr-1" />Animaux</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPI compagnie */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs flex items-center gap-1`}><PawPrint className="h-3 w-3" />Effectif</CardDescription>
            <CardTitle className="text-2xl">{animauxF.length}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>animaux actifs · {label.toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs flex items-center gap-1`}><Baby className="h-3 w-3" />Portées {year}</CardDescription>
            <CardTitle className="text-2xl">{porteesAnnee}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>{petitsVivants} petit(s) vivant(s)</p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass("neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass("neutre")} text-xs flex items-center gap-1`}><HeartPulse className="h-3 w-3" />Gestantes</CardDescription>
            <CardTitle className="text-2xl">{gestantes.length}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass("neutre")}`}>{misesBasAVenir.length} mise(s) bas à venir</p>
          </CardContent>
        </Card>

        <Card className={kpiCardClass(rappelsEnRetard.length > 0 ? "alerte" : "neutre")}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className={`${kpiSubtleClass(rappelsEnRetard.length > 0 ? "alerte" : "neutre")} text-xs flex items-center gap-1`}><Stethoscope className="h-3 w-3" />Rappels de soins</CardDescription>
            <CardTitle className="text-2xl">{rappels.length + rappelsEnRetard.length}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className={`text-xs ${kpiSubtleClass(rappelsEnRetard.length > 0 ? "alerte" : "neutre")}`}>
              {rappelsEnRetard.length > 0 ? `dont ${rappelsEnRetard.length} en retard` : "vaccins, vermifuges à venir"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Prochaines mises-bas */}
      {misesBasAVenir.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Baby className="h-4 w-4 text-pink-600" />Mises-bas attendues</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ul className="text-sm divide-y">
              {misesBasAVenir
                .sort((a, b) => new Date(a.dateMiseBasAttendue).getTime() - new Date(b.dateMiseBasAttendue).getTime())
                .slice(0, 8)
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5">
                    <span>{s.femelle?.nom || s.femelle?.identifiant || `#${s.femelle?.id}`}</span>
                    <span className="text-muted-foreground">{new Date(s.dateMiseBasAttendue).toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Rappels de soins à venir */}
      {(rappels.length > 0 || rappelsEnRetard.length > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4 text-blue-600" />Rappels de soins</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ul className="text-sm divide-y">
              {[...rappelsEnRetard, ...rappels]
                .sort((a, b) => new Date(a.datePrevue).getTime() - new Date(b.datePrevue).getTime())
                .slice(0, 10)
                .map((s) => {
                  const enRetard = new Date(s.datePrevue) < auj
                  return (
                    <li key={s.id} className="flex items-center justify-between py-1.5">
                      <span>
                        {s.animal?.nom || s.animal?.identifiant || s.lot?.nom || "—"}
                        <span className="text-muted-foreground"> · {s.type}{s.produit ? ` (${s.produit})` : ""}</span>
                      </span>
                      <span className={enRetard ? "text-red-700 font-medium" : "text-muted-foreground"}>
                        {new Date(s.datePrevue).toLocaleDateString("fr-FR")}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </CardContent>
        </Card>
      )}

      {animauxF.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          Aucun animal dans cet atelier. Ajoutez vos premiers reproducteurs depuis « Animaux & Lots ».
        </CardContent></Card>
      )}
    </div>
  )
}
