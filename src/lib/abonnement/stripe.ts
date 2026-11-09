import { createHmac, timingSafeEqual, randomUUID } from "node:crypto"
import prisma from "@/lib/prisma"
import { FORMULES, VERSION_CONDITIONS_OFFRE } from "./catalogue"
import { abonnementsActifs, chargerAccesService } from "./serveur"

type Objet = Record<string, unknown>
export const objet = (v: unknown): Objet => v && typeof v === "object" && !Array.isArray(v) ? v as Objet : {}
const id = (v: unknown): string | null => typeof v === "string" ? v : typeof objet(v).id === "string" ? objet(v).id as string : null
const liste = (v: unknown): unknown[] => Array.isArray(v) ? v : []
const dateUnix = (v: unknown): Date | null => typeof v === "number" && Number.isFinite(v) && v > 0 ? new Date(v * 1000) : null
export class ErreurFacturation extends Error {
  constructor(message: string, readonly status = 503) { super(message) }
}
/** Clé secrète (sk_) ou restreinte (rk_) du compte Stripe de Gleba ; la clé restreinte est recommandée. */
function configuration() {
  const cle = process.env.GLEBA_STRIPE_SECRET_KEY
  const complet = process.env.GLEBA_STRIPE_PRICE_COMPLET
  if (!cle || !/^(sk|rk)_(test|live)_/.test(cle) || !complet || !/^price_[A-Za-z0-9]+$/.test(complet)) throw new ErreurFacturation("Les paiements ne sont pas encore disponibles. Votre accès actuel est conservé.")
  const live = /^(sk|rk)_live_/.test(cle)
  if (live && process.env.GLEBA_STRIPE_COMMERCE_VALIDE !== "true") throw new ErreurFacturation("La commercialisation n’est pas encore ouverte.")
  return { cle, complet, live }
}
export function paiementsDisponibles(): boolean { try { configuration(); return abonnementsActifs() } catch { return false } }
export async function appelerStripe(methode: "GET" | "POST" | "DELETE", chemin: string, parametres?: URLSearchParams, cleIdempotence?: string): Promise<Objet> {
  const config = configuration()
  if (!chemin.startsWith("/v1/") || chemin.includes("..")) throw new ErreurFacturation("Requête de paiement invalide.", 400)
  const reponse = await fetch("https://api.stripe.com" + chemin, {
    method: methode,
    headers: { Authorization: "Bearer " + config.cle, "Stripe-Version": "2026-10-28.endive", ...(methode === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(cleIdempotence ? { "Idempotency-Key": cleIdempotence } : {}) },
    body: methode === "POST" ? parametres : undefined,
    signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
  })
  if (!reponse.ok) throw new ErreurFacturation("Le prestataire de paiement n’a pas confirmé l’opération. Réessayez dans un instant.")
  return objet(await reponse.json())
}
export function signatureValide(corps: string, signature: string | null, secret: string, maintenant = Date.now()): boolean {
  if (!signature) return false
  const champs = signature.split(",").map(c => c.split("="))
  const t = champs.find(([k]) => k === "t")?.[1]
  if (!t || !/^\d+$/.test(t) || Math.abs(maintenant / 1000 - Number(t)) > 300) return false
  const attendu = createHmac("sha256", secret).update(`${t}.${corps}`).digest()
  return champs.some(([k, v]) => k === "v1" && /^[a-f0-9]{64}$/i.test(v ?? "") && timingSafeEqual(attendu, Buffer.from(v, "hex")))
}
function origine() {
  const url = new URL(process.env.GLEBA_PUBLIC_URL || "https://gleba.fr")
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new ErreurFacturation("Adresse du service invalide.")
  return url.origin
}
async function verifierPrix() {
  const prix = await appelerStripe("GET", "/v1/prices/" + configuration().complet)
  const recurrent = objet(prix.recurring)
  if (prix.currency !== "eur" || prix.unit_amount !== FORMULES.complet.centimes || recurrent.interval !== "month" || recurrent.interval_count !== 1 || prix.active !== true || prix.tax_behavior !== "exclusive") throw new ErreurFacturation("Le tarif du prestataire doit être vérifié avant de souscrire.")
}
async function creerCheckoutSousVerrou(userId: string) {
  const acces = await chargerAccesService(userId)
  if (acces.etat === "gratuit-vie" || acces.etat === "libre") throw new ErreurFacturation("Votre accès complet est gratuit : aucun paiement n’est nécessaire.", 409)
  // L'essai promis n'est jamais raccourci par le paiement d'une nouvelle souscription.
  if (acces.etat === "essai") throw new ErreurFacturation("Votre essai est encore en cours. Vous pourrez souscrire à sa fin.", 409)
  if (["actif", "grace"].includes(acces.etat)) throw new ErreurFacturation("Votre abonnement Complet est déjà en cours.", 409)
  if (acces.etat === "a-demarrer") throw new ErreurFacturation("Commencez vos trois mois gratuits avant de souscrire.", 409)
  await verifierPrix()
  const existant = await prisma.abonnementGleba.findUnique({ where: { userId } })
  if (existant?.clientStripeId) {
    const contrats = await appelerStripe("GET", "/v1/subscriptions?status=all&limit=100&customer=" + encodeURIComponent(existant.clientStripeId))
    const ouvert = liste(contrats.data).map(objet).find(c => !["canceled", "incomplete_expired"].includes(String(c.status)))
    if (contrats.has_more || ouvert) {
      if (ouvert && id(ouvert)) await synchroniserSousVerrou(id(ouvert)!, prisma)
      throw new ErreurFacturation("Un contrat de paiement existe déjà. Gérez-le depuis votre abonnement avant de souscrire à nouveau.", 409)
    }
  }
  const debut = new Date()
  const cle = randomUUID()
  await prisma.abonnementGleba.upsert({ where: { userId }, create: { userId }, update: {} })
  const verrou = await prisma.abonnementGleba.updateMany({
    where: { userId, AND: [{ OR: [{ statut: null }, { statut: { not: "suppression" } }] }], abonnementStripeId: null, gratuitAVie: false, OR: [{ checkoutExpireLe: null }, { checkoutExpireLe: { lt: debut } }] },
    data: { checkoutCle: cle, checkoutExpireLe: new Date(debut.getTime() + 35 * 60 * 1000) },
  })
  if (!verrou.count) throw new ErreurFacturation("Un abonnement ou un paiement est déjà en cours. Utilisez Gérer mon abonnement ou réessayez à la fin du paiement en cours.", 409)
  try {
    let ligne = await prisma.abonnementGleba.findUniqueOrThrow({ where: { userId } })
    if (!ligne.clientStripeId) {
      const client = await appelerStripe("POST", "/v1/customers", new URLSearchParams({ "metadata[glebaUserId]": userId }), `gleba-client-${userId}`)
      if (!id(client)) throw new ErreurFacturation("La création du compte de facturation a échoué.")
      ligne = await prisma.abonnementGleba.update({ where: { userId }, data: { clientStripeId: id(client) } })
    }
    const params = new URLSearchParams({ mode: "subscription", customer: ligne.clientStripeId!, "line_items[0][price]": configuration().complet, "line_items[0][quantity]": "1", "payment_method_types[0]": "card", success_url: origine() + "/parametres?section=abonnement&paiement=retour", cancel_url: origine() + "/parametres?section=abonnement", expires_at: String(Math.floor(debut.getTime() / 1000) + 1800), client_reference_id: userId, "subscription_data[metadata][glebaUserId]": userId, "subscription_data[metadata][glebaCheckoutCle]": cle, "subscription_data[metadata][formule]": "complet", "metadata[glebaUserId]": userId, "consent_collection[terms_of_service]": "required", billing_address_collection: "required", "customer_update[address]": "auto", "tax_id_collection[enabled]": "true" })
    if (process.env.GLEBA_STRIPE_TAX_MODE === "automatic") params.set("automatic_tax[enabled]", "true")
    else if (process.env.GLEBA_STRIPE_TAX_RATE) params.set("subscription_data[default_tax_rates][0]", process.env.GLEBA_STRIPE_TAX_RATE)
    else if (process.env.GLEBA_STRIPE_TAX_MODE !== "exempt") throw new ErreurFacturation("Le régime de TVA du service doit être configuré avant de souscrire.")
    const session = await appelerStripe("POST", "/v1/checkout/sessions", params, `gleba-checkout-${cle}`)
    if (typeof session.url !== "string" || !session.url.startsWith("https://checkout.stripe.com/")) throw new ErreurFacturation("La page de paiement n’est pas disponible.")
    await prisma.abonnementGleba.update({ where: { userId }, data: { checkoutId: id(session), conditionsVersion: VERSION_CONDITIONS_OFFRE, conditionsAccepteesLe: debut } })
    return session.url
  } catch (e) {
    // Ne libérer le verrou qu'après son expiration : une réponse réseau perdue peut cacher une session créée.
    throw e
  }
}
export async function creerPortail(userId: string) {
  const acces = await chargerAccesService(userId)
  if (acces.etat === "gratuit-vie") throw new ErreurFacturation("Votre accès est gratuit à vie.", 409)
  const ligne = await prisma.abonnementGleba.findUnique({ where: { userId } })
  if (!ligne?.clientStripeId) throw new ErreurFacturation("Aucun compte de facturation à gérer.", 409)
  const p = new URLSearchParams({ customer: ligne.clientStripeId, return_url: origine() + "/parametres?section=abonnement" })
  const configurationPortail = process.env.GLEBA_STRIPE_PORTAL_CONFIGURATION
  if (!configurationPortail) throw new ErreurFacturation("Le portail d’abonnement doit être configuré.")
  const portailConfig = await appelerStripe("GET", "/v1/billing_portal/configurations/" + encodeURIComponent(configurationPortail))
  const fonctions = objet(portailConfig.features)
  if (objet(fonctions.subscription_update).enabled === true || objet(fonctions.subscription_cancel).enabled === true) throw new ErreurFacturation("Le portail doit réserver les changements et résiliations aux paramètres Gleba.")
  p.set("configuration", configurationPortail)
  const portail = await appelerStripe("POST", "/v1/billing_portal/sessions", p)
  if (typeof portail.url !== "string" || !portail.url.startsWith("https://billing.stripe.com/")) throw new ErreurFacturation("Le portail de facturation n’est pas disponible.")
  return portail.url
}

export async function synchroniserAbonnement(abonnementId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('gleba-facturation'))::text`
    await synchroniserSousVerrou(abonnementId, tx)
  }, { timeout: 25000 })
}
async function synchroniserSousVerrou(abonnementId: string, db: Pick<typeof prisma, "abonnementGleba">) {
  const config = configuration()
  const sub = await appelerStripe("GET", "/v1/subscriptions/" + encodeURIComponent(abonnementId) + "?expand[]=latest_invoice")
  const ligne = await db.abonnementGleba.findFirst({ where: { OR: [{ abonnementStripeId: abonnementId }, { clientStripeId: id(sub.customer) ?? "absent" }] } })
  if (!ligne || ligne.gratuitAVie || ligne.statut === "suppression") return
  if (ligne.abonnementStripeId && ligne.abonnementStripeId !== abonnementId) return
  // Un ancien contrat ne peut pas se rattacher à une nouvelle tentative de souscription.
  if (objet(sub.metadata).glebaUserId !== ligne.userId || id(sub.customer) !== ligne.clientStripeId || sub.livemode !== config.live) throw new ErreurFacturation("Le contrat de paiement ne correspond pas à l’exploitation.")
  if (!ligne.checkoutCle || objet(sub.metadata).glebaCheckoutCle !== ligne.checkoutCle) return
  const items = liste(objet(sub.items).data)
  const item = objet(items[0])
  const prix = objet(item.price)
  if (items.length !== 1 || item.quantity !== 1 || id(prix) !== config.complet || prix.currency !== "eur" || prix.unit_amount !== FORMULES.complet.centimes) throw new ErreurFacturation("Le contenu du contrat doit être vérifié.")
  const facture = objet(sub.latest_invoice)
  const lignes = liste(objet(facture.lines).data).map(objet)
  const fin = lignes.filter(l => {
    const priceId = id(l.price) || id(objet(objet(l.pricing).price_details).price)
    return priceId === id(prix) && typeof l.amount === "number" && l.amount > 0
  }).map(l => dateUnix(objet(l.period).end)).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0]
  const facturePayee = facture.status === "paid" && facture.amount_remaining === 0
  const payeJusquau = facturePayee && fin ? fin : ligne.payeJusquau
  // Ne jamais activer un nouveau prix sur la seule présence de status=active.
  const peutActiver = facturePayee && fin && ["active", "canceled"].includes(String(sub.status)) && !sub.pending_update
  const statut = typeof sub.status === "string" ? sub.status : "unknown"
  await db.abonnementGleba.update({ where: { userId: ligne.userId }, data: {
    abonnementStripeId: abonnementId, statut, annulationAuTerme: sub.cancel_at_period_end === true,
    ...(peutActiver ? { formule: "complet" } : {}),
    payeJusquau,
    graceJusquau: statut === "past_due" && payeJusquau ? new Date(payeJusquau.getTime() + 7 * 86400000) : null,
    ...(statut === "canceled" || statut === "incomplete_expired" ? { abonnementStripeId: null, checkoutId: null, checkoutExpireLe: null } : {}),
  } })
}

async function resilierSousVerrou(userId: string) {
  const ligne = await prisma.abonnementGleba.findUniqueOrThrow({ where: { userId } })
  if (!ligne.abonnementStripeId) throw new ErreurFacturation("Aucun abonnement en cours.", 409)
  const contrat = await appelerStripe("GET", "/v1/subscriptions/" + ligne.abonnementStripeId)
  if (["incomplete", "unpaid"].includes(String(contrat.status))) await appelerStripe("DELETE", "/v1/subscriptions/" + ligne.abonnementStripeId)
  else await appelerStripe("POST", "/v1/subscriptions/" + ligne.abonnementStripeId, new URLSearchParams({ cancel_at_period_end: "true" }), `gleba-fin-${ligne.abonnementStripeId}`)
  await synchroniserSousVerrou(ligne.abonnementStripeId, prisma)
}

export async function recevoirEvenement(corps: string, signature: string | null) {
  const config = configuration()
  const secret = process.env.GLEBA_STRIPE_WEBHOOK_SECRET
  if (!secret || !signatureValide(corps, signature, secret)) throw new ErreurFacturation("Signature de paiement invalide.", 400)
  const event = objet(JSON.parse(corps))
  if (typeof event.id !== "string" || typeof event.type !== "string" || event.livemode !== config.live) throw new ErreurFacturation("Événement de paiement invalide.", 400)
  const data = objet(objet(event.data).object)
  const objetId = id(data)
  if (!objetId) throw new ErreurFacturation("Objet de paiement manquant.", 400)
  const connu = /^(customer\.subscription\.(created|updated|deleted)|invoice\.(paid|payment_failed|payment_action_required)|checkout\.session\.(completed|expired))$/.test(event.type)
  if (!connu) return
  const enregistre = await prisma.evenementAbonnement.upsert({ where: { id: event.id }, create: { id: event.id, type: event.type, objetId }, update: {} })
  if (enregistre.traiteLe) return
  await traiterEvenement(event.id)
}
/** Aussi utilisé par la réconciliation : l'inbox ne contient ni carte ni corps métier. */
export async function traiterEvenement(eventId: string) {
  const ligne = await prisma.evenementAbonnement.findUniqueOrThrow({ where: { id: eventId } })
  if (ligne.traiteLe) return
  await prisma.evenementAbonnement.update({ where: { id: eventId }, data: { tentatives: { increment: 1 } } })
  try {
    // Relire l'événement et le contrat évite d'appliquer un état ancien arrivé en retard.
    const event = await appelerStripe("GET", "/v1/events/" + encodeURIComponent(eventId))
    const data = objet(objet(event.data).object)
    const subId = ligne.type.startsWith("customer.subscription.") ? id(data) : id(data.subscription) || id(objet(objet(data.parent).subscription_details).subscription)
    if (subId) await synchroniserAbonnement(subId)
    if (ligne.type === "checkout.session.expired") {
      await prisma.abonnementGleba.updateMany({ where: { checkoutId: ligne.objetId, abonnementStripeId: null }, data: { checkoutExpireLe: null, checkoutCle: null, checkoutId: null } })
    }
    await prisma.evenementAbonnement.update({ where: { id: eventId }, data: { traiteLe: new Date(), erreur: null } })
  } catch (e) {
    await prisma.evenementAbonnement.update({ where: { id: eventId }, data: { erreur: "Échec de réconciliation, événement à rejouer." } })
    throw e
  }
}

/** Le verrou sérialise commandes et webhooks. Les marqueurs d'opération restent
 * persistés même si une réponse Stripe est perdue (écritures via prisma). */
async function avecVerrouFacturation<T>(travail: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('gleba-facturation'))::text`
    return travail()
  }, { timeout: 90000 })
}
export const creerCheckout = (u: string) => avecVerrouFacturation(() => creerCheckoutSousVerrou(u))
export const resilier = (u: string) => avecVerrouFacturation(() => resilierSousVerrou(u))

