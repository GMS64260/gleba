/**
 * POST /api/capteurs/ingestion — seule porte d'entrée des mesures de capteurs.
 *
 * Hors session : authentifiée par le jeton du connecteur
 * (`Authorization: Bearer glc_…`), qui désigne le compte destinataire et le
 * format attendu (TTN, ChirpStack, générique). Le corps ne choisit jamais le
 * compte. Déclarée publique dans `middleware.ts`.
 *
 * Débit : requêtes et TRAMES par connecteur, MESURES par compte
 * (`budget.ts`) pour les envois valides. Par adresse, un plafond de LECTURES
 * EN BASE RATÉES (jeton inconnu), pris AVANT la lecture et rendu si le jeton
 * est bon (revue du 2026-10-30 : vérifié après, il n'épargnait rien à la
 * base). Les serveurs de réseau LoRaWAN (TTN, ChirpStack hébergé) envoient
 * les trames de nombreuses fermes depuis les mêmes adresses, d'où trois
 * règles pour ne pas faire payer à toutes l'erreur ou le balayage d'une seule :
 * - un jeton absent ou déjà refusé (cache de 10 min) ne lit pas la base et
 *   n'entame pas le plafond ;
 * - un jeton accepté dans les 24 dernières heures passe même au plafond ;
 * - au plafond, l'adresse garde une lecture toutes les 10 s
 *   (`LECTURE_AU_PLAFOND_MS`, 2026-10-30) : un jeton valide jamais vu n'attend
 *   plus la fin de la fenêtre (15 min) mais le prochain créneau.
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { adapter } from "@/lib/capteurs/adaptateurs"
import { consommerBudgets, consommerOuEspacer, rendreBudget } from "@/lib/capteurs/budget"
import { estTypeConnecteur } from "@/lib/capteurs/connecteurs"
import { ingererTrames } from "@/lib/capteurs/ingestion"
import { hacherJeton, lireJetonBearer } from "@/lib/capteurs/jeton"
import { empreinteAcceptee, empreinteRefusee, noterEmpreinteAcceptee, noterEmpreinteRefusee } from "@/lib/capteurs/jetons-refuses"

export const dynamic = "force-dynamic"

const TAILLE_MAX_OCTETS = 256 * 1024
const FENETRE_MS = 15 * 60 * 1000
const ENVOIS_MAX_PAR_CONNECTEUR = 1200
const ECHECS_MAX_PAR_ADRESSE = 300
/**
 * Au plafond d'échecs, une lecture en base toutes les 10 s par adresse, quelle
 * qu'en soit l'issue. Côté base : 90 lectures de plus par fenêtre au pire (390
 * au lieu de 300), soit 0,1 par seconde, trois fois moins que le rythme moyen
 * déjà toléré sous le plafond (300 en 15 min) : un balayage reste freiné.
 * Côté fermes : un jeton nouveau passe au plus 10 s après la dernière lecture
 * (`Retry-After` le dit), bien en deçà de l'intervalle d'émission d'un capteur
 * LoRaWAN (quelques minutes), et un essai à la main passe en relançant.
 * Limite : le créneau va au premier arrivé ; sous un flot continu de jetons
 * jamais vus venant de la même adresse, un jeton valide peut attendre plus
 * longtemps, jamais plus qu'avant ce débit (fin de la fenêtre).
 */
const LECTURE_AU_PLAFOND_MS = 10_000
/** 50 capteurs toutes les 5 min = 150 trames par quart d'heure : marge de 4. */
const TRAMES_MAX_PAR_CONNECTEUR = 600

function refusJeton() {
  return NextResponse.json({ error: "Jeton de connecteur absent ou invalide" }, { status: 401 })
}

function tropDEchecs(reessayerDansS: number) {
  return NextResponse.json(
    { error: "Trop de jetons invalides depuis cette adresse : réessayez plus tard." },
    { status: 429, headers: { "Retry-After": String(reessayerDansS) } },
  )
}

/** Arrête la lecture dès le plafond, y compris sans Content-Length (flux HTTP). */
async function lireCorpsBorne(request: NextRequest): Promise<string | null> {
  const lecteur = request.body?.getReader()
  if (!lecteur) return ""
  const morceaux: Uint8Array[] = []
  let taille = 0
  try {
    while (true) {
      const { done, value } = await lecteur.read()
      if (done) return Buffer.concat(morceaux).toString("utf8")
      taille += value.byteLength
      if (taille > TAILLE_MAX_OCTETS) {
        void lecteur.cancel().catch(() => {})
        return null
      }
      morceaux.push(value)
    }
  } finally {
    lecteur.releaseLock()
  }
}

