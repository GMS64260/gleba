import { describe, expect, it } from "vitest"
import { sansCookieSessionRecopie } from "./session-cookie-recopie"

const requete = (destination?: string) => ({ headers: new Headers(destination ? { "sec-fetch-dest": destination } : {}) })
const reponse = (...cookies: string[]) => {
  const r = new Response(null, { status: 200 })
  for (const c of cookies) r.headers.append("set-cookie", c)
  return r
}
const SESSION = "__Secure-authjs.session-token=ancien.jeton; Path=/; HttpOnly; Secure; SameSite=Lax"

describe("cookie de session recopié par Auth.js (équipe debug, D198)", () => {
  it("le retire d'une réponse à un appel fait par une page déjà ouverte", () => {
    const r = sansCookieSessionRecopie(requete("empty"), reponse(SESSION, "autre=1; Path=/"))
    expect(r.headers.getSetCookie()).toEqual(["autre=1; Path=/"])
  })

  it("retire aussi les morceaux d'un jeton découpé et le nom sans préfixe", () => {
    const r = sansCookieSessionRecopie(requete("empty"), reponse("authjs.session-token.0=a; Path=/", "authjs.session-token.1=b; Path=/"))
    expect(r.headers.getSetCookie()).toEqual([])
  })

  it("le garde sur une navigation de document : la session continue de se prolonger", () => {
    expect(sansCookieSessionRecopie(requete("document"), reponse(SESSION)).headers.getSetCookie()).toEqual([SESSION])
  })

  it("ne retire rien sans en-tête de destination", () => {
    expect(sansCookieSessionRecopie(requete(), reponse(SESSION)).headers.getSetCookie()).toEqual([SESSION])
  })

  it("laisse passer une suppression du cookie de session", () => {
    const suppression = "__Secure-authjs.session-token=; Path=/; Max-Age=0"
    expect(sansCookieSessionRecopie(requete("empty"), reponse(suppression)).headers.getSetCookie()).toEqual([suppression])
  })

  it("ne touche pas aux autres cookies d'Auth.js", () => {
    const csrf = "__Host-authjs.csrf-token=x; Path=/"
    expect(sansCookieSessionRecopie(requete("empty"), reponse(csrf)).headers.getSetCookie()).toEqual([csrf])
  })
})
