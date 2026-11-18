interface DimensionsPlant {
  espece?: { etalement?: number | null } | null
  espacement?: number | null
  itp?: { espacement?: number | null } | null
}

/** Empreinte 3D en mètres : étalement de l'espèce, puis espacements culture/ITP. */
export function empreintePlantMetres(culture: DimensionsPlant): number {
  const etalementM = culture.espece?.etalement
  if (positifFini(etalementM)) return etalementM

  const espacementCultureCm = culture.espacement
  if (positifFini(espacementCultureCm)) return espacementCultureCm / 100

  const espacementItpCm = culture.itp?.espacement
  if (positifFini(espacementItpCm)) return espacementItpCm / 100

  return 0.3
}

function positifFini(valeur: number | null | undefined): valeur is number {
  return typeof valeur === "number" && Number.isFinite(valeur) && valeur > 0
}
