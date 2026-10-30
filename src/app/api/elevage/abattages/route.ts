import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
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
import { lireAnnee } from '@/lib/api/annee'
import { createVenteFromAbattage, deleteAutoEntry } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { creerFacture, annulerFactureLiee } from '@/lib/facture-utils'
import { abattageSchema } from '@/lib/validations/elevage-abattage'
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'
import { Prisma } from '@prisma/client'
import { ErreurElevage } from '@/lib/elevage/erreurs'
import { verifierAttenteViande } from '@/lib/elevage/attente-viande'
import { JOUR_SEUL } from '@/lib/elevage/date-soin'
import { jourCivilStocke } from '@/lib/jour-civil'
import { modePaiementDepuisReglement } from '@/lib/validations/reglement'

const LOT_ABATTAGE_SELECT = {
  id: true,
  quantiteActuelle: true,
  quantiteInitiale: true,
  statut: true,
  nom: true,
} satisfies Prisma.LotAnimauxSelect
type LotAbattage = Prisma.LotAnimauxGetPayload<{ select: typeof LOT_ABATTAGE_SELECT }>

/** Champs scalaires d'un abattage modifiables par le PATCH. */
type AbattageModif = {
  date?: Date
  quantite?: number
  poidsVif?: number | null
  poidsCarcasse?: number | null
  destination?: string
  prixVente?: number | null
  lieu?: string | null
  nEtablissementDestination?: string | null
  notes?: string | null
  factureId?: number | null
}

/**
 * Part collective reconstituée d'un lot (`effectifCollectif` : effectif de
 * l'écran Lots moins les fiches actives rattachées) et nombre de ces fiches.
 * Revue 2026-10-20 — c'est elle qu'un abattage de lot entame, et non le
 * compteur stocké `quantiteActuelle`, qui dérive (la mort d'une fiche rattachée
 * ne le décrémente pas : lot démo 71, 5 contre 4). Une fiche s'abat par son
 * propre parcours (`animalId`), que les appelants ne plafonnent pas.
 */
async function partCollectiveLot(
  userId: string,
  lot: LotAbattage,
  db: Prisma.TransactionClient = prisma,
): Promise<{ collectif: number; fiches: number }> {
  const effectif = (await reconstituerEffectifsLots(userId, [lot], db)).get(lot.id)
  return {
    collectif: effectif?.effectifCollectif ?? lot.quantiteActuelle,
    fiches: effectif?.nominatifsActifs ?? 0,
  }
}

/**
 * Refus 422 `ABATTAGE_OVER_EFFECTIF` : `quantite` dépasse les `collectif` têtes
 * disponibles pour cet abattage. Corps unique du POST et du PATCH (feedback
 * Marc 2026-05-16, V3 Bug 6 : 500 poules abattues sur un lot de 30).
 */
