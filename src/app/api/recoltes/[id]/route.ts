import { FicheModifieeAilleurs, INCREMENT_VERSION, lireVersionLue, versionFichePerimee } from '@/lib/api/version-fiche'
import { messageConflitStockCaisse } from '@/lib/caisse/conflit-stock'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
import { apresDemain, MESSAGE_RECOLTE_FUTURE } from '@/lib/interventions/date-realisee'
import { verrouillerRecolteLibre } from '@/lib/commercial/verrou-lot'
import { ErreurCommerciale } from '@/lib/commercial/regles'
import { verdictDarLegume } from '@/lib/recolte/dar'
import { corpsRefusDar, ErreurDarEnCours } from '@/lib/phyto/refus-dar'
/**
 * API Routes pour une Récolte spécifique
 * GET /api/recoltes/[id] - Détail d'une recolte
 * PUT /api/recoltes/[id] - Modifier une recolte
 * DELETE /api/recoltes/[id] - Supprimer une recolte
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { modePaiementDepuisReglement } from '@/lib/validations/reglement'
import { updateRecolteSchema, recoltePatchSchema } from '@/lib/validations'
import { estSortieRecolte, STATUT_ECART_INVENTAIRE } from '@/lib/validations/recolte'
import { jourSortie, preparerSortieLot } from '@/lib/recolte/sortie-lot'
import { requireAuthApi } from '@/lib/auth-utils'
import { createVenteFromRecolte, deleteAutoEntry } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { creerFacture, annulerFactureLiee } from '@/lib/facture-utils'
import {
  OPTIONS_TRANSACTION_CULTURE,
  SELECT_ETAPES,
  ecrituresPassageAFait,
  jourCivilLocal,
  verrouillerCultures,
} from '@/lib/cultures/execution'
import { refusPeremptionAvantRecolte, refusRecolteAvantDebut } from '@/lib/recolte/date-coherente'
import { jourCivilStocke } from '@/lib/jour-civil'
import { cederLaLignee } from '@/lib/recolte/lignee'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'
import { snapshotStatutBio } from '@/lib/statut-bio'

type RouteParams = { params: Promise<{ id: string }> }

// Refonte stock 2026-07 : le compteur UserStockEspece.inventaire n'est plus
// ajusté à chaque mouvement de récolte. Le stock est recalculé par
// calculerStocksNet (somme des restes des lots en stock depuis L4.2), ce qui
// supprime le double comptage (audit #28). Les anciens appels à
// ajusterInventaireEspece ont donc été retirés.

/** Un écart d'inventaire vient d'un comptage et ne se corrige que par un autre. */
const MESSAGE_ECART_INVENTAIRE =
  'Cet écart vient d’un comptage du stock : recomptez le stock dans Stocks > Récoltes pour le corriger.'

/** Un lot né d'un comptage se corrige par un comptage. */
const MESSAGE_LOT_INVENTAIRE =
  'Ce lot vient d’un comptage du stock, sans récolte d’origine : corrigez-le par un nouveau comptage dans Stocks > Récoltes.'

/** Un lot pris par une sortie de Consommations ne se rend au stock que par elle. */
const MESSAGE_SORTIE_CONSOMMATION =
  'Ce lot a été sorti par une sortie saisie dans Stocks > Consommations : annulez-la là-bas, ses lots reviendront en stock.'

