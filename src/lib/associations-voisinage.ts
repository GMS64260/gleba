/**
 * Voisinage des cultures prévues (écran « Associations » de la planification).
 *
 * Fonctions pures : géométrie des planches telle que le plan du jardin les
 * dessine, chevauchement des périodes d'occupation, assemblage des lignes.
 * `getAssociations` (planification) ne fait plus que charger les données.
 */

import {
  evaluerAssociations,
  type AlerteAssociation,
  type AssociationEvaluable,
  type ContexteEspeces,
} from "./associations-alertes"
import type { AssociationCulture } from "./planification"

export type PlancheGeo = {
  id: string
  nom: string | null
  planchesInfluencees?: string | null
  posX: number | null
  posY: number | null
  largeur: number | null
  longueur: number | null
  rotation2D?: number | null
}

export type CultureVoisinage = {
  /** NOM de la planche (convention de la planification). */
  plancheId: string
  ilot: string | null
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  /** Durée de la récolte en semaines d'après l'itinéraire ; `null` si inconnue. */
  semainesRecolte: number | null
}

export const SEUIL_VOISINAGE_M = 2

type Point = { x: number; y: number }

/**
 * Coins de la planche, comme le plan la dessine (`GardenView`) : rectangle
 * posé en (posX, posY), tourné de `rotation2D` degrés autour de son CENTRE,
 * 0,8 × 2 m quand une dimension manque. Ignorer la rotation rendait voisines
 * sur 20 m des planches tournées à 90° ; une dimension nulle n'avait aucune
 * voisine. `null` sans position.
 */
export function coinsPlanche(p: PlancheGeo): Point[] | null {
  if (p.posX == null || p.posY == null) return null
  const w = p.largeur && p.largeur > 0 ? p.largeur : 0.8
  const l = p.longueur && p.longueur > 0 ? p.longueur : 2
  const cx = p.posX + w / 2
  const cy = p.posY + l / 2
  const angle = ((p.rotation2D ?? 0) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    [-w / 2, -l / 2],
    [w / 2, -l / 2],
    [w / 2, l / 2],
    [-w / 2, l / 2],
  ].map(([dx, dy]) => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }))
}

function distancePointSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const norme = dx * dx + dy * dy
  const t = norme === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / norme))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Les deux polygones convexes se recouvrent-ils ? (axes séparateurs) */
function seRecouvrent(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const axe = { x: -(q.y - p.y), y: q.x - p.x }
      const projeter = (pts: Point[]) => pts.map((s) => s.x * axe.x + s.y * axe.y)
      const pa = projeter(a)
      const pb = projeter(b)
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false
    }
  }
  return true
}

/** Distance entre deux planches (0 si elles se touchent ou se recouvrent). */
export function distancePlanches(a: Point[], b: Point[]): number {
  if (seRecouvrent(a, b)) return 0
  let min = Infinity
  for (const [poly, autre] of [
    [a, b],
    [b, a],
  ]) {
    for (const p of poly) {
      for (let i = 0; i < autre.length; i++) {
        min = Math.min(min, distancePointSegment(p, autre[i], autre[(i + 1) % autre.length]))
      }
    }
  }
  return min
}

/**
 * Semaines d'occupation [début, fin] d'une culture prévue : de la plantation
 * (ou du semis direct) à la fin de la récolte. Une récolte dont la semaine
 * précède le début déborde sur l'année suivante. `null` quand une borne manque.
 */
export function periodeOccupation(c: CultureVoisinage): [number, number] | null {
  const debut = c.semainePlantation ?? c.semaineSemis
  if (debut == null || c.semaineRecolte == null || c.semainesRecolte == null) return null
  const recolte = c.semaineRecolte >= debut ? c.semaineRecolte : c.semaineRecolte + 52
  return [debut, recolte + c.semainesRecolte]
}

/**
 * Deux cultures sont-elles sur le terrain en même temps ? `null` quand une des
 * périodes est inconnue : l'appelant choisit la prudence.
 */
export function cohabitent(a: CultureVoisinage, b: CultureVoisinage): boolean | null {
  const pa = periodeOccupation(a)
  const pb = periodeOccupation(b)
  if (!pa || !pb) return null
  return pa[0] <= pb[1] && pb[0] <= pa[1]
}

/**
 * Lignes de l'écran : pour chaque culture prévue, ses planches voisines et les
 * cultures qui cohabitent avec elle.
 *
 * - Voisines : liste `planchesInfluencees` si elle désigne encore des planches
 *   existantes (une liste périmée ne masque plus la géométrie), sinon planches
 *   à `SEUIL_VOISINAGE_M` au plus.
 * - Planche voisine : la culture compte sauf si les périodes sont connues et
 *   disjointes (radis S10-S16 et tomate plantée S20 ne se voient pas).
 * - Même planche : les autres cultures comptent seulement si les périodes
 *   sont connues et se chevauchent — sans dates, une succession passerait
 *   pour une cohabitation.
 *
 * `noms` : nom des espèces par identifiant en minuscules (une espèce
 * personnelle a un identifiant technique).
 */
