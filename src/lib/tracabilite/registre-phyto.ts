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
 */

import prisma from '@/lib/prisma'

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

function classifierProduitHeuristique(nom: string | null): string | null {
  if (!nom) return null
  const n = nom.toLowerCase()
  if (/(bouillie|cuivre|sulfate de cuivre|hydroxyde de cuivre)/.test(n)) return 'Autorisé AB'
  if (/(soufre|huile blanche|kaolinit|chaux)/.test(n)) return 'Autorisé AB'
  if (/(bacillus|bt |spinosad|pyrévert|pyrethr|phéromone|trichogramm|coccinelle)/.test(n)) return 'Biocontrôle'
  if (/(purin|décoction|savon noir|bicarbonate|vinaigre|consoude|fougère|ortie|prêle|lait)/.test(n)) return 'Substance de base / PNPP'
  if (/(piège|filet|glu|carton)/.test(n)) return 'Mécanique'
  if (/(glyphosate|deltaméthr|roténone|mancozèbe|fosétyl)/.test(n)) return 'Chimique conventionnel'
  return null
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
          where: { id: intervention.cultureId },
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

      // Si pas de culture mais une planche directe
      if (!plancheNom && intervention.plancheId) {
        const planche = await prisma.planche.findUnique({
          where: { id: intervention.plancheId },
          select: { nom: true, ilot: true, type: true },
        })
        if (planche) {
          plancheNom = planche.nom
          plancheLocalisation = [planche.ilot, planche.type]
            .filter(Boolean)
            .join(' - ')
        }
      }

      // Si arbre
      if (intervention.arbreId) {
        const arbre = await prisma.arbre.findUnique({
          where: { id: intervention.arbreId },
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

      // Detecter les champs manquants obligatoires
      const champsMissing: string[] = []
      if (!intervention.produitPhyto) champsMissing.push('produitPhyto')
      if (!intervention.numAMM) champsMissing.push('numAMM')
      if (!intervention.doseAppliquee) champsMissing.push('doseAppliquee')
      if (!intervention.surfaceTraitee) champsMissing.push('surfaceTraitee')
      if (intervention.dar === null || intervention.dar === undefined) champsMissing.push('dar')
      if (!cultureNom && !plancheNom) champsMissing.push('culture/parcelle')

      // PROMPT 11 — Source de vérité pour la classification : produitPhytoRef si présent,
      // sinon fallback heuristique sur le nom (rétro-compat saisies historiques).
      const ref = intervention.produitPhytoRef
      const produitNom = ref?.nomCommercial ?? intervention.produitPhyto ?? null
      const classification = ref?.classification ?? classifierProduitHeuristique(produitNom)
      const autoriseAB = ref?.autoriseAB ?? null

      return {
        id: intervention.id,
        date: intervention.date.toISOString(),
        culture: cultureNom || 'Non renseigné',
        espece: especeNom,
        parcelle: plancheNom || 'Non renseigné',
        localisation: plancheLocalisation,
        nuisibleCible: intervention.cibleTraitement || null,
        produit: produitNom,
        produitId: ref?.id ?? null,
        substanceActive: ref?.substanceActive ?? null,
        classification,
        autoriseAB,
        numAMM: ref?.amm || intervention.numAMM || null,
        doseAppliquee: intervention.doseAppliquee || null,
        uniteDose: intervention.uniteDose || null,
        surfaceTraitee: intervention.surfaceTraitee || null,
        volumeBouillieLHa: intervention.volumeBouillieLHa ?? null,
        temperatureC: intervention.temperatureC ?? null,
        ventKmh: intervention.ventKmh ?? null,
        hygrometriePct: intervention.hygrometriePct ?? null,
        dar: intervention.dar ?? ref?.darJours ?? null,
        delaiReentree: intervention.delaiReentree || null,
        // QA cmsjirrpv — la ZNT (zone non traitée) est réglementaire et
        // stockée, mais n'était pas restituée à l'écran (seulement à l'export).
        zntDistanceM: intervention.zntDistanceM ?? null,
        zntRespectee: intervention.zntRespectee ?? null,
        conditionsMeteo: intervention.conditionsMeteo || null,
        applicateur: intervention.user.name || intervention.user.email,
        operateurNom: intervention.operateur?.name || intervention.operateur?.email || null,
        certiphytoNum: intervention.certiphytoNum ?? null,
        certiphytoValidite: intervention.certiphytoValidite?.toISOString() ?? null,
        justification: intervention.justification ?? null,
        observationLieeId: intervention.observationLieeId ?? null,
        intrantNumLot: intervention.intrantNumLot || null,
        notes: intervention.notes || null,
        description: intervention.description || null,
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
        { methodeTraitement: { in: ["chimique_conventionnel", "chimique_cuivre", "biocontrole", "biologique_purin", "chimique", "biologique"] } },
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
    const champsMissing: string[] = []
    if (!o.produit) champsMissing.push('produitPhyto')
    if (!o.numAMM) champsMissing.push('numAMM')
    if (o.doseAppliquee == null) champsMissing.push('doseAppliquee')
    entries.push({
      id: 1_000_000_000 + o.id, // évite la collision d'id avec les interventions
      date: o.date.toISOString(),
      culture: o.arbre?.nom || 'Non renseigné',
      espece: o.arbre?.espece || '',
      parcelle: o.parcelle?.nom || 'Non renseigné',
      localisation: '',
      nuisibleCible: o.diagnostic ?? o.symptome ?? null,
      produit: produitNom,
      produitId: null,
      substanceActive: null,
      classification: classifierProduitHeuristique(produitNom),
      autoriseAB: null,
      numAMM: o.numAMM || null,
      doseAppliquee: o.doseAppliquee || null,
      uniteDose: o.uniteDose || null,
      surfaceTraitee: null, // observations en ha — non additionnées au total m²
      volumeBouillieLHa: o.volumeBouillieLHa ?? null,
      temperatureC: o.temperatureC ?? null,
      ventKmh: o.ventKmh ?? null,
      hygrometriePct: o.hygrometriePct ?? null,
      dar: o.dar ?? null,
      delaiReentree: null,
      zntDistanceM: null,
      zntRespectee: null,
      conditionsMeteo: null,
      applicateur: o.user.name || o.user.email,
      operateurNom: o.operateur?.name || o.operateur?.email || null,
      certiphytoNum: o.certiphytoNum ?? null,
      certiphytoValidite: null,
      justification: o.traitement ?? null,
      observationLieeId: null,
      intrantNumLot: null,
      notes: null,
      description: null,
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
    const champsMissing: string[] = []
    if (!op.produit) champsMissing.push('produitPhyto')
    champsMissing.push('numAMM') // champ absent du modèle OperationArbre
    if (op.quantite == null) champsMissing.push('doseAppliquee')
    entries.push({
      id: 2_000_000_000 + op.id, // évite la collision d'id avec interventions et observations
      date: op.date.toISOString(),
      culture: op.arbre?.nom || 'Non renseigné',
      espece: op.arbre?.espece || '',
      parcelle: 'Non renseigné',
      localisation: '',
      nuisibleCible: null,
      produit: produitNom,
      produitId: null,
      substanceActive: null,
      classification: classifierProduitHeuristique(produitNom),
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
      conditionsMeteo: null,
      applicateur: op.user.name || op.user.email,
      operateurNom: op.operateur?.name || op.operateur?.email || null,
      certiphytoNum: null,
      certiphytoValidite: null,
      justification: null,
      observationLieeId: null,
      intrantNumLot: null,
      notes: op.notes || null,
      description: op.description || null,
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
      case 'Autorisé AB':            compteurs.ab += 1; break
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
