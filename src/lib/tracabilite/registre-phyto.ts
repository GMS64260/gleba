/**
 * Registre phytosanitaire réglementaire (Cerphyto) — source unique de vérité
 * de l'écran Traçabilité > Registre phyto et de son export.
 *
 * Extrait de GET /api/tracabilite/registre-phyto (lot assistant 2026-08-11)
 * pour être partagé avec l'outil assistant `get_registre_phyto`, qui utilisait
 * jusque-là sa propre requête (périmètre plus large : tout type avec produit)
 * et « surcomptait » des lignes que l'écran ne montre pas. Périmètre écran :
 * interventions de type traitement_phyto + traitements saisis via les
 * observations Santé du verger + opérations d'arbres de type traitement
 * (QA cmsoghh2b — le registre verger les affiche, le registre global les
 * omettait).
 *
 * QA cmvgeltj1 (2026-10-20) — surface, ZNT, météo et applicateur sont projetés
 * depuis les colonnes que chaque formulaire écrit réellement
 * (`projection-phyto.ts`), et la conformité suit une seule règle pour les
 * interventions et opérations d'arbre (`champsManquantsRegistre`), et les
 * observations santé selon la règle de leur saisie
 * (`champsManquantsObservationPhyto`).
 */

import prisma from '@/lib/prisma'
import { resoudreIdPlanche } from '@/lib/planches/resolution'
import { jourCivilStocke } from '@/lib/jour-civil'
import { numAMMValide } from '@/lib/tracabilite/amm'
import {
  METHODES_OBSERVATION_REGISTRE,
  champsManquantsRegistreObservation,
} from '@/lib/tracabilite/conformite-observation-phyto'
import { chargerContexteRegistre, type ContexteRegistre } from '@/lib/tracabilite/contexte-registre'
import {
  applicateurPhyto,
  libelleMeteoPhyto,
  operateurPhyto,
  surfaceRegistreM2,
} from '@/lib/tracabilite/projection-phyto'

/**
 * Date d'une ligne du registre : son JOUR civil « AAAA-MM-JJ » (minuit UTC pile
 * = jour saisi, sinon jour à Paris), comme le Registre de culture et l'export.
 * Ticket QA cmvnulry1 (2026-10-25) : l'ISO brut, formaté en UTC, mettait la
 * veille un traitement saisi entre minuit et 2 h à Paris (22:30 UTC la veille).
 */
function jourLigne(date: Date): string {
  return jourCivilStocke(date) ?? ''
}

/**
 * Conformité du numéro d'AMM au registre : absent → « numAMM » manquant ;
 * présent mais pas sept chiffres → « numAMM invalide » (QA cmv2962ey). Le
 * numéro retenu est celui affiché : référentiel produit d'abord, saisie ensuite.
 */
function controlerNumAMM(numAMM: string | null | undefined, champsMissing: string[]) {
  if (!numAMM) champsMissing.push('numAMM')
  else if (!numAMMValide(numAMM)) champsMissing.push('numAMM invalide')
}

/**
 * Classifications d'un moyen qui n'est pas un produit phytopharmaceutique sous
 * autorisation : aucun numéro d'AMM ne peut y être exigé (revue de conformité
 * du 2026-11-12, C1). Le nom, la dose et la surface restent demandés.
 */
const CLASSIFICATIONS_SANS_AMM = new Set([
  'Substance de base / PNPP',
  'Biologique (purin/décoction)',
  'Mécanique',
  'Mécanique/Manuel',
  'Prophylaxie',
])
export function ammExigee(classification: string | null | undefined): boolean {
  return !classification || !CLASSIFICATIONS_SANS_AMM.has(classification)
}

/**
 * Champs obligatoires manquants d'une intervention ou d'une opération d'arbre.
 * Les observations santé du verger suivent la règle de leur saisie
 * (`champsManquantsObservationPhyto`, conformite-observation-phyto.ts).
 */
