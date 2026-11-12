/**
 * Règle unique du délai avant récolte (DAR), partagée par les récoltes de
 * légumes (`src/lib/recolte/dar.ts`), de fruits (`src/lib/verger/dar.ts`) et,
 * à travers elles, par le catalogue et le stock commercial. Module pur.
 *
 * Texte appliqué : arrêté du 4 mai 2017 relatif à la mise sur le marché et à
 * l'utilisation des produits phytopharmaceutiques (JORFTEXT000034603791),
 * article 3, I, en vigueur depuis le 1er janvier 2020 (rédaction issue de
 * l'arrêté du 27 décembre 2019) : « Sauf dispositions contraires prévues par
 * les décisions d'autorisation de mise sur le marché, l'utilisation des
 * produits est interdite pendant les 3 jours précédant la récolte. »
 * https://www.legifrance.gouv.fr/loda/id/JORFTEXT000034603791/
 *
 * Revue réglementaire du 2026-11-12 (constat C5) : un délai absent valait
 * zéro, et la lecture en base écartait ces traitements avant tout calcul. Une
 * récolte le lendemain d'un traitement sans DAR renseigné passait donc sans un
 * mot. Trois cas sont désormais distincts :
 *   - délai connu (saisi sur le traitement, sinon celui du référentiel) :
 *     la récolte est libre le jour « traitement + DAR » ;
 *   - délai connu inférieur au défaut légal (zéro compris) : il n'est valable
 *     que si l'AMM le prévoit pour l'usage. Gleba ne connaît pas l'AMM (le
 *     référentiel est un catalogue générique, pas E-Phy) : il avertit pendant
 *     les 3 jours du défaut légal, sans trancher ;
 *   - délai inconnu : le défaut légal de 3 jours s'applique sauf AMM contraire,
 *     et l'AMM peut imposer davantage. Avertissement fort pendant 3 jours,
 *     rappel ensuite jusqu'à `HORIZON_DAR_INCONNU_JOURS`.
 *
 * Obligation légale : respecter le DAR de l'AMM, et 3 jours à défaut. Choix
 * logiciel : avertir, jamais refuser ; une récolte réellement faite, même trop
 * tôt, s'enregistre toujours (le fait doit rester consignable).
 *
 * Les substances de base et préparations naturelles peu préoccupantes ne
 * relèvent pas d'une AMM : le défaut de l'article 3 ne leur est pas opposé
 * ici ; un délai saisi pour elles reste appliqué.
 */

/** Arrêté du 4 mai 2017, art. 3, I : défaut sauf disposition contraire de l'AMM. */
export const DAR_DEFAUT_LEGAL_JOURS = 3

/**
 * Choix logiciel, pas une obligation : durée après un traitement sans DAR
 * pendant laquelle une récolte rappelle de renseigner le délai de l'AMM.
 * Au-delà, le rappel cesserait d'être lu ; la donnée manquante reste signalée
 * par le registre phyto.
 */
export const HORIZON_DAR_INCONNU_JOURS = 60

export type DarResolu =
  | { etat: 'connu'; jours: number; source: 'saisi' | 'referentiel' }
  | { etat: 'inconnu' }

const valide = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 0

/** Le délai saisi sur le traitement prime ; le référentiel sert à défaut. */
export function resoudreDar(saisi: number | null | undefined, referentiel: number | null | undefined): DarResolu {
  if (valide(saisi)) return { etat: 'connu', jours: saisi, source: 'saisi' }
  if (valide(referentiel)) return { etat: 'connu', jours: referentiel, source: 'referentiel' }
  return { etat: 'inconnu' }
}

export type ApplicationDar = {
  /** Minuit du jour civil du traitement, en millisecondes. */
  jourTraitement: number
  /** Minuit du jour civil de la récolte, même convention. */
  jourRecolte: number
  dar: DarResolu
  produit: string | null
  /** false pour une substance de base ou une PNPP : pas d'AMM, pas de défaut de l'article 3. */
  relevantDUneAmm: boolean
}

export type CalendrierDar = {
  ajouterJours: (jour: number, n: number) => number
  formater: (jour: number) => string
}

const pluriel = (n: number) => `${n} jour${n > 1 ? 's' : ''}`
const REFERENCE = 'arrêté du 4 mai 2017, art. 3, I'

