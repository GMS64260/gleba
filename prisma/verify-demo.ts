/**
 * Vérification du compte démo « Ferme du Bois Joli » (docs/demo-scenario.md).
 *
 * Lecture seule. Chaque contrôle passe par les fonctions de l'application,
 * jamais par une réimitation de leurs règles : `getKpiCompta` (revenus,
 * dépenses, résultat, créances), `chargerEncoursCompta`, `computeTvaPeriode`,
 * l'export Factur-X (`preparerExportFacture`, `validerFactureStructuree`,
 * `validerCii`), et les routes du compte de résultat et du FEC, appelées
 * avec une session simulée du compte vérifié (le FEC est assemblé dans sa
 * route). S'y ajoutent des contrôles d'intégrité et de dé-pollution.
 *
 * Structure en sections : chaque atelier ajoute la sienne dans `SECTIONS`.
 *
 * Usage : npx tsx prisma/verify-demo.ts   (honore DEMO_EMAIL_OVERRIDE)
 * Sortie : code 0 si tout passe, 1 sinon.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from "../src/lib/prisma"
import { getKpiCompta } from "../src/lib/kpi/compta"
import { chargerEncoursCompta } from "../src/lib/comptabilite/encours"
import { computeTvaPeriode } from "../src/lib/kpi/tva"
import { preparerExportFacture } from "../src/lib/facture-structuree"
import { validerFactureStructuree } from "../src/lib/facture-ubl"
import { validerCii } from "../src/lib/facturx/cii"
import { dateIsoFacture } from "../src/lib/facture-regles"
import { DEMO_EMAIL as DEMO_EMAIL_PAR_DEFAUT } from "../src/lib/demo"

const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || DEMO_EMAIL_PAR_DEFAUT
let echecs = 0
let avertissements = 0
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) echecs++
}
function avertir(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✅" : "⚠️ "} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) avertissements++
}
const r2 = (n: number) => Math.round(n * 100) / 100
const eur = (n: number) => `${r2(n).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`

type Ctx = { userId: string; Y: number; maintenant: Date; aujourdhui: string }
type Routes = ReturnType<typeof routesAvecSession>

/**
 * Les routes du compte de résultat et du FEC lisent la session NextAuth :
 * on leur fournit celle du compte vérifié, en lecture seule, avant de les
 * charger (le module d'authentification réel n'est jamais exécuté).
 */
function routesAvecSession(userId: string) {
  const chemin = require.resolve("../src/lib/auth-utils")
  const session = { user: { id: userId, acteurId: userId, peutEcrireExploitation: false, estProprietaireExploitation: true } }
  require.cache[chemin] = { id: chemin, filename: chemin, loaded: true, exports: { requireAuthApi: async () => ({ session, error: null }) } } as unknown as NodeModule
  const { NextRequest } = require("next/server") as typeof import("next/server")
  const appel = async (route: string, url: string) => {
    const mod = require(route) as { GET: (r: unknown) => Promise<Response> }
    return mod.GET(new NextRequest(`http://verification.local${url}`))
  }
  return {
    stats: (year: number) => appel("../src/app/api/comptabilite/stats/route", `/api/comptabilite/stats?year=${year}`),
    fec: (exercice: number) => appel("../src/app/api/comptabilite/export/fec/route", `/api/comptabilite/export/fec?exercice=${exercice}`),
  }
}

// ─── Sections ───────────────────────────────────────────────────────────────