export function assemblerAssociations(
  cultures: CultureVoisinage[],
  planches: PlancheGeo[],
  alertes: AlerteAssociation[],
  noms: Map<string, string | null | undefined> = new Map()
): AssociationCulture[] {
  const plancheParNom = new Map(planches.filter((p) => p.nom).map((p) => [p.nom as string, p]))
  const culturesParPlanche = new Map<string, CultureVoisinage[]>()
  for (const c of cultures) {
    const liste = culturesParPlanche.get(c.plancheId)
    if (liste) liste.push(c)
    else culturesParPlanche.set(c.plancheId, [c])
  }

  const coins = new Map(planches.map((p) => [p.id, coinsPlanche(p)]))
  const voisinesGeo = new Map<string, string[]>()
  const voisinesDe = (planche: PlancheGeo): string[] => {
    const connues = (planche.planchesInfluencees ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((nom) => nom && nom !== planche.nom && plancheParNom.has(nom))
    if (connues.length > 0) return connues
    const deja = voisinesGeo.get(planche.id)
    if (deja) return deja
    const a = coins.get(planche.id)
    const voisines: string[] = []
    if (a) {
      for (const autre of planches) {
        if (autre.id === planche.id) continue
        const b = coins.get(autre.id)
        if (b && distancePlanches(a, b) <= SEUIL_VOISINAGE_M) voisines.push(autre.nom ?? autre.id)
      }
    }
    voisinesGeo.set(planche.id, voisines)
    return voisines
  }

  const cle = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join("\u0000")
  const alerteParPaire = new Map(alertes.map((a) => [cle(a.especes[0], a.especes[1]), a]))
  const nom = (especeId: string | null) => (especeId ? noms.get(especeId.toLowerCase()) ?? null : null)

  const lignes: AssociationCulture[] = []
  for (const culture of cultures) {
    const planche = plancheParNom.get(culture.plancheId)
    if (!planche) continue
    const planchesVoisines = voisinesDe(planche)

    const evaluer = (cv: CultureVoisinage, memePlanche: boolean) => {
      const alerte =
        culture.especeId && cv.especeId ? alerteParPaire.get(cle(culture.especeId, cv.especeId)) : undefined
      return {
        plancheId: cv.plancheId,
        especeId: cv.especeId,
        especeNom: nom(cv.especeId),
        eval: (alerte?.type ?? "neutre") as "favorable" | "defavorable" | "neutre",
        evalMessage: alerte?.message ?? null,
        ...(memePlanche ? { memePlanche: true } : {}),
      }
    }

    const culturesVoisines = [
      ...(culturesParPlanche.get(culture.plancheId) ?? [])
        .filter((cv) => cv !== culture && cohabitent(culture, cv) === true)
        .map((cv) => evaluer(cv, true)),
      ...planchesVoisines.flatMap((pv) =>
        (culturesParPlanche.get(pv) ?? [])
          .filter((cv) => cohabitent(culture, cv) !== false)
          .map((cv) => evaluer(cv, false))
      ),
    ]

    const aDefavorable = culturesVoisines.some((cv) => cv.eval === "defavorable")
    const aFavorable = culturesVoisines.some((cv) => cv.eval === "favorable")
    lignes.push({
      plancheId: culture.plancheId,
      ilot: culture.ilot,
      cultureEspeceId: culture.especeId,
      cultureEspeceNom: nom(culture.especeId),
      cultureSemaine: culture.semainePlantation || culture.semaineSemis,
      planchesVoisines,
      culturesVoisines,
      scoreAssociation:
        aDefavorable && aFavorable ? "mixte" : aDefavorable ? "defavorable" : aFavorable ? "favorable" : "neutre",
    })
  }
  return lignes
}

/** Espèce d'une culture du plan, telle que le calque des liaisons la connaît. */
export type EspecePlan = { id: string; nom?: string | null; famille?: { id: string } | null }

/**
 * Liaison à tracer entre deux planches du plan : `incompatible` si une paire
 * d'espèces (une de chaque planche) est défavorable, `favorable` si une paire
 * l'est, `null` sinon. Même moteur que les alertes (pivot, alias, précision
 * des règles) : le calque acceptait la famille d'ANNOTATION d'une ligne
 * d'espèce et reliait en rouge tout Alliaceae à tout Asteraceae sous « Ail ! ».
 */
export function liaisonEntrePlanches(
  regles: AssociationEvaluable[],
  especesA: EspecePlan[],
  especesB: EspecePlan[]
): "favorable" | "incompatible" | null {
  const idsA = new Set(especesA.map((e) => e.id.toLowerCase()))
  const idsB = new Set(especesB.map((e) => e.id.toLowerCase()))
  const contexte: ContexteEspeces = new Map(
    [...especesA, ...especesB].map((e) => [e.id.toLowerCase(), { nom: e.nom, familleId: e.famille?.id ?? null }])
  )
  let type: "favorable" | "incompatible" | null = null
  for (const a of evaluerAssociations(regles, [...idsA, ...idsB], contexte)) {
    const [x, y] = a.especes
    // Une espèce de chaque planche (les paires internes à une planche ne tracent rien).
    if (!((idsA.has(x) && idsB.has(y)) || (idsA.has(y) && idsB.has(x)))) continue
    if (a.type === "defavorable") return "incompatible" // l'avertissement prime
    type = "favorable"
  }
  return type
}
