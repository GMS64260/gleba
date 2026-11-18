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
 *   - délai connu, c'est-à-dire SAISI sur le traitement (le catalogue Gleba
 *     n'est qu'un ordre de grandeur, jamais un délai opposable : voir
 *     `DarResolu`) : la récolte est libre le jour « traitement + DAR » ;
 *   - délai connu inférieur au défaut légal (zéro compris) : il n'est valable
 *     que si l'AMM le prévoit pour l'usage. Gleba ne connaît pas l'AMM (le
 *     référentiel est un catalogue générique, pas E-Phy) : il rappelle de la
 *     vérifier pendant les 3 jours du défaut légal, sans bloquer (l'article 3
 *     réserve expressément les « dispositions contraires » de l'AMM) ;
 *   - délai inconnu : le défaut légal de 3 jours s'applique sauf AMM contraire
 *     (bloquant pendant 3 jours), et l'AMM peut imposer davantage : rappel
 *     informatif ensuite jusqu'à `HORIZON_DAR_INCONNU_JOURS`.
 *
 * Décision de Guillaume du 2026-11-13 : « ce qui est dans le cadre légal ».
 * Le verdict (`verdictDar`) a trois niveaux :
 *   - `bloquant` : la récolte tombe dans un délai que la loi impose (délai de
 *     l'AMM ou de l'approbation renseigné, ou 3 jours par défaut pour un
 *     produit sous AMM sans délai renseigné). Sa MISE EN VENTE est refusée
 *     (boutique, vente par la fiche, bon de livraison, facture, caisse) ;
 *   - `informatif` : rappel sans effet sur la vente (délai inconnu au-delà des
 *     3 jours, substance de base sans délai renseigné, délai déclaré inférieur
 *     à 3 jours) ;
 *   - `rien`.
 * La SAISIE d'une récolte n'est jamais refusée : une récolte réellement
 * faite, même trop tôt, reste un fait de traçabilité à consigner ; elle porte
 * alors l'avertissement. En cas de doute, Gleba ne bloque pas une vente sur un
 * choix que la loi ne prévoit pas : il avertit.
 *
 * Fondement du refus de mise en vente : le délai avant récolte est une
 * condition d'emploi du produit (règlement (CE) 1107/2009, art. 31, § 3, b), et
 * art. 55 ; arrêté du 4 mai 2017, art. 3, I). Une récolte faite avant sa fin
 * n'a pas été produite dans les conditions de l'autorisation ; le producteur
 * répond de la conformité de ce qu'il met sur le marché (règlement (CE)
 * 178/2002, art. 14 et 17 ; limites maximales de résidus, règlement (CE)
 * 396/2005, art. 18). Aucun texte n'énonce « récolte hors délai = vente
 * interdite » en ces termes : c'est l'interprétation retenue par le Lead et
 * soumise à Guillaume (voir preuves/dar-cadre-legal.md du lot).
 *
 * Les substances de base et préparations naturelles peu préoccupantes (PNPP)
 * ne relèvent pas d'une AMM : le défaut de 3 jours de l'article 3 ne leur est
 * jamais opposé. Contre-revue CR-DAR-01 : cela ne les dispense pas pour autant
 * de tout délai. Une substance de base s'emploie dans les conditions de son
 * approbation (règlement (CE) 1107/2009, art. 23 ; le règlement d'approbation
 * de chaque substance renvoie à son rapport d'examen), qui peut fixer un
 * délai avant récolte selon l'usage ; exemple : prêle, règlement d'exécution
 * (UE) 462/2014, annexe I, et rapport SANCO/12386/2013 (15 jours sur tomate
 * et concombre en décoction, aucun sur pommier ou vigne). Quatre cas pour
 * elles :
 *   - geste sans produit (filet, piège, taille) : aucun avertissement ;
 *   - délai saisi : appliqué tel quel, et bloquant pour la vente (c'est une
 *     condition de l'approbation, déclarée par l'exploitant) ;
 *   - délai déclaré nul : « non applicable », aucun avertissement. C'est ainsi
 *     qu'un biostimulant (substance naturelle à usage biostimulant, sans délai
 *     avant récolte) se distingue : la classification « Substance de base /
 *     PNPP » du référentiel confond les deux familles, Gleba ne tranche pas à
 *     la place de l'exploitant ;
 *   - délai inconnu : rappel informatif de vérifier les conditions
 *     d'approbation, pendant `HORIZON_DAR_INCONNU_JOURS`, jamais bloquant :
 *     aucun texte ne fixe de délai générique pour une substance de base. Le
 *     délai du catalogue, s'il existe, est cité dans le rappel comme simple
 *     indication ; un catalogue à 0 jour ne produit aucun rappel.
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