export async function POST(request: NextRequest) {
  const jeton = lireJetonBearer(request.headers.get("authorization"))
  if (!jeton) return refusJeton()

  const empreinte = hacherJeton(jeton)
  if (empreinteRefusee(empreinte)) return refusJeton()
  const echecs = `echecs:${getClientIP(request)}`
  const dejaAccepte = empreinteAcceptee(empreinte)
  // Unité du plafond prise avant la lecture (des requêtes simultanées ne le
  // dépassent pas), rendue plus bas si le jeton est bon.
  let unitePrise = false
  if (!dejaAccepte) {
    const passage = consommerOuEspacer(echecs, ECHECS_MAX_PAR_ADRESSE, FENETRE_MS, LECTURE_AU_PLAFOND_MS)
    if (!passage.ok) return tropDEchecs(passage.reessayerDansS)
    unitePrise = passage.unite
  }
  const connecteur = await prisma.connecteurCapteurs.findUnique({
    where: { jetonHash: empreinte },
    select: { id: true, userId: true, type: true, actif: true },
  })
  if (!connecteur) {
    noterEmpreinteRefusee(empreinte)
    // Jeton accepté naguère puis régénéré : lecture ratée comptée après coup.
    if (dejaAccepte) consommerBudgets([{ cle: echecs, quantite: 1, max: ECHECS_MAX_PAR_ADRESSE }], FENETRE_MS)
    return refusJeton()
  }
  if (unitePrise) rendreBudget(echecs, 1)
  noterEmpreinteAcceptee(empreinte)
  if (!connecteur.actif) {
    return NextResponse.json({ error: "Connecteur désactivé dans Gleba (Paramètres > Capteurs)" }, { status: 403 })
  }
  if (!estTypeConnecteur(connecteur.type)) {
    return NextResponse.json({ error: `Type de connecteur inconnu : ${connecteur.type}` }, { status: 500 })
  }

  const limite = checkRateLimit(`capteurs:${connecteur.id}`, { windowMs: FENETRE_MS, max: ENVOIS_MAX_PAR_CONNECTEUR })
  if (limite) return limite

  const longueurAnnoncee = Number(request.headers.get("content-length") ?? 0)
  if (longueurAnnoncee > TAILLE_MAX_OCTETS) {
    return NextResponse.json({ error: "Envoi trop volumineux (256 Ko au plus)" }, { status: 413 })
  }
  const texte = await lireCorpsBorne(request).catch(() => undefined)
  if (texte === null) {
    return NextResponse.json({ error: "Envoi trop volumineux (256 Ko au plus)" }, { status: 413 })
  }
  if (texte === undefined) return NextResponse.json({ error: "Corps illisible" }, { status: 400 })
  let corps: unknown
  try {
    corps = JSON.parse(texte)
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  const maintenant = new Date()
  const adaptation = adapter(connecteur.type, corps, { evenement: request.nextUrl.searchParams.get("event"), maintenant })
  if (!adaptation.ok) return NextResponse.json({ error: adaptation.erreur }, { status: 422 })
  // Événement sans mesure (join, ack…) : accusé sans écriture, pour que le
  // serveur de réseau ne le réessaie pas.
  if (adaptation.trames.length === 0) {
    return NextResponse.json({ ignore: adaptation.ignore }, { status: 202 })
  }

  // Trames par connecteur ici ; mesures par compte dans `ingererTrames`, une
  // fois les clés résolues.
  const budget = consommerBudgets(
    [{ cle: `trames:${connecteur.id}`, quantite: adaptation.trames.length, max: TRAMES_MAX_PAR_CONNECTEUR }],
    FENETRE_MS,
  )
  if (!budget.ok) return tropDeMesures(budget.reessayerDansS)

  const bilan = await ingererTrames(connecteur, adaptation.trames, maintenant)
  if (bilan.limite) return tropDeMesures(bilan.limite.reessayerDansS, bilan)
  return NextResponse.json(bilan)
}

function tropDeMesures(reessayerDansS: number, bilan?: unknown) {
  return NextResponse.json(
    { error: "Trop de mesures reçues pour ce quart d'heure : espacez les envois.", ...(bilan ? { bilan } : {}) },
    { status: 429, headers: { "Retry-After": String(reessayerDansS) } },
  )
}
