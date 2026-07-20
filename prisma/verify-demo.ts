/**
 * Vérification des invariants du compte démo (cf. docs/demo-scenario.md).
 * Réplique la SSOT (src/lib/kpi/compta.ts) et la ventilation par module
 * (src/app/api/comptabilite/stats) pour contrôler la cohérence, l'équilibre
 * comptable par écriture, les volumes et l'absence de pollution.
 *
 * Usage : npx tsx prisma/verify-demo.ts   (honore DEMO_EMAIL_OVERRIDE)
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"
const r2 = (n: number) => Math.round(n * 100) / 100
let ok = true
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`)
  if (!cond) ok = false
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true, name: true } })
  if (!user) { console.log(`❌ Compte ${DEMO_EMAIL} introuvable`); process.exit(1) }
  const userId = user.id
  const Y = new Date().getFullYear()
  const asOf = new Date()
  const soy = new Date(Y, 0, 1), eoy = new Date(Y, 11, 31, 23, 59, 59)
  console.log(`▶ Vérification démo « ${user.name} » (${DEMO_EMAIL}) — année ${Y}\n`)

  // ── SSOT (getKpiCompta) ──
  const vmYtd = (await prisma.venteManuelle.aggregate({ where: { userId, date: { gte: soy, lte: asOf } }, _sum: { montant: true } }))._sum.montant ?? 0
  const facs = await prisma.facture.findMany({ where: { userId, date: { gte: soy, lte: asOf }, statut: { notIn: ["annulee", "brouillon"] } }, select: { type: true, totalTTC: true } })
  const facTTC = facs.reduce((s, f) => s + (f.type === "avoir" ? -1 : 1) * f.totalTTC, 0)
  const ssotRev = r2(vmYtd + facTTC)
  const ssotDep = r2((await prisma.depenseManuelle.aggregate({ where: { userId, date: { gte: soy, lte: asOf } }, _sum: { montant: true } }))._sum.montant ?? 0)

  // ── Ventilation modules (stats/route.ts, année pleine) ──
  const vpElevage = (await prisma.venteProduit.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, annule: false }, _sum: { prixTotal: true } }))._sum.prixTotal ?? 0
  const abat = (await prisma.abattage.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, destination: "vente", prixVente: { not: null }, annule: false }, _sum: { prixVente: true } }))._sum.prixVente ?? 0
  const raFruits = await prisma.recolteArbre.findMany({ where: { userId, date: { gte: soy, lte: eoy }, prixKg: { not: null }, statut: "vendu" }, select: { quantite: true, prixKg: true } })
  const revFruits = raFruits.reduce((s, r) => s + r.quantite * (r.prixKg || 0), 0)
  const bois = (await prisma.productionBois.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, prixVente: { not: null }, OR: [{ statut: "vendu" }, { destination: { in: ["vente", "Vente"] } }] }, _sum: { prixVente: true } }))._sum.prixVente ?? 0
  const recVendu = await prisma.recolte.findMany({ where: { userId, statut: "vendu", dateVente: { gte: soy, lte: eoy }, prixTotal: { not: null } }, select: { quantite: true, prixKg: true, prixTotal: true } })
  const revPotager = recVendu.reduce((s, r) => s + (r.prixTotal || r.quantite * (r.prixKg || 0)), 0)
  const vmNonAuto = (await prisma.venteManuelle.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, auto: { not: true } }, _sum: { montant: true } }))._sum.montant ?? 0
  const vmLegumes = (await prisma.venteManuelle.groupBy({ by: ["categorie"], where: { userId, date: { gte: soy, lte: eoy }, auto: { not: true }, categorie: "legumes" }, _sum: { montant: true } })).reduce((s, g) => s + (g._sum.montant || 0), 0)
  const modRev = {
    elevage: vpElevage + abat,
    verger: revFruits + bois,
    potager: revPotager + vmLegumes,
    autre: vmNonAuto - vmLegumes,
  }
  const sumModRev = r2(modRev.elevage + modRev.verger + modRev.potager + modRev.autre)

  // Dépenses modules
  const soins = (await prisma.soinAnimal.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, cout: { not: null } }, _sum: { cout: true } }))._sum.cout ?? 0
  const conso = await prisma.consommationAliment.findMany({ where: { userId, date: { gte: soy, lte: eoy } }, include: { aliment: { select: { prix: true } } } })
  const depAliments = conso.reduce((s, c) => s + c.quantite * (c.aliment.prix || 0), 0)
  const achatsLots = (await prisma.lotAnimaux.aggregate({ where: { userId, dateArrivee: { gte: soy, lte: eoy }, prixAchatTotal: { not: null } }, _sum: { prixAchatTotal: true } }))._sum.prixAchatTotal ?? 0
  const achatsAnimaux = (await prisma.animal.aggregate({ where: { userId, dateArrivee: { gte: soy, lte: eoy }, prixAchat: { not: null } }, _sum: { prixAchat: true } }))._sum.prixAchat ?? 0
  const ops = (await prisma.operationArbre.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, cout: { not: null } }, _sum: { cout: true } }))._sum.cout ?? 0
  const achatsArbres = (await prisma.arbre.aggregate({ where: { userId, prixAchat: { not: null }, OR: [{ dateAchat: { gte: soy, lte: eoy } }, { datePlantation: { gte: soy, lte: eoy }, dateAchat: null }] }, _sum: { prixAchat: true } }))._sum.prixAchat ?? 0
  const fert = await prisma.fertilisation.findMany({ where: { userId, date: { gte: soy, lte: eoy } }, include: { fertilisant: { select: { prix: true } } } })
  const depFert = fert.reduce((s, f) => s + f.quantite * (f.fertilisant.prix || 0), 0)
  const dmNonAuto = (await prisma.depenseManuelle.aggregate({ where: { userId, date: { gte: soy, lte: eoy }, auto: { not: true } }, _sum: { montant: true } }))._sum.montant ?? 0
  const sumModDep = r2((soins + depAliments + achatsLots + achatsAnimaux) + (ops + achatsArbres) + depFert + dmNonAuto)

  console.log("── Comptabilité (cohérence SSOT ↔ modules) ──")
  console.log(`  Revenus SSOT=${ssotRev}€  Σmodules=${sumModRev}€  (élevage ${r2(modRev.elevage)} / verger ${r2(modRev.verger)} / potager ${r2(modRev.potager)} / autre ${r2(modRev.autre)})`)
  console.log(`  Dépenses SSOT=${ssotDep}€  Σmodules=${sumModDep}€`)
  check("coherenceCheck revenus = 0 (pas de bandeau)", Math.abs(ssotRev - sumModRev) < 0.01, `écart=${r2(ssotRev - sumModRev)}€`)
  check("coherenceCheck dépenses = 0 (pas de bandeau)", Math.abs(ssotDep - sumModDep) < 0.01, `écart=${r2(ssotDep - sumModDep)}€`)
  check("bénéfice YTD positif", ssotRev - ssotDep > 0, `${r2(ssotRev - ssotDep)}€`)

  // ── Équilibre par écriture (TTC = HT + TVA au centime) ──
  const vms = await prisma.venteManuelle.findMany({ where: { userId }, select: { montant: true, montantHT: true, montantTVA: true } })
  const dms = await prisma.depenseManuelle.findMany({ where: { userId }, select: { montant: true, montantHT: true, montantTVA: true } })
  const facAll = await prisma.facture.findMany({ where: { userId }, select: { totalHT: true, totalTVA: true, totalTTC: true } })
  const vmBad = vms.filter((v) => v.montantHT != null && v.montantTVA != null && Math.abs(v.montant - (r2(v.montantHT!) + r2(v.montantTVA!))) >= 0.005).length
  const dmBad = dms.filter((v) => v.montantHT != null && v.montantTVA != null && Math.abs(v.montant - (r2(v.montantHT!) + r2(v.montantTVA!))) >= 0.005).length
  const facBad = facAll.filter((f) => Math.abs(f.totalTTC - (r2(f.totalHT) + r2(f.totalTVA))) >= 0.005).length
  console.log("\n── Équilibre comptable (FEC) ──")
  check("VenteManuelle : TTC = HT + TVA au centime", vmBad === 0, `${vmBad} écriture(s) déséquilibrée(s)`)
  check("DepenseManuelle : TTC = HT + TVA au centime", dmBad === 0, `${dmBad}`)
  check("Facture : TTC = HT + TVA au centime", facBad === 0, `${facBad}`)

  // ── Exploitation / FEC ──
  const exp = await prisma.exploitation.findUnique({ where: { userId } })
  check("Exploitation configurée", !!exp)
  check("SIREN valide (9 chiffres)", /^\d{9}$/.test(exp?.siren || ""), exp?.siren || "")
  check("Territoire METROPOLE (FEC applicable)", exp?.territoire === "METROPOLE")
  check("Régime réel + TVA", exp?.regimeTva !== "franchise-293b", exp?.regimeTva || "")

  // ── Volumes / modules peuplés ──
  const counts = {
    parcelles: await prisma.parcelleGeo.count({ where: { userId } }),
    planches: await prisma.planche.count({ where: { userId } }),
    cultures: await prisma.culture.count({ where: { userId } }),
    recoltes: await prisma.recolte.count({ where: { userId } }),
    arbres: await prisma.arbre.count({ where: { userId } }),
    recoltesArbre: await prisma.recolteArbre.count({ where: { userId } }),
    animaux: await prisma.animal.count({ where: { userId } }),
    lots: await prisma.lotAnimaux.count({ where: { userId } }),
    oeufs: await prisma.productionOeuf.count({ where: { userId } }),
    collectesLait: await prisma.collecteLait.count({ where: { userId } }),
    lotsFromage: await prisma.lotFromage.count({ where: { userId } }),
    saillies: await prisma.saillie.count({ where: { userId } }),
    campagnesRepro: await prisma.campagneReproduction.count({ where: { userId } }),
    naissances: await prisma.naissanceAnimale.count({ where: { userId } }),
    ventesProduit: await prisma.venteProduit.count({ where: { userId } }),
    factures: await prisma.facture.count({ where: { userId } }),
    clients: await prisma.client.count({ where: { userId } }),
    commandes: await prisma.commandeBoutique.count({ where: { userId } }),
  }
  console.log("\n── Volumes ──")
  console.log("  " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "))
  check("Caprin : collectes lait peuplées (P20/P21)", counts.collectesLait > 200)
  check("Caprin : fromagerie peuplée (P27)", counts.lotsFromage >= 3)
  check("Caprin : campagne repro + saillies (P23/P24)", counts.campagnesRepro >= 1 && counts.saillies >= 4)
  check("Verger : arbres + récoltes fruits", counts.arbres >= 12 && counts.recoltesArbre >= 2)
  check("Compta : factures B2B", counts.factures >= 2)
  check("Boutique : commandes", counts.commandes >= 10)

  // ── Intégrité / pollution ──
  const orphelines = await prisma.culture.count({ where: { userId, plancheId: null } })
  const varietesNS = await prisma.culture.count({ where: { userId, variete: { is: { id: { contains: "Non spécifiée" } } } } })
  const anneesCultures = (await prisma.culture.groupBy({ by: ["annee"], where: { userId } })).map((g) => g.annee)
  const junkParc = await prisma.parcelleGeo.count({ where: { userId, NOT: { nom: { startsWith: "Demo-" } } } })
  const junkPlanche = await prisma.planche.count({ where: { userId, nom: { in: ["12", "12-copie", "Fff", "Planche 1", "cc", "Rang 01"] } } })
  console.log("\n── Intégrité / dé-pollution ──")
  check("0 culture orpheline (sans planche)", orphelines === 0)
  check("0 variété « Non spécifiée »", varietesNS === 0)
  check("Cultures uniquement année courante", anneesCultures.every((a) => a === Y), `années=${anneesCultures.join(",")}`)
  check("Parcelles : uniquement Demo-*", junkParc === 0, `${junkParc} parcelle(s) hors scénario`)
  check("Planches : aucun nom de test", junkPlanche === 0)

  // ── Historique N-1 ──
  const vmN1 = await prisma.venteManuelle.count({ where: { userId, date: { gte: new Date(Y - 1, 0, 1), lte: new Date(Y - 1, 11, 31) } } })
  check("Historique N-1 présent (comparatifs)", vmN1 >= 6, `${vmN1} ventes ${Y - 1}`)

  console.log(`\n${ok ? "✅ TOUS LES INVARIANTS OK" : "❌ DES INVARIANTS ONT ÉCHOUÉ"}`)
  if (!ok) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
