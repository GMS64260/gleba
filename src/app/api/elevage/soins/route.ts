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
    if (fait !== undefined) updateData.fait = fait
    if (date !== undefined) updateData.date = new Date(date)
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

    const soin = await prisma.soinAnimal.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { animal: true, lot: true, produitVeterinaire: true },
    })

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

    await prisma.$transaction(async (tx) => {
      // Réintégrer les collectes écartées si aucun autre soin actif ne les couvre
      if (existing.finAttenteLait) {
        const autresSoinsActifs = await tx.soinAnimal.findFirst({
          where: {
            userId: session.user.id,
            id: { not: existing.id },
            animalId: existing.animalId,
            lotId: existing.lotId,
            finAttenteLait: { gte: existing.date },
            date: { lte: existing.finAttenteLait },
          },
          select: { id: true },
        })
        if (!autresSoinsActifs) {
          const where: any = {
            userId: session.user.id,
            ecarteAttente: true,
            date: { gte: existing.date, lte: existing.finAttenteLait },
          }
          if (existing.animalId) where.animalId = existing.animalId
          if (existing.lotId) where.lotId = existing.lotId
          await tx.collecteLait.updateMany({ where, data: { ecarteAttente: false } })
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