/**
 * `connu` : le délai a été SAISI sur le traitement par l'exploitant, qui l'a
 * lu sur l'étiquette ou la décision d'AMM (ou dans les conditions
 * d'approbation d'une substance de base). Lui seul est opposable.
 * `inconnu` : rien de saisi. `indicatifJours` porte alors, s'il existe,
 * l'ordre de grandeur du catalogue Gleba (`ProduitPhyto.darJours`).
 *
 * Revue QA du lot dar-cadre-legal-blocage (tour 2) : ce catalogue est
 * générique (scripts/seed-produits-phyto.ts : « ordre de grandeur générique,
 * pas le DAR d'une AMM »), il ne connaît ni l'AMM précise ni l'usage. Sa
 * valeur n'est donc jamais un délai opposable : elle ne bloque aucune vente,
 * elle nourrit un rappel. Le seul délai que la loi impose sans l'AMM est le
 * défaut de 3 jours (arrêté du 4 mai 2017, art. 3, I).
 */
export type DarResolu =
  | { etat: 'connu'; jours: number; source: 'saisi' }
  | { etat: 'inconnu'; indicatifJours?: number }

const valide = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 0

/** Le délai saisi sur le traitement est le seul connu ; le catalogue n'est qu'une indication. */
export function resoudreDar(saisi: number | null | undefined, referentiel: number | null | undefined): DarResolu {
  if (valide(saisi)) return { etat: 'connu', jours: saisi, source: 'saisi' }
  return valide(referentiel) ? { etat: 'inconnu', indicatifJours: referentiel } : { etat: 'inconnu' }
}

/**
 * Délai d'une intervention. `darIndicatif` marque les lignes ANCIENNES dont le
 * champ `dar` avait été recopié du catalogue par l'API (avant ce lot, POST
 * /api/interventions écrivait `dar = saisi ?? référentiel`) : leur valeur
 * n'est pas une saisie de l'exploitant, elle reste une indication.
 */
export function darIntervention(i: { dar: number | null; darIndicatif?: boolean | null; produitPhytoRef: { darJours?: number | null } | null }): DarResolu {
  return i.darIndicatif ? resoudreDar(null, i.produitPhytoRef?.darJours ?? i.dar) : resoudreDar(i.dar, i.produitPhytoRef?.darJours)
}

/**
 * Provenance du délai après la correction d'un traitement (contre-revue
 * ADV221). Le formulaire recharge et renvoie le délai d'une ligne ancienne
 * recopiée du catalogue : corriger seulement les notes ne doit pas le rendre
 * opposable. Il devient celui de l'exploitant quand il le CHANGE (autre
 * valeur, ou effacé) ou le CONFIRME expressément (`darConfirme`, même
 * nombre lu sur l'étiquette). Rend la nouvelle valeur de `darIndicatif`.
 */
export function darIndicatifApresCorrection(
  avant: { dar: number | null; darIndicatif: boolean },
  saisie: { darPresent: boolean; dar?: number | null; confirme?: boolean | null },
): boolean {
  if (!avant.darIndicatif || saisie.confirme === true) return false
  if (!saisie.darPresent) return true
  return (saisie.dar ?? null) === avant.dar
}

export type ApplicationDar = {
  /** Minuit du jour civil du traitement, en millisecondes. */
  jourTraitement: number
  /** Minuit du jour civil de la récolte, même convention. */
  jourRecolte: number
  dar: DarResolu
  produit: string | null
  /**
   * `sans_amm` pour une substance de base ou une PNPP : pas d'AMM, pas de
   * défaut de l'article 3, mais des conditions d'approbation à vérifier.
   * `sans_produit` pour un geste (filet, taille) : aucun délai légal ; il ne
   * compte que si l'exploitant y a lui-même saisi un délai, et n'est alors
   * qu'un rappel.
   */
  nature: 'amm' | 'sans_amm' | 'sans_produit'
}

