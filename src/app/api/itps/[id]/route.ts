/**
 * API Routes pour un ITP spécifique (referentiel global)
 * GET /api/itps/[id] - Détail d'un ITP
 * PUT /api/itps/[id] - Modifier un ITP
 * DELETE /api/itps/[id] - Supprimer un ITP
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateITPSchema } from '@/lib/validations'
import { messageIncoherenceSemainesItp, messageRefusTriggerDatesItp } from '@/lib/validations/itp'
import { requireAuthApi } from '@/lib/auth-utils'
import {
  masquerEntree,
  peutEditerReferentiel,
  visibiliteReferentiel,
  whereReferentielCible,
} from '@/lib/referentiel-communaute'
import {
  conflitNomItp,
  doublonVisibleItp,
  estConflitPeriodeItp,
  estViolationUnicite,
  itpMemePeriode,
  messageConflitNomItp,
  messageConflitPeriodeItp,
  nomItpDepuisSaisie,
} from '@/lib/itp-nom'
import { messageRefusSuppressionItp } from '@/lib/itp-suppression'

type RouteParams = { params: Promise<{ id: string }> }

/** Clé de l'index de période telle qu'elle sera écrite (saisie, sinon existant). */
interface PeriodeEffective {
  proprietaireId: string | null
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  typePlanche: string | null
}

/** Valeur transmise (y compris `null`, qui vide le champ), sinon valeur en base. */
function effectif<T>(saisi: T | null | undefined, existant: T | null | undefined): T | null {
  return saisi !== undefined ? saisi : existant ?? null
}

