/**
 * API Routes pour une Culture spécifique
 * GET /api/cultures/[id] - Détail d'une culture
 * PUT /api/cultures/[id] - Modifier une culture
 * DELETE /api/cultures/[id] - Supprimer une culture
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateCultureSchema, normalizeCultureDateFields } from '@/lib/validations'
import { validateCultureDates } from '@/lib/validations/date-validation'
import { requireAuthApi } from '@/lib/auth-utils'
import { irrigationCache } from '@/lib/irrigation-cache'
import { etendrePlanArrosage } from '@/lib/irrigation-scheduler'
import { invalidateKpi } from '@/lib/kpi'
import { etatCulture } from '@/lib/cultures/etat'
import { CHAMP_DATE_ETAPE, dateExecutionARecaler } from '@/lib/cultures/execution'
import type { ChampDateEtape, ChampEtape } from '@/lib/cultures/execution'
import { whereItpUtilisable } from '@/lib/itp-acces'
import { appliquerDecalageItp, decalageItpPourLecteur } from '@/lib/calendrier-climat'
import { zoneEffectiveUser } from '@/lib/terroir'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/cultures/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    const culture = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
      include: {
        espece: {
          include: { famille: true },
        },
        variete: {
          include: { fournisseur: true },
        },
        itp: true,
        planche: {
          include: { rotation: true },
        },
        recoltes: {
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Ajouter les champs calculés
    const cultureWithComputed = {
      ...culture,
      etat: etatCulture(culture),
      totalRecolte: culture.recoltes.reduce((sum, r) => sum + r.quantite, 0),
    }

    return NextResponse.json(cultureWithComputed)
  } catch (error) {
    console.error('GET /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la culture' },
      { status: 500 }
    )
  }
}

// PUT /api/cultures/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)
    const body = await request.json()

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Validation
    const validationResult = updateCultureSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Bug utilisateur 2026-08-02 — un champ date édité arrive en « YYYY-MM-DD »
    // (input type=date) alors que Prisma exige un DateTime ISO complet : le
    // PUT répondait 500 (« premature end of input ») et l'édition était
    // silencieusement perdue (10 tentatives en échec chez un nouvel inscrit).
    const champDateInvalide = normalizeCultureDateFields(validationResult.data)
    if (champDateInvalide) {
      return NextResponse.json(
        { error: `Date invalide pour ${champDateInvalide}` },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const existing = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    const data = validationResult.data

    // Changer l'ITP d'une culture est une écriture : l'itinéraire visé doit être
    // visible par ce membre ET encore en service, comme à la création. Sans ce
    // contrôle, l'édition rattachait une culture à l'itinéraire privé d'un autre
    // compte, que la réponse `include: { itp }` renvoyait ensuite.
    if (data.itpId && data.itpId !== existing.itpId) {
      const cible = await prisma.iTP.findFirst({
        where: { AND: [{ id: data.itpId }, whereItpUtilisable(session!.user.id)] },
        select: { id: true },
      })
      if (!cible) {
        return NextResponse.json(
          {
            error: `L'itinéraire technique « ${data.itpId} » n'est pas disponible : introuvable, privé, ou retiré du service.`,
          },
          { status: 400 }
        )
      }
    }

    // Audit Marc 2026-05-14 — Bug 04 : valider les dates contre l'ITP en
    // modification également (warnings non bloquants remontés au client).
    const dateWarnings: string[] = []
    if (data.dateSemis || data.datePlantation || data.dateRecolte) {
      try {
        const itpId = data.itpId ?? existing.itpId
        const itpBrut = itpId
          ? await prisma.iTP.findFirst({
              where: { AND: [{ id: itpId }, whereItpUtilisable(session!.user.id)] },
              select: {
                userId: true,
                zoneClimat: true,
                semaineSemis: true,
                semainePlantation: true,
                semaineRecolte: true,
              },
            })
          : null
        // Même référentiel que celui affiché : semaines transposées vers la zone
        // de l'exploitation, sinon l'écart de calage franchit la tolérance et
        // fabrique un avertissement sur des dates que l'écran a préremplies.
        const itp = itpBrut
          ? appliquerDecalageItp(
              itpBrut,
              decalageItpPourLecteur(
                itpBrut,
                await zoneEffectiveUser(prisma, session!.user.id),
                session!.user.id
              )
            )
          : null
        const annee = data.annee ?? existing.annee ?? new Date().getFullYear()
        const v = validateCultureDates({
          dateSemis: data.dateSemis ?? existing.dateSemis,
          datePlantation: data.datePlantation ?? existing.datePlantation,
          dateRecolte: data.dateRecolte ?? existing.dateRecolte,
          itp,
          annee,
        })
        // Même refus qu'à la création : les erreurs de chronologie n'étaient
        // pas même journalisées ici, seules les alertes remontaient.
        if (!v.valid) {
          return NextResponse.json(
            { error: v.errors.join(' '), errors: v.errors },
            { status: 400 }
          )
        }
        dateWarnings.push(...v.warnings)
      } catch (e) {
        console.warn('Date validation PUT skipped:', e)
      }
    }

    // Bug testeur 2026-05-31 — Longueur de culture > longueur de planche : la
    // création (POST) bloque déjà via peutAjouterCulture(), mais l'édition ne
    // vérifiait rien. On remonte un warning non bloquant (comme les dates).
    const plancheId = data.plancheId ?? existing.plancheId
    const longueurCulture = data.longueur ?? existing.longueur
    if (plancheId && longueurCulture) {
      try {
        const planche = await prisma.planche.findFirst({
          where: { id: plancheId, userId: session!.user.id },
          select: { nom: true, longueur: true },
        })
        if (planche?.longueur && longueurCulture > planche.longueur) {
          dateWarnings.push(
            `Longueur de la culture (${longueurCulture} m) supérieure à la longueur de la planche ${planche.nom} (${planche.longueur} m).`
          )
        }
      } catch (e) {
        console.warn('Longueur validation PUT skipped:', e)
      }
    }

    // Mise à jour
    const culture = await prisma.culture.update({
      where: { id: cultureId },
      data: validationResult.data,
      include: {
        espece: true,
        variete: true,
        itp: true,
        planche: true,
      },
    })

    invalidateKpi(session!.user.id)

    // Friction 2026-08-14 — un plan d'arrosage existant suit les cultures :
    // cocher « à irriguer » ou (re)dater le cycle depuis le formulaire doit
    // produire les passages sans repasser par l'onglet Calendrier.
    if (culture.aIrriguer) {
      await etendrePlanArrosage(session!.user.id, culture.id)
    }

    return NextResponse.json(
      dateWarnings.length > 0 ? { ...culture, warnings: dateWarnings } : culture
    )
  } catch (error) {
    console.error('PUT /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la culture' },
      { status: 500 }
    )
  }
}

// PATCH /api/cultures/[id] - Mise a jour partielle rapide (pour actions rapides)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)
    const body = await request.json()

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Verifier existence et propriete
    const existing = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
      include: {
        _count: { select: { recoltes: true } },
        itp: { select: { semainePlantation: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvee` },
        { status: 404 }
      )
    }

    // Champs autorises pour PATCH rapide
    const allowedFields = [
      'semisFait',
      'plantationFaite',
      'recolteFaite',
      'terminee',
      'aIrriguer',
      'derniereIrrigation',
      'dateSemis',
      'datePlantation',
      'dateRecolte',
      'notes',
    ]

    const dateFields = ['dateSemis', 'datePlantation', 'dateRecolte', 'derniereIrrigation']
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        // Convertir les chaînes ISO en Date pour les champs DateTime.
        // '' vaut effacement (sinon Prisma reçoit une chaîne vide et jette).
        if (dateFields.includes(field)) {
          if (body[field]) {
            const parsed = new Date(body[field])
            if (Number.isNaN(parsed.getTime())) {
              return NextResponse.json(
                { error: `Date invalide pour ${field}` },
                { status: 400 }
              )
            }
            updateData[field] = parsed
          } else {
            updateData[field] = null
          }
        } else {
          updateData[field] = body[field]
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucun champ valide a mettre a jour' },
        { status: 400 }
      )
    }

    // QA cmsio768u / cmsio8o54 (2026-08-07) — les actions rapides du tableau
    // sont des bascules : recliquer sur une étape déjà faite la dé-marque. La
    // cascade d'état (récolte > plantation > semis) faisait alors régresser une
    // culture qui portait déjà des récoltes — « Planifiée » affiché à côté de
    // 3 récoltes, ou « Plantée » à côté de 4. Le registre de récolte est la
    // source de vérité : on refuse de le contredire plutôt que de recalculer un
    // état faux.
    const ETAPES = ['semisFait', 'plantationFaite', 'recolteFaite'] as const
    const LIBELLE_ETAPE: Record<string, string> = {
      semisFait: 'le semis',
      plantationFaite: 'la plantation',
      recolteFaite: 'la récolte',
    }
    const etapesAnnulees = ETAPES.filter((e) => e in updateData && updateData[e] === false)

    // QA cmsoaedw2 — un ITP en semis direct (pas de semaine de plantation) n'a
    // pas d'étape plantation : la marquer « faite » fabrique un état de suivi
    // incohérent. Le masquage UI du 2026-08-11 est ici verrouillé côté serveur.
    // On ne bloque que la POSE (true) : une valeur héritée reste annulable, et
    // le PUT du formulaire d'édition (geste explicite) n'est pas concerné.
    const datePlantationFinale = 'datePlantation' in updateData
      ? updateData.datePlantation
      : existing.datePlantation
    if (
      updateData.plantationFaite === true &&
      existing.itp != null &&
      existing.itp.semainePlantation == null &&
      datePlantationFinale == null
    ) {
      return NextResponse.json(
        {
          error: `L'itinéraire technique de cette culture est en semis direct :`
            + ` il n'y a pas d'étape de plantation à marquer. Renseignez une date`
            + ` de plantation si cette culture est réellement repiquée.`,
        },
        { status: 409 }
      )
    }

    if (etapesAnnulees.length > 0 && existing._count.recoltes > 0) {
      const n = existing._count.recoltes
      return NextResponse.json(
        {
          error: `Cette culture porte ${n} récolte${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}`
            + ` : ${etapesAnnulees.map((e) => LIBELLE_ETAPE[e]).join(' et ')} ne peut pas être annulé`
            + ` sans contredire le registre de récolte. Supprimez d'abord les récoltes concernées.`,
          recoltes: n,
        },
        { status: 409 }
      )
    }

    // Cohérence du cycle : annuler une étape amont en laissant une étape aval
    // marquée faite produit un état incohérent, sauf si le même appel annule
    // aussi l'aval.
    const resteraFaite = (champ: (typeof ETAPES)[number]) =>
      champ in updateData ? updateData[champ] === true : Boolean(existing[champ])

    for (const annulee of etapesAnnulees) {
      const aval = ETAPES.slice(ETAPES.indexOf(annulee) + 1).filter(resteraFaite)
      if (aval.length > 0) {
        return NextResponse.json(
          {
            error: `Annulez d'abord ${aval.map((e) => LIBELLE_ETAPE[e]).join(' et ')}`
              + ` : le cycle ne peut pas revenir avant ${LIBELLE_ETAPE[annulee]}`
              + ` tant qu'une étape postérieure reste marquée faite.`,
          },
          { status: 409 }
        )
      }
    }

    // QA cmsp66tdm — une étape marquée faite ne peut pas rester datée dans le
    // futur : cliquer une tâche planifiée au 15/08 le 11/08 enregistrait « Semis
    // fait le 15/08 » au registre. On recale la date d'exécution sur le jour
    // courant, sauf si l'appel fournit lui-même la date (geste explicite).
    for (const [champEtape, champDate] of Object.entries(CHAMP_DATE_ETAPE) as Array<
      [ChampEtape, ChampDateEtape]
    >) {
      if (updateData[champEtape] !== true || champDate in updateData) continue
      const recalage = dateExecutionARecaler(existing[champDate])
      if (recalage) updateData[champDate] = recalage
    }

    const culture = await prisma.culture.update({
      where: { id: cultureId },
      data: updateData,
    })

    // Invalider le cache irrigation si la date d'arrosage a changé
    if ('derniereIrrigation' in updateData) {
      irrigationCache.invalidateUser(session!.user.id)
    }

    invalidateKpi(session!.user.id)

    // Friction 2026-08-14 — un plan d'arrosage existant suit les cultures :
    // le toggle « à irriguer » des actions rapides doit produire les passages
    // sans repasser par l'onglet Calendrier.
    const champsPlanArrosage = ['aIrriguer', 'dateSemis', 'datePlantation', 'dateRecolte']
    if (culture.aIrriguer && champsPlanArrosage.some((champ) => champ in updateData)) {
      await etendrePlanArrosage(session!.user.id, culture.id)
    }

    return NextResponse.json(culture)
  } catch (error) {
    console.error('PATCH /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de la culture' },
      { status: 500 }
    )
  }
}

// DELETE /api/cultures/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const culture = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Audit compta 2026-06 : les récoltes partent en cascade DB, mais leurs
    // écritures auto-compta et leur part d'inventaire ne suivent pas — il
    // restait des VenteManuelle orphelines comptées à vie dans le KPI.
    const recoltes = await prisma.recolte.findMany({
      where: { cultureId, userId: session!.user.id },
      select: { id: true, especeId: true, quantite: true, statut: true },
    })

    await prisma.$transaction(async (tx) => {
      if (recoltes.length > 0) {
        await tx.venteManuelle.deleteMany({
          where: {
            sourceType: 'recolte',
            sourceId: { in: recoltes.map((r) => r.id) },
            auto: true,
          },
        })
        // Refonte stock 2026-07 : plus de décrément du compteur inventaire —
        // les récoltes supprimées en cascade ne seront plus comptées par
        // calculerStocksNet (qui ne somme que les récoltes 'en_stock').
      }

      // Suppression (les recoltes seront supprimées en cascade)
      await tx.culture.delete({
        where: { id: cultureId },
      })
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json({ success: true, deleted: cultureId })
  } catch (error) {
    console.error('DELETE /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la culture' },
      { status: 500 }
    )
  }
}
