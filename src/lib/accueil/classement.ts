/**
 * Classement par urgence de la tuile Aujourd'hui (accueil v2) et petits
 * libellés partagés. Fonctions PURES, testées sans Prisma.
 */

import type { EtatRegistre } from "@/components/accueil/PastilleEtat"

/** Rang d'affichage : le critique en tête, le neutre en queue. */
export const RANG_ETAT: Record<EtatRegistre, number> = {
  critique: 0,
  attention: 1,
  info: 2,
  ok: 3,
  neutre: 4,
}

/**
 * Trie : état (critique → neutre), puis retard décroissant, puis titre.
 * Ne modifie pas le tableau reçu.
 */
export function classerParUrgence<T extends { etat: EtatRegistre; retardJours: number; titre: string }>(
  elements: readonly T[],
): T[] {
  return [...elements].sort(
    (a, b) =>
      RANG_ETAT[a.etat] - RANG_ETAT[b.etat] ||
      b.retardJours - a.retardJours ||
      a.titre.localeCompare(b.titre, "fr"),
  )
}

/**
 * État d'une tâche datée : à venir ou du jour → info, en retard → attention,
 * en retard au-delà de `critiqueApres` jours → critique.
 */
export function etatPourRetard(retardJours: number, options: { critiqueApres?: number } = {}): EtatRegistre {
  const critiqueApres = options.critiqueApres ?? 7
  if (retardJours > critiqueApres) return "critique"
  if (retardJours > 0) return "attention"
  return "info"
}

/** « en retard de 3 j », « aujourd'hui », « dans 2 j ». */
export function libelleRetard(retardJours: number): string {
  if (retardJours > 0) return `en retard de ${retardJours} j`
  if (retardJours < 0) return `dans ${-retardJours} j`
  return "aujourd'hui"
}

/** « C1, C2, C3 », ou « C1, C2 et 4 autres » au-delà de `max` noms. */
export function listerNoms(noms: readonly string[], max = 3): string {
  const uniques = Array.from(new Set(noms.filter((n) => n.trim() !== "")))
  if (uniques.length <= max) return uniques.join(", ")
  const reste = uniques.length - (max - 1)
  return `${uniques.slice(0, max - 1).join(", ")} et ${reste} autres`
}

/** Sous-titre de la tuile : « 6 choses · classées par urgence ». */
export function sousTitreAujourdhui(nombre: number): string {
  if (nombre <= 0) return "Rien d'urgent"
  if (nombre === 1) return "1 chose à faire"
  return `${nombre} choses · classées par urgence`
}

/** Nombre entier en français (« 11 666 »). */
export function formatNombre(valeur: number, decimales = 0): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimales }).format(valeur)
}

/** Jour civil local AAAA-MM-JJ d'une date (jamais `toISOString`, qui est en UTC). */
export function jourLocalISO(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const j = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${m}-${j}`
}

/**
 * Date d'un jour civil AAAA-MM-JJ ancrée à MIDI local : `new Date("AAAA-MM-JJ")`
 * vaut minuit UTC et rend un jour de semaine faux à l'ouest d'UTC.
 */
export function dateMidiLocal(jourIso: string): Date {
  const [a, m, j] = jourIso.slice(0, 10).split("-").map(Number)
  return new Date(a, (m || 1) - 1, j || 1, 12)
}

/** Lundi (00:00 local) et dimanche (23:59:59.999 local) de la semaine ISO d'une date. */
export function bornesSemaineISO(date: Date): { debut: Date; fin: Date } {
  const debut = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const decalage = (debut.getDay() + 6) % 7 // lundi = 0
  debut.setDate(debut.getDate() - decalage)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + 6)
  fin.setHours(23, 59, 59, 999)
  return { debut, fin }
}
