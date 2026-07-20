/**
 * API Factures
 * GET/POST/PATCH/DELETE /api/comptabilite/factures
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { creerFacture } from '@/lib/facture-utils'
import { invalidateKpi } from '@/lib/kpi'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const statut = searchParams.get('statut')
    const type = searchParams.get('type')
    const clientId = searchParams.get('clientId')

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    const where: any = {
      userId,
      date: { gte: startOfYear, lte: endOfYear },
    }
    if (statut) where.statut = statut
    if (type) where.type = type
    if (clientId) where.clientId = parseInt(clientId)

    const factures = await prisma.facture.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, nom: true } },
        lignes: true,
      },
    })

    // Stats
    const stats = {
      total: factures.length,
      totalHT: factures.reduce((sum, f) => sum + f.totalHT, 0),
      totalTTC: factures.reduce((sum, f) => sum + f.totalTTC, 0),
      parStatut: {
        brouillon: factures.filter(f => f.statut === 'brouillon').length,
        emise: factures.filter(f => f.statut === 'emise').length,
        payee: factures.filter(f => f.statut === 'payee').length,
        annulee: factures.filter(f => f.statut === 'annulee').length,
      },
    }

    return NextResponse.json({ data: factures, stats })
  } catch (error) {
    console.error('GET /api/comptabilite/factures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    // POSTREVIEW — Validation Zod stricte (avant : parseFloat || 0 silencieux)
    const { createFactureSchema } = await import('@/lib/validations/facture')
    const parsed = createFactureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const d = parsed.data
    const userId = session.user.id

    // Audit compta 2026-06 — avoirs bornés côté serveur : un avoir doit
    // référencer une facture d'origine du même compte, émise ou payée, et la
    // somme des avoirs ne peut pas dépasser le montant de la facture d'origine
    // (sinon revenus/TVA négatifs arbitraires).
    if (d.type === 'avoir') {
      if (!d.factureOrigineId) {
        return NextResponse.json(
          { error: "Un avoir doit référencer une facture d'origine (factureOrigineId)" },
          { status: 400 }
        )
      }
      const origine = await prisma.facture.findFirst({
        where: { id: d.factureOrigineId, userId },
        select: { id: true, numero: true, type: true, statut: true, totalTTC: true },
      })
      if (!origine || origine.type === 'avoir' || !['emise', 'payee'].includes(origine.statut)) {
        return NextResponse.json(
          { error: "Facture d'origine introuvable, annulée ou invalide pour un avoir" },
          { status: 400 }
        )
      }
      const avoirsExistants = await prisma.facture.aggregate({
        where: { userId, type: 'avoir', factureOrigineId: origine.id, statut: { not: 'annulee' } },
        _sum: { totalTTC: true },
      })
      const dejaAvoir = avoirsExistants._sum.totalTTC ?? 0
      if (dejaAvoir + d.totalTTC > origine.totalTTC + 0.01) {
        return NextResponse.json(
          {
            error: `Le total des avoirs (${(dejaAvoir + d.totalTTC).toFixed(2)} €) dépasserait le montant de la facture ${origine.numero} (${origine.totalTTC.toFixed(2)} €)`,
          },
          { status: 400 }
        )
      }
    }

    // Transaction atomique : verrouillage de l'origine + plafond des avoirs
    // + numéro facture + création. Le contrôle effectué plus haut améliore le
    // message rapide, celui-ci garantit l'invariant sous concurrence.
    const facture = await prisma.$transaction(async (tx) => {
      if (d.type === 'avoir' && d.factureOrigineId) {
        const locked = await tx.$queryRaw<Array<{ id: number; total_ttc: number }>>`
          SELECT id, total_ttc
          FROM factures
          WHERE id = ${d.factureOrigineId} AND user_id = ${userId}
          FOR UPDATE
        `
        if (locked.length !== 1) throw new Error('AVOIR_INVALIDE:Facture d’origine introuvable')
        const cumul = await tx.facture.aggregate({
          where: { userId, type: 'avoir', factureOrigineId: d.factureOrigineId, statut: { not: 'annulee' } },
          _sum: { totalTTC: true },
        })
        if ((cumul._sum.totalTTC ?? 0) + d.totalTTC > Number(locked[0].total_ttc) + 0.01) {
          throw new Error('AVOIR_INVALIDE:Le total des avoirs dépasserait le montant de la facture d’origine')
        }
      }
      return creerFacture(tx, {
        userId,
        type: d.type,
        clientId: d.clientId ?? null,
        clientNom: d.clientNom,
        clientAdresse: d.clientAdresse ?? null,
        date: d.date ?? new Date(),
        dateEcheance: d.dateEcheance ?? null,
        objet: d.objet,
        totalHT: d.totalHT,
        totalTVA: d.totalTVA,
        totalTTC: d.totalTTC,
        statut: d.statut,
        modePaiement: d.modePaiement ?? null,
        factureOrigineId: d.factureOrigineId ?? null,
        notes: d.notes ?? null,
        mentionsLegales: d.mentionsLegales ?? null,
        lignes: d.lignes.map((l) => ({
          description: l.description,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          tauxTVA: l.tauxTVA,
          montantHT: l.montantHT,
          montantTVA: l.montantTVA,
          montantTTC: l.montantTTC,
          statutBio: l.statutBio ?? null,
        })),
      })
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ data: facture }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AVOIR_INVALIDE:')) {
      return NextResponse.json({ error: error.message.slice('AVOIR_INVALIDE:'.length) }, { status: 409 })
    }
    console.error('POST /api/comptabilite/factures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.facture.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // Audit compta 2026-06 — machine à états : avant, toute transition était
    // acceptée (annulee→payee, emise→brouillon avec re-réservation de numéro,
    // brouillon→payee sans numéro définitif ni snapshot, statut arbitraire).
    if (updateData.statut !== undefined) {
      const TRANSITIONS: Record<string, string[]> = {
        brouillon: ['emise', 'payee'], // payee direct passe par le circuit d'émission
        emise: ['payee', 'annulee'],
        payee: ['emise', 'annulee'], // emise = correction de pointage ; annulee exige un avoir
        annulee: [],
      }
      const autorisees = TRANSITIONS[existing.statut] ?? []
      if (!autorisees.includes(updateData.statut)) {
        return NextResponse.json(
          {
            error: `Transition de statut invalide : ${existing.statut} → ${updateData.statut}`,
            details: autorisees.length
              ? `Transitions possibles : ${autorisees.join(', ')}`
              : 'Une facture annulée ne change plus de statut',
          },
          { status: 409 }
        )
      }
      if (existing.statut === 'payee' && updateData.statut === 'annulee') {
        const avoir = await prisma.facture.findFirst({
          where: { userId: session.user.id, type: 'avoir', factureOrigineId: existing.id, statut: { not: 'annulee' } },
          select: { id: true },
        })
        if (!avoir) {
          return NextResponse.json(
            { error: "Une facture payée ne peut être annulée qu'après émission d'un avoir" },
            { status: 409 }
          )
        }
      }
    }

    // POSTREVIEW — Transition brouillon → émise (ou payée directe) :
    // 1. Réserver un VRAI numéro via SequenceFacture (lock FOR UPDATE)
    // 2. Re-snapshot Exploitation (le régime fiscal/TVA peut avoir changé
    //    entre le brouillon et l'émission)
    // 3. Le tout dans une transaction Prisma pour atomicité
    const isEmission =
      existing.statut === 'brouillon' && ['emise', 'payee'].includes(updateData.statut)

    const facture = await prisma.$transaction(async (tx) => {
      const data: any = {}
      if (updateData.statut !== undefined) {
        data.statut = updateData.statut
        if (updateData.statut === 'payee') data.datePaiement = new Date()
        // Retour payée → émise : le paiement pointé était une erreur
        if (existing.statut === 'payee' && updateData.statut === 'emise') data.datePaiement = null
      }
      if (updateData.modePaiement !== undefined) data.modePaiement = updateData.modePaiement
      if (updateData.notes !== undefined) data.notes = updateData.notes

      if (isEmission) {
        // Import dynamique pour rester compatible avec les autres branches PATCH
        const { reserverProchainNumeroForEmission, snapshotEmetteurForEmission } = await import('@/lib/facture-utils')
        const dateEmission = new Date()
        const exercice = dateEmission.getFullYear()
        const typeSeq = existing.type === 'avoir' ? 'AVOIR' : 'FACTURE'
        const { numero } = await reserverProchainNumeroForEmission(tx, session.user.id, exercice, typeSeq)
        data.numero = numero
        data.date = dateEmission
        data.emetteurSnapshot = (await snapshotEmetteurForEmission(tx, session.user.id)) as any
      }

      return tx.facture.update({
        where: { id: parseInt(id) },
        data,
        include: { lignes: true, client: true },
      })
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ data: facture })
  } catch (error) {
    console.error('PATCH /api/comptabilite/factures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.facture.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // PROMPT 14B — obligation légale : pas de suppression définitive d'une
    // facture émise/payée. Brouillon → suppression OK. Émise → annulation
    // (statut). Payée → refus (passer par un avoir).
    if (existing.statut === 'brouillon') {
      await prisma.facture.delete({ where: { id: parseInt(id) } })
      invalidateKpi(session.user.id)
      return NextResponse.json({ success: true, action: 'deleted' })
    }
    if (existing.statut === 'payee') {
      return NextResponse.json(
        {
          error: 'Suppression interdite',
          details:
            "Une facture payée ne peut être supprimée. Émettez un avoir pour la régulariser (obligation art. 242 nonies A CGI).",
        },
        { status: 409 }
      )
    }

    // Audit 2026-07 (#8) : annuler une facture liée à une vente métier
    // (récolte, animal, bois, commande boutique) faisait disparaître le revenu
    // de TOUS les agrégats — la facture sort des totaux (annulee) mais la
    // source reste marquée « facturée » donc n'est pas recomptée non plus.
    // On bloque et on oriente vers le bon flux (dé-vente / avoir).
    const liens = await prisma.facture.findUnique({
      where: { id: parseInt(id) },
      select: {
        _count: {
          select: {
            ventesProduits: true,
            abattages: true,
            recoltesArbres: true,
            productionsBois: true,
            commandesBoutique: true,
          },
        },
      },
    })
    const nbLiens = liens
      ? liens._count.ventesProduits + liens._count.abattages + liens._count.recoltesArbres +
        liens._count.productionsBois + liens._count.commandesBoutique
      : 0
    if (nbLiens > 0) {
      return NextResponse.json(
        {
          error: 'Annulation impossible',
          details:
            "Cette facture est rattachée à une vente (récolte, animal, bois ou commande boutique). " +
            "Annulez d'abord la vente concernée (retour en stock) ou émettez un avoir — sinon le revenu " +
            "disparaîtrait des totaux comptables.",
        },
        { status: 409 }
      )
    }

    await prisma.facture.update({
      where: { id: parseInt(id) },
      data: { statut: 'annulee' },
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ success: true, action: 'cancelled' })
  } catch (error) {
    console.error('DELETE /api/comptabilite/factures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'annulation', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
