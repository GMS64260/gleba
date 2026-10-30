import type { JourLunaire, TypeJour } from "@/lib/lunar"

export type { JourLunaire, TypeJour }

/** Le calendrier complet vit sur la page Météo depuis le 2026-10-12. */
export const ANCRE_CALENDRIER_LUNAIRE = "calendrier-lunaire"
export const LIEN_CALENDRIER_LUNAIRE = `/meteo#${ANCRE_CALENDRIER_LUNAIRE}`

/**
 * Lune croissante (éclairée à droite) tant que la pleine lune vraie n'est pas
 * passée. Lu sur le jour calculé par `phaseVraieDuJour`, jamais recalculé ici :
 * l'ancien seuil d'âge (demi-lunaison moyenne, 14,77 j) disait « décroissante »
 * le 25/10/2026, veille de la pleine lune (QA cmvno0s5d).
 */
export function estCroissante(jour: Pick<JourLunaire, "croissante">): boolean {
  return jour.croissante
}

/**
 * Début de la ligne de détail de la carte : le sens de la Lune, sauf les jours
 * de nouvelle et de pleine lune. Ces jours-là, le sens lu à midi contredirait
 * le nom (« Pleine Lune · Lune décroissante » quand la pleine lune a eu lieu
 * le matin) : on donne l'heure de l'événement, « Pleine Lune à 05:12 ».
 * `timeZone` absent : fuseau du navigateur.
 */
export function libelleSensDuJour(
  jour: Pick<JourLunaire, "phase" | "phaseIndex" | "croissante" | "instantEvenement">,
  timeZone?: string,
): string {
  if ((jour.phaseIndex === 0 || jour.phaseIndex === 4) && jour.instantEvenement) {
    const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(
      new Date(jour.instantEvenement),
    )
    return `${jour.phase} à ${heure}`
  }
  return `Lune ${jour.croissante ? "croissante" : "décroissante"}`
}

export const TYPE_JOUR_CFG: Record<TypeJour, { label: string; emoji: string; bg: string; text: string }> = {
  feuille: { label: "Feuille", emoji: "🍃", bg: "bg-green-100", text: "text-green-700" },
  fruit: { label: "Fruit", emoji: "🍅", bg: "bg-orange-100", text: "text-orange-700" },
  racine: { label: "Racine", emoji: "🌱", bg: "bg-amber-100", text: "text-amber-800" },
  fleur: { label: "Fleur", emoji: "🌸", bg: "bg-pink-100", text: "text-pink-700" },
  repos: { label: "Repos", emoji: "⏸️", bg: "bg-slate-100", text: "text-slate-500" },
}

export function configTypeJour(type: string) {
  return TYPE_JOUR_CFG[type as TypeJour] ?? TYPE_JOUR_CFG.repos
}

/**
 * Fuseau IANA du navigateur, transmis à `/api/lunaire` (`tz`) : sans lui, le
 * serveur découpait les jours au sien (Europe/Paris) et un lecteur des
 * Antilles recevait le lendemain de Paris (revue du 2026-10-28).
 */
export function fuseauDuLecteur(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/** Paramètre `&tz=…` des requêtes `/api/lunaire`, vide si le navigateur ne le dit pas. */
export function parametreFuseau(): string {
  const fuseau = fuseauDuLecteur()
  return fuseau ? `&tz=${encodeURIComponent(fuseau)}` : ""
}

/**
 * Lecture du jour partagée entre les instances d'une même page (petite lune
 * de l'accueil, en-tête, calendrier) : une seule requête par jour civil et
 * par fuseau du lecteur, qui les transmet tous deux au serveur.
 */
let lectureDuJour: { cle: string; promesse: Promise<JourLunaire | null> } | null = null

export function lireJourLunaire(jour: string): Promise<JourLunaire | null> {
  const fuseau = parametreFuseau()
  const cle = `${jour}${fuseau}`
  if (lectureDuJour?.cle !== cle) {
    const promesse = fetch(`/api/lunaire?today=1&jour=${encodeURIComponent(jour)}${fuseau}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => (json?.jour?.date === jour ? (json.jour as JourLunaire) : null))
      .catch(() => null)
    lectureDuJour = { cle, promesse }
    // Un échec ne se mémorise pas : la prochaine instance retente.
    promesse.then((j) => {
      if (j === null && lectureDuJour?.promesse === promesse) lectureDuJour = null
    })
  }
  return lectureDuJour.promesse
}
