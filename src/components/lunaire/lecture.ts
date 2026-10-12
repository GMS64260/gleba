import type { JourLunaire, TypeJour } from "@/lib/lunar"

export type { JourLunaire, TypeJour }

/** Le calendrier complet vit sur la page Météo depuis le 2026-10-12. */
export const ANCRE_CALENDRIER_LUNAIRE = "calendrier-lunaire"
export const LIEN_CALENDRIER_LUNAIRE = `/meteo#${ANCRE_CALENDRIER_LUNAIRE}`

/** Demi-lunaison : avant, la Lune croît (éclairée à droite) ; après, elle décroît. */
const DEMI_LUNAISON = 29.53059 / 2

export function estCroissante(jour: Pick<JourLunaire, "age">): boolean {
  return jour.age < DEMI_LUNAISON
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
 * Lecture du jour partagée entre les instances d'une même page (petite lune
 * de l'accueil, en-tête, calendrier) : une seule requête par jour civil.
 */
let lectureDuJour: { jour: string; promesse: Promise<JourLunaire | null> } | null = null

export function lireJourLunaire(jour: string): Promise<JourLunaire | null> {
  if (lectureDuJour?.jour !== jour) {
    const promesse = fetch("/api/lunaire?today=1")
      .then((r) => r.json())
      .then((json) => (json.jour ?? null) as JourLunaire | null)
      .catch(() => null)
    lectureDuJour = { jour, promesse }
    // Un échec ne se mémorise pas : la prochaine instance retente.
    promesse.then((j) => {
      if (j === null && lectureDuJour?.promesse === promesse) lectureDuJour = null
    })
  }
  return lectureDuJour.promesse
}
