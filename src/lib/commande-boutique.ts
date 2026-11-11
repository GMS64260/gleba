/**
 * PROMPT 16 LOT B — Câblage Boutique → Compta.
 *
 * Avant ce sprint, une commande boutique se terminait par un email envoyé
 * au producteur. Aucune transaction comptable n'était créée, le stock
 * `ProduitBoutique.stockDispo` n'était pas décrémenté, et la commande
 * n'apparaissait pas dans le dashboard compta.
 *
 * Ce helper centralise la transition `paiementStatut = 'Confirmé'` :
 *   1. Décrémente le stock de chaque produit (warning si < 0, jamais bloquant).
 *   2. Crée une VenteManuelle agrégée avec ventilation TVA par taux.
 *   3. Snapshot du statut Bio majoritaire (cf [[statut-bio]]).
 *   4. Marque la commande "confirmée" + `paiementStatut = 'Confirmé'`.
 *
 * Idempotent : si la commande a déjà une `venteManuelleId`, no-op et retourne
 * la vente existante. Permet de rejouer un webhook Stripe sans dupliquer.
 *
 * Note : l'envoi d'email client est délégué à l'appelant (rétro-compat
 * avec /api/boutique/public/[slug]/commande qui gère déjà l'email producteur).
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"
import { ensureClientForUser } from "@/lib/comptabilite/ensure-client"
import { cleSourceReglement } from "@/lib/comptabilite/cle-reglement"
import {
  suiviReglementActif,
  verifierSuppressionSourceReglee,
} from "@/lib/comptabilite/suivi-reglement-source"
import { verrouillerStockCommercial } from "@/lib/stocks/verrou-commercial"

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Refus métier d'une transition de commande (commande annulée, journal de
 * règlements à respecter…). `status` est le code HTTP que la route renvoie.
 */
export class ErreurCommandeBoutique extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
    this.name = "ErreurCommandeBoutique"
  }
}

/** Clé du dossier de règlements de la recette d'une commande (stable). */
const cleReglementCommande = (commandeId: number) =>
  cleSourceReglement("vente", "commande_boutique", commandeId)

/**
 * Verrouille puis relit la commande.
 *
 * Ordre des verrous = celui du journal des règlements et des sorties
 * commerciales : verrous consultatifs du compte d'abord, ligne de la commande
 * ensuite. Avant la revue du 2026-11-11, la ligne était prise en premier, à
 * l'inverse d'un règlement saisi sur la recette (interblocage possible), et le
 * stock de la boutique bougeait hors du verrou des bons de livraison.
 * (Efficace uniquement dans une transaction ; l'appelant en fournit une.)
 */
async function verrouillerCommande(commandeId: number, tx: Tx) {
  const proprietaire = await tx.commandeBoutique.findUnique({
    where: { id: commandeId },
    select: { userId: true },
  })
  if (!proprietaire) {
    throw new ErreurCommandeBoutique(`Commande #${commandeId} introuvable`, 404)
  }
  await verrouillerStockCommercial(tx as Prisma.TransactionClient, proprietaire.userId)
  await tx.$executeRawUnsafe(
    'SELECT id FROM commandes_boutique WHERE id = $1 FOR UPDATE',
    commandeId,
  )
  const commande = await tx.commandeBoutique.findUnique({
    where: { id: commandeId },
    include: {
      lignes: { include: { produit: true } },
    },
  })
  if (!commande) {
    throw new ErreurCommandeBoutique(`Commande #${commandeId} introuvable`, 404)
  }
  return commande
}

export type ConfirmationResult = {
  commandeId: number
  venteManuelleId: number
  stockNegatifs: Array<{ produitId: number; nom: string; stockApres: number }>
  alreadyConfirmed: boolean
}

/**
 * Catégorie de VenteManuelle déduite des produits de la commande.
 * Si une catégorie représente > 50% du panier, on l'utilise ; sinon "autre".
 */
function categorieMajoritaire(
  lignes: Array<{ total: number; produit: { categorie: string | null } | null }>
): string {
  if (lignes.length === 0) return "autre"
  const counts: Record<string, number> = {}
  let totalGlobal = 0
  for (const l of lignes) {
    const cat = l.produit?.categorie ?? "autre"
    counts[cat] = (counts[cat] ?? 0) + l.total
    totalGlobal += l.total
  }
  const [topCat, topVal] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (topVal / totalGlobal >= 0.5) return topCat
  return "autre"
}

