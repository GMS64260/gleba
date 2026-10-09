"use client"

import * as React from "react"

import { GardenView } from "@/components/garden/GardenView"
import { useFondPlan } from "@/hooks/use-fond-plan"
import { croissanceCulture } from "@/lib/plan-croissance"

/**
 * Le vrai plan 2D de `/jardin`, en lecture seule, cadré dans la tuile de
 * l'accueil : cultures en silhouettes, objets texturés, arbres, et le fond
 * aérien calibré s'il existe. Remplace le dessin reconstitué (gardé comme
 * image d'attente) : « son affichage n'est pas beau » (Guillaume, 2026-10-09).
 *
 * Le composant ne connaît pas son conteneur : on mesure la tuile, on calcule
 * l'étendue du contenu comme lui (planches, objets, arbres, image de fond),
 * puis on lui donne une boîte à la bonne proportion et l'échelle qui la
 * remplit. Aucune interaction : la tuile reste un aperçu.
 */

type Planches = React.ComponentProps<typeof GardenView>["planches"]
type Objets = NonNullable<React.ComponentProps<typeof GardenView>["objets"]>
type Arbres = NonNullable<React.ComponentProps<typeof GardenView>["arbres"]>

export interface PlanVivantProps {
  /** Appelé quand le plan est prêt à être montré (l'image d'attente peut s'effacer). */
  onPret?: () => void
  className?: string
}

interface Etendue {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const MARGE_M = 1

export function PlanVivant({ onPret, className }: PlanVivantProps) {
  const [planches, setPlanches] = React.useState<Planches | null>(null)
  const [objets, setObjets] = React.useState<Objets>([])
  const [arbres, setArbres] = React.useState<Arbres>([])
  const [erreur, setErreur] = React.useState(false)
  const { fond, loading: fondEnCours } = useFondPlan()
  const [dimensionsFond, setDimensionsFond] = React.useState<{ width: number; height: number } | null>(null)
  const conteneur = React.useRef<HTMLDivElement>(null)
  const [taille, setTaille] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    let annule = false
    const aujourdhui = new Date()
    Promise.all([
      fetch("/api/jardin").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/objets-jardin").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/arbres").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, o, a]) => {
        if (annule) return
        const lignesPlanches = (Array.isArray(p) ? p : p?.data ?? []) as Planches
        setPlanches(
          lignesPlanches.map((pl) => ({
            ...pl,
            cultures: (pl.cultures ?? [])
              .map((c) => ({ ...c, croissance: croissanceCulture(c as unknown as Parameters<typeof croissanceCulture>[0], aujourdhui) }))
              .filter((c) => c.croissance !== null),
          })),
        )
        setObjets((Array.isArray(o) ? o : o?.data ?? []) as Objets)
        setArbres((Array.isArray(a) ? a : a?.data ?? []) as Arbres)
      })
      .catch(() => {
        if (!annule) setErreur(true)
      })
    return () => {
      annule = true
    }
  }, [])

  // Dimensions de l'image de fond : elles entrent dans le cadrage.
  React.useEffect(() => {
    if (!fond?.image) {
      setDimensionsFond(null)
      return
    }
    let annule = false
    const image = new Image()
    image.onload = () => {
      if (!annule) setDimensionsFond({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      if (!annule) setDimensionsFond(null)
    }
    image.src = fond.image
    return () => {
      annule = true
    }
  }, [fond?.image])

  React.useEffect(() => {
    const el = conteneur.current
    if (!el) return
    const mesurer = () => setTaille({ width: el.clientWidth, height: el.clientHeight })
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const etendue = React.useMemo<Etendue | null>(() => {
    if (!planches) return null
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    if (fond?.image && dimensionsFond) {
      minX = Math.min(minX, fond.offsetX)
      minY = Math.min(minY, fond.offsetY)
      maxX = Math.max(maxX, fond.offsetX + dimensionsFond.width * fond.scale)
      maxY = Math.max(maxY, fond.offsetY + dimensionsFond.height * fond.scale)
    }
    for (const p of planches) {
      const x = p.posX ?? 0
      const y = p.posY ?? 0
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + (p.largeur ?? 1))
      maxY = Math.max(maxY, y + (p.longueur ?? 1))
    }
    for (const o of objets) {
      minX = Math.min(minX, o.posX)
      minY = Math.min(minY, o.posY)
      maxX = Math.max(maxX, o.posX + o.largeur)
      maxY = Math.max(maxY, o.posY + o.longueur)
    }
    for (const a of arbres) {
      const r = Math.max(a.envergure, 0.5) / 2
      minX = Math.min(minX, a.posX - r)
      minY = Math.min(minY, a.posY - r)
      maxX = Math.max(maxX, a.posX + r)
      maxY = Math.max(maxY, a.posY + r)
    }
    if (!Number.isFinite(minX)) return null
    // Même règle que le plan : marge d'un mètre, jamais moins de 10 × 8 m.
    return {
      minX: Math.min(minX - MARGE_M, -1),
      minY: Math.min(minY - MARGE_M, -1),
      maxX: Math.max(maxX + MARGE_M, Math.min(minX - MARGE_M, -1) + 10),
      maxY: Math.max(maxY + MARGE_M, Math.min(minY - MARGE_M, -1) + 8),
    }
  }, [planches, objets, arbres, fond, dimensionsFond])

  const pret = Boolean(planches && etendue && taille.width > 0 && !fondEnCours && (!fond?.image || dimensionsFond))
  React.useEffect(() => {
    if (pret) onPret?.()
  }, [pret, onPret])

  // Boîte à la proportion du contenu, centrée, et échelle qui la remplit.
  let boite: { width: number; height: number; echelle: number } | null = null
  if (etendue && taille.width > 0 && taille.height > 0) {
    const w = etendue.maxX - etendue.minX
    const h = etendue.maxY - etendue.minY
    const echelle = Math.min(taille.width / w, taille.height / h)
    boite = { width: Math.floor(w * echelle), height: Math.floor(h * echelle), echelle }
  }

  return (
    <div ref={conteneur} className={`pointer-events-none flex h-full w-full items-center justify-center ${className ?? ""}`} aria-hidden="true">
      {pret && boite && planches && !erreur && (
        <div style={{ width: boite.width, height: boite.height }}>
          <GardenView
            planches={planches}
            objets={objets}
            arbres={arbres}
            editable={false}
            scale={boite.echelle}
            layers={{ fond: true, grille: false, etiquettes: false, projectionAdulte: false, associations: false }}
            backgroundImage={
              fond?.image
                ? {
                    image: fond.image,
                    opacity: fond.opacity,
                    scale: fond.scale,
                    offsetX: fond.offsetX,
                    offsetY: fond.offsetY,
                    rotation: fond.rotation,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
