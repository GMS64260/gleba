/**
 * Masquage des lignes de référentiel communautaire EMBARQUÉES dans un objet
 * métier (culture, récolte, animal, irrigation, planche, rotation…).
 *
 * Les routes métier incluent la ligne complète d'une espèce, d'une variété,
 * d'un ITP, d'une espèce animale, d'une race ou d'un porte-greffe. Ces lignes
 * portent l'id de leur auteur : pour une entrée partagée par un autre compte,
 * c'est l'id d'un tiers qui sortait dans la réponse (revue 2026-10-20, suite
 * du sweep `e1bd648`). Même règle que `masquerEntree` : null (Gleba), l'id du
 * compte courant (perso), sinon le marqueur « communaute », que
 * `origineReferentiel` lit sans changement.
 *
 * S'applique à la projection, juste avant `NextResponse.json`, sur la réponse
 * entière : les relations imbriquées (`culture.variete`,
 * `rotation.details[].itp.espece`, `cultures[].espece`) sont traitées de la
 * même façon. Les clés sont celles des relations Prisma vers un modèle à
 * `partageCommunaute`. Tout le reste (colonnes, dates, objets du compte comme
 * la planche ou le lot) est rendu tel quel : le `userId` de la culture, de la
 * planche ou de l'animal reste celui du compte, il n'est pas touché.
 */

import { masquerEntree } from '@/lib/referentiel-communaute'

/** Noms de relation Prisma vers Espece, Variete, ITP, EspeceAnimale, RaceAnimale, PorteGreffe. */
const CLES_REFERENTIEL = new Set([
  'espece',
  'especeRef',
  'especes',
  'variete',
  'varietes',
  'itp',
  'itps',
  'especeAnimale',
  'raceAnimale',
  'races',
  'porteGreffe',
  'porteGreffeRef',
])

function estObjetSimple(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function masquerSousCle(valeur: unknown, currentUserId: string): unknown {
  if (Array.isArray(valeur)) {
    return valeur.map((e) => (estObjetSimple(e) ? masquerEntree(e, currentUserId) : e))
  }
  return estObjetSimple(valeur) ? masquerEntree(valeur, currentUserId) : valeur
}

/**
 * Copie de `valeur` dont aucune ligne de référentiel embarquée ne nomme un
 * autre compte. Les sous-arbres sans référentiel sont rendus par référence.
 */
export function masquerReferentielsEmbarques<T>(valeur: T, currentUserId: string): T {
  if (Array.isArray(valeur)) {
    let copie: unknown[] | null = null
    valeur.forEach((element, i) => {
      const masque = masquerReferentielsEmbarques(element, currentUserId)
      if (masque !== element) {
        if (!copie) copie = [...valeur]
        copie[i] = masque
      }
    })
    return (copie ?? valeur) as T
  }
  if (!estObjetSimple(valeur)) return valeur
  let copie: Record<string, unknown> | null = null
  for (const [cle, element] of Object.entries(valeur)) {
    if (!estObjetSimple(element) && !Array.isArray(element)) continue
    let masque: unknown = masquerReferentielsEmbarques(element, currentUserId)
    if (CLES_REFERENTIEL.has(cle)) masque = masquerSousCle(masque, currentUserId)
    if (masque !== element) {
      if (!copie) copie = { ...valeur }
      copie[cle] = masque
    }
  }
  return (copie ?? valeur) as T
}