async function sectionIdentite({ userId }: Ctx) {
  const e = await prisma.exploitation.findUnique({ where: { userId } })
  check("Exploitation configurée (EARL)", e?.formeJuridique === "EARL", e?.raisonSociale ?? "absente")
  check("SIRET 14 chiffres commençant par le SIREN", /^\d{14}$/.test(e?.siret ?? "") && (e?.siret ?? "").startsWith(e?.siren ?? "#"), `${e?.siret} / ${e?.siren}`)
  check("TVA intracommunautaire", /^FR\d{11}$/.test(e?.numeroTvaIntracom ?? ""), e?.numeroTvaIntracom ?? "")
  check("Territoire métropole, réel simplifié avec TVA", e?.territoire === "METROPOLE" && e?.regimeTva === "reel-simplifie", `${e?.territoire} · ${e?.regimeTva}`)
  const modes = JSON.parse((await prisma.userPreference.findUnique({ where: { userId_key: { userId, key: "modesElevage" } } }))?.value ?? "[]") as string[]
  check("Ateliers chiens/chats, équins et NAC activés", ["compagnie", "equin", "nac"].every((m) => modes.includes(m)), modes.join(", "))
}

async function sectionComptabilite({ userId, Y, maintenant, aujourdhui }: Ctx) {
  const kpi = await getKpiCompta(userId, Y, maintenant)
  const marge = kpi.revenusYtd > 0 ? (kpi.beneficeYtd / kpi.revenusYtd) * 100 : 0
  console.log(`  · ${Y} au ${aujourdhui} : revenus ${eur(kpi.revenusYtd)}, dépenses ${eur(kpi.depensesYtd)}, résultat ${eur(kpi.beneficeYtd)}, marge ${r2(marge)} %`)
  console.log(`  · ${Y - 1} : revenus ${eur(kpi.revenusN1Total)} (au même jour ${eur(kpi.revenusN1Ytd)}), dépenses ${eur(kpi.depensesN1Total)}`)
  const v = kpi.revenusParModuleYtd
  console.log(`  · Revenus ${Y} par module : maraîchage ${eur(v.parModule.potager)}, verger ${eur(v.parModule.verger)}, élevage ${eur(v.parModule.elevage)}, autre ${eur(v.parModule.autre)}`)
  check("Résultat de l'exercice positif", kpi.beneficeYtd > 0, eur(kpi.beneficeYtd))
  check("Marge de l'exercice entre 30 et 40 %", marge >= 30 && marge <= 40, `${r2(marge)} %`)
  const margeN1 = kpi.revenusN1Total > 0 ? ((kpi.revenusN1Total - kpi.depensesN1Total) / kpi.revenusN1Total) * 100 : 0
  check(`Marge ${Y - 1} entre 30 et 40 %`, margeN1 >= 30 && margeN1 <= 40, `${r2(margeN1)} %`)
  check("Historique N-1 présent (comparatifs)", kpi.revenusN1Total > 0 && kpi.depensesN1Total > 0)
  check("Créances de l'exercice : de 1 à 3", kpi.nbRevenusNonPayes >= 1 && kpi.nbRevenusNonPayes <= 3, `${kpi.nbRevenusNonPayes} pour ${eur(kpi.revenusNonPayesYtd)}`)
  check("Dettes fournisseurs : une facture à crédit au plus", kpi.nbDepensesNonPayees <= 1, `${kpi.nbDepensesNonPayees} pour ${eur(kpi.depensesNonPayeesYtd)}`)
  // Toutes années : aucune créance d'un exercice antérieur ne traîne.
  const toutes = await chargerEncoursCompta(userId, null, maintenant)
  check("Aucune créance d'un exercice antérieur", toutes.creances.items.every((i) => i.date.slice(0, 4) >= String(Y)), `${toutes.creances.items.length} créance(s) au total`)

  // Écran « Aujourd'hui » : même requête que src/lib/accueil/composition.server.ts.
  const debutJour = new Date(`${aujourdhui}T00:00:00`)
  const lignes = await prisma.facture.findMany({ where: { userId, type: { not: "avoir" }, OR: [{ statut: "brouillon" }, { statut: "emise", dateEcheance: { lt: debutJour } }] } })
  const brouillons = lignes.filter((f) => f.statut === "brouillon")
  const echues = lignes.filter((f) => f.statut === "emise")
  const retards = echues.map((f) => Math.round((debutJour.getTime() - f.dateEcheance!.getTime()) / 86_400_000))
  check("Aujourd'hui : une facture brouillon prête au plus", brouillons.length <= 1, `${brouillons.length}`)
  check("Aujourd'hui : une ligne « Relancer » au plus, sans badge Urgent (≤ 30 j)", echues.length <= 1 && retards.every((r) => r <= 30), echues.map((f, i) => `${f.numero} échue depuis ${retards[i]} j`).join(", ") || "aucune")
}

