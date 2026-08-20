/**
 * API Routes pour les Cultures
 * GET /api/cultures - Liste des cultures (avec filtres, pagination, tri)
 * POST /api/cultures - Créer une culture
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createCultureSchema, normalizeCultureDateFields, validateCultureDates } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import { peutAjouterCulture, suggererAjustements } from '@/lib/planche-validation'
import { ensurePlaceholderVariete } from '@/lib/varietes'
import { invalidateKpi } from '@/lib/kpi'
import { checkRotationViolation } from '@/lib/rotation-check'
import { estEtatCulture, etatCulture, whereEtatCulture } from '@/lib/cultures/etat'
import { etendrePlanArrosage } from '@/lib/irrigation-scheduler'
import { whereItpUtilisable } from '@/lib/itp-acces'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { appliquerDecalageItp, decalageItpPourLecteur } from '@/lib/calendrier-climat'
import { zoneEffectiveUser } from '@/lib/terroir'

// GET /api/cultures
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const skip = (page - 1) * pageSize

    // Tri
    const sortBy = searchParams.get('sortBy') || 'id'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filtres
    const search = searchParams.get('search') || ''
    const annee = searchParams.get('annee')
    const especeId = searchParams.get('especeId')
    const varieteId = searchParams.get('varieteId') || searchParams.get('variete')
    const plancheId = searchParams.get('plancheId')
    const etat = searchParams.get('etat') // Planifiée, Semée, Plantée, En recolte, Terminée

    // Construction du where - FILTRE PAR USER
    const where: Prisma.CultureWhereInput = {
      userId: session!.user.id,
    }

    if (search) {
      where.OR = [
        { espece: { id: { contains: search, mode: 'insensitive' } } },
        { variete: { id: { contains: search, mode: 'insensitive' } } },
        { planche: { nom: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (annee) {
      where.annee = parseInt(annee)
    }

    if (especeId) {
      where.especeId = especeId
    }

    if (varieteId) {
      where.varieteId = varieteId
    }

    if (plancheId) {
      where.plancheId = plancheId
    }

    // Filtre par état (calculé). QA cmsp59tdu — le filtre est le miroir exact
    // de la cascade d'affichage (whereEtatCulture/etatCulture), sinon l'onglet
    // « Planifiées » liste des cultures marquées « En récolte ». Passé en AND
    // pour ne pas entrer en conflit avec le OR de recherche ci-dessus.
    if (estEtatCulture(etat)) {
      where.AND = [whereEtatCulture(etat)]
    }

    // Requête avec comptage
    const [cultures, total] = await Promise.all([
      prisma.culture.findMany({
        where,
        include: {
          espece: {
            include: { famille: true },
          },
          variete: true,
          itp: true,
          planche: true,
          recoltes: {
            select: { quantite: true },
          },
          _count: {
            select: { recoltes: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.culture.count({ where }),
    ])

    // Ajouter les champs calculés
    const culturesWithComputed = cultures.map((culture) => ({
      ...culture,
      // Calcul de l'état
      etat: etatCulture(culture),
      // Total récolté (kg)
      totalRecolte: culture.recoltes.reduce((sum, r) => sum + r.quantite, 0),
      // Calcul du type
      type: culture.espece?.vivace
        ? 'Vivace'
        : culture.dateSemis && culture.datePlantation && culture.dateRecolte
          ? 'Semis pépinière'
          : culture.dateSemis && culture.dateRecolte
            ? 'Semis en place'
            : culture.datePlantation && culture.dateRecolte
              ? 'Plant'
              : 'Non défini',
    }))

    return NextResponse.json({
      data: culturesWithComputed,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cultures' },
      { status: 500 }
    )
  }
}

// POST /api/cultures
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validationResult = createCultureSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('❌ Zod validation failed:', validationResult.error.flatten())
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Parité avec le PUT (fix efa206f) : un input type=date envoie
    // « YYYY-MM-DD », Prisma exige un DateTime — normaliser avant insertion.
    const champDateInvalide = normalizeCultureDateFields(data)
    if (champDateInvalide) {
      return NextResponse.json(
        { error: `Date invalide pour ${champDateInvalide}` },
        { status: 400 }
      )
    }

    // Vérifier que l'espèce existe ET qu'elle est visible par cet utilisateur.
    //
    // L'ITP était résolu sous la règle « visible et actif » ; l'espèce l'était
    // par un `findUnique` nu, donc une culture pouvait être rattachée à l'espèce
    // PRIVÉE d'un autre membre — et la réponse en renvoyait la fiche.
    const espece = await prisma.espece.findFirst({
      where: { AND: [{ id: data.especeId }, visibiliteReferentiel(session!.user.id)] },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `L'espèce « ${data.especeId} » n'est pas disponible : introuvable ou privée.` },
        { status: 400 }
      )
    }

    // La variété doit être visible ET appartenir à CETTE espèce.
    //
    // Elle n'était vérifiée nulle part : un POST avec
    // { especeId: 'Carotte', varieteId: 'Tomate Marmande' } créait une culture
    // « Carotte / Tomate Marmande », affichée telle quelle dans la liste et sur
    // la planche, et l'écran Semences lisait ensuite le stock de graines de la
    // tomate pour une carotte.
    if (data.varieteId) {
      const variete = await prisma.variete.findFirst({
        where: {
          AND: [
            { id: data.varieteId, especeId: data.especeId },
            visibiliteReferentiel(session!.user.id),
          ],
        },
        select: { id: true },
      })
      if (!variete) {
        return NextResponse.json(
          {
            error: `La variété « ${data.varieteId} » n'est pas disponible pour l'espèce « ${data.especeId} » : introuvable, privée, ou rattachée à une autre espèce.`,
          },
          { status: 400 }
        )
      }
    }

    // PROMPT 12 — Détection de violation de rotation.
    // Le client envoie `confirmRotation: true` pour ignorer le warning et créer
    // quand même (la culture est alors flaggée rotation_violee=true).
    const confirmRotation = body.confirmRotation === true
    const rotationCheck = await checkRotationViolation(
      data.plancheId ?? null,
      data.especeId,
      data.annee ?? new Date().getFullYear(),
      session!.user.id
    )
    if (rotationCheck && !confirmRotation) {
      return NextResponse.json(
        {
          warning: rotationCheck.message,
          rotationViolation: rotationCheck,
        },
        { status: 409 }
      )
    }

    // Récupérer l'ITP si fourni (pour validation dates et calcul stock).
    //
    // La lecture était un `findUnique` nu : n'importe quel identifiant faisait
    // l'affaire, y compris l'itinéraire PRIVÉ d'un autre membre (que la réponse
    // aurait ensuite exposé via `include: { itp }`) ou un itinéraire retiré du
    // service. La règle appliquée partout ailleurs dans le référentiel —
    // visible ET actif — vaut aussi pour ce chemin d'écriture.
    let itp = null
    if (data.itpId) {
      itp = await prisma.iTP.findFirst({
        where: { AND: [{ id: data.itpId }, whereItpUtilisable(session!.user.id)] },
        select: {
          userId: true,
          zoneClimat: true,
          semaineSemis: true,
          semainePlantation: true,
          semaineRecolte: true,
          espacementRangs: true,
          nbGrainesPlant: true,
          doseSemis: true,
        },
      })
      if (!itp) {
        return NextResponse.json(
          {
            error: `L'itinéraire technique « ${data.itpId} » n'est pas disponible : introuvable, privé, ou retiré du service.`,
          },
          { status: 400 }
        )
      }
    }

    // Les dates proposées par les formulaires sont calculées sur les semaines
    // TRANSPOSÉES vers la zone de l'exploitation (`/api/itps?calibre=1`). Les
    // comparer aux semaines brutes de la source produisait un écart mécanique
    // pouvant franchir la tolérance de ±28 jours, donc un avertissement
    // « hors fenêtre ITP » sur des dates que l'application venait elle-même de
    // préremplir. On valide dans le même référentiel que celui affiché.
    const itpCalibre = itp
      ? appliquerDecalageItp(
          itp,
          decalageItpPourLecteur(
            itp,
            await zoneEffectiveUser(prisma, session!.user.id),
            session!.user.id
          )
        )
      : null

    // Audit Marc 2026-05-14 — Bug 04 : remonter les warnings dates/ITP
    // au client (non bloquant). Le client peut alors afficher un toast
    // explicite "Semis le 01/06 hors fenêtre ITP recommandée (mars–avril)".
    const dateWarnings: string[] = []
    if (data.dateSemis || data.datePlantation || data.dateRecolte) {
      try {
        const annee = data.annee || new Date().getFullYear()
        const dateValidation = validateCultureDates({
          dateSemis: data.dateSemis,
          datePlantation: data.datePlantation,
          dateRecolte: data.dateRecolte,
          itp: itpCalibre,
          annee,
        })

        // Les erreurs étaient seulement journalisées : une récolte antérieure à
        // la plantation, ou un semis postérieur, passaient sans le moindre
        // signal (friction constatée le 2026-07-30). On refuse désormais.
        if (!dateValidation.valid) {
          return NextResponse.json(
            {
              error: dateValidation.errors.join(' '),
              errors: dateValidation.errors,
            },
            { status: 400 }
          )
        }
        dateWarnings.push(...dateValidation.warnings)
      } catch (validationError) {
        console.error('Erreur validation dates:', validationError)
      }
    }

    // Valider l'occupation de la planche si plancheId fourni
    if (data.plancheId) {
      const planche = await prisma.planche.findFirst({
        where: {
          id: data.plancheId,
          userId: session!.user.id,
        },
        include: {
          cultures: {
            where: { terminee: null },
            select: {
              id: true,
              espece: { select: { id: true } },
              dateSemis: true,
              datePlantation: true,
              dateRecolte: true,
              nbRangs: true,
              itp: {
                select: { espacementRangs: true },
              },
            },
          },
        },
      })

      // BUG #12 (audit Marc 2026-05-15) : détection chevauchement de
      // dates sur la même planche. Avant : Tomate (01/03–10/07) et
      // Concombre (25/05–25/07) pouvaient cohabiter sur A1 sans aucune
      // alerte. Désormais on remonte un warning non-bloquant qui
      // s'affiche en toast comme les warnings ITP.
      // Période demandée : sert au warning de chevauchement ci-dessous ET au
      // calcul d'occupation de la planche (QA cmsp5927v).
      const newStart =
        data.dateSemis ? new Date(data.dateSemis) :
        data.datePlantation ? new Date(data.datePlantation) : null
      const newEnd = data.dateRecolte ? new Date(data.dateRecolte) : null

      if (planche && data.plancheId) {
        if (newStart && newEnd) {
          for (const c of planche.cultures) {
            const cStart = c.dateSemis ?? c.datePlantation
            const cEnd = c.dateRecolte
            if (!cStart || !cEnd) continue
            const overlap = newStart < new Date(cEnd) && new Date(cStart) < newEnd
            if (overlap) {
              const fmt = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
              dateWarnings.push(
                `Chevauchement détecté sur la planche : ${c.espece?.id || 'culture'} #${c.id} (${fmt(cStart)}–${fmt(cEnd)}) recouvre la période demandée.`
              )
            }
          }
        }
      }

      if (planche) {
        // Récupérer l'ITP pour avoir l'espacementRangs.
        // QA cmsqla9c2 — il n'y a plus de défaut inventé : la majorité des ITP
        // du référentiel INRAE ne renseigne pas l'espacement entre rangs, et le
        // 30 cm de repli refusait en 400 des créations parfaitement légitimes
        // (4 rangs de radis sur une planche de 80 cm). Sans donnée, on prévient
        // au lieu de refuser.
        // L'ITP a déjà été lu plus haut sous la règle « visible et actif » : le
        // relire sans cette règle rouvrait la porte qu'on vient de fermer, et
        // faisait une requête de plus pour la même donnée.
        const espacementRangs: number | null = itp?.espacementRangs ?? null

        // Cultures existantes avec leur espacement.
        // QA cmsp5927v — l'occupation était calculée sur TOUTES les cultures non
        // clôturées de la planche, sans regarder les dates : une culture d'une
        // saison passée jamais marquée terminée saturait la planche à vie et la
        // création était refusée (planche B2 de la démo). On ne compte donc que
        // les cultures dont le cycle chevauche réellement la période demandée ;
        // faute de dates exploitables, on reste prudent en la comptant.
        const chevaucheLaPeriode = (c: (typeof planche.cultures)[number]) => {
          if (!newStart || !newEnd) return true
          const cStart = c.dateSemis ?? c.datePlantation
          const cEnd = c.dateRecolte
          if (!cStart || !cEnd) return true
          return newStart < new Date(cEnd) && new Date(cStart) < newEnd
        }
        const culturesExistantes = planche.cultures.filter(chevaucheLaPeriode).map(c => ({
          nbRangs: c.nbRangs || 1,
          espacementRangs: c.itp?.espacementRangs ?? null,
        }))

        if (espacementRangs === null) {
          dateWarnings.push(
            "Espacement entre rangs inconnu pour cet itinéraire technique : l'occupation de la planche n'a pas été vérifiée."
          )
        } else {
          // Nouvelle culture
          const nouvelleCulture = {
            nbRangs: data.nbRangs || 1,
            espacementRangs,
            longueur: data.longueur || undefined,
          }

          const validation = peutAjouterCulture(
            { largeur: planche.largeur || 0.8, longueur: planche.longueur || 2 },
            culturesExistantes,
            nouvelleCulture
          )

          if (!validation.possible) {
            const suggestions = suggererAjustements(
              { largeur: planche.largeur || 0.8, longueur: planche.longueur || 2 },
              culturesExistantes,
              nouvelleCulture
            )

            return NextResponse.json(
              {
                // On nomme l'origine du chiffre : la suggestion « réduire
                // l'espacement » parlait d'une valeur portée par l'itinéraire
                // technique, que l'utilisateur confondait avec le champ
                // « Espacement » du formulaire (espacement SUR le rang).
                error: `${validation.message}. Espacement entre rangs de l'itinéraire technique : ${espacementRangs} cm.`,
                suggestions: suggestions.map(s => s.message),
                details: {
                  largeurPlanche: planche.largeur,
                  largeurOccupee: validation.largeurOccupee,
                  largeurDisponible: validation.largeurDisponible,
                  largeurNecessaire: validation.largeurNecessaire,
                  espacementRangsItp: espacementRangs,
                },
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // Auto-remplir aIrriguer si non fourni et espece a besoin eau élevé
    let aIrriguer = data.aIrriguer
    if (aIrriguer === undefined || aIrriguer === null) {
      // Besoin eau >= 3 ou irrigation explicitement "Eleve"/"Élevé"
      if (
        (espece.besoinEau && espece.besoinEau >= 3) ||
        espece.irrigation?.toLowerCase() === 'eleve' ||
        espece.irrigation?.toLowerCase() === 'élevé'
      ) {
        aIrriguer = true
      }
    }

    // Vérifier que les foreign keys existent avant création
    // `itp` a déjà été résolu plus haut sous la règle « visible et actif » :
    // une seconde lecture sans cette règle réintroduirait la faille corrigée.

    if (data.plancheId) {
      const plancheExists = await prisma.planche.findUnique({
        where: { id: data.plancheId, userId: session!.user.id }
      })
      if (!plancheExists) {
        // Debug: vérifier si planche existe pour un autre user
        const plancheAnyUser = await prisma.planche.findUnique({
          where: { id: data.plancheId }
        })
        console.error(`❌ Planche not found for user: ${data.plancheId}`)
        console.error(`   Exists for another user?: ${!!plancheAnyUser}`)
        console.error(`   Current userId: ${session!.user.id}`)
        return NextResponse.json(
          { error: `Planche "${data.plancheId}" introuvable pour votre compte` },
          { status: 400 }
        )
      }
    }

    // Création + décrément stock dans une transaction atomique
    const culture = await prisma.$transaction(async (tx) => {
      // Si pas de variété fournie : assigner le placeholder "Non spécifiée"
      // de l'espèce (créé à la demande). Aucune Culture ne reste sans variete.
      const varieteId = data.varieteId ?? (await ensurePlaceholderVariete(data.especeId, tx))

      // Création avec userId. rotationViolee=true si l'utilisateur a confirmé
      // malgré le warning (PROMPT 12).
      const newCulture = await tx.culture.create({
        data: {
          ...data,
          varieteId,
          userId: session!.user.id,
          aIrriguer,
          rotationViolee: rotationCheck !== null,
        },
        include: {
          espece: true,
          variete: true,
          itp: true,
          planche: true,
        },
      })

      // Décrément automatique du stock de semences (per-user).
      // Sans ITP sur la culture, pas de dose de semis fiable : pas de décrément.
      const itpEff = newCulture.itp
      if (data.varieteId && data.dateSemis && itpEff) {
        const variete = await tx.variete.findUnique({
          where: { id: data.varieteId },
          select: { nbGrainesG: true },
        })

        const userStock = await tx.userStockVariete.findFirst({
          where: { userId: session!.user.id, varieteId: data.varieteId },
        })

        if (variete && userStock && userStock.stockGraines && userStock.stockGraines > 0 && variete.nbGrainesG) {
          const planche = newCulture.planche
          const longueur = data.longueur || 0
          const nbRangs = data.nbRangs || 1
          const espacement = data.espacement || 0

          let grammesNecessaires = 0

          if (espacement > 0 && variete.nbGrainesG > 0) {
            const nbGrainesPlant = itpEff.nbGrainesPlant || 1
            grammesNecessaires = Math.ceil(
              (longueur * nbRangs / espacement * 100 * nbGrainesPlant) /
              variete.nbGrainesG
            )
          } else if (itpEff.doseSemis && planche?.largeur) {
            grammesNecessaires = Math.ceil(
              longueur * planche.largeur * itpEff.doseSemis
            )
          }

          if (grammesNecessaires > 0) {
            await tx.userStockVariete.upsert({
              where: { userId_varieteId: { userId: session!.user.id, varieteId: data.varieteId } },
              create: {
                userId: session!.user.id,
                varieteId: data.varieteId,
                stockGraines: 0,
                dateStock: new Date(),
              },
              update: {
                stockGraines: Math.max(0, userStock.stockGraines - grammesNecessaires),
                dateStock: new Date(),
              },
            })
          }
        }
      }

      return newCulture
    })

    invalidateKpi(session!.user.id)

    // Friction 2026-08-14 — un plan d'arrosage existant suit les cultures :
    // une culture « à irriguer » créée après la génération du plan restait
    // sans passage jusqu'à un clic explicite dans l'onglet Calendrier.
    if (culture.aIrriguer) {
      await etendrePlanArrosage(session!.user.id, culture.id)
    }

    // Audit Marc 2026-05-14 — Bug 04 : warnings remontés non bloquants
    return NextResponse.json(
      dateWarnings.length > 0 ? { ...culture, warnings: dateWarnings } : culture,
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la culture' },
      { status: 500 }
    )
  }
}
