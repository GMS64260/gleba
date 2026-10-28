/**
 * POST /api/capteurs/ingestion — seule porte d'entrée des mesures de capteurs.
 *
 * Hors session : authentifiée par le jeton du connecteur
 * (`Authorization: Bearer glc_…`), qui désigne le compte destinataire et le
 * format attendu (TTN, ChirpStack, générique). Le corps ne choisit jamais le
 * compte. Déclarée publique dans `middleware.ts`.
 *
 * Débit : requêtes et TRAMES par connecteur, MESURES par compte
 * (`budget.ts`) pour les envois valides ; par adresse pour les jetons refusés
 * seulement. Les webhooks TTN partagent leurs adresses entre tous les comptes :
 * un plafond par adresse vérifié avant le jeton ferait payer à tous les
 * utilisateurs de TTN le jeton périmé d'un seul (régénéré sans être reporté
 * dans la console). Une recherche ratée ne coûte qu'une lecture d'index unique.
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { adapter } from "@/lib/capteurs/adaptateurs"
import { consommerBudgets } from "@/lib/capteurs/budget"
import { estTypeConnecteur } from "@/lib/capteurs/connecteurs"
import { ingererTrames } from "@/lib/capteurs/ingestion"
import { hacherJeton, lireJetonBearer } from "@/lib/capteurs/jeton"
import { empreinteRefusee, noterEmpreinteRefusee } from "@/lib/capteurs/jetons-refuses"

export const dynamic = "force-dynamic"

const TAILLE_MAX_OCTETS = 256 * 1024
const FENETRE_MS = 15 * 60 * 1000
const ENVOIS_MAX_PAR_CONNECTEUR = 1200
const ECHECS_MAX_PAR_ADRESSE = 300
/** 50 capteurs toutes les 5 min = 150 trames par quart d'heure : marge de 4. */
const TRAMES_MAX_PAR_CONNECTEUR = 600

function refusJeton(request: NextRequest) {
  const limite = checkRateLimit(`capteurs-echec:${getClientIP(request)}`, { windowMs: FENETRE_MS, max: ECHECS_MAX_PAR_ADRESSE })
  return limite ?? NextResponse.json({ error: "Jeton de connecteur absent ou invalide" }, { status: 401 })
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
  if (!jeton) return refusJeton(request)

  const empreinte = hacherJeton(jeton)
  if (empreinteRefusee(empreinte)) return refusJeton(request)
  const connecteur = await prisma.connecteurCapteurs.findUnique({
    where: { jetonHash: empreinte },
    select: { id: true, userId: true, type: true, actif: true },
  })
  if (!connecteur) {
    noterEmpreinteRefusee(empreinte)
    return refusJeton(request)
  }
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
