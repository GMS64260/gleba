/**
 * API Admin - Import référentiels
 * POST /api/admin/referentiels/import
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // Limite taille fichier : 10 Mo
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 10 Mo)' },
        { status: 413 }
      )
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
      // Itinéraires sourcés laissés intacts (cf. la garde de l'importeur ITP).
      itpsProteges: 0,
      fertilisants: 0,
      associations: 0,
      rotations: 0,
    }

    // Import selon le type.
    //
    // Les importeurs prennent le client de TRANSACTION : la boucle « all » les
    // enchaînait hors transaction, si bien qu'une erreur au milieu laissait le
    // référentiel à moitié importé — familles et espèces écrites, variétés et
    // itinéraires non, sans aucun moyen de savoir où ça s'était arrêté.
    const construireImporteurs = (
      db: Prisma.TransactionClient
    ): Record<string, () => Promise<void>> => ({
      familles: async () => {
        for (const item of data.familles || []) {
          await db.famille.upsert({
            where: { id: item.id },
            update: { intervalle: item.intervalle, couleur: item.couleur, description: item.description },
            create: item,
          })
          stats.familles++
        }
      },
      fournisseurs: async () => {
        for (const item of data.fournisseurs || []) {
          await db.fournisseur.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.fournisseurs++
        }
      },
      especes: async () => {
        for (const item of data.especes || []) {
          await db.espece.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.especes++
        }
      },
      varietes: async () => {
        for (const item of data.varietes || []) {
          await db.variete.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.varietes++
        }
      },
      itps: async () => {
        for (const item of data.itps || []) {
          // Références SOURCÉES : intouchables par un import.
          //
          // `update: { ...item }` réécrivait les 552 itinéraires INRAE aux
          // semaines du fichier et réactivait les 4 scénarios désactivés, sans
          // trace ni migration — alors que l'interface les déclare protégés
          // (PUT et DELETE /api/itps/[id] répondent 409 sur `sourceRecordId`).
          // Et `create: item` réinjectait `user_id` / `partage_communaute` du
          // fichier : sur une instance où ce compte n'existe pas, l'insertion
          // échoue ; là où il existe, on attribue un itinéraire à quelqu'un
          // d'autre. L'import ne fixe donc plus l'attribution.
          const existant = await db.iTP.findUnique({
            where: { id: item.id },
            select: { sourceRecordId: true },
          })
          if (existant?.sourceRecordId || item.sourceRecordId) {
            stats.itpsProteges = (stats.itpsProteges ?? 0) + 1
            continue
          }
          const { userId: _userId, partageCommunaute: _partage, ...champs } = item as Record<
            string,
            unknown
          >
          void _userId
          void _partage
          await db.iTP.upsert({
            where: { id: item.id },
            update: champs,
            create: champs as typeof item,
          })
          stats.itps++
        }
      },
      fertilisants: async () => {
        for (const item of data.fertilisants || []) {
          await db.fertilisant.upsert({
            where: { id: item.id },
            update: { ...item },
            create: item,
          })
          stats.fertilisants++
        }
      },
      associations: async () => {
        for (const item of data.associations || []) {
          await db.association.upsert({
            where: { id: item.id },
            update: { nom: item.nom, description: item.description, notes: item.notes },
            create: { id: item.id, nom: item.nom, description: item.description, notes: item.notes },
          })
          stats.associations++

          // Import des details imbriqués
          if (item.details && Array.isArray(item.details)) {
            for (const detail of item.details) {
              // Vérifier si existe déjà pour éviter doublons
              const existing = await db.associationDetail.findFirst({
                where: {
                  associationId: item.id,
                  especeId: detail.especeId,
                  familleId: detail.familleId,
                  groupe: detail.groupe,
                },
              })

              if (existing) {
                // Update
                await db.associationDetail.update({
                  where: { id: existing.id },
                  data: {
                    requise: detail.requise ?? false,
                    notes: detail.notes,
                  },
                })
              } else {
                // Create
                await db.associationDetail.create({
                  data: {
                    associationId: item.id,
                    especeId: detail.especeId,
                    familleId: detail.familleId,
                    groupe: detail.groupe,
                    requise: detail.requise ?? false,
                    notes: detail.notes,
                  },
                })
              }
            }
          }
        }
      },
      rotations: async () => {
        for (const item of data.rotations || []) {
          await db.rotation.upsert({
            where: { id: item.id },
            update: { active: item.active, nbAnnees: item.nbAnnees, notes: item.notes },
            create: { id: item.id, active: item.active, nbAnnees: item.nbAnnees, notes: item.notes },
          })
          stats.rotations++

          // Import des details
          if (item.details) {
            for (const detail of item.details) {
              await db.rotationDetail.upsert({
                where: { id: detail.id },
                update: { ...detail },
                create: detail,
              })
            }
          }
        }
      },
    })

    // Importer selon le type demandé, tout ou rien.
    if (type !== 'all' && !construireImporteurs(prisma as unknown as Prisma.TransactionClient)[type]) {
      return NextResponse.json({ error: 'Type de référentiel invalide' }, { status: 400 })
    }
    await prisma.$transaction(
      async (tx) => {
        const importers = construireImporteurs(tx)
        if (type === 'all') {
          for (const importer of Object.values(importers)) {
            await importer()
          }
        } else {
          await importers[type]()
        }
      },
      { timeout: 120_000 }
    )

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      message: `${total} enregistrements importés`,
      stats,
    })
  } catch (error) {
    console.error('POST /api/admin/referentiels/import error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'import', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