// GET /api/recoltes/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id)

    if (isNaN(recolteId)) {
      return NextResponse.json(
        { error: 'ID de récolte invalide' },
        { status: 400 }
      )
    }

    const recolte = await prisma.recolte.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
      include: {
        espece: {
          include: { famille: true },
        },
        culture: {
          include: {
            variete: true,
            planche: true,
            itp: true,
          },
        },
      },
    })

    if (!recolte) {
      return NextResponse.json(
        { error: `Récolte #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Espèce, variété et ITP embarqués : jamais l'id de l'auteur d'une entrée
    // partagée par un autre compte (revue 2026-10-20).
    return NextResponse.json(masquerReferentielsEmbarques(recolte, session!.user.id))
  } catch (error) {
    const conflitStock = messageConflitStockCaisse(error)
    if (conflitStock) return NextResponse.json({ error: conflitStock }, { status: 409 })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ErreurCommerciale) return NextResponse.json({ error: error.message }, { status: error.status })
    if (String(error).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error('GET /api/recoltes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la récolte' },
      { status: 500 }
    )
  }
}

// PUT /api/recoltes/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const recolteId = Number((await params).id)
    if (!Number.isInteger(recolteId) || recolteId <= 0) return NextResponse.json({ error: 'ID de récolte invalide' }, { status: 400 })
    const corps = await request.json()
    const validation = updateRecolteSchema.safeParse(corps)
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error.flatten() }, { status: 400 })
    const lecture = lireVersionLue(corps)
    if (!lecture.ok) return NextResponse.json({ error: lecture.erreur }, { status: 400 })
    const userId = session!.user.id
    const data = validation.data
    const resultat = await prisma.$transaction(async tx => {
      // Contre-revue adverse 2 (2026-11-15) : avancer la date d'une récolte ne
      // touche pas la clé étrangère, donc n'attendait pas le verrou commun des
      // étapes de culture. Un PUT culture validé sur l'ancienne première
      // récolte écrivait ensuite une récolte faite postérieure à celle-ci.
      // Ordre global : cultures (ancienne et nouvelle) PUIS lot. La culture du
      // lot est lue sans verrou pour savoir quoi verrouiller, puis revérifiée.
      const apercu = await tx.recolte.findFirst({ where: { id: recolteId, userId }, select: { cultureId: true } })
      if (!apercu) throw new ErreurCommerciale('Récolte introuvable', 404)
      await verrouillerCultures(tx, userId, [apercu.cultureId, data.cultureId ?? apercu.cultureId].filter((id): id is number => id != null), 'sansCle')
      const lot = await verrouillerRecolteLibre(tx, userId, recolteId)
      // Version de fiche, contrôlée sous le verrou de ligne, avant toute écriture.
      if (versionFichePerimee(lecture.version, lot)) throw new FicheModifieeAilleurs('Récolte', lot.version)
      if (lot.cultureId !== apercu.cultureId) {
        throw new ErreurCommerciale('Cette récolte vient d’être rattachée à une autre culture. Actualisez la page puis recommencez.', 409)
      }
      // Pas de date future (comme à la création), sauf si c'est déjà celle du lot :
      // un lot ancien mal daté reste corrigeable sur ses autres champs.
      if (data.date && apresDemain(data.date) && data.date.toISOString().slice(0, 10) !== lot.date.toISOString().slice(0, 10)) {
        throw new ErreurCommerciale(MESSAGE_RECOLTE_FUTURE, 400)
      }
      if (data.quantite != null && (lot.unite ?? 'kg') !== 'kg' && !Number.isInteger(data.quantite)) {
        throw new ErreurCommerciale('Indiquez une quantité entière dans l’unité de ce lot.', 400)
      }
      // Lot d'inventaire (né d'un comptage, sans culture) : il se corrige par un
      // nouveau comptage, jamais en le rattachant ou en le redatant ici. La fiche
      // renvoie toujours le jour : le même jour ne redate pas l'instant du lot.
      if (lot.cultureId == null && data.date !== undefined && jourSortie(data.date) === jourSortie(lot.date)) delete data.date
      // Écart d'inventaire : le journal d'un comptage ne se réécrit pas.
      if (lot.statut === STATUT_ECART_INVENTAIRE && (
        (data.quantite !== undefined && data.quantite !== lot.quantite) ||
        (data.especeId !== undefined && data.especeId !== lot.especeId) ||
        (data.cultureId !== undefined && data.cultureId !== lot.cultureId) ||
        (data.date !== undefined && jourSortie(data.date) !== jourSortie(lot.date))
      )) throw new ErreurCommerciale(MESSAGE_ECART_INVENTAIRE, 409)
      if (lot.cultureId == null && (
        (data.quantite !== undefined && data.quantite !== lot.quantite) ||
        (data.especeId !== undefined && data.especeId !== lot.especeId) ||
        data.cultureId !== undefined ||
        (data.date !== undefined && jourSortie(data.date) !== jourSortie(lot.date))
      )) throw new ErreurCommerciale(MESSAGE_LOT_INVENTAIRE, 409)
      if (lot.consommationId != null && (
        (data.quantite !== undefined && data.quantite !== lot.quantite) ||
        (data.especeId !== undefined && data.especeId !== lot.especeId) ||
        (data.cultureId !== undefined && data.cultureId !== lot.cultureId) ||
        (data.date !== undefined && jourSortie(data.date) !== jourSortie(lot.date))
      )) throw new ErreurCommerciale(MESSAGE_SORTIE_CONSOMMATION, 409)
      // Une ligne sortie (perte, consommation, don) ne se redate pas après son jour de sortie.
      if (data.date && lot.dateSortie && jourSortie(data.date) > jourSortie(lot.dateSortie)) {
        throw new ErreurCommerciale('Ce lot est sorti du stock avant cette date. Remettez-le en stock ou choisissez une date antérieure à sa sortie.', 400)
      }
      if (lot.statut === 'vendu' && (
        (data.quantite !== undefined && data.quantite !== lot.quantite) ||
        (data.especeId !== undefined && data.especeId !== lot.especeId) ||
        (data.cultureId !== undefined && data.cultureId !== lot.cultureId)
      )) throw new ErreurCommerciale('Ce lot est vendu : corrigez ou annulez d’abord sa vente avant de modifier sa quantité ou sa culture.')
      const cultureCible = data.cultureId ?? lot.cultureId
      const especeCible = data.especeId ?? lot.especeId
      const dateCible = data.date ?? lot.date
      const dateChange = data.date !== undefined && jourCivilLocal(data.date) !== jourCivilLocal(lot.date)
      // La péremption ne précède jamais la récolte. La règle confronte la valeur
      // reçue à celle du lot (le formulaire n'envoie que la date), et seulement
      // si l'une des deux change : un lot ancien déjà incohérent reste
      // corrigeable sur ses autres champs.
      const peremptionCible = data.datePeremption !== undefined ? data.datePeremption : lot.datePeremption
      const peremptionChange = data.datePeremption !== undefined && jourCivilStocke(data.datePeremption) !== jourCivilStocke(lot.datePeremption)
      if (dateChange || peremptionChange) {
        const refusPeremption = refusPeremptionAvantRecolte(dateCible, peremptionCible)
        if (refusPeremption) return { ok: false as const, response: NextResponse.json(
          { error: refusPeremption, champ: dateChange ? 'date' : 'datePeremption' }, { status: 400 },
        ) }
      }
      // Statut bio : le corps n'en porte jamais (schéma), il suit l'origine. Redatée
      // ou rattachée à une autre culture, la récolte reprend le calcul de la
      // création (planche de la culture, à la date de récolte) ; sinon le statut
      // figé reste (MAR-04, 2026-11-12, parité avec PUT /api/arbres/recoltes/[id]).
      let statutBioSnapshot: string | null | undefined
      // Vérifier les références après le verrou, dans le même état que l’écriture.
      if (cultureCible != null && (cultureCible !== lot.cultureId || especeCible !== lot.especeId || dateChange)) {
        const culture = await tx.culture.findUnique({
          where: { id: cultureCible, userId },
          select: {
            id: true, especeId: true, dateSemis: true, datePlantation: true, semisFait: true, plantationFaite: true,
            planche: { select: { statutBio: true, dateDebutConversion: true } },
          },
        })
        if (!culture) throw new ErreurCommerciale(`La culture #${cultureCible} n'existe pas`, 400)
        if (culture.especeId !== especeCible) return { ok: false as const, response: NextResponse.json(
          { error: `L'espèce de la récolte doit correspondre à l'espèce de la culture #${culture.id}`, champ: 'especeId' }, { status: 400 },
        ) }
        const refusDate = refusRecolteAvantDebut(culture, dateCible)
        if (refusDate) return { ok: false as const, response: NextResponse.json({ error: refusDate, champ: 'date' }, { status: 400 }) }
        if (cultureCible !== lot.cultureId || dateChange) {
          statutBioSnapshot = culture.planche
            ? snapshotStatutBio(culture.planche.statutBio, culture.planche.dateDebutConversion, dateCible)
            : null
        }
      }
      // Lignée : rattachée à une autre culture ou à une autre espèce, une
      // récolte saisie laisse ses parts à la plus ancienne d'entre elles.
      const origineChange = cultureCible !== lot.cultureId || especeCible !== lot.especeId
      if (origineChange && lot.recolteOrigineId == null) await cederLaLignee(tx, userId, recolteId)
      const recolte = await tx.recolte.update({
        where: { id: recolteId },
        data: {
          ...data,
          ...INCREMENT_VERSION,
          ...(statutBioSnapshot !== undefined ? { statutBioSnapshot } : {}),
          // Rattachée à une autre culture ou à une autre espèce, une part n'est
          // plus une part de la récolte d'origine : elle redevient une récolte.
          ...(lot.recolteOrigineId != null && origineChange ? { recolteOrigineId: null } : {}),
        },
        include: { espece: true, culture: true },
      })
      // Redatée ou rattachée, la récolte peut devenir la première de sa
      // culture : une récolte faite datée après elle est recalée sur sa date,
      // même règle que la saisie d'une récolte (`recolte/creation`).
      if (cultureCible != null && (cultureCible !== lot.cultureId || dateChange)) {
        const etat = await tx.culture.findFirst({
          where: { id: cultureCible, userId },
          select: { recolteFaite: true, ...SELECT_ETAPES },
        })
        const recalage = etat?.recolteFaite ? ecrituresPassageAFait(etat, 'recolteFaite', dateCible) : {}
        if (Object.keys(recalage).length > 0) {
          const culture = await tx.culture.update({ where: { id: cultureCible }, data: { ...recalage, ...INCREMENT_VERSION } })
          return { ok: true as const, recolte: { ...recolte, culture } }
        }
      }
      return { ok: true as const, recolte }
    }, OPTIONS_TRANSACTION_CULTURE)
    if (!resultat.ok) return resultat.response
    invalidateKpi(userId)
    return NextResponse.json(masquerReferentielsEmbarques(resultat.recolte, userId))
  } catch (error) {
    const conflitStock = messageConflitStockCaisse(error)
    if (conflitStock) return NextResponse.json({ error: conflitStock }, { status: 409 })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof FicheModifieeAilleurs) return error.reponse()
    if (error instanceof ErreurCommerciale) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('PUT /api/recoltes/[id] error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de la récolte' }, { status: 500 })
  }
}