async function sectionCoherence({ Y }: Ctx, routes: Routes) {
  const res = await routes.stats(Y)
  const corps = (await res.json()) as { stats?: { coherenceCheck?: { revenusEcart: number; depensesEcart: number; depensesAnalytiques: number } } }
  const c = corps.stats?.coherenceCheck
  check("Compte de résultat : réponse de la route", res.status === 200 && !!c, `HTTP ${res.status}`)
  if (!c) return
  check("Revenus : SSOT = somme des modules (aucun bandeau)", Math.abs(c.revenusEcart) < 0.01, `écart ${eur(c.revenusEcart)}`)
  check("Dépenses : seul écart = coûts internes analytiques", Math.abs(c.depensesEcart + c.depensesAnalytiques) < 0.01, `écart ${eur(c.depensesEcart)}, coûts internes ${eur(c.depensesAnalytiques)}`)
}

async function sectionFec({ Y }: Ctx, routes: Routes) {
  for (const exercice of [Y - 1, Y]) {
    const res = await routes.fec(exercice)
    const texte = await res.text()
    check(`FEC ${exercice} exporté et équilibré (contrôle de la route)`, res.status === 200, res.status === 200 ? `${texte.trim().split("\n").length - 1} lignes` : texte.slice(0, 200))
    if (res.status !== 200) continue
    const soldes = new Map<string, number>()
    for (const l of texte.trim().split("\n").slice(1).map((x) => x.split("\t"))) {
      soldes.set(l[4], (soldes.get(l[4]) ?? 0) + Number(l[11].replace(",", ".")) - Number(l[12].replace(",", ".")))
    }
    const tresorerie = [...soldes].filter(([k]) => /^5/.test(k))
    console.log(`  · Trésorerie ${exercice} : ${tresorerie.map(([k, s]) => `${k} ${eur(s)}`).join(" · ")}`)
    const banques = tresorerie.map(([k]) => k).filter((k) => k.startsWith("512"))
    avertir(`FEC ${exercice} : un seul compte 512`, banques.length <= 1, `${banques.join(", ")} (512100 : paiements pointés sans relevé, chèques AMAP et ventes directes)`)
  }
}

async function sectionTva({ userId, Y, maintenant }: Ctx) {
  const tva = await computeTvaPeriode(userId, new Date(Y, 0, 1), maintenant)
  console.log(`  · TVA ${Y} : collectée ${eur(tva.collectee.total)}, déductible ${eur(tva.deductible.total)}, ${tva.solde.tvaAPayer ? `à payer ${eur(tva.solde.tvaAPayer)}` : `crédit ${eur(tva.solde.creditTVA)}`}`)
  check("TVA : régime réel, collectée et déductible calculées", !tva.franchise && tva.collectee.total > 0 && tva.deductible.total > 0)
  check("TVA : aucune immobilisation (catégorie matériel)", tva.deductible.immobilisations === 0, eur(tva.deductible.immobilisations))
}