export type CalendrierDar = {
  ajouterJours: (jour: number, n: number) => number
  /** Jour lisible (JJ/MM/AAAA) pour les messages. */
  formater: (jour: number) => string
  /** Jour civil AAAA-MM-JJ pour le détail d'un refus. */
  iso: (jour: number) => string
}

/**
 * D'où vient le délai opposé à la vente : `saisi` sur le traitement par
 * l'exploitant (étiquette, AMM), `defaut_legal` (3 jours de l'arrêté du 4 mai
 * 2017, art. 3, I), `approbation` (délai saisi pour une substance de base,
 * selon ses conditions d'approbation). `amm` reste au contrat mais n'est plus
 * émis : il désignait le délai du catalogue, qui n'est pas celui d'une AMM.
 */
export type OrigineDelaiDar = 'amm' | 'saisi' | 'defaut_legal' | 'approbation'
export type TraitementDarEnCours = { produit: string; dateTraitement: string; finDelai: string; origineDelai: OrigineDelaiDar }
export type VerdictDar =
  | { niveau: 'bloquant'; message: string; traitement: TraitementDarEnCours }
  | { niveau: 'informatif'; message: string }
  | { niveau: 'rien' }

const pluriel = (n: number) => `${n} jour${n > 1 ? 's' : ''}`
const REFERENCE = 'arrêté du 4 mai 2017, art. 3, I'
const RIEN: VerdictDar = { niveau: 'rien' }
const SUITE_BLOCAGE = 'La récolte reste enregistrée, mais elle ne peut pas être mise en vente.'

/**
 * Verdict d'UN traitement sur UNE récolte : la seule règle, appelée par la
 * saisie (qui n'en garde que le message) et par toutes les mises en vente
 * (qui refusent sur `bloquant`).
 */
