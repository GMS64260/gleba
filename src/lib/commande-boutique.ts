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

type Tx = Prisma.TransactionClient | PrismaClient

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
 * Confirme une commande : décrémente stock + crée VenteManuelle.
 *
 * @param commandeId  id de la CommandeBoutique
 * @param opts        provider/ref pour le snapshot paiement
 * @param tx          optionnel : transaction Prisma parente (composition)
 */
export async function confirmCommandeBoutique(
  commandeId: number,
  opts: { provider?: string; ref?: string; tauxTVA?: number } = {},
  tx: Tx = prisma
): Promise<ConfirmationResult> {
  // Verrou de ligne (audit 2026-07, #4) : sérialise les confirmations
  // concurrentes de la même commande (double-clic / rejeu webhook). Le 2e
  // appel attend le COMMIT du 1er puis relit paiementStatut='Confirmé' →
  // no-op via l'idempotence ci-dessous, au lieu de doubler stock + écriture.
  // (Efficace uniquement dans une transaction ; l'appelant en fournit une.)
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
    throw new Error(`Commande #${commandeId} introuvable`)
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

  // 1) Décrément stock — non bloquant si négatif (cf rapport tech audit A4).
  const stockNegatifs: ConfirmationResult["stockNegatifs"] = []
  for (const ligne of commande.lignes) {
    if (!ligne.produit) continue
    // stockDispo = null → stock illimité, on ignore.
    if (ligne.produit.stockDispo === null) continue

    const stockApres = ligne.produit.stockDispo - ligne.quantite
    await tx.produitBoutique.update({
      where: { id: ligne.produit.id },
      data: { stockDispo: stockApres },
    })
    if (stockApres < 0) {
      stockNegatifs.push({
        produitId: ligne.produit.id,
        nom: ligne.produit.nom,
        stockApres,
      })
      console.warn(
        `[commande-boutique] Stock négatif après commande #${commandeId} : ` +
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

  // Mapping provider → mode_reglement compta.
  const modeReglement = (() => {
    switch (opts.provider) {
      case "Stripe":
      case "SumUp":
        return "CB"
      case "Virement":
        return "Virement"
      case "Manuel":
        return "Espèces"
      default:
        return null
    }
  })()

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
      modeReglement,
      numeroPiece: commande.numero,
      module: "boutique",
      paye: true,
      sourceType: "commande_boutique",
      sourceId: commande.id,
      auto: true,
      clientId,
      clientNom: commande.clientNom,
    },
  })

  // 3) Mise à jour de la commande.
  await tx.commandeBoutique.update({
    where: { id: commande.id },
    data: {
      paiementStatut: "Confirmé",
      paiementProvider: opts.provider ?? commande.paiementProvider ?? "Manuel",
      paiementRef: opts.ref ?? commande.paiementRef,
      venteManuelleId: venteManuelle.id,
      statut: commande.statut === "nouveau" ? "confirmee" : commande.statut,
    },
  })

  return {
    commandeId: commande.id,
    venteManuelleId: venteManuelle.id,
    stockNegatifs,
    alreadyConfirmed: false,
  }
}

/**
 * Annule une commande (paiement annulé / remboursé). Remet le stock si la
 * commande était confirmée. La VenteManuelle est marquée non payée mais pas
 * supprimée (traçabilité comptable).
 */
export async function annulerCommandeBoutique(
  commandeId: number,
  motif: "Annulé" | "Remboursé" = "Annulé",
  tx: Tx = prisma
): Promise<void> {
  const commande = await tx.commandeBoutique.findUnique({
    where: { id: commandeId },
    include: { lignes: { include: { produit: true } } },
  })
  if (!commande) throw new Error(`Commande #${commandeId} introuvable`)

  // Réintégration stock si la commande avait été confirmée.
  if (commande.paiementStatut === "Confirmé") {
    for (const ligne of commande.lignes) {
      if (!ligne.produit || ligne.produit.stockDispo === null) continue
      await tx.produitBoutique.update({
        where: { id: ligne.produit.id },
        data: { stockDispo: ligne.produit.stockDispo + ligne.quantite },
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