async function sectionFactures({ userId }: Ctx) {
  const factures = await prisma.facture.findMany({ where: { userId }, include: { client: true, lignes: true }, orderBy: [{ date: "asc" }, { id: "asc" }] })
  const parStatut = factures.reduce<Record<string, number>>((m, f) => ({ ...m, [`${f.type} ${f.statut}`]: (m[`${f.type} ${f.statut}`] ?? 0) + 1 }), {})
  console.log(`  · ${factures.length} pièces : ${Object.entries(parStatut).map(([k, n]) => `${k} ${n}`).join(", ")}`)
  // Factur-X : chaque pièce émise passe les contrôles d'export de l'application.
  for (const f of factures.filter((x) => x.statut !== "brouillon" && x.statut !== "annulee")) {
    const p = await preparerExportFacture(f, userId, "Factur-X")
    const issues = p.ok ? [...validerFactureStructuree(p.donnees), ...validerCii(p.donnees)] : [p.error]
    check(`Factur-X ${f.numero} (${f.clientNom})`, issues.length === 0, issues.join(" ; ") || `${eur(f.totalTTC)} TTC, ${f.statut}`)
  }
  // Numérotation continue et chronologique par préfixe et exercice.
  const docs = await prisma.documentCommercial.findMany({ where: { userId, statut: { not: "brouillon" } }, select: { numero: true, date: true } })
  const series = new Map<string, Array<{ n: number; date: string }>>()
  for (const x of [...factures.filter((f) => f.statut !== "brouillon"), ...docs]) {
    const m = /^([A-Z]+-\d{4})-(\d+)$/.exec(x.numero)
    if (!m) { check(`Numéro de pièce lisible : ${x.numero}`, false); continue }
    series.set(m[1], [...(series.get(m[1]) ?? []), { n: Number(m[2]), date: dateIsoFacture(x.date) }])
  }
  for (const [serie, liste] of [...series].sort()) {
    const triee = [...liste].sort((a, b) => a.n - b.n)
    const continue_ = triee.every((x, i) => x.n === i + 1)
    const chrono = triee.every((x, i) => i === 0 || x.date >= triee[i - 1].date)
    check(`Numérotation ${serie} continue et chronologique`, continue_ && chrono, `${triee.length} pièce(s)`)
  }
  const sequences = new Set((await prisma.sequenceFacture.findMany({ where: { userId } })).map((s) => s.type))
  avertir("Séquences de numérotation écrites (facture, avoir, devis, livraison)", ["FACTURE", "AVOIR", "DEVIS", "LIVRAISON"].every((t) => sequences.has(t)), [...sequences].join(", "))
  check("Aucun envoi par courriel depuis la démo", (await prisma.envoiCommercial.count({ where: { userId } })) === 0)
  const echuesAnciennes = factures.filter((f) => f.type !== "avoir" && f.statut === "emise" && f.dateEcheance && (Date.now() - f.dateEcheance.getTime()) / 86_400_000 > 31)
  check("Aucune facture échue depuis plus de 30 jours", echuesAnciennes.length === 0, echuesAnciennes.map((f) => f.numero).join(", "))
}

async function sectionBoutique({ userId }: Ctx) {
  const commandes = await prisma.commandeBoutique.findMany({ where: { userId }, include: { venteManuelle: true } })
  if (!commandes.length) return avertir("Boutique : commandes présentes", false, "aucune")
  const parStatut = commandes.reduce<Record<string, number>>((m, c) => ({ ...m, [c.statut]: (m[c.statut] ?? 0) + 1 }), {})
  console.log(`  · ${commandes.length} commandes : ${Object.entries(parStatut).map(([k, n]) => `${k} ${n}`).join(", ")}`)
  check("Boutique active, 8 à 10 produits", (await prisma.boutique.count({ where: { userId, active: true } })) === 1 && (await prisma.produitBoutique.count({ where: { userId } })) >= 8)
  check("Chaque commande livrée porte sa vente automatique", commandes.filter((c) => c.statut === "livree").every((c) => c.venteManuelle?.auto && c.venteManuelle.sourceType === "commande_boutique" && c.venteManuelle.numeroPiece === c.numero))
  check("Aucune vente pour une commande nouvelle, prête ou annulée", commandes.filter((c) => c.statut !== "livree").every((c) => !c.venteManuelleId))
  check("Tous les états montrés (livrée, prête, nouvelle, annulée)", ["livree", "prete", "nouveau", "annulee"].every((s) => parStatut[s]))
}

