/**
 * Utilitaire centralisé pour la création de factures.
 *
 * PROMPT 14B — Numérotation continue garantie par `SequenceFacture` :
 *   - une ligne par (user, exercice, type) verrouillée FOR UPDATE
 *   - incrément atomique dans la transaction d'écriture
 *   - aucun saut, aucun doublon, même sous concurrence
 *
 * Utilisé par : comptabilite/factures, elevage/ventes, elevage/abattages,
 * production-bois, recoltes-arbres.
 */

import type { PrismaClient } from '@prisma/client'
import { factureSansTaxe } from '@/lib/territoires'

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface LigneFactureInput {
  description: string
  quantite: number
  unite: string
  prixUnitaire: number
  tauxTVA: number
  montantHT: number
  montantTVA: number
  montantTTC: number
  statutBio?: string | null
}

export interface CreerFactureParams {
  userId: string
  type: string // 'facture' | 'avoir' | 'acompte'
  clientId?: number | null
  clientNom?: string
  clientAdresse?: string | null
  date?: Date
  dateEcheance?: Date | null
  objet: string
  totalHT: number
  totalTVA: number
  totalTTC: number
  statut?: string
  modePaiement?: string | null
  datePaiement?: Date | null
  mentionsLegales?: string | null
  notes?: string | null
  factureOrigineId?: number | null
  conditionsPaiement?: string | null
  mentionsSpecifiques?: string[]
  lignes: LigneFactureInput[]
}

/**
 * Calcule les totaux HT/TVA par taux à partir des lignes.
 * Retour : `{ "5.5": { ht, tva, ttc }, "20": { ht, tva, ttc }, ... }`
 */
export function totauxParTaux(lignes: LigneFactureInput[]): Record<string, { ht: number; tva: number; ttc: number }> {
  const out: Record<string, { ht: number; tva: number; ttc: number }> = {}
  for (const l of lignes) {
    const k = String(l.tauxTVA)
    if (!out[k]) out[k] = { ht: 0, tva: 0, ttc: 0 }
    out[k].ht += l.montantHT
    out[k].tva += l.montantTVA
    out[k].ttc += l.montantTTC
  }
  // Arrondi à 2 décimales
  for (const k of Object.keys(out)) {
    out[k].ht = Math.round(out[k].ht * 100) / 100
    out[k].tva = Math.round(out[k].tva * 100) / 100
    out[k].ttc = Math.round(out[k].ttc * 100) / 100
  }
  return out
}

/**
 * Snapshot d'identité émetteur figé à l'émission de la facture.
 * Toute modification ultérieure sur Exploitation ne touche pas les factures déjà émises.
 */
export interface EmetteurSnapshot {
  raisonSociale: string
  formeJuridique: string
  // Territoire fiscal — pilote identifiant légal, devise et libellé de taxe.
  territoire: string
  siret: string | null
  siren: string | null
  // Identifiant légal local hors SIRENE (RIDET, N° Tahiti…).
  identifiantLegal: string | null
  // Devise de la facture (EUR / XPF).
  devise: string
  numeroTvaIntracom: string | null
  regimeFiscal: string
  regimeTva: string
  adresseSiege: string
  codePostal: string
  ville: string
  pays: string
  emailContact: string
  telContact: string | null
  capitalSocial: number | null
  rib: string | null
  bic: string | null
  banqueNom: string | null
  logoUrl: string | null
  certifBioOrganisme: string | null
  tauxPenalitesRetard: string | null
  indemniteRecouvrement: number
  tauxEscompte: string | null
}

async function snapshotEmetteur(tx: PrismaTx, userId: string): Promise<EmetteurSnapshot | null> {
  const e = await tx.exploitation.findUnique({ where: { userId } })
  if (!e) return null
  return {
    raisonSociale: e.raisonSociale,
    formeJuridique: e.formeJuridique,
    territoire: e.territoire,
    siret: e.siret,
    siren: e.siren,
    identifiantLegal: e.identifiantLegal,
    devise: e.devise,
    numeroTvaIntracom: e.numeroTvaIntracom,
    regimeFiscal: e.regimeFiscal,
    regimeTva: e.regimeTva,
    adresseSiege: e.adresseSiege,
    codePostal: e.codePostal,
    ville: e.ville,
    pays: e.pays,
    emailContact: e.emailContact,
    telContact: e.telContact,
    capitalSocial: e.capitalSocial ? Number(e.capitalSocial) : null,
    rib: e.rib,
    bic: e.bic,
    banqueNom: e.banqueNom,
    logoUrl: e.logoUrl,
    certifBioOrganisme: e.certifBioOrganisme,
    tauxPenalitesRetard: e.tauxPenalitesRetard,
    indemniteRecouvrement: Number(e.indemniteRecouvrement),
    tauxEscompte: e.tauxEscompte,
  }
}

/**
 * Construit la liste des mentions par défaut à partir du régime de l'exploitation
 * et du contenu des lignes (présence de lignes AB par exemple).
 */
