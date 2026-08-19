/**
 * Règles d'accès à un ITP, en un seul endroit.
 *
 * Un ITP est une entrée du référentiel communautaire : il peut être officiel
 * (userId null), proposé par un membre (partageCommunaute), privé, désactivé
 * (`actif = false`, cas des scénarios sourcés dont les semaines publiées sont
 * hors ISO), et calé sur un climat qui n'est pas transposable vers toutes les
 * zones. Trois questions distinctes, longtemps répondues différemment selon
 * l'appelant :
 *
 *   - PUIS-JE LE VOIR ?      visibiliteReferentiel (référentiel-communaute)
 *   - PUIS-JE M'EN SERVIR ?  whereItpUtilisable = visible ET actif
 *   - EST-IL PERTINENT ICI ? whereItpApplicable  = compatible avec ma zone
 *
 * Avant, `actif` n'était filtré que dans `GET /api/itps`, la visibilité était
 * absente des chemins d'écriture des cultures et des rotations, et la règle de
 * zone était recopiée (avec une liste de zones en dur, et une variante fausse
 * dans l'assistant IA qui ne voyait plus que 122 ITP sur 673).
 */

import { visibiliteReferentiel } from './referentiel-communaute'
import { ZONES_METROPOLE, zoneHorsReferenceMetropole } from './calendrier-climat'
import type { ZoneClimat } from './terroir'

/** Fragment `where` : ITP visible par cet utilisateur ET encore en service. */
export function whereItpUtilisable(userId: string) {
  return { AND: [{ actif: true }, visibiliteReferentiel(userId)] }
}

/**
 * Fragment `where` : ITP dont le calendrier a un sens dans cette zone.
 * Zone d'outre-mer → uniquement les ITP calés sur ELLE (les semaines
 * métropolitaines n'y sont pas transposables, hémisphère parfois inversé).
 * Zone métropolitaine ou indéterminée → référentiel générique (zoneClimat null)
 * et itinéraires calés sur une zone métropolitaine, jamais les tropicaux.
 *
 * Miroir exact de `itpApplicableAZone` côté client — toute divergence remet en
 * circulation le décalage silencieux entre ce qu'un écran liste et ce qu'un
 * autre propose.
 */
export function whereItpApplicable(userZone: ZoneClimat | null | undefined) {
  if (zoneHorsReferenceMetropole(userZone)) {
    return { zoneClimat: userZone as ZoneClimat }
  }
  return {
    OR: [{ zoneClimat: null }, { zoneClimat: { in: [...ZONES_METROPOLE] } }],
  }
}
