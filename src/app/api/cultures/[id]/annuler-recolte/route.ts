/**
 * POST /api/cultures/[id]/annuler-recolte — décocher « récolte faite » en
 * retirant les lots encore en stock, d'un seul bloc.
 *
 * Revue du 2026-11-04 : la page Tâches supprimait elle-même, une par une, les
 * récoltes en stock de la culture, PUIS demandait `recolteFaite: false`. Si une
 * récolte vendue, consommée ou perdue subsistait, ce PATCH répondait 409 et
 * l'écran affichait « Annulation refusée » alors que les lots en stock étaient
 * déjà effacés (45 kg de tomates perdus pour un refus). Un lot lié à un bon de
 * livraison ou à la boutique faisait de même échouer une suppression au milieu.
 *
 * Ici, tout se décide avant d'écrire : la moindre récolte qui n'est plus en
 * stock, ou un lot suivi par un document commercial, refuse l'annulation
 * entière et rien n'est supprimé. Sinon les lots partent avec leur écriture
 * automatique et l'étape repasse à faire, dans la même transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import { SELECT_ETAPES, ecrituresRetourANonFait } from '@/lib/cultures/execution'
import { erreurFinRecolte } from '@/lib/cultures/fenetre-recolte'
import { verrouillerRecolteLibre } from '@/lib/commercial/verrou-lot'
import { ErreurCommerciale } from '@/lib/commercial/regles'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
import { deleteAutoEntry } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { messageRecoltesRetenues } from '@/lib/cultures/annulation-recolte'

type RouteParams = { params: Promise<{ id: string }> }

class Refus extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const refus = refusSiLectureSeule(session)
  if (refus) return refus

  const cultureId = Number((await params).id)
  if (!Number.isInteger(cultureId) || cultureId <= 0) {
    return NextResponse.json({ error: 'ID de culture invalide' }, { status: 400 })
  }
  const userId = session!.user.id

  try {
    const supprimees = await prisma.$transaction(async (tx) => {
      const culture = await tx.culture.findFirst({
        where: { id: cultureId, userId },
        select: { id: true, recolteFaite: true, finRecolte: true, ...SELECT_ETAPES },
      })
      if (!culture) throw new Refus(`Culture #${cultureId} non trouvée`, 404)

      const recoltes = await tx.recolte.findMany({
        where: { cultureId, userId },
        select: { id: true, statut: true },
      })
      const retenues = recoltes.filter((r) => r.statut != null && r.statut !== 'en_stock')
      if (retenues.length > 0) throw new Refus(messageRecoltesRetenues(retenues.map((r) => r.statut!)), 409)

      // Lots suivis par un bon, une facture ou la boutique : le verrou refuse
      // (ErreurCommerciale), et la transaction entière est annulée.
      // Revue Codex MAR-01 (2026-11-12) : le statut lu plus haut précède le
      // verrou commun. Une vente directe qui le tenait a pu passer un lot en
      // « vendu » (ou une sortie en consommé, perdu) et créer sa recette ; on
      // effaçait ensuite la récolte vendue et sa recette. Le statut décisif est
      // celui du lot relu sous verrou, et tous les lots sont contrôlés avant la
      // première suppression.
      const relues: Awaited<ReturnType<typeof verrouillerRecolteLibre>>[] = []
      for (const r of recoltes) relues.push(await verrouillerRecolteLibre(tx, userId, r.id))
      const devenuesRetenues = relues.filter((r) => r.statut != null && r.statut !== 'en_stock')
      if (devenuesRetenues.length > 0) throw new Refus(messageRecoltesRetenues(devenuesRetenues.map((r) => r.statut!)), 409)
      for (const r of relues) {
        await deleteAutoEntry('recolte', r.id, 'vente', userId, tx)
        await tx.recolte.delete({ where: { id: r.id } })
      }

      const ecritures = ecrituresRetourANonFait(culture, 'recolteFaite')
      const dateRecolte = 'dateRecolte' in ecritures ? ecritures.dateRecolte ?? null : culture.dateRecolte
      const erreurFin = erreurFinRecolte({ dateRecolte, finRecolte: culture.finRecolte })
      if (erreurFin) throw new Refus(erreurFin, 400)

      await tx.culture.update({
        where: { id: cultureId },
        data: { recolteFaite: false, ...ecritures },
      })
      return recoltes.length
    })

    invalidateKpi(userId)
    return NextResponse.json({ success: true, recoltesSupprimees: supprimees })
  } catch (err) {
    if (err instanceof Refus) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof ErreurCommerciale) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('POST /api/cultures/[id]/annuler-recolte error:', err)
    return NextResponse.json({ error: "L'annulation de la récolte n'a pas été enregistrée." }, { status: 500 })
  }
}
