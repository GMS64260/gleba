"use client"

/**
 * Hook client de l'image de fond du plan 2D, persistée côté serveur
 * (/api/jardin/fond) pour être partagée entre appareils.
 *
 * - Résolution : fond de la parcelle sélectionnée, sinon fond global.
 * - L'image est gardée en data URL côté client : affichage direct dans le
 *   SVG ET export PNG possible (une URL réseau dans un <image> SVG serait
 *   ignorée à la rastérisation canvas).
 * - Migration douce : l'ancien fond localStorage (`gleba_settings.backgroundImage`)
 *   est téléversé une fois vers le serveur puis retiré du localStorage.
 */

import * as React from "react"
import { SETTINGS_KEY } from "@/hooks/use-settings"

export interface FondPlanState {
  image: string // data URL
  opacity: number
  scale: number // mètres par pixel image
  offsetX: number
  offsetY: number
  rotation: number
  /** Contours de parcelle en pixels image (dessinés collés à la photo). */
  contour: number[][][] | null
  /** Clé de la ligne serveur réellement affichée ("global" ou id de parcelle). */
  parcelleKey: string
  /** "parcelle" si le fond est propre à la parcelle demandée, "global" sinon. */
  source: "parcelle" | "global"
}

export type FondReglagesPartiels = Partial<
  Pick<FondPlanState, "opacity" | "scale" | "offsetX" | "offsetY" | "rotation">
>

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"))
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: match[1] })
  } catch {
    return null
  }
}

interface FondApiMeta {
  exists: boolean
  parcelleKey?: string
  source?: "parcelle" | "global"
  opacity?: number
  scale?: number
  offsetX?: number
  offsetY?: number
  rotation?: number
  contour?: number[][][] | null
  imageUrl?: string
}

async function chargerDepuisApi(parcelleKey: string): Promise<FondPlanState | null> {
  const res = await fetch(`/api/jardin/fond?parcelle=${encodeURIComponent(parcelleKey)}`)
  if (!res.ok) return null
  const meta: FondApiMeta = await res.json()
  if (!meta.exists || !meta.imageUrl) return null
  const imgRes = await fetch(meta.imageUrl)
  if (!imgRes.ok) return null
  const image = await blobToDataUrl(await imgRes.blob())
  return {
    image,
    opacity: meta.opacity ?? 0.5,
    scale: meta.scale ?? 0.1,
    offsetX: meta.offsetX ?? 0,
    offsetY: meta.offsetY ?? 0,
    rotation: meta.rotation ?? 0,
    contour: meta.contour ?? null,
    parcelleKey: meta.parcelleKey ?? "global",
    source: meta.source ?? "global",
  }
}

/**
 * Migre un fond stocké sous une clé localStorage héritée vers le serveur
 * (clé cible : id de parcelle ou "global"). Retourne l'état migré ou null.
 */
async function migrerDepuisStorage(
  storageKey: string,
  cibleParcelle: string
): Promise<FondPlanState | null> {
  let legacy: Record<string, unknown> | null = null
  try {
    const stored = localStorage.getItem(storageKey)
    legacy = stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
  const image = legacy?.backgroundImage
  if (typeof image !== "string" || !image.startsWith("data:")) return null

  const blob = dataUrlToBlob(image)
  if (!blob) return null

  const formData = new FormData()
  formData.append("parcelle", cibleParcelle)
  formData.append("file", blob, "fond-plan")
  for (const [champ, cle] of [
    ["opacity", "backgroundOpacity"],
    ["scale", "backgroundScale"],
    ["offsetX", "backgroundOffsetX"],
    ["offsetY", "backgroundOffsetY"],
    ["rotation", "backgroundRotation"],
  ] as const) {
    const v = legacy?.[cle]
    if (typeof v === "number" && Number.isFinite(v)) formData.append(champ, String(v))
  }

  const res = await fetch("/api/jardin/fond", { method: "POST", body: formData })
  if (!res.ok) return null

  // Le serveur fait foi désormais : on retire l'image (volumineuse) du localStorage
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...legacy, backgroundImage: null }))
  } catch {
    // le nettoyage peut échouer sans conséquence
  }

  const meta: FondApiMeta = await res.json()
  return {
    image,
    opacity: meta.opacity ?? 0.5,
    scale: meta.scale ?? 0.1,
    offsetX: meta.offsetX ?? 0,
    offsetY: meta.offsetY ?? 0,
    rotation: meta.rotation ?? 0,
    contour: null,
    parcelleKey: meta.parcelleKey ?? cibleParcelle,
    source: cibleParcelle === "global" ? "global" : "parcelle",
  }
}

/**
 * Migration one-shot des anciens fonds localStorage vers le serveur : la clé
 * par parcelle (captures satellite de la cartographie) est prioritaire, puis
 * la clé globale (image importée via /parametres).
 */
