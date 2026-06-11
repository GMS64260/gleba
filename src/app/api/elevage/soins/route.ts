/**
 * API Soins des animaux (PROMPT 19B).
 *
 * À la création d'un soin :
 *  - si `produitId` fourni : snapshot des temps d'attente lait/viande
 *  - calcul des dates `finAttenteLait` et `finAttenteViande`
 *  - écartement des collectes de lait existantes dans la fenêtre
 *
 * À la suppression d'un soin :
 *  - les collectes éventuellement écartées sont remises en circulation
 *    si aucun autre soin actif ne les couvre.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromSoinAnimal, deleteAutoEntry } from '@/lib/auto-compta'
import { soinSchema } from '@/lib/validations/elevage-soin'

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

async function appliquerEcartementLait(
  tx: any,
  userId: string,
  animalId: number | null,
  lotId: number | null,
  dateDebut: Date,
  dateFin: Date
) {
  if (!animalId && !lotId) return 0
  const where: any = {
    userId,
    date: { gte: new Date(dateDebut.getTime() - 1), lte: dateFin },
  }
  if (animalId) where.animalId = animalId
  if (lotId) where.lotId = lotId
  const r = await tx.collecteLait.updateMany({ where, data: { ecarteAttente: true } })
  return r.count
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const animalId = searchParams.get('animalId')
    const lotId = searchParams.get('lotId')
    const type = searchParams.get('type')
    const fait = searchParams.get('fait')
    const limit = parseInt(searchParams.get('limit') || '100')
    const annee = parseInt(searchParams.get('annee') || String(new Date().getFullYear()))
    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    const where: any = { userId: session.user.id, date: { gte: yearStart, lte: yearEnd } }
    if (animalId) where.animalId = parseInt(animalId)
    if (lotId) where.lotId = parseInt(lotId)
    if (type) where.type = type
    if (fait !== null && fait !== undefined) where.fait = fait === 'true'

    const soins = await prisma.soinAnimal.findMany({
      where,
      orderBy: [{ fait: 'asc' }, { datePrevue: 'asc' }, { date: 'desc' }],
      take: limit,
      include: {
        animal: { select: { id: true, nom: true, identifiant: true } },
        lot: { select: { id: true, nom: true } },
        produitVeterinaire: { select: { id: true, nom: true, substanceActive: true } },
      },
    })

    const soinsAVenir = await prisma.soinAnimal.count({
      where: { userId: session.user.id, fait: false },
    })

    return NextResponse.json({
      data: soins,
      stats: { soinsAVenir },
      meta: { year: annee, total: soins.length },
    })
  } catch (error) {
    console.error('GET /api/elevage/soins error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = soinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const dateSoin = d.date || new Date()

    // Audit élevage 2026-06-11 — validation tenant : l'animal/le lot soigné
    // doit appartenir au user (sinon le soin référence — et la réponse
    // expose via include — la fiche d'un animal d'un autre compte).
    if (d.animalId) {
      const a = await prisma.animal.findFirst({
        where: { id: d.animalId, userId: session.user.id },
        select: { id: true },
      })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }
    if (d.lotId) {
      const l = await prisma.lotAnimaux.findFirst({
        where: { id: d.lotId, userId: session.user.id },
        select: { id: true },
      })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Snapshot temps d'attente depuis le produit FK si renseigné
    let tempsLait = 0
    let tempsViande = 0
    let nomProduit = d.produit || null
    if (d.produitId) {
      const p = await prisma.produitVeterinaire.findUnique({ where: { id: d.produitId } })
      if (p) {
        tempsLait = p.tempsAttenteLaitJ
        tempsViande = p.tempsAttenteViandeJ
        if (!nomProduit) nomProduit = p.nom
      }
    }
    const finLait = tempsLait > 0 ? addDays(dateSoin, tempsLait) : null
    const finViande = tempsViande > 0 ? addDays(dateSoin, tempsViande) : null

    const result = await prisma.$transaction(async (tx) => {
      const soin = await tx.soinAnimal.create({
        data: {
          userId: session.user.id,
          animalId: d.animalId || null,
          lotId: d.lotId || null,
          date: dateSoin,
          type: d.type,
          description: d.description ?? null,
          produit: nomProduit,
          produitId: d.produitId ?? null,
          dose: d.dose ?? null,
          voie: d.voie ?? null,
          motif: d.motif ?? null,
          ordonnanceUrl: d.ordonnanceUrl || null,
          quantite: d.quantite ?? null,
          unite: d.unite ?? null,
          cout: d.cout ?? null,
          veterinaire: d.veterinaire ?? null,
          datePrevue: d.datePrevue ?? null,
          fait: d.fait,
          notes: d.notes ?? null,
          tempsAttenteLaitJ: tempsLait > 0 ? tempsLait : null,
          tempsAttenteViandeJ: tempsViande > 0 ? tempsViande : null,
          finAttenteLait: finLait,
          finAttenteViande: finViande,
        },
        include: { animal: true, lot: true, produitVeterinaire: true },
      })

      // Écartement des collectes de lait dans la fenêtre (PROMPT 19B §7)
      let nbEcartees = 0
      if (finLait) {
        nbEcartees = await appliquerEcartementLait(
          tx,
          session.user.id,
          d.animalId ?? null,
          d.lotId ?? null,
          dateSoin,
          finLait
        )
      }
      return { soin, nbEcartees }
    })

    // Auto-comptabilite : creer une depense si cout > 0
    if (result.soin.cout && result.soin.cout > 0) {
      try {
        await createDepenseFromSoinAnimal(session.user.id, {
          id: result.soin.id,
          type: result.soin.type,
          cout: result.soin.cout,
          date: result.soin.date,
          fait: result.soin.fait,
        })
      } catch (autoComptaError) {
        console.error('Auto-compta error (soin_animal POST):', autoComptaError)
      }
    }

    return NextResponse.json(
      {
        data: result.soin,
        info: result.nbEcartees > 0
          ? `${result.nbEcartees} collecte(s) de lait écartée(s) jusqu'au ${finLait?.toLocaleDateString('fr-FR')}.`
          : null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/elevage/soins error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, fait, date, notes, type, description, produit, quantite, unite, cout, datePrevue, veterinaire, animalId, lotId, dose, voie, motif, ordonnanceUrl } = body

    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    const existing = await prisma.soinAnimal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Soin non trouvé' }, { status: 404 })

    const updateData: any = {}
    // Bug cmp8rwths (Marc 2026-05-16) — valider un soin "en retard" écrasait
    // sa date prévue par la date du jour, on perdait l'historique du retard
    // d'application (critique en élevage AB). Désormais, à la validation
    // (fait=true), si datePrevue n'est pas encore renseignée on copie
    // l'ancienne date dans datePrevue, et `date` reçoit la date d'effet.
    if (fait !== undefined) updateData.fait = fait
    if (date !== undefined) {
      const newDate = new Date(date)
      if (fait === true && existing.datePrevue == null) {
        updateData.datePrevue = existing.date
      }
      updateData.date = newDate
    }
    if (notes !== undefined) updateData.notes = notes
    if (type !== undefined) updateData.type = type
    if (description !== undefined) updateData.description = description
    if (produit !== undefined) updateData.produit = produit
    if (quantite !== undefined) updateData.quantite = quantite ? parseFloat(quantite) : null
    if (unite !== undefined) updateData.unite = unite
    if (cout !== undefined) updateData.cout = cout ? parseFloat(cout) : null
    if (datePrevue !== undefined) updateData.datePrevue = datePrevue ? new Date(datePrevue) : null
    if (veterinaire !== undefined) updateData.veterinaire = veterinaire
    if (animalId !== undefined) updateData.animalId = animalId ? parseInt(animalId) : null
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null
    if (dose !== undefined) updateData.dose = dose
    if (voie !== undefined) updateData.voie = voie
    if (motif !== undefined) updateData.motif = motif
    if (ordonnanceUrl !== undefined) updateData.ordonnanceUrl = ordonnanceUrl || null

    // Audit élevage 2026-06-11 — validation tenant des cibles modifiées.
    if (updateData.animalId) {
      const a = await prisma.animal.findFirst({
        where: { id: updateData.animalId, userId: session.user.id },
        select: { id: true },
      })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }
    if (updateData.lotId) {
      const l = await prisma.lotAnimaux.findFirst({
        where: { id: updateData.lotId, userId: session.user.id },
        select: { id: true },
      })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Audit élevage 2026-06-11 — si la date du soin change, les fenêtres
    // d'attente snapshotées doivent suivre (avant : finAttenteLait/Viande
    // restaient calées sur l'ancienne date → blocages abattage et
    // écartements lait faux).
    const dateChangee = updateData.date !== undefined &&
      new Date(updateData.date).getTime() !== existing.date.getTime()
    if (dateChangee) {
      const newDate = updateData.date as Date
      updateData.finAttenteLait = existing.tempsAttenteLaitJ
        ? addDays(newDate, existing.tempsAttenteLaitJ)
        : existing.finAttenteLait
      updateData.finAttenteViande = existing.tempsAttenteViandeJ
        ? addDays(newDate, existing.tempsAttenteViandeJ)
        : existing.finAttenteViande
    }

    const soin = await prisma.$transaction(async (tx) => {
      const updated = await tx.soinAnimal.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: { animal: true, lot: true, produitVeterinaire: true },
      })

      // Ré-synchroniser l'écartement des collectes de lait si la fenêtre a
      // bougé : réintégrer celles de l'ancienne fenêtre devenues hors
      // couverture, écarter celles de la nouvelle.
      if (dateChangee && existing.tempsAttenteLaitJ && (existing.animalId || existing.lotId)) {
        const cibleWhere: any = existing.animalId
          ? { animalId: existing.animalId }
          : { lotId: existing.lotId }

        const bornes = [existing.date, existing.finAttenteLait, updated.date, updated.finAttenteLait]
          .filter((x): x is Date => x != null)
        const minDate = new Date(Math.min(...bornes.map((b) => b.getTime())))
        const maxDate = new Date(Math.max(...bornes.map((b) => b.getTime())))

        const collectes = await tx.collecteLait.findMany({
          where: {
            userId: session.user.id,
            ...cibleWhere,
            date: { gte: minDate, lte: maxDate },
          },
          select: { id: true, date: true, ecarteAttente: true },
        })
        const autresSoins = await tx.soinAnimal.findMany({
          where: {
            userId: session.user.id,
            id: { not: updated.id },
            fait: true,
            ...cibleWhere,
            finAttenteLait: { not: null },
          },
          select: { date: true, finAttenteLait: true },
        })
        const couvertePar = (cDate: Date) =>
          (updated.finAttenteLait != null && updated.date <= cDate && cDate <= updated.finAttenteLait) ||
          autresSoins.some((s) => s.finAttenteLait != null && s.date <= cDate && cDate <= s.finAttenteLait)

        const aEcarter = collectes.filter((c) => !c.ecarteAttente && couvertePar(c.date)).map((c) => c.id)
        const aReintegrer = collectes.filter((c) => c.ecarteAttente && !couvertePar(c.date)).map((c) => c.id)
        if (aEcarter.length > 0) {
          await tx.collecteLait.updateMany({ where: { id: { in: aEcarter } }, data: { ecarteAttente: true } })
        }
        if (aReintegrer.length > 0) {
          await tx.collecteLait.updateMany({ where: { id: { in: aReintegrer } }, data: { ecarteAttente: false } })
        }
      }

      return updated
    })

    // Auto-comptabilite : resynchroniser la depense auto avec les valeurs finales
    // (le helper supprime l'ecriture si cout devient null/0)
    try {
      await createDepenseFromSoinAnimal(session.user.id, {
        id: soin.id,
        type: soin.type,
        cout: soin.cout,
        date: soin.date,
        fait: soin.fait,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (soin_animal PATCH):', autoComptaError)
    }

    return NextResponse.json({ data: soin })
  } catch (error) {
    console.error('PATCH /api/elevage/soins error:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    const existing = await prisma.soinAnimal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Soin non trouvé' }, { status: 404 })

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('soin_animal', parseInt(id), 'depense')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (soin_animal):', autoComptaError)
    }

    // POSTREVIEW Sprint 5 — Réintégration collectes en RECOUVREMENT par collecte
    // (avant : `lotId: null` matchait TOUS les soins d'animaux individuels via
    // Prisma, ramenait des collectes à tort dans la moitié des cas).
    //
    // Stratégie : pour chaque collecte concernée par le soin supprimé, on
    // re-vérifie si un AUTRE soin actif (fait=true) couvre cette collecte ; si
    // aucun, on la réintègre (ecarteAttente=false).
    await prisma.$transaction(async (tx) => {
      if (existing.finAttenteLait) {
        // Cibles strict : exactement le même animal OU le même lot (pas les deux à null)
        const cibleWhere: any = {}
        if (existing.animalId) cibleWhere.animalId = existing.animalId
        else if (existing.lotId) cibleWhere.lotId = existing.lotId
        else {
          // Ni animal ni lot : pas de réintégration possible (cas anormal)
          await tx.soinAnimal.delete({ where: { id: parseInt(id) } })
          return
        }

        // Collectes potentiellement écartées par ce soin
        const collectes = await tx.collecteLait.findMany({
          where: {
            userId: session.user.id,
            ecarteAttente: true,
            ...cibleWhere,
            date: { gte: existing.date, lte: existing.finAttenteLait },
          },
          select: { id: true, date: true },
        })

        // Autres soins actifs sur la même cible (hors celui supprimé)
        const autresSoins = await tx.soinAnimal.findMany({
          where: {
            userId: session.user.id,
            id: { not: existing.id },
            fait: true,
            ...cibleWhere,
            finAttenteLait: { not: null },
          },
          select: { date: true, finAttenteLait: true },
        })

        // Pour chaque collecte, réintègre si non couverte par un autre soin
        const idsAReintegrer = collectes
          .filter((c) => {
            const couverte = autresSoins.some(
              (s) => s.finAttenteLait && s.date <= c.date && c.date <= s.finAttenteLait
            )
            return !couverte
          })
          .map((c) => c.id)

        if (idsAReintegrer.length > 0) {
          await tx.collecteLait.updateMany({
            where: { id: { in: idsAReintegrer } },
            data: { ecarteAttente: false },
          })
        }
      }
      await tx.soinAnimal.delete({ where: { id: parseInt(id) } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/soins error:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
