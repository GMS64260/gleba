/**
 * API Routes pour la Pollinisation des arbres
 * GET /api/arbres/pollinisation - Matrice de compatibilité
 * POST /api/arbres/pollinisation - Créer une association
 * DELETE /api/arbres/pollinisation?id=X - Supprimer une association
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id

    // Récupérer tous les arbres fruitiers avec infos pollinisation
    const arbres = await prisma.arbre.findMany({
      where: {
        userId,
        type: { in: ["fruitier", "petit_fruit"] },
      },
      select: {
        id: true,
        nom: true,
        espece: true,
        variete: true,
        floraison: true,
        groupePollinisation: true,
        autofertile: true,
        pollinisateursCompat: {
          include: {
            arbrePollinisateur: {
              select: { id: true, nom: true, espece: true, variete: true, floraison: true, groupePollinisation: true },
            },
          },
        },
        pollinisateurDe: {
          include: {
            arbrePollinise: {
              select: { id: true, nom: true, espece: true, variete: true },
            },
          },
        },
      },
      orderBy: { nom: "asc" },
    })

    // Feedback Marc 2026-05-16 — V2 Bug 6 : on dérive des suggestions
    // de pollinisateurs intra-verger quand aucune association n'est
    // saisie. Critères :
    //   - même espèce (Pommier × Pommier)
    //   - variété distincte (Golden ≠ Reinette grise)
    //   - groupes de floraison adjacents (A↔B, B↔C, C↔D) ou égaux
    //     (info Variete.groupePollinisation), tolérant si donnée absente
    //   - on ne propose pas un arbre triploïde comme pollinisateur
    const groupeAdjacent = (g1: string | null, g2: string | null): boolean => {
      if (!g1 || !g2) return true // données partielles → on ne bloque pas
      const order = ["A", "B", "C", "D", "E"]
      const i1 = order.indexOf(g1.toUpperCase())
      const i2 = order.indexOf(g2.toUpperCase())
      if (i1 < 0 || i2 < 0) return g1 === g2
      return Math.abs(i1 - i2) <= 1
    }

    // Récupérer ploïdie/groupe par variété (référentiel) pour qualifier.
    const varieteIds = [
      ...new Set(arbres.map((a) => a.variete).filter((v): v is string => !!v)),
    ]
    const varietes = varieteIds.length
      ? await prisma.variete.findMany({
          where: { id: { in: varieteIds } },
          select: { id: true, ploidie: true, groupePollinisation: true },
        })
      : []
    const varieteMap = new Map(varietes.map((v) => [v.id, v]))

    const compatibilitesDerivees = new Map<number, Array<{
      id: number
      nom: string
      espece: string | null
      variete: string | null
      raison: string
    }>>()
    // Bug cmp8sk552 (Marc 2026-05-16) — fallback variétés auto-fertiles
    // (Mirabelle de Nancy, Reine-Claude d'Oullins, Framboisier…) qui
    // restaient classées "Sans pollinisateur" car flag autofertile=false.
    const { isAutofertileFallback } = await import('@/lib/pollinisation')
    const estAutofertile = (a: typeof arbres[number]) =>
      a.autofertile || isAutofertileFallback(a.variete)

    // Bug feedback testeur 2026-05-25 (cmplk71ec) — Les espèces anémophiles
    // (pollinisation par le vent, pas par les insectes) ne suivent pas la
    // même logique que les fruitiers entomophiles : un couple de
    // Franquettes ne se pollinise pas bien à cause de la protogynie
    // (heterodichogamie), mais l'alerte "sans pollinisateur compatible"
    // qui sert à signaler un cerisier seul est inadaptée pour eux.
    // On les exclut de l'alerte pour ne pas diluer le signal "vrais"
    // problèmes (cerisier isolé, etc.).
    const estAnemophile = (a: typeof arbres[number]) => {
      const esp = (a.espece || "").toLowerCase()
      return (
        esp.includes("noyer") ||
        esp.includes("châtaignier") || esp.includes("chataignier") ||
        esp.includes("pistachier") ||
        esp.includes("olivier") ||
        esp.includes("noisetier")
      )
    }

    for (const a of arbres) {
      if (estAutofertile(a)) continue
      if (!a.espece) continue
      const va = a.variete ? varieteMap.get(a.variete) : null
      const candidats: Array<{ id: number; nom: string; espece: string | null; variete: string | null; raison: string }> = []
      for (const b of arbres) {
        if (b.id === a.id) continue
        if (b.espece !== a.espece) continue
        if (b.variete && a.variete && b.variete === a.variete) continue // même clone
        const vb = b.variete ? varieteMap.get(b.variete) : null
        if (vb?.ploidie?.toLowerCase().startsWith("tripl")) continue // tripl. pollinise mal
        const ga = a.groupePollinisation ?? va?.groupePollinisation ?? null
        const gb = b.groupePollinisation ?? vb?.groupePollinisation ?? null
        if (!groupeAdjacent(ga, gb)) continue
        candidats.push({
          id: b.id,
          nom: b.nom,
          espece: b.espece,
          variete: b.variete,
          raison: `Même espèce, ${ga && gb ? `groupes ${ga}/${gb}` : "floraison compatible"}`,
        })
      }
      if (candidats.length) compatibilitesDerivees.set(a.id, candidats)
    }

    // Alertes: arbres non autofertiles sans pollinisateur compatible
    // (ni explicite, ni dérivé). Les espèces anémophiles sont exclues
    // (cf. cmplk71ec — alerte cerisier diluée par les noyers).
    const alertes = arbres
      .filter(
        (a) =>
          !estAutofertile(a) &&
          !estAnemophile(a) &&
          a.pollinisateursCompat.length === 0 &&
          !compatibilitesDerivees.has(a.id)
      )
      .map((a) => ({
        id: a.id,
        nom: a.nom,
        espece: a.espece,
        variete: a.variete,
        floraison: a.floraison,
        groupePollinisation: a.groupePollinisation,
      }))

    // Bug feedback testeur 2026-05-25 (cmplk71ec) — Alertes spécifiques
    // aux anémophiles : il faut au minimum 2 individus de variétés
    // différentes pour assurer la pollinisation croisée (protogynie).
    // Si un seul individu d'une variété donnée → flag distinct.
    const especesAnemo = new Map<string, Set<string>>() // espece → set(variete)
    for (const a of arbres) {
      if (!estAnemophile(a) || !a.espece) continue
      if (!especesAnemo.has(a.espece)) especesAnemo.set(a.espece, new Set())
      if (a.variete) especesAnemo.get(a.espece)!.add(a.variete)
    }
    const alertesAnemophiles = arbres
      .filter((a) => estAnemophile(a))
      .filter((a) => {
        if (!a.espece) return false
        const varietes = especesAnemo.get(a.espece)
        return !varietes || varietes.size < 2
      })
      .map((a) => ({
        id: a.id,
        nom: a.nom,
        espece: a.espece,
        variete: a.variete,
        raison: "Espèce anémophile (pollinisation par le vent) — prévoir au moins 2 variétés différentes pour assurer la pollinisation croisée.",
      }))

    // Toutes les associations
    const associations = await prisma.pollinisationArbre.findMany({
      where: {
        arbrePollinise: { userId },
      },
      include: {
        arbrePollinise: {
          select: { id: true, nom: true, espece: true, variete: true },
        },
        arbrePollinisateur: {
          select: { id: true, nom: true, espece: true, variete: true },
        },
      },
    })

    // Bug #15 — Le tableau UI utilisait `arbre.autofertile` brut et
    // ignorait les compatibilités dérivées : 1 ligne "Oui" alors que
    // le compteur en montrait 7, et 17 "Aucun !" alors que l'encart
    // n'en signalait que 4. On expose pour chaque arbre les flags
    // effectifs (autofertile + dérivés) calculés ici, pour que la table
    // s'aligne sur les compteurs.
    const arbresEnrichis = arbres.map((a) => ({
      ...a,
      autofertileEffectif: estAutofertile(a),
      hasPollinisateurDerive: compatibilitesDerivees.has(a.id),
    }))

    return NextResponse.json({
      arbres: arbresEnrichis,
      associations,
      alertes,
      alertesAnemophiles,
      // Feedback Marc 2026-05-16 — V2 Bug 6 : on expose les paires
      // détectées automatiquement pour que l'UI puisse proposer
      // "Associer ces pollinisateurs en 1 clic".
      compatibilitesDerivees: Object.fromEntries(compatibilitesDerivees.entries()),
      stats: {
        totalArbres: arbres.length,
        autofertiles: arbres.filter(estAutofertile).length,
        sansPollinisateur: alertes.length,
        anemophiles: arbres.filter(estAnemophile).length,
        anemophilesSeuls: alertesAnemophiles.length,
        avecCompatibiliteAuto: compatibilitesDerivees.size,
      },
    })
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

    const association = await prisma.pollinisationArbre.create({
      data: {
        arbrePolliniseId: polliniseId,
        arbrePollinisateurId: pollinisateurId,
        compatibilite: body.compatibilite || "bonne",
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