async function sectionBanque({ userId, aujourdhui }: Ctx) {
  const comptes = await prisma.compteBancaire.findMany({ where: { userId } })
  if (!comptes.length) return avertir("Banque : compte de relevés présent", false, "aucun")
  check("Un compte courant de relevés, sans Stripe ni solde importé", comptes.length === 1 && !comptes[0].connexionStripeId && comptes[0].soldeCentimes == null)
  check("Aucune connexion Stripe ni trace d'import", (await prisma.connexionStripe.count({ where: { userId } })) === 0 && (await prisma.tentativeImportReleve.count({ where: { userId } })) === 0)
  const ops = await prisma.operationBancaire.findMany({ where: { userId }, include: { reglements: { where: { annuleLe: null } } } })
  const ignorees = ops.filter((o) => o.statut === "ignoree")
  check("Une opération exclue, avec son motif", ignorees.length === 1 && !!ignorees[0].motifExclusion)
  const libres = ops.filter((o) => o.statut === "comptabilisee" && o.reglements.length === 0)
  const limite = new Date(`${aujourdhui}T00:00:00Z`).getTime() - 92 * 86_400_000
  check("Trois opérations laissées au visiteur, toutes récentes", libres.length === 3 && libres.every((o) => o.date.getTime() >= limite), libres.map((o) => o.libelle.slice(0, 48)).join(" | "))
  const incompletes = ops.filter((o) => o.reglements.length && o.reglements.reduce((n, r) => n + Number(r.montantCentimes), 0) !== Math.abs(Number(o.brutCentimes)))
  check("Opérations rapprochées soldées au centime", incompletes.length === 0, `${ops.length - libres.length - ignorees.length} rapprochées sur ${ops.length}`)
}

async function sectionCharges({ userId }: Ctx) {
  const valides = new Set(["semences", "aliments", "fertilisants", "phyto", "carburant", "energie", "petit_outillage", "prestation", "veterinaire", "msa", "main_oeuvre", "abonnement", "autre"])
  const manuelles = await prisma.depenseManuelle.groupBy({ by: ["categorie"], where: { userId, auto: false, comptable: true }, _sum: { montant: true } })
  console.log(`  · ${manuelles.map((g) => `${g.categorie} ${eur(g._sum.montant ?? 0)}`).join(" · ")}`)
  check("Charges saisies : catégories de l'écran et du plan comptable (ni matériel ni intrants)", manuelles.every((g) => valides.has(g.categorie)), manuelles.filter((g) => !valides.has(g.categorie)).map((g) => g.categorie).join(", "))
  const auto = await prisma.depenseManuelle.groupBy({ by: ["sourceType", "comptable"], where: { userId, auto: true }, _sum: { montant: true } })
  if (auto.length) console.log(`  · Miroirs : ${auto.map((g) => `${g.sourceType}${g.comptable ? "" : " (interne)"} ${eur(g._sum.montant ?? 0)}`).join(" · ")}`)
}

const PARCELLES = new Set(["Verger", "Serre", "Tunnel", "Plein champ", "Pâture du Grand Pré", "Prairie de fauche"])
const NOMS_DE_TEST = /\b(test|bug|essai|toto|azerty|qwerty|xxx|fff|dummy|lorem)\b/i

