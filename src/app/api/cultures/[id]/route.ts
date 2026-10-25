/**
 * API Routes pour une Culture spécifique
 * GET /api/cultures/[id] - Détail d'une culture
 * PUT /api/cultures/[id] - Modifier une culture
 * DELETE /api/cultures/[id] - Supprimer une culture sans récolte vendue
 *   (sinon 409, cf. `src/lib/cultures/suppression.ts`)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateCultureSchema, normalizeCultureDateFields, retenirDatesCulture } from '@/lib/validations'
import { jourCivilStocke } from '@/lib/jour-civil'
import { fenetreRecolteIncoherente, finRecolteApresModification } from '@/lib/cultures/fenetre-recolte'
import type { AlerteSaisonCulture } from '@/lib/cultures/saison-culture'
import { validateCultureDates } from '@/lib/validations/date-validation'
import { requireAuthApi } from '@/lib/auth-utils'
import { irrigationCache } from '@/lib/irrigation-cache'
import { invalidateKpi } from '@/lib/kpi'
import { etatCulture } from '@/lib/cultures/etat'
import { type UniteQuantite } from '@/lib/recolte/projection'
import { ajouterQuantite, arrondirQuantites, partKg, type QuantiteParUnite } from '@/lib/recolte/quantites'
import { chargerSurchargesRendement, rendementEffectif } from '@/lib/recolte/rendement-effectif'
import {
  CHAMP_DATE_ETAPE,
  ETAPES,
  ecrituresDatePlanRedefinie,
  ecrituresPassageAFait,
  ecrituresRetourANonFait,
} from '@/lib/cultures/execution'
import type { ChampDateEtape, ChampEtape } from '@/lib/cultures/execution'
import { whereItpUtilisable } from '@/lib/itp-acces'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'
import { appliquerDecalageItp, decalageItpPourLecteur } from '@/lib/calendrier-climat'
import { zoneEffectiveUser } from '@/lib/terroir'
import { aDesVentes, compterVentesRecoltesCulture, messageSuppressionCultureRefusee } from '@/lib/cultures/suppression'
import { quantiteCultureApresModification } from '@/lib/cultures/quantite-plants'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * ITP d'une culture tel que son propriétaire le voit : visible et en service,
 * semaines transposées vers la zone de son exploitation (le référentiel des
 * dates que les écrans préremplissent), avec sa fenêtre d'implantation et sa
 * durée de récolte.
 */
