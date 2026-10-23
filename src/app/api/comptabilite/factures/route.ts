/**
 * API Factures
 * GET/POST/PATCH/DELETE /api/comptabilite/factures
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { lireAnnee } from '@/lib/api/annee'
import { creerFacture } from '@/lib/facture-utils'
import { invalidateKpi } from '@/lib/kpi'
import { clientDesigneParNom, identiteAcheteur } from '@/lib/comptabilite/rattachement-client'
import { noteLibreDeFacture } from '@/lib/facture-structuree'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    // Revue 2026-09-28 : `year=all` (impayés de tous les exercices).
    const { bornes } = lireAnnee(searchParams, 'year')
    const statut = searchParams.get('statut')
    const type = searchParams.get('type')
    const clientId = searchParams.get('clientId')

    const userId = session.user.id

    const where: Prisma.FactureWhereInput = { userId }
    if (bornes) where.date = { ...bornes }
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

    // Ticket cmsx5zhke (QA 2026-08-17) — un avoir portait le numéro de sa
    // facture d'origine RECOPIÉ dans son objet à la création. Les deux numéros
    // de facture du compte de démonstration ont été échangés le 2026-08-17 par
    // une reprise de données : le libellé figé désignait alors la mauvaise
    // facture, donc le mauvais client, alors que `facture_origine_id` et
    // `client_id` étaient justes. On expose la relation pour que l'écran lise
    // le numéro courant au lieu d'un texte gelé (règle du brain : un libellé
    // n'est jamais une clé).
    const origineIds = [
      ...new Set(
        factures
          .filter((f) => f.factureOrigineId != null)
          .map((f) => f.factureOrigineId as number),
      ),
    ]
    const origines = origineIds.length
      ? await prisma.facture.findMany({
          where: { userId, id: { in: origineIds } },
          select: { id: true, numero: true, clientId: true, clientNom: true, date: true },
        })
      : []
    const origineParId = new Map(origines.map((o) => [o.id, o]))
    const data = factures.map((f) =>
      f.factureOrigineId != null
        ? { ...f, factureOrigine: origineParId.get(f.factureOrigineId) ?? null }
        : f,
    )

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

    return NextResponse.json({ data, stats })
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
    // Facturation électronique : un avoir suit la catégorie d'opération de sa
    // facture d'origine quand l'appelant ne la précise pas (le zod vaut
    // « biens » par défaut, sans distinguer l'absence de la valeur).
    let categorieOperation: string = d.categorieOperation
    if (d.type === 'avoir') {
      if (!d.factureOrigineId) {
        return NextResponse.json(
          { error: "Un avoir doit référencer une facture d'origine (factureOrigineId)" },
          { status: 400 }
        )
      }
      const origine = await prisma.facture.findFirst({
        where: { id: d.factureOrigineId, userId },
        select: { id: true, numero: true, type: true, statut: true, totalTTC: true, categorieOperation: true },
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
      if (body.categorieOperation === undefined) categorieOperation = origine.categorieOperation
    }

    // Ticket cmvfljaru (2026-10-19, décision de revue) — fiche client. La
    // route ne devine pas : un `clientId` fourni fait foi (son identité est
    // figée par creerFacture : SIRET, SIREN, TVA intracommunautaire, et son
    // exonération de TVA s'applique), `null` = facture sans fiche, choix
    // explicite de l'écran. Absent, la facture part sans fiche ; mais si le
    // nom saisi désigne exactement UNE fiche active, la route refuse plutôt
    // que de produire, sans le dire, une facture sans SIRET pour un client
    // professionnel connu (ou de rattacher une fiche que personne n'a vue).
    const clientId: number | null = d.clientId ?? null
    // 2026-10-23 — une fiche d'un autre compte (ou disparue) était ignorée en
    // silence par `creerFacture` : facture émise sans client ni SIRET, sans
    // un mot. Le refus nomme le champ.
    if (clientId != null) {
      const fiche = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
      if (!fiche) {
        return NextResponse.json({ error: 'Client introuvable', champ: 'clientId' }, { status: 400 })
      }
    }
    if (d.clientId === undefined && d.type !== 'avoir' && d.clientNom?.trim()) {
      const fiches = await prisma.client.findMany({
        where: { userId, actif: true },
        select: { id: true, nom: true },
      })
      const fiche = clientDesigneParNom(fiches, d.clientNom)
      if (fiche) {
        return NextResponse.json(
          {
            error: `Une fiche client porte ce nom (« ${fiche.nom} ») : choisissez-la ou facturez sans fiche.`,
            champ: 'clientId',
            clientIdPropose: fiche.id,
          },
          { status: 409 }
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
        clientId,
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
        categorieOperation,
        dateLivraison: d.dateLivraison ?? null,
        adresseLivraison: d.adresseLivraison || null,
        codePostalLivraison: d.codePostalLivraison || null,
        villeLivraison: d.villeLivraison || null,
        paysLivraison: d.paysLivraison || null,
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

    // Facturation électronique (lot 1) : la catégorie d'opération et la
    // livraison sont des mentions, pas des montants ; elles restent
    // corrigeables tant que la facture n'est pas annulée (les factures émises
    // avant le 2026-10-13 valent « biens » par défaut).
    const CHAMPS_MENTIONS = ['categorieOperation', 'dateLivraison', 'adresseLivraison', 'codePostalLivraison', 'villeLivraison', 'paysLivraison'] as const
    const mentionsFournies = CHAMPS_MENTIONS.filter((k) => updateData[k] !== undefined)
    let mentions: Record<string, unknown> = {}
    if (mentionsFournies.length) {
      if (existing.statut === 'annulee') {
        return NextResponse.json({ error: 'Une facture annulée ne se modifie plus' }, { status: 409 })
      }
      const { mentionsFactureSchema } = await import('@/lib/validations/facture')
      const parsedMentions = mentionsFactureSchema.safeParse(updateData)
      if (!parsedMentions.success) {
        return NextResponse.json({ error: 'Données invalides', details: parsedMentions.error.flatten() }, { status: 400 })
      }
      mentions = Object.fromEntries(
        mentionsFournies.map((k) => {
          const v = parsedMentions.data[k]
          return [k, k === 'dateLivraison' ? v ?? null : v || null]
        }),
      )
    }

    // Ticket cmvflhyyu (2026-10-19) — les notes saisies figurent sur le PDF et
    // dans le Factur-X : elles font partie du document, donc ne changent plus
    // une fois la facture émise (corriger passe par un avoir), comme les
    // montants. Un brouillon reste modifiable.
    // Même normalisation que le texte imprimé (`noteLibreDeFacture` : vide
    // ≡ absent, espaces ignorés) ; un brouillon valide ses notes comme le POST.
    if (updateData.notes !== undefined && existing.statut === 'brouillon') {
      const { notesFactureSchema } = await import('@/lib/validations/facture')
      const parsedNotes = notesFactureSchema.safeParse(updateData.notes)
      if (!parsedNotes.success) {
        return NextResponse.json(
          { error: parsedNotes.error.issues[0]?.message ?? 'Notes invalides', champ: 'notes' },
          { status: 400 }
        )
      }
    }
    if (
      updateData.notes !== undefined &&
      existing.statut !== 'brouillon' &&
      noteLibreDeFacture({ notes: typeof updateData.notes === 'string' ? updateData.notes : null, objet: existing.objet ?? null }) !==
        noteLibreDeFacture({ notes: existing.notes ?? null, objet: existing.objet ?? null })
    ) {
      return NextResponse.json(
        {
          error: "Notes non modifiables : elles figurent sur la facture émise. Émettez un avoir puis une nouvelle facture pour les corriger.",
          champ: 'notes',
        },
        { status: 409 }
      )
    }

    const facture = await prisma.$transaction(async (tx) => {
      const data: Prisma.FactureUncheckedUpdateInput = { ...(mentions as Prisma.FactureUncheckedUpdateInput) }
      if (updateData.statut !== undefined) {
        data.statut = updateData.statut
        if (updateData.statut === 'payee') data.datePaiement = new Date()
        // Retour payée → émise : le paiement pointé était une erreur
        if (existing.statut === 'payee' && updateData.statut === 'emise') data.datePaiement = null
      }
      if (updateData.modePaiement !== undefined) data.modePaiement = updateData.modePaiement
      // Notes : écrites sur un brouillon seulement (émise : refusées plus haut si
      // le texte imprimé change, inutiles sinon).
      if (updateData.notes !== undefined && existing.statut === 'brouillon') data.notes = updateData.notes

      if (isEmission) {
        // Import dynamique pour rester compatible avec les autres branches PATCH
        const { reserverProchainNumeroForEmission, snapshotEmetteurForEmission } = await import('@/lib/facture-utils')
        const dateEmission = new Date()
        const exercice = dateEmission.getFullYear()
        const typeSeq = existing.type === 'avoir' ? 'AVOIR' : 'FACTURE'
        const { numero } = await reserverProchainNumeroForEmission(tx, session.user.id, exercice, typeSeq)
        data.numero = numero
        data.date = dateEmission
        // Json? : `null` (pas d'exploitation) est passé tel quel, comme avant.
        data.emetteurSnapshot = (await snapshotEmetteurForEmission(tx, session.user.id)) as unknown as Prisma.InputJsonValue
        // L'identité de l'acheteur est figée au même moment que celle de l'émetteur.
        if (existing.clientId) {
          const client = await tx.client.findFirst({ where: { id: existing.clientId, userId: session.user.id } })
          if (client) Object.assign(data, identiteAcheteur(client))
        }
      }

      // TICKET cmsogchrf — le pointage « payée » se propage aux ventes sources
      // liées (relation factureId), sinon la vente reste affichée impayée dans
      // Transactions alors que sa facture est soldée. La sync inverse
      // vente→facture existe déjà (api/elevage/ventes). Parmi les sources
      // liables à une facture, seul VenteProduit porte un champ `paye`
      // (RecolteArbre/ProductionBois n'ont qu'un statut, sans notion de
      // règlement) ; VenteProduit n'a pas de datePaiement.
      if (updateData.statut === 'payee') {
        await tx.venteProduit.updateMany({
          where: { factureId: existing.id, userId: session.user.id },
          data: { paye: true },
        })
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
