const MOTS_ACCENTUES: Record<string, string> = {
  ete: "été",
  precoce: "précoce",
  precoces: "précoces",
  pepiniere: "pépinière",
  exterieur: "extérieur",
  interieur: "intérieur",
}

/**
 * Transforme un identifiant technique d'ITP en libellé lisible sans modifier
 * sa clé persistée (ex. `Radis-ete-serre` → `Radis · été · serre`).
 */
export function libelleItp(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((mot, index) => {
      const normalise = mot
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
      const lisible = MOTS_ACCENTUES[normalise] ?? mot.toLowerCase()
      return index === 0
        ? lisible.charAt(0).toLocaleUpperCase("fr-FR") + lisible.slice(1)
        : lisible
    })
    .join(" · ")
}