function refusAbattageHorsEffectif(
  lot: LotAbattage,
  quantite: number,
  collectif: number,
  fiches: number,
): ErreurElevage {
  const tetes = `${collectif} tête${collectif > 1 ? 's' : ''} collective${collectif > 1 ? 's' : ''} présente${collectif > 1 ? 's' : ''} dans le lot`
  const nomLot = lot.nom || `Lot #${lot.id}`
  return new ErreurElevage('Abattage incohérent', 422, 'ABATTAGE_OVER_EFFECTIF', {
    quantite,
    effectifActuel: collectif,
    effectifCollectif: collectif,
    nominatifsActifs: fiches,
    effectifInitial: lot.quantiteInitiale,
    lotNom: lot.nom,
    statut: lot.statut,
    message: `${tetes} « ${nomLot} »${lot.statut === 'termine' ? ' (statut terminé)' : ''} : impossible d'en abattre ${quantite}.${fiches > 1 ? ` Les ${fiches} fiches nominatives rattachées au lot s'abattent depuis leur fiche.` : fiches === 1 ? " La fiche nominative rattachée au lot s'abat depuis sa fiche." : ''}`,
  })
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const destination = searchParams.get('destination')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000)
    // Revue 2026-09-28 : `annee=all` pour la liste de gestion d'un historique.
    const { annee, bornes } = lireAnnee(searchParams)

    const where: Prisma.AbattageWhereInput = { userId: session.user.id, annule: { not: true } }
    if (bornes || dateDebut || dateFin) {
      const date: Prisma.DateTimeFilter = bornes ? { ...bornes } : {}
      if (dateDebut) date.gte = new Date(dateDebut)
      if (dateFin) date.lte = new Date(dateFin)
      where.date = date
    }
    if (destination) where.destination = destination

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
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
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

    const { animalId, lotId, date, quantite, poidsVif, poidsCarcasse, destination, prixVente, lieu, nEtablissementDestination, notes } = parsed.data
    const dateAbattage = date || new Date()
    const overrideCoherence = (body as { overrideCoherence?: boolean })?.overrideCoherence === true

    // Transaction pour mettre à jour l'animal/lot
    const abattage = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session!.user.id)
      // Toutes les gardes autoritatives précèdent les écritures, sous le même
      // mutex que les ventes et les autres modifications du cheptel.
      if (animalId) {
        if (quantite !== 1) throw new ErreurElevage('Un abattage individuel porte sur un seul animal.', 400)
        await tx.$queryRaw`SELECT id FROM animaux WHERE id = ${animalId} AND user_id = ${session.user.id} FOR UPDATE`
        const animal = await tx.animal.findFirst({ where: { id: animalId, userId: session.user.id } })
        if (!animal) throw new ErreurElevage('Animal introuvable', 404)
        if (animal.statut !== 'actif') throw new ErreurElevage("Cet animal n'est plus actif. Rechargez le cheptel.")
        if (lotId && animal.lotId !== lotId) throw new ErreurElevage("Cet animal n'appartient pas au lot indiqué.", 400)
      }
      if (lotId) {
        await tx.$queryRaw`SELECT id FROM lots_animaux WHERE id = ${lotId} AND user_id = ${session.user.id} FOR UPDATE`
        const lot = await tx.lotAnimaux.findFirst({ where: { id: lotId, userId: session.user.id }, select: LOT_ABATTAGE_SELECT })
        if (!lot) throw new ErreurElevage('Lot introuvable', 404)
        if (!overrideCoherence && !animalId) {
          const { collectif, fiches } = await partCollectiveLot(session.user.id, lot, tx)
          if (quantite > collectif) throw refusAbattageHorsEffectif(lot, quantite, collectif, fiches)
        }
      }
      await verifierAttenteViande(tx, session.user.id, { animalId: animalId ?? null, lotId: lotId ?? null, date: dateAbattage })
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
          nEtablissementDestination: nEtablissementDestination || null,
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
              // La déclaration de sortie de l'animal lit ce numéro.
              ...(nEtablissementDestination ? { nExploitationDestination: nEtablissementDestination } : {}),
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

      await createVenteFromAbattage(session.user.id, {
        id: newAbattage.id,
        prixVente: newAbattage.prixVente,
        date: newAbattage.date,
        destination: newAbattage.destination,
        quantite: newAbattage.quantite,
        poidsCarcasse: newAbattage.poidsCarcasse,
        animal: newAbattage.animal ? { nom: newAbattage.animal.nom } : null,
        lot: newAbattage.lot ? { nom: newAbattage.lot.nom } : null,
      }, tx)
      return newAbattage
    })
    invalidateKpi(session.user.id)

    return NextResponse.json({ data: abattage }, { status: 201 })
  } catch (error) {
    if (error instanceof ErreurElevage) return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: error.status })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
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
    const { id, date, quantite, poidsVif, poidsCarcasse, destination, prixVente, lieu, nEtablissementDestination, notes } = body
    const overrideCoherence = (body as { overrideCoherence?: boolean })?.overrideCoherence === true
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
    const updateData: AbattageModif = {}
    if (date !== undefined) {
      const d = new Date(date)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
      // Le formulaire renvoie le jour seul affiché : le jour civil de l'abattage
      // n'est pas une nouvelle date (heure d'un abattage horodaté conservée).
      const memeJour = typeof date === 'string' && JOUR_SEUL.test(date.trim()) && date.trim() === jourCivilStocke(existing.date)
      if (!memeJour) updateData.date = d
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
    // Le formulaire d'édition envoyait le lieu, que ce PATCH ignorait en silence.
    if (lieu !== undefined) updateData.lieu = typeof lieu === 'string' ? lieu.trim() || null : null
    if (nEtablissementDestination !== undefined) {
      updateData.nEtablissementDestination =
        typeof nEtablissementDestination === 'string' ? nEtablissementDestination.trim() || null : null
    }
    if (notes !== undefined) updateData.notes = notes

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
      await verrouillerReglements(tx, session!.user.id)
      await tx.$queryRaw`SELECT id FROM abattages WHERE id = ${existing.id} AND user_id = ${userId} FOR UPDATE`
      const courante = await tx.abattage.findFirst({ where: { id: existing.id, userId } })
      if (!courante || Object.entries(courante).some(([champ, valeur]) => {
        const avant = existing[champ as keyof typeof existing]
        return valeur instanceof Date && avant instanceof Date ? valeur.getTime() !== avant.getTime() : valeur !== avant
      })) throw new ErreurElevage('Cet abattage a changé. Rechargez la liste avant de le modifier.')
      if (courante.annule) throw new ErreurElevage('Abattage annulé : modification impossible.')
      if (courante.factureId && ['date', 'quantite', 'prixVente', 'destination'].some((champ) => {
        const valeur = updateData[champ as keyof AbattageModif]
        const avant = courante[champ as keyof typeof courante]
        return valeur !== undefined && (valeur instanceof Date && avant instanceof Date ? valeur.getTime() !== avant.getTime() : valeur !== avant)
      })) throw new ErreurElevage('Cet abattage est facturé. Annulez la vente avec sa facture ou établissez un avoir pour le corriger.')
      if (courante.animalId && updateData.quantite !== undefined && updateData.quantite !== 1) {
        throw new ErreurElevage('Un abattage individuel porte sur un seul animal.', 400)
      }
      if (!overrideCoherence && !courante.animalId && courante.lotId && updateData.quantite !== undefined && updateData.quantite > courante.quantite) {
        const lot = await tx.lotAnimaux.findFirst({ where: { id: courante.lotId, userId }, select: LOT_ABATTAGE_SELECT })
        if (!lot) throw new ErreurElevage('Lot introuvable', 404)
        const { collectif, fiches } = await partCollectiveLot(userId, lot, tx)
        if (updateData.quantite > collectif + courante.quantite) throw refusAbattageHorsEffectif(lot, updateData.quantite, collectif + courante.quantite, fiches)
      }
      // Attente viande rejouée seulement si la date change (l'animal et le lot
      // ne se modifient pas ici) : un soin saisi après coup ne bloque pas la
      // correction d'un poids, d'un prix ou d'une note.
      if (updateData.date && updateData.date.getTime() !== courante.date.getTime()) {
        await verifierAttenteViande(tx, userId, { animalId: courante.animalId, lotId: courante.lotId, date: updateData.date })
      }
      // Créer une facture si demandé et si prixVente existe
      const prixTotalTTC = updateData.prixVente !== undefined ? updateData.prixVente : existing.prixVente
      if (body.creerFacture && prixTotalTTC) {
        const tva = body.tauxTVA !== undefined ? Number(body.tauxTVA) : 5.5
        if (!Number.isFinite(tva) || tva < 0 || tva > 100) throw new ErreurElevage('TVA invalide', 400)
        const totalHT = prixTotalTTC / (1 + tva / 100)
        const totalTVA = prixTotalTTC - totalHT
        const suivi = await tx.venteManuelle.findFirst({ where: { userId, auto: true, sourceType: 'abattage', sourceId: existing.id }, select: { paye: true, modeReglement: true } })

        const animalInfo = existing.animal?.nom || existing.lot?.nom || 'Abattage'
        const quantiteAbattue = updateData.quantite !== undefined ? updateData.quantite : existing.quantite

        const facture = await creerFacture(tx, {
          userId,
          // POSTREVIEW — 'abattage' cassait PDF + FEC ; mettre 'facture'
          type: 'facture',
          clientNom: 'Client vente abattage',
          date: updateData.date ?? existing.date,
          objet: `Vente abattage - ${animalInfo}`,
          totalHT,
          totalTVA,
          totalTTC: prixTotalTTC,
          statut: suivi?.paye ? 'payee' : 'emise',
          datePaiement: suivi?.paye ? new Date() : null,
          modePaiement: modePaiementDepuisReglement(suivi?.modeReglement),
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

      const updated = await tx.abattage.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          animal: { select: { id: true, nom: true, identifiant: true, race: true } },
          lot: { select: { id: true, nom: true } },
        },
      })
      await createVenteFromAbattage(userId, {
        id: updated.id,
        prixVente: updated.prixVente,
        date: updated.date,
        destination: updated.destination,
        quantite: updated.quantite,
        poidsCarcasse: updated.poidsCarcasse,
        animal: updated.animal ? { nom: updated.animal.nom } : null,
        lot: updated.lot ? { nom: updated.lot.nom } : null,
        factureId: updated.factureId,
      }, tx)
      return updated
    })
    invalidateKpi(userId)

    return NextResponse.json({ data: abattage })
  } catch (error) {
    if (error instanceof ErreurElevage) return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: error.status })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
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

    // Audit élevage 2026-06-11 — l'annulation doit défaire les effets cheptel
    // du POST (symétrie déjà appliquée au stock aliment) : avant, annuler un
    // abattage laissait l'animal en statut 'abattu' et le lot décrémenté.
    const annulation = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session!.user.id)
      await tx.$queryRaw`SELECT id FROM abattages WHERE id = ${existing.id} AND user_id = ${session.user.id} FOR UPDATE`
      const courante = await tx.abattage.findFirst({ where: { id: existing.id, userId: session.user.id } })
      if (!courante || courante.annule) throw new ErreurElevage('Abattage déjà annulé ou introuvable. Rechargez la liste.')
      if (courante.factureId) {
        const liee = await annulerFactureLiee(tx, session.user.id, courante.factureId)
        if (!liee.ok) return liee
      }
      await deleteAutoEntry('abattage', courante.id, 'vente', session.user.id, tx)

      // Soft-delete : marquer comme annule
      await tx.abattage.update({
        where: { id: courante.id },
        data: { annule: true, dateAnnulation: new Date() },
      })

      // Restaurer l'animal individuel (uniquement si c'est bien cet abattage
      // qui l'avait sorti — on ne touche pas à un animal mort/vendu depuis).
      if (courante.animalId) {
        await tx.animal.updateMany({
          where: { id: courante.animalId, userId: session.user.id, statut: 'abattu' },
          data: { statut: 'actif', dateSortie: null, causeSortie: null },
        })
      }

      // Ré-incrémenter l'effectif du lot et le réactiver s'il avait été
      // clôturé par cet abattage.
      if (courante.lotId && courante.quantite) {
        const lot = await tx.lotAnimaux.findFirst({
          where: { id: courante.lotId, userId: session.user.id },
          select: { id: true, quantiteActuelle: true, statut: true },
        })
        if (lot) {
          const nouvelleQuantite = lot.quantiteActuelle + courante.quantite
          await tx.lotAnimaux.update({
            where: { id: lot.id },
            data: {
              quantiteActuelle: nouvelleQuantite,
              statut: lot.statut === 'termine' && nouvelleQuantite > 0 ? 'actif' : lot.statut,
            },
          })
        }
      }
      return { ok: true as const }
    })
    if (!annulation.ok) {
      return NextResponse.json({ error: annulation.raison }, { status: 409 })
    }
    invalidateKpi(session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ErreurElevage) return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: error.status })
    if (error instanceof ErreurReglement) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('DELETE /api/elevage/abattages error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
