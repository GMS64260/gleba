import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { cheminDeRetour } from "@/lib/auth-retour"

// Le middleware est enveloppé par `auth()` d'Auth.js : on le remplace par une
// enveloppe qui pose la session voulue, pour exécuter le vrai corps du
// middleware sans jeton JWT.
const session = vi.hoisted(() => ({ courante: null as null | { user: { id: string; role: string } } }))
vi.mock("@/lib/auth", () => ({
  auth:
    (handler: (req: NextRequest & { auth: unknown }) => Response) =>
    (req: NextRequest) =>
      handler(Object.assign(req, { auth: session.courante })),
}))

const { default: middleware, config } = await import("./middleware")
// Compilation des motifs par Next lui-même : même sémantique qu'en production.
// (Fonction interne de Next, absente de ses déclarations de types publiques.)
const { getMiddlewareMatchers } = (await import("next/dist/build/analysis/get-page-static-info")) as unknown as {
  getMiddlewareMatchers: (matcher: unknown, nextConfig: object) => { regexp: string }[]
}

describe("middleware : couverture du matcher (revue du 2026-11-04)", () => {
  const regexps = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp))
  const couvert = (chemin: string) => regexps.some((r) => r.test(chemin))

  it("une route d'API suffixée d'une extension d'image passe par le middleware (en-tête de mutation posé)", () => {
    expect(couvert("/api/elevage/animaux/17.png")).toBe(true)
    expect(couvert("/api/cultures/42.svg")).toBe(true)
    expect(couvert("/api/objets-jardin/3.webp")).toBe(true)
    expect(couvert("/api/upload/justificatif/0f8e4c1a-1b2c-4d3e-8f90-123456789abc.png")).toBe(true)
  })

  it("les fichiers statiques et les service workers restent hors du middleware", () => {
    expect(couvert("/gleba-logo.png")).toBe(false)
    expect(couvert("/sw-elevage.js")).toBe(false)
    expect(couvert("/_next/static/chunks/app.js")).toBe(false)
    expect(couvert("/api/cultures")).toBe(true)
  })
})

function visiter(url: string): Response {
  return (middleware as unknown as (req: NextRequest) => Response)(new NextRequest(url))
}

describe("middleware : lien profond sans session (QA cmvnout4y)", () => {
  it("rejoue le ticket : /elevage?tab=alimentation&sub=soins garde sa requête jusqu'à la page de connexion", () => {
    session.courante = null
    const res = visiter("https://gleba.fr/elevage?tab=alimentation&sub=soins")
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location")!)
    expect(location.pathname).toBe("/login")
    expect(location.search).toBe("?callbackUrl=%2Felevage%3Ftab%3Dalimentation%26sub%3Dsoins")
    // Ce que le formulaire de connexion relit puis suit après `signIn`.
    expect(cheminDeRetour(location.searchParams.get("callbackUrl"))).toBe("/elevage?tab=alimentation&sub=soins")
  })

  it("un chemin sans requête reste inchangé", () => {
    session.courante = null
    const location = new URL(visiter("https://gleba.fr/taches").headers.get("location")!)
    expect(location.searchParams.get("callbackUrl")).toBe("/taches")
  })

  it("un chemin qui désignerait un autre hôte n'est pas proposé comme retour", () => {
    session.courante = null
    const location = new URL(visiter("https://gleba.fr//ailleurs.example/piege").headers.get("location")!)
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.has("callbackUrl")).toBe(false)
  })

  it("une API sans session répond toujours 401, sans redirection", () => {
    session.courante = null
    const res = visiter("https://gleba.fr/api/cultures?annee=2026")
    expect(res.status).toBe(401)
    expect(res.headers.get("location")).toBeNull()
  })

  it("avec une session, le lien profond est servi tel quel", () => {
    session.courante = { user: { id: "u1", role: "USER" } }
    const res = visiter("https://gleba.fr/elevage?tab=alimentation&sub=soins")
    expect(res.headers.get("location")).toBeNull()
    expect(res.status).toBe(200)
  })
})

// Inscription Google du 2026-10-27 : le premier retour de Google avait ouvert
// la session, le second a échoué. Auth.js renvoie désormais ses erreurs sur
// /login (`pages.error`) ; une session ouverte doit y passer sans s'arrêter.
describe("middleware : erreur Auth.js renvoyée sur /login", () => {
  it("avec une session déjà ouverte, /login?error=Configuration mène à l'accueil", () => {
    session.courante = { user: { id: "u1", role: "USER" } }
    const res = visiter("https://gleba.fr/login?error=Configuration")
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get("location")!).pathname).toBe("/")
  })

  it("sans session, /login?error=Configuration est servie pour afficher le message", () => {
    session.courante = null
    const res = visiter("https://gleba.fr/login?error=Configuration")
    expect(res.headers.get("location")).toBeNull()
    expect(res.status).toBe(200)
  })
})

