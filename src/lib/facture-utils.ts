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

import type { Exploitation, Prisma, PrismaClient } from '@prisma/client'
import { adresseDeFiche, identiteAcheteur } from '@/lib/comptabilite/rattachement-client'
import { factureSansTaxe } from '@/lib/territoires'

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface LigneFactureInput {
  articleStockType?: string | null
  articleStockId?: string | null
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
  cleCreationStock?: string | null
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
  // Facturation électronique, lot 1 (2026-10-13) : catégorie de l'opération
  // (défaut biens) et livraison si elle diffère de la facture.
  categorieOperation?: string | null
  dateLivraison?: Date | null
  adresseLivraison?: string | null
  codePostalLivraison?: string | null
  villeLivraison?: string | null
  paysLivraison?: string | null
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
  // Option TVA d'après les débits (BT-8). Absent des snapshots antérieurs au 2026-10-13.
  optionTvaDebits?: boolean
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
  return snapshotDepuisExploitation(e)
}

/** Une seule lecture de l'identité légale pour le snapshot à l'émission et pour les factures sans snapshot (exports). */
export function snapshotDepuisExploitation(e: Exploitation): EmetteurSnapshot {
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
    optionTvaDebits: e.optionTvaDebits,
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
  else if (snapshot?.regimeTva === 'rfa') out.push('rfa')
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
 * initialisée juste après le plus grand numéro déjà utilisé — 1 s'il n'y en a
 * aucun. Le `INSERT ... ON CONFLICT` garantit qu'une transaction concurrente ne
 * créera pas de doublon : le second arrivant trouvera la ligne et la
 * verrouillera après la première transaction.
 */
async function reserverProchainNumero(
  tx: PrismaTx,
  userId: string,
  exercice: number,
  typeSeq: 'FACTURE' | 'AVOIR' | 'DEVIS'
): Promise<{ numero: string; prefixe: string }> {
  const prefixeDefaut =
    typeSeq === 'AVOIR' ? `AV-${exercice}-` : typeSeq === 'DEVIS' ? `D-${exercice}-` : `F-${exercice}-`

  // Insert idempotent si la séquence n'existe pas encore pour cet exercice.
  //
  // QA cmsqln4om — l'amorçage était codé en dur à 1, sans jamais regarder les
  // factures déjà présentes. Or les jeux de données semés (prisma/seed-demo.ts)
  // créent F-AAAA-0001 et suivantes sans écrire de ligne de séquence : la
  // première facture émise depuis l'écran réservait donc F-AAAA-0001, violait
  // l'index unique (user_id, numero), et le rollback de la transaction annulait
  // aussi cet INSERT — le compte restait bloqué à l'infini, chaque tentative
  // rejouant la même collision. On amorce sur le plus grand numéro déjà utilisé
  // pour ce couple (utilisateur, préfixe). Le filtre `~ '[0-9]+$'` écarte les
  // numéros temporaires de brouillon (BR-<timestamp>-<n>), et le LIKE sur le
  // préfixe garde les trois séquences (facture / avoir / devis) étanches.
  await tx.$executeRawUnsafe(
    `
    INSERT INTO sequences_facture (id, user_id, exercice, type, prochain_num, prefixe, format, created_at, updated_at)
    SELECT gen_random_uuid()::text, $1, $2, $3,
           COALESCE((SELECT MAX(SUBSTRING(f.numero FROM '([0-9]+)$')::int)
                     FROM factures f
                     WHERE f.user_id = $1
                       AND f.numero LIKE $4 || '%'
                       AND f.numero ~ '[0-9]+$'), 0) + 1,
           $4, '%04d', NOW(), NOW()
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

  // 2026-09-02 — la séquence peut être EN RETARD sur les factures existantes,
  // pas seulement absente. L'amorçage ci-dessus ne regarde les numéros déjà
  // pris qu'à la CRÉATION de la ligne ; une ligne existante était lue telle
  // quelle. Or `prisma/reset-demo.ts` supprimait les factures sans purger la
  // séquence, et le seed recréait des numéros en dur : après chaque reset du
  // compte démo, la première émission violait l'index unique (user_id, numero),
  // le rollback annulait l'incrément, et chaque essai rejouait la même
  // collision — trois 500 d'affilée chez un prospect le 2026-08-12. Le même
  // scénario attend tout compte dont des factures arrivent par import. On lit
  // donc le plus grand numéro déjà utilisé SOUS le verrou, et on repart du
  // maximum des deux : la séquence se recale d'elle-même.
  const dejaPris = await tx.$queryRawUnsafe<Array<{ max_num: number | null }>>(
    `
    SELECT MAX(SUBSTRING(f.numero FROM '([0-9]+)$')::int) AS max_num
    FROM factures f
    WHERE f.user_id = $1
      AND f.numero LIKE $2 || '%'
      AND f.numero ~ '[0-9]+$'
    `,
    userId,
    prefixe
  )
  const num = Math.max(Number(prochain_num), Number(dejaPris[0]?.max_num ?? 0) + 1)

  // Padding selon format ('%04d' → '0042')
  const widthMatch = /^%0?(\d+)d$/.exec(format)
  const width = widthMatch ? parseInt(widthMatch[1], 10) : 4
  const numero = `${prefixe}${String(num).padStart(width, '0')}`

  // Le prochain numéro suit celui qu'on vient d'attribuer (et non l'ancien
  // compteur + 1, qui perpétuerait le retard).
  await tx.$executeRawUnsafe(
    `UPDATE sequences_facture SET prochain_num = $4, updated_at = NOW()
     WHERE user_id = $1 AND exercice = $2 AND type = $3`,
    userId,
    exercice,
    typeSeq,
    num + 1
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
 *   - facture non payée sans avoir émis → annulée ici même
 *   - facture payée ou déjà créditée → avoirs émis couvrant le total requis ;
 *     facture et avoirs conservés pour que leur revenu net reste nul.
 * Sans cette symétrie, la facture restait comptée dans KPI/TVA/FEC alors que
 * la vente n'existait plus (CA fantôme), ou la vente disparaissait du FEC.
 */
export async function montantAvoirsEmis(db: Pick<PrismaTx, 'facture'>, userId: string, factureId: number) {
  const avoirs = await db.facture.aggregate({
    where: { userId, type: 'avoir', factureOrigineId: factureId, statut: { in: ['emise', 'payee'] } },
    _sum: { totalTTC: true },
  })
  return avoirs._sum.totalTTC ?? 0
}

export async function annulerFactureLiee(
  db: PrismaTx,
  userId: string,
  factureId: number
): Promise<{ ok: true } | { ok: false; raison: string }> {
  await db.$queryRaw`SELECT id FROM factures WHERE id = ${factureId} AND user_id = ${userId} FOR UPDATE`
  const facture = await db.facture.findFirst({
    where: { id: factureId, userId },
    select: { id: true, numero: true, statut: true, totalTTC: true },
  })
  if (!facture || facture.statut === 'annulee') return { ok: true }

  const credite = await montantAvoirsEmis(db, userId, factureId)
  if (facture.statut === 'payee' || credite > 0) {
    if (credite < facture.totalTTC - 0.005) {
      return {
        ok: false,
        raison: `La facture ${facture.numero} liée à cette vente est payée ou déjà corrigée par un avoir : émettez d'abord un ou plusieurs avoirs couvrant son montant total depuis Comptabilité > Factures. Un brouillon ou un avoir partiel ne permet pas d'annuler toute la vente.`,
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
  // Facturation électronique : l'identité de l'acheteur (SIRET, SIREN BT-47,
  // TVA intracommunautaire BT-48) est figée sur la facture, comme l'émetteur.
  let clientSiret: string | null = null
  let clientSiren: string | null = null
  let clientTvaIntra: string | null = null

  if (params.clientId) {
    const client = await tx.client.findFirst({
      where: { id: params.clientId, userId: params.userId },
    })
    if (client) {
      clientId = client.id
      clientNom = client.nom
      // La fiche fait foi ; sans adresse sur la fiche, celle saisie sur la
      // facture est gardée plutôt que remplacée par une chaîne vide.
      clientAdresse = adresseDeFiche(client) || clientAdresse
      clientExonere = client.exonererTVA
      ;({ clientSiret, clientSiren, clientTvaIntra } = identiteAcheteur(client))
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
  const totalTTC = params.totalTTC
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
      totauxParTauxTva: totaux,
      statut,
      modePaiement: params.modePaiement || null,
      datePaiement: params.datePaiement || null,
      factureOrigineId: params.factureOrigineId || null,
      mentionsLegales: params.mentionsLegales || null,
      conditionsPaiement: params.conditionsPaiement ?? null,
      mentionsSpecifiques: mentions,
      // Json? : `null` (pas d'exploitation) est passé tel quel, comme avant.
      emetteurSnapshot: emetteur as unknown as Prisma.InputJsonValue,
      clientSiret,
      clientSiren,
      clientTvaIntra,
      categorieOperation: params.categorieOperation || 'biens',
      dateLivraison: params.dateLivraison || null,
      adresseLivraison: params.adresseLivraison || null,
      codePostalLivraison: params.codePostalLivraison || null,
      villeLivraison: params.villeLivraison || null,
      paysLivraison: params.paysLivraison || null,
      notes: params.notes || null,
      cleCreationStock: params.cleCreationStock || null,
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
          articleStockType: l.articleStockType ?? null,
          articleStockId: l.articleStockId ?? null,
        })),
      },
    },
    include: {
      lignes: true,
      client: true,
    },
  })
}