/** Un avertissement, ou null si la récolte n'est pas concernée par ce traitement. */
export function avertissementDar(a: ApplicationDar, cal: CalendrierDar): string | null {
  const { jourTraitement: t, jourRecolte: r } = a
  if (t > r) return null
  const produit = a.produit?.trim() || 'le traitement'
  const recolte = cal.formater(r)
  if (a.dar.etat === 'connu') {
    const { jours, source } = a.dar
    const origine = source === 'saisi' ? 'saisi' : 'du référentiel'
    const fin = cal.ajouterJours(t, jours)
    if (r < fin) {
      return `DAR : récolte du ${recolte} avant la fin du délai ${origine} pour ${produit} (${pluriel(jours)}, jusqu’au ${cal.formater(fin)}). Vérifiez cette récolte avant de la commercialiser.`
    }
    if (a.relevantDUneAmm && jours < DAR_DEFAUT_LEGAL_JOURS && r < cal.ajouterJours(t, DAR_DEFAUT_LEGAL_JOURS)) {
      return `DAR : récolte du ${recolte}, moins de ${DAR_DEFAUT_LEGAL_JOURS} jours après ${produit} (traitement du ${cal.formater(t)}). Le délai ${origine} de ${pluriel(jours)} est inférieur au délai par défaut de ${DAR_DEFAUT_LEGAL_JOURS} jours (${REFERENCE}) : il ne vaut que si l’AMM du produit le prévoit pour cet usage. Vérifiez-la avant de commercialiser.`
    }
    return null
  }
  if (!a.relevantDUneAmm) return null
  const finDefaut = cal.ajouterJours(t, DAR_DEFAUT_LEGAL_JOURS)
  if (r < finDefaut) {
    return `DAR non renseigné pour ${produit} (traitement du ${cal.formater(t)}) : sauf disposition contraire de son AMM, un produit phytopharmaceutique ne s’utilise pas dans les ${DAR_DEFAUT_LEGAL_JOURS} jours précédant la récolte (${REFERENCE}). Récolte du ${recolte}, avant le ${cal.formater(finDefaut)} : renseignez le DAR de l’AMM et vérifiez cette récolte avant de la commercialiser.`
  }
  if (r < cal.ajouterJours(t, HORIZON_DAR_INCONNU_JOURS)) {
    return `DAR non renseigné pour ${produit} (traitement du ${cal.formater(t)}) : le délai par défaut de ${DAR_DEFAUT_LEGAL_JOURS} jours est passé, mais l’AMM peut imposer un délai plus long. Renseignez le DAR du produit pour vérifier la récolte du ${recolte}.`
  }
  return null
}

/** Classifications du référentiel qui ne relèvent pas d'une AMM. */
const SANS_AMM = new Set(['Substance de base / PNPP', 'Biologique (purin/décoction)'])
/** Classifications sans produit appliqué : aucun délai avant récolte. */
const SANS_PRODUIT = new Set(['Mécanique', 'Mécanique/Manuel', 'Prophylaxie'])

/**
 * Nature d'une intervention `traitement_phyto` au regard du DAR. Un geste sans
 * produit (taille sanitaire, désherbage manuel) n'en a pas ; un traitement
 * sans produit nommé ni geste est traité comme un produit inconnu, donc
 * susceptible de relever d'une AMM.
 */
export function natureInterventionDar(i: { produitPhyto: string | null; geste?: string | null; produitPhytoRef: { classification?: string | null } | null }): 'amm' | 'sans_amm' | 'sans_produit' {
  const classification = i.produitPhytoRef?.classification ?? null
  if (classification && SANS_PRODUIT.has(classification)) return 'sans_produit'
  if (classification && SANS_AMM.has(classification)) return 'sans_amm'
  if (!i.produitPhytoRef && !i.produitPhyto?.trim() && i.geste?.trim()) return 'sans_produit'
  return 'amm'
}

const METHODES_SANS_PRODUIT = new Set(['mecanique_manuel', 'mecanique', 'prophylaxie'])
const METHODES_SANS_AMM = new Set(['biologique_purin', 'biologique'])
const METHODES_PRODUIT = new Set(['chimique_conventionnel', 'chimique_cuivre', 'chimique', 'biocontrole'])

/**
 * Nature d'une observation Santé & Phyto du verger. Une observation sans
 * produit, sans AMM et sans méthode de traitement (maladie constatée,
 * vigueur…) n'est pas une application.
 */
export function natureObservationDar(o: { produit: string | null; numAMM?: string | null; methodeTraitement?: string | null }): 'amm' | 'sans_amm' | 'sans_produit' {
  const methode = o.methodeTraitement ?? null
  if (methode && METHODES_SANS_PRODUIT.has(methode)) return 'sans_produit'
  if (methode && METHODES_SANS_AMM.has(methode)) return 'sans_amm'
  if (o.produit?.trim() || o.numAMM?.trim() || (methode && METHODES_PRODUIT.has(methode))) return 'amm'
  return 'sans_produit'
}
