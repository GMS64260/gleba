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
import { ArrowLeft, CalendarClock, ChevronsRight, RotateCcw, RotateCw, Tags } from "lucide-react"

import { croissanceCulture, envergureArbreADate } from "@/lib/plan-croissance"
import { Garden3DView, type Garden3DData, type Garden3DFond } from "@/components/garden/garden3d"
import { useFondPlan } from "@/hooks/use-fond-plan"

const JOUR_MS = 24 * 3600 * 1000

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
          <Garden3DView data={data} fond={fond3D} autoRotate={autoRotate} showLabels={showLabels} />

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
                  Aujourd'hui
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
