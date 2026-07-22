"use client"

/**
 * Vue 3D du jardin (vue seule). Réutilise le pipeline de données de l'éditeur
 * 2D : /api/jardin, /api/objets-jardin, /api/arbres, et le moteur pur
 * `plan-croissance` pour la taille des cultures/arbres à la date affichée
 * (barre de temps). Fond de plan partagé avec la 2D (useFondPlan). L'édition
 * reste dans /jardin.
 */

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarClock, ChevronsRight, ExternalLink, RotateCcw, RotateCw, Tags, X } from "lucide-react"

import { croissanceCulture, envergureArbreADate } from "@/lib/plan-croissance"
import { Garden3DView, type Culture3D, type Garden3DData, type Garden3DFond, type Planche3D } from "@/components/garden/garden3d"
import { PluviometriePlanche } from "@/components/meteo/PluviometriePlanche"
import { cultureSelectionnee } from "@/components/garden/garden3d/detail"
import { useFondPlan } from "@/hooks/use-fond-plan"

const JOUR_MS = 24 * 3600 * 1000

function formatDate(value?: string | null) {
  if (!value) return "Non renseignée"
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

function CulturePanel({ planche, onClose }: { planche: Planche3D; onClose: () => void }) {
  const [cultureId, setCultureId] = React.useState<number | null>(planche.cultures[0]?.id ?? null)
  React.useEffect(() => setCultureId(planche.cultures[0]?.id ?? null), [planche.id, planche.cultures])
  const culture: Culture3D | undefined = cultureSelectionnee(planche, cultureId)
  const parcelleNom = planche.parcelleGeo?.nom || "Parcelle non renseignée"

  return (
    <aside className="absolute inset-x-0 bottom-0 z-20 max-h-[72dvh] overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[24rem] md:rounded-none md:border-l">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Détail de la planche</p>
          <h2 className="truncate text-lg font-bold text-gray-900">{planche.nom || "Planche"}</h2>
          <p className="truncate text-sm text-gray-500">Parcelle : {parcelleNom}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer le détail" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5 pb-8">
        {planche.cultures.length > 1 && (
          <div>
            <label htmlFor="culture-3d" className="mb-1.5 block text-sm font-medium text-gray-700">Culture affichée</label>
            <select id="culture-3d" value={culture?.id ?? ""} onChange={(event) => setCultureId(Number(event.target.value))} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">
              {planche.cultures.map((item) => <option key={item.id} value={item.id}>{item.espece?.nom || "Culture"}</option>)}
            </select>
          </div>
        )}

        {culture ? (
          <section className="space-y-3" aria-label="Culture sélectionnée">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: culture.espece?.couleur || "#5c9134" }} />
              <div>
                <h3 className="font-semibold text-gray-900">{culture.espece?.nom || "Culture"}</h3>
                <p className="text-sm font-medium text-emerald-700">Croissance : {Math.round(culture.croissance * 100)} %</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Semis</dt><dd className="mt-1 font-medium text-gray-800">{formatDate(culture.dateSemis)}</dd></div>
              <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Plantation</dt><dd className="mt-1 font-medium text-gray-800">{formatDate(culture.datePlantation)}</dd></div>
              <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Récolte prévue</dt><dd className="mt-1 font-medium text-gray-800">{formatDate(culture.dateRecolte)}</dd></div>
              <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Rangs</dt><dd className="mt-1 font-medium text-gray-800">{culture.nbRangs ?? "Non renseigné"}</dd></div>
            </dl>
            <Link href={`/maraichage/cultures/${culture.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              Ouvrir la fiche culture <ExternalLink className="h-4 w-4" />
            </Link>
          </section>
        ) : <p className="rounded-lg bg-gray-50 p-3 text-sm italic text-gray-500">Aucune culture en cours sur cette planche.</p>}

        <section className="border-t pt-5" aria-label="Pluviométrie de la parcelle">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pluviométrie de la parcelle · mm</p>
          <p className="mb-3 text-sm text-gray-700">{parcelleNom}</p>
          <PluviometriePlanche plancheId={planche.id} typePlanche={planche.type} />
        </section>
      </div>
    </aside>
  )
}

export default function Jardin3DPage() {
  return (
    <React.Suspense fallback={<div className="flex h-[100dvh] items-center justify-center">Chargement…</div>}>
      <Jardin3DContent />
    </React.Suspense>
  )
}

function Jardin3DContent() {
  const searchParams = useSearchParams()
  const parcelleId = searchParams.get("parcelle")

  const [raw, setRaw] = React.useState<{
    planches: Record<string, unknown>[]
    objets: Record<string, unknown>[]
    arbres: Record<string, unknown>[]
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [autoRotate, setAutoRotate] = React.useState(false)
  const [showLabels, setShowLabels] = React.useState(false)
  const [offsetDays, setOffsetDays] = React.useState(0)
  const [selectedPlancheId, setSelectedPlancheId] = React.useState<string | null>(null)

  const { fond, loading: fondLoading } = useFondPlan(parcelleId)
  const [fond3D, setFond3D] = React.useState<Garden3DFond | null>(null)

  // Date d'ancrage stable (aujourd'hui) + date affichée (barre de temps)
  const today = React.useMemo(() => new Date(), [])
  const dateAffichee = React.useMemo(
    () => new Date(today.getTime() + offsetDays * JOUR_MS),
    [today, offsetDays]
  )
  const estAujourdhui = offsetDays === 0

  React.useEffect(() => {
    if (!fond) {
      setFond3D(null)
      return
    }
    let active = true
    const image = new Image()
    image.onload = () => {
      if (active) setFond3D({ ...fond, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight })
    }
    image.onerror = () => active && setFond3D(null)
    image.src = fond.image
    return () => {
      active = false
    }
  }, [fond])

  // Chargement brut (une fois par parcelle) — la croissance est dérivée ensuite
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const suffix = parcelleId ? `?parcelle=${encodeURIComponent(parcelleId)}` : "?parcelle=all"
        const [rp, ro, ra] = await Promise.all([
          fetch(`/api/jardin${suffix}`),
          fetch(`/api/objets-jardin${suffix}`),
          fetch(`/api/arbres${suffix}`),
        ])
        if (rp.status === 401 || ro.status === 401 || ra.status === 401) {
          setError("Session expirée — reconnectez-vous.")
          return
        }
        const [planches, objets, arbres] = await Promise.all([
          rp.ok ? rp.json() : [],
          ro.ok ? ro.json() : [],
          ra.ok ? ra.json() : [],
        ])
        if (cancelled) return
        setRaw({
          planches: Array.isArray(planches) ? planches : [],
          objets: Array.isArray(objets) ? objets : [],
          arbres: Array.isArray(arbres) ? arbres : [],
        })
      } catch {
        if (!cancelled) setError("Impossible de charger le plan du jardin.")
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [parcelleId])

  // Données dérivées à la date affichée (croissance des cultures + envergure des arbres)
  const data: Garden3DData | null = React.useMemo(() => {
    if (!raw) return null
    const planches = raw.planches.map((p) => ({
      ...(p as object),
      cultures: (((p as { cultures?: unknown[] }).cultures) ?? [])
        .map((c: unknown) => ({ ...(c as object), croissance: croissanceCulture(c as never, dateAffichee) }))
        .filter((c: { croissance: number | null }) => c.croissance !== null),
    }))
    const arbres = raw.arbres.map((a) => ({
      ...(a as object),
      envergure: envergureArbreADate(a as never, dateAffichee, today),
    }))
    return { planches: planches as never, objets: raw.objets as never, arbres: arbres as never }
  }, [raw, dateAffichee, today])

  // Conserver seulement l'identifiant : la planche sélectionnée doit toujours
  // provenir des données recalculées par la barre temporelle.
  const selectedPlanche = React.useMemo(
    () => data?.planches.find((planche) => planche.id === selectedPlancheId) ?? null,
    [data, selectedPlancheId]
  )

  const isEmpty =
    data && data.planches.length === 0 && data.objets.length === 0 && data.arbres.length === 0 && !fond3D

  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm backdrop-blur transition"

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-sky-100 to-emerald-50">
      {/* Barre flottante haute */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <Link href="/jardin" className={`${btn} bg-white/90 text-gray-700 hover:bg-white`}>
          <ArrowLeft className="h-4 w-4" />
          Plan 2D
        </Link>
        <span className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur">
          Vue 3D
        </span>
      </div>
      <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          className={`${btn} ${showLabels ? "bg-emerald-600 text-white" : "bg-white/90 text-gray-700 hover:bg-white"}`}
        >
          <Tags className="h-4 w-4" />
          Étiquettes
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className={`${btn} ${autoRotate ? "bg-emerald-600 text-white" : "bg-white/90 text-gray-700 hover:bg-white"}`}
        >
          <RotateCw className={`h-4 w-4 ${autoRotate ? "animate-spin" : ""}`} />
          Rotation
        </button>
      </div>

      {/* Contenu */}
      {error ? (
        <div className="flex h-full items-center justify-center">
          <div className="rounded-xl bg-white/90 px-6 py-4 text-center shadow">
            <p className="text-sm font-medium text-gray-700">{error}</p>
            <Link href="/login" className="mt-2 inline-block text-sm text-emerald-700 underline">
              Se connecter
            </Link>
          </div>
        </div>
      ) : !data || fondLoading || (fond && !fond3D) ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-emerald-700">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
            <p className="text-sm font-medium">Chargement du jardin…</p>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="flex h-full items-center justify-center">
          <div className="rounded-xl bg-white/90 px-6 py-4 text-center shadow">
            <p className="text-sm font-medium text-gray-700">Aucune planche, aucun objet ni arbre à afficher.</p>
            <Link href="/jardin" className="mt-2 inline-block text-sm text-emerald-700 underline">
              Composer le plan en 2D
            </Link>
          </div>
        </div>
      ) : (
        <>
          <Garden3DView data={data} fond={fond3D} autoRotate={autoRotate} showLabels={showLabels} selectedPlancheId={selectedPlancheId} onSelectPlanche={(planche) => setSelectedPlancheId(planche.id)} />

          {/* Barre de temps */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-3">
            <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-3 rounded-2xl bg-white/92 px-4 py-3 shadow-lg backdrop-blur">
              <CalendarClock className={`h-5 w-5 flex-shrink-0 ${estAujourdhui ? "text-emerald-600" : "text-amber-500"}`} />
              <div className="flex min-w-[8.5rem] flex-col">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Le jardin au</span>
                <span className="text-sm font-semibold text-gray-800">
                  {dateAffichee.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <input
                type="range"
                min={-120}
                max={300}
                step={1}
                value={Math.max(-120, Math.min(300, offsetDays))}
                onChange={(e) => setOffsetDays(Number(e.target.value))}
                aria-label="Faire défiler le temps"
                className="h-2 flex-1 min-w-[8rem] cursor-pointer accent-emerald-600"
              />
              <button
                type="button"
                onClick={() => setOffsetDays((d) => d + 365)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                title="Avancer d'un an"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
                +1 an
              </button>
              {!estAujourdhui && (
                <button
                  type="button"
                  onClick={() => setOffsetDays(0)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  title="Revenir à aujourd'hui"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Aujourd&apos;hui
                </button>
              )}
            </div>
          </div>
          {selectedPlanche && <CulturePanel planche={selectedPlanche} onClose={() => setSelectedPlancheId(null)} />}
        </>
      )}
    </div>
  )
}