async function sectionIntegrite({ userId, Y }: Ctx) {
  const parcelles = await prisma.parcelleGeo.findMany({ where: { userId }, select: { nom: true } })
  check("Parcelles : uniquement celles du scénario", parcelles.every((p) => PARCELLES.has(p.nom)), parcelles.filter((p) => !PARCELLES.has(p.nom)).map((p) => p.nom).join(", ") || `${parcelles.length}`)
  const planches = await prisma.planche.findMany({ where: { userId }, select: { nom: true } })
  check("Planches : aucun nom de test", planches.every((p) => /^[ABC]\d{1,2}$/.test(p.nom)), planches.filter((p) => !/^[ABC]\d{1,2}$/.test(p.nom)).map((p) => p.nom).join(", "))
  const annees = (await prisma.culture.groupBy({ by: ["annee"], where: { userId } })).map((g) => g.annee).sort()
  check(`Cultures des années ${Y - 2} à ${Y + 1} (historique des rotations compris)`, annees.every((a) => a != null && a >= Y - 2 && a <= Y + 1), annees.join(", "))
  check("Aucune culture sans planche", (await prisma.culture.count({ where: { userId, plancheId: null } })) === 0)
  const textes = [
    ...(await prisma.client.findMany({ where: { userId }, select: { nom: true } })).map((c) => c.nom),
    ...(await prisma.produitBoutique.findMany({ where: { userId }, select: { nom: true } })).map((p) => p.nom),
    ...(await prisma.facture.findMany({ where: { userId }, select: { clientNom: true, objet: true } })).flatMap((f) => [f.clientNom, f.objet ?? ""]),
    ...(await prisma.depenseManuelle.findMany({ where: { userId, auto: false }, select: { description: true } })).map((d) => d.description),
  ]
  const suspects = textes.filter((t) => NOMS_DE_TEST.test(t))
  check("Aucun nom de test (clients, produits, factures, charges)", suspects.length === 0, suspects.slice(0, 5).join(" | "))
  const futur = new Date()
  const datesFutures = (await prisma.venteManuelle.count({ where: { userId, date: { gt: futur } } })) + (await prisma.depenseManuelle.count({ where: { userId, date: { gt: futur } } })) + (await prisma.facture.count({ where: { userId, date: { gt: futur } } }))
  check("Aucune écriture comptable datée après maintenant", datesFutures === 0, `${datesFutures}`)
}

// Sections des ateliers : à compléter par leurs rédacteurs (cheptel, lait et
// fromagerie, ruche ; cultures, ITP et récoltes ; verger).
async function sectionMaraichage({ userId, Y }: Ctx) {
  const n = await prisma.culture.count({ where: { userId, annee: Y } })
  avertir(`Maraîchage : cultures ${Y}`, n > 0, `${n}`)
}
async function sectionElevage({ userId }: Ctx) {
  const n = await prisma.animal.count({ where: { userId } })
  avertir("Élevage : animaux présents", n > 0, `${n}`)
}

const SECTIONS: Array<[string, (c: Ctx, routes: Routes) => Promise<void>]> = [
  ["Identité et exploitation", sectionIdentite],
  ["Comptabilité (KPI, créances, Aujourd'hui)", sectionComptabilite],
  ["Cohérence comptable ↔ modules", sectionCoherence],
  ["FEC", sectionFec],
  ["TVA", sectionTva],
  ["Factures, devis, bons et Factur-X", sectionFactures],
  ["Boutique", sectionBoutique],
  ["Banque", sectionBanque],
  ["Charges", sectionCharges],
  ["Maraîchage", sectionMaraichage],
  ["Élevage", sectionElevage],
  ["Intégrité et dé-pollution", sectionIntegrite],
]

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true, name: true } })
  if (!user) { console.log(`❌ Compte ${DEMO_EMAIL} introuvable`); process.exitCode = 1; return }
  const maintenant = new Date()
  const ctx: Ctx = { userId: user.id, Y: maintenant.getFullYear(), maintenant, aujourdhui: dateIsoFacture(maintenant) }
  const routes = routesAvecSession(user.id)
  console.log(`▶ Vérification démo « ${user.name} » (${DEMO_EMAIL}) — ${ctx.aujourdhui}\n`)
  for (const [titre, section] of SECTIONS) {
    console.log(`── ${titre} ──`)
    try { await section(ctx, routes) } catch (e) { check(`${titre} : exécution`, false, (e as Error).message.split("\n")[0]) }
    console.log("")
  }
  console.log(echecs === 0 ? `✅ TOUS LES INVARIANTS OK${avertissements ? ` (${avertissements} avertissement(s))` : ""}` : `❌ ${echecs} INVARIANT(S) EN ÉCHEC`)
  process.exitCode = echecs === 0 ? 0 : 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
