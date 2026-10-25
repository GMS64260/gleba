import { describe, expect, it } from "vitest"
import { cheminDeRetour, cibleApresConnexion, redirectionApresConnexion, urlConnexion } from "./auth-retour"

// QA cmvnout4y (2026-10-25) — déconnecté, `https://gleba.fr/elevage?tab=alimentation&sub=soins`
// menait à `/login?callbackUrl=%2Felevage` puis, après connexion, à `/elevage`
// sans `tab` ni `sub`.

const LIEN_DU_TICKET = "/elevage?tab=alimentation&sub=soins"
const SITE = "https://gleba.fr"

describe("urlConnexion : le lien de connexion garde la requête", () => {
  it("rejoue le ticket : le callbackUrl porte le chemin ET la requête", () => {
    const lien = urlConnexion(LIEN_DU_TICKET)
    expect(lien).toBe("/login?callbackUrl=%2Felevage%3Ftab%3Dalimentation%26sub%3Dsoins")
    // Ce que relit la page de connexion.
    const relu = new URL(lien, SITE).searchParams.get("callbackUrl")
    expect(relu).toBe(LIEN_DU_TICKET)
    expect(cheminDeRetour(relu)).toBe(LIEN_DU_TICKET)
  })

  it("garde une requête encodée intacte (espaces, accents, ancre)", () => {
    const cible = "/taches?year=2027&q=pomme%20de%20terre&vue=r%C3%A9colte#semaine"
    const relu = new URL(urlConnexion(cible), SITE).searchParams.get("callbackUrl")
    expect(relu).toBe(cible)
  })

  it("une cible hors du site donne la page de connexion seule", () => {
    expect(urlConnexion("//ailleurs.example/piege")).toBe("/login")
    expect(urlConnexion("https://ailleurs.example")).toBe("/login")
  })
})

describe("cheminDeRetour : seule une cible du site est suivie", () => {
  it.each([
    ["/elevage", "/elevage"],
    [LIEN_DU_TICKET, LIEN_DU_TICKET],
    ["/meteo#calendrier-lunaire", "/meteo#calendrier-lunaire"],
    ["/", "/"],
  ])("accepte le chemin relatif %s", (valeur, attendu) => {
    expect(cheminDeRetour(valeur)).toBe(attendu)
  })

  it.each([
    ["absent", null],
    ["vide", ""],
    ["protocole relatif", "//ailleurs.example"],
    ["protocole relatif avec chemin", "//ailleurs.example/elevage?tab=soins"],
    ["barre oblique inverse", "/\\ailleurs.example"],
    ["barres obliques inverses", "\\\\ailleurs.example"],
    ["tabulation que le navigateur retire", "/\t/ailleurs.example"],
    ["saut de ligne que le navigateur retire", "/\n/ailleurs.example"],
    ["espace de tête", " //ailleurs.example"],
    ["point qui se normalise en //", "/.//ailleurs.example"],
    ["URL absolue https", "https://ailleurs.example/elevage"],
    ["URL absolue http", "http://ailleurs.example"],
    ["javascript:", "javascript:alert(document.cookie)"],
    ["JavaScript: en casse mêlée", "JaVaScRiPt:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
  ])("refuse %s", (_cas, valeur) => {
    expect(cheminDeRetour(valeur)).toBeNull()
  })

  it("sans origine connue, refuse même une URL absolue du site", () => {
    expect(cheminDeRetour("https://gleba.fr/elevage")).toBeNull()
  })

  it("avec l'origine du site, ramène une URL absolue du site à son chemin", () => {
    expect(cheminDeRetour(`${SITE}${LIEN_DU_TICKET}`, SITE)).toBe(LIEN_DU_TICKET)
    expect(cheminDeRetour("https://gleba.fr.ailleurs.example/elevage", SITE)).toBeNull()
    expect(cheminDeRetour("http://gleba.fr/elevage", SITE)).toBeNull()
  })
})

describe("cibleApresConnexion : page suivie par le formulaire après signIn", () => {
  // Paramètres tels que le formulaire les reçoit de `useSearchParams()` sur /login.
  const parametresDe = (urlLogin: string) => new URL(urlLogin, SITE).searchParams

  it("rejoue le ticket : le lien posé par le middleware ramène au bon onglet", () => {
    expect(cibleApresConnexion(parametresDe(urlConnexion(LIEN_DU_TICKET)), SITE)).toBe(LIEN_DU_TICKET)
  })

  it("sans callbackUrl, l'accueil", () => {
    expect(cibleApresConnexion(parametresDe("/login"), SITE)).toBe("/")
    expect(cibleApresConnexion(parametresDe("/login?callbackUrl="), SITE)).toBe("/")
    expect(cibleApresConnexion(parametresDe("/login?demo=1"))).toBe("/")
  })

  it("un chemin relatif garde sa requête, même sans origine connue (rendu serveur)", () => {
    expect(cibleApresConnexion(parametresDe("/login?callbackUrl=%2Ftaches%3Fyear%3D2027"))).toBe("/taches?year=2027")
  })

  it("une URL absolue du site (forme d'Auth.js) est ramenée à son chemin", () => {
    const lien = `/login?callbackUrl=${encodeURIComponent(`${SITE}${LIEN_DU_TICKET}`)}`
    expect(cibleApresConnexion(parametresDe(lien), SITE)).toBe(LIEN_DU_TICKET)
  })

  it.each([
    "/login?callbackUrl=//ailleurs.example",
    "/login?callbackUrl=%2F%2Failleurs.example%2Fpiege",
    "/login?callbackUrl=https://ailleurs.example/elevage",
    "/login?callbackUrl=https%3A%2F%2Failleurs.example",
    "/login?callbackUrl=%2F%5Cailleurs.example",
    "/login?callbackUrl=javascript:alert(1)",
  ])("hors du site, l'accueil : %s", (lien) => {
    expect(cibleApresConnexion(parametresDe(lien), SITE)).toBe("/")
  })
})

describe("redirectionApresConnexion : callback redirect d'Auth.js", () => {
  it("garde la requête d'un chemin relatif (retour de Google)", () => {
    expect(redirectionApresConnexion({ url: LIEN_DU_TICKET, baseUrl: SITE })).toBe(`${SITE}${LIEN_DU_TICKET}`)
  })

  it("garde une URL absolue du site (cookie de callback d'Auth.js)", () => {
    expect(redirectionApresConnexion({ url: `${SITE}${LIEN_DU_TICKET}`, baseUrl: SITE })).toBe(`${SITE}${LIEN_DU_TICKET}`)
  })

  it("laisse passer le refus du callback signIn et les déconnexions", () => {
    expect(redirectionApresConnexion({ url: "/login?error=google", baseUrl: SITE })).toBe(`${SITE}/login?error=google`)
    expect(redirectionApresConnexion({ url: "/login", baseUrl: SITE })).toBe(`${SITE}/login`)
  })

  it.each(["//ailleurs.example", "https://ailleurs.example/x", "/\\ailleurs.example", "javascript:alert(1)", "http://"])(
    "renvoie à l'accueil du site pour %s",
    (url) => {
      expect(redirectionApresConnexion({ url, baseUrl: SITE })).toBe(`${SITE}/`)
    },
  )
})
