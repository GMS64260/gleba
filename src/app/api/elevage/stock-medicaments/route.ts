import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { convertirQuantitePharmacie } from '@/lib/elevage/unite-pharmacie'

const schema = z.object({
  produitId: z.string().min(1),
  numeroLot: z.string().trim().min(1).max(100),
  quantite: z.coerce.number().min(0),
  unite: z.string().trim().min(1).max(30),
  datePeremption: z.coerce.date().nullable().optional(),
  ordonnanceUrl: z.string().url().nullable().optional().or(z.literal('')),
  fournisseur: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const data = await prisma.stockMedicamentElevage.findMany({
    where: { userId: session.user.id },
    orderBy: [{ datePeremption: 'asc' }, { updatedAt: 'desc' }],
    include: {
      produit: { select: { id: true, nom: true, amm: true } },
    },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  const produit = await prisma.produitVeterinaire.findUnique({ where: { id: d.produitId }, select: { id: true } })
  if (!produit) return NextResponse.json({ error: 'Produit vétérinaire introuvable' }, { status: 400 })
  const cle = { userId_produitId_numeroLot: { userId: session.user.id, produitId: d.produitId, numeroLot: d.numeroLot } }
  const existant = await prisma.stockMedicamentElevage.findUnique({
    where: cle,
    include: { _count: { select: { soins: true } } },
  })
  if (!existant) {
    const data = await prisma.stockMedicamentElevage.create({
      data: { userId: session.user.id, ...d, ordonnanceUrl: d.ordonnanceUrl || null },
    })
    return NextResponse.json({ data }, { status: 201 })
  }
  // Ressaisie d'un lot déjà en pharmacie (même produit, même numéro). L'unité
  // d'un lot qui porte des soins ne change pas : ses prélèvements (en mL)
  // seraient rendus en « flacons » à la suppression d'un soin.
  //
  // La quantité ajoutée est convertie dans l'unité du lot (1 L ajouté à un lot
  // en mL vaut 1 000 mL) : additionner les nombres et reprendre l'unité saisie
  // faisait de 12,5 mL + 1 L un stock de 13,5 L (équipe debug, D193). Seul un
  // lot vide et sans soin peut changer d'unité (unité mal saisie à la création).
  const lotSansHistoire = existant._count.soins === 0 && existant.quantite === 0
  const ajoute = convertirQuantitePharmacie(d.quantite, d.unite, existant.unite)
  if (ajoute === null && !lotSansHistoire) {
    return NextResponse.json(
      existant._count.soins > 0
        ? { error: `Ce lot existe déjà en ${existant.unite} et des soins y ont été prélevés : son unité ne peut pas devenir « ${d.unite} ».`, champ: 'unite', code: 'UNITE_LOT_FIGEE' }
        : { error: `Ce lot est tenu en ${existant.unite} : saisissez la quantité ajoutée en ${existant.unite}, ou modifiez le lot.`, champ: 'unite', code: 'UNITE_LOT_DIFFERENTE' },
      { status: 409 },
    )
  }
  const uniteDuLot = ajoute === null ? d.unite : existant.unite
  const quantiteAjoutee = ajoute ?? d.quantite
  // Une ressaisie complète le lot, elle n'efface rien : un champ laissé vide
  // (ordonnance archivée, fournisseur, notes, péremption — QA cmswtt0ee) garde
  // sa valeur. Les deux formulaires envoient ces champs à null quand ils sont
  // vides, ce qui effaçait le lien d'ordonnance.
  // La quantité saisie S'AJOUTE au reste du lot : c'est une nouvelle entrée
  // en pharmacie (deuxième flacon du même lot). Elle remplaçait le stock, si
  // bien qu'un lot entamé à 12 mL devenait 50 mL au lieu de 62, sans trace de
  // l'écart. Une erreur de quantité se corrige par la modification du lot.
  const data = await prisma.stockMedicamentElevage.update({
    where: { id: existant.id },
    data: {
      quantite: { increment: quantiteAjoutee },
      unite: uniteDuLot,
      datePeremption: d.datePeremption ?? undefined,
      ordonnanceUrl: d.ordonnanceUrl || undefined,
      fournisseur: d.fournisseur || undefined,
      notes: d.notes || undefined,
    },
  })
  return NextResponse.json(
    { data, ajout: { avant: existant.quantite, ajoute: quantiteAjoutee, apres: data.quantite, unite: uniteDuLot } },
    { status: 201 },
  )
}

// Signalement 2026-09-25 (éleveur caprin) — un lot périmé lié à des soins ne
// pouvait ni se supprimer (409, avalé par l'écran) ni se corriger : ni date de
// péremption, ni quantité modifiables. Le lot reste au registre (traçabilité),
// mais son stock se met à zéro (rebut) et ses données se corrigent.
const schemaModification = z.object({
  id: z.string().min(1),
  quantite: z.coerce.number().min(0).optional(),
  datePeremption: z.coerce.date().nullable().optional(),
  fournisseur: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** Mise au rebut : quantité à zéro, note horodatée. Éteint l'alerte du calendrier. */
  rebut: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = schemaModification.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const { id, rebut, ...champs } = parsed.data
  const stock = await prisma.stockMedicamentElevage.findFirst({ where: { id, userId: session.user.id } })
  if (!stock) return NextResponse.json({ error: 'Stock introuvable' }, { status: 404 })
  const data: Record<string, unknown> = { ...champs }
  if (rebut) {
    const jour = new Date().toLocaleDateString('fr-FR')
    data.quantite = 0
    data.notes = [stock.notes, `Mis au rebut le ${jour} (${stock.quantite} ${stock.unite} restants).`].filter(Boolean).join('\n')
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
  const maj = await prisma.stockMedicamentElevage.update({
    where: { id },
    data,
    include: { produit: { select: { id: true, nom: true, amm: true } } },
  })
  return NextResponse.json({ data: maj })
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const stock = await prisma.stockMedicamentElevage.findFirst({
    where: { id, userId: session.user.id },
    include: { _count: { select: { soins: true } } },
  })
  if (!stock) return NextResponse.json({ error: 'Stock introuvable' }, { status: 404 })
  if (stock._count.soins > 0) {
    return NextResponse.json(
      {
        error: `Ce lot est lié à ${stock._count.soins} soin(s) et doit rester dans la traçabilité réglementaire. Mettez-le au rebut (stock à zéro) : il n'apparaîtra plus dans les alertes.`,
        code: 'LIE_A_DES_SOINS',
        nbSoins: stock._count.soins,
      },
      { status: 409 },
    )
  }
  await prisma.stockMedicamentElevage.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