function mentionsParDefaut(snapshot: EmetteurSnapshot | null, lignes: LigneFactureInput[]): string[] {
  const out: string[] = []
  // Mention 293 B si franchise ; mention d'exonération générique si non-assujetti
  // (territoires hors champ TVA : Guyane, Mayotte, COM…).
  if (snapshot?.regimeTva === 'franchise-293b') out.push('293b')
  else if (snapshot?.regimeTva === 'non-assujetti') out.push('exoneration')
  // Mentions générales obligatoires (pro)
  out.push('escompte', 'penalites', 'indemnite-40')
  // Mention AB si au moins une ligne en AB
  if (lignes.some((l) => l.statutBio === 'AB')) out.push('ab')
  return out
}

/**
 * Réserve atomiquement le prochain numéro pour (user, exercice, type)
 * en lockant la ligne `sequences_facture` correspondante (FOR UPDATE).
 *
 * Si la séquence n'existe pas encore (cas d'un nouvel exercice), elle est
 * initialisée à 1. Le `INSERT ... ON CONFLICT` garantit qu'une transaction
 * concurrente ne créera pas de doublon : le second arrivant trouvera la
 * ligne et la verrouillera après la première transaction.
 */
async function reserverProchainNumero(
  tx: PrismaTx,
  userId: string,
  exercice: number,
  typeSeq: 'FACTURE' | 'AVOIR' | 'DEVIS'
): Promise<{ numero: string; prefixe: string }> {
  const prefixeDefaut =
    typeSeq === 'AVOIR' ? `AV-${exercice}-` : typeSeq === 'DEVIS' ? `D-${exercice}-` : `F-${exercice}-`

  // Insert idempotent si la séquence n'existe pas encore pour cet exercice
  await tx.$executeRawUnsafe(
    `
    INSERT INTO sequences_facture (id, user_id, exercice, type, prochain_num, prefixe, format, created_at, updated_at)
    VALUES (gen_random_uuid()::text, $1, $2, $3, 1, $4, '%04d', NOW(), NOW())
    ON CONFLICT (user_id, exercice, type) DO NOTHING
    `,
    userId,
    exercice,
    typeSeq,
    prefixeDefaut
  )

  // Lock + lecture du numéro courant
  const rows = await tx.$queryRawUnsafe<Array<{ prochain_num: number; prefixe: string; format: string }>>(
    `
    SELECT prochain_num, prefixe, format
    FROM sequences_facture
    WHERE user_id = $1 AND exercice = $2 AND type = $3
    FOR UPDATE
    `,
    userId,
    exercice,
    typeSeq
  )

  if (rows.length === 0) {
    throw new Error('Séquence de facturation introuvable après upsert')
  }

  const { prochain_num, prefixe, format } = rows[0]
  const num = Number(prochain_num)

  // Padding selon format ('%04d' → '0042')
  const widthMatch = /^%0?(\d+)d$/.exec(format)
  const width = widthMatch ? parseInt(widthMatch[1], 10) : 4
  const numero = `${prefixe}${String(num).padStart(width, '0')}`

  // Incrément
  await tx.$executeRawUnsafe(
    `UPDATE sequences_facture SET prochain_num = prochain_num + 1, updated_at = NOW()
     WHERE user_id = $1 AND exercice = $2 AND type = $3`,
    userId,
    exercice,
    typeSeq
  )

  return { numero, prefixe }
}

/** Map type métier ('facture'|'avoir'|'acompte') → type séquence. */
function typeSequence(typeFacture: string): 'FACTURE' | 'AVOIR' | 'DEVIS' {
  if (typeFacture === 'avoir') return 'AVOIR'
  if (typeFacture === 'devis') return 'DEVIS'
  return 'FACTURE' // facture, acompte
}

// POSTREVIEW — Re-exports nominaux utilisés par PATCH /api/comptabilite/factures
// pour la transition brouillon → émise. Les fonctions internes restent privées
// dans creerFacture ; ces alias publient l'API minimale nécessaire.
export const reserverProchainNumeroForEmission = reserverProchainNumero
export const snapshotEmetteurForEmission = snapshotEmetteur

/**
 * Audit compta 2026-06 — annulation symétrique source métier ↔ facture.
 * Appelé quand une source facturée (vente élevage, abattage, récolte, bois)
 * est annulée, dé-vendue ou supprimée. Règles :
 *   - facture déjà annulée → ok
 *   - facture brouillon/émise non payée → annulée ici même
 *   - facture payée → ok seulement si un avoir non annulé y est rattaché
 *     (factureOrigineId) ; sinon refus — l'utilisateur doit émettre un avoir.
 * Sans cette symétrie, la facture restait comptée dans KPI/TVA/FEC alors que
 * la vente n'existait plus (CA fantôme), ou la vente disparaissait du FEC.
 */
