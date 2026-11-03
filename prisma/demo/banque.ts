/**
 * Banque : un compte courant de relevés (CSV), joué en dernier.
 *
 * Le relevé est importé par `importerReleve`, la fonction de l'import CSV de
 * l'application (opérations « releve », comptabilisées, datées à midi, une
 * référence unique par ligne) — sans trace d'import ni Stripe : la démo
 * refuse les imports, le visiteur rapproche mais n'importe pas. Chaque
 * règlement prévu par le commerce est ensuite rapproché par
 * `rapprocherOperation` (règlement daté et référencé par l'opération, pièce
 * soldée, facture « payée », commande boutique confirmée). Restent pour le
 * visiteur trois opérations récentes : le virement d'une facture échue, un
 * virement de commande boutique et le dernier prélèvement d'électricité,
 * tous deux déjà pointés payés ; et une opération exclue avec son motif
 * (apport en compte courant d'associé, hors recettes).
 */

import { importerReleve, rapprocherOperation } from "../../src/lib/comptabilite/banque/service"
import { verrouillerReglements } from "../../src/lib/comptabilite/verrou-reglements"
import { IDENTITE, journal, prisma, type Contexte } from "./contexte"
import { centimes, ilYaIso, isoPlus, ouvrePrecedent, ouvreSuivant, texteMontant, type ModeBancaire, type OperationPrevue, type PartageCommerce } from "./commerce-outils"

const ASSOCIE = IDENTITE.exploitants.split(" et ").at(-1) ?? IDENTITE.exploitants
const MOTIF_APPORT = `Apport en compte courant d'associé (${ASSOCIE}) : ni recette ni règlement de pièce, à passer en opération diverse par le cabinet comptable.`

const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
const MODES_BANCAIRES = ["Virement", "CB", "Prélèvement"]

/**
 * Ventes et charges des autres ateliers déjà pointées payées par virement,
 * carte ou prélèvement : leur mouvement figure aussi sur le relevé, et on le
 * rapproche. Les chèques et espèces (AMAP, marché, ventes directes du verger)
 * restent comme leurs modules les ont saisis. Les acomptes de réservation se
 * suivent dans leur atelier ; les commandes boutique sont réglées par le
 * commerce.
 */
async function mouvementsDesAteliers(userId: string, depuis: Date): Promise<OperationPrevue[]> {
  const hier = ilYaIso(1)
  const suivies = new Set((await prisma.cibleReglement.findMany({ where: { userId }, select: { cle: true } })).map((c) => c.cle))
  const ventes = await prisma.venteManuelle.findMany({ where: { userId, auto: true, paye: true, modeReglement: { in: MODES_BANCAIRES }, date: { gte: depuis }, sourceType: { notIn: ["commande_boutique", "reservation_elevage"] } } })
  const depenses = await prisma.depenseManuelle.findMany({ where: { userId, auto: true, comptable: true, paye: true, modeReglement: { in: MODES_BANCAIRES }, date: { gte: depuis } } })
  const out: OperationPrevue[] = []
  const jourDe = (d: Date) => { const j = ouvreSuivant(isoPlus(d.toISOString().slice(0, 10), 1)); return j > hier ? ouvrePrecedent(hier) : j }
  for (const v of ventes) {
    const cle = JSON.stringify(["vente", v.sourceType, v.sourceRef != null && v.sourceId == null ? "ref" : "id", String(v.sourceId ?? v.sourceRef)])
    if (suivies.has(cle) || v.sourceId == null || v.montant <= 0) continue
    const cible = v.sourceType === "vente_produit" ? { type: "VenteProduit" as const, id: v.sourceId } : { type: "VenteManuelle" as const, id: v.id }
    out.push({ jour: jourDe(v.date), libelle: `${v.modeReglement === "CB" ? "REMISE CB" : "VIR SEPA RECU"} ${sansAccent(v.clientNom ?? v.description).slice(0, 60)}`, centimes: centimes(v.montant),
      reglements: [{ cible, centimes: centimes(v.montant), mode: v.modeReglement as ModeBancaire }] })
  }
  for (const d of depenses) {
    const cle = JSON.stringify(["depense", d.sourceType, d.sourceRef != null && d.sourceId == null ? "ref" : "id", String(d.sourceId ?? d.sourceRef)])
    if (suivies.has(cle) || d.montant <= 0) continue
    out.push({ jour: jourDe(d.date), libelle: `${d.modeReglement === "Prélèvement" ? "PRLV SEPA" : d.modeReglement === "CB" ? "CB" : "VIR SEPA EMIS"} ${sansAccent(d.fournisseurNom ?? d.description).slice(0, 60)}`, centimes: -centimes(d.montant),
      reglements: [{ cible: { type: "DepenseManuelle", id: d.id }, centimes: centimes(d.montant), mode: d.modeReglement as ModeBancaire }] })
  }
  return out
}

