/**
 * Disposition de l'accueil v2 par compte (maquette retenue, livraison L3) :
 * deux listes ordonnées d'identifiants VISIBLES, une pour les repères, une
 * pour les tuiles. Tout ce qui n'y est pas est masqué. Stockée dans les
 * préférences de la PERSONNE (`accueilDisposition`), jamais de l'exploitation :
 * deux associés peuvent avoir deux accueils. Module PUR, testé sans Prisma.
 */

import type { ModuleId } from "@/lib/modules"

export const CLE_PREFERENCE_DISPOSITION = "accueilDisposition"

export const IDS_REPERES = ["repere:cultures", "repere:surface", "repere:recoltes", "repere:tresorerie", "repere:semaine"] as const
export type IdRepere = (typeof IDS_REPERES)[number]

export const IDS_TUILES = ["aujourdhui", "plan", "semaine", "agent", "elevage"] as const
export type IdTuile = (typeof IDS_TUILES)[number]

export interface AccueilDisposition {
  reperes: IdRepere[]
  tuiles: IdTuile[]
}

/** Module qui conditionne une tuile ou un repère ; absent = toujours disponible. */
export const MODULE_DE: Partial<Record<IdRepere | IdTuile, ModuleId>> = {
  "repere:cultures": "maraichage",
  "repere:surface": "maraichage",
  "repere:recoltes": "maraichage",
  "repere:tresorerie": "comptabilite",
  elevage: "elevage",
}

export const LIBELLES: Record<IdRepere | IdTuile, string> = {
  "repere:cultures": "Cultures en place",
  "repere:surface": "Surface cultivée",
  "repere:recoltes": "Récoltes",
  "repere:tresorerie": "Trésorerie",
  "repere:semaine": "Semaine",
  aujourdhui: "Aujourd'hui",
  plan: "Plan de la ferme",
  semaine: "Semaine météo",
  agent: "Gleba",
  elevage: "Élevage",
}

/** Disposition Gleba par défaut : tout, dans l'ordre de la maquette. */
export function dispositionDefaut(): AccueilDisposition {
  return { reperes: [...IDS_REPERES], tuiles: [...IDS_TUILES] }
}

function estIdRepere(v: unknown): v is IdRepere {
  return typeof v === "string" && (IDS_REPERES as readonly string[]).includes(v)
}
function estIdTuile(v: unknown): v is IdTuile {
  return typeof v === "string" && (IDS_TUILES as readonly string[]).includes(v)
}

function dedoublonner<T>(liste: T[]): T[] {
  return liste.filter((v, i) => liste.indexOf(v) === i)
}

/**
 * Nettoyage d'une préférence lue : identifiants inconnus ignorés, doublons
 * retirés, listes manquantes remises par défaut. Une liste vide est permise
 * (« de cinq repères à trois ou à zéro »).
 */
export function sanitizeAccueilDisposition(input: unknown): AccueilDisposition {
  const defaut = dispositionDefaut()
  if (!input || typeof input !== "object") return defaut
  const o = input as { reperes?: unknown; tuiles?: unknown }
  return {
    reperes: Array.isArray(o.reperes) ? dedoublonner(o.reperes.filter(estIdRepere)) : defaut.reperes,
    tuiles: Array.isArray(o.tuiles) ? dedoublonner(o.tuiles.filter(estIdTuile)) : defaut.tuiles,
  }
}

/** Ce qui s'affiche : la disposition, moins ce qu'un module désactivé retire, sans réécrire la préférence. */
export function visiblesSelonModules<T extends IdRepere | IdTuile>(ids: readonly T[], modules: readonly ModuleId[]): T[] {
  return ids.filter((id) => {
    const moduleRequis = MODULE_DE[id]
    return !moduleRequis || modules.includes(moduleRequis)
  })
}

/** Ce qui est masqué et peut être remis (hors modules désactivés). */
export function masques<T extends IdRepere | IdTuile>(tous: readonly T[], visibles: readonly T[], modules: readonly ModuleId[]): T[] {
  return visiblesSelonModules(
    tous.filter((id) => !visibles.includes(id)),
    modules,
  )
}

export function deplacer<T>(liste: readonly T[], id: T, sens: -1 | 1): T[] {
  const i = liste.indexOf(id)
  if (i < 0) return [...liste]
  const j = i + sens
  if (j < 0 || j >= liste.length) return [...liste]
  const copie = [...liste]
  ;[copie[i], copie[j]] = [copie[j], copie[i]]
  return copie
}

export function retirer<T>(liste: readonly T[], id: T): T[] {
  return liste.filter((v) => v !== id)
}

/** Remet un élément à sa place d'origine (ordre de la maquette), ou à la fin. */
export function remettre<T>(liste: readonly T[], id: T, ordreReference: readonly T[]): T[] {
  if (liste.includes(id)) return [...liste]
  const copie = [...liste]
  const rangCible = ordreReference.indexOf(id)
  const position = copie.findIndex((v) => ordreReference.indexOf(v) > rangCible)
  if (position < 0) copie.push(id)
  else copie.splice(position, 0, id)
  return copie
}

export function memeDisposition(a: AccueilDisposition, b: AccueilDisposition): boolean {
  return a.reperes.join("|") === b.reperes.join("|") && a.tuiles.join("|") === b.tuiles.join("|")
}
