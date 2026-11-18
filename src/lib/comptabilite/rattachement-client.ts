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

/** Fiche client telle que lue pour figer l'acheteur. */
export interface FicheAcheteur {
  nom: string
  type?: string | null
  email?: string | null
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
  pays?: string | null
  siret?: string | null
  siren?: string | null
  tvaIntra?: string | null
}

/** Colonnes de la facture qui portent l'identité figée de l'acheteur. */
export interface InstantaneAcheteur extends IdentiteAcheteur {
  clientNom: string
  clientAdresse: string | null
  clientEmail: string | null
  clientCodePostal: string | null
  clientVille: string | null
  clientPays: string | null
  clientType: string | null
}

const texte = (v?: string | null) => v?.trim() || null

/**
 * BX03 (2026-11-16) — identité complète de l'acheteur à figer sur une facture
 * ou un avoir émis, lue sur sa fiche. Sans adresse sur la fiche, l'adresse
 * saisie sur la facture est gardée plutôt que remplacée par une chaîne vide.
 */
export function instantaneAcheteur(client: FicheAcheteur, adresseSaisie?: string | null): InstantaneAcheteur {
  return {
    clientNom: client.nom,
    clientAdresse: adresseDeFiche(client) || texte(adresseSaisie),
    clientEmail: texte(client.email),
    clientCodePostal: texte(client.codePostal),
    clientVille: texte(client.ville),
    clientPays: texte(client.pays),
    clientType: texte(client.type),
    ...identiteAcheteur(client),
  }
}

/** Facture lue pour ses documents (PDF, UBL, Factur-X) : colonnes figées et fiche liée. */
export interface FactureAcheteur {
  clientNom: string
  clientAdresse: string | null
  clientSiret: string | null
  clientSiren: string | null
  clientTvaIntra: string | null
  clientEmail: string | null
  clientCodePostal: string | null
  clientVille: string | null
  clientPays: string | null
  clientType: string | null
  acheteurFigeLe: Date | null
  client?: FicheAcheteur | null
}

/** Acheteur imprimé sur la facture et transmis dans le Factur-X. */
export interface AcheteurDeFacture {
  nom: string
  adresse: string | null
  siret: string | null
  siren: string | null
  tvaIntra: string | null
  email: string | null
  codePostal: string | null
  ville: string | null
  pays: string | null
  type: string | null
  /** false : instantané historique absent ou brouillon, sans complément courant. */
  fige: boolean
}

export const AVERTISSEMENT_ACHETEUR_NON_FIGE =
  'Acheteur non figé : identité historique incomplète ; seuls les champs archivés sur la facture sont exportés, sans complément depuis la fiche client actuelle.'

/**
 * Source unique des éditions PDF, UBL et Factur-X. Les colonnes archivées
 * font foi, même vides. L'absence d'instantané est signalée séparément : elle
 * n'autorise jamais à reconstruire l'identité historique depuis la fiche.
 */
export function acheteurDeFacture(facture: FactureAcheteur): AcheteurDeFacture {
  const fige = facture.acheteurFigeLe != null
  const siret = facture.clientSiret ?? null
  return {
    nom: facture.clientNom,
    adresse: facture.clientAdresse ?? null,
    siret,
    siren: facture.clientSiren ?? (!fige && siret && siret.replace(/\D/g, '').length === 14 ? sirenFromSiret(siret) : null),
    tvaIntra: facture.clientTvaIntra ?? null,
    email: facture.clientEmail ?? null,
    codePostal: facture.clientCodePostal ?? null,
    ville: facture.clientVille ?? null,
    pays: facture.clientPays ?? null,
    type: facture.clientType ?? null,
    fige,
  }
}
