/**
 * Commerce de la ferme : charges fournisseurs, boutique en ligne et clients
 * professionnels (devis, bons de livraison, factures, avoir).
 *
 * Le chiffre d'affaires maraîcher (AMAP, marché) et les ventes directes du
 * verger et de l'élevage sont saisis par leurs modules : ce module n'ajoute
 * que la boutique et la facturation des professionnels, en puisant dans les
 * stocks laissés au commerce, et toutes les charges réelles de l'EARL.
 *
 * Les pièces réglées par la banque sont décrites dans `ctx.partage.commerce`
 * et rapprochées par le module banque, joué en dernier.
 */

import { journal, type Contexte } from "./contexte"
import { planBancaire } from "./commerce-outils"
import { seedCharges } from "./commerce-charges"
import { seedBoutique } from "./commerce-boutique"
import { seedB2B } from "./commerce-b2b"

export async function seedCommerce(ctx: Contexte): Promise<void> {
  planBancaire(ctx)
  const charges = await seedCharges(ctx)
  const boutique = await seedBoutique(ctx)
  const b2b = await seedB2B(ctx)
  journal(`Commerce : ${charges.nombre} charges, ${boutique.commandes} commandes boutique, ${b2b.factures} factures et avoirs, ${b2b.documents} devis et bons`)
}
