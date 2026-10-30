"use client"

/**
 * Courbe d'une grandeur d'un capteur : mesures brutes jusqu'à 31 jours,
 * minimum / moyenne / maximum journaliers au-delà (jours du lieu, calculés la
 * nuit). Les heures s'affichent dans le fuseau du lieu (celui du connecteur),
 * pas celui du navigateur.
 */
import * as React from "react"
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"
import { Loader2 } from "lucide-react"
import { ResponsiveContainer } from "@/components/ui/responsive-container"
import { fuseauAffichable } from "@/lib/capteurs/connecteurs"

type Serie =
  | { type: "brut"; unite: string; tronque: boolean; points: Array<{ t: string; v: number }> }
  | { type: "jour"; unite: string; jours: Array<{ jour: string; min: number; max: number; moyenne: number }> }

const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })

export function CourbeCapteur({ capteurId, grandeur, jours, fuseau: fuseauStocke }: { capteurId: string; grandeur: string; jours: number; fuseau: string }) {
  const [serie, setSerie] = React.useState<Serie | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const fuseau = fuseauAffichable(fuseauStocke)
  const formatHeure = React.useMemo(
    () => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: fuseau }),
    [fuseau],
  )

  // Pas d'agrégat journalier pour un angle (agregats.ts) : au-delà de 31 jours, rien à montrer.
  const sansAgregat = grandeur === "vent_direction" && jours > 31

  React.useEffect(() => {
    if (sansAgregat) return
    let actif = true
    setSerie(null)
    setErreur(null)
    fetch(`/api/capteurs/${encodeURIComponent(capteurId)}/mesures?grandeur=${encodeURIComponent(grandeur)}&jours=${jours}`)
      .then(async (r) => {
        const corps = await r.json().catch(() => null)
        if (!r.ok) throw new Error(corps?.error || "Mesures indisponibles")
        if (actif) setSerie(corps)
      })
      .catch((e) => actif && setErreur(e instanceof Error ? e.message : "Mesures indisponibles"))
    return () => {
      actif = false
    }
  }, [capteurId, grandeur, jours, sansAgregat])

  if (sansAgregat) {
    return <p className="text-sm text-slate-500">La direction du vent n&apos;a pas de moyenne journalière : choisissez 30 jours au plus.</p>
  }
  if (erreur) return <p className="text-sm text-red-700">{erreur}</p>
  if (!serie) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />

  const vide = serie.type === "brut" ? serie.points.length === 0 : serie.jours.length === 0
  if (vide) return <p className="text-sm text-slate-500">Aucune mesure sur la période.</p>

  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={220}>
        {serie.type === "brut" ? (
          <LineChart data={serie.points.map((p) => ({ x: formatHeure.format(new Date(p.t)), v: p.v }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" minTickGap={40} fontSize={11} />
            <YAxis fontSize={11} unit={` ${serie.unite}`} width={70} />
            <Tooltip formatter={(v) => [`${v} ${serie.unite}`, ""]} />
            <Line type="monotone" dataKey="v" stroke="#16a34a" dot={false} isAnimationActive={false} />
          </LineChart>
        ) : (
          <LineChart data={serie.jours.map((j) => ({ x: formatJour.format(new Date(`${j.jour}T12:00:00Z`)), min: j.min, moyenne: j.moyenne, max: j.max }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" minTickGap={30} fontSize={11} />
            <YAxis fontSize={11} unit={` ${serie.unite}`} width={70} />
            <Tooltip formatter={(v, nom) => [`${v} ${serie.unite}`, String(nom)]} />
            <Line type="monotone" dataKey="max" name="Maximum" stroke="#dc2626" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="#16a34a" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="min" name="Minimum" stroke="#2563eb" dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
      <p className="text-xs text-slate-500">
        {serie.type === "brut"
          ? `Heures de ${fuseau}.${serie.tronque ? " Série coupée aux 10 000 mesures les plus récentes : choisissez une période plus courte pour tout voir." : ""}`
          : "Un point par jour du lieu, calculé chaque nuit : le jour en cours n'y figure pas encore."}
      </p>
    </div>
  )
}