// GET /api/itps/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params

    // Audit Marc 2026-05-14 — Bug 13 : compteur cultures par tenant
    // (cf. /api/itps GET pour le détail du bug).
    // Visibilité : Gleba officiel + communauté + mes perso (jamais le perso privé d'autrui).
    let itp = await prisma.iTP.findFirst({
      where: { AND: [{ id }, visibiliteReferentiel(userId)] },
      include: {
        espece: { include: { famille: true } },
        _count: {
          select: {
            cultures: { where: { userId } },
            rotationsDetails: true,
          },
        },
      },
    })

    // BUG #9 (audit Marc 2026-05-15) : si l'URL utilise le NOM d'espèce
    // (ex. /maraichage/itps/Tomate) plutôt qu'un ID exact d'ITP, on
    // tente un fallback : premier ITP référencé pour cette espèce
    // (le plus long en durée de culture = le plus représentatif).
    // Évite un toast d'erreur frustrant quand le user devine l'URL.
    if (!itp) {
      itp = await prisma.iTP.findFirst({
        // Le repli ne doit pas ramener un itinéraire retiré du service : il
        // serait proposé comme s'il faisait référence.
        where: { AND: [{ especeId: id }, { actif: true }, visibiliteReferentiel(userId)] },
        include: {
          espece: { include: { famille: true } },
          _count: {
            select: {
              cultures: { where: { userId } },
              rotationsDetails: true,
            },
          },
        },
        // NULL en dernier (PostgreSQL les range en tête d'un tri décroissant),
        // puis l'identifiant pour un résultat stable.
        orderBy: [{ dureeCulture: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      })
    }

    if (!itp) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé. Essayez la liste /maraichage/itps pour un identifiant exact.` },
        { status: 404 }
      )
    }

    // Aucun id d'un autre compte ne sort (ITP communautaire, espèce parente).
    return NextResponse.json({
      ...masquerEntree(itp, userId),
      espece: itp.espece ? masquerEntree(itp.espece, userId) : itp.espece,
    })
  } catch (error) {
    console.error('GET /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'ITP' },
      { status: 500 }
    )
  }
}

// PUT /api/itps/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'
  const { id } = await params
  // Gardée hors du `try` : le `catch` en a besoin pour nommer un conflit de
  // période, et le corps d'une requête ne se lit qu'une fois.
  let periode: PeriodeEffective | null = null

  try {
    const body = await request.json()

    // Validation
    const validationResult = updateITPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence : l'ITP privé d'un autre compte répond comme un ITP
    // inexistant (404), jamais 403 ni le 409 des références sourcées.
    const existing = await prisma.iTP.findFirst({
      where: whereReferentielCible(id, session!.user.id, isAdmin),
    })

    if (!existing) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    if (existing.sourceRecordId) {
      return NextResponse.json(
        {
          error:
            'Cette référence sourcée est protégée. Toute correction doit passer par le jeu de données et une migration auditable.',
        },
        { status: 409 }
      )
    }

    // Seul l'auteur d'un ITP perso (ou un admin) peut le modifier.
    if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres ITP.' },
        { status: 403 }
      )
    }

    const data = validationResult.data

    // Sécurité (parité avec le POST) : si on CHANGE l'espèce parente, elle doit
    // être VISIBLE par l'appelant — sinon rattachement/divulgation (la réponse
    // include:{espece} renverrait) de l'espèce privée d'autrui.
    if (data.especeId) {
      const espece = await prisma.espece.findFirst({
        where: { AND: [{ id: data.especeId }, visibiliteReferentiel(session!.user.id)] },
        select: { id: true },
      })
      if (!espece) {
        return NextResponse.json(
          { error: `L'espèce "${data.especeId}" n'existe pas` },
          { status: 400 }
        )
      }
    }

    // Cohérence semis_direct (Audit Marc Bug F : pas de plantation pour les
    // semis directs) sur l'espèce EFFECTIVE (nouvelle ou existante). Lecture
    // interne du seul typeCultureSemis — aucune donnée d'espèce n'est renvoyée ici.
    const especeIdEffectif = data.especeId ?? existing.especeId
    periode = {
      proprietaireId: existing.userId,
      especeId: effectif(data.especeId, existing.especeId),
      semaineSemis: effectif(data.semaineSemis, existing.semaineSemis),
      semainePlantation: effectif(data.semainePlantation, existing.semainePlantation),
      semaineRecolte: effectif(data.semaineRecolte, existing.semaineRecolte),
      typePlanche: effectif(data.typePlanche, existing.typePlanche),
    }
    // Le type de l'espèce n'est lu que s'il peut changer la réponse : une
    // plantation saisie (semis direct) ou posée la semaine du semis (pépinière).
    const plantationSurSemis =
      periode.semaineSemis != null && periode.semainePlantation === periode.semaineSemis
    let typeCultureSemis: string | null = null
    if (especeIdEffectif && (data.semainePlantation != null || plantationSurSemis)) {
      // Espèce visible seulement : l'espèce d'origine de l'ITP a pu redevenir
      // privée chez son auteur depuis le rattachement.
      const espece = await prisma.espece.findFirst({
        where: { AND: [{ id: especeIdEffectif }, visibiliteReferentiel(session!.user.id)] },
        select: { id: true, nom: true, typeCultureSemis: true },
      })
      typeCultureSemis = espece?.typeCultureSemis ?? null
      if (typeCultureSemis === 'semis_direct' && data.semainePlantation != null) {
        return NextResponse.json(
          {
            // Le libellé, pas l'identifiant : une espèce personnelle a un cuid.
            error: `L'espèce "${espece?.nom ?? especeIdEffectif}" est en semis direct. Le champ Plantation doit être vide.`,
          },
          { status: 400 }
        )
      }
    }

    // Règles du trigger `enforce_itp_dates`, annoncées avant l'écriture sur les
    // semaines telles qu'elles seront en base. Le trigger rejoue à CHAQUE
    // écriture : un ITP déjà incohérent est refusé quel que soit le champ
    // modifié, autant le dire.
    if (periode.especeId) {
      const incoherence = messageIncoherenceSemainesItp({
        typeCultureSemis,
        semaineSemis: periode.semaineSemis,
        // Le trigger vide la plantation d'un semis direct avant de contrôler.
        semainePlantation: typeCultureSemis === 'semis_direct' ? null : periode.semainePlantation,
        semaineRecolte: periode.semaineRecolte,
      })
      if (incoherence) {
        return NextResponse.json({ error: incoherence }, { status: 400 })
      }
    }

    // Renommage. Le libellé est conservé tel que saisi, la clé de dédup est
    // recalculée dans le même mouvement, et l'unicité est revérifiée dans le
    // périmètre qui s'applique (QA cmswxyuoi). Sans cela, `nomNormalise`
    // aurait divergé du nom affiché dès le premier renommage : recherche
    // normalisée en échec et doublons acceptés.
    let renommage: { nom: string; nomNormalise: string } | null = null
    let cleModifiee = false
    if (data.nom !== undefined) {
      const propose = nomItpDepuisSaisie(data.nom)
      if (!propose.nom) {
        return NextResponse.json(
          { error: "Le nom de l'ITP ne peut pas être vide." },
          { status: 400 }
        )
      }
      cleModifiee = propose.nomNormalise !== (existing.nomNormalise ?? '')
      if (cleModifiee) {
        const conflit = await conflitNomItp(prisma, {
          nom: propose.nom,
          nomNormalise: propose.nomNormalise,
          proprietaireId: existing.userId,
          exclureId: id,
        })
        if (conflit) {
          return NextResponse.json(
            { error: messageConflitNomItp(conflit, existing.userId === null), conflit: conflit.id },
            { status: 409 }
          )
        }
      }
      renommage = propose
    }

    // Mise à jour (l'auteur d'un perso peut basculer « proposer à la communauté »).
    const itp = await prisma.iTP.update({
      where: { id },
      data: {
        ...data,
        ...(renommage ?? {}),
        ...(existing.userId && body.partageCommunaute !== undefined
          ? { partageCommunaute: body.partageCommunaute === true }
          : {}),
      },
      include: {
        espece: true,
      },
    })

    // Renommage vers un nom déjà porté ailleurs dans le catalogue visible :
    // signalé, jamais bloqué (le périmètre d'unicité, lui, est déjà garanti).
    // Uniquement si le nom a réellement changé : rappeler un homonyme
    // préexistant à chaque enregistrement de la fiche serait du bruit.
    const doublon = renommage && cleModifiee
      ? await doublonVisibleItp(prisma, {
          nomNormalise: renommage.nomNormalise,
          lecteurId: session!.user.id,
          exclureId: id,
        })
      : null

    return NextResponse.json({
      ...masquerEntree(itp, session!.user.id),
      espece: itp.espece ? masquerEntree(itp.espece, session!.user.id) : itp.espece,
      ...(doublon
        ? { doublonPotentiel: { id: doublon.id, nom: doublon.nom ?? doublon.id } }
        : {}),
    })
  } catch (error) {
    // Même traduction qu'à la création : conflit de période → 409 nommé.
    // Les semaines absentes de la requête gardent leur valeur en base : la
    // recherche du jumeau porte sur la ligne telle qu'elle aurait été écrite.
    if (periode && estViolationUnicite(error)) {
      const conflit = await itpMemePeriode(prisma, { ...periode, exclureId: id }).catch(() => null)
      if (conflit || estConflitPeriodeItp(error)) {
        return NextResponse.json(
          { error: messageConflitPeriodeItp(conflit), conflit: conflit?.id },
          { status: 409 }
        )
      }
    }
    // Refus du trigger de dates qui aurait échappé au contrôle applicatif.
    const refusDates = messageRefusTriggerDatesItp(error)
    if (refusDates) {
      return NextResponse.json({ error: refusDates }, { status: 400 })
    }
    console.error('PUT /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'ITP' },
      { status: 500 }
    )
  }
}