/** Confirmer l'arrêt des prélèvements AVANT le cascade de suppression du compte. */
export async function arreterAvantSuppression(userId: string) {
  return avecVerrouFacturation(async () => {
    const ligne = await prisma.abonnementGleba.findUnique({ where: { userId } })
    if (!ligne?.clientStripeId) return
    await prisma.abonnementGleba.update({ where: { userId }, data: { statut: "suppression", checkoutExpireLe: new Date("9000-01-01") } })
    const sessions = await appelerStripe("GET", "/v1/checkout/sessions?status=open&limit=100&customer=" + encodeURIComponent(ligne.clientStripeId))
    if (sessions.has_more) throw new ErreurFacturation("La fermeture des paiements doit être vérifiée avant suppression.")
    for (const session of liste(sessions.data).map(objet)) {
      if (id(session)) await appelerStripe("POST", "/v1/checkout/sessions/" + id(session) + "/expire", new URLSearchParams())
    }
    // Relire tous les contrats du client couvre un webhook retardé ou une réponse perdue.
    const contrats = await appelerStripe("GET", "/v1/subscriptions?status=all&limit=100&customer=" + encodeURIComponent(ligne.clientStripeId))
    if (contrats.has_more) throw new ErreurFacturation("L’arrêt des contrats nécessite une vérification. Votre compte n’a pas été supprimé.")
    for (const c of liste(contrats.data).map(objet)) {
      if (["canceled", "incomplete_expired"].includes(String(c.status))) continue
      const contratId = id(c)
      if (!contratId || objet(c.metadata).glebaUserId !== userId) throw new ErreurFacturation("Le contrat doit être vérifié avant la suppression.")
      const scheduleId = id(c.schedule)
      if (scheduleId) await appelerStripe("POST", "/v1/subscription_schedules/" + scheduleId + "/release", new URLSearchParams(), `gleba-suppression-release-${scheduleId}`)
      await appelerStripe("DELETE", "/v1/subscriptions/" + contratId)
    }
  })
}
