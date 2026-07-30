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
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromSoinAnimal, deleteAutoEntry } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { soinPatchSchema, soinSchema } from '@/lib/validations/elevage-soin'
import { calendrierInjections, derniereInjectionActive, ajouterJours } from '@/lib/elevage/injections'
import { randomUUID } from 'node:crypto'
// Review caprin 2026-07-22 — écartement du lait recalculé depuis la vérité
// (recompute-from-truth), cross-granularité individu↔lot et symétrique
// POST/PATCH/DELETE. Cf. src/lib/elevage/attente-lait.ts.
import { ciblesAffectees, resyncEcartementLait } from '@/lib/elevage/attente-lait'
import { estEspeceSansDelaiLait } from '@/lib/elevage/cibles-collecte-lait'
import {
  PLANCHER_CASCADE_LAIT_J,
  PLANCHER_CASCADE_VIANDE_J,
  resoudreDelaisVeterinaires,
  type EspecePourDelai,
} from '@/lib/elevage/delais-veterinaires'

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

const TYPES_MEDICAMENTEUX = new Set([
  'Vaccination',
  'Vermifuge',
  'Traitement vétérinaire',
])

// Fenêtre couverte par un soin (pour cibler le resync) : de sa date à la plus
// lointaine de ses fins d'attente. Bornes filtrées des nulls.
function fenetreSoin(...dates: (Date | null | undefined)[]): { min: Date; max: Date } | null {
  const ds = dates.filter((x): x is Date => x != null)
  if (ds.length === 0) return null
  const t = ds.map((d) => d.getTime())
  return { min: new Date(Math.min(...t)), max: new Date(Math.max(...t)) }
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
    const rappels = searchParams.get('rappels') === '1'
    const filiere = searchParams.get('filiere')
    const limit = parseInt(searchParams.get('limit') || '100')
    const annee = parseInt(searchParams.get('annee') || String(new Date().getFullYear()))
    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    // Le mode `rappels=1` sert aux dashboards opérationnels : il doit inclure
    // tous les soins planifiés non réalisés, y compris un retard de l'année
    // précédente ou une échéance de l'année suivante. Le GET historique garde
    // son filtre annuel et sa pagination existants.
    const where: any = rappels
      ? { userId: session.user.id, fait: false, datePrevue: { not: null } }
      : { userId: session.user.id, date: { gte: yearStart, lte: yearEnd } }
    if (animalId) where.animalId = parseInt(animalId)
    if (lotId) where.lotId = parseInt(lotId)
    if (type) where.type = type
    if (fait !== null && fait !== undefined) where.fait = fait === 'true'
    if (filiere) {
      where.OR = [
        { animal: { especeAnimale: { filiere } } },
        { lot: { especeAnimale: { filiere } } },
      ]
    }

    const soins = await prisma.soinAnimal.findMany({
      where,
      orderBy: [{ fait: 'asc' }, { datePrevue: 'asc' }, { date: 'desc' }],
      ...(rappels ? {} : { take: limit }),
      include: {
        animal: { select: { id: true, nom: true, identifiant: true, especeAnimale: { select: { id: true, filiere: true } } } },
        lot: { select: { id: true, nom: true, especeAnimale: { select: { id: true, filiere: true } } } },
        produitVeterinaire: { select: { id: true, nom: true, substanceActive: true } },
        stockMedicament: {
          select: {
            id: true,
            numeroLot: true,
            datePeremption: true,
            ordonnanceUrl: true,
            quantite: true,
            unite: true,
          },
        },
      },
    })
    const injections = soins.length > 0
      ? await prisma.$queryRaw<Array<{ id: string; soinId: number; numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string }>>`
          SELECT id, soin_id AS "soinId", numero, date_prevue AS "datePrevue",
                 date_realisee AS "dateRealisee", statut
          FROM injections_soins
          WHERE user_id = ${session.user.id} AND soin_id IN (${Prisma.join(soins.map((s) => s.id))})
          ORDER BY soin_id, numero
        `
      : []
    const injectionsParSoin = new Map<number, typeof injections>()
    for (const injection of injections) {
      const list = injectionsParSoin.get(injection.soinId) ?? []
      list.push(injection)
      injectionsParSoin.set(injection.soinId, list)
    }

    const soinsAVenir = await prisma.soinAnimal.count({
      where: { userId: session.user.id, fait: false },
    })

    return NextResponse.json({
      data: soins.map((soin) => ({ ...soin, injections: injectionsParSoin.get(soin.id) ?? [] })),
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
    let cibleEspece: EspecePourDelai | null = null
    if (d.animalId) {
      const a = await prisma.animal.findFirst({
        where: { id: d.animalId, userId: session.user.id },
        select: {
          id: true,
          especeAnimale: {
            select: { id: true, nom: true, categorieReglementaire: true, type: true, production: true, productions: true },
          },
        },
      })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
      cibleEspece = a.especeAnimale
    }
    if (d.lotId) {
      const l = await prisma.lotAnimaux.findFirst({
        where: { id: d.lotId, userId: session.user.id },
        select: {
          id: true,
          especeAnimale: {
            select: { id: true, nom: true, categorieReglementaire: true, type: true, production: true, productions: true },
          },
        },
      })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
      cibleEspece = l.especeAnimale
    }

    // Snapshot temps d'attente depuis le produit FK si renseigné
    let tempsLait = 0
    let tempsViande = 0
    let nomProduit = d.produit || null
    let delaiAttenteSource: string | null = d.produitId ? 'referentiel_produit' : 'saisie_libre'
    let produitHorsAmm = false
    if (d.produitId) {
      const p = await prisma.produitVeterinaire.findUnique({
        where: { id: d.produitId },
        include: {
          delaisParEspece: cibleEspece
            ? { where: { especeAnimaleId: cibleEspece.id } }
            : false,
        },
      })
      if (!p) return NextResponse.json({ error: 'Produit vétérinaire introuvable' }, { status: 400 })
      const resolus = resoudreDelaisVeterinaires(p, cibleEspece)
      tempsLait = resolus.tempsAttenteLaitJ
      tempsViande = resolus.tempsAttenteViandeJ
      delaiAttenteSource = resolus.source
      produitHorsAmm = !resolus.couvertAmm
      if (!nomProduit) nomProduit = p.nom
    }
    const soinMedicamenteux = TYPES_MEDICAMENTEUX.has(d.type)
    if (soinMedicamenteux && d.produitId && !d.stockMedicamentId) {
      return NextResponse.json(
        {
          error: "Sélectionnez un lot de pharmacie pour ce médicament.",
          code: "LOT_PHARMACIE_REQUIS",
        },
        { status: 422 },
      )
    }
    const stockMedicament = d.stockMedicamentId
      ? await prisma.stockMedicamentElevage.findFirst({
          where: { id: d.stockMedicamentId, userId: session.user.id },
        })
      : null
    if (d.stockMedicamentId && !stockMedicament) {
      return NextResponse.json({ error: "Lot de pharmacie introuvable." }, { status: 404 })
    }
    if (stockMedicament && stockMedicament.produitId !== d.produitId) {
      return NextResponse.json(
        { error: "Le lot de pharmacie ne correspond pas au produit sélectionné." },
        { status: 422 },
      )
    }
    if (stockMedicament?.datePeremption && stockMedicament.datePeremption.getTime() < dateSoin.getTime()) {
      return NextResponse.json(
        { error: `Le lot ${stockMedicament.numeroLot} est périmé à la date du soin.` },
        { status: 422 },
      )
    }
    if (stockMedicament && (!d.quantite || d.quantite <= 0)) {
      return NextResponse.json(
        { error: `Renseignez la quantité prélevée en ${stockMedicament.unite}.` },
        { status: 422 },
      )
    }
    // QA caprin cms1v5j14 — délais surchargeables par soin : la valeur AMM du
    // produit n'est qu'un défaut, l'ordonnance du vétérinaire prime (usage hors
    // AMM/cascade : délais majorés). null = conserver la valeur du produit.
    const defautLait = tempsLait
    const defautViande = tempsViande
    if (d.tempsAttenteLaitJ != null) {
      tempsLait = produitHorsAmm
        ? Math.max(PLANCHER_CASCADE_LAIT_J, d.tempsAttenteLaitJ)
        : d.tempsAttenteLaitJ
    }
    if (d.tempsAttenteViandeJ != null) {
      tempsViande = produitHorsAmm
        ? Math.max(PLANCHER_CASCADE_VIANDE_J, d.tempsAttenteViandeJ)
        : d.tempsAttenteViandeJ
    }
    if (d.tempsAttenteLaitJ != null || d.tempsAttenteViandeJ != null) {
      if (tempsLait !== defautLait || tempsViande !== defautViande) {
        delaiAttenteSource = 'prescription'
      }
    }
    // QA 2026-07-30 — Un traitement sur un lot de pondeuses affichait « LAIT
    // 03/08 » : ni le formulaire ni cette route ne vérifiaient que l'espèce
    // ciblée produit du lait, et la matrice AMM décline le délai lait sur
    // toutes les espèces couvertes, volailles incluses. Un délai œufs n'existe
    // pas encore au schéma : on neutralise donc le délai lait plutôt que
    // d'afficher une date de retrait trompeuse.
    if (tempsLait > 0 && estEspeceSansDelaiLait(cibleEspece)) {
      tempsLait = 0
    }
    // PROMPT 30 — un traitement peut compter plusieurs injections (ex. J0/J1/J2).
    // Le délai d'attente court depuis la DERNIÈRE injection.
    const nbInjections = d.nbInjections ?? 1
    const intervalleH = d.intervalleInjectionsHeures ?? null
    const derniereInjection = nbInjections > 1 && intervalleH
      ? new Date(dateSoin.getTime() + (nbInjections - 1) * intervalleH * 3_600_000)
      : dateSoin
    // Un soin planifie n'est pas encore administre : on conserve le snapshot
    // des delais du produit, mais la fenetre ne devient effective qu'au
    // passage a `fait=true`.
    const finLait = d.fait && tempsLait > 0 ? addDays(derniereInjection, tempsLait) : null
    const finViande = d.fait && tempsViande > 0 ? addDays(derniereInjection, tempsViande) : null

    const result = await prisma.$transaction(async (tx) => {
      const quantitePrelevee = d.fait && stockMedicament ? d.quantite ?? 0 : 0
      if (quantitePrelevee > 0) {
        const decremente = await tx.stockMedicamentElevage.updateMany({
          where: {
            id: stockMedicament!.id,
            userId: session.user.id,
            quantite: { gte: quantitePrelevee },
          },
          data: { quantite: { decrement: quantitePrelevee } },
        })
        if (decremente.count !== 1) {
          throw new Error(`STOCK_MEDICAMENT_INSUFFISANT:${stockMedicament!.quantite}`)
        }
      }
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
          stockMedicamentId: stockMedicament?.id ?? null,
          numeroLotMedicament: stockMedicament?.numeroLot ?? null,
          peremptionMedicament: stockMedicament?.datePeremption ?? null,
          quantitePreleveeStock: quantitePrelevee,
          dose: d.dose ?? null,
          voie: d.voie ?? null,
          motif: d.motif ?? null,
          ordonnanceUrl: d.ordonnanceUrl || stockMedicament?.ordonnanceUrl || null,
          quantite: d.quantite ?? null,
          unite: d.unite ?? null,
          cout: d.cout ?? null,
          veterinaire: d.veterinaire ?? null,
          datePrevue: d.datePrevue ?? null,
          fait: d.fait,
          notes: d.notes ?? null,
          nbInjections,
          intervalleInjectionsHeures: intervalleH,
          tempsAttenteLaitJ: tempsLait > 0 ? tempsLait : null,
          tempsAttenteViandeJ: tempsViande > 0 ? tempsViande : null,
          delaiAttenteSource,
          finAttenteLait: finLait,
          finAttenteViande: finViande,
        },
        include: { animal: true, lot: true, produitVeterinaire: true },
      })
      const calendrier = calendrierInjections(dateSoin, nbInjections, intervalleH, d.fait)
      for (const injection of calendrier) {
        await tx.$executeRaw`
          INSERT INTO injections_soins
            (id, user_id, soin_id, numero, date_prevue, date_realisee, statut, created_at, updated_at)
          VALUES
            (${randomUUID()}, ${session.user.id}, ${soin.id}, ${injection.numero},
             ${injection.datePrevue}, ${injection.dateRealisee ?? null}, ${injection.statut},
             NOW(), NOW())
        `
      }

      // Écartement des collectes (cross-granularité individu↔lot, recompute).
      let nbEcartees = 0
      if (finLait) {
        const cibles = await ciblesAffectees(tx, session.user.id, d.animalId ?? null, d.lotId ?? null)
        nbEcartees = await resyncEcartementLait(tx, session.user.id, cibles, dateSoin, finLait)
      }
      await createDepenseFromSoinAnimal(session.user.id, {
        id: soin.id,
        type: soin.type,
        cout: soin.cout,
        date: soin.date,
        fait: soin.fait,
      }, tx)
      return { soin, nbEcartees }
    })
    invalidateKpi(session.user.id)

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
    if (err instanceof Error && err.message.startsWith('STOCK_MEDICAMENT_INSUFFISANT:')) {
      const disponible = err.message.split(':')[1]
      return NextResponse.json(
        { error: `Stock insuffisant : ${disponible} disponible(s).`, code: 'STOCK_MEDICAMENT_INSUFFISANT' },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = soinPatchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, fait, date, notes, type, description, produit, quantite, unite, cout, datePrevue, veterinaire, animalId, lotId, dose, voie, motif, ordonnanceUrl, nbInjections, intervalleInjectionsHeures, tempsAttenteLaitJ, tempsAttenteViandeJ, stockMedicamentId } = parsed.data

    const existing = await prisma.soinAnimal.findFirst({
      where: { id, userId: session.user.id },
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
    if (quantite !== undefined) updateData.quantite = quantite
    if (unite !== undefined) updateData.unite = unite
    if (cout !== undefined) updateData.cout = cout
    if (datePrevue !== undefined) updateData.datePrevue = datePrevue ? new Date(datePrevue) : null
    if (veterinaire !== undefined) updateData.veterinaire = veterinaire
    if (animalId !== undefined) updateData.animalId = animalId
    if (lotId !== undefined) updateData.lotId = lotId
    if (dose !== undefined) updateData.dose = dose
    if (voie !== undefined) updateData.voie = voie
    if (motif !== undefined) updateData.motif = motif
    if (ordonnanceUrl !== undefined) updateData.ordonnanceUrl = ordonnanceUrl || null
    if (stockMedicamentId !== undefined) updateData.stockMedicamentId = stockMedicamentId || null
    // PROMPT 30 — protocole à plusieurs injections
    if (nbInjections !== undefined) updateData.nbInjections = nbInjections
    if (intervalleInjectionsHeures !== undefined) updateData.intervalleInjectionsHeures = intervalleInjectionsHeures
    // QA caprin cms1v5j14 — délais d'attente surchargeables (ordonnance véto)
    if (tempsAttenteLaitJ !== undefined) updateData.tempsAttenteLaitJ = tempsAttenteLaitJ
    if (tempsAttenteViandeJ !== undefined) updateData.tempsAttenteViandeJ = tempsAttenteViandeJ
    if (tempsAttenteLaitJ !== undefined || tempsAttenteViandeJ !== undefined) {
      updateData.delaiAttenteSource = 'prescription'
    }
    if (
      existing.quantitePreleveeStock > 0 &&
      (
        (stockMedicamentId !== undefined && stockMedicamentId !== existing.stockMedicamentId) ||
        (quantite !== undefined && quantite !== existing.quantite)
      )
    ) {
      return NextResponse.json(
        { error: "Le lot ou la quantité d'un soin déjà prélevé ne peut pas être modifié. Annulez d'abord le soin." },
        { status: 409 },
      )
    }
    const stockEffectifId = stockMedicamentId !== undefined
      ? stockMedicamentId
      : existing.stockMedicamentId
    const stockEffectif = stockEffectifId
      ? await prisma.stockMedicamentElevage.findFirst({
          where: { id: stockEffectifId, userId: session.user.id },
        })
      : null
    if (stockEffectifId && !stockEffectif) {
      return NextResponse.json({ error: "Lot de pharmacie introuvable." }, { status: 404 })
    }
    if (stockEffectif && stockMedicamentId !== undefined) {
      updateData.numeroLotMedicament = stockEffectif.numeroLot
      updateData.peremptionMedicament = stockEffectif.datePeremption
      if (!updateData.ordonnanceUrl && stockEffectif.ordonnanceUrl) {
        updateData.ordonnanceUrl = stockEffectif.ordonnanceUrl
      }
    }

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
    const faitChange = updateData.fait !== undefined && updateData.fait !== existing.fait
    // PROMPT 30 — un changement du nombre d'injections/intervalle décale la
    // dernière injection, donc les fenêtres d'attente.
    const injectionsChangees =
      (updateData.nbInjections !== undefined && updateData.nbInjections !== existing.nbInjections) ||
      (updateData.intervalleInjectionsHeures !== undefined && updateData.intervalleInjectionsHeures !== existing.intervalleInjectionsHeures)
    // QA caprin cms1v5j14 — un changement de délai d'attente recale les fenêtres.
    const taChange =
      (updateData.tempsAttenteLaitJ !== undefined && updateData.tempsAttenteLaitJ !== existing.tempsAttenteLaitJ) ||
      (updateData.tempsAttenteViandeJ !== undefined && updateData.tempsAttenteViandeJ !== existing.tempsAttenteViandeJ)
    const taLaitEffectif = updateData.tempsAttenteLaitJ !== undefined ? updateData.tempsAttenteLaitJ : existing.tempsAttenteLaitJ
    const taViandeEffectif = updateData.tempsAttenteViandeJ !== undefined ? updateData.tempsAttenteViandeJ : existing.tempsAttenteViandeJ
    if (dateChangee || faitChange || injectionsChangees || taChange) {
      const newDate = (updateData.date as Date | undefined) ?? existing.date
      const seraFait = (updateData.fait as boolean | undefined) ?? existing.fait
      const nbInj = (updateData.nbInjections as number | undefined) ?? existing.nbInjections ?? 1
      const intervalleH = (updateData.intervalleInjectionsHeures as number | null | undefined) ?? existing.intervalleInjectionsHeures ?? null
      const derniere = nbInj > 1 && intervalleH
        ? new Date(newDate.getTime() + (nbInj - 1) * intervalleH * 3_600_000)
        : newDate
      updateData.finAttenteLait = seraFait && taLaitEffectif
        ? addDays(derniere, taLaitEffectif)
        : null
      updateData.finAttenteViande = seraFait && taViandeEffectif
        ? addDays(derniere, taViandeEffectif)
        : null
    }

    const soin = await prisma.$transaction(async (tx) => {
      const devientRealise = fait === true && !existing.fait && existing.quantitePreleveeStock <= 0
      const devientPlanifie = fait === false && existing.fait && existing.quantitePreleveeStock > 0
      if (devientRealise && stockEffectif) {
        const quantiteADecompter = quantite ?? existing.quantite ?? 0
        if (quantiteADecompter <= 0) {
          throw new Error(`QUANTITE_MEDICAMENT_REQUISE:${stockEffectif.unite}`)
        }
        if (stockEffectif.datePeremption && stockEffectif.datePeremption.getTime() < new Date(updateData.date ?? existing.date).getTime()) {
          throw new Error(`LOT_MEDICAMENT_PERIME:${stockEffectif.numeroLot}`)
        }
        const decremente = await tx.stockMedicamentElevage.updateMany({
          where: {
            id: stockEffectif.id,
            userId: session.user.id,
            quantite: { gte: quantiteADecompter },
          },
          data: { quantite: { decrement: quantiteADecompter } },
        })
        if (decremente.count !== 1) {
          throw new Error(`STOCK_MEDICAMENT_INSUFFISANT:${stockEffectif.quantite}`)
        }
        updateData.quantitePreleveeStock = quantiteADecompter
      } else if (devientPlanifie && existing.stockMedicamentId) {
        await tx.stockMedicamentElevage.update({
          where: { id: existing.stockMedicamentId },
          data: { quantite: { increment: existing.quantitePreleveeStock } },
        })
        updateData.quantitePreleveeStock = 0
      }
      const updated = await tx.soinAnimal.update({
        where: { id },
        data: updateData,
        include: { animal: true, lot: true, produitVeterinaire: true },
      })
      let finalSoin = updated

      const injectionsExistantes = await tx.$queryRaw<Array<{
        id: string; numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string
      }>>`
        SELECT id, numero, date_prevue AS "datePrevue", date_realisee AS "dateRealisee", statut
        FROM injections_soins WHERE soin_id = ${id} AND user_id = ${session.user.id}
        ORDER BY numero
      `
      if (injectionsChangees || dateChangee || faitChange || taChange || injectionsExistantes.length === 0) {
        const nombre = updateData.nbInjections ?? existing.nbInjections
        const intervalle = updateData.intervalleInjectionsHeures !== undefined
          ? updateData.intervalleInjectionsHeures
          : existing.intervalleInjectionsHeures
        const debut = (updateData.date as Date | undefined) ?? existing.date
        const calendrier = calendrierInjections(debut, nombre, intervalle, false)
        const realisees = new Map(injectionsExistantes.filter((i) => i.statut === 'realisee').map((i) => [i.numero, i]))
        await tx.$executeRaw`
          DELETE FROM injections_soins
          WHERE soin_id = ${id} AND numero > ${nombre} AND statut <> 'realisee'
        `
        for (const injection of calendrier) {
          const realisee = realisees.get(injection.numero)
          const marquerPremiereFaite = injection.numero === 1 && fait === true && !realisee
          const rouvrirPremiere = injection.numero === 1 && fait === false && realisee
          const statut = marquerPremiereFaite ? 'realisee' : rouvrirPremiere ? 'a_faire' : injection.statut
          const dateRealisee = marquerPremiereFaite ? ((updateData.date as Date | undefined) ?? new Date()) : null
          await tx.$executeRaw`
            INSERT INTO injections_soins
              (id, user_id, soin_id, numero, date_prevue, date_realisee, statut, created_at, updated_at)
            VALUES
              (${randomUUID()}, ${session.user.id}, ${id}, ${injection.numero}, ${injection.datePrevue},
               ${dateRealisee}, ${statut}, NOW(), NOW())
            ON CONFLICT (soin_id, numero) DO UPDATE SET
              date_prevue = CASE WHEN injections_soins.statut = 'realisee' THEN injections_soins.date_prevue ELSE EXCLUDED.date_prevue END,
              statut = CASE
                WHEN ${marquerPremiereFaite} THEN 'realisee'
                WHEN ${rouvrirPremiere} THEN 'a_faire'
                ELSE injections_soins.statut
              END,
              date_realisee = CASE
                WHEN ${marquerPremiereFaite} THEN ${dateRealisee}
                WHEN ${rouvrirPremiere} THEN NULL
                ELSE injections_soins.date_realisee
              END,
              updated_at = NOW()
          `
        }
        const injections = await tx.$queryRaw<Array<{
          numero: number; datePrevue: Date; dateRealisee: Date | null; statut: string
        }>>`
          SELECT numero, date_prevue AS "datePrevue", date_realisee AS "dateRealisee", statut
          FROM injections_soins WHERE soin_id = ${id}
        `
        const derniere = derniereInjectionActive(injections)
        const commence = injections.some((i) => i.statut === 'realisee')
        finalSoin = await tx.soinAnimal.update({
          where: { id },
          data: {
            fait: commence,
            finAttenteLait: commence && derniere ? ajouterJours(derniere, taLaitEffectif) : null,
            finAttenteViande: commence && derniere ? ajouterJours(derniere, taViandeEffectif) : null,
          },
          include: { animal: true, lot: true, produitVeterinaire: true },
        })
      }

      // Ré-synchroniser l'écartement des collectes si la date, le statut « fait »
      // OU la cible (animal↔lot) a changé — recompute-from-truth sur l'union des
      // anciennes ET nouvelles cibles (cross-granularité), symétrique par nature.
      const cibleChangee =
        (updateData.animalId !== undefined && updateData.animalId !== existing.animalId) ||
        (updateData.lotId !== undefined && updateData.lotId !== existing.lotId)
      if (dateChangee || faitChange || cibleChangee || injectionsChangees || taChange) {
        const c1 = await ciblesAffectees(tx, session.user.id, existing.animalId, existing.lotId)
        const c2 = await ciblesAffectees(tx, session.user.id, updated.animalId, updated.lotId)
        const cibles = {
          animalIds: [...new Set([...c1.animalIds, ...c2.animalIds])],
          lotIds: [...new Set([...c1.lotIds, ...c2.lotIds])],
        }
        const f = fenetreSoin(existing.date, existing.finAttenteLait, updated.date, updated.finAttenteLait)
        if (f) await resyncEcartementLait(tx, session.user.id, cibles, f.min, f.max)
      }

      await createDepenseFromSoinAnimal(session.user.id, {
        id: finalSoin.id,
        type: finalSoin.type,
        cout: finalSoin.cout,
        date: finalSoin.date,
        fait: finalSoin.fait,
      }, tx)
      return finalSoin
    })
    invalidateKpi(session.user.id)

    return NextResponse.json({ data: soin })
  } catch (error) {
    console.error('PATCH /api/elevage/soins error:', error)
    if (error instanceof Error && error.message.startsWith('STOCK_MEDICAMENT_INSUFFISANT:')) {
      return NextResponse.json(
        { error: `Stock insuffisant : ${error.message.split(':')[1]} disponible(s).`, code: 'STOCK_MEDICAMENT_INSUFFISANT' },
        { status: 422 },
      )
    }
    if (error instanceof Error && error.message.startsWith('QUANTITE_MEDICAMENT_REQUISE:')) {
      return NextResponse.json(
        { error: `Renseignez la quantité prélevée en ${error.message.split(':')[1]}.` },
        { status: 422 },
      )
    }
    if (error instanceof Error && error.message.startsWith('LOT_MEDICAMENT_PERIME:')) {
      return NextResponse.json(
        { error: `Le lot ${error.message.split(':')[1]} est périmé à la date du soin.` },
        { status: 422 },
      )
    }
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

    // Réintégration recompute-from-truth : on supprime d'abord le soin, puis on
    // recalcule l'écartement sur sa fenêtre et ses cibles (cross-granularité).
    // Les collectes couvertes uniquement par ce soin redeviennent
    // commercialisables ; celles couvertes par un autre soin restent écartées.
    await prisma.$transaction(async (tx) => {
      await deleteAutoEntry('soin_animal', existing.id, 'depense', session.user.id, tx)
      if (existing.stockMedicamentId && existing.quantitePreleveeStock > 0) {
        await tx.stockMedicamentElevage.update({
          where: { id: existing.stockMedicamentId },
          data: { quantite: { increment: existing.quantitePreleveeStock } },
        })
      }
      await tx.soinAnimal.delete({ where: { id: parseInt(id) } })
      if (existing.finAttenteLait) {
        const cibles = await ciblesAffectees(tx, session.user.id, existing.animalId, existing.lotId)
        const f = fenetreSoin(existing.date, existing.finAttenteLait)
        if (f) await resyncEcartementLait(tx, session.user.id, cibles, f.min, f.max)
      }
    })
    invalidateKpi(session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/soins error:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
