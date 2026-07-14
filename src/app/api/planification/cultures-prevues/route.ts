/**
 * API Route pour les cultures prévues
 * GET /api/planification/cultures-prevues
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getCulturesPrevues } from '@/lib/planification'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const groupBy = searchParams.get('groupBy') || 'espece'
    const especeId = searchParams.get('especeId') || undefined
    const ilot = searchParams.get('ilot') || undefined
    const plancheId = searchParams.get('plancheId') || undefined

    const culturesPrevues = await getCulturesPrevues(userId, annee, {
      especeId,
      ilot,
      plancheId,
    })

    // Grouper selon le parametre
    let data = culturesPrevues
    const stats = {
      total: culturesPrevues.length,
      existantes: culturesPrevues.filter(c => c.existante).length,
      aCreer: culturesPrevues.filter(c => !c.existante).length,
      surfaceTotale: culturesPrevues.reduce((sum, c) => sum + c.surface, 0),
      parEspece: {} as Record<string, number>,
      parIlot: {} as Record<string, number>,
    }

    // Calculer les stats par espece et ilot
    for (const culture of culturesPrevues) {
      if (culture.especeId) {
        stats.parEspece[culture.especeId] = (stats.parEspece[culture.especeId] || 0) + 1
      }
      const ilotKey = culture.ilot || 'Sans ilot'
      stats.parIlot[ilotKey] = (stats.parIlot[ilotKey] || 0) + 1
    }

    // Trier selon le groupement
    if (groupBy === 'espece') {
      data = [...culturesPrevues].sort((a, b) => {
        const especeCompare = (a.especeId || '').localeCompare(b.especeId || '')
        if (especeCompare !== 0) return especeCompare
        return a.plancheId.localeCompare(b.plancheId)
      })
    } else if (groupBy === 'ilot') {
      data = [...culturesPrevues].sort((a, b) => {
        const ilotCompare = (a.ilot || '').localeCompare(b.ilot || '')
        if (ilotCompare !== 0) return ilotCompare
        return a.plancheId.localeCompare(b.plancheId)
      })
    } else if (groupBy === 'planche') {
      data = [...culturesPrevues].sort((a, b) => a.plancheId.localeCompare(b.plancheId))
    }

    // Résoudre un NOM lisible pour les FK especeId / itpId : pour une entrée
    // perso, la FK est un cuid opaque, le nom affichable est dans `nom` (pour
    // l'officiel, nom = id). On construit des Map id→nom (même motif que la Map
    // de couleurs des espèces ailleurs dans la planification) et on expose
    // especeNom / itpNom en plus — sans toucher especeId (clé de group/tri).
    const especeIds = [...new Set(culturesPrevues.map(c => c.especeId).filter(Boolean) as string[])]
    const itpIds = [...new Set(culturesPrevues.map(c => c.itpId).filter(Boolean) as string[])]
    const [especes, itps] = await Promise.all([
      especeIds.length
        ? prisma.espece.findMany({ where: { id: { in: especeIds } }, select: { id: true, nom: true } })
        : Promise.resolve([]),
      itpIds.length
        ? prisma.iTP.findMany({ where: { id: { in: itpIds } }, select: { id: true, nom: true } })
        : Promise.resolve([]),
    ])
    const especeNomMap = new Map(especes.map(e => [e.id, e.nom]))
    const itpNomMap = new Map(itps.map(i => [i.id, i.nom]))

    const dataAvecNoms = data.map(c => ({
      ...c,
      especeNom: c.especeId ? (especeNomMap.get(c.especeId) ?? c.especeId) : null,
      itpNom: c.itpId ? (itpNomMap.get(c.itpId) ?? c.itpId) : null,
    }))

    return NextResponse.json({
      data: dataAvecNoms,
      stats,
      annee,
      groupBy,
    })
  } catch (error) {
    console.error('GET /api/planification/cultures-prevues error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des cultures prévues', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
