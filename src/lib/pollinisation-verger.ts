/**
 * Matrice de pollinisation du verger — source unique de vérité de l'écran
 * Verger > Pollinisation (groupes effectifs, autofertilité effective,
 * compatibilités dérivées, ploïdie, alertes « sans pollinisateur » et
 * anémophiles).
 *
 * Extrait de GET /api/arbres/pollinisation (lot assistant 2026-08-11) pour
 * être partagé avec l'outil assistant `get_pollinisation` : les compteurs et
 * alertes cités par l'assistant sont exactement ceux de l'écran.
 */

import prisma from '@/lib/prisma'
import {
  doitSignalerSansPollinisateur,
  isAutofertileFallback,
} from '@/lib/pollinisation'
import {
  compatibiliteFloraison,
  floraisonArbre,
  refusPollinisateurFloraison,
  type FloraisonVariete,
} from '@/lib/verger/compatibilite-floraison'
import { choisirVarieteArbre, whereVarietesCandidates } from '@/lib/verger/variete-arbre'
import { TYPES_ARBRE_FRUITIERS } from '@/lib/verger/types-arbre'

export type PollinisationVerger = Awaited<ReturnType<typeof computePollinisationVerger>>

/**
 * QA cmsoeyth0 — règles d'exclusion d'un pollinisateur, partagées entre la
 * dérivation automatique ci-dessous et la garde serveur de
 * POST /api/arbres/pollinisation (un triploïde était accepté comme
 * pollinisateur « excellent » alors que son pollen est stérile) :
 *   - 'meme_variete' : deux arbres de la même variété sont des clones,
 *     le pollen est auto-incompatible ;
 *   - 'triploide'    : un pollinisateur triploïde a un pollen stérile.
 * `variete` est la variété du référentiel désignée par Arbre.variete (son id
 * quand elle est résolue, voir `src/lib/verger/variete-arbre.ts`).
 */
export function raisonExclusionPollinisateur(params: {
  varietePollinise: string | null
  varietePollinisateur: string | null
  ploidiePollinisateur?: string | null
}): 'meme_variete' | 'triploide' | null {
  if (
    params.varietePollinise &&
    params.varietePollinisateur &&
    params.varietePollinise === params.varietePollinisateur
  ) {
    return 'meme_variete'
  }
  if ((params.ploidiePollinisateur ?? '').toLowerCase().startsWith('tripl')) {
    return 'triploide'
  }
  return null
}

