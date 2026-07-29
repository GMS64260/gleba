/**
 * Source de vérité des cibles de traite.
 *
 * Une collecte individuelle ne peut viser qu'une femelle d'une espèce ou
 * orientation laitière. Un lot doit lui aussi appartenir à un profil
 * laitier/mixte. Le contrôle est rejoué côté API : masquer une ligne dans
 * l'interface ne suffit pas à protéger les données.
 */
type EspeceLaitiere = {
  nom?: string | null
  production?: string | null
  productions?: readonly string[] | null
}

type CibleAnimalLait = {
  sexe?: string | null
  orientationProduction?: string | null
  especeAnimale?: EspeceLaitiere | null
}

type CibleLotLait = {
  especeAnimale?: EspeceLaitiere | null
}

function normaliser(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

export function estProductionLaitiere(
  espece: EspeceLaitiere | null | undefined,
  orientation?: string | null,
): boolean {
  const productionsProfil = [
    espece?.production,
    ...(espece?.productions ?? []),
  ].map(normaliser)
  // Une orientation individuelle ne peut pas transformer un profil
  // explicitement avicole/compagnie en animal laitier. C'était le cas d'une
  // poule saisie « mixte », ensuite proposée par défaut dans la traite.
  if (productionsProfil.some((value) => value === "lait" || value === "mixte")) {
    return true
  }
  if (productionsProfil.some((value) => value === "oeufs" || value === "compagnie")) {
    return false
  }
  const valeurs = [orientation, ...productionsProfil].map(normaliser)
  return valeurs.some((value) => value === "lait" || value === "mixte")
}

export function estAnimalCollectableLait(animal: CibleAnimalLait): boolean {
  return normaliser(animal.sexe) === "femelle"
    && estProductionLaitiere(animal.especeAnimale, animal.orientationProduction)
}

export function estLotCollectableLait(lot: CibleLotLait): boolean {
  return estProductionLaitiere(lot.especeAnimale)
}

/**
 * Plafond indicatif par traite individuelle. Il protège surtout les fautes de
 * frappe au téléphone ; le dépassement reste possible après confirmation.
 */
export function plafondCollecteLait(
  especeNom: string | null | undefined,
  cible: "animal" | "lot",
  effectif = 1,
): number {
  const nom = normaliser(especeNom)
  let litresParAnimal = 15
  if (nom.includes("chevre") || nom.includes("caprin")) litresParAnimal = 8
  else if (nom.includes("brebis") || nom.includes("ovin")) litresParAnimal = 5
  else if (nom.includes("vache") || nom.includes("bovin")) litresParAnimal = 30
  else if (nom.includes("jument") || nom.includes("cheval") || nom.includes("equin")) litresParAnimal = 12
  return litresParAnimal * (cible === "lot" ? Math.max(1, effectif) : 1)
}

export function listerCiblesCollecteLait<
  TAnimal extends CibleAnimalLait,
  TLot extends CibleLotLait,
>(
  animaux: readonly TAnimal[] | null | undefined,
  lots: readonly TLot[] | null | undefined,
): { animaux: TAnimal[]; lots: TLot[] } {
  return {
    animaux: animaux ? animaux.filter(estAnimalCollectableLait) : [],
    lots: lots ? lots.filter(estLotCollectableLait) : [],
  }
}
