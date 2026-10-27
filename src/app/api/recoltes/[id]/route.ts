import { verrouillerRecolteLibre } from '@/lib/commercial/verrou-lot'
import { ErreurCommerciale } from '@/lib/commercial/regles'
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
import { requireAuthApi } from '@/lib/auth-utils'
import { createVenteFromRecolte, deleteAutoEntry } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { creerFacture, annulerFactureLiee } from '@/lib/facture-utils'
import { jourCivilLocal } from '@/lib/cultures/execution'
import { refusRecolteAvantDebut } from '@/lib/recolte/date-coherente'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'

type RouteParams = { params: Promise<{ id: string }> }

// Refonte stock 2026-07 : le compteur UserStockEspece.inventaire n'est plus
// ajusté à chaque mouvement de récolte. Le stock est recalculé par
// calculerStocksNet (baseline manuel + récoltes en stock − consommations),
// ce qui supprime le double comptage (audit #28). Les anciens appels à
// ajusterInventaireEspece ont donc été retirés.

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
    const validation = updateRecolteSchema.safeParse(await request.json())
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error.flatten() }, { status: 400 })
    const userId = session!.user.id
    const data = validation.data
    const resultat = await prisma.$transaction(async tx => {
      const lot = await verrouillerRecolteLibre(tx, userId, recolteId)
      if (data.quantite != null && (lot.unite ?? 'kg') !== 'kg' && !Number.isInteger(data.quantite)) {
        throw new ErreurCommerciale('Indiquez une quantité entière dans l’unité de ce lot.', 400)
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
      // Vérifier les références après le verrou, dans le même état que l’écriture.
      if (cultureCible !== lot.cultureId || especeCible !== lot.especeId || dateChange) {
        const culture = await tx.culture.findUnique({
          where: { id: cultureCible, userId },
          select: { id: true, especeId: true, dateSemis: true, datePlantation: true, semisFait: true, plantationFaite: true },
        })
        if (!culture) throw new ErreurCommerciale(`La culture #${cultureCible} n'existe pas`, 400)
        if (culture.especeId !== especeCible) return { ok: false as const, response: NextResponse.json(
          { error: `L'espèce de la récolte doit correspondre à l'espèce de la culture #${culture.id}`, champ: 'especeId' }, { status: 400 },
        ) }
        const refusDate = refusRecolteAvantDebut(culture, dateCible)
        if (refusDate) return { ok: false as const, response: NextResponse.json({ error: refusDate, champ: 'date' }, { status: 400 }) }
      }
      const recolte = await tx.recolte.update({ where: { id: recolteId }, data, include: { espece: true, culture: true } })
      return { ok: true as const, recolte }
    })
    if (!resultat.ok) return resultat.response
    invalidateKpi(userId)
    return NextResponse.json(masquerReferentielsEmbarques(resultat.recolte, userId))
  } catch (error) {
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
      let quantiteVendue = donnees.quantiteVendue ?? existing.quantite
      if (Math.abs(quantiteVendue - existing.quantite) <= 1e-9) quantiteVendue = existing.quantite
      if (statut === 'vendu' && (existing.unite ?? 'kg') !== 'kg' && !Number.isInteger(quantiteVendue)) {
        return refuser(`Un nombre entier de ${libelleUniteQuantite(existing.unite as UniteQuantite, 2)} est attendu.`, 400, { champ: 'quantiteVendue' })
      }
      const reliquat = statut === 'vendu' && existing.statut === 'en_stock' ? existing.quantite - quantiteVendue : 0
      if (donnees.clientId != null && !await tx.client.findFirst({ where: { id: donnees.clientId, userId }, select: { id: true } })) {
        return refuser('Client introuvable', 400, { champ: 'clientId' })
      }
      if (donnees.creerFacture && existing.factureId) return refuser('Cette récolte est déjà facturée', 409, { factureId: existing.factureId })
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
        const variete = existing.culture.variete
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
      if (reliquat > 0) {
        updateData.quantite = quantiteVendue
        await tx.recolte.create({ data: {
          userId, especeId: existing.especeId, cultureId: existing.cultureId,
          date: existing.date, quantite: reliquat, unite: existing.unite, statut: 'en_stock',
          datePeremption: existing.datePeremption, statutBioSnapshot: existing.statutBioSnapshot,
          notes: `Reliquat non vendu de la récolte #${recolteId}`,
        } })
      }
      const recolte = await tx.recolte.update({ where: { id: recolteId }, data: updateData,
        include: { espece: { include: { famille: true } }, culture: { include: { variete: true, planche: true } } },
      })
      if (statut === 'vendu') await createVenteFromRecolte(userId, recolte, tx)
      else if (existing.statut === 'vendu') await deleteAutoEntry('recolte', recolteId, 'vente', userId, tx)
      return { ok: true as const, recolte }
    })
    if (!resultat.ok) return resultat.response
    invalidateKpi(userId)
    return NextResponse.json(masquerReferentielsEmbarques(resultat.recolte, userId))
  } catch (error) {
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
      if (recolte.factureId) {
        const liee = await annulerFactureLiee(tx, userId, recolte.factureId)
        if (!liee.ok) return liee
      }
      await deleteAutoEntry('recolte', recolteId, 'vente', userId, tx)
      await tx.recolte.delete({ where: { id: recolteId } })
      return { ok: true as const }
    })
    if (!resultat.ok) return NextResponse.json({ error: resultat.raison }, { status: 409 })
    invalidateKpi(userId)
    return NextResponse.json({ success: true, deleted: recolteId })
  } catch (error) {
    if (error instanceof ErreurCommerciale) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('DELETE /api/recoltes/[id] error:', error)
    return NextResponse.json({ error: 'La suppression de la récolte et de sa vente n’a pas été enregistrée.' }, { status: 500 })
  }
}
