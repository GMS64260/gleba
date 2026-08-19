/**
 * Réparation 2026-08-10 — miroirs de stock d'œufs manquants pour des ventes.
 *
 * QA cmsnokro7 : Production > Œufs (registre par lot, MouvementStockOeuf)
 * affichait 8 079 œufs quand le dashboard et la compta (calculerStockOeufs,
 * VenteProduit) en montraient 5 559. Deux causes :
 *   1. le seed démo crée des VenteProduit type='oeufs' sans jamais écrire le
 *      MouvementStockOeuf miroir (2 520 œufs vendus invisibles du registre) ;
 *   2. quantiteOeufsVendus ne connaissait que unité/douzaine — corrigé dans
 *      src/lib/elevage/stock-oeufs-vente.ts (table OEUFS_PAR_UNITE partagée).
 *
 * Ce script rejoue synchroniserStockOeufsVente (la vraie fonction de l'API)
 * pour chaque vente d'œufs non annulée qui n'a pas encore son marqueur de
 * mouvement, en FIFO sur les lots commercialisables à la date de vente.
 * Une vente insuffisamment couverte (stock commercialisable trop vieux à sa
 * date) est signalée et sautée, jamais partiellement écrite (transaction).
 *
 * Usage :
 *   npx tsx --env-file=.env scripts/repare-mouvements-oeufs-ventes.ts [--apply] [--user <id>]
 *
 * Sans `--apply`, n'écrit rien et détaille ce qu'il ferait.
 */

import prisma from "../src/lib/prisma"
import {
  marqueurVenteOeufs,
  quantiteOeufsVendus,
  synchroniserStockOeufsVente,
  StockOeufsVenteError,
} from "../src/lib/elevage/stock-oeufs-vente"
import { statutLotOeufs, stockRestantLotOeufs } from "../src/lib/elevage/stock-oeufs"

/**
 * Mode --tolerant : la synchro stricte refuse de vendre hors lots
 * « commercialisables » à la date de vente ; or une vente HISTORIQUE a bien eu
 * lieu, DCR ou pas — l'invariant à rétablir est Σ mouvements = Σ ventes.
 * On ventile alors en FIFO sur tous les lots restants, commercialisables
 * d'abord, puis les autres (à consommer, DCR dépassée).
 */
async function synchroniserTolerant(
  tx: Parameters<typeof synchroniserStockOeufsVente>[0],
  input: { userId: string; venteId: number; date: Date; oeufs: number },
): Promise<void> {
  const marqueur = marqueurVenteOeufs(input.venteId)
  await tx.mouvementStockOeuf.deleteMany({
    where: { userId: input.userId, type: "vente", notes: { startsWith: marqueur } },
  })
  const productions = await tx.productionOeuf.findMany({
    where: { userId: input.userId, date: { lte: input.date } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: { mouvementsStock: { select: { quantite: true } } },
  })
  const parPreference = [
    productions.filter((p) => statutLotOeufs(p.date, input.date) === "commercialisable"),
    productions.filter((p) => statutLotOeufs(p.date, input.date) !== "commercialisable"),
  ]
  let restant = input.oeufs
  for (const groupe of parPreference) {
    for (const production of groupe) {
      if (restant === 0) return
      const disponible = stockRestantLotOeufs({
        quantite: production.quantite,
        casses: production.casses,
        sales: production.sales,
        sorties: production.mouvementsStock,
      })
      if (disponible <= 0) continue
      const sortie = Math.min(disponible, restant)
      await tx.mouvementStockOeuf.create({
        data: {
          userId: input.userId,
          productionId: production.id,
          date: input.date,
          type: "vente",
          quantite: sortie,
          notes: `${marqueur} Reprise 2026-08-10 — miroir de vente reconstruit (mode tolérant)`,
        },
      })
      restant -= sortie
    }
  }
  if (restant > 0) {
    throw new StockOeufsVenteError(
      `Même en mode tolérant, il manque ${restant} œuf(s) de stock pour la vente #${input.venteId}.`,
      409,
    )
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const tolerant = process.argv.includes("--tolerant")
  const userIndex = process.argv.indexOf("--user")
  const userFiltre = userIndex !== -1 ? process.argv[userIndex + 1] : undefined

  const ventes = await prisma.venteProduit.findMany({
    where: {
      type: "oeufs",
      annule: { not: true },
      ...(userFiltre ? { userId: userFiltre } : {}),
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true, userId: true, date: true, quantite: true, unite: true },
  })

  let deja = 0
  let aCreer = 0
  let crees = 0
  let sautes = 0

  for (const vente of ventes) {
    const marqueur = marqueurVenteOeufs(vente.id)
    const existants = await prisma.mouvementStockOeuf.count({
      where: { userId: vente.userId, type: "vente", notes: { startsWith: marqueur } },
    })
    if (existants > 0) {
      deja++
      continue
    }

    let oeufs: number
    try {
      oeufs = quantiteOeufsVendus(vente.quantite, vente.unite ?? "unite")
    } catch (e) {
      console.log(
        `SKIP vente #${vente.id} (${vente.userId}) : unité « ${vente.unite} » non convertible — ${e instanceof Error ? e.message : e}`,
      )
      sautes++
      continue
    }

    aCreer++
    console.log(
      `${apply ? "CREATE" : "DRY"} vente #${vente.id} (${vente.userId}) ${vente.date.toISOString().slice(0, 10)} : ${vente.quantite} ${vente.unite} = ${oeufs} œufs`,
    )
    if (!apply) continue

    try {
      await prisma.$transaction(async (tx) => {
        if (tolerant) {
          await synchroniserTolerant(tx, {
            userId: vente.userId,
            venteId: vente.id,
            date: vente.date,
            oeufs,
          })
        } else {
          await synchroniserStockOeufsVente(tx, {
            userId: vente.userId,
            venteId: vente.id,
            date: vente.date,
            quantite: vente.quantite,
            unite: vente.unite ?? "unite",
          })
        }
      })
      crees++
    } catch (e) {
      if (e instanceof StockOeufsVenteError) {
        console.log(`SKIP vente #${vente.id} : ${e.message}`)
        sautes++
      } else {
        throw e
      }
    }
  }

  console.log(
    `\nBilan : ${ventes.length} ventes d'œufs, ${deja} déjà tracées, ${apply ? `${crees} synchronisées` : `${aCreer} à synchroniser`}, ${sautes} sautées.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