async function lireItpCalibre(itpId: string, userId: string) {
  const itpBrut = await prisma.iTP.findFirst({
    where: { AND: [{ id: itpId }, whereItpUtilisable(userId)] },
    select: {
      userId: true,
      zoneClimat: true,
      semaineSemis: true,
      semainePlantation: true,
      semaineRecolte: true,
      semaineImplantationDebut: true,
      semaineImplantationFin: true,
      implantation: true,
      semaineRecolteFin: true,
      dureeRecolte: true,
    },
  })
  if (!itpBrut) return null
  return appliquerDecalageItp(
    itpBrut,
    decalageItpPourLecteur(itpBrut, await zoneEffectiveUser(prisma, userId), userId)
  )
}

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
          // Aucun écran ne lit le fournisseur de la variété ; la ligne
          // complète emportait ses coordonnées et son bloc bancaire.
          include: { fournisseur: { select: { id: true } } },
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

    // Rendement effectif (celui de la ferme prime) et ventilation du réalisé
    // par unité : `totalRecolte` garde son sens de PART EN KILOS.
    const surcharges = await chargerSurchargesRendement(session!.user.id, [culture.especeId])
    const effectif = rendementEffectif(culture.espece, surcharges.get(culture.especeId))
    const recolteParUnite: QuantiteParUnite = {}
    for (const r of culture.recoltes) {
      ajouterQuantite(recolteParUnite, (r.unite ?? 'kg') as UniteQuantite, r.quantite)
    }

    // Ajouter les champs calculés
    const cultureWithComputed = {
      ...culture,
      espece: culture.espece
        ? {
            ...culture.espece,
            rendement: effectif.rendement,
            uniteRendement: effectif.uniteRendement,
            rendementCatalogue: culture.espece.rendement,
            uniteRendementCatalogue: culture.espece.uniteRendement,
            origineRendement: effectif.origine,
          }
        : culture.espece,
      etat: etatCulture(culture),
      totalRecolte: partKg(arrondirQuantites(recolteParUnite)),
      totalRecolteParUnite: arrondirQuantites(recolteParUnite),
    }

    // Espèce, variété et ITP embarqués : jamais l'id de l'auteur d'une entrée
    // partagée par un autre compte (revue 2026-10-20).
    return NextResponse.json(masquerReferentielsEmbarques(cultureWithComputed, session!.user.id))
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
    // Ticket QA cmvnulry1 (2026-10-25) — une date de culture est un JOUR : même
    // jour civil que la date stockée → instant stocké gardé ; autre jour →
    // minuit UTC de ce jour (règle `dateSoinRetenue` de l'élevage).
    retenirDatesCulture(data, existing)

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

    // Signalement 2026-09-25 — changer l'espèce d'une culture gardait la
    // variété et l'ITP de l'ancienne : un « Navet » restait en variété
    // « Roquette », avec l'itinéraire de la roquette. La règle de la création
    // (variété et ITP de CETTE espèce) vaut aussi en modification, dès que
    // l'espèce ou la référence change ; une édition qui ne touche à aucune des
    // trois ne bloque pas une fiche ancienne.
    const especeFinale = data.especeId ?? existing.especeId
    const varieteFinale = data.varieteId !== undefined ? data.varieteId : existing.varieteId
    const itpFinal = data.itpId !== undefined ? data.itpId : existing.itpId
    const especeChangee = especeFinale !== existing.especeId
    if (varieteFinale && (especeChangee || varieteFinale !== existing.varieteId)) {
      const variete = await prisma.variete.findFirst({
        where: {
          AND: [
            { id: varieteFinale, especeId: especeFinale },
            visibiliteReferentiel(session!.user.id),
          ],
        },
        select: { id: true },
      })
      if (!variete) {
        return NextResponse.json(
          {
            error: `La variété « ${varieteFinale} » n'est pas disponible pour l'espèce « ${especeFinale} » : introuvable, privée, ou rattachée à une autre espèce. Choisissez une variété de cette espèce.`,
          },
          { status: 400 }
        )
      }
    }
    if (itpFinal && (especeChangee || itpFinal !== existing.itpId)) {
      const itpCible = await prisma.iTP.findUnique({
        where: { id: itpFinal },
        select: { especeId: true },
      })
      if (itpCible?.especeId && itpCible.especeId !== especeFinale) {
        return NextResponse.json(
          {
            error: `L'itinéraire technique « ${itpFinal} » est prévu pour l'espèce « ${itpCible.especeId} », pas pour « ${especeFinale} ». Choisissez un itinéraire de cette espèce.`,
          },
          { status: 400 }
        )
      }
    }

    // Audit Marc 2026-05-14 — Bug 04 : valider les dates contre l'ITP en
    // modification également (warnings non bloquants remontés au client).
    const dateWarnings: string[] = []
    let alerteSaison: AlerteSaisonCulture | null = null
    const datesTouchees = Boolean(data.dateSemis || data.datePlantation || data.dateRecolte)
    const itpChange = data.itpId !== undefined && (data.itpId ?? null) !== (existing.itpId ?? null)
    // ITP final de la culture, lu une fois : validation des dates, alerte de
    // saison et durée de récolte de la fenêtre (2026-10-25).
    let itp: Awaited<ReturnType<typeof lireItpCalibre>> = null
    // Fenêtre de récolte à refaire depuis l'ITP : itinéraire changé, ou fenêtre
    // stockée incohérente (réparée au prochain enregistrement).
    const fenetreARefaire =
      Boolean(data.dateRecolte ?? existing.dateRecolte) && (itpChange || fenetreRecolteIncoherente(existing))
    let itpLu = false
    if (itpFinal && (datesTouchees || fenetreARefaire)) {
      try {
        itp = await lireItpCalibre(itpFinal, session!.user.id)
        itpLu = true
      } catch (e) {
        console.warn('ITP non lu pour la modification de culture :', e)
      }
    }
    if (datesTouchees) {
      try {
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
        alerteSaison = v.alerteSaison
      } catch (e) {
        console.warn('Date validation PUT skipped:', e)
      }
    }

    // La fenêtre de récolte suit son début (2026-10-25) : changer l'ITP ou la
    // date de récolte sans toucher la fin laissait une fenêtre d'un autre
    // itinéraire (ail récolté S29 2026, fin au 9 août 2027). Une fin modifiée
    // par l'utilisateur fait foi.
    const finSuivante = finRecolteApresModification({
      avant: existing,
      dateRecolte:
        data.dateRecolte !== undefined ? ((data.dateRecolte as Date | null) ?? null) : existing.dateRecolte,
      finSoumise: data.finRecolte as Date | null | undefined,
      itpChange,
      // Sans ITP : null (une fin héritée d'un autre itinéraire ne survit pas) ;
      // ITP non lu : inconnu, rien n'est effacé.
      itp: !itpFinal ? null : itpLu ? itp : undefined,
    })
    if (finSuivante !== undefined) data.finRecolte = finSuivante

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

    // Le formulaire complet est un chemin de complétion comme les autres : il
    // porte les trois cases « fait » ET les trois dates. Deux conséquences,
    // traitées par le même SSOT que le PATCH rapide (execution.ts).
    // 1. Cocher « semis fait » ici ne recalait rien : le registre pouvait
    //    afficher un fait daté dans le futur, ce que QA cmsp66tdm avait fermé
    //    côté PATCH seulement.
    // 2. Décocher rendait la date de plan — mais le formulaire renvoie AUSSI la
    //    date affichée, c'est-à-dire la date d'exécution. La restitution ne
    //    s'applique donc que si l'utilisateur n'a pas lui-même changé la date :
    //    une date modifiée est un nouveau plan et fait foi.
    const dateSoumise: Record<ChampEtape, Date | null | undefined> = {
      semisFait: 'dateSemis' in data ? ((data.dateSemis as Date | null) ?? null) : undefined,
      plantationFaite:
        'datePlantation' in data ? ((data.datePlantation as Date | null) ?? null) : undefined,
      recolteFaite: 'dateRecolte' in data ? ((data.dateRecolte as Date | null) ?? null) : undefined,
    }
    const faitSoumis: Record<ChampEtape, boolean | undefined> = {
      semisFait: data.semisFait,
      plantationFaite: data.plantationFaite,
      recolteFaite: data.recolteFaite,
    }
    const ecrituresEtapes: Record<string, Date | null> = {}
    for (const champEtape of ETAPES) {
      const champDate = CHAMP_DATE_ETAPE[champEtape]
      const soumise = dateSoumise[champEtape]
      // Date modifiée = autre JOUR civil (cmvnulry1) : un même jour renvoyé
      // sous une autre forme (« AAAA-MM-JJ » d'un instant horodaté, minuit
      // Paris d'une culture ancienne) n'est pas une nouvelle date de plan.
      if (
        soumise !== undefined &&
        jourCivilStocke(soumise) !== jourCivilStocke(existing[champDate])
      ) {
        Object.assign(ecrituresEtapes, ecrituresDatePlanRedefinie(champEtape))
        continue
      }
      if (faitSoumis[champEtape] === true && !existing[champEtape]) {
        Object.assign(ecrituresEtapes, ecrituresPassageAFait(existing, champEtape))
      } else if (faitSoumis[champEtape] === false && existing[champEtape]) {
        Object.assign(ecrituresEtapes, ecrituresRetourANonFait(existing, champEtape))
      }
    }

    // Ticket QA cmvnpkkhp (2026-10-25) — « Quantité / plants (auto) » suit les
    // rangs, la longueur et l'espacement, par la règle de la création. Le
    // formulaire d'édition renvoyait vide la quantité d'une culture née sans
    // elle ; une quantité saisie à la main reste intacte.
    const quantiteAuto = quantiteCultureApresModification(existing, data)
    const ecritureQuantite = quantiteAuto === undefined ? {} : { quantite: quantiteAuto }

    // Mise à jour
    const culture = await prisma.culture.update({
      where: { id: cultureId },
      data: { ...validationResult.data, ...ecritureQuantite, ...ecrituresEtapes },
      include: {
        espece: true,
        variete: true,
        itp: true,
        planche: true,
      },
    })

    invalidateKpi(session!.user.id)

    const reponse = masquerReferentielsEmbarques(culture, session!.user.id)
    return NextResponse.json({
      ...reponse,
      ...(dateWarnings.length > 0 ? { warnings: dateWarnings } : {}),
      ...(alerteSaison ? { alerteSaison } : {}),
    })
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
        { error: `Culture #${id} non trouvée` },
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
      // Fin de la fenêtre de récolte (2026-08-26) : modifiable comme les autres
      // dates, pour corriger une durée que le référentiel donne trop courte ou
      // trop longue sur une parcelle donnée.
      'finRecolte',
      'notes',
    ]

    const dateFields = [
      'dateSemis',
      'datePlantation',
      'dateRecolte',
      'finRecolte',
      'derniereIrrigation',
    ]
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
    //
    // Friction 2026-08-20 — et le retour en arrière rend sa date au plan. Le
    // bouton « Annuler le semis fait » de /maraichage/cultures passe ici : sans
    // restitution, cocher puis décocher laissait la date d'exécution en place et
    // le plan était perdu.
    // La fenêtre de récolte suit une date de récolte déplacée par l'appel
    // (règle de la modification et du report, `finRecolteApresModification`).
    // Avant le recalage d'exécution : marquer une récolte faite ne déplace pas
    // la fenêtre.
    if (updateData.dateRecolte !== undefined) {
      const fin = finRecolteApresModification({
        avant: existing,
        dateRecolte: updateData.dateRecolte as Date | null,
        finSoumise: 'finRecolte' in updateData ? (updateData.finRecolte as Date | null) : undefined,
      })
      if (fin !== undefined) updateData.finRecolte = fin
    }

    for (const [champEtape, champDate] of Object.entries(CHAMP_DATE_ETAPE) as Array<
      [ChampEtape, ChampDateEtape]
    >) {
      if (!(champEtape in updateData)) continue
      if (champDate in updateData) {
        // Date fournie dans le même appel : c'est elle qui fait foi, la mémoire
        // du plan n'a plus d'objet.
        Object.assign(updateData, ecrituresDatePlanRedefinie(champEtape))
        continue
      }
      if (updateData[champEtape] === true) {
        Object.assign(updateData, ecrituresPassageAFait(existing, champEtape))
      } else if (updateData[champEtape] === false) {
        Object.assign(updateData, ecrituresRetourANonFait(existing, champEtape))
      }
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


    return NextResponse.json(culture)
  } catch (error) {
    console.error('PATCH /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la culture' },
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

    // Audit 2026-10-08 — une récolte vendue retient la culture : la cascade
    // effaçait ses ventes de la comptabilité, exercice déjà déclaré compris.
    const ventes = await compterVentesRecoltesCulture(prisma, cultureId, session!.user.id)
    if (aDesVentes(ventes)) {
      return NextResponse.json(
        { error: messageSuppressionCultureRefusee(culture, ventes), details: ventes },
        { status: 409 }
      )
    }

    // Audit compta 2026-06 : les récoltes partent en cascade DB. Depuis la
    // garde ci-dessus, aucune ne porte plus de vente ; la purge des écritures
    // auto reste en filet contre une ligne orpheline.
    const recoltes = await prisma.recolte.findMany({
      where: { cultureId, userId: session!.user.id },
      select: { id: true, especeId: true, quantite: true, statut: true },
    })

    await prisma.$transaction(async (tx) => {
      if (recoltes.length > 0) {
        await tx.venteManuelle.deleteMany({
          where: {
            userId: session!.user.id,
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