/**
 * Statut Bio majoritaire des produits de la commande (cf snapshotStatutBio).
 * Retourne null si aucun produit n'a de statut renseigné.
 */
function statutBioMajoritaire(
  lignes: Array<{ produit: { statutBio: string | null } | null }>
): string | null {
  const counts: Record<string, number> = {}
  for (const l of lignes) {
    const s = l.produit?.statutBio
    if (!s) continue
    counts[s] = (counts[s] ?? 0) + 1
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

/**
 * Mapping provider → mode_reglement compta.
 *
 * « Manuel » dit seulement que le producteur a pointé le paiement lui-même :
 * il ne dit pas comment il a été payé. Il valait « Espèces » jusqu'au
 * 2026-11-11, ce qui inventait un encaissement en caisse pour un chèque ou un
 * virement. Le mode réellement reçu se passe par `opts.modeReglement`.
 */
function modeReglementDepuisProvider(provider?: string): string | null {
  switch (provider) {
    case "Stripe":
    case "SumUp":
      return "CB"
    case "Virement":
      return "Virement"
    default:
      return null
  }
}

/** Mode retenu : celui que l'appelant déclare, sinon celui du provider. */
function modeReglementRetenu(opts: { provider?: string; modeReglement?: string | null }): string | null {
  return opts.modeReglement !== undefined
    ? opts.modeReglement
    : modeReglementDepuisProvider(opts.provider)
}

type CommandeMaterialisable = Prisma.CommandeBoutiqueGetPayload<{
  include: { lignes: { include: { produit: true } } }
}>

/**
 * QA cmsw9bv3s (2026-08-16) — effets « la marchandise sort de la ferme »
 * partagés par la confirmation de paiement ET la livraison : décrément du
 * stock, création de la VenteManuelle (payée ou non selon le contexte),
 * fiche client (ensureClientForUser), liaison venteManuelleId.
 * Ne touche PAS à paiementStatut : l'appelant décide.
 */
async function materialiserVenteCommande(
  commande: CommandeMaterialisable,
  opts: { paye: boolean; provider?: string; modeReglement?: string | null; tauxTVA?: number },
  tx: Tx
): Promise<{ venteManuelleId: number; stockNegatifs: ConfirmationResult["stockNegatifs"] }> {
  // 1) Décrément stock — non bloquant si négatif (cf rapport tech audit A4).
  const stockNegatifs: ConfirmationResult["stockNegatifs"] = []
  for (const ligne of commande.lignes) {
    if (!ligne.produit) continue
    // stockDispo = null → stock illimité, on ignore.
    if (ligne.produit.stockDispo === null) continue

    // L'incrément atomique conserve aussi les débits/retours d'un BL concurrent.
    const actualise = await tx.produitBoutique.update({
      where: { id: ligne.produit.id },
      data: { stockDispo: { decrement: ligne.quantite } },
    })
    const stockApres = actualise.stockDispo ?? 0
    if (stockApres < 0) {
      stockNegatifs.push({
        produitId: ligne.produit.id,
        nom: ligne.produit.nom,
        stockApres,
      })
      console.warn(
        `[commande-boutique] Stock négatif après commande #${commande.id} : ` +
          `${ligne.produit.nom} = ${stockApres} ${ligne.produit.unite}`
      )
    }

    // Audit 2026-07 (#51) : produit issu d'une récolte du jardin et désormais
    // épuisé → on marque la récolte source « vendue » pour cohérence (elle ne
    // doit plus apparaître comme stock loose ni pouvoir être vendue à part).
    // Mise à jour DIRECTE (pas via l'API récolte) pour NE PAS déclencher une
    // 2e écriture comptable : la commande boutique a déjà créé la VenteManuelle.
    if (ligne.produit.recolteId && stockApres <= 0) {
      await tx.recolte.updateMany({
        where: { id: ligne.produit.recolteId, statut: "en_stock" },
        data: { statut: "vendu", dateVente: commande.createdAt },
      })
    }
  }

  // 2) Création VenteManuelle.
  // On considère un seul taux TVA pour le panier (opts.tauxTVA ou 5.5 par défaut).
  // Une ventilation par ligne nécessiterait un sous-modèle dédié, hors scope.
  const tauxTVA = opts.tauxTVA ?? 5.5
  const montantTTC = commande.total
  const montantHT = montantTTC / (1 + tauxTVA / 100)
  const montantTVAEur = montantTTC - montantHT

  const categorie = categorieMajoritaire(commande.lignes)
  const statutBio = statutBioMajoritaire(commande.lignes)
  const description = `Commande boutique ${commande.numero} — ${commande.clientNom}` +
    (statutBio ? ` (${statutBio})` : "")

  // QA 2026-05-15 — Bug #6 : auto-création du client à partir des
  // informations saisies lors de la commande (nom/email/téléphone).
  // Idempotent — pas de doublon si le client existe déjà (match par
  // email puis par nom normalisé).
  const clientId = await ensureClientForUser(
    commande.userId,
    {
      nom: commande.clientNom,
      email: commande.clientEmail,
      telephone: commande.clientTelephone,
    },
    tx
  )

  const venteManuelle = await tx.venteManuelle.create({
    data: {
      userId: commande.userId,
      date: commande.createdAt,
      categorie,
      description,
      quantite: null,
      unite: null,
      prixUnitaire: null,
      tauxTVA,
      montantHT,
      montantTVA: montantTVAEur,
      montant: montantTTC,
      journal: "VE",
      modeReglement: opts.paye ? modeReglementRetenu(opts) : null,
      numeroPiece: commande.numero,
      module: "boutique",
      paye: opts.paye,
      sourceType: "commande_boutique",
      sourceId: commande.id,
      auto: true,
      clientId,
      clientNom: commande.clientNom,
    },
  })

  return { venteManuelleId: venteManuelle.id, stockNegatifs }
}

/**
 * Confirme une commande : décrémente stock + crée VenteManuelle.
 *
 * @param commandeId  id de la CommandeBoutique
 * @param opts        provider/ref pour le snapshot paiement ; `modeReglement`
 *                    = mode réellement reçu (Espèces, Chèque…), `null` si
 *                    l'appelant ne le connaît pas
 * @param tx          optionnel : transaction Prisma parente (composition)
 *
 * Refuse (ErreurCommandeBoutique, 409) une commande annulée, et une commande
 * dont la recette porte déjà des versements au journal des règlements.
 */
export async function confirmCommandeBoutique(
  commandeId: number,
  opts: { provider?: string; modeReglement?: string | null; ref?: string; tauxTVA?: number } = {},
  tx: Tx = prisma
): Promise<ConfirmationResult> {
  // Verrou (audit 2026-07, #4) : sérialise les confirmations concurrentes de
  // la même commande (double-clic / rejeu webhook). Le 2e appel attend le
  // COMMIT du 1er puis relit paiementStatut='Confirmé' → no-op via
  // l'idempotence ci-dessous, au lieu de doubler stock + écriture.
  const commande = await verrouillerCommande(commandeId, tx)

  // Revue du 2026-11-11 : une commande annulée restait encaissable ; la
  // confirmation recréait une recette et un débit de stock sous un statut
  // « annulée ».
  if (commande.statut === "annulee") {
    throw new ErreurCommandeBoutique(
      "Cette commande est annulée : son paiement ne peut plus être confirmé."
    )
  }

  // Idempotence : déjà confirmée → no-op.
  if (commande.paiementStatut === "Confirmé" && commande.venteManuelleId) {
    return {
      commandeId,
      venteManuelleId: commande.venteManuelleId,
      stockNegatifs: [],
      alreadyConfirmed: true,
    }
  }

  // QA cmsw9bv3s (2026-08-16) — la commande a déjà été matérialisée à la
  // LIVRAISON (vente paye=false via livrerCommandeBoutique) : confirmer le
  // paiement se borne à solder l'écriture existante. Ni stock (déjà décrémenté
  // à la livraison), ni nouvelle VenteManuelle. Le repli findFirst couvre les
  // données historiques (seed) où la vente existe sans back-link sur la
  // commande — sans lui, on créerait une écriture en double.
  const venteLiee = commande.venteManuelleId
    ? { id: commande.venteManuelleId }
    : await tx.venteManuelle.findFirst({
        where: {
          userId: commande.userId,
          sourceType: "commande_boutique",
          sourceId: commande.id,
        },
        select: { id: true },
      })
  // Revue du 2026-11-11 : dès qu'un versement est journalisé sur la recette,
  // c'est le journal qui dit ce qui reste dû. Pointer « payé » d'ici déclarait
  // la commande soldée alors que le journal gardait un reste à payer. Le
  // dernier versement saisi dans Règlements confirme la commande de lui-même.
  if (await suiviReglementActif(tx as Prisma.TransactionClient, commande.userId, cleReglementCommande(commande.id))) {
    throw new ErreurCommandeBoutique(
      "Cette commande a déjà des versements enregistrés. Ajoutez le solde depuis Règlements : " +
        "le paiement sera confirmé quand le reste à payer sera à zéro."
    )
  }

  if (venteLiee) {
    const modeReglementConfirmation = modeReglementRetenu(opts)
    await tx.venteManuelle.update({
      where: { id: venteLiee.id },
      data: {
        paye: true,
        ...(modeReglementConfirmation ? { modeReglement: modeReglementConfirmation } : {}),
      },
    })
    await tx.commandeBoutique.update({
      where: { id: commande.id },
      data: {
        paiementStatut: "Confirmé",
        paiementProvider: opts.provider ?? commande.paiementProvider ?? "Manuel",
        paiementRef: opts.ref ?? commande.paiementRef,
        venteManuelleId: venteLiee.id,
      },
    })
    return {
      commandeId: commande.id,
      venteManuelleId: venteLiee.id,
      stockNegatifs: [],
      alreadyConfirmed: false,
    }
  }

  // 1-2) Stock + VenteManuelle payée + fiche client.
  const { venteManuelleId, stockNegatifs } = await materialiserVenteCommande(
    commande,
    { paye: true, provider: opts.provider, modeReglement: opts.modeReglement, tauxTVA: opts.tauxTVA },
    tx
  )

  // 3) Mise à jour de la commande.
  await tx.commandeBoutique.update({
    where: { id: commande.id },
    data: {
      paiementStatut: "Confirmé",
      paiementProvider: opts.provider ?? commande.paiementProvider ?? "Manuel",
      paiementRef: opts.ref ?? commande.paiementRef,
      venteManuelleId,
      statut: commande.statut === "nouveau" ? "confirmee" : commande.statut,
    },
  })

  return {
    commandeId: commande.id,
    venteManuelleId,
    stockNegatifs,
    alreadyConfirmed: false,
  }
}

/**
 * QA cmsw9bv3s (2026-08-16) — une commande passée « livrée » sans confirmation
 * de paiement restait sans écriture comptable ni fiche client : l'écran
 * Transactions synthétisait un revenu que la SSOT, le compte de résultat, la
 * TVA et le FEC ignoraient (écart de 3,20 € constaté), et le client de la
 * commande n'existait pas au répertoire.
 *
 * À la livraison, la marchandise est sortie : on matérialise la vente
 * (paye=false tant que le paiement n'est pas confirmé — le correctif
 * « paiement boutique respecté » du 2026-08-14 reste honoré), le stock est
 * décrémenté et la fiche client créée. La confirmation de paiement ultérieure
 * se borne à solder l'écriture (cf. confirmCommandeBoutique).
 *
 * Idempotent : commande déjà matérialisée (venteManuelleId) → no-op.
 */
export async function livrerCommandeBoutique(
  commandeId: number,
  tx: Tx = prisma
): Promise<ConfirmationResult> {
  // Même verrou que confirmCommandeBoutique : sérialise une livraison et une
  // confirmation de paiement concurrentes sur la même commande.
  const commande = await verrouillerCommande(commandeId, tx)

  // Revue du 2026-11-11 : livrer une commande annulée re-débitait le stock et
  // recréait une recette, le paiement restant « Annulé ».
  if (commande.statut === "annulee") {
    throw new ErreurCommandeBoutique(
      "Cette commande est annulée : elle ne peut plus être livrée. Enregistrez une nouvelle commande."
    )
  }

  if (commande.venteManuelleId) {
    return {
      commandeId,
      venteManuelleId: commande.venteManuelleId,
      stockNegatifs: [],
      alreadyConfirmed: true,
    }
  }

  // Données historiques (seed notamment) : une VenteManuelle de cette commande
  // peut exister SANS que commande.venteManuelleId soit renseigné. La relier
  // au lieu d'en créer une seconde (et de re-décrémenter le stock).
  const venteExistante = await tx.venteManuelle.findFirst({
    where: {
      userId: commande.userId,
      sourceType: "commande_boutique",
      sourceId: commande.id,
    },
    select: { id: true },
  })
  if (venteExistante) {
    await tx.commandeBoutique.update({
      where: { id: commande.id },
      data: { venteManuelleId: venteExistante.id },
    })
    return {
      commandeId: commande.id,
      venteManuelleId: venteExistante.id,
      stockNegatifs: [],
      alreadyConfirmed: true,
    }
  }

  const { venteManuelleId, stockNegatifs } = await materialiserVenteCommande(
    commande,
    { paye: false, provider: commande.paiementProvider ?? undefined },
    tx
  )

  await tx.commandeBoutique.update({
    where: { id: commande.id },
    data: { venteManuelleId },
  })

  return {
    commandeId: commande.id,
    venteManuelleId,
    stockNegatifs,
    alreadyConfirmed: false,
  }
}

/**
 * Annule une commande (paiement annulé / remboursé). Remet le stock si la
 * commande était matérialisée et supprime sa VenteManuelle (cf. audit #10
 * ci-dessous).
 *
 * Refuse (ErreurReglement, 409) tant que la recette porte un versement actif
 * au journal des règlements : il faut d'abord l'annuler ou le rembourser.
 * Idempotent : une commande déjà annulée n'est pas annulée deux fois.
 */
export async function annulerCommandeBoutique(
  commandeId: number,
  motif: "Annulé" | "Remboursé" = "Annulé",
  tx: Tx = prisma
): Promise<void> {
  const commande = await verrouillerCommande(commandeId, tx)

  // Déjà annulée : rien à rendre une seconde fois (l'idempotence ne tenait
  // jusqu'ici qu'à la suppression de la recette).
  if (commande.statut === "annulee") return

  // Revue du 2026-11-11 : l'annulation supprimait la recette sans regarder le
  // journal ; un versement actif restait rattaché à une pièce disparue et ne
  // pouvait plus être annulé. Même garde que pour toute pièce réglée.
  await verifierSuppressionSourceReglee(
    tx as Prisma.TransactionClient,
    commande.userId,
    cleReglementCommande(commande.id),
  )

  // Réintégration stock si la commande avait été matérialisée (paiement
  // confirmé OU livraison — QA cmsw9bv3s : une livrée-non-payée a aussi
  // décrémenté le stock et créé une VenteManuelle à neutraliser).
  if (commande.paiementStatut === "Confirmé" || commande.venteManuelleId) {
    for (const ligne of commande.lignes) {
      if (!ligne.produit || ligne.produit.stockDispo === null) continue
      await tx.produitBoutique.update({
        where: { id: ligne.produit.id },
        data: { stockDispo: { increment: ligne.quantite } },
      })
      // Récolte source remise en stock si elle avait été marquée vendue (cf #51).
      if (ligne.produit.recolteId) {
        await tx.recolte.updateMany({
          where: { id: ligne.produit.recolteId, statut: "vendu" },
          data: { statut: "en_stock", dateVente: null },
        })
      }
    }
    // Audit 2026-07 (#10) : on SUPPRIME la VenteManuelle auto au lieu de la
    // passer paye=false. Le CA (sumVenteManuelle) somme toutes les VenteManuelle
    // sans filtrer `paye` — une commande annulée restait donc comptée dans le
    // chiffre d'affaires. La commande reste tracée (statut='annulee').
    if (commande.venteManuelleId) {
      await tx.venteManuelle.delete({ where: { id: commande.venteManuelleId } })
    }
  }

  await tx.commandeBoutique.update({
    where: { id: commande.id },
    data: {
      paiementStatut: motif,
      statut: "annulee",
    },
  })
}