export function verdictDar(a: ApplicationDar, cal: CalendrierDar): VerdictDar {
  const { jourTraitement: t, jourRecolte: r } = a
  if (t > r) return RIEN
  const produit = a.produit?.trim() || 'le traitement'
  const recolte = cal.formater(r)
  const bloquant = (message: string, fin: number, origineDelai: OrigineDelaiDar): VerdictDar => ({
    niveau: 'bloquant', message,
    traitement: { produit: a.produit?.trim() || 'Traitement sans produit nommé', dateTraitement: cal.iso(t), finDelai: cal.iso(fin), origineDelai },
  })
  if (a.dar.etat === 'connu') {
    const { jours } = a.dar
    const fin = cal.ajouterJours(t, jours)
    if (r < fin) {
      const constat = `DAR : récolte du ${recolte} avant la fin du délai saisi pour ${produit} (${pluriel(jours)} après le traitement du ${cal.formater(t)}, soit jusqu’au ${cal.formater(fin)}).`
      // Geste sans produit : aucun délai légal n'existe ; celui que
      // l'exploitant s'est fixé reste un rappel (pas de blocage hors loi).
      if (a.nature === 'sans_produit') return { niveau: 'informatif', message: `${constat} Vérifiez cette récolte avant de la commercialiser.` }
      // Produit sous AMM : règlement (CE) 1107/2009, art. 55 (respect des
      // conditions de l'autorisation portées sur l'étiquetage) et art. 31,
      // § 3, b) (« le délai à respecter entre la dernière utilisation et la
      // récolte ») ; arrêté du 4 mai 2017,
      // art. 3, I (« dispositions contraires » de l'AMM).
      // http://publications.europa.eu/resource/celex/02009R1107-20260616
      // Substance de base : approuvée selon le règlement (CE) 1107/2009,
      // art. 23, « sous réserve des conditions » de son règlement
      // d'approbation, qui renvoie au rapport d'examen ; exemple prêle,
      // règlement d'exécution (UE) 462/2014, art. 1 et annexe I (rapport
      // SANCO/12386/2013 : 15 jours sur tomate et concombre en décoction).
      // http://publications.europa.eu/resource/celex/32014R0462
      return bloquant(`${constat} ${SUITE_BLOCAGE}`, fin, a.nature === 'sans_amm' ? 'approbation' : 'saisi')
    }
    // Arrêté du 4 mai 2017, art. 3, I : les 3 jours valent « sauf dispositions
    // contraires » de l'AMM. Un délai déclaré plus court est présumé venir de
    // l'AMM, que Gleba ne peut pas vérifier : rappel, pas de blocage.
    if (a.nature === 'amm' && jours < DAR_DEFAUT_LEGAL_JOURS && r < cal.ajouterJours(t, DAR_DEFAUT_LEGAL_JOURS)) {
      return { niveau: 'informatif', message: `DAR : récolte du ${recolte}, moins de ${DAR_DEFAUT_LEGAL_JOURS} jours après ${produit} (traitement du ${cal.formater(t)}). Le délai saisi de ${pluriel(jours)} est inférieur au délai par défaut de ${DAR_DEFAUT_LEGAL_JOURS} jours (${REFERENCE}) : il ne vaut que si l’AMM du produit le prévoit pour cet usage. Vérifiez-la avant de commercialiser.` }
    }
    return RIEN
  }
  // Geste sans produit et sans délai saisi : rien (aucun texte ne s'y applique).
  if (a.nature === 'sans_produit') return RIEN
  // Aucun délai saisi. Le catalogue Gleba peut donner un ordre de grandeur
  // générique : ce n'est ni le délai d'une AMM ni une condition d'approbation
  // (aucun texte ne le rend opposable), il ne bloque donc jamais et ne fait
  // qu'allonger et préciser le rappel.
  const indicatif = a.dar.indicatifJours
  const finRappel = cal.ajouterJours(t, Math.max(HORIZON_DAR_INCONNU_JOURS, indicatif ?? 0))
  const finIndicative = indicatif != null && indicatif > 0 ? cal.ajouterJours(t, indicatif) : null
  if (a.nature === 'sans_amm') {
    // Règlement (CE) 1107/2009, art. 28, § 2, a) : aucune autorisation n'est
    // requise pour un produit ne contenant que des substances de base, et
    // l'art. 23, § 1, d) les définit comme non mises sur le marché en tant
    // que produit phytopharmaceutique : les 3 jours de l'arrêté du 4 mai
    // 2017 (« produits » de l'art. L. 253-1 du code rural) ne leur sont pas
    // opposés, et aucun délai générique n'a été trouvé dans les textes.
    // CR-DAR-01 : le silence laissait croire qu'aucun délai n'existait.
    // Rappel informatif, jamais bloquant. Catalogue à 0 jour (biostimulant,
    // purin) : aucune indication de délai et aucun texte, donc rien.
    if (indicatif === 0 || r >= finRappel) return RIEN
    const indication = finIndicative != null
      ? ` Le catalogue Gleba indique ${pluriel(indicatif!)} à titre indicatif (soit jusqu’au ${cal.formater(finIndicative)}) : c’est un ordre de grandeur, pas les conditions d’approbation pour votre usage.`
      : ''
    return { niveau: 'informatif', message: `DAR : délai inconnu, vérifiez les conditions d’approbation de ${produit} (traitement du ${cal.formater(t)}, récolte du ${recolte}). Une substance de base s’emploie dans les conditions de son approbation, qui peuvent fixer un délai avant récolte selon l’usage.${indication} Renseignez ce délai sur le traitement, ou 0 s’il n’y en a pas (cas d’un biostimulant).` }
  }
  // Arrêté du 4 mai 2017, art. 3, I : « Sauf dispositions contraires prévues
  // par les décisions d'autorisation de mise sur le marché, l'utilisation des
  // produits est interdite pendant les 3 jours précédant la récolte. »
  // https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000039802946
  // Un délai du catalogue, même nul ou plus court, n'est pas une « disposition
  // contraire » de l'AMM : le défaut légal s'applique tant que rien n'est saisi.
  const finDefaut = cal.ajouterJours(t, DAR_DEFAUT_LEGAL_JOURS)
  if (r < finDefaut) {
    return bloquant(`DAR non renseigné pour ${produit} (traitement du ${cal.formater(t)}) : sauf disposition contraire de son AMM, un produit phytopharmaceutique ne s’utilise pas dans les ${DAR_DEFAUT_LEGAL_JOURS} jours précédant la récolte (${REFERENCE}). Récolte du ${recolte}, avant le ${cal.formater(finDefaut)}. ${SUITE_BLOCAGE} Si l’AMM prévoit un délai plus court, renseignez-le sur le traitement.`, finDefaut, 'defaut_legal')
  }
  // Au-delà des 3 jours, plus aucun délai légal connu de Gleba ne s'oppose à
  // la vente : l'AMM peut en imposer un plus long, que seul l'exploitant
  // connaît. Rappel informatif (choix logiciel, borné par l'horizon ou par
  // l'indication du catalogue si elle est plus longue).
  if (r < finRappel) {
    if (finIndicative != null && r < finIndicative) {
      return { niveau: 'informatif', message: `DAR non renseigné pour ${produit} (traitement du ${cal.formater(t)}) : le délai par défaut de ${DAR_DEFAUT_LEGAL_JOURS} jours est passé, mais le catalogue Gleba indique ${pluriel(indicatif!)} à titre indicatif (soit jusqu’au ${cal.formater(finIndicative)}) et la récolte du ${recolte} tombe avant. Ce n’est qu’un ordre de grandeur : le délai qui s’impose est celui de l’AMM, sur l’étiquette du produit. Vérifiez-le et renseignez-le sur le traitement avant de commercialiser.` }
    }
    return { niveau: 'informatif', message: `DAR non renseigné pour ${produit} (traitement du ${cal.formater(t)}) : le délai par défaut de ${DAR_DEFAUT_LEGAL_JOURS} jours est passé, mais l’AMM peut imposer un délai plus long. Renseignez le DAR du produit pour vérifier la récolte du ${recolte}.` }
  }
  return RIEN
}

