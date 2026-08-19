/**
 * Références réglementaires phytosanitaires — source unique.
 *
 * QA cmsw9ba0q (2026-08-16) — l'application citait l'arrêté du 16/06/2009
 * (abrogé) et affirmait « pas de précipitations dans les 24h », règle qui
 * n'existe pas. Le texte en vigueur est l'arrêté du 4 mai 2017 modifié
 * (notamment par l'arrêté du 27/12/2019) : vent ≤ force 3 Beaufort et
 * intensité des précipitations ≤ 8 mm/h au moment du traitement.
 * La chaîne était dupliquée dans 8 fichiers, d'où la dérive : toute mention
 * réglementaire phyto doit venir d'ici.
 *
 * Le champ « Pluie ±24h » reste utile en TRAÇABILITÉ (lessivage, DAR) mais ne
 * doit plus être présenté comme une contrainte réglementaire.
 */

export const ARRETE_PHYTO = "arrêté du 4 mai 2017 modifié"

export const CONDITIONS_APPLICATION_PHYTO =
  `Conditions d'application (${ARRETE_PHYTO}) : vent ≤ force 3 Beaufort (≈ 19 km/h) ` +
  `et précipitations ≤ 8 mm/h au moment du traitement.`