describe("middleware : adresse inexistante sans session (audit SEO du 2026-11-09)", () => {
  it("une page inconnue n'est plus redirigée vers /login mais réécrite vers le 404", () => {
    session.courante = null
    const res = visiter("https://gleba.fr/page-qui-nexiste-pas")
    expect(res.headers.get("location")).toBeNull()
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://gleba.fr/_introuvable")
  })

  it("la requête réécrite n'est pas réécrite à nouveau (boucle sans fin en production)", () => {
    session.courante = null
    const res = visiter("https://gleba.fr/_introuvable")
    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
    expect(res.headers.get("location")).toBeNull()
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("une page applicative existante garde la redirection vers la connexion", () => {
    session.courante = null
    expect(visiter("https://gleba.fr/maraichage/xyz").status).toBe(307)
    expect(visiter("https://gleba.fr/boutique").status).toBe(307)
  })

  it("une API inconnue répond toujours 401 JSON", () => {
    session.courante = null
    expect(visiter("https://gleba.fr/api/inconnue").status).toBe(401)
  })

  it("avec une session, rien ne change", () => {
    session.courante = { user: { id: "u1", role: "USER" } }
    const res = visiter("https://gleba.fr/page-qui-nexiste-pas")
    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
    expect(res.status).toBe(200)
  })
})

describe("middleware : photos envoyées d'une autre exploitation (revue de sécurité du 2026-11-11)", () => {
  const FICHIER = "0f8fad5b-d9cb-469f-a165-70867728950e-1200.jpg"
  const demander = (chemin: string) => (middleware as unknown as (req: NextRequest) => Response)(new NextRequest("http://localhost" + chemin))

  it("laisse le propriétaire du dossier lire sa photo en direct", () => {
    session.courante = { user: { id: "compte-a", role: "USER" } }
    const reponse = demander(`/uploads/compte-a/${FICHIER}`)
    expect(reponse.headers.get("x-middleware-rewrite")).toBeNull()
    expect(reponse.headers.get("x-middleware-next")).toBe("1")
  })

  it("confie à la route contrôlée la photo d'un dossier qui n'est pas celui de la personne connectée", () => {
    session.courante = { user: { id: "compte-a", role: "USER" } }
    const reponse = demander(`/uploads/compte-b/${FICHIER}`)
    expect(reponse.headers.get("x-middleware-rewrite")).toBe(`http://localhost/api/upload/photo/compte-b/${FICHIER}`)
  })

  it("transmet à la route réécrite le contexte de la destination, que la garde d'abonnement laisse passer", async () => {
    const { ENTETE_CHEMIN, ENTETE_METHODE, operationPermise } = await import("@/lib/abonnement/requetes")
    const { accesGratuit } = await import("@/lib/abonnement/politique")
    session.courante = { user: { id: "compte-a", role: "USER" } }
    const reponse = demander(`/uploads/compte-b/${FICHIER}`)
    // Next transmet les en-têtes de requête modifiés sous ce préfixe.
    const transmis = (nom: string) => reponse.headers.get("x-middleware-request-" + nom)
    expect(transmis(ENTETE_CHEMIN)).toBe(`/api/upload/photo/compte-b/${FICHIER}`)
    expect(transmis(ENTETE_METHODE)).toBe("GET")
    expect(operationPermise(accesGratuit("gratuit"), transmis(ENTETE_CHEMIN)!, transmis(ENTETE_METHODE)!)).toBe(true)
    // Témoin : avec le chemin d'origine, la même garde refusait.
    expect(operationPermise(accesGratuit("gratuit"), `/uploads/compte-b/${FICHIER}`, "GET")).toBe(false)
  })

  it("garde le refus des anciens justificatifs d'un autre compte et le renvoi d'un visiteur vers la connexion", () => {
    session.courante = { user: { id: "compte-a", role: "USER" } }
    expect(demander("/uploads/compte-b/justificatifs/a.pdf").status).toBe(404)
    session.courante = null
    const reponse = demander(`/uploads/compte-b/${FICHIER}`)
    expect(reponse.status).toBe(307)
    expect(reponse.headers.get("x-middleware-rewrite")).toBeNull()
  })
})