// PATCH /api/recoltes/[id] - Vente et miroir comptable dans la même transaction.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const recolteId = Number((await params).id)
    if (!Number.isInteger(recolteId) || recolteId <= 0) return NextResponse.json({ error: 'ID de récolte invalide' }, { status: 400 })
    const body = await request.json()
    const userId = session!.user.id
    const resultat = await prisma.$transaction(async tx => {
      // Relire TOUT l'état après le verrou : une vente concurrente peut avoir
      // changé statut, quantité et facture pendant l'attente.
      const existing = await verrouillerRecolteLibre(tx, userId, recolteId)
      const refuser = (error: string, status = 400, extras: Record<string, unknown> = {}) => ({
        ok: false as const, response: NextResponse.json({ error, ...extras }, { status }),
      })
      const statut = body.statut ?? existing.statut
      const effectif = {
        ...body, statut,
        ...Object.fromEntries(['prixKg','prixTotal','dateVente','clientId','clientNom'].map(champ => [
          champ, body[champ] !== undefined ? body[champ] : existing[champ as keyof typeof existing],
        ])),
      }
      const validation = recoltePatchSchema.safeParse(effectif)
      if (!validation.success) return refuser('Données invalides', 400, { details: validation.error.flatten() })
      const donnees = validation.data
      if (donnees.quantiteVendue != null && (body.statut !== 'vendu' || existing.statut !== 'en_stock')) {
        return refuser('Ce lot est déjà sorti du stock ou ne fait pas l’objet d’une vente. Actualisez les récoltes.', 409)
      }
      if (donnees.quantiteVendue != null && donnees.quantiteVendue > existing.quantite + 1e-9) {
        return refuser('La quantité vendue dépasse la quantité disponible du lot.', 400, { champ: 'quantiteVendue' })
      }
      // Sortie hors vente (perte, consommation personnelle, don) : en tout ou
      // partie, à son jour. Seul un lot en stock sort ; un lot déjà sorti se
      // remet d'abord en stock.
      const nouvelleSortie = estSortieRecolte(body.statut) && existing.statut !== body.statut
      if ((donnees.quantiteSortie != null || donnees.dateSortie != null) && !nouvelleSortie) {
        return refuser('La quantité et le jour de sortie ne valent que pour une perte, une consommation personnelle ou un don.', 400)
      }
      // Écart d'inventaire : seul un comptage l'écrit, seul un nouveau comptage le corrige.
      if ((existing.statut === STATUT_ECART_INVENTAIRE && body.statut !== undefined && body.statut !== existing.statut)
        || (body.statut === STATUT_ECART_INVENTAIRE && existing.statut !== STATUT_ECART_INVENTAIRE)) {
        return refuser(MESSAGE_ECART_INVENTAIRE, 409)
      }
      // Lot pris par une sortie de Consommations : elle seule le rend au stock.
      if (existing.consommationId != null && body.statut !== undefined && body.statut !== existing.statut) {
        return refuser(MESSAGE_SORTIE_CONSOMMATION, 409)
      }
      if (nouvelleSortie && existing.statut !== 'en_stock') {
        return refuser('Ce lot est déjà sorti du stock. Actualisez les récoltes.', 409)
      }
      // Même règle dans l'autre sens : une perte ou un don ne devient pas une
      // vente sans repasser par le stock (sinon le motif d'origine se perd).
      if (body.statut === 'vendu' && estSortieRecolte(existing.statut)) {
        return refuser('Remettez ce lot en stock avant de le vendre.', 409)
      }
      const sortie = nouvelleSortie ? preparerSortieLot(existing, donnees) : null
      if (sortie && !sortie.ok) return refuser(sortie.error, 400, { champ: sortie.champ })
      let quantiteVendue = donnees.quantiteVendue ?? existing.quantite
      if (Math.abs(quantiteVendue - existing.quantite) <= 1e-9) quantiteVendue = existing.quantite
      if (statut === 'vendu' && (existing.unite ?? 'kg') !== 'kg' && !Number.isInteger(quantiteVendue)) {
        return refuser(`Un nombre entier de ${libelleUniteQuantite(existing.unite as UniteQuantite, 2)} est attendu.`, 400, { champ: 'quantiteVendue' })
      }
      const reliquat = sortie?.ok ? sortie.reliquat
        : statut === 'vendu' && existing.statut === 'en_stock' ? existing.quantite - quantiteVendue : 0
      if (donnees.clientId != null && !await tx.client.findFirst({ where: { id: donnees.clientId, userId }, select: { id: true } })) {
        return refuser('Client introuvable', 400, { champ: 'clientId' })
      }
      if (donnees.creerFacture && existing.factureId) return refuser('Cette récolte est déjà facturée', 409, { factureId: existing.factureId })
      // Mise en vente (passage à « vendu ») : refusée tant qu'un délai avant
      // récolte légal court sur ce lot ; un rappel informatif accompagne la
      // vente sans l'empêcher. Corriger une vente déjà faite n'est pas rejugé.
      let dar = null
      if (statut === 'vendu' && existing.statut !== 'vendu') {
        // Lot d'inventaire : ni planche ni traitement connus, aucun délai à juger.
        const plancheId = existing.culture?.plancheId ?? null
        const planche = plancheId ? await tx.planche.findFirst({ where: { id: plancheId, userId }, select: { parcelleGeoId: true } }) : null
        dar = await verdictDarLegume(tx, userId, { id: recolteId, cultureId: existing.cultureId, plancheId, parcelleId: planche?.parcelleGeoId ?? null, date: existing.date })
        if (dar.niveau === 'bloquant') return { ok: false as const, response: NextResponse.json(corpsRefusDar(new ErreurDarEnCours(dar)), { status: 409 }) }
      }
      if (body.datePeremption !== undefined && jourCivilStocke(donnees.datePeremption) !== jourCivilStocke(existing.datePeremption)) {
        const refusPeremption = refusPeremptionAvantRecolte(existing.date, donnees.datePeremption)
        if (refusPeremption) return refuser(refusPeremption, 400, { champ: 'datePeremption' })
      }
      const updateData: Record<string, unknown> = {}
      for (const champ of ['statut','dateVente','prixKg','prixTotal','clientId','clientNom','datePeremption','notes'] as const) {
        if (body[champ] !== undefined) updateData[champ] = donnees[champ]
      }
      let prixTotal: number | null = null
      let prixKg: number | null = null
      if (statut === 'vendu') {
        // Un prix unitaire seul est une vente complète aussi pour TVA/FEC.
        // Une correction du PU recalcule le total ; un total seul déduit le PU.
        prixTotal = body.prixTotal != null ? donnees.prixTotal! :
          body.prixKg != null || existing.prixTotal == null || reliquat > 0
            ? quantiteVendue * (donnees.prixKg ?? 0) : existing.prixTotal
        prixKg = body.prixKg != null ? donnees.prixKg! : body.prixTotal != null
          ? prixTotal / quantiteVendue : existing.prixKg ?? prixTotal / quantiteVendue
        if (!(Number.isFinite(prixTotal) && prixTotal > 0 && Number.isFinite(prixKg) && prixKg > 0)) {
          return refuser('Indiquez un montant de vente strictement positif.', 400, { champ: 'prixTotal' })
        }
        if (Math.abs(quantiteVendue * prixKg - prixTotal) > 0.005) {
          return refuser('Le prix total doit correspondre à la quantité vendue multipliée par le prix unitaire.', 400, { champ: 'prixTotal' })
        }
        Object.assign(updateData, { prixTotal, prixKg })
        if (existing.factureId && (
          prixTotal !== existing.prixTotal || prixKg !== existing.prixKg ||
          donnees.dateVente?.getTime() !== existing.dateVente?.getTime() ||
          donnees.clientId !== existing.clientId || donnees.clientNom !== existing.clientNom
        )) return refuser('Cette vente est facturée : régularisez sa facture par un avoir avant de corriger les montants ou le client.', 409)
      }
      if (existing.factureId && existing.statut === 'vendu' && statut !== 'vendu') {
        const annulation = await annulerFactureLiee(tx, userId, existing.factureId)
        if (!annulation.ok) return refuser(annulation.raison, 409)
        updateData.factureId = null
      }
      if (statut === 'vendu' && donnees.creerFacture) {
        const totalHT = prixTotal! / 1.055
        const espece = existing.espece.nom ?? existing.espece.id
        const variete = existing.culture?.variete
        const description = `${espece}${variete ? ` - ${variete.nom ?? variete.id}` : ''}`
        const suivi = await tx.venteManuelle.findFirst({
          where: { userId, auto: true, sourceType: 'recolte', sourceId: recolteId },
          select: { paye: true, modeReglement: true },
        })
        const facture = await creerFacture(tx, {
          userId, type: 'facture', clientId: donnees.clientId, clientNom: donnees.clientNom ?? undefined,
          objet: `Vente de ${description}`, totalHT, totalTVA: prixTotal! - totalHT, totalTTC: prixTotal!,
          statut: suivi?.paye === false ? 'emise' : 'payee',
          datePaiement: suivi?.paye === false ? null : donnees.dateVente,
          modePaiement: modePaiementDepuisReglement(suivi?.modeReglement),
          lignes: [{ description, quantite: quantiteVendue,
            unite: libelleUniteQuantite((existing.unite ?? 'kg') as UniteQuantite, 1),
            prixUnitaire: prixKg! / 1.055, tauxTVA: 5.5,
            montantHT: totalHT, montantTVA: prixTotal! - totalHT, montantTTC: prixTotal!,
            statutBio: existing.statutBioSnapshot,
          }],
        })
        updateData.factureId = facture.id
      }
      if (sortie?.ok) {
        updateData.dateSortie = sortie.date
        // La note de la sortie s'ajoute à celle du lot au lieu de l'effacer.
        if (typeof donnees.notes === 'string' && donnees.notes && existing.notes) {
          updateData.notes = `${existing.notes} · ${donnees.notes}`.slice(0, 5000)
        }
      }
      // Remis en stock ou vendu : le jour de sortie ne décrit plus le lot.
      else if (body.statut !== undefined && !estSortieRecolte(statut)) updateData.dateSortie = null
      if (reliquat > 0) {
        updateData.quantite = sortie?.ok ? sortie.quantite : quantiteVendue
        await tx.recolte.create({ data: {
          userId, especeId: existing.especeId, cultureId: existing.cultureId,
          // Même instant de saisie que le lot : le reste d'un lot compté reste compté.
          date: existing.date, createdAt: existing.createdAt, quantite: reliquat, unite: existing.unite, statut: 'en_stock',
          // Lignée : le reliquat est une part de la récolte saisie, pas une récolte de plus.
          recolteOrigineId: existing.recolteOrigineId ?? existing.id,
          datePeremption: existing.datePeremption, statutBioSnapshot: existing.statutBioSnapshot,
          // Le reste d'une sortie garde la note du lot : c'est le même produit.
          notes: sortie?.ok ? existing.notes ?? `Reliquat de la récolte #${recolteId}` : `Reliquat non vendu de la récolte #${recolteId}`,
        } })
      }
      // Vente, sortie, remise en stock : des champs de la fiche changent.
      const recolte = await tx.recolte.update({ where: { id: recolteId }, data: { ...updateData, ...INCREMENT_VERSION },
        include: { espece: { include: { famille: true } }, culture: { include: { variete: true, planche: true } } },
      })
      if (statut === 'vendu') await createVenteFromRecolte(userId, recolte, tx)
      else if (existing.statut === 'vendu') await deleteAutoEntry('recolte', recolteId, 'vente', userId, tx)
      return { ok: true as const, recolte, avertissementsDar: dar?.rappels }
    })
    if (!resultat.ok) return resultat.response
    invalidateKpi(userId)
    return NextResponse.json({ ...masquerReferentielsEmbarques(resultat.recolte, userId), ...(resultat.avertissementsDar ? { avertissementsDar: resultat.avertissementsDar } : {}) })
  } catch (error) {
    const conflitStock = messageConflitStockCaisse(error)
    if (conflitStock) return NextResponse.json({ error: conflitStock }, { status: 409 })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ErreurCommerciale) return NextResponse.json({ error: error.message }, { status: error.status })
    if (String(error).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error('PATCH /api/recoltes/[id] error:', error)
    return NextResponse.json({ error: 'La modification de la récolte et de sa vente n’a pas été enregistrée.' }, { status: 500 })
  }
}

