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

const { default: middleware } = await import("./middleware")

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