async function migrerFondLegacy(parcelleKey: string): Promise<FondPlanState | null> {
  if (parcelleKey !== "global") {
    const migre = await migrerDepuisStorage(`${SETTINGS_KEY}_parcelle_${parcelleKey}`, parcelleKey)
    if (migre) return migre
  }
  return migrerDepuisStorage(SETTINGS_KEY, "global")
}

export function useFondPlan(parcelleId?: string | null) {
  // "none" (éléments non assignés) et "all"/null partagent le fond global
  const parcelleKey = parcelleId && parcelleId !== "none" ? parcelleId : "global"
  const [fond, setFond] = React.useState<FondPlanState | null>(null)
  const [loading, setLoading] = React.useState(true)
  const patchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = React.useRef<{ parcelle: string; reglages: FondReglagesPartiels } | null>(null)

  const envoyerPatch = React.useCallback(() => {
    const patch = pendingPatch.current
    pendingPatch.current = null
    if (!patch) return
    fetch("/api/jardin/fond", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcelle: patch.parcelle, ...patch.reglages }),
    }).catch(() => {
      // hors-ligne : les réglages restent appliqués localement pour la session
    })
  }, [])

  const recharger = React.useCallback(async () => {
    setLoading(true)
    try {
      let state = await chargerDepuisApi(parcelleKey)
      if (!state) state = await migrerFondLegacy(parcelleKey)
      setFond(state)
    } catch {
      setFond(null)
    } finally {
      setLoading(false)
    }
  }, [parcelleKey])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        let state = await chargerDepuisApi(parcelleKey)
        if (!state) state = await migrerFondLegacy(parcelleKey)
        if (!cancelled) setFond(state)
      } catch {
        if (!cancelled) setFond(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [parcelleKey])

  // Envoi du PATCH en attente si l'on quitte la page pendant le debounce
  React.useEffect(() => {
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current)
      envoyerPatch()
    }
  }, [envoyerPatch])

  /** Mise à jour optimiste des réglages + PATCH serveur débouncé. */
  const majReglages = React.useCallback(
    (reglages: FondReglagesPartiels) => {
      setFond(prev => {
        if (!prev) return prev
        pendingPatch.current = {
          parcelle: prev.parcelleKey,
          reglages: { ...pendingPatch.current?.reglages, ...reglages },
        }
        return { ...prev, ...reglages }
      })
      if (patchTimer.current) clearTimeout(patchTimer.current)
      patchTimer.current = setTimeout(envoyerPatch, 600)
    },
    [envoyerPatch]
  )

  /**
   * Téléverse une nouvelle image. Si une parcelle est sélectionnée, le fond
   * devient propre à cette parcelle ; sinon il est global. Les réglages du
   * fond affiché sont conservés (l'image remplace souvent une capture de la
   * même zone).
   */
  const televerserImage = React.useCallback(
    async (file: File): Promise<{ ok: boolean; erreur?: string }> => {
      if (!file.type.startsWith("image/")) {
        return { ok: false, erreur: "Veuillez sélectionner un fichier image (JPG, PNG, WebP)" }
      }
      if (file.size > 10 * 1024 * 1024) {
        return { ok: false, erreur: "Image trop volumineuse (max 10 Mo)" }
      }
      const formData = new FormData()
      formData.append("parcelle", parcelleKey)
      formData.append("file", file)
      if (fond) {
        formData.append("opacity", String(fond.opacity))
        formData.append("scale", String(fond.scale))
        formData.append("offsetX", String(fond.offsetX))
        formData.append("offsetY", String(fond.offsetY))
        formData.append("rotation", String(fond.rotation))
      }
      const res = await fetch("/api/jardin/fond", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        return { ok: false, erreur: err?.error || "Téléversement impossible" }
      }
      const meta: FondApiMeta = await res.json()
      const image = await blobToDataUrl(file)
      setFond({
        image,
        opacity: meta.opacity ?? 0.5,
        scale: meta.scale ?? 0.1,
        offsetX: meta.offsetX ?? 0,
        offsetY: meta.offsetY ?? 0,
        rotation: meta.rotation ?? 0,
        contour: meta.contour ?? null,
        parcelleKey: meta.parcelleKey ?? parcelleKey,
        source: meta.source ?? "parcelle",
      })
      return { ok: true }
    },
    [parcelleKey, fond]
  )

  /** Supprime le fond actuellement affiché (celui de la parcelle OU le global). */
  const supprimerImage = React.useCallback(async (): Promise<boolean> => {
    if (!fond) return true
    const res = await fetch(`/api/jardin/fond?parcelle=${encodeURIComponent(fond.parcelleKey)}`, {
      method: "DELETE",
    })
    if (!res.ok) return false
    // Une parcelle qui affichait son propre fond peut retomber sur le global
    await recharger()
    return true
  }, [fond, recharger])

  return { fond, loading, majReglages, televerserImage, supprimerImage, recharger }
}
