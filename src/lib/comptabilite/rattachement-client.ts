/**
 * Rattachement d'une facture à une fiche client et identité de l'acheteur
 * figée à l'émission : règles partagées par la route de création, la
 * transition brouillon → émise et le formulaire Factures (module sans accès à
 * la base, utilisable côté écran).
 *
 * Ticket cmvfljaru (QA 2026-10-19) : le formulaire « Nouvelle facture » ne
 * proposait aucune fiche client et n'envoyait jamais `clientId`. Une facture
 * adressée à un client professionnel dont la fiche porte un SIRET partait
 * donc sans fiche : nom et adresse recopiés à la main, mais ni SIRET, ni SIREN,
 * ni TVA intracommunautaire sur le PDF et le Factur-X.
 */

import { sirenFromSiret } from '@/lib/siret'

/** Nom de client comparable : sans casse, sans accents, espaces réduits. */
export function normaliserNomClient(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Fiche désignée par un nom saisi librement : la seule fiche de même nom
 * normalisé. Deux homonymes : aucune (on ne choisit pas à la place de
 * l'utilisateur, il passe par le sélecteur de fiche).
 */
export function clientDesigneParNom<T extends { id: number; nom: string }>(clients: readonly T[], nom: string | null | undefined): T | null {
  const cible = nom ? normaliserNomClient(nom) : ''
  if (!cible) return null
  const memes = clients.filter((c) => normaliserNomClient(c.nom) === cible)
  return memes.length === 1 ? memes[0] : null
}

/** Adresse d'une fiche telle qu'imprimée sur la facture (voie, code postal, ville). */
export function adresseDeFiche(client: { adresse?: string | null; codePostal?: string | null; ville?: string | null }): string {
  return [client.adresse, client.codePostal, client.ville].filter((p) => p && p.trim()).join(', ')
}

export interface IdentiteAcheteur {
  clientSiret: string | null
  /** SIREN de l'acheteur (BT-47), dérivé du SIRET à défaut. */
  clientSiren: string | null
  /** TVA intracommunautaire de l'acheteur (BT-48). */
  clientTvaIntra: string | null
}

/** Identité de l'acheteur à figer sur la facture, lue sur sa fiche. */
export function identiteAcheteur(client: { siret?: string | null; siren?: string | null; tvaIntra?: string | null }): IdentiteAcheteur {
  const siret = client.siret?.trim() || null
  return {
    clientSiret: siret,
    clientSiren: client.siren?.trim() || (siret ? sirenFromSiret(siret) : null),
    clientTvaIntra: client.tvaIntra?.trim() || null,
  }
}