export async function computePollinisationVerger(userId: string) {
  // Récupérer tous les arbres fruitiers avec infos pollinisation
  const arbres = await prisma.arbre.findMany({
    where: {
      userId,
      // Types qui produisent des fruits, lianes comprises (kiwi dioïque :
      // un pied mâle est indispensable) — liste unique, QA 2026-10-19.
      type: { in: [...TYPES_ARBRE_FRUITIERS] },
    },
    select: {
      id: true,
      nom: true,
      espece: true,
      especeId: true,
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
  //   - floraisons compatibles : `compatibiliteFloraison`
  //     (src/lib/verger/compatibilite-floraison.ts), périodes saisies sur la
  //     variété d'abord, groupes A-D ensuite, présomption si rien n'est connu
  //   - on ne propose pas un arbre triploïde comme pollinisateur

  // Variété du référentiel de chaque arbre (ploïdie, groupe, floraison).
  // QA 2026-10-19 — résolue par id OU par libellé dans l'espèce de l'arbre :
  // une variété personnelle (id = cuid) affectée par son nom n'était jamais
  // retrouvée, ses semaines de floraison restaient donc ignorées.
  const varietesCandidates = await prisma.variete.findMany({
    where: whereVarietesCandidates(arbres, userId),
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
  const varieteMap = new Map(
    arbres.map((a) => [a.id, choisirVarieteArbre(a, varietesCandidates, userId)] as const),
  )
  // Même lecture que la garde de POST /api/arbres/pollinisation (QA cmvgee5s9).
  const floraisonDe = (a: typeof arbres[number]): FloraisonVariete =>
    floraisonArbre(a, varieteMap.get(a.id) ?? null)

  const compatibilitesDerivees = new Map<number, Array<{
    id: number
    nom: string
    espece: string | null
    variete: string | null
    raison: string
    /**
     * QA cmsw9e88e (2026-08-16) — 'verifiee' quand les floraisons des DEUX
     * variétés sont connues (périodes saisies, à défaut groupes) et
     * compatibles ; 'presumee' quand la donnée manque. Une présomption ne doit
     * plus être affichée comme une compatibilité prouvée.
     */
    certitude: 'verifiee' | 'presumee'
  }>>()
  // Bug cmp8sk552 (Marc 2026-05-16) — fallback variétés auto-fertiles
  // (Mirabelle de Nancy, Reine-Claude d'Oullins, Framboisier…) qui
  // restaient classées "Sans pollinisateur" car flag autofertile=false.
  const estAutofertile = (a: typeof arbres[number]) =>
    a.autofertile || isAutofertileFallback(a.variete)

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
    const va = varieteMap.get(a.id) ?? null
    const floraisonA = floraisonDe(a)
    const candidats: Array<{ id: number; nom: string; espece: string | null; variete: string | null; raison: string; certitude: 'verifiee' | 'presumee' }> = []
    for (const b of arbres) {
      if (b.id === a.id) continue
      if (b.espece !== a.espece) continue
      const vb = varieteMap.get(b.id) ?? null
      // même clone ou triploïde (pollen stérile) — règle partagée avec la
      // garde serveur de POST /api/arbres/pollinisation (QA cmsoeyth0)
      if (
        raisonExclusionPollinisateur({
          varietePollinise: va?.id ?? a.variete,
          varietePollinisateur: vb?.id ?? b.variete,
          ploidiePollinisateur: vb?.ploidie,
        })
      ) continue
      // Périodes de floraison saisies sur les variétés (2026-10-07) : quand les
      // deux sont connues, elles priment sur le groupe du catalogue. QA
      // cmsw9e88e — une présomption (donnée manquante) n'est jamais affichée
      // comme une compatibilité vérifiée.
      const compat = compatibiliteFloraison(floraisonA, floraisonDe(b))
      if (!compat.compatible) continue
      candidats.push({
        id: b.id,
        nom: b.nom,
        espece: b.espece,
        variete: b.variete,
        raison: `Même espèce, ${compat.raison}`,
        certitude: compat.certitude,
      })
    }
    if (candidats.length) compatibilitesDerivees.set(a.id, candidats)
  }

  // QA cmvgee5s9 (2026-10-20) — une association enregistrée puis démentie par
  // les floraisons (période d'une variété modifiée ensuite : S14-S16 face à
  // S23-S25) comptait encore comme pollinisateur explicite et éteignait
  // l'alerte. Même règle que la garde de POST /api/arbres/pollinisation ; un
  // pollinisateur hors de la liste (autre type d'arbre) n'est pas jugé.
  const arbreParId = new Map(arbres.map((a) => [a.id, a] as const))
  const motifAssociationDementie = (a: typeof arbres[number], pollinisateurId: number): string | null => {
    const pollinisateur = arbreParId.get(pollinisateurId)
    if (!pollinisateur) return null
    return refusPollinisateurFloraison(compatibiliteFloraison(floraisonDe(a), floraisonDe(pollinisateur)))
  }
  const pollinisateursExplicitesValides = (a: typeof arbres[number]) =>
    a.pollinisateursCompat.filter((p) => !motifAssociationDementie(a, p.arbrePollinisateurId)).length

  // Bug cms67gg8m (2026-07-29) — « anémophile » décrit le transport
  // du pollen, pas la présence d'une variété compatible. Les noyers
  // Franquette sans autre variété doivent donc apparaître dans ce KPI.
  const alertes = arbres
    .filter(
      (a) =>
        doitSignalerSansPollinisateur({
          autofertile: estAutofertile(a),
          nombrePollinisateursExplicites: pollinisateursExplicitesValides(a),
          hasPollinisateurDerive: compatibilitesDerivees.has(a.id),
          modePollinisation: estAnemophile(a) ? "anémophile" : null,
        })
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
  // QA 2026-07-30 — La colonne Groupe affichait « - » pour 49 arbres dont la
  // variété porte pourtant un groupe au référentiel : le repli variété
  // n'était utilisé que pour dériver les paires compatibles, jamais exposé.
  // Le groupe propre à l'arbre reste prioritaire (une migration de 2026-05 a
  // rempli des valeurs qui peuvent différer du référentiel).
  const arbresEnrichis = arbres.map((a) => {
    const varieteReferentiel = varieteMap.get(a.id) ?? null
    const groupeReferentiel = varieteReferentiel?.groupePollinisation ?? null
    // QA 2026-10-19 — la colonne Floraison ne lisait que le champ de l'arbre :
    // la période saisie sur la variété est exposée et prime à l'affichage.
    const periodeFloraison = floraisonDe(a).periode
    const groupeEffectif = a.groupePollinisation ?? groupeReferentiel
    // QA cmsw9e88e — distinguer les dérivations prouvées (deux groupes
    // connus) des présomptions (donnée manquante) pour que l'UI n'affiche
    // plus « À associer (auto) / groupes compatibles » sans données.
    const derives = compatibilitesDerivees.get(a.id)
    const certitudeDerive = derives
      ? derives.some((c) => c.certitude === 'verifiee')
        ? ('verifiee' as const)
        : ('presumee' as const)
      : null
    return {
      ...a,
      // Chaque association porte le motif qui la dément, ou null.
      pollinisateursCompat: a.pollinisateursCompat.map((p) => ({
        ...p,
        floraisonIncompatible: motifAssociationDementie(a, p.arbrePollinisateurId),
      })),
      /** Associations explicites que les floraisons ne démentent pas. */
      nombrePollinisateursValides: pollinisateursExplicitesValides(a),
      autofertileEffectif: estAutofertile(a),
      hasPollinisateurDerive: compatibilitesDerivees.has(a.id),
      pollinisateurDeriveCertitude: certitudeDerive,
      groupePollinisationEffectif: groupeEffectif,
      groupePollinisationSource: a.groupePollinisation
        ? ('arbre' as const)
        : groupeReferentiel
          ? ('referentiel' as const)
          : null,
      // QA cmsnnw18k — la ploïdie était chargée et utilisée en interne
      // (exclusion des triploïdes comme pollinisateurs) mais jamais
      // exposée : impossible de savoir à l'écran qu'un Jonagold est
      // triploïde et exige deux pollinisateurs diploïdes.
      ploidie: varieteReferentiel?.ploidie ?? null,
      /** Id de la variété du référentiel désignée par l'arbre, ou null. */
      varieteId: varieteReferentiel?.id ?? null,
      /** Période de floraison saisie sur la variété (semaine ISO + durée), ou null. */
      periodeFloraison,
    }
  })
  return {
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
  }
}