/** Le message du verdict, ou null : ce que montre la saisie d'une récolte. */
export function avertissementDar(a: ApplicationDar, cal: CalendrierDar): string | null {
  const verdict = verdictDar(a, cal)
  return verdict.niveau === 'rien' ? null : verdict.message
}

/** Verdict d'un lot récolté, tous traitements confondus. */
export type VerdictDarLot = {
  niveau: 'bloquant' | 'informatif' | 'rien'
  /** Tous les messages, bloquants d'abord : affichés à la saisie de la récolte. */
  avertissements: string[]
  /** Messages des seuls traitements qui interdisent la mise en vente. */
  blocages: string[]
  /** Rappels sans effet sur la vente. */
  rappels: string[]
  /** Détail des traitements bloquants, pour le corps du refus. */
  traitements: TraitementDarEnCours[]
}
export const VERDICT_DAR_LOT_RIEN: VerdictDarLot = { niveau: 'rien', avertissements: [], blocages: [], rappels: [], traitements: [] }

export function agregerVerdictsDar(verdicts: VerdictDar[]): VerdictDarLot {
  const blocages: string[] = [], rappels: string[] = [], traitements: TraitementDarEnCours[] = []
  for (const v of verdicts) {
    if (v.niveau === 'bloquant') {
      if (!blocages.includes(v.message)) { blocages.push(v.message); traitements.push(v.traitement) }
    } else if (v.niveau === 'informatif' && !rappels.includes(v.message)) rappels.push(v.message)
  }
  return { niveau: blocages.length ? 'bloquant' : rappels.length ? 'informatif' : 'rien', avertissements: [...blocages, ...rappels], blocages, rappels, traitements }
}

/**
 * Classifications du référentiel qui ne relèvent pas d'une AMM : substances de
 * base et PNPP, biostimulants compris (le référentiel ne les sépare pas).
 */
const SANS_AMM = new Set(['Substance de base / PNPP', 'Biologique (purin/décoction)'])
/** Classifications sans produit appliqué : aucun délai avant récolte. */
const SANS_PRODUIT = new Set(['Mécanique', 'Mécanique/Manuel', 'Prophylaxie'])

/**
 * Nature DÉCLARÉE à la saisie d'un produit qui n'a pas de fiche au référentiel
 * (contre-revue CR-DAR-01, tour 2 : « Décoction de prêle » saisie librement
 * passait pour un produit avec AMM). Jamais déduite du nom libre.
 */
export const NATURES_PRODUIT_DECLAREES = ['amm', 'substance_base', 'biostimulant'] as const
export type NatureProduitDeclaree = (typeof NATURES_PRODUIT_DECLAREES)[number]
export const LIBELLES_NATURE_PRODUIT: Record<NatureProduitDeclaree, string> = {
  amm: 'Produit phytopharmaceutique avec AMM',
  substance_base: 'Substance de base (prêle, vinaigre, lécithine…)',
  biostimulant: 'Biostimulant, sans délai avant récolte (purin d’ortie…)',
}
/** Refus partagé par la création et la correction d'un traitement. */
export const MESSAGE_NATURE_AVEC_AMM =
  'Une substance de base ou un biostimulant n’a pas de numéro d’AMM : retirez le numéro, ou choisissez « Produit phytopharmaceutique avec AMM ».'
