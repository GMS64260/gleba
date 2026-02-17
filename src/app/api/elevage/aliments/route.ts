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

    const where: any = {}
    if (type) where.type = type

    const aliments = await prisma.aliment.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: {
        fournisseur: {
          select: { id: true, contact: true },
        },
        _count: {
          select: { consommations: true },
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
    })

    // Fusionner les données de stock per-user avec les données de référence
    const alimentsWithUserStock = aliments.map(a => ({
      id: a.id,
      nom: a.nom,
      type: a.type,
      especesCibles: a.especesCibles,
      proteines: a.proteines,
      energie: a.energie,
      prix: a.userStocks[0]?.prix ?? a.prix,
      stock: a.userStocks[0]?.stock ?? null,
      stockMin: a.userStocks[0]?.stockMin ?? a.stockMin,
      dateStock: a.userStocks[0]?.dateStock ?? null,
      fournisseur: a.fournisseur,
      description: a.description,
      _count: a._count,
    }))

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
      prix,
      stock,
      stockMin,
      fournisseurId,
      description,
    } = body

    if (!id || !nom) {
      return NextResponse.json(
        { error: 'ID et nom requis' },
        { status: 400 }
      )
    }

    const parsedStock = stock ? parseFloat(stock) : null
    const parsedPrix = prix ? parseFloat(prix) : null
    const parsedStockMin = stockMin ? parseFloat(stockMin) : null

    // Créer l'aliment (référence globale) + stock per-user en transaction
    const [aliment] = await prisma.$transaction([
      prisma.aliment.create({
        data: {
          id,
          nom,
          type,
          especesCibles,
          proteines: proteines ? parseFloat(proteines) : null,
          energie: energie ? parseFloat(energie) : null,
          prix: parsedPrix,
          fournisseurId,
          description,
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

    // Mettre à jour le stock per-user via upsert
    const userStock = await prisma.userStockAliment.upsert({
      where: { userId_alimentId: { userId, alimentId: id } },
      create: {
        userId,
        alimentId: id,
        stock: stock !== undefined ? parseFloat(stock) : null,
        prix: prix !== undefined ? parseFloat(prix) : null,
        stockMin: stockMin !== undefined ? parseFloat(stockMin) : null,
        dateStock: stock !== undefined ? new Date() : null,
      },
      update: {
        stock: stock !== undefined ? parseFloat(stock) : undefined,
        prix: prix !== undefined ? parseFloat(prix) : undefined,
        stockMin: stockMin !== undefined ? parseFloat(stockMin) : undefined,
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