function champsManquantsRegistre(ligne: {
  produit: string | null | undefined
  numAMM: string | null | undefined
  doseAppliquee: number | null | undefined
  uniteDose: string | null | undefined
  surfaceM2: number | null
  dar: number | null | undefined
  localise: boolean
  ammExigee: boolean
}): string[] {
  const champsMissing: string[] = []
  if (!ligne.produit) champsMissing.push('produitPhyto')
  // Arrêté du 24 décembre 2025, annexe I : numéro d'autorisation du produit,
  // dose (annexe II : « numérique + unité ») et surface traitée.
  if (ligne.ammExigee) controlerNumAMM(ligne.numAMM, champsMissing)
  else if (ligne.numAMM && !numAMMValide(ligne.numAMM)) champsMissing.push('numAMM invalide')
  if (!ligne.doseAppliquee) champsMissing.push('doseAppliquee')
  else if (!ligne.uniteDose?.trim()) champsMissing.push('uniteDose')
  if (!ligne.surfaceM2) champsMissing.push('surfaceTraitee')
  if (ligne.dar === null || ligne.dar === undefined) champsMissing.push('dar')
  if (!ligne.localise) champsMissing.push('culture/parcelle')
  return champsMissing
}

/**
 * Classification heuristique en rétro-compatibilité pour les anciennes saisies
 * (champ TEXT `produitPhyto` sans FK). Cherche dans le référentiel ProduitPhyto
 * par nom_commercial puis match approximatif sur la substance active connue.
 * Pour les saisies futures, le client envoie `produitPhytoId` et la
 * classification vient directement du référentiel.
 */
/**
 * Identité de l'arbre snapshotée dans les notes lors de sa suppression
 * (`[Arbre supprimé : Pommier du fond (Pommier)]`). Sans cette relecture, la
 * colonne « Culture / arbre » du registre affichait « Non renseigné » pour un
 * traitement pourtant conservé — la trace existait mais devenait anonyme, ce
 * qui vide la conservation de son intérêt (QA cmswxinhf).
 */
function arbreSnapshote(notes: string | null): string | null {
  const trouve = notes?.match(/\[Arbre supprimé\s*:\s*([^\]]+)\]/)
  return trouve ? trouve[1].trim() : null
}

/**
 * Classification DÉDUITE DU LIBELLÉ, indicative. Revue de conformité du
 * 2026-11-12 (C7) : un mot ne prouve pas qu'un produit est utilisable en
 * agriculture biologique (règlement (UE) 2018/848, art. 9 et 24 ; liste à
 * l'annexe I du règlement d'exécution (UE) 2021/1165) ni qu'il est autorisé
 * pour cet usage (règlement (CE) 1107/2009, art. 55). « Chaux vive » ou
 * « bouillie maison au cuivre » sortaient « Autorisé AB » : l'heuristique ne
 * renvoie plus jamais ce statut, réservé au référentiel.
 */
export const CLASSIFICATION_MINERALE_A_VERIFIER = 'Minéral (AB à vérifier)'
export function classifierProduitHeuristique(nom: string | null): string | null {
  if (!nom) return null
  const n = nom.toLowerCase()
  if (/(bouillie|cuivre|sulfate de cuivre|hydroxyde de cuivre)/.test(n)) return CLASSIFICATION_MINERALE_A_VERIFIER
  if (/(soufre|huile blanche|kaolinit|chaux)/.test(n)) return CLASSIFICATION_MINERALE_A_VERIFIER
  if (/(bacillus|bt |spinosad|pyrévert|pyrethr|phéromone|trichogramm|coccinelle)/.test(n)) return 'Biocontrôle'
  if (/(purin|décoction|savon noir|bicarbonate|vinaigre|consoude|fougère|ortie|prêle|lait)/.test(n)) return 'Substance de base / PNPP'
  if (/(piège|filet|glu|carton)/.test(n)) return 'Mécanique'
  if (/(glyphosate|deltaméthr|roténone|mancozèbe|fosétyl)/.test(n)) return 'Chimique conventionnel'
  return null
}

/**
 * Contexte d'une ligne : figé sur le traitement s'il a été enregistré depuis
 * le 2026-11-13, sinon relu des fiches actuelles (lignes antérieures).
 */
async function contexteLigne(
  ligne: { date?: Date; cultureRegistre?: string | null; localisationRegistre?: string | null; conduiteBio?: boolean | null },
  userId: string,
  refs: Parameters<typeof chargerContexteRegistre>[2],
): Promise<ContexteRegistre & { contexteFige: boolean }> {
  if (ligne.cultureRegistre != null || ligne.localisationRegistre != null || ligne.conduiteBio != null) {
    return {
      cultureRegistre: ligne.cultureRegistre ?? null,
      localisationRegistre: ligne.localisationRegistre ?? null,
      conduiteBio: ligne.conduiteBio ?? null,
      contexteFige: true,
    }
  }
  const relu = await chargerContexteRegistre(prisma, userId, refs, ligne.date ?? new Date())
  return { ...relu, contexteFige: false }
}

