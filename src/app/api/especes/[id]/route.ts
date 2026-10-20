/**
 * API Routes pour une Espèce spécifique (referentiel global)
 * GET /api/especes/[id] - Détail d'une espece
 * PUT /api/especes/[id] - Modifier une espece
 * DELETE /api/especes/[id] - Supprimer une espece
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateEspeceSchema } from '@/lib/validations'
import { nomEtCleReferentiel } from '@/lib/normalize'
import { requireAuthApi } from '@/lib/auth-utils'
import {
  masquerEntree,
  peutEditerReferentiel,
  visibiliteReferentiel,
  whereReferentielCible,
} from '@/lib/referentiel-communaute'
import { rendementEffectif } from '@/lib/recolte/rendement-effectif'
import { type UniteQuantite } from '@/lib/recolte/projection'
import { arrondirQuantites, ajouterQuantite, type QuantiteParUnite } from '@/lib/recolte/quantites'
import { calculerStocksNet } from '@/lib/stocks-helpers'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/especes/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  let resolvedId: string | null = null
  try {
    const { id } = await params
    // Feedback Marc 2026-05-16 — Bug 04 : "Impossible de charger la fiche".
    // Le client envoie l'id encodé (encodeURIComponent) ; selon le runtime
    // (Edge vs Node, proxy Caddy en avant), `params.id` peut arriver
    // déjà décodé OU encore percent-encodé. On décode défensivement.
    resolvedId = id
    try {
      const decoded = decodeURIComponent(id)
      if (decoded !== id) resolvedId = decoded
    } catch {
      // id n'est pas percent-encodé — on garde la valeur brute.
    }

    // Visibilité : Gleba officiel + communauté + mes perso (jamais le perso privé
    // d'autrui) — sur l'espèce ET ses variétés/ITP inclus.
    const espece = await prisma.espece.findFirst({
      where: { AND: [{ id: resolvedId }, visibiliteReferentiel(userId)] },
      include: {
        famille: true,
        varietes: {
          where: visibiliteReferentiel(userId),
          include: {
            fournisseur: true,
          },
        },
        itps: { where: visibiliteReferentiel(userId) },
        // Compteurs du compte : le total brut agrégeait les cultures et les
        // récoltes de tous les comptes (« Cultures » de la fiche verger).
        _count: {
          select: {
            cultures: { where: { userId } },
            recoltes: { where: { userId } },
          },
        },
      },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `Espèce "${resolvedId}" non trouvée` },
        { status: 404 }
      )
    }

    // Rendement et objectif propres à CETTE ferme. Ils priment sur le catalogue
    // et sont, pour une espèce officielle, le seul endroit où un membre peut les
    // fixer — la fiche du catalogue lui est refusée en écriture (403 du PUT).
    // La fiche affiche les deux : la référence, et « chez moi ».
    const annee = new Date().getFullYear()
    const [ligneCompte, recoltesAnnee, stocksNet] = await Promise.all([
      prisma.userStockEspece.findUnique({
        where: { userId_especeId: { userId, especeId: espece.id } },
        select: {
          rendement: true,
          uniteRendement: true,
          objectifAnnuel: true,
          prixKg: true,
          inventaire: true,
          dateInventaire: true,
        },
      }),
      // Réalisé de l'année pour CE compte et CETTE espèce, ventilé par unité.
      // Sans lui, un objectif annuel était un champ qu'on saisissait sans jamais
      // savoir où l'on en est — une note, pas un objectif.
      prisma.recolte.groupBy({
        by: ['unite'],
        where: {
          userId,
          especeId: espece.id,
          date: { gte: new Date(annee, 0, 1), lte: new Date(annee, 11, 31, 23, 59, 59, 999) },
        },
        _sum: { quantite: true },
      }),
      // Stock de récolte du compte pour cette espèce, par la même fonction que
      // Stocks > Récoltes (baseline datée + récoltes en stock − sorties). La
      // fiche écrivait `Espece.inventaire`, colonne partagée que rien ne lit
      // (revue QA du 2026-10-20) : elle sert désormais le stock DU COMPTE.
      calculerStocksNet(userId, espece.id),
    ])
    const { inventaire, dateInventaire, ...monRendement } = ligneCompte ?? {
      rendement: null,
      uniteRendement: null,
      objectifAnnuel: null,
      prixKg: null,
      inventaire: null,
      dateInventaire: null,
    }
    // `null` tant que le compte n'a ni comptage, ni récolte, ni sortie pour
    // cette espèce : la carte « Chez moi » le dit plutôt que d'afficher 0.
    const stockNet = stocksNet[espece.id]
    const monStock = stockNet ? { ...stockNet, inventaire, dateInventaire } : null

    const realiseParUnite = arrondirQuantites(
      recoltesAnnee.reduce<QuantiteParUnite>(
        (acc, ligne) =>
          ajouterQuantite(acc, (ligne.unite ?? 'kg') as UniteQuantite, ligne._sum.quantite ?? 0),
        {},
      ),
    )

    // Aucun id d'un autre compte ne sort (espèce, variétés, itinéraires).
    return NextResponse.json({
      ...masquerEntree(espece, userId),
      varietes: espece.varietes.map((v) => masquerEntree(v, userId)),
      itps: espece.itps.map((i) => masquerEntree(i, userId)),
      monRendement: ligneCompte ? monRendement : null,
      rendementEffectif: rendementEffectif(espece, monRendement),
      monStock,
      realiseAnnee: { annee, parUnite: realiseParUnite },
    })
  } catch (err) {
    console.error(`GET /api/especes/${resolvedId ?? '?'} error:`, err)
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération de l\'espèce',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

// PUT /api/especes/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params
    const body = await request.json()

    // Validation
    const validationResult = updateEspeceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence : l'espèce privée d'un autre compte répond comme une
    // espèce inexistante (404), jamais 403.
    const existing = await prisma.espece.findFirst({
      where: whereReferentielCible(id, session!.user.id, isAdmin),
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Espèce "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'une espèce perso (ou un admin) peut la modifier.
    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres espèces.' },
        { status: 403 }
      )
    }

    // Renommage. Borné aux entrées PERSO : sur une espèce du catalogue officiel
    // l'identifiant EST le nom lisible, renommer sans toucher l'id ferait
    // diverger les deux. La clé de dédup suit le nom, et l'unicité est
    // revérifiée — mêmes règles que pour un ITP.
    const { nom: nomDemande, ...donnees } = validationResult.data
    let renommage: { nom: string; nomNormalise: string } | null = null
    if (nomDemande !== undefined) {
      if (!existing.userId) {
        return NextResponse.json(
          {
            error:
              "Une espèce du catalogue Gleba ne peut pas être renommée : son identifiant est son nom. Créez une espèce personnelle pour utiliser une autre appellation.",
          },
          { status: 409 }
        )
      }
      const propose = nomEtCleReferentiel(nomDemande)
      if (!propose.nom) {
        return NextResponse.json(
          { error: "Le nom de l'espèce ne peut pas être vide." },
          { status: 400 }
        )
      }
      if (propose.nomNormalise !== (existing.nomNormalise ?? '')) {
        const conflit = await prisma.espece.findFirst({
          where: {
            userId: existing.userId,
            nomNormalise: propose.nomNormalise,
            NOT: { id },
          },
          select: { id: true, nom: true },
        })
        if (conflit) {
          return NextResponse.json(
            {
              error: `Vous avez déjà une espèce « ${conflit.nom ?? conflit.id} » dans votre catalogue.`,
              conflit: conflit.id,
            },
            { status: 409 }
          )
        }
      }
      renommage = propose
    }

    // Mise à jour (l'auteur d'un perso peut basculer « proposer à la communauté »).
    const espece = await prisma.espece.update({
      where: { id },
      data: {
        ...donnees,
        ...(renommage ?? {}),
        ...(existing.userId && body.partageCommunaute !== undefined
          ? { partageCommunaute: body.partageCommunaute === true }
          : {}),
      },
      include: {
        famille: true,
      },
    })

    return NextResponse.json(masquerEntree(espece, session!.user.id))
  } catch (error) {
    console.error('PUT /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'espece' },
      { status: 500 }
    )
  }
}

// DELETE /api/especes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params

    // Vérifier existence et dépendances (espèce privée d'un autre compte = 404)
    const espece = await prisma.espece.findFirst({
      where: whereReferentielCible(id, session!.user.id, isAdmin),
      include: {
        _count: {
          select: {
            cultures: true,
            recoltes: true,
            // Les itinéraires passent à NULL (onDelete: SetNull) et les variétés
            // sont DÉTRUITES (onDelete: Cascade) : ni l'un ni l'autre n'était
            // compté. Supprimer l'espèce fourre-tout « Mesclun » — sans culture
            // ni récolte, donc acceptée en 200 — rendait ses 115 itinéraires
            // INRAE inutilisables : toujours actifs, toujours listés, mais avec
            // « - » en espèce et plus jamais proposés à la création d'une culture.
            itps: true,
            varietes: true,
          },
        },
      },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `Espèce "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'une espèce perso (ou un admin) peut la supprimer.
    if (!peutEditerReferentiel(espece, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres espèces.' },
        { status: 403 }
      )
    }

    // Vérifier ce que la suppression emporterait, et le nommer.
    const attaches = [
      espece._count.cultures > 0 ? `${espece._count.cultures} culture(s)` : null,
      espece._count.recoltes > 0 ? `${espece._count.recoltes} récolte(s)` : null,
      espece._count.itps > 0
        ? `${espece._count.itps} itinéraire(s) technique(s), qui perdraient leur espèce`
        : null,
      espece._count.varietes > 0
        ? `${espece._count.varietes} variété(s), qui seraient supprimées avec elle`
        : null,
    ].filter(Boolean)
    if (attaches.length > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer l'espèce « ${id} » : elle porte ${attaches.join(', ')}.`,
          details: {
            cultures: espece._count.cultures,
            recoltes: espece._count.recoltes,
            itps: espece._count.itps,
            varietes: espece._count.varietes,
          },
        },
        { status: 409 }
      )
    }

    // Suppression (plus aucune variété ni itinéraire attaché à ce stade)
    await prisma.espece.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'espece' },
      { status: 500 }
    )
  }
}