export async function seedBanque(ctx: Contexte): Promise<void> {
  const { userId } = ctx
  const plan = (ctx.partage.commerce as PartageCommerce | undefined) ?? { operations: [] }
  const debutReleve = new Date(Date.UTC(new Date(`${ilYaIso(1)}T12:00:00Z`).getUTCFullYear() - 1, 0, 1))
  const operations: OperationPrevue[] = [
    ...plan.operations,
    ...(await mouvementsDesAteliers(userId, debutReleve)),
    { jour: ouvrePrecedent(ilYaIso(24)), libelle: `VIR SEPA RECU ${sansAccent(ASSOCIE)} APPORT COMPTE COURANT ASSOCIE`, centimes: 300000, reglements: [], exclusion: MOTIF_APPORT },
  ].sort((a, b) => a.jour.localeCompare(b.jour) || b.centimes - a.centimes)

  const compte = await prisma.compteBancaire.create({ data: { userId, nom: `Compte courant ${IDENTITE.banque}`, devise: "EUR" } })
  // Références de banque uniques, dans l'ordre du relevé.
  const references = new Map<OperationPrevue, string>()
  const parJour = new Map<string, number>()
  for (const op of operations) {
    const n = (parJour.get(op.jour) ?? 0) + 1
    parJour.set(op.jour, n)
    references.set(op, `CA${op.jour.replaceAll("-", "").slice(2)}${String(n).padStart(3, "0")}`)
  }
  const csv = [
    "Date;Libellé;Montant;Référence",
    ...operations.map((op) => `${op.jour};${op.libelle.replaceAll(";", ",")};${op.centimes < 0 ? "-" : ""}${texteMontant(op.centimes).replace(".", ",")};${references.get(op)}`),
  ].join("\n")
  const { importees } = await importerReleve(userId, compte.id, csv)

  const lignes = await prisma.operationBancaire.findMany({ where: { userId, compteId: compte.id }, select: { id: true, referenceExterne: true } })
  const parRef = new Map(lignes.map((l) => [l.referenceExterne, l.id]))
  let rapprochements = 0, laissees = 0
  const refus: string[] = []
  for (const op of operations) {
    const operationId = parRef.get(references.get(op)!)!
    if (op.exclusion) {
      // Même transaction que l'action « exclure » de l'écran Banque.
      await prisma.$transaction(async (db) => {
        await verrouillerReglements(db, userId)
        await db.operationBancaire.update({ where: { id: operationId, userId }, data: { statut: "ignoree", motifExclusion: op.exclusion } })
      })
      continue
    }
    if (op.aRapprocherParLeVisiteur) { laissees++; continue }
    for (const [i, r] of op.reglements.entries()) {
      try {
        await rapprocherOperation(userId, userId, {
          operationId, partie: "principal", cible: r.cible, montant: texteMontant(r.centimes), modeReglement: r.mode,
          cleIdempotence: `demo-releve-${references.get(op)}-${i + 1}`,
        })
        rapprochements++
      } catch (e) {
        refus.push(`${op.libelle} : ${(e as Error).message}`)
      }
    }
  }
  for (const r of refus) console.log(`  · Rapprochement refusé : ${r}`)
  journal(`Banque : ${importees} opérations importées sur « ${compte.nom} », ${rapprochements} règlements rapprochés, ${laissees} opérations à rapprocher par le visiteur, 1 exclue`)
}