export async function annulerFactureLiee(
  db: PrismaTx,
  userId: string,
  factureId: number
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const facture = await db.facture.findFirst({
    where: { id: factureId, userId },
    select: { id: true, numero: true, statut: true },
  })
  if (!facture || facture.statut === 'annulee') return { ok: true }

  if (facture.statut === 'payee') {
    const avoir = await db.facture.findFirst({
      where: { userId, type: 'avoir', factureOrigineId: factureId, statut: { not: 'annulee' } },
      select: { id: true },
    })
    if (!avoir) {
      return {
        ok: false,
        raison: `La facture ${facture.numero} liée à cette vente est payée : émettez d'abord un avoir depuis Comptabilité > Factures.`,
      }
    }
    return { ok: true }
  }

  await db.facture.update({
    where: { id: facture.id },
    data: { statut: 'annulee' },
  })
  return { ok: true }
}

/**
 * Crée une facture dans une transaction Prisma.
 * Gère la numérotation séquentielle avec lock FOR UPDATE (PROMPT 14B).
 */
export async function creerFacture(tx: PrismaTx, params: CreerFactureParams) {
  const date = params.date || new Date()
  // Audit compta 2026-06 : la numérotation est chronologique à l'ÉMISSION
  // (art. 242 nonies A) — l'exercice du numéro est celui du jour d'émission,
  // pas celui de la date métier (sinon facturer en juin 2026 une vente de
  // décembre 2025 rouvrait la séquence F-2025 après coup).
  const exercice = new Date().getFullYear()
  const typeSeq = typeSequence(params.type)
  const statut = params.statut || 'emise'

  // POSTREVIEW — Un brouillon ne doit PAS consommer un numéro de séquence,
  // sinon le supprimer crée un trou (viole art. 242 nonies A : numérotation
  // chronologique sans rupture). On lui assigne un numéro temporaire BR-<cuid>
  // remplacé lors de la transition brouillon → émise dans PATCH /factures.
  let numero: string
  if (statut === 'brouillon') {
    numero = `BR-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  } else {
    const reserved = await reserverProchainNumero(tx, params.userId, exercice, typeSeq)
    numero = reserved.numero
  }

  let clientNom = params.clientNom || 'Client anonyme'
  let clientAdresse = params.clientAdresse || null
  // Sécurité multi-tenant (audit compta 2026-06) : clientId n'est lié à la
  // facture que si la fiche appartient à l'utilisateur. Sinon GET /factures
  // et le PDF exposeraient le nom/SIRET/TVA intra du client d'un autre compte.
  let clientId: number | null = null
  let clientExonere = false

  if (params.clientId) {
    const client = await tx.client.findFirst({
      where: { id: params.clientId, userId: params.userId },
    })
    if (client) {
      clientId = client.id
      clientNom = client.nom
      clientAdresse = [client.adresse, client.codePostal, client.ville].filter(Boolean).join(', ')
      clientExonere = client.exonererTVA
    }
  }

  const emetteur = await snapshotEmetteur(tx, params.userId)

  // Audit compta 2026-06 : un émetteur en franchise en base (art. 293 B) ne
  // facture PAS de TVA (TVA facturée à tort = TVA due, art. 283-3 CGI) ;
  // idem pour un client exonéré. Les lignes sont réécrites à TVA 0 (le TTC
  // saisi devient le HT), quelle que soit la route appelante.
  const sansTva = factureSansTaxe(emetteur?.regimeTva) || clientExonere
  let lignes = params.lignes
  let totalHT = params.totalHT
  let totalTVA = params.totalTVA
  let totalTTC = params.totalTTC
  if (sansTva) {
    lignes = params.lignes.map((l) => ({
      ...l,
      prixUnitaire: l.quantite > 0 ? l.montantTTC / l.quantite : l.montantTTC,
      tauxTVA: 0,
      montantHT: l.montantTTC,
      montantTVA: 0,
    }))
    totalHT = params.totalTTC
    totalTVA = 0
  }

  const totaux = totauxParTaux(lignes)
  const mentions = params.mentionsSpecifiques ?? mentionsParDefaut(emetteur, lignes)

  return tx.facture.create({
    data: {
      userId: params.userId,
      numero,
      type: params.type,
      clientId,
      clientNom,
      clientAdresse,
      date,
      dateEcheance: params.dateEcheance || null,
      objet: params.objet,
      totalHT,
      totalTVA,
      totalTTC,
      totauxParTauxTva: totaux as any,
      statut,
      modePaiement: params.modePaiement || null,
      datePaiement: params.datePaiement || null,
      factureOrigineId: params.factureOrigineId || null,
      mentionsLegales: params.mentionsLegales || null,
      conditionsPaiement: params.conditionsPaiement ?? null,
      mentionsSpecifiques: mentions,
      emetteurSnapshot: emetteur as any,
      notes: params.notes || null,
      lignes: {
        create: lignes.map((l, index) => ({
          ordre: index,
          description: l.description,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          tauxTVA: l.tauxTVA,
          montantHT: l.montantHT,
          montantTVA: l.montantTVA,
          montantTTC: l.montantTTC,
          statutBio: l.statutBio ?? null,
        })),
      },
    },
    include: {
      lignes: true,
      client: true,
    },
  })
}
