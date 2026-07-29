const LIBELLES_FORESTERIE: Record<string, string> = {
  feuillu: "Feuillu",
  resineux: "Résineux",
  fruitier: "Fruitier",
  petit_fruit: "Petit fruit",
  lente: "Lente",
  moyenne: "Moyenne",
  rapide: "Rapide",
  tres_rapide: "Très rapide",
  bois_oeuvre: "Bois d’œuvre",
  bois_chauffage: "Bois de chauffage",
  biodiversite: "Biodiversité",
  haie_brise_vent: "Haie brise-vent",
  ombre_animaux: "Ombre pour les animaux",
  fruit: "Fruit",
  miel: "Miel",
  brf: "BRF",
}

export function libelleForesterie(valeur: string): string {
  const cle = valeur.trim().toLocaleLowerCase("fr-FR")
  if (LIBELLES_FORESTERIE[cle]) return LIBELLES_FORESTERIE[cle]

  const lisible = valeur.replace(/_/g, " ").trim()
  return lisible
    ? lisible.charAt(0).toLocaleUpperCase("fr-FR") + lisible.slice(1)
    : valeur
}
