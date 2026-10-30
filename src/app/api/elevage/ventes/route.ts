import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
/**
 * API Ventes de produits
 * GET /api/elevage/ventes - Liste des ventes
 * POST /api/elevage/ventes - Enregistrer une vente
 * PATCH /api/elevage/ventes - Modifier une vente (ex: marquer payé)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { enrichirVentesElevageReglements } from '@/lib/comptabilite/projection-reglements'
import { Prisma, type VenteProduit } from '@prisma/client'
import { lireAnnee } from '@/lib/api/annee'
import {
  StockFromageError,
  recalerEtatLotFromage,
  refusStockFromage,
  stockDuLotFromage,
  verrouillerEtVerifierStockFromage,
} from '@/lib/elevage/stock-fromage'
import { sortieCaveDepuisVente } from '@/lib/elevage/cave-fromage'
import { createVenteFromVenteProduit, deleteAutoEntry } from '@/lib/auto-compta'
import { creerFacture, annulerFactureLiee } from '@/lib/facture-utils'
import { venteProduitSchema, venteProduitTypeSchema } from '@/lib/validations/elevage-vente'
import { modeReglementSchema, modePaiementDepuisReglement } from '@/lib/validations/reglement'
import { chargerSuiviDesSources, cleSource } from '@/lib/comptabilite/suivi-ecriture'
import { ReglementVenteError } from '@/lib/comptabilite/reglement-vente'
import { cleSourceReglement } from '@/lib/comptabilite/cle-reglement'
import { verifierPointageDetaille } from '@/lib/comptabilite/suivi-reglement-source'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
import { invalidateKpi } from '@/lib/kpi'
import { ErreurElevage } from '@/lib/elevage/erreurs'
import {
  StockOeufsVenteError,
  supprimerStockOeufsVente,
  synchroniserStockOeufsVente,
} from '@/lib/elevage/stock-oeufs-vente'
import {
  StockRucheError,
  supprimerStockRucheVente,
  synchroniserStockRucheVente,
} from '@/lib/elevage/stock-ruche'
import {
  estVenteProduitRuche,
  tauxTvaVenteProduitParDefaut,
} from '@/lib/elevage/produits-ruche'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000)
    // Revue 2026-09-28 : `annee=all` pour la liste de gestion d'un historique.
    const { annee, bornes } = lireAnnee(searchParams)

    const where: Prisma.VenteProduitWhereInput = { userId: session.user.id, annule: { not: true } }
    if (bornes) where.date = { ...bornes }
    if (type) where.type = type
    if (dateDebut || dateFin) {
      const date: Prisma.DateTimeFilter = { ...bornes }
      if (dateDebut) date.gte = new Date(dateDebut)
      if (dateFin) date.lte = new Date(dateFin)
      where.date = date
    }
    // Filtre par statut de paiement
    const payeParam = searchParams.get('paye')
    if (payeParam !== null) {
      where.paye = payeParam === 'true'
    }

    const ventes = await prisma.venteProduit.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        destination: true,
      },
    })

    // Stats agrégées
    const stats = await prisma.venteProduit.aggregate({
      where,
      _sum: { prixTotal: true },
      _count: true,
    })

    // Stats par type
    const statsParType = await prisma.venteProduit.groupBy({
      by: ['type', 'unite'],
      where,
      _sum: { prixTotal: true, quantite: true },
      _count: true,
    })

    const suivi = await chargerSuiviDesSources(session.user.id, {
      sources: ventes.filter((v) => !v.factureId).map((v) => ({ sourceType: 'vente_produit', sourceId: v.id })),
    })
    const parType = new Map<string, { type: string; total: number; count: number; quantiteParUnite: Record<string, number> }>()
    for (const s of statsParType) {
      const ligne = parType.get(s.type) ?? { type: s.type, total: 0, count: 0, quantiteParUnite: {} }
      ligne.total += s._sum.prixTotal ?? 0
      ligne.count += s._count
      ligne.quantiteParUnite[s.unite] = (ligne.quantiteParUnite[s.unite] ?? 0) + (s._sum.quantite ?? 0)
      parType.set(s.type, ligne)
    }
    return NextResponse.json({
      data: (await enrichirVentesElevageReglements(session.user.id, ventes)).map((v) => ({ ...v, modeReglement: suivi.parSource.get(cleSource('vente_produit', v.id))?.suivi.modeReglement ?? null })),
      stats: {
        totalVentes: stats._sum.prixTotal || 0,
        nbVentes: stats._count,
        parType: [...parType.values()].map((s) => {
          const unites = Object.keys(s.quantiteParUnite)
          return { ...s, quantite: unites.length === 1 ? s.quantiteParUnite[unites[0]] : null, unite: unites.length === 1 ? unites[0] : null }
        }),
      },
      meta: { year: annee, total: ventes.length },
    })
  } catch (error) {
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('GET /api/elevage/ventes error:', error)
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
    const parsed = venteProduitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { date, type, description, quantite, unite, prixUnitaire, client, destinationId, paye, tauxTVA, cessionGratuite } = parsed.data
    const tauxTVAFinal = tauxTVA ?? tauxTvaVenteProduitParDefaut(type)
    let notes = parsed.data.notes ?? null
    const prixTotal = quantite * prixUnitaire

    // Ticket cms1vqsqu — vente d'animal vivant à 0 € sans garde-fou.
    // La validation stricte n'est appliquée QUE si le body porte le marqueur
    // `validationVente: true` (posé par le formulaire Ventes) : le flux
    // « Vendre » de la fiche animal (AnimauxTab) poste sans ce marqueur et ne
    // doit pas casser ; ses lignes à 0 € sont couvertes par le badge
    // « À qualifier » côté UI.
    if (type === 'animal_vivant' && parsed.data.validationVente === true) {
      if (!cessionGratuite && prixUnitaire <= 0) {
        return NextResponse.json(
          { error: 'Prix manquant pour une vente d\'animal vivant : saisissez un prix, ou cochez « Cession à titre gratuit » s\'il s\'agit d\'un don.' },
          { status: 400 }
        )
      }
      if (!client || !client.trim()) {
        return NextResponse.json(
          { error: 'Le nom de l\'acquéreur est requis pour la cession d\'un animal vivant (traçabilité).' },
          { status: 400 }
        )
      }
    }
    if (cessionGratuite && prixUnitaire > 0) {
      return NextResponse.json(
        { error: 'Une cession à titre gratuit doit avoir un prix de 0 € — décochez « Cession à titre gratuit » ou mettez le prix à 0.' },
        { status: 400 }
      )
    }
    // Convention (pas de colonne cessionGratuite sur VenteProduit) : une
    // cession gratuite est matérialisée par prixTotal 0 + notes préfixées.
    const PREFIXE_CESSION = '[Cession gratuite]'
    if (cessionGratuite && !(notes ?? '').startsWith(PREFIXE_CESSION)) {
      notes = notes ? `${PREFIXE_CESSION} ${notes}` : PREFIXE_CESSION
    }

    // Ticket cmsoge7t9 — un lotFromageId posé sur un autre type contournerait le
    // décrément du stock de cave (la sortie n'est créée que pour type 'fromage').
    if (parsed.data.lotFromageId && type !== 'fromage') {
      return NextResponse.json(
        { error: 'Une vente liée à un lot de fromage doit être de type fromage' },
        { status: 400 }
      )
    }

    // Review caprin 2026-07-21 — vente de fromage : une action unique doit
    // décrémenter le stock de cave ET enregistrer la recette ET tracer le lot.
    // On valide l'appartenance du lot + le stock disponible AVANT la transaction.
    // La sortie de cave est dérivée de l'unité de vente (`sortieCaveDepuisVente`,
    // règle partagée avec la valorisation de la cave) : kg ou g → poids, pièce
    // ou unité → pièces ; toute autre unité est refusée en nommant le champ.
    let fromageSortie: { lotFromageId: string; nbPieces: number; poidsKg: number } | null = null
    if (type === 'fromage') {
      const lotFromageId = parsed.data.lotFromageId
      if (!lotFromageId) {
        return NextResponse.json(
          { error: 'Pour une vente de fromage, sélectionnez le lot de fabrication (traçabilité + stock de cave).' },
          { status: 400 }
        )
      }
      const sortie = sortieCaveDepuisVente(quantite, unite)
      if (!sortie.ok) {
        return NextResponse.json(
          { error: sortie.message, details: { fieldErrors: { [sortie.champ]: [sortie.message] } } },
          { status: 400 }
        )
      }
      const lot = await prisma.lotFromage.findFirst({
        where: { id: lotFromageId, userId: session.user.id },
        include: { mouvements: { select: { nbPieces: true, poidsKg: true } } },
      })
      if (!lot) {
        return NextResponse.json({ error: 'Lot de fromage introuvable dans votre cave.' }, { status: 400 })
      }
      const refus = refusStockFromage(stockDuLotFromage(lot), sortie.nbPieces, sortie.poidsKg)
      if (refus) {
        return NextResponse.json({ error: refus }, { status: 409 })
      }
      fromageSortie = { lotFromageId, nbPieces: sortie.nbPieces, poidsKg: sortie.poidsKg }
    }

    // Bug cmp8rzcjc (Marc 2026-05-16) — pour une vente d'animal vivant,
    // on exige que `animalId` référence un animal du cheptel de l'utilisateur
    // (statut actif), sinon on crée des ventes fantômes (ex: "Clochette"
    // alors qu'aucun animal ne s'appelle Clochette). On laisse les autres
    // types (oeufs/viande/lait/autre) passer sans contrainte animal.
    if (type === 'animal_vivant') {
      if (quantite !== 1) {
        return NextResponse.json({ error: 'Une vente individuelle porte sur un seul animal.' }, { status: 400 })
      }
      if (!parsed.data.animalId) {
        return NextResponse.json(
          { error: 'Pour une vente d\'animal vivant, sélectionnez un animal du cheptel.' },
          { status: 400 }
        )
      }
      const animal = await prisma.animal.findFirst({
        where: { id: parsed.data.animalId, userId: session.user.id },
        select: { id: true, statut: true },
      })
      if (!animal) {
        return NextResponse.json(
          { error: 'Animal introuvable dans votre cheptel.' },
          { status: 400 }
        )
      }
      if (animal.statut !== 'actif') {
        return NextResponse.json(
          { error: `Cet animal n'est plus actif (statut: ${animal.statut}). Impossible de l'enregistrer en vente.` },
          { status: 400 }
        )
      }
    }

    // QA 2026-05-15 — garde-fou anti-saisie aberrante : un test a fait
    // remonter en compta une ligne "999 999 douzaines d'œufs à 4€ = 4M€".
    // On bloque toute vente unitaire > 100 000 € à la saisie ; les
    // ventes en gros au-dessus passent via un POST dédié confirmé.
    const SEUIL_VENTE_PRODUIT = 100_000
    if (prixTotal > SEUIL_VENTE_PRODUIT) {
      return NextResponse.json(
        {
          error: `Saisie aberrante : ${quantite} ${unite ?? 'unités'} × ${prixUnitaire} € = ${prixTotal.toFixed(2)} €. Au-dessus de ${SEUIL_VENTE_PRODUIT} €, contactez l'administrateur ou découpez la saisie.`,
        },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session.user.id)
      if (type === 'animal_vivant' && parsed.data.animalId) {
        await tx.$queryRaw`SELECT id FROM animaux WHERE id = ${parsed.data.animalId} AND user_id = ${session.user.id} FOR UPDATE`
        const animal = await tx.animal.findFirst({ where: { id: parsed.data.animalId, userId: session.user.id } })
        if (!animal || animal.statut !== 'actif') {
          throw new ErreurElevage("Cet animal n'est plus disponible à la vente. Rechargez le cheptel.")
        }
      }
      // Contrôle autoritatif sous verrou : le pré-contrôle ci-dessus améliore le
      // message, celui-ci empêche deux requêtes concurrentes de sur-vendre.
      if (fromageSortie) {
        await verrouillerEtVerifierStockFromage(
          tx,
          session.user.id,
          fromageSortie.lotFromageId,
          fromageSortie.nbPieces,
          fromageSortie.poidsKg
        )
      }
      const vente = await tx.venteProduit.create({
        data: {
          userId: session.user.id,
          date: date || new Date(),
          type,
          description,
          quantite,
          unite,
          prixUnitaire,
          prixTotal,
          client,
          destinationId,
          paye,
          tauxTVA: tauxTVAFinal,
          notes,
          // Audit élevage 2026-06-11 — garder le lien vente→animal pour que
          // l'annulation puisse restaurer le statut de l'animal.
          animalId: type === 'animal_vivant' ? parsed.data.animalId ?? null : null,
          // Review caprin 2026-07-21 — traçabilité fromage vente→lot.
          lotFromageId: fromageSortie ? fromageSortie.lotFromageId : null,
        },
        include: {
          destination: true,
        },
      })

      if (type === 'oeufs') {
        await synchroniserStockOeufsVente(tx, {
          userId: session.user.id,
          venteId: vente.id,
          date: vente.date,
          quantite: vente.quantite,
          unite: vente.unite,
        })
      }
      if (estVenteProduitRuche(type)) {
        await synchroniserStockRucheVente(tx, {
          userId: session.user.id,
          venteId: vente.id,
          type: vente.type,
          date: vente.date,
          quantite: vente.quantite,
          unite: vente.unite,
        })
      }

      // Si vente d'animal vivant, mettre à jour le statut de l'animal
      if (type === 'animal_vivant' && parsed.data.animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: parsed.data.animalId, userId: session.user.id },
        })
        if (animal) {
          await tx.animal.update({
            where: { id: animal.id },
            data: {
              statut: 'vendu',
              dateSortie: date || new Date(),
              causeSortie: 'Vente',
            },
          })
        }
      }

      // Vente de fromage : sortie de cave liée (décrément de stock) + passage
      // du lot à 'ecoule' dès qu'il n'a plus de pièce en cave — même règle que
      // POST /mouvements-fromage (`recalerEtatLotFromage`).
      if (fromageSortie) {
        await tx.mouvementFromage.create({
          data: {
            userId: session.user.id,
            lotFromageId: fromageSortie.lotFromageId,
            date: date || new Date(),
            type: 'sortie_vente',
            nbPieces: fromageSortie.nbPieces,
            poidsKg: fromageSortie.poidsKg,
            venteProduitId: vente.id,
            notes: client ? `Vente ${client}` : null,
          },
        })
        await recalerEtatLotFromage(tx, session.user.id, fromageSortie.lotFromageId, 'sortie')
      }

      await createVenteFromVenteProduit(session.user.id, {
        id: vente.id,
        type: vente.type,
        description: vente.description,
        prixTotal: vente.prixTotal,
        quantite: vente.quantite,
        unite: vente.unite,
        prixUnitaire: vente.prixUnitaire,
        client: vente.client,
        date: vente.date,
        tauxTVA: vente.tauxTVA,
        paye: vente.paye,
        modeReglement: parsed.data.modeReglement,
      }, tx)

      return vente
    })
    invalidateKpi(session.user.id)

    // Review caprin 2026-07-22 — alerte (non bloquante) à la vente de LAIT CRU
    // s'il existe un délai d'attente lait actif. La vente de lait cru n'étant pas
    // liée à des animaux précis, on ne peut pas bloquer avec certitude : on
    // avertit l'éleveur de vérifier l'origine du lait.
    let warning: string | null = null
    if (type === 'lait') {
      const saleDate = date || new Date()
      const attentes = await prisma.soinAnimal.findMany({
        where: { userId: session.user.id, fait: true, finAttenteLait: { gte: saleDate } },
        select: {
          finAttenteLait: true,
          animal: { select: { id: true, nom: true, identifiant: true } },
          lot: { select: { id: true, nom: true } },
        },
        orderBy: { finAttenteLait: 'desc' },
        take: 20,
      })
      if (attentes.length > 0) {
        const cibles = attentes.map((a) =>
          a.animal ? a.animal.nom || a.animal.identifiant || `#${a.animal.id}` : a.lot?.nom || `lot #${a.lot?.id}`
        )
        const apercu = [...new Set(cibles)].slice(0, 3).join(', ')
        const finMax = attentes[0].finAttenteLait
        warning =
          `⚠ Délai d'attente lait actif sur ${attentes.length} traitement(s) (${apercu}${cibles.length > 3 ? '…' : ''}` +
          `${finMax ? `, jusqu'au ${finMax.toLocaleDateString('fr-FR')}` : ''}). Vérifiez que ce lait n'en provient pas.`
      }
    }

    return NextResponse.json({ data: result, warning }, { status: 201 })
  } catch (error) {
    if (error instanceof ErreurElevage) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof StockOeufsVenteError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof StockFromageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof StockRucheError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
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

    const existing = await prisma.venteProduit.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    if (existing.annule) {
      return NextResponse.json({ error: 'Vente déjà annulée' }, { status: 409 })
    }

    // Audit élevage 2026-06-11 — annuler une vente d'animal vivant doit
    // rendre l'animal au cheptel (il restait 'vendu' définitivement).
    // On ne restaure que si l'animal est toujours en statut 'vendu'.
    const annulation = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session.user.id)
      await tx.$queryRaw`SELECT id FROM ventes_produits WHERE id = ${existing.id} AND user_id = ${session.user.id} FOR UPDATE`
      const courante = await tx.venteProduit.findFirst({ where: { id: existing.id, userId: session.user.id } })
      if (!courante || courante.annule) throw new ErreurElevage('Vente déjà annulée ou introuvable. Rechargez la liste.')
      // Symétrie annulation ↔ facture + miroir dans la même transaction.
      if (courante.factureId) {
        const liee = await annulerFactureLiee(tx, session.user.id, courante.factureId)
        if (!liee.ok) return liee
      }
      await deleteAutoEntry('vente_produit', existing.id, 'vente', session.user.id, tx)

      // Soft-delete : marquer comme annule au lieu de supprimer
      await tx.venteProduit.update({
        where: { id: existing.id },
        data: { annule: true, dateAnnulation: new Date() },
      })
      if (courante.type === 'oeufs') {
        await supprimerStockOeufsVente(tx, session.user.id, existing.id)
      }
      if (estVenteProduitRuche(courante.type)) {
        await supprimerStockRucheVente(tx, session.user.id, existing.id)
      }

      if (courante.type === 'animal_vivant' && courante.animalId) {
        await tx.animal.updateMany({
          where: { id: courante.animalId, userId: session.user.id, statut: 'vendu' },
          data: { statut: 'actif', dateSortie: null, causeSortie: null },
        })
      }

      // Vente de fromage annulée : supprimer la (les) sortie(s) de cave liée(s)
      // pour restaurer le stock, puis recalculer l'état du lot (un lot passé à
      // 'ecoule' par cette vente redevient 'pret' s'il reste du stock).
      if (courante.type === 'fromage' && courante.lotFromageId) {
        await tx.mouvementFromage.deleteMany({
          where: { venteProduitId: existing.id, userId: session.user.id },
        })
        await recalerEtatLotFromage(tx, session.user.id, courante.lotFromageId, 'retour')
      }
      return { ok: true as const }
    })
    if (!annulation.ok) {
      return NextResponse.json({ error: annulation.raison }, { status: 409 })
    }
    invalidateKpi(session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ErreurElevage) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof StockOeufsVenteError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof StockRucheError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, paye, client, notes } = body

    const mode = modeReglementSchema.safeParse(body.modeReglement)
    if (!mode.success || (paye !== undefined && typeof paye !== 'boolean')) {
      return NextResponse.json({ error: 'Règlement invalide' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.venteProduit.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    // Une vente annulée ne se modifie plus : un PATCH recréait l'écriture
    // auto-compta (revenu fantôme) voire émettait une facture.
    if (existing.annule) {
      return NextResponse.json(
        { error: 'Vente annulée — modification impossible' },
        { status: 409 }
      )
    }

    // Review caprin 2026-07-21 — une vente de fromage est liée à une sortie de
    // cave (MouvementFromage) créée au POST ; le PATCH ne resynchronise pas le
    // stock. On interdit donc de changer la quantité/unité/type d'une vente
    // fromage (annuler + resaisir pour rester cohérent). Prix/paye/client/notes
    // restent modifiables (sans impact stock).
    if (existing.lotFromageId) {
      const changeStock =
        (body.quantite !== undefined && Number(body.quantite) !== existing.quantite) ||
        (body.unite !== undefined && body.unite !== existing.unite) ||
        (body.type !== undefined && body.type !== existing.type)
      if (changeStock) {
        return NextResponse.json(
          { error: 'Vente de fromage : la quantité/unité impacte le stock de cave. Annulez cette vente et resaisissez-la.' },
          { status: 409 }
        )
      }
    }

    // Les champs sont relus (recalcul du total, facture sur les valeurs
    // finales) : valeurs scalaires du modèle, pas des opérations Prisma.
    const updateData: Partial<VenteProduit> = {}
    if (paye !== undefined) updateData.paye = paye
    if (client !== undefined) updateData.client = client
    if (notes !== undefined) updateData.notes = notes

    // Audit 2026-07 (#15) : le PATCH ignorait date, type, quantité, prix,
    // unité et description — l'édition affichait un succès mais ne changeait
    // rien (CA/TVA/écriture auto calculés sur l'ancien prix). On les persiste.
    if (body.date !== undefined) {
      const date = new Date(body.date)
      if (!Number.isFinite(date.getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      updateData.date = date
    }
    if (body.type !== undefined) {
      const typeParse = venteProduitTypeSchema.safeParse(body.type)
      if (!typeParse.success) {
        return NextResponse.json({ error: 'Type de vente invalide' }, { status: 400 })
      }
      updateData.type = typeParse.data
      if (typeParse.data !== existing.type) {
        return NextResponse.json({ error: 'Pour changer le type de produit, annulez cette vente puis saisissez une nouvelle vente.' }, { status: 409 })
      }
      if (body.tauxTVA === undefined && typeParse.data !== existing.type) {
        updateData.tauxTVA = tauxTvaVenteProduitParDefaut(typeParse.data)
      }
    }
    if (body.description !== undefined) updateData.description = body.description || null
    if (body.unite !== undefined) updateData.unite = body.unite
    if (body.quantite !== undefined) {
      const q = parseFloat(String(body.quantite))
      if (!Number.isFinite(q) || q <= 0) {
        return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
      }
      updateData.quantite = q
    }
    if (body.prixUnitaire !== undefined) {
      const pu = parseFloat(String(body.prixUnitaire))
      if (!Number.isFinite(pu) || pu < 0) {
        return NextResponse.json({ error: 'Prix unitaire invalide' }, { status: 400 })
      }
      updateData.prixUnitaire = pu
    }
    if (body.tauxTVA !== undefined) {
      const t = parseFloat(String(body.tauxTVA))
      if (!Number.isFinite(t) || t < 0 || t > 100) return NextResponse.json({ error: 'TVA invalide' }, { status: 400 })
      updateData.tauxTVA = t
    }
    // Recalcul du total si quantité ou prix unitaire changent.
    if (updateData.quantite !== undefined || updateData.prixUnitaire !== undefined) {
      const q = updateData.quantite ?? existing.quantite
      const pu = updateData.prixUnitaire ?? existing.prixUnitaire
      updateData.prixTotal = q * pu
    }
    // Cohérence compta : une vente "Payé" ne peut pas être à 0 € (cf POST).
    // Ticket cms1vqsqu — exception : cession gratuite (convention notes
    // préfixées « [Cession gratuite] », il n'y a rien à encaisser).
    const payeFinal = updateData.paye ?? existing.paye
    if (existing.factureId) {
      const modifies = Object.entries(updateData).some(([champ, valeur]) => {
        if (champ === 'notes') return false
        const avant = existing[champ as keyof VenteProduit]
        return valeur instanceof Date && avant instanceof Date ? valeur.getTime() !== avant.getTime() : valeur !== avant
      })
      if (modifies || body.modeReglement !== undefined) {
        return NextResponse.json({ error: 'Cette vente est facturée. Suivez son règlement dans Factures ; une correction des montants passe par un avoir.', factureId: existing.factureId }, { status: 409 })
      }
    }
    const prixTotalFinal = updateData.prixTotal ?? existing.prixTotal
    const notesFinales = String((updateData.notes ?? existing.notes) ?? '')
    if (payeFinal === true && prixTotalFinal === 0 && !notesFinales.startsWith('[Cession gratuite]')) {
      return NextResponse.json(
        { error: 'Une vente payée ne peut pas être à 0 € : décochez « Vente payée » ou saisissez un prix.' },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // Anti-double-facture : une vente déjà facturée ne peut pas générer
    // une seconde facture (l'ancienne resterait comptée dans KPI/TVA/FEC).
    if (body.creerFacture && existing.factureId) {
      return NextResponse.json(
        { error: 'Cette vente est déjà facturée', factureId: existing.factureId },
        { status: 409 }
      )
    }

    // Revue 2026-10-19, refus muet corrigé le 2026-10-23 — `creerFacture`
    // ignorait en silence la fiche d'un autre compte (ou disparue) : la facture
    // partait sans client, SIRET ni exonération, et la réponse disait « OK ».
    // Même contrôle que les PATCH de récolte et de bois, avant la transaction.
    if (body.creerFacture && (updateData.prixTotal ?? existing.prixTotal) && body.clientId != null && body.clientId !== '') {
      const clientIdFacture = Number(body.clientId)
      const clientOk = Number.isInteger(clientIdFacture)
        ? await prisma.client.findFirst({ where: { id: clientIdFacture, userId }, select: { id: true } })
        : null
      if (!clientOk) {
        return NextResponse.json({ error: 'Client introuvable', champ: 'clientId' }, { status: 400 })
      }
      body.clientId = clientIdFacture
    }

    // Transaction atomique : facture + update vente
    const vente = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session.user.id)
      await tx.$queryRaw`SELECT id FROM ventes_produits WHERE id = ${existing.id} AND user_id = ${userId} FOR UPDATE`
      const courante = await tx.venteProduit.findFirst({ where: { id: existing.id, userId } })
      const aChange = !courante || Object.entries(existing).some(([champ, avant]) => {
        const apres = courante[champ as keyof VenteProduit]
        return avant instanceof Date && apres instanceof Date ? avant.getTime() !== apres.getTime() : avant !== apres
      })
      if (aChange) {
        throw new ReglementVenteError('Cette vente a changé. Rechargez la liste avant de la modifier.')
      }
      if (!courante.factureId) {
        const projection = await verifierPointageDetaille(tx, userId, cleSourceReglement('vente', 'vente_produit', courante.id), updateData.prixTotal ?? courante.prixTotal, typeof updateData.paye === 'boolean' ? updateData.paye : undefined)
        Object.assign(updateData, projection)
      }
      // Revue élevage 2026-07-21 — la facture était construite sur les ANCIENNES
      // valeurs (existing.*) même quand le même PATCH modifiait prix/quantité →
      // document légal ≠ vente ≠ compta. On facture sur les valeurs FINALES.
      const totalFinal = updateData.prixTotal ?? existing.prixTotal
      if (body.creerFacture && totalFinal) {
        const typeF = updateData.type ?? existing.type
        const descF = updateData.description ?? existing.description
        const qteF = updateData.quantite ?? existing.quantite
        const uniteF = updateData.unite ?? existing.unite
        const puF = updateData.prixUnitaire ?? existing.prixUnitaire
        const dateF = updateData.date ?? existing.date
        // Audit #25 : `|| 5.5` transformait un taux 0 % explicite (exonéré) en
        // 5,5 %. On ne retombe sur 5,5 que si le taux est réellement absent.
        const tva = updateData.tauxTVA ?? existing.tauxTVA ?? 5.5
        const totalHT = totalFinal / (1 + tva / 100)
        const totalTVA = totalFinal - totalHT

        const facture = await creerFacture(tx, {
          userId,
          // POSTREVIEW — Toujours 'facture' (la sémantique métier est dans objet/sourceType)
          type: 'facture',
          clientId: body.clientId || null,
          clientNom: (updateData.client !== undefined ? updateData.client : existing.client) || undefined,
          date: dateF,
          objet: `Vente de ${typeF} - ${descF || ''}`,
          totalHT,
          totalTVA,
          totalTTC: totalFinal,
          statut: payeFinal ? 'payee' : 'emise',
          datePaiement: payeFinal ? new Date() : null,
          modePaiement: body.modePaiement || modePaiementDepuisReglement(mode.data !== undefined ? mode.data : (await tx.venteManuelle.findFirst({ where: { userId, auto: true, sourceType: 'vente_produit', sourceId: existing.id }, select: { modeReglement: true } }))?.modeReglement),
          lignes: [{
            description: `${typeF} - ${descF || ''}`,
            quantite: qteF,
            unite: uniteF,
            prixUnitaire: puF / (1 + tva / 100),
            tauxTVA: tva,
            montantHT: totalHT,
            montantTVA: totalTVA,
            montantTTC: totalFinal,
          }],
        })

        updateData.factureId = facture.id
      }

      const updated = await tx.venteProduit.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          destination: true,
        },
      })
      if (updated.type === 'oeufs') {
        await synchroniserStockOeufsVente(tx, {
          userId,
          venteId: updated.id,
          date: updated.date,
          quantite: updated.quantite,
          unite: updated.unite,
        })
      } else if (existing.type === 'oeufs') {
        await supprimerStockOeufsVente(tx, userId, existing.id)
      }
      if (estVenteProduitRuche(updated.type)) {
        await synchroniserStockRucheVente(tx, {
          userId,
          venteId: updated.id,
          type: updated.type,
          date: updated.date,
          quantite: updated.quantite,
          unite: updated.unite,
        })
      } else if (estVenteProduitRuche(existing.type)) {
        await supprimerStockRucheVente(tx, userId, existing.id)
      }
      await createVenteFromVenteProduit(userId, {
        id: updated.id,
        type: updated.type,
        description: updated.description,
        prixTotal: updated.prixTotal,
        quantite: updated.quantite,
        unite: updated.unite,
        prixUnitaire: updated.prixUnitaire,
        client: updated.client,
        date: updated.date,
        tauxTVA: updated.tauxTVA,
        factureId: updated.factureId,
        paye: updated.paye,
        modeReglement: mode.data,
      }, tx)
      return updated
    })
    invalidateKpi(userId)

    return NextResponse.json({ data: vente })
  } catch (error) {
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ReglementVenteError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof StockOeufsVenteError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof StockRucheError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PATCH /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