export const natureContreditAmm = (nature: string | null | undefined, numAMM: string | null | undefined): boolean =>
  (nature === 'substance_base' || nature === 'biostimulant') && !!numAMM?.trim()

/**
 * Nature d'une intervention `traitement_phyto` au regard du DAR, par ordre de
 * confiance : la classification du référentiel ; à défaut la nature déclarée
 * à la saisie (sauf si un numéro d'AMM la contredit) ; à défaut un geste sans
 * produit (taille sanitaire, désherbage manuel). Un biostimulant déclaré n'est
 * pas un produit phytopharmaceutique : aucun délai ne s'applique, sauf délai
 * saisi. Tout le reste (produit sans nature, sans nom ni geste) est traité
 * comme un produit inconnu, donc susceptible de relever d'une AMM.
 */
export function natureInterventionDar(i: {
  produitPhyto: string | null
  geste?: string | null
  natureProduit?: string | null
  numAMM?: string | null
  produitPhytoRef: { classification?: string | null } | null
}): 'amm' | 'sans_amm' | 'sans_produit' {
  const classification = i.produitPhytoRef?.classification ?? null
  if (classification && SANS_PRODUIT.has(classification)) return 'sans_produit'
  if (classification && SANS_AMM.has(classification)) return 'sans_amm'
  if (i.produitPhytoRef) return 'amm'
  if (!i.numAMM?.trim()) {
    if (i.natureProduit === 'substance_base') return 'sans_amm'
    if (i.natureProduit === 'biostimulant') return 'sans_produit'
  }
  if (!i.produitPhyto?.trim() && !i.natureProduit && i.geste?.trim()) return 'sans_produit'
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

/**
 * Nature d'une opération d'arbre `traitement` réalisée (Verger > Opérations,
 * `OperationArbre`). Revues QA et adverse du tour 2 : cette source figurait au
 * registre phyto mais pas au contrôle du délai. Même ordre que les
 * interventions : la nature déclarée, sinon un produit inconnu, donc
 * susceptible de relever d'une AMM (défaut légal de 3 jours).
 */
export function natureOperationDar(o: { natureProduit?: string | null }): 'amm' | 'sans_amm' | 'sans_produit' {
  if (o.natureProduit === 'substance_base') return 'sans_amm'
  if (o.natureProduit === 'biostimulant') return 'sans_produit'
  return 'amm'
}

/**
 * Délai et nature déclarés d'une opération d'arbre, lus du corps d'une
 * requête. Une clé absente n'est pas touchée (`undefined`) ; vide ou null
 * efface ; zéro reste zéro (« aucun délai », à vérifier sur l'étiquette).
 */
export function lireDelaiEtNatureDeclares(corps: { dar?: unknown; natureProduit?: unknown }):
  { dar: number | null | undefined; natureProduit: NatureProduitDeclaree | null | undefined } | { refus: string; champ: 'dar' | 'natureProduit' } {
  let dar: number | null | undefined
  if (corps.dar !== undefined) {
    if (corps.dar === null || corps.dar === '') dar = null
    else {
      const n = typeof corps.dar === 'number' ? corps.dar : typeof corps.dar === 'string' && corps.dar.trim() !== '' ? Number(corps.dar) : NaN
      if (!Number.isInteger(n) || n < 0 || n > 3650) return { refus: 'Le délai avant récolte est un nombre entier de jours, positif ou nul.', champ: 'dar' }
      dar = n
    }
  }
  let natureProduit: NatureProduitDeclaree | null | undefined
  if (corps.natureProduit !== undefined) {
    if (corps.natureProduit === null || corps.natureProduit === '') natureProduit = null
    else if ((NATURES_PRODUIT_DECLAREES as readonly unknown[]).includes(corps.natureProduit)) natureProduit = corps.natureProduit as NatureProduitDeclaree
    else return { refus: 'Nature du produit inconnue.', champ: 'natureProduit' }
  }
  return { dar, natureProduit }
}