// DELETE /api/itps/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params

    // Dépendances : le total TOUS COMPTES protège l'intégrité (un ITP partagé
    // peut porter les cultures d'autres membres), mais la liste n'affiche que le
    // compteur du compte courant. Un refus « car il est utilisé » sur un
    // écran qui affiche « 0 culture » est incompréhensible : on distingue donc
    // les deux dans le message.
    const itp = await prisma.iTP.findFirst({
      where: whereReferentielCible(id, session!.user.id, isAdmin),
      include: {
        _count: {
          select: {
            cultures: true,
            rotationsDetails: true,
          },
        },
      },
    })
    if (!itp) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    if (itp.sourceRecordId) {
      return NextResponse.json(
        { error: 'Une référence sourcée ne peut pas être supprimée depuis l’interface.' },
        { status: 409 }
      )
    }

    // Seul l'auteur d'un ITP perso (ou un admin) peut le supprimer.
    if (!peutEditerReferentiel(itp, session!.user.id, isAdmin)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres ITP.' },
        { status: 403 }
      )
    }

    // Vérifier si des cultures ou rotations sont liées. La route porte la
    // règle et son message ; la liste et la fiche des ITP l'affichent tel quel
    // (2026-10-20 : elles refusaient seules, d'après leur propre compteur). Le
    // refus nomme les années des cultures du compte et les rotations.
    if (itp._count.cultures > 0 || itp._count.rotationsDetails > 0) {
      const [culturesParAnnee, etapes] = await Promise.all([
        prisma.culture.groupBy({
          by: ['annee'],
          where: { itpId: itp.id, userId: session!.user.id },
          _count: { _all: true },
        }),
        prisma.rotationDetail.findMany({
          where: { itpId: itp.id },
          select: { rotationId: true },
          distinct: ['rotationId'],
          orderBy: { rotationId: 'asc' },
        }),
      ])
      const culturesDuCompte = culturesParAnnee.reduce((n, l) => n + l._count._all, 0)
      const culturesAilleurs = Math.max(0, itp._count.cultures - culturesDuCompte)
      const message = messageRefusSuppressionItp({
        culturesDuCompte,
        anneesCulturesDuCompte: culturesParAnnee
          .map((l) => l.annee)
          .filter((a): a is number => typeof a === 'number'),
        culturesDuCompteSansAnnee: culturesParAnnee
          .filter((l) => typeof l.annee !== 'number')
          .reduce((n, l) => n + l._count._all, 0),
        culturesAutresMembres: culturesAilleurs,
        etapesRotation: itp._count.rotationsDetails,
        rotations: etapes.map((e) => e.rotationId),
      })
      return NextResponse.json(
        {
          error: message,
          details: {
            cultures: itp._count.cultures,
            culturesDuCompte,
            culturesAutresMembres: culturesAilleurs,
            rotations: itp._count.rotationsDetails,
          },
        },
        { status: 409 }
      )
    }

    // Suppression
    await prisma.iTP.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'ITP' },
      { status: 500 }
    )
  }
}
