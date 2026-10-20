/**
 * API Routes pour la Pollinisation des arbres
 * GET /api/arbres/pollinisation - Matrice de compatibilité
 * POST /api/arbres/pollinisation - Créer une association
 * DELETE /api/arbres/pollinisation?id=X - Supprimer une association
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { computePollinisationVerger, raisonExclusionPollinisateur } from "@/lib/pollinisation-verger"
import { choisirVarieteArbre, whereVarietesCandidates } from "@/lib/verger/variete-arbre"
import {
  NIVEAUX_ASSOCIATION,
  compatibiliteFloraison,
  floraisonArbre,
  refusPollinisateurFloraison,
} from "@/lib/verger/compatibilite-floraison"

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    // Le calcul vit dans src/lib/pollinisation-verger.ts (SSOT partagée avec
    // l'outil assistant `get_pollinisation`) — lot assistant 2026-08-11.
    return NextResponse.json(await computePollinisationVerger(session!.user.id))
  } catch (err) {
    console.error("GET /api/arbres/pollinisation error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des données de pollinisation" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    if (!body.arbrePolliniseId || !body.arbrePollinisateurId) {
      return NextResponse.json({ error: "Les deux arbres sont requis" }, { status: 400 })
    }

    const polliniseId = parseInt(body.arbrePolliniseId)
    const pollinisateurId = parseInt(body.arbrePollinisateurId)

    if (polliniseId === pollinisateurId) {
      return NextResponse.json({ error: "Un arbre ne peut pas se polliniser lui-même" }, { status: 400 })
    }

    // Vérifier que les deux arbres appartiennent à l'utilisateur
    const arbres = await prisma.arbre.findMany({
      where: { id: { in: [polliniseId, pollinisateurId] }, userId: session!.user.id },
    })
    if (arbres.length !== 2) {
      return NextResponse.json({ error: "Arbres non trouvés" }, { status: 404 })
    }

    // QA cmsjhe5nt — la pollinisation croisée n'opère qu'entre arbres de la
    // même espèce (un cerisier ne pollinise pas un pommier). On ne bloque pas
    // quand l'une des espèces est inconnue.
    const normaliseEspece = (e: string | null) =>
      (e || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    const [a1, a2] = arbres
    if (
      a1.espece && a2.espece &&
      normaliseEspece(a1.espece) !== normaliseEspece(a2.espece)
    ) {
      return NextResponse.json(
        { error: `${a1.espece} et ${a2.espece} sont d'espèces différentes : la pollinisation croisée demande deux arbres de la même espèce.` },
        { status: 422 },
      )
    }
    // QA cmswu5y82 — un arbre SANS espèce face à un arbre d'espèce connue
    // court-circuitait la garde ci-dessus (NULL && … = false) : l'association
    // invérifiable éteignait ensuite l'alerte « sans pollinisateur ». Même
    // règle que la dérivation (computePollinisationVerger ignore ces arbres).
    if ((a1.espece && !a2.espece) || (!a1.espece && a2.espece)) {
      const sansEspece = a1.espece ? a2 : a1
      return NextResponse.json(
        { error: `L'arbre « ${sansEspece.nom} » n'a pas d'espèce renseignée : complétez sa fiche avant d'enregistrer une pollinisation vérifiable.` },
        { status: 422 },
      )
    }

    // QA cmsoeyth0 — un triploïde (Jonagold, Boskoop…) était accepté comme
    // pollinisateur « excellent » alors que son pollen est stérile, et un
    // clone (même variété) passait aussi. Mêmes règles que la dérivation
    // automatique de la matrice (src/lib/pollinisation-verger.ts).
    const pollinise = arbres.find((a) => a.id === polliniseId)!
    const pollinisateur = arbres.find((a) => a.id === pollinisateurId)!
    // QA 2026-10-19 — variété résolue comme dans la matrice (id, à défaut
    // libellé dans l'espèce de l'arbre) : une variété personnelle affectée
    // par son nom n'était pas retrouvée par son seul id.
    const varietesCandidates = await prisma.variete.findMany({
      where: whereVarietesCandidates([pollinise, pollinisateur], session!.user.id),
      select: {
        id: true,
        nom: true,
        nomNormalise: true,
        especeId: true,
        userId: true,
        ploidie: true,
        groupePollinisation: true,
        semaineFloraison: true,
        dureeFloraison: true,
      },
    })
    const varietePollinise = choisirVarieteArbre(pollinise, varietesCandidates, session!.user.id)
    const varietePollinisateur = choisirVarieteArbre(pollinisateur, varietesCandidates, session!.user.id)
    const exclusion = raisonExclusionPollinisateur({
      varietePollinise: varietePollinise?.id ?? pollinise.variete,
      varietePollinisateur: varietePollinisateur?.id ?? pollinisateur.variete,
      ploidiePollinisateur: varietePollinisateur?.ploidie,
    })
    if (exclusion === "meme_variete") {
      return NextResponse.json(
        { error: "Deux arbres de la même variété sont des clones : la pollinisation croisée demande une variété différente." },
        { status: 422 },
      )
    }
    if (exclusion === "triploide") {
      return NextResponse.json(
        { error: "Un pollinisateur triploïde a un pollen stérile : choisissez un pollinisateur diploïde." },
        { status: 422 },
      )
    }

    // QA cmvgee5s9 — deux floraisons sans semaine commune (S14-S16 / S23-S25)
    // étaient enregistrées « partielle » : le pollinisateur absent pendant la
    // floraison comptait comme pollinisateur explicite et éteignait l'alerte.
    // Même règle que la matrice et la suggestion du dialogue.
    const refusFloraison = refusPollinisateurFloraison(
      compatibiliteFloraison(
        floraisonArbre(pollinise, varietePollinise),
        floraisonArbre(pollinisateur, varietePollinisateur),
      ),
    )
    if (refusFloraison) {
      return NextResponse.json({ error: refusFloraison }, { status: 422 })
    }

    // QA cmvgee5s9 — « incompatible » n'est pas un niveau d'association : il
    // désigne un pollinisateur exclu (floraisons disjointes, pollen stérile),
    // refusé plus haut avec son motif propre.
    const compatibilite = body.compatibilite == null || body.compatibilite === "" ? "bonne" : body.compatibilite
    if (!(NIVEAUX_ASSOCIATION as readonly string[]).includes(compatibilite)) {
      return NextResponse.json(
        { error: `Données invalides — compatibilite : valeur attendue ${NIVEAUX_ASSOCIATION.join(", ")}.` },
        { status: 400 },
      )
    }

    const association = await prisma.pollinisationArbre.create({
      data: {
        arbrePolliniseId: polliniseId,
        arbrePollinisateurId: pollinisateurId,
        compatibilite,
        notes: body.notes || null,
      },
      include: {
        arbrePollinise: { select: { id: true, nom: true } },
        arbrePollinisateur: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(association, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === "P2002") {
      return NextResponse.json({ error: "Cette association existe déjà" }, { status: 409 })
    }
    console.error("POST /api/arbres/pollinisation error:", err)
    return NextResponse.json({ error: "Erreur lors de la création de l'association" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const existing = await prisma.pollinisationArbre.findFirst({
      where: {
        id: parseInt(id),
        arbrePollinise: { userId: session!.user.id },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "Association non trouvée" }, { status: 404 })
    }

    await prisma.pollinisationArbre.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/pollinisation error:", err)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
