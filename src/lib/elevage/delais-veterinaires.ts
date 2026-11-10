export const PLANCHER_CASCADE_LAIT_J = 7
export const PLANCHER_CASCADE_VIANDE_J = 28
// QA 2026-07-30 — Plancher cascade sur les œufs (usage hors AMM). Aligné sur le
// lait : la tylosine impose 4 j en AMM, un usage hors AMM ne peut pas être plus
// permissif que le délai lait retenu pour les mammifères.
export const PLANCHER_CASCADE_OEUFS_J = 7

export type EspecePourDelai = {
  id: string
  nom?: string | null
  categorieReglementaire?: string | null
}

export type ProduitPourDelai = {
  tempsAttenteLaitJ: number
  tempsAttenteViandeJ: number
  tempsAttenteOeufsJ?: number
  especesCibles: readonly string[]
  delaisParEspece?: readonly {
    especeAnimaleId: string
    tempsAttenteLaitJ: number
    tempsAttenteViandeJ: number
    tempsAttenteOeufsJ?: number
    couvertAmm: boolean
  }[]
}

const normaliser = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

/**
 * Mots qui désignent une espèce cible d'AMM. Ils se cherchent en DÉBUT DE MOT
 * (« brebis », « chevreau », « porcelet »…), jamais au milieu : la recherche
 * par sous-chaîne trouvait « ovin » dans « bovin » et « ane » dans « saanen »,
 * « romane », « manech » ou « cane ». Une vache traitée avec un produit
 * autorisé chez les seuls ovins passait alors pour couverte par l'AMM, et le
 * plancher cascade (7 j lait, 28 j viande) sautait (revue du 2026-11-04).
 */
const MOTS_ESPECE: ReadonlyArray<readonly [code: string, debuts: readonly string[]]> = [
  ["caprin", ["chevre", "caprin"]],
  ["ovin", ["brebis", "mouton", "ovin"]],
  ["bovin", ["vache", "bovin"]],
  ["porcin", ["truie", "porc", "cochon"]],
  ["volaille", ["poule", "poulet", "canard", "oie", "dinde", "pintade", "caille", "volaille"]],
  ["equin", ["cheval", "chevaux", "jument", "ane", "poney", "equin"]],
  ["chien", ["chien"]],
  ["chat", ["chat"]],
  ["lapin", ["lapin"]],
]

export function codesEspeceVeterinaire(espece: EspecePourDelai): string[] {
  const id = normaliser(espece.id)
  const nom = normaliser(espece.nom)
  const categorie = normaliser(espece.categorieReglementaire)
  const codes = new Set<string>([id, categorie])
  // `chevre_saanen`, « Brebis Manech », « Ovin-caprin » : mots séparés.
  const mots = `${id} ${nom} ${categorie}`.split(/[^a-z0-9]+/).filter(Boolean)
  for (const [code, debuts] of MOTS_ESPECE) {
    if (mots.some((mot) => debuts.some((debut) => mot.startsWith(debut)))) codes.add(code)
  }
  return [...codes].filter(Boolean)
}

export function resoudreDelaisVeterinaires(
  produit: ProduitPourDelai,
  espece: EspecePourDelai | null,
): {
  tempsAttenteLaitJ: number
  tempsAttenteViandeJ: number
  tempsAttenteOeufsJ: number
  source: "referentiel_espece" | "referentiel_produit" | "cascade"
  couvertAmm: boolean
} {
  if (!espece) {
    return {
      tempsAttenteLaitJ: produit.tempsAttenteLaitJ,
      tempsAttenteViandeJ: produit.tempsAttenteViandeJ,
      tempsAttenteOeufsJ: produit.tempsAttenteOeufsJ ?? 0,
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
      tempsAttenteOeufsJ: ligne.tempsAttenteOeufsJ ?? 0,
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
      tempsAttenteOeufsJ: produit.tempsAttenteOeufsJ ?? 0,
      source: "referentiel_produit",
      couvertAmm: true,
    }
  }

  const baseLait = ligne?.tempsAttenteLaitJ ?? produit.tempsAttenteLaitJ
  const baseViande = ligne?.tempsAttenteViandeJ ?? produit.tempsAttenteViandeJ
  const baseOeufs = ligne?.tempsAttenteOeufsJ ?? produit.tempsAttenteOeufsJ ?? 0
  return {
    tempsAttenteLaitJ: Math.max(PLANCHER_CASCADE_LAIT_J, baseLait),
    tempsAttenteViandeJ: Math.max(PLANCHER_CASCADE_VIANDE_J, baseViande),
    // Le plancher œufs ne s'applique qu'à un délai œufs déjà renseigné : sinon
    // une chèvre en cascade se verrait attribuer 7 jours de retrait sur des
    // œufs qu'elle ne pond pas — le miroir exact du délai lait sur des
    // pondeuses qu'on corrige ici. Pour une volaille, c'est la route des soins
    // qui reporte le délai lait hérité de l'AMM vers les œufs.
    tempsAttenteOeufsJ: baseOeufs > 0 ? Math.max(PLANCHER_CASCADE_OEUFS_J, baseOeufs) : 0,
    source: "cascade",
    couvertAmm: false,
  }
}
