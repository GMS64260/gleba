/**
 * API Aliments (multi-tenancy via UserStockAliment)
 * GET /api/elevage/aliments - Liste des aliments avec stock per-user
 * POST /api/elevage/aliments - Créer un aliment + stock per-user
 * PATCH /api/elevage/aliments - Mettre à jour le stock per-user
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    const where: any = { OR: [{ ownerUserId: null }, { ownerUserId: userId }] }
    if (type) where.type = type

    // Fenêtre de 30 j pour estimer la consommation moyenne journalière (→ jours
    // d'autonomie). GAP P0 review caprin 2026-07-22.
    const FENETRE_J = 30
    const depuis = new Date(Date.now() - FENETRE_J * 86_400_000)

    const [aliments, consoParAliment] = await Promise.all([
      prisma.aliment.findMany({
        where,
        orderBy: { nom: 'asc' },
        include: {
          fournisseur: {
            select: { id: true, contact: true },
          },
          _count: {
            select: { consommations: { where: { userId } } },
          },
          userStocks: {
            where: { userId },
            select: {
              stock: true,
              dateStock: true,
              stockMin: true,
              prix: true,
            },
          },
        },
      }),
      // Consommation de l'utilisateur par aliment sur la fenêtre (scopé userId).
      prisma.consommationAliment.groupBy({
        by: ['alimentId'],
        where: { userId, date: { gte: depuis } },
        _sum: { quantite: true },
        _min: { date: true },
      }),
    ])

    const consoMoyJourParAliment = new Map<string, number>()
    for (const c of consoParAliment) {
      const total = Number(c._sum.quantite || 0)
      const premierJour = c._min.date
      const joursObserves = premierJour
        ? Math.min(FENETRE_J, Math.max(1, Math.ceil((Date.now() - premierJour.getTime()) / 86_400_000)))
        : FENETRE_J
      if (total > 0) consoMoyJourParAliment.set(c.alimentId, total / joursObserves)
    }

    // Fusionner les données de stock per-user avec les données de reference
    const alimentsWithUserStock = aliments.map(a => {
      const stock = a.userStocks[0]?.stock ?? null
      const consoMoyJour = consoMoyJourParAliment.get(a.id) ?? null
      // Autonomie : jours restants au rythme moyen des 30 derniers jours + date
      // de rupture estimée. null si pas de conso récente ou pas de stock.
      const joursAutonomie =
        stock != null && consoMoyJour != null && consoMoyJour > 0
          ? Math.floor(stock / consoMoyJour)
          : null
      const dateRupture =
        joursAutonomie != null ? new Date(Date.now() + joursAutonomie * 86_400_000).toISOString() : null
      return {
        id: a.id,
        nom: a.nom,
        type: a.type,
        especesCibles: a.especesCibles,
        proteines: a.proteines,
        energie: a.energie,
        // PROMPT 25 — valeurs alimentaires INRA pour le calcul de ration
        ufl: a.ufl,
        pdin: a.pdin,
        pdie: a.pdie,
        uel: a.uel,
        prix: a.userStocks[0]?.prix ?? a.prix,
        stock,
        stockMin: a.userStocks[0]?.stockMin ?? a.stockMin,
        dateStock: a.userStocks[0]?.dateStock ?? null,
        consoMoyJour: consoMoyJour != null ? Math.round(consoMoyJour * 100) / 100 : null,
        joursAutonomie,
        dateRupture,
        fournisseur: a.fournisseur,
        description: a.description,
        origine: a.origine,
        _count: a._count,
      }
    })

    // Aliments avec stock bas
    const alimentsStockBas = alimentsWithUserStock.filter(
      a => a.stock !== null && a.stockMin !== null && a.stock <= a.stockMin
    )

    return NextResponse.json({
      data: alimentsWithUserStock,
      stats: {
        total: alimentsWithUserStock.length,
        stockBas: alimentsStockBas.length,
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/aliments error:', error)
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
    const userId = session.user.id
    const body = await request.json()
    const {
      id,
      nom,
      type,
      especesCibles,
      proteines,
      energie,
      ufl,
      pdin,
      pdie,
      uel,
      prix,
      stock,
      stockMin,
      fournisseurId,
      description,
    } = body
    const num = (v: unknown) => (v === "" || v == null ? null : parseFloat(v as string))

    if (!id || !nom) {
      return NextResponse.json(
        { error: 'ID et nom requis' },
        { status: 400 }
      )
    }

    const parsedStock = stock ? parseFloat(stock) : null
    const parsedPrix = prix ? parseFloat(prix) : null
    const parsedStockMin = stockMin ? parseFloat(stockMin) : null

    if (fournisseurId) {
      const fournisseur = await prisma.fournisseur.findFirst({
        where: { id: fournisseurId },
        select: { id: true },
      })
      if (!fournisseur) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 400 })
    }

    // Créer un aliment privé + stock per-user en transaction. Les aliments
    // officiels restent administrés hors de cette route utilisateur.
    const [aliment] = await prisma.$transaction([
      prisma.aliment.create({
        data: {
          id,
          nom,
          type,
          especesCibles,
          proteines: proteines ? parseFloat(proteines) : null,
          energie: energie ? parseFloat(energie) : null,
          ufl: num(ufl),
          pdin: num(pdin),
          pdie: num(pdie),
          uel: num(uel),
          prix: parsedPrix,
          fournisseurId,
          description,
          ownerUserId: userId,
          origine: 'prive',
        },
        include: {
          fournisseur: true,
        },
      }),
      // Aussi créer le stock per-user si un stock est fourni
      ...(parsedStock !== null ? [
        prisma.userStockAliment.create({
          data: {
            userId,
            alimentId: id,
            stock: parsedStock,
            dateStock: new Date(),
            stockMin: parsedStockMin,
            prix: parsedPrix,
          },
        }),
      ] : []),
    ])

    return NextResponse.json({ data: aliment }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/elevage/aliments error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Un aliment avec cet ID existe déjà' },
        { status: 409 }
      )
    }
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
    const userId = session.user.id
    const body = await request.json()
    const { id, stock, prix, stockMin } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Audit #91 : le front envoie null quand le champ est vide → parseFloat(null)
    // = NaN persisté (casse ensuite les totaux). On convertit proprement :
    // vide/null/invalide → null, sinon le nombre.
    const num = (v: unknown): number | null => {
      if (v === undefined || v === null || v === '') return null
      const n = parseFloat(String(v))
      return Number.isNaN(n) ? null : n
    }
    const stockN = stock !== undefined ? num(stock) : undefined
    const prixN = prix !== undefined ? num(prix) : undefined
    const stockMinN = stockMin !== undefined ? num(stockMin) : undefined

    // Mettre à jour le stock per-user via upsert
    const userStock = await prisma.userStockAliment.upsert({
      where: { userId_alimentId: { userId, alimentId: id } },
      create: {
        userId,
        alimentId: id,
        stock: stockN ?? null,
        prix: prixN ?? null,
        stockMin: stockMinN ?? null,
        dateStock: stock !== undefined ? new Date() : null,
      },
      update: {
        stock: stockN,
        prix: prixN,
        stockMin: stockMinN,
        dateStock: stock !== undefined ? new Date() : undefined,
      },
    })

    return NextResponse.json({ data: userStock })
  } catch (error) {
    console.error('PATCH /api/elevage/aliments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