/** Mentions de l'annexe I ajoutées à chaque ligne (arrêté du 24 décembre 2025). */
function mentionsAnnexe(
  contexte: ContexteRegistre & { contexteFige: boolean },
  m: {
    stadeBBCH?: string | null
    heureDebut?: string | null
    heureFin?: string | null
    rentreeAnticipee?: string | null
    siretBeneficiaire?: string | null
  },
) {
  return {
    localisationReglementaire: contexte.localisationRegistre,
    conduiteBio: contexte.conduiteBio,
    contexteFige: contexte.contexteFige,
    stadeBBCH: m.stadeBBCH ?? null,
    heureDebut: m.heureDebut ?? null,
    heureFin: m.heureFin ?? null,
    rentreeAnticipee: m.rentreeAnticipee ?? null,
    siretBeneficiaire: m.siretBeneficiaire ?? null,
  }
}

export type RegistrePhyto = Awaited<ReturnType<typeof genererRegistrePhyto>>

export async function genererRegistrePhyto(userId: string, annee: number) {
  const startOfYear = new Date(annee, 0, 1)
  const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

  // Recuperer toutes les interventions de type traitement_phyto pour l'annee.
  // PROMPT 11 — on joint le référentiel ProduitPhyto pour la classification.
  const interventions = await prisma.intervention.findMany({
    where: {
      userId,
      type: 'traitement_phyto',
      // Un traitement seulement PLANIFIÉ n'a pas été appliqué : il n'a pas sa
      // place au registre ni au cumul de cuivre (revue du 2026-11-04 ; les
      // opérations d'arbre plus bas filtrent déjà sur `fait`).
      fait: true,
      date: { gte: startOfYear, lte: endOfYear },
    },
    include: {
      user: { select: { name: true, email: true } },
      operateur: { select: { name: true, email: true } },
      produitPhytoRef: true,
    },
    orderBy: { date: 'asc' },
  })

  // Pour chaque intervention, recuperer la culture et la planche associees
  const entries = await Promise.all(
    interventions.map(async (intervention) => {
      let cultureNom = ''
      let plancheNom = ''
      let plancheLocalisation = ''
      let especeNom = ''

      // Recuperer culture si liee
      if (intervention.cultureId) {
        const culture = await prisma.culture.findUnique({
          where: { id: intervention.cultureId, userId },
          include: {
            espece: { select: { id: true, nom: true } },
            variete: { select: { id: true, nom: true } },
            planche: { select: { nom: true, ilot: true, type: true } },
          },
        })
        if (culture) {
          especeNom = culture.espece.nom ?? culture.espece.id
          cultureNom = culture.variete
            ? `${culture.espece.nom ?? culture.espece.id} (${culture.variete.nom ?? culture.variete.id})`
            : culture.espece.nom ?? culture.espece.id
          if (culture.planche) {
            plancheNom = culture.planche.nom
            plancheLocalisation = [culture.planche.ilot, culture.planche.type]
              .filter(Boolean)
              .join(' - ')
          }
        }
      }

      // Si pas de culture mais une planche directe.
      // QA 2026-09-28 — `Intervention.plancheId` porte historiquement le NOM
      // de la planche autant que son id (formulaire qui envoyait `nom || id`) :
      // résolu par id puis par nom, borné au compte, sinon un traitement saisi
      // « sur planche » sortait au registre sans emplacement et « Non conforme ».
      if (!plancheNom && intervention.plancheId) {
        const plancheId = await resoudreIdPlanche(prisma, intervention.plancheId, userId)
        const planche = plancheId
          ? await prisma.planche.findFirst({
              where: { id: plancheId, userId },
              select: { nom: true, ilot: true, type: true },
            })
          : null
        if (planche) {
          plancheNom = planche.nom
          plancheLocalisation = [planche.ilot, planche.type]
            .filter(Boolean)
            .join(' - ')
        }
      }

      // Si arbre
      if (intervention.arbreId) {
        // `arbreId` est une colonne sans clé étrangère : la lecture reste bornée
        // au compte, sinon une saisie forgée affichait l'arbre d'une autre
        // exploitation (revue du 2026-11-04).
        const arbre = await prisma.arbre.findFirst({
          where: { id: intervention.arbreId, userId },
          select: { nom: true, espece: true, variete: true },
        })
        if (arbre) {
          cultureNom = arbre.nom
          especeNom = arbre.espece || arbre.nom
        }
      }

      // Arbre supprimé : l'identité snapshotée tient lieu de culture.
      if (!cultureNom) {
        const snapshot = arbreSnapshote(intervention.notes)
        if (snapshot) cultureNom = snapshot
      }

      // Revue de conformité du 2026-11-12 (C4) : le registre restitue ce qui a
      // été ENREGISTRÉ sur le traitement (nom, AMM, DAR). Le référentiel
      // ProduitPhyto, mis à jour depuis, ne complète que ce que la saisie
      // n'a jamais porté ; il ne réécrit plus un registre passé.
      const ref = intervention.produitPhytoRef
      const numAMMRetenu = intervention.numAMM || ref?.amm || null
      const produitNom = intervention.produitPhyto ?? ref?.nomCommercial ?? null
      const classification = ref?.classification ?? classifierProduitHeuristique(produitNom)
      const classificationSource = ref?.classification ? ('referentiel' as const) : classification ? ('heuristique' as const) : null
      const autoriseAB = ref?.autoriseAB ?? null
      const contexte = await contexteLigne(intervention, userId, {
        cultureId: intervention.cultureId,
        plancheId: intervention.plancheId,
        arbreId: intervention.arbreId,
        parcelleId: intervention.parcelleId,
      })
      if (intervention.cultureRegistre) cultureNom = intervention.cultureRegistre

      // Detecter les champs manquants obligatoires
      const surfaceM2 = surfaceRegistreM2(intervention)
      const champsMissing = champsManquantsRegistre({
        produit: produitNom,
        numAMM: numAMMRetenu,
        doseAppliquee: intervention.doseAppliquee,
        uniteDose: intervention.uniteDose,
        surfaceM2,
        dar: intervention.dar,
        localise: Boolean(cultureNom || plancheNom || contexte.localisationRegistre),
        ammExigee: ammExigee(classification),
      })

      return {
        id: intervention.id,
        date: jourLigne(intervention.date),
        culture: cultureNom || 'Non renseigné',
        espece: especeNom,
        parcelle: plancheNom || 'Non renseigné',
        localisation: plancheLocalisation,
        nuisibleCible: intervention.cibleTraitement || null,
        produit: produitNom,
        produitId: ref?.id ?? null,
        substanceActive: ref?.substanceActive ?? null,
        classification,
        classificationSource,
        autoriseAB,
        numAMM: numAMMRetenu,
        doseAppliquee: intervention.doseAppliquee || null,
        uniteDose: intervention.uniteDose || null,
        surfaceTraitee: surfaceM2,
        volumeBouillieLHa: intervention.volumeBouillieLHa ?? null,
        temperatureC: intervention.temperatureC ?? null,
        ventKmh: intervention.ventKmh ?? null,
        hygrometriePct: intervention.hygrometriePct ?? null,
        // DAR enregistré seulement : celui du référentiel actuel n'est pas
        // celui qui s'appliquait le jour du traitement (C4).
        dar: intervention.dar ?? null,
        delaiReentree: intervention.delaiReentree || null,
        // QA cmsjirrpv — la ZNT (zone non traitée) est réglementaire et
        // stockée, mais n'était pas restituée à l'écran (seulement à l'export).
        zntDistanceM: intervention.zntDistanceM ?? null,
        zntRespectee: intervention.zntRespectee ?? null,
        conditionsMeteo: libelleMeteoPhyto(intervention),
        applicateur: applicateurPhyto(intervention),
        operateurNom: operateurPhyto(intervention),
        certiphytoNum: intervention.certiphytoNum ?? null,
        certiphytoValidite: intervention.certiphytoValidite?.toISOString() ?? null,
        justification: intervention.justification ?? null,
        observationLieeId: intervention.observationLieeId ?? null,
        intrantNumLot: intervention.intrantNumLot || null,
        notes: intervention.notes || null,
        description: intervention.description || null,
        ...mentionsAnnexe(contexte, {
          stadeBBCH: intervention.stadeBBCH,
          heureDebut: intervention.heureDebut,
          heureFin: intervention.heureFin,
          rentreeAnticipee: intervention.rentreeAnticipee,
          siretBeneficiaire: intervention.siretBeneficiaire,
        }),
        champsManquants: champsMissing,
        complet: champsMissing.length === 0,
      }
    })
  )

  // Audit #67 : inclure aussi les traitements saisis via les observations
  // Santé du verger (mêmes champs réglementaires), comme le fait l'export
  // PDF/CSV — l'écran les omettait, donnant un registre incomplet.
  const observations = await prisma.observationSante.findMany({
    where: {
      userId,
      date: { gte: startOfYear, lte: endOfYear },
      OR: [
        { methodeTraitement: { in: [...METHODES_OBSERVATION_REGISTRE] } },
        { produit: { not: null } },
        { numAMM: { not: null } },
      ],
    },
    include: {
      arbre: { select: { nom: true, espece: true, variete: true } },
      parcelle: { select: { nom: true } },
      operateur: { select: { name: true, email: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { date: 'asc' },
  })
  for (const o of observations) {
    const produitNom = o.produit ?? null
    // QA cmvgeltj1 — le formulaire du verger saisit la surface en hectares.
    const surfaceM2 = surfaceRegistreM2(o)
    // Revue du 2026-10-20 — même exigence que la saisie (POST/PUT
    // /api/arbres/observations) : champs réglementaires d'une méthode
    // chimique ; ailleurs, seule la forme d'une AMM saisie est contrôlée.
    // Revue de conformité du 2026-11-12 (C1) : mentions de l'annexe I pour
    // tout produit phytopharmaceutique, biocontrôle compris.
    const champsMissing = champsManquantsRegistreObservation(o).map((champ) => champ.cle)
    if (o.numAMM && !numAMMValide(o.numAMM)) champsMissing.push('numAMM invalide')
    const contexte = await contexteLigne(o, userId, { arbreId: o.arbreId, parcelleId: o.parcelleId })
    entries.push({
      id: 1_000_000_000 + o.id, // évite la collision d'id avec les interventions
      date: jourLigne(o.date),
      culture: o.cultureRegistre || o.arbre?.nom || 'Non renseigné',
      espece: o.arbre?.espece || '',
      parcelle: o.parcelle?.nom || 'Non renseigné',
      localisation: '',
      nuisibleCible: o.diagnostic ?? o.symptome ?? null,
      produit: produitNom,
      produitId: null,
      substanceActive: null,
      classification: classifierProduitHeuristique(produitNom),
      classificationSource: classifierProduitHeuristique(produitNom) ? ('heuristique' as const) : null,
      autoriseAB: null,
      numAMM: o.numAMM || null,
      doseAppliquee: o.doseAppliquee || null,
      uniteDose: o.uniteDose || null,
      surfaceTraitee: surfaceM2,
      volumeBouillieLHa: o.volumeBouillieLHa ?? null,
      temperatureC: o.temperatureC ?? null,
      ventKmh: o.ventKmh ?? null,
      hygrometriePct: o.hygrometriePct ?? null,
      dar: o.dar ?? null,
      delaiReentree: null,
      zntDistanceM: o.zntDistanceM ?? null,
      zntRespectee: o.zntRespectee ?? null,
      conditionsMeteo: libelleMeteoPhyto(o),
      applicateur: applicateurPhyto(o),
      operateurNom: operateurPhyto(o),
      certiphytoNum: o.certiphytoNum ?? null,
      certiphytoValidite: null,
      justification: o.traitement ?? null,
      observationLieeId: null,
      intrantNumLot: null,
      notes: null,
      description: null,
      ...mentionsAnnexe(contexte, { stadeBBCH: o.stadeBBCH }),
      champsManquants: champsMissing,
      complet: champsMissing.length === 0,
    })
  }

  // QA cmsoghh2b — 3ᵉ source : les traitements saisis via Verger > Opérations
  // (operations_arbres, type "traitement", fait). Le registre verger
  // (SanteTab) les affiche depuis le Bug #16, mais le registre global (et
  // donc l'outil assistant) les omettait : la « Bouillie bordelaise 3 kg »
  // d'un arbre manquait au registre réglementaire. Même format de ligne que
  // SanteTab : produit, dose (quantité/unité), arbre ; AMM et DAR n'existent
  // pas sur ce modèle → null.
  const operations = await prisma.operationArbre.findMany({
    where: {
      userId,
      type: 'traitement',
      fait: true,
      date: { gte: startOfYear, lte: endOfYear },
      OR: [{ produit: { not: null } }, { description: { not: null } }],
    },
    include: {
      arbre: { select: { nom: true, espece: true, variete: true } },
      user: { select: { name: true, email: true } },
      operateur: { select: { name: true, email: true } },
    },
    orderBy: { date: 'asc' },
  })
  for (const op of operations) {
    const produitNom = op.produit ?? null
    // AMM, surface et DAR sont absents du modèle OperationArbre : toujours manquants.
    const classificationOp = classifierProduitHeuristique(produitNom)
    const champsMissing = champsManquantsRegistre({
      produit: op.produit,
      numAMM: null,
      doseAppliquee: op.quantite,
      uniteDose: op.unite,
      surfaceM2: null,
      dar: null,
      localise: Boolean(op.arbre?.nom),
      ammExigee: ammExigee(classificationOp),
    })
    // Contexte figé à la réalisation (CR-PHY-03), sinon relu des fiches actuelles.
    const contexte = await contexteLigne(op, userId, { arbreId: op.arbreId })
    entries.push({
      id: 2_000_000_000 + op.id, // évite la collision d'id avec interventions et observations
      date: jourLigne(op.date),
      culture: op.cultureRegistre || op.arbre?.nom || 'Non renseigné',
      espece: op.arbre?.espece || '',
      parcelle: 'Non renseigné',
      localisation: '',
      nuisibleCible: null,
      produit: produitNom,
      produitId: null,
      substanceActive: null,
      classification: classificationOp,
      classificationSource: classificationOp ? ('heuristique' as const) : null,
      autoriseAB: null,
      numAMM: null,
      doseAppliquee: op.quantite ?? null,
      uniteDose: op.unite ?? null,
      surfaceTraitee: null, // quantité absolue (kg/L) — pas de surface à additionner
      volumeBouillieLHa: null,
      temperatureC: op.temperatureC ?? null,
      ventKmh: op.ventKmh ?? null,
      hygrometriePct: op.hygrometriePct ?? null,
      dar: null,
      delaiReentree: null,
      zntDistanceM: null,
      zntRespectee: null,
      conditionsMeteo: libelleMeteoPhyto(op),
      applicateur: applicateurPhyto(op),
      operateurNom: operateurPhyto(op),
      certiphytoNum: null,
      certiphytoValidite: null,
      justification: null,
      observationLieeId: null,
      intrantNumLot: null,
      notes: op.notes || null,
      description: op.description || null,
      ...mentionsAnnexe(contexte, {}),
      champsManquants: champsMissing,
      complet: champsMissing.length === 0,
    })
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  // Stats resume — PROMPT 11 : compteurs par classification correcte.
  const produitsUtilises = new Set(entries.filter(e => e.produit).map(e => e.produit))
  // QA cmswxf83f — cumul de flottants : la somme sortait « 1849.8999999999999 ».
  // Arrondi à la source, partagée par l'écran, l'export et l'outil assistant.
  const surfaceTotale =
    Math.round(entries.reduce((sum, e) => sum + (e.surfaceTraitee || 0), 0) * 100) / 100
  const nbIncomplets = entries.filter(e => !e.complet).length
  const compteurs = {
    chimique: 0,
    biocontrole: 0,
    pnpp: 0,
    ab: 0,
    mecanique: 0,
    inconnu: 0,
  }
  for (const e of entries) {
    switch (e.classification) {
      case 'Chimique conventionnel': compteurs.chimique += 1; break
      case 'Biocontrôle':            compteurs.biocontrole += 1; break
      case 'Substance de base / PNPP': compteurs.pnpp += 1; break
      // AB : seulement une classification du référentiel, jamais déduite d'un libellé (C7).
      case 'Autorisé AB':            if (e.classificationSource === 'referentiel') compteurs.ab += 1; else compteurs.inconnu += 1; break
      case 'Mécanique':              compteurs.mecanique += 1; break
      default:                       compteurs.inconnu += 1
    }
  }
  return {
    registre: entries,
    stats: {
      totalTraitements: entries.length,
      produitsUtilises: Array.from(produitsUtilises),
      nbProduitsDistincts: produitsUtilises.size,
      surfaceTotalTraitee: surfaceTotale,
      nbIncomplets,
      compteurs,
      periodeDebut: entries.length > 0 ? entries[0].date : null,
      periodeFin: entries.length > 0 ? entries[entries.length - 1].date : null,
    },
  }
}
