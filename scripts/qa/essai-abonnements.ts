/** Données synthétiques seulement, dans une base jetable explicitement nommée. */
import assert from "node:assert/strict"
import { hash } from "bcryptjs"
import prisma from "../../src/lib/prisma"
import { chargerAccesService, demarrerEssai } from "../../src/lib/abonnement/serveur"
import { finEssai } from "../../src/lib/abonnement/politique"
import { GRATUITE_EXISTANTS_JUSQUAU } from "../../src/lib/abonnement/catalogue"
import { creerCheckout } from "../../src/lib/abonnement/stripe"
import { exportAccount } from "../../src/lib/account-transfer"

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "")
  assert.equal(url.hostname, "127.0.0.1")
  assert.equal(url.port, "55433")
  assert.equal(url.pathname, "/gleba_abonnements_qa")
  assert.equal(process.env.GLEBA_ABONNEMENTS_ACTIFS, "true")
  const password = await hash("gleba-qa-uniquement", 4)
  const apres = new Date(Date.parse(GRATUITE_EXISTANTS_JUSQUAU) + 1)
  const futur = new Date(Date.now() + 86400000 * 30)
  for (const nom of ["historique", "apres", "complet", "expire"]) {
    const userId = `qa-${nom}`
    await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email: `${nom}@example.invalid`, createdAt: nom === "historique" ? new Date(GRATUITE_EXISTANTS_JUSQUAU) : apres, password, emailVerified: true, active: true }, update: { password, emailVerified: true, active: true } })
    if (nom === "historique" || nom === "apres") continue
    await prisma.abonnementGleba.upsert({ where: { userId }, create: { userId }, update: {} })
    await prisma.abonnementGleba.update({ where: { userId }, data: {
      essaiDebut: new Date("2026-07-01"), essaiFin: new Date("2026-10-01"),
      formule: nom === "complet" ? "complet" : null,
      statut: nom === "expire" ? null : "active", payeJusquau: nom === "expire" ? null : futur,
    } })
  }
  // La migration a vu les deux comptes de frontière AVANT de créer les droits.
  assert.equal((await prisma.abonnementGleba.findUniqueOrThrow({ where: { userId: "qa-historique" } })).gratuitAVie, true)
  assert.equal((await prisma.abonnementGleba.findUnique({ where: { userId: "qa-apres" } }))?.gratuitAVie ?? false, false)
  assert.equal((await demarrerEssai("qa-historique")).etat, "gratuit-vie")
  await Promise.all([demarrerEssai("qa-apres"), demarrerEssai("qa-apres")])
  const premier = await prisma.abonnementGleba.findUniqueOrThrow({ where: { userId: "qa-apres" } })
  assert.equal(premier.essaiFin?.toISOString(), finEssai(premier.essaiDebut!).toISOString())
  await demarrerEssai("qa-apres")
  const second = await prisma.abonnementGleba.findUniqueOrThrow({ where: { userId: "qa-apres" } })
  assert.equal(premier.essaiFin?.toISOString(), second.essaiFin?.toISOString())
  const complet = await chargerAccesService("qa-complet")
  assert.equal(complet.etat, "actif"); assert.equal(complet.ia, true); assert.equal(complet.gestion, true)
  // Fin d'essai : retour au carnet gratuit, tous les ateliers et la facturation, sans services de Complet.
  const expire = await chargerAccesService("qa-expire")
  assert.equal(expire.etat, "gratuit"); assert.equal(expire.ecriture, true); assert.equal(expire.facturation, true)
  assert.deepEqual(expire.ateliers, ["maraichage", "verger", "elevage"])
  for (const c of ["ia", "meteo", "boutique", "gestion"] as const) assert.equal(expire[c], false)
  // Export de récupération : les droits et preuves de paiement ne se transfèrent pas.
  const sauvegarde = await exportAccount("qa-complet")
  assert.equal(sauvegarde.data.AbonnementGleba, undefined)
  assert.equal(sauvegarde.data.EvenementAbonnement, undefined)
  assert.equal(sauvegarde.data.Parametre, undefined)
  // Aucun appel externe : prestataire simulé, verrou PostgreSQL réel.
  const paiementId = "qa-paiement"
  await prisma.user.deleteMany({ where: { id: paiementId } })
  await prisma.user.create({ data: { id: paiementId, email: "paiement@example.invalid", createdAt: apres, emailVerified: true } })
  await prisma.abonnementGleba.create({ data: { userId: paiementId, essaiDebut: new Date("2026-07-01"), essaiFin: new Date("2026-10-01"), clientStripeId: "cus_SynthetiqueQA" } })
  process.env.GLEBA_STRIPE_SECRET_KEY = "sk_test_synthetique"
  process.env.GLEBA_STRIPE_PRICE_COMPLET = "price_CompletQA"
  process.env.GLEBA_STRIPE_TAX_MODE = "exempt"
  let checkouts = 0
  globalThis.fetch = async (input, init) => {
    const adresse = String(input)
    if (adresse === "https://api.stripe.com/v1/prices/price_CompletQA") return new Response(JSON.stringify({ currency: "eur", unit_amount: 1200, active: true, tax_behavior: "exclusive", recurring: { interval: "month", interval_count: 1 } }))
    if (adresse === "https://api.stripe.com/v1/subscriptions?status=all&limit=100&customer=cus_SynthetiqueQA") return new Response(JSON.stringify({ data: [], has_more: false }))
    assert.equal(adresse, "https://api.stripe.com/v1/checkout/sessions")
    const params = new URLSearchParams(String(init?.body))
    assert.equal(params.get("subscription_data[metadata][glebaUserId]"), paiementId)
    assert.equal(params.get("line_items[0][price]"), "price_CompletQA")
    checkouts++
    return new Response(JSON.stringify({ id: "cs_SynthetiqueQA", url: "https://checkout.stripe.com/synthetique" }))
  }
  const paiements = await Promise.allSettled([creerCheckout(paiementId), creerCheckout(paiementId)])
  assert.equal(paiements.filter(p => p.status === "fulfilled").length, 1)
  assert.equal(checkouts, 1)
  assert.equal((await chargerAccesService(paiementId)).ia, false)
  console.log("PASS : deux paiements concurrents ne créent qu’une session ; le retour Checkout ne donne aucun droit.")
  console.log("PASS : migration historique, frontière +1 ms, essai concurrent sans reset, Complet, retour au gratuit et export.")
}
main().finally(() => prisma.$disconnect()).catch(() => { console.error("Échec de l’essai abonnements dans la base QA."); process.exitCode = 1 })
