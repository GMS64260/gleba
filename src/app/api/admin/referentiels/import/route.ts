/**
 * API Admin - Import référentiels
 * POST /api/admin/referentiels/import
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  // Vérifier que l'utilisateur est admin
  if (session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé - Admin requis' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const text = await file.text()
    let data: any

    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide' }, { status: 400 })
    }

    const stats = {
      familles: 0,
      fournisseurs: 0,
      especes: 0,
      varietes: 0,
      itps: 0,
      fertilisants: 0,
      associations: 0,
      rotations: 0,
    }

    // Import selon le type
    const importers: Record<string, () => Promise<void>> = {
      familles: async () => {
        for (const item of data.familles || []) {
          await prisma.famille.upsert({
            where: { id: item.id },
            update: { intervalle: item.intervalle, couleur: item.couleur, description: item.description },
            create: item,
          })
          stats.familles++
        }
      },
      fournisseurs: async () => {
        for (const item of data.fournisseurs || []) {
          await prisma.fournisseur.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.fournisseurs++
        }
      },
      especes: async () => {
        for (const item of data.especes || []) {
          await prisma.espece.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.especes++
        }
      },
      varietes: async () => {
        for (const item of data.varietes || []) {
          await prisma.variete.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.varietes++
        }
      },
      itps: async () => {
        for (const item of data.itps || []) {
          await prisma.iTP.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.itps++
        }
      },
      fertilisants: async () => {
        for (const item of data.fertilisants || []) {
          await prisma.fertilisant.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.fertilisants++
        }
      },
      associations: async () => {
        for (const item of data.associations || []) {
          await prisma.association.upsert({
            where: { id: item.id },
            update: { nom: item.nom, description: item.description, notes: item.notes },
            create: { id: item.id, nom: item.nom, description: item.description, notes: item.notes },
          })
          stats.associations++

          // Import des détails
          if (item.details) {
            for (const detail of item.details) {
              await prisma.associationDetail.upsert({
                where: { id: detail.id },
                update: { ...detail },
                create: detail,
              })
            }
          }
        }
      },
      rotations: async () => {
        for (const item of data.rotations || []) {
          await prisma.rotation.upsert({
            where: { id: item.id },
            update: { active: item.active, nbAnnees: item.nbAnnees, notes: item.notes },
            create: { id: item.id, active: item.active, nbAnnees: item.nbAnnees, notes: item.notes },
          })
          stats.rotations++

          // Import des détails
          if (item.details) {
            for (const detail of item.details) {
              await prisma.rotationDetail.upsert({
                where: { id: detail.id },
                update: { ...detail },
                create: detail,
              })
            }
          }
        }
      },
    }

    // Importer selon le type demandé
    if (type === 'all') {
      for (const [key, importer] of Object.entries(importers)) {
        await importer()
      }
    } else if (importers[type]) {
      await importers[type]()
    } else {
      return NextResponse.json({ error: 'Type de référentiel invalide' }, { status: 400 })
    }

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      message: `${total} enregistrements importés`,
      stats,
    })
  } catch (error) {
    console.error('POST /api/admin/referentiels/import error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'import', details: String(error) },
      { status: 500 }
    )
  }
}
