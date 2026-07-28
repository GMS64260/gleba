export const PLANCHER_CASCADE_LAIT_J = 7
export const PLANCHER_CASCADE_VIANDE_J = 28

export type EspecePourDelai = {
  id: string
  nom?: string | null
  categorieReglementaire?: string | null
}

export type ProduitPourDelai = {
  tempsAttenteLaitJ: number
  tempsAttenteViandeJ: number
  especesCibles: readonly string[]
  delaisParEspece?: readonly {
    especeAnimaleId: string
    tempsAttenteLaitJ: number
    tempsAttenteViandeJ: number
    couvertAmm: boolean
  }[]
}

const normaliser = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

export function codesEspeceVeterinaire(espece: EspecePourDelai): string[] {
  const id = normaliser(espece.id)
  const nom = normaliser(espece.nom)
  const categorie = normaliser(espece.categorieReglementaire)
  const codes = new Set<string>([id, categorie])
  const haystack = `${id} ${nom} ${categorie}`
  if (/chevre|caprin/.test(haystack)) codes.add("caprin")
  if (/brebis|mouton|ovin/.test(haystack)) codes.add("ovin")
  if (/vache|bovin/.test(haystack)) codes.add("bovin")
  if (/truie|porc|cochon|porcin/.test(haystack)) codes.add("porcin")
  if (/poule|poulet|canard|oie|dinde|volaille/.test(haystack)) codes.add("volaille")
  if (/cheval|jument|ane|poney|equin/.test(haystack)) codes.add("equin")
  if (/chien/.test(haystack)) codes.add("chien")
  if (/chat/.test(haystack)) codes.add("chat")
  if (/lapin/.test(haystack)) codes.add("lapin")
  return [...codes].filter(Boolean)
}

export function resoudreDelaisVeterinaires(
  produit: ProduitPourDelai,
  espece: EspecePourDelai | null,
): {
  tempsAttenteLaitJ: number
  tempsAttenteViandeJ: number
  source: "referentiel_espece" | "referentiel_produit" | "cascade"
  couvertAmm: boolean
} {
  if (!espece) {
    return {
      tempsAttenteLaitJ: produit.tempsAttenteLaitJ,
      tempsAttenteViandeJ: produit.tempsAttenteViandeJ,
      source: "referentiel_produit",
      couvertAmm: true,
    }
  }

  const ligne = produit.delaisParEspece?.find(
    (item) => item.especeAnimaleId === espece.id,
  )
  if (ligne?.couvertAmm) {
    return {
      tempsAttenteLaitJ: ligne.tempsAttenteLaitJ,
      tempsAttenteViandeJ: ligne.tempsAttenteViandeJ,
      source: "referentiel_espece",
      couvertAmm: true,
    }
  }

  const codes = new Set(codesEspeceVeterinaire(espece))
  const couvertParProduit = produit.especesCibles
    .map(normaliser)
    .some((code) => codes.has(code))
  if (couvertParProduit && !ligne) {
    return {
      tempsAttenteLaitJ: produit.tempsAttenteLaitJ,
      tempsAttenteViandeJ: produit.tempsAttenteViandeJ,
      source: "referentiel_produit",
      couvertAmm: true,
    }
  }

  const baseLait = ligne?.tempsAttenteLaitJ ?? produit.tempsAttenteLaitJ
  const baseViande = ligne?.tempsAttenteViandeJ ?? produit.tempsAttenteViandeJ
  return {
    tempsAttenteLaitJ: Math.max(PLANCHER_CASCADE_LAIT_J, baseLait),
    tempsAttenteViandeJ: Math.max(PLANCHER_CASCADE_VIANDE_J, baseViande),
    source: "cascade",
    couvertAmm: false,
  }
}
