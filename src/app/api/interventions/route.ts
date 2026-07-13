/**
 * API Interventions
 * GET /api/interventions - Liste des interventions avec filtres
 * POST /api/interventions - Créer une intervention
 * PATCH /api/interventions - Modifier une intervention
 * DELETE /api/interventions - Supprimer une intervention
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromIntervention, deleteAutoEntry } from '@/lib/auto-compta'
import { createInterventionSchema } from '@/lib/validations/intervention'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const userId = session.user.id
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const fait = searchParams.get('fait')
    const annee = searchParams.get('annee')
      ? parseInt(searchParams.get('annee')!)
      : new Date().getFullYear()

    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    // Build where clause for manual interventions
    const where: any = { userId }
    if (type) where.type = type
    if (fait === 'true') where.fait = true
    else if (fait === 'false') where.fait = false

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59')
    } else {
      where.date = { gte: yearStart, lte: yearEnd }
    }

    // === 1. Interventions manuelles (table Intervention) avec résolution noms ===
    const manualInterventions = await prisma.intervention.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    })

    // Résoudre les noms des cultures et planches liées
    const manualCultureIds = [...new Set(manualInterventions.map(i => i.cultureId).filter(Boolean))] as number[]
    const manualPlancheIds = [...new Set(manualInterventions.map(i => i.plancheId).filter(Boolean))] as string[]
    const manualArbreIds = [...new Set(manualInterventions.map(i => i.arbreId).filter(Boolean))] as number[]

    const [refCultures, refPlanches, refArbres] = await Promise.all([
      manualCultureIds.length > 0 ? prisma.culture.findMany({
        where: { id: { in: manualCultureIds } },
        include: { espece: true, variete: true, planche: true },
      }) : [],
      manualPlancheIds.length > 0 ? prisma.planche.findMany({
        where: { id: { in: manualPlancheIds } },
      }) : [],
      manualArbreIds.length > 0 ? prisma.arbre.findMany({
        where: { id: { in: manualArbreIds } },
      }) : [],
    ])

    const cultureMap = new Map(refCultures.map(c => [c.id, c]))
    const plancheMap = new Map(refPlanches.map(p => [p.id, p]))
    const arbreMap = new Map(refArbres.map(a => [a.id, a]))

    // Format manual interventions with source marker and resolved names
    const formattedManual = manualInterventions.map((i: any) => {
      const cult = i.cultureId ? cultureMap.get(i.cultureId) : null
      const planche = i.plancheId ? plancheMap.get(i.plancheId) : null
      const arbre = i.arbreId ? arbreMap.get(i.arbreId) : null
      return {
        ...i,
        source: 'intervention' as const,
        sourceLabel: null as string | null,
        cultureNom: cult ? `${cult.espece?.nom ?? cult.espece?.id ?? '?'}${cult.variete ? ' - ' + (cult.variete.nom ?? cult.variete.id) : ''}` : (arbre ? arbre.nom : null),
        plancheNom: planche?.nom || (cult?.planche as any)?.nom || null,
      }
    })

    // === 2. Cultures : semis et plantations planifiés + réalisés ===
    const cultures = await prisma.culture.findMany({
      where: {
        userId,
        annee,
      },
      include: {
        espece: true,
        variete: true,
        planche: true,
      },
    })

    const cultureEntries: any[] = []
    for (const c of cultures) {
      const cultureLabel = `${c.espece?.nom ?? c.espece?.id ?? '?'}${c.variete ? ' - ' + (c.variete.nom ?? c.variete.id) : ''}`
      const plancheLabel = c.planche?.nom || null

      // Semis planifié ou réalisé
      if (c.dateSemis) {
        const entry = {
          id: c.id * 100000 + 1, // virtual ID
          date: c.dateSemis,
          type: 'semis',
          cultureId: c.id,
          plancheId: c.plancheId,
          arbreId: null,
          description: `Semis ${cultureLabel}${plancheLabel ? ' sur ' + plancheLabel : ''}`,
          dureeMinutes: null,
          nbPersonnes: null,
          coutMainOeuvre: null,
          coutTotal: null,
          datePrevue: c.dateSemis,
          fait: c.semisFait,
          produitPhyto: null, numAMM: null, cibleTraitement: null,
          doseAppliquee: null, uniteDose: null, surfaceTraitee: null,
          dar: null, delaiReentree: null, conditionsMeteo: null,
          intrantNom: null, intrantQuantite: null, intrantUnite: null,
          intrantCout: null, intrantNumLot: null,
          notes: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          source: 'culture' as const,
          sourceLabel: `Culture #${c.id}`,
          cultureNom: cultureLabel,
          plancheNom: plancheLabel,
        }
        cultureEntries.push(entry)
      }

      // Plantation planifiée ou réalisée
      if (c.datePlantation) {
        const entry = {
          id: c.id * 100000 + 2,
          date: c.datePlantation,
          type: 'plantation',
          cultureId: c.id,
          plancheId: c.plancheId,
          arbreId: null,
          description: `Plantation ${cultureLabel}${plancheLabel ? ' sur ' + plancheLabel : ''}`,
          dureeMinutes: null,
          nbPersonnes: null,
          coutMainOeuvre: null,
          coutTotal: null,
          datePrevue: c.datePlantation,
          fait: c.plantationFaite,
          produitPhyto: null, numAMM: null, cibleTraitement: null,
          doseAppliquee: null, uniteDose: null, surfaceTraitee: null,
          dar: null, delaiReentree: null, conditionsMeteo: null,
          intrantNom: null, intrantQuantite: null, intrantUnite: null,
          intrantCout: null, intrantNumLot: null,
          notes: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          source: 'culture' as const,
          sourceLabel: `Culture #${c.id}`,
          cultureNom: cultureLabel,
          plancheNom: plancheLabel,
        }
        cultureEntries.push(entry)
      }

      // Récolte planifiée ou réalisée
      if (c.dateRecolte) {
        const entry = {
          id: c.id * 100000 + 3,
          date: c.dateRecolte,
          type: 'recolte',
          cultureId: c.id,
          plancheId: c.plancheId,
          arbreId: null,
          description: `Recolte ${cultureLabel}${plancheLabel ? ' sur ' + plancheLabel : ''}`,
          dureeMinutes: null,
          nbPersonnes: null,
          coutMainOeuvre: null,
          coutTotal: null,
          datePrevue: c.dateRecolte,
          fait: c.recolteFaite,
          produitPhyto: null, numAMM: null, cibleTraitement: null,
          doseAppliquee: null, uniteDose: null, surfaceTraitee: null,
          dar: null, delaiReentree: null, conditionsMeteo: null,
          intrantNom: null, intrantQuantite: null, intrantUnite: null,
          intrantCout: null, intrantNumLot: null,
          notes: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          source: 'culture' as const,
          sourceLabel: `Culture #${c.id}`,
          cultureNom: cultureLabel,
          plancheNom: plancheLabel,
        }
        cultureEntries.push(entry)
      }
    }

    // === 3. Irrigations planifiées ===
    const irrigations = await prisma.irrigationPlanifiee.findMany({
      where: {
        userId,
        datePrevue: { gte: yearStart, lte: yearEnd },
      },
      include: {
        culture: { include: { espece: true, planche: true } },
      },
    })

    const irrigationEntries = irrigations.map((ir: any) => ({
      id: ir.id * 100000 + 10,
      date: ir.dateEffective || ir.datePrevue,
      type: 'arrosage',
      cultureId: ir.cultureId,
      plancheId: ir.culture?.plancheId || null,
      arbreId: null,
      description: `Irrigation ${ir.culture?.espece?.id || 'culture #' + ir.cultureId}${ir.culture?.planche ? ' sur ' + ir.culture.planche.nom : ''}`,
      dureeMinutes: null,
      nbPersonnes: null,
      coutMainOeuvre: null,
      coutTotal: null,
      datePrevue: ir.datePrevue,
      fait: ir.fait,
      produitPhyto: null, numAMM: null, cibleTraitement: null,
      doseAppliquee: null, uniteDose: null, surfaceTraitee: null,
      dar: null, delaiReentree: null, conditionsMeteo: null,
      intrantNom: null, intrantQuantite: null, intrantUnite: null,
      intrantCout: null, intrantNumLot: null,
      notes: ir.notes,
      createdAt: ir.createdAt,
      updatedAt: ir.updatedAt,
      source: 'irrigation' as const,
      sourceLabel: `Irrigation #${ir.id}`,
      cultureNom: ir.culture?.espece?.id || null,
      plancheNom: ir.culture?.planche?.nom || null,
    }))

    // === 4. Fertilisations ===
    const fertilisations = await prisma.fertilisation.findMany({
      where: {
        userId,
        date: { gte: yearStart, lte: yearEnd },
      },
      include: {
        planche: true,
        fertilisant: true,
      },
    })

    const fertilisationEntries = fertilisations.map((f: any) => ({
      id: f.id * 100000 + 20,
      date: f.date,
      type: 'fertilisation',
      cultureId: null,
      plancheId: f.plancheId,
      arbreId: null,
      description: `${f.fertilisant?.id || 'Fertilisation'} - ${f.quantite}${f.fertilisant?.type === 'liquide' ? 'L' : 'kg'} sur ${f.planche?.nom || '?'}`,
      dureeMinutes: null,
      nbPersonnes: null,
      coutMainOeuvre: null,
      coutTotal: f.fertilisant?.prix ? f.quantite * f.fertilisant.prix : null,
      datePrevue: null,
      fait: true,
      produitPhyto: null, numAMM: null, cibleTraitement: null,
      doseAppliquee: null, uniteDose: null, surfaceTraitee: null,
      dar: null, delaiReentree: null, conditionsMeteo: null,
      intrantNom: f.fertilisant?.id || null,
      intrantQuantite: f.quantite,
      intrantUnite: f.fertilisant?.type === 'liquide' ? 'L' : 'kg',
      intrantCout: f.fertilisant?.prix ? f.quantite * f.fertilisant.prix : null,
      intrantNumLot: null,
      notes: f.notes,
      createdAt: f.createdAt,
      updatedAt: f.createdAt,
      source: 'fertilisation' as const,
      sourceLabel: `Fertilisation #${f.id}`,
      cultureNom: null,
      plancheNom: f.planche?.nom || null,
    }))

    // === 5. Operations arbres ===
    const opsArbres = await prisma.operationArbre.findMany({
      where: {
        userId,
        date: { gte: yearStart, lte: yearEnd },
      },
      include: { arbre: true },
    })

    const arbreEntries = opsArbres.map((op: any) => ({
      id: op.id * 100000 + 30,
      date: op.date,
      type: op.type === 'traitement' ? 'traitement_phyto' : op.type === 'taille' ? 'taille' : op.type === 'fertilisation' ? 'fertilisation' : 'autre',
      cultureId: null,
      plancheId: null,
      arbreId: op.arbreId,
      description: `${op.description || op.type} - ${op.arbre?.nom || 'Arbre #' + op.arbreId}`,
      dureeMinutes: null,
      nbPersonnes: null,
      coutMainOeuvre: null,
      coutTotal: op.cout,
      datePrevue: op.datePrevue,
      fait: op.fait,
      produitPhyto: op.type === 'traitement' ? op.produit : null,
      numAMM: null, cibleTraitement: null,
      doseAppliquee: op.quantite, uniteDose: op.unite,
      surfaceTraitee: null,
      dar: null, delaiReentree: null, conditionsMeteo: null,
      intrantNom: op.produit,
      intrantQuantite: op.quantite,
      intrantUnite: op.unite,
      intrantCout: op.cout,
      intrantNumLot: null,
      notes: op.notes,
      createdAt: op.createdAt,
      updatedAt: op.createdAt,
      source: 'operation_arbre' as const,
      sourceLabel: `Operation arbre #${op.id}`,
      cultureNom: null,
      plancheNom: null,
    }))

    // === 6. Soins animaux ===
    const soins = await prisma.soinAnimal.findMany({
      where: {
        userId,
        date: { gte: yearStart, lte: yearEnd },
      },
      include: {
        animal: true,
        lot: true,
      },
    })

    const soinEntries = soins.map((s: any) => ({
      id: s.id * 100000 + 40,
      date: s.date,
      type: 'autre',
      cultureId: null,
      plancheId: null,
      arbreId: null,
      description: `Soin ${s.type} - ${s.animal?.nom || s.lot?.nom || 'Animal'}${s.description ? ' : ' + s.description : ''}`,
      dureeMinutes: null,
      nbPersonnes: null,
      coutMainOeuvre: null,
      coutTotal: s.cout,
      datePrevue: s.datePrevue,
      fait: s.fait,
      produitPhyto: null, numAMM: null, cibleTraitement: null,
      doseAppliquee: null, uniteDose: null, surfaceTraitee: null,
      dar: null, delaiReentree: null, conditionsMeteo: null,
      intrantNom: s.produit,
      intrantQuantite: s.quantite,
      intrantUnite: s.unite,
      intrantCout: s.cout,
      intrantNumLot: null,
      notes: s.notes,
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
      source: 'soin_animal' as const,
      sourceLabel: `Soin #${s.id}`,
      cultureNom: null,
      plancheNom: null,
    }))

    // === Merge all sources ===
    let allEntries = [
      ...formattedManual,
      ...cultureEntries,
      ...irrigationEntries,
      ...fertilisationEntries,
      ...arbreEntries,
      ...soinEntries,
    ]

    // Deduplicate: if a manual intervention has cultureId + type matching a culture entry, keep only the manual one
    const manualKeys = new Set(
      formattedManual
        .filter((m: any) => m.cultureId && m.type)
        .map((m: any) => `${m.cultureId}-${m.type}`)
    )
    allEntries = allEntries.filter((e: any) => {
      if (e.source !== 'culture') return true
      const key = `${e.cultureId}-${e.type}`
      return !manualKeys.has(key)
    })

    // Apply type filter on merged data
    if (type) {
      allEntries = allEntries.filter((e: any) => e.type === type)
    }

    // Apply fait filter on merged data
    if (fait === 'true') {
      allEntries = allEntries.filter((e: any) => e.fait === true)
    } else if (fait === 'false') {
      allEntries = allEntries.filter((e: any) => e.fait === false)
    }

    // Apply date range filter
    if (dateFrom) {
      const from = new Date(dateFrom)
      allEntries = allEntries.filter((e: any) => new Date(e.date) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59')
      allEntries = allEntries.filter((e: any) => new Date(e.date) <= to)
    }

    // Sort by date desc
    allEntries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // === Stats (all sources for the year) ===
    const stats = {
      total: allEntries.length,
      heuresTravaillees: allEntries
        .reduce((sum: number, i: any) => sum + ((i.dureeMinutes || 0) * (i.nbPersonnes || 1)), 0) / 60,
      coutTotal: allEntries
        .reduce((sum: number, i: any) => sum + (i.coutTotal || 0), 0),
      planifiees: allEntries.filter((i: any) => !i.fait).length,
    }

    return NextResponse.json({ data: allEntries.slice(0, 500), stats })
  } catch (err) {
    console.error('Erreur GET /api/interventions:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createInterventionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const d = parsed.data

    const intervention = await prisma.intervention.create({
      data: {
        userId,
        date: d.date,
        type: d.type,
        cultureId: d.cultureId ?? null,
        plancheId: d.plancheId ?? null,
        arbreId: d.arbreId ?? null,
        description: d.description ?? null,
        dureeMinutes: d.dureeMinutes ?? null,
        nbPersonnes: d.nbPersonnes,
        coutMainOeuvre: d.coutMainOeuvre ?? null,
        coutTotal: d.coutTotal ?? null,
        datePrevue: d.datePrevue ?? null,
        fait: d.fait,
        // Phyto fields
        produitPhyto: d.produitPhyto ?? null,
        numAMM: d.numAMM ?? null,
        cibleTraitement: d.cibleTraitement ?? null,
        doseAppliquee: d.doseAppliquee ?? null,
        uniteDose: d.uniteDose ?? null,
        surfaceTraitee: d.surfaceTraitee ?? null,
        dar: d.dar ?? null,
        delaiReentree: d.delaiReentree ?? null,
        conditionsMeteo: d.conditionsMeteo ?? null,
        // Intrant fields
        intrantNom: d.intrantNom ?? null,
        intrantQuantite: d.intrantQuantite ?? null,
        intrantUnite: d.intrantUnite ?? null,
        intrantCout: d.intrantCout ?? null,
        intrantNumLot: d.intrantNumLot ?? null,
        notes: d.notes ?? null,
        // PROMPT 11 LOT B/D — Traçabilité PBI (justification + lien observation)
        justification: d.justification ?? null,
        observationLieeId: d.observationLieeId ?? null,
        volumeBouillieLHa: d.volumeBouillieLHa ?? null,
        temperatureC: d.temperatureC ?? null,
        ventKmh: d.ventKmh ?? null,
        hygrometriePct: d.hygrometriePct ?? null,
        produitPhytoId: d.produitPhytoId ?? null,
      },
    })

    // Auto-comptabilite : creer une depense si coutTotal > 0
    if (intervention.coutTotal && intervention.coutTotal > 0) {
      try {
        await createDepenseFromIntervention(userId, {
          id: intervention.id,
          type: intervention.type,
          description: intervention.description,
          coutTotal: intervention.coutTotal,
          coutMainOeuvre: intervention.coutMainOeuvre,
          intrantCout: intervention.intrantCout,
          intrantNom: intervention.intrantNom,
          date: intervention.date,
          fait: intervention.fait,
          cultureId: intervention.cultureId,
          plancheId: intervention.plancheId,
          arbreId: intervention.arbreId,
        })
      } catch (autoComptaError) {
        console.error('Auto-compta error (intervention POST):', autoComptaError)
      }
    }

    return NextResponse.json(intervention, { status: 201 })
  } catch (err) {
    console.error('Erreur POST /api/interventions:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const userId = session.user.id
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.intervention.findFirst({
      where: { id: parseInt(id), userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Intervention non trouvée' }, { status: 404 })
    }

    // DEV2 #7 — Audit Larcher : la transition "Planifié → Fait" exige
    // une durée renseignée (sinon les statistiques de coût MO restent
    // à 0). On la bloque ici plutôt que de filtrer après coup.
    if (updates.fait === true && existing.fait === false) {
      const dureeFinale = updates.dureeMinutes !== undefined
        ? parseInt(updates.dureeMinutes)
        : existing.dureeMinutes
      if (!dureeFinale || dureeFinale <= 0) {
        return NextResponse.json(
          {
            error:
              "Durée requise pour passer une intervention en \"Fait\". " +
              "Saisissez le temps de travail (en minutes) pour alimenter les statistiques.",
          },
          { status: 400 }
        )
      }
    }

    // Build update data
    const data: any = {}
    if (updates.date !== undefined) data.date = new Date(updates.date)
    if (updates.type !== undefined) data.type = updates.type
    if (updates.description !== undefined) data.description = updates.description || null
    if (updates.dureeMinutes !== undefined) data.dureeMinutes = updates.dureeMinutes ? parseInt(updates.dureeMinutes) : null
    if (updates.nbPersonnes !== undefined) data.nbPersonnes = updates.nbPersonnes ? parseInt(updates.nbPersonnes) : 1
    if (updates.coutMainOeuvre !== undefined) data.coutMainOeuvre = updates.coutMainOeuvre ? parseFloat(updates.coutMainOeuvre) : null
    if (updates.coutTotal !== undefined) data.coutTotal = updates.coutTotal ? parseFloat(updates.coutTotal) : null
    if (updates.fait !== undefined) data.fait = updates.fait
    if (updates.cultureId !== undefined) data.cultureId = updates.cultureId || null
    if (updates.plancheId !== undefined) data.plancheId = updates.plancheId || null
    if (updates.arbreId !== undefined) data.arbreId = updates.arbreId || null
    if (updates.datePrevue !== undefined) data.datePrevue = updates.datePrevue ? new Date(updates.datePrevue) : null
    // Phyto
    if (updates.produitPhyto !== undefined) data.produitPhyto = updates.produitPhyto || null
    if (updates.numAMM !== undefined) data.numAMM = updates.numAMM || null
    if (updates.cibleTraitement !== undefined) data.cibleTraitement = updates.cibleTraitement || null
    if (updates.doseAppliquee !== undefined) data.doseAppliquee = updates.doseAppliquee ? parseFloat(updates.doseAppliquee) : null
    if (updates.uniteDose !== undefined) data.uniteDose = updates.uniteDose || null
    if (updates.surfaceTraitee !== undefined) data.surfaceTraitee = updates.surfaceTraitee ? parseFloat(updates.surfaceTraitee) : null
    if (updates.dar !== undefined) data.dar = updates.dar ? parseInt(updates.dar) : null
    if (updates.delaiReentree !== undefined) data.delaiReentree = updates.delaiReentree ? parseInt(updates.delaiReentree) : null
    if (updates.conditionsMeteo !== undefined) data.conditionsMeteo = updates.conditionsMeteo || null
    // Intrant
    if (updates.intrantNom !== undefined) data.intrantNom = updates.intrantNom || null
    if (updates.intrantQuantite !== undefined) data.intrantQuantite = updates.intrantQuantite ? parseFloat(updates.intrantQuantite) : null
    if (updates.intrantUnite !== undefined) data.intrantUnite = updates.intrantUnite || null
    if (updates.intrantCout !== undefined) data.intrantCout = updates.intrantCout ? parseFloat(updates.intrantCout) : null
    if (updates.intrantNumLot !== undefined) data.intrantNumLot = updates.intrantNumLot || null
    if (updates.notes !== undefined) data.notes = updates.notes || null

    const updated = await prisma.intervention.update({
      where: { id: parseInt(id) },
      data,
    })

    // Auto-comptabilite : mettre a jour la depense auto
    try {
      if (updated.coutTotal && updated.coutTotal > 0) {
        await createDepenseFromIntervention(userId, {
          id: updated.id,
          type: updated.type,
          description: updated.description,
          coutTotal: updated.coutTotal,
          coutMainOeuvre: updated.coutMainOeuvre,
          intrantCout: updated.intrantCout,
          intrantNom: updated.intrantNom,
          date: updated.date,
          fait: updated.fait,
          cultureId: updated.cultureId,
          plancheId: updated.plancheId,
          arbreId: updated.arbreId,
        })
      } else {
        // Plus de cout -> supprimer la depense auto si elle existe
        await deleteAutoEntry('intervention', updated.id, 'depense')
      }
    } catch (autoComptaError) {
      console.error('Auto-compta error (intervention PATCH):', autoComptaError)
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Erreur PATCH /api/interventions:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = session.user.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.intervention.findFirst({
      where: { id: parseInt(id), userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Intervention non trouvée' }, { status: 404 })
    }

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('intervention', parseInt(id), 'depense')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (intervention):', autoComptaError)
    }

    await prisma.intervention.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erreur DELETE /api/interventions:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