// DELETE /api/recoltes/[id] : source, facture et miroir réussissent ensemble.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const recolteId = Number((await params).id)
    if (!Number.isInteger(recolteId) || recolteId <= 0) return NextResponse.json({ error: 'ID de récolte invalide' }, { status: 400 })
    const userId = session!.user.id
    const resultat = await prisma.$transaction(async tx => {
      const recolte = await verrouillerRecolteLibre(tx, userId, recolteId)
      if (recolte.consommationId != null) throw new ErreurCommerciale(MESSAGE_SORTIE_CONSOMMATION, 409)
      if (recolte.cultureId == null) throw new ErreurCommerciale(MESSAGE_LOT_INVENTAIRE, 409)
      if (recolte.statut === STATUT_ECART_INVENTAIRE) throw new ErreurCommerciale(MESSAGE_ECART_INVENTAIRE, 409)
      if (recolte.factureId) {
        const liee = await annulerFactureLiee(tx, userId, recolte.factureId)
        if (!liee.ok) return liee
      }
      await deleteAutoEntry('recolte', recolteId, 'vente', userId, tx)
      // Lignée : la part la plus ancienne devient la récolte saisie des autres.
      await cederLaLignee(tx, userId, recolteId)
      await tx.recolte.delete({ where: { id: recolteId } })
      return { ok: true as const }
    })
    if (!resultat.ok) return NextResponse.json({ error: resultat.raison }, { status: 409 })
    invalidateKpi(userId)
    return NextResponse.json({ success: true, deleted: recolteId })
  } catch (error) {
    const conflitStock = messageConflitStockCaisse(error)
    if (conflitStock) return NextResponse.json({ error: conflitStock }, { status: 409 })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ErreurCommerciale) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('DELETE /api/recoltes/[id] error:', error)
    return NextResponse.json({ error: 'La suppression de la récolte et de sa vente n’a pas été enregistrée.' }, { status: 500 })
  }
}
