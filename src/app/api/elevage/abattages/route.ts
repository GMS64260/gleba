/**
 * API Abattages
 * GET /api/elevage/abattages - Liste des abattages
 * POST /api/elevage/abattages - Enregistrer un abattage
 * PATCH /api/elevage/abattages - Modifier un abattage
 * DELETE /api/elevage/abattages - Annuler un abattage (soft-delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createVenteFromAbattage, deleteAutoEntry } from '@/lib/auto-compta'
import { creerFacture, annulerFactureLiee } from '@/lib/facture-utils'
import { abattageSchema } from '@/lib/validations/elevage-abattage'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const destination = searchParams.get('destination')
    const limit = parseInt(searchParams.get('limit') || '100')
    const annee = parseInt(searchParams.get('annee') || String(new Date().getFullYear()))
    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    const where: any = { userId: session.user.id, annule: { not: true }, date: { gte: yearStart, lte: yearEnd } }
    if (destination) where.destination = destination
    if (dateDebut || dateFin) {
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const abattages = await prisma.abattage.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        animal: {
          select: { id: true, nom: true, identifiant: true, race: true, especeAnimale: { select: { id: true, nom: true, couleur: true } } },
        },
        lot: {
          select: { id: true, nom: true, especeAnimale: { select: { id: true, nom: true, couleur: true } } },
        },
      },
    })

    // Stats
    const stats = await prisma.abattage.aggregate({
      where,
      _sum: { quantite: true, poidsVif: true, poidsCarcasse: true, prixVente: true },
      _count: true,
    })

    return NextResponse.json({
      data: abattages,
      stats: {
        totalAnimaux: stats._sum.quantite || 0,
        poidsVifTotal: stats._sum.poidsVif || 0,
        poidsCarcasseTotal: stats._sum.poidsCarcasse || 0,
        revenusVente: stats._sum.prixVente || 0,
        nbAbattages: stats._count,
      },
      meta: { year: annee, total: abattages.length },
    })
  } catch (error) {
    console.error('GET /api/elevage/abattages error:', error)
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
    const parsed = abattageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { animalId, lotId, date, quantite, poidsVif, poidsCarcasse, destination, prixVente, lieu, notes } = parsed.data
    const dateAbattage = date || new Date()
    const overrideCoherence = (body as { overrideCoherence?: boolean })?.overrideCoherence === true

    // Feedback Marc 2026-05-16 — V3 Bug 6 : on autorisait l'abattage
    // de 500 poules sur un lot qui en comptait 30. On bloque désormais
    // toute saisie dépassant l'effectif actuel (avec override possible).
    if (lotId && quantite) {
      const lot = await prisma.lotAnimaux.findFirst({
        where: { id: lotId, userId: session.user.id },
        select: { quantiteActuelle: true, quantiteInitiale: true, statut: true, nom: true },
      })
      if (!lot) {
        return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
      }
      if (!overrideCoherence && quantite > lot.quantiteActuelle) {
        return NextResponse.json(
          {
            error: 'Abattage incohérent',
            code: 'ABATTAGE_OVER_EFFECTIF',
            details: {
              quantite,
              effectifActuel: lot.quantiteActuelle,
              effectifInitial: lot.quantiteInitiale,
              lotNom: lot.nom,
              statut: lot.statut,
              message: `Le lot « ${lot.nom} » compte ${lot.quantiteActuelle} animaux ${lot.statut === 'termine' ? '(statut terminé)' : ''} — impossible d'abattre ${quantite}. Cochez « forcer » pour corriger l'historique.`,
            },
          },
          { status: 422 }
        )
      }
    }

    // Revue élevage 2026-07-21 — validation tenant de `animalId` (seul `lotId`
    // l'était). Sans ce contrôle, un `animalId` d'un autre compte créait un
    // abattage cross-tenant et la réponse (include: animal) fuitait sa fiche.
    if (animalId) {
      const animal = await prisma.animal.findFirst({
        where: { id: animalId, userId: session.user.id },
        select: { id: true },
      })
      if (!animal) {
        return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
      }
    }

    // PROMPT 19B §8 — Blocage si soin en temps d'attente viande actif
    // POSTREVIEW Sprint 5 — Filtre `fait: true` ajouté : un soin prévu mais
    // non administré ne devrait pas bloquer ; le calcul `finAttenteViande`
    // n'est valide que pour les soins effectivement réalisés.
    const cibleFilters: any[] = []
    if (animalId) cibleFilters.push({ animalId })
    if (lotId) cibleFilters.push({ lotId })
    const soinsAttenteViande = cibleFilters.length === 0 ? [] : await prisma.soinAnimal.findMany({
      where: {
        userId: session.user.id,
        fait: true,
        OR: cibleFilters,
        finAttenteViande: { gte: dateAbattage },
        date: { lte: dateAbattage },
      },
      include: { produitVeterinaire: { select: { nom: true } } },
    })
    if (soinsAttenteViande.length > 0) {
      const details = soinsAttenteViande
        .map((s) => `${s.produit || s.produitVeterinaire?.nom || s.type} (lève le ${s.finAttenteViande?.toLocaleDateString('fr-FR')})`)
        .join(', ')
      return NextResponse.json(
        {
          error: 'Abattage interdit : animal en temps d\'attente vétérinaire',
          details: `Traitement(s) en cours : ${details}. Reportez l'abattage après la fin du temps d'attente viande.`,
        },
        { status: 409 }
      )
    }

    // Transaction pour mettre à jour l'animal/lot
    const abattage = await prisma.$transaction(async (tx) => {
      // Créer l'abattage
      const newAbattage = await tx.abattage.create({
        data: {
          userId: session.user.id,
          animalId: animalId || null,
          lotId: lotId || null,
          date: date || new Date(),
          quantite,
          poidsVif: poidsVif || null,
          poidsCarcasse: poidsCarcasse || null,
          destination,
          prixVente: prixVente || null,
          lieu,
          notes,
        },
        include: {
          animal: true,
          lot: true,
        },
      })

      // Mettre à jour le statut de l'animal si individuel
      if (animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: animalId, userId: session.user.id },
        })
        if (animal) {
          await tx.animal.update({
            where: { id: animal.id },
            data: {
              statut: 'abattu',
              dateSortie: date || new Date(),
              causeSortie: 'Abattage',
            },
          })
        }
      }

      // Mettre à jour la quantité du lot si lot
      if (lotId && quantite) {
        const lot = await tx.lotAnimaux.findFirst({
          where: { id: lotId, userId: session.user.id },
        })
        if (lot) {
          const nouvelleQuantite = Math.max(0, lot.quantiteActuelle - quantite)
          await tx.lotAnimaux.update({
            where: { id: lot.id },
            data: {
              quantiteActuelle: nouvelleQuantite,
              statut: nouvelleQuantite === 0 ? 'termine' : 'actif',
            },
          })
        }
      }

      return newAbattage
    })

    // Auto-comptabilite : creer une vente si destination = "vente"
    try {
      if (abattage.destination === 'vente' && abattage.prixVente) {
        await createVenteFromAbattage(session.user.id, {
          id: abattage.id,
          prixVente: abattage.prixVente,
          date: abattage.date,
          destination: abattage.destination,
          quantite: abattage.quantite,
          poidsCarcasse: abattage.poidsCarcasse,
          animal: abattage.animal ? { nom: abattage.animal.nom } : null,
          lot: abattage.lot ? { nom: abattage.lot.nom } : null,
        })
      }
    } catch (autoComptaError) {
      console.error('Auto-compta error (abattage):', autoComptaError)
    }

    return NextResponse.json({ data: abattage }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/abattages error:', error)
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
    const { id, date, quantite, poidsVif, poidsCarcasse, destination, prixVente, notes } = body
    const userId = session.user.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.abattage.findFirst({
      where: { id: parseInt(id), userId },
      include: {
        animal: { select: { id: true, nom: true, identifiant: true, race: true } },
        lot: { select: { id: true, nom: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Abattage non trouvé' }, { status: 404 })
    }

    // Un abattage annulé ne se modifie plus : un PATCH recréait l'écriture
    // auto-compta (revenu fantôme) voire émettait une facture.
    if (existing.annule) {
      return NextResponse.json(
        { error: 'Abattage annulé — modification impossible' },
        { status: 409 }
      )
    }

    // Audit #94 : gardes NaN / date invalide (le PATCH n'était pas validé).
    const updateData: any = {}
    if (date !== undefined) {
      const d = new Date(date)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      updateData.date = d
    }
    if (quantite !== undefined) {
      const q = parseInt(quantite)
      if (Number.isNaN(q) || q <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
      updateData.quantite = q
    }
    if (poidsVif !== undefined) updateData.poidsVif = poidsVif ? parseFloat(poidsVif) : null
    if (poidsCarcasse !== undefined) updateData.poidsCarcasse = poidsCarcasse ? parseFloat(poidsCarcasse) : null
    if (destination !== undefined) updateData.destination = destination
    if (prixVente !== undefined) updateData.prixVente = prixVente ? parseFloat(prixVente) : null
    if (notes !== undefined) updateData.notes = notes

    // Dé-vente d'un abattage facturé (destination quitte « vente ») :
    // la facture doit suivre, sinon le CA reste compté via la facture.
    if (
      existing.factureId &&
      destination !== undefined &&
      destination !== 'vente' &&
      existing.destination === 'vente'
    ) {
      const liee = await annulerFactureLiee(prisma, userId, existing.factureId)
      if (!liee.ok) {
        return NextResponse.json({ error: liee.raison }, { status: 409 })
      }
      updateData.factureId = null
    }

    // Anti-double-facture : un abattage déjà facturé ne peut pas générer
    // une seconde facture (l'ancienne resterait comptée dans KPI/TVA/FEC).
    if (body.creerFacture && existing.factureId) {
      return NextResponse.json(
        { error: 'Cet abattage est déjà facturé', factureId: existing.factureId },
        { status: 409 }
      )
    }

    // Transaction atomique : facture + update abattage + ajustement lot
    const abattage = await prisma.$transaction(async (tx) => {
      // Créer une facture si demandé et si prixVente existe
      if (body.creerFacture && (updateData.prixVente || existing.prixVente)) {
        const prixTotalTTC = updateData.prixVente || existing.prixVente
        const tva = body.tauxTVA ? parseFloat(body.tauxTVA) : 5.5
        const totalHT = prixTotalTTC / (1 + tva / 100)
        const totalTVA = prixTotalTTC - totalHT

        const animalInfo = existing.animal?.nom || existing.lot?.nom || 'Abattage'
        const quantiteAbattue = updateData.quantite !== undefined ? updateData.quantite : existing.quantite

        const facture = await creerFacture(tx, {
          userId,
          // POSTREVIEW — 'abattage' cassait PDF + FEC ; mettre 'facture'
          type: 'facture',
          clientNom: 'Client vente abattage',
          date: existing.date,
          objet: `Vente abattage - ${animalInfo}`,
          totalHT,
          totalTVA,
          totalTTC: prixTotalTTC,
          statut: 'payee',
          datePaiement: new Date(),
          modePaiement: body.modePaiement || 'especes',
          lignes: [{
            description: animalInfo,
            quantite: quantiteAbattue,
            unite: 'animal',
            prixUnitaire: totalHT / quantiteAbattue,
            tauxTVA: tva,
            montantHT: totalHT,
            montantTVA: totalTVA,
            montantTTC: prixTotalTTC,
          }],
        })

        updateData.factureId = facture.id
      }

      // Ajuster les quantités du lot si quantite a changé et il y a un lotId
      if (quantite !== undefined && existing.lotId) {
        const newQuantite = parseInt(quantite)
        const difference = newQuantite - existing.quantite

        if (difference !== 0) {
          const lot = await tx.lotAnimaux.findFirst({
            where: { id: existing.lotId, userId },
          })

          if (lot) {
            // Si quantite augmente, on abat plus d'animaux donc on diminue le lot
            // Si quantite diminue, on abat moins d'animaux donc on augmente le lot
            const nouvelleQuantite = Math.max(0, lot.quantiteActuelle - difference)
            await tx.lotAnimaux.update({
              where: { id: lot.id },
              data: {
                quantiteActuelle: nouvelleQuantite,
                statut: nouvelleQuantite === 0 ? 'termine' : 'actif',
              },
            })
          }
        }
      }

      return tx.abattage.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          animal: { select: { id: true, nom: true, identifiant: true, race: true } },
          lot: { select: { id: true, nom: true } },
        },
      })
    })

    // Auto-comptabilite : mettre a jour l'ecriture auto
    try {
      const finalDestination = updateData.destination || existing.destination
      const finalPrixVente = updateData.prixVente !== undefined ? updateData.prixVente : existing.prixVente

      if (finalDestination === 'vente' && finalPrixVente && finalPrixVente > 0) {
        await createVenteFromAbattage(userId, {
          id: parseInt(id),
          prixVente: finalPrixVente,
          date: abattage.date,
          destination: finalDestination,
          quantite: abattage.quantite,
          poidsCarcasse: abattage.poidsCarcasse,
          animal: abattage.animal ? { nom: abattage.animal.nom } : null,
          lot: abattage.lot ? { nom: abattage.lot.nom } : null,
          factureId: abattage.factureId,
        })
      } else {
        // Destination n'est plus "vente" ou pas de prix -> supprimer l'auto entry
        await deleteAutoEntry('abattage', parseInt(id), 'vente')
      }
    } catch (autoComptaError) {
      console.error('Auto-compta error (abattage PATCH):', autoComptaError)
    }

    return NextResponse.json({ data: abattage })
  } catch (error) {
    console.error('PATCH /api/elevage/abattages error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
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

    const existing = await prisma.abattage.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Abattage non trouvé' }, { status: 404 })
    }

    if (existing.annule) {
      return NextResponse.json({ error: 'Abattage déjà annulé' }, { status: 409 })
    }

    // Symétrie annulation ↔ facture : sans ça la facture restait comptée
    // (KPI/TVA/FEC) alors que l'abattage était annulé.
    if (existing.factureId) {
      const liee = await annulerFactureLiee(prisma, session.user.id, existing.factureId)
      if (!liee.ok) {
        return NextResponse.json({ error: liee.raison }, { status: 409 })
      }
    }

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('abattage', parseInt(id), 'vente')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (abattage):', autoComptaError)
    }

    // Audit élevage 2026-06-11 — l'annulation doit défaire les effets cheptel
    // du POST (symétrie déjà appliquée au stock aliment) : avant, annuler un
    // abattage laissait l'animal en statut 'abattu' et le lot décrémenté.
    await prisma.$transaction(async (tx) => {
      // Soft-delete : marquer comme annule
      await tx.abattage.update({
        where: { id: existing.id },
        data: { annule: true, dateAnnulation: new Date() },
      })

      // Restaurer l'animal individuel (uniquement si c'est bien cet abattage
      // qui l'avait sorti — on ne touche pas à un animal mort/vendu depuis).
      if (existing.animalId) {
        await tx.animal.updateMany({
          where: { id: existing.animalId, userId: session.user.id, statut: 'abattu' },
          data: { statut: 'actif', dateSortie: null, causeSortie: null },
        })
      }

      // Ré-incrémenter l'effectif du lot et le réactiver s'il avait été
      // clôturé par cet abattage.
      if (existing.lotId && existing.quantite) {
        const lot = await tx.lotAnimaux.findFirst({
          where: { id: existing.lotId, userId: session.user.id },
          select: { id: true, quantiteActuelle: true, statut: true },
        })
        if (lot) {
          const nouvelleQuantite = lot.quantiteActuelle + existing.quantite
          await tx.lotAnimaux.update({
            where: { id: lot.id },
            data: {
              quantiteActuelle: nouvelleQuantite,
              statut: lot.statut === 'termine' && nouvelleQuantite > 0 ? 'actif' : lot.statut,
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/abattages error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
