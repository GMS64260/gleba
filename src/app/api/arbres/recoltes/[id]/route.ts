import { prixFruitApi, dateRecolteApi } from "@/lib/verger/creation-recolte"
import { avertissementsDarFruit } from "@/lib/verger/dar"
import { modifierVenteVerger } from "@/lib/verger/vente"
import { ErreurVerger } from "@/lib/verger/erreur"
import { etatSortiesLotVerger, NATURE_TRANSFORMATION, reliquatApresCorrection } from "@/lib/verger/sortie-stock"
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
/**
 * API Récolte Arbre individuelle (avec gestion stock/vente)
 * GET - Détail d'une recolte
 * PUT - Mise à jour complète
 * PATCH - Transition de statut (vente, perte, etc.)
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { deleteAutoEntry } from "@/lib/auto-compta"
import { annulerFactureLiee } from "@/lib/facture-utils"
import { estNumeroLotAuto } from "@/lib/recolte/lot"
import { prochainNumeroLotVerger } from '@/lib/verger/numero-lot'
import { alerteSaisonRecolteArbre, chargerPeriodesRecolteVarietes, retirerMarqueSaison } from "@/lib/verger/saison-recolte-arbre"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/recoltes/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const recolte = await prisma.recolteArbre.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
    })

    if (!recolte) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    return NextResponse.json(recolte)
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error("GET /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la récolte" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/recoltes/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const userId = session!.user.id
    return await prisma.$transaction(async (tx) => {
      await verrouillerStockCommercial(tx, session!.user.id)
      const existing = await tx.recolteArbre.findUnique({
        where: { id: recolteId, userId },
        include: { arbre: { select: { espece: true } } },
      })

      if (!existing) {
        return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
      }
      // Revue du 2026-10-29 : seul un BL ou une facture fige le lot ; une
      // perte ou un usage interne laisse corriger la récolte (voir plus bas).
      const sorties = await etatSortiesLotVerger(tx, userId, 'fruit', existing)
      if (sorties.fige) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Préparez un BL pour livrer son reliquat ou utilisez Retour en stock sur le document.' }, { status: 409 })

      if (existing.statut === 'vendu' || existing.factureId) return NextResponse.json({ error: 'Ce lot est vendu. Corrigez la vente ou sa facture, ou annulez sa vente avant de modifier la récolte.' }, { status: 409 })
      const body = await request.json()

      // Production 2026-09-04 : un maraîcher a saisi deux fois la même récolte à
      // une minute d'écart, seule la date différait — l'écran n'offrait aucune
      // modification, seulement la suppression. La route acceptait déjà PUT,
      // mais sans contrôle : on valide ici ce que le formulaire peut désormais
      // corriger (arbre, date, quantité, qualité, prix, péremption, parcelle
      // d'origine, catégorie, destination, conditionnement, notes, n° de lot).
      if (body.quantite !== undefined) {
        if (typeof body.quantite !== "number" || !isFinite(body.quantite) || body.quantite <= 0) {
          return NextResponse.json(
            { error: "La quantité doit être un nombre supérieur à 0" },
            { status: 400 }
          )
        }
      }

      // QA cmv2ebsdk — l'arbre se corrige comme le reste : la route l'ignorait,
      // le formulaire l'envoyait. L'arbre doit appartenir au compte ; l'espèce
      // suit, et avec elle le numéro de lot automatique.
      let nouvelArbre: { id: number; espece: string | null } | undefined
      if (body.arbreId !== undefined && body.arbreId !== null && body.arbreId !== "") {
        const arbreId = typeof body.arbreId === "number" ? body.arbreId : Number(body.arbreId)
        if (!Number.isInteger(arbreId) || arbreId <= 0) {
          return NextResponse.json({ error: "Arbre invalide" }, { status: 400 })
        }
        if (arbreId !== existing.arbreId) {
          const arbre = await tx.arbre.findFirst({
            where: { id: arbreId, userId },
            select: { id: true, espece: true },
          })
          if (!arbre) {
            return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
          }
          nouvelArbre = arbre
        }
      }
      const especeLot = nouvelArbre ? nouvelArbre.espece : existing.arbre?.espece ?? null

      let nouvelleDate: Date | undefined
      if (body.date !== undefined && body.date !== null && body.date !== "") {
        nouvelleDate = dateRecolteApi(body.date, 'date') ?? undefined
        if (!nouvelleDate) {
          return NextResponse.json({ error: "Date de récolte invalide" }, { status: 400 })
        }
      }

      // Parcelle d'origine : `null` explicite la retire, `undefined` la laisse.
      let nouvelleParcelleId: string | null | undefined
      let nouvelleParcelleNom: string | null = null
      if (body.parcelleId !== undefined) {
        if (body.parcelleId === null || body.parcelleId === "") {
          nouvelleParcelleId = null
        } else {
          const parcelle = await tx.parcelleGeo.findFirst({
            where: { id: String(body.parcelleId), userId },
            select: { id: true, nom: true },
          })
          if (!parcelle) {
            return NextResponse.json({ error: "Parcelle non trouvée" }, { status: 404 })
          }
          nouvelleParcelleId = parcelle.id
          nouvelleParcelleNom = parcelle.nom
        }
      }

      // Numéro de lot : un numéro saisi explicitement gagne toujours. Sinon, si
      // la date, la parcelle ou l'espèce change et que le lot courant est
      // automatique, on le régénère (le lot encode date, parcelle et espèce) ; un
      // lot saisi à la main par l'utilisateur n'est jamais écrasé.
      // Le formulaire renvoie toujours le lot qu'il affiche : un lot identique au
      // lot stocké n'est pas une saisie, sinon un lot automatique ne suivrait
      // jamais un changement d'arbre, de date ou de parcelle (revue cmv2ebsdk).
      let numLot: string | undefined
      const lotSaisi = typeof body.numLot === "string" ? body.numLot.trim() : ""
      if (lotSaisi && lotSaisi !== existing.numLot) {
        numLot = lotSaisi
      } else {
        const dateChange = nouvelleDate !== undefined && nouvelleDate.getTime() !== existing.date.getTime()
        const parcelleChange = nouvelleParcelleId !== undefined && nouvelleParcelleId !== existing.parcelleId
        const especeChange = especeLot !== (existing.arbre?.espece ?? null)
        if ((dateChange || parcelleChange || especeChange) && estNumeroLotAuto(existing.numLot)) {
          const dateLot = nouvelleDate ?? existing.date
          const parcelleIdLot = nouvelleParcelleId !== undefined ? nouvelleParcelleId : existing.parcelleId
          let parcelleNomLot = nouvelleParcelleNom
          if (!parcelleNomLot && parcelleIdLot) {
            parcelleNomLot =
              (await tx.parcelleGeo.findFirst({ where: { id: parcelleIdLot, userId }, select: { nom: true } }))?.nom ??
              null
          }
          numLot = await prochainNumeroLotVerger(tx, userId, {
            date: dateLot,
            parcelleNom: parcelleNomLot,
            espece: especeLot,
          })
        }
      }

      const texteOuNull = (v: unknown): string | null | undefined =>
        v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim() : null

      // Lot déjà entamé par des sorties physiques : la production corrigée
      // doit les couvrir, et le reliquat suit la nouvelle quantité.
      const stockDisponibleCommercial = existing.stockDisponibleCommercial == null ? undefined
        : reliquatApresCorrection(sorties, { quantite: body.quantite ?? existing.quantite, unite: 'kg', date: nouvelleDate ?? existing.date })

      const recolte = await tx.recolteArbre.update({
        where: { id: recolteId },
        data: {
          arbreId: nouvelArbre?.id,
          date: nouvelleDate,
          quantite: body.quantite,
          stockDisponibleCommercial,
          qualite: texteOuNull(body.qualite),
          prixKg: prixFruitApi(body.prixKg, "prixKg"),
          datePeremption: body.datePeremption !== undefined
            ? dateRecolteApi(body.datePeremption, 'datePeremption')
            : undefined,
          notes: texteOuNull(body.notes === undefined ? undefined : retirerMarqueSaison(body.notes)),
          parcelleId: nouvelleParcelleId,
          numLot,
          categorieCommerciale: texteOuNull(body.categorieCommerciale),
          destinationCommerce: texteOuNull(body.destinationCommerce),
          conditionnement: texteOuNull(body.conditionnement),
          statutBioSnapshot: texteOuNull(body.statutBioSnapshot),
        },
        include: {
          arbre: {
            select: { id: true, nom: true, type: true, espece: true, especeId: true, variete: true },
          },
          parcelle: { select: { id: true, nom: true } },
        },
      })

      // QA cmvkoxe5o (2026-10-23) — la modification ne contrôlait pas la saison :
      // une récolte de Mirabelle (mi-août) déplacée au 10 juillet passait sans
      // un mot. Même règle que la création, sur l'arbre et la date finaux.
      // L'écran renvoie toujours la date : seul un changement réel (date ou
      // arbre) relance le contrôle, sinon corriger un prix redonnait l'alerte.
      const warnings: string[] = []
      const dateChangee = nouvelleDate !== undefined && nouvelleDate.getTime() !== existing.date.getTime()
      if ((dateChangee || nouvelArbre) && recolte.arbre) {
        const periodes = await chargerPeriodesRecolteVarietes(tx, userId, [recolte.arbre])
        const alerte = alerteSaisonRecolteArbre({
          espece: recolte.arbre.espece,
          variete: periodes.get(recolte.arbre),
          date: recolte.date,
        })
        if (alerte) warnings.push(alerte.message)
      }

      warnings.push(...await avertissementsDarFruit(tx, userId, recolte.arbreId, recolte.parcelleId, recolte.date))
      return NextResponse.json(warnings.length > 0 ? { ...recolte, warnings } : recolte)
    })
  } catch (err) {
    if (err instanceof ErreurVerger) return NextResponse.json({ error: err.message, champ: err.champ }, { status: err.status })
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error("PUT /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// PATCH : état relu sous verrou, source/facture/miroir/règlement atomiques.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json(await modifierVenteVerger('fruit', session!.user.id, session!.user.acteurId ?? session!.user.id, Number(id), await request.json()))
  } catch (err) {
    if (err instanceof ErreurVerger || err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error('PATCH /api/arbres/recoltes/[id] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

// DELETE /api/arbres/recoltes/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId: session!.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await verrouillerStockCommercial(tx, session!.user.id)
      const courante = await tx.recolteArbre.findFirst({ where: { id: recolteId, userId: session!.user.id } })
      if (!courante) throw new ErreurReglement('Pièce introuvable.', 404)
      // Un lot sans BL ni facture se supprime avec son journal de pertes et
      // d'usages internes (revue du 2026-10-29) ; un lot livré est conservé.
      const sorties = await etatSortiesLotVerger(tx, session!.user.id, 'fruit', courante)
      if (sorties.fige) throw new ErreurReglement('Ce lot est lié à un document commercial. Conservez ses mouvements de stock.')
      // Un produit transformé garde la trace de ses fruits (2026-10-30).
      if (sorties.sorties.some(m => m.nature === NATURE_TRANSFORMATION)) throw new ErreurReglement('Ces fruits ont servi à un produit transformé. Annulez d’abord la transformation depuis Productions > Produits transformés.')
      if (sorties.sorties.length) await tx.mouvementStockCommercial.deleteMany({ where: { userId: session!.user.id, id: { in: sorties.sorties.map(m => m.id) } } })
      if (courante.factureId) {
        const liee = await annulerFactureLiee(tx, session!.user.id, courante.factureId)
        if (!liee.ok) throw new ErreurReglement(liee.raison)
      }
      await deleteAutoEntry('recolte_arbre', recolteId, 'vente', session!.user.id, tx)
      await tx.recolteArbre.delete({ where: { id: recolteId, userId: session!.user.id } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error("DELETE /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
