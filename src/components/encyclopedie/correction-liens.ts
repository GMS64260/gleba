import type { TypeCibleCorrection } from "@/lib/encyclopedie/types"

export function ancreCorrection(type: TypeCibleCorrection, refId: string) {
  return `reference-${type.toLowerCase()}-${refId}`
}

export function urlCorrection(especeId: string, type: TypeCibleCorrection, refId: string, modifier = false) {
  const params = new URLSearchParams({ corriger: type, ref: refId })
  return `/referentiel/vegetaux/${encodeURIComponent(especeId)}${modifier ? `?${params}` : ""}#${encodeURIComponent(ancreCorrection(type, refId))}`
}
