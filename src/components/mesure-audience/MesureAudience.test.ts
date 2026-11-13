import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"

const simulation = vi.hoisted(() => ({
  chemin: "/tarifs",
  status: "unauthenticated",
  etats: [] as unknown[],
  index: 0,
  effets: [] as Array<() => unknown>,
}))
vi.mock("next/navigation", () => ({ usePathname: () => simulation.chemin }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: simulation.status }) }))
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effet: () => unknown) => { simulation.effets.push(effet) },
  useRef: (initial: unknown) => {
    const index = simulation.index++
    simulation.etats[index] ??= { current: initial }
    return simulation.etats[index]
  },
  useState: (initial: unknown) => {
    const index = simulation.index++
    if (!(index in simulation.etats)) simulation.etats[index] = initial
    return [simulation.etats[index], (valeur: unknown) => { simulation.etats[index] = valeur }]
  },
}))
vi.mock("@/components/ui/button", () => ({ Button: "button" }))
vi.mock("lucide-react", () => ({ Cookie: "svg", X: "svg" }))

import { MesureAudience } from "./MesureAudience"
import { OppositionMesureAudience } from "./OppositionMesureAudience"
import { CookieBanner } from "@/components/CookieBanner"
import { CLE_CHOIX_COOKIES } from "@/lib/consentement-cookies"
import { estPageMesuree } from "@/lib/mesure-audience/pages"

function rendre<T>(composant: () => T): T {
  simulation.index = 0
  simulation.effets = []
  const resultat = composant()
  for (const effet of simulation.effets) effet()
  return resultat
}

type Element = ReactElement<{ children?: unknown; onClick?: () => Promise<void> | void }>
function trouverBouton(arbre: unknown, libelle: string): Element | undefined {
  if (Array.isArray(arbre)) {
    for (const enfant of arbre) {
      const bouton = trouverBouton(enfant, libelle)
      if (bouton) return bouton
    }
  } else if (arbre && typeof arbre === "object" && "props" in arbre) {
    const element = arbre as Element
    if (element.type === "button" && element.props.children === libelle) return element
    return trouverBouton(element.props.children, libelle)
  }
}

const requete = vi.fn<typeof fetch>()
let stockage: Map<string, string>
beforeEach(() => {
  simulation.chemin = "/tarifs"
  simulation.status = "unauthenticated"
  simulation.etats = []
  stockage = new Map()
  vi.stubGlobal("localStorage", {
    getItem: (cle: string) => stockage.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => { stockage.set(cle, valeur) },
  })
  vi.stubGlobal("window", Object.assign(new EventTarget(), {
    location: { origin: "https://gleba.example", search: "?token=secret", hash: "#secret" },
  }))
  vi.stubGlobal("navigator", { doNotTrack: "0" })
  vi.stubGlobal("document", { referrer: "", title: "Titre privé à ne pas transmettre" })
  vi.stubGlobal("fetch", requete)
  requete.mockReset().mockResolvedValue({} as Response)
  vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", "https://mesure.example/statistiques/")
  vi.stubEnv("NEXT_PUBLIC_MATOMO_SITE_ID", "7")
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("mesure des seules pages publiques sans session", () => {
  it.each(["authenticated", "loading"])("aucun appel si la session est %s, même sur /confidentialite", (status) => {
    simulation.status = status
    for (const chemin of ["/", "/tarifs", "/aujourdhui", "/confidentialite"]) {
      simulation.chemin = chemin
      rendre(MesureAudience)
    }
    expect(requete).not.toHaveBeenCalled()
  })

  it.each([
    "/reset-password", "/reset-password/jeton", "/desabonnement", "/desabonnement/jeton",
    "/feedback", "/feedback/jeton", "/impersonation", "/impersonation/consume",
    "/aujourdhui", "/boutique/ferme/suivi/numero-prive",
  ])("aucun appel sur %s sans session", (chemin) => {
    simulation.chemin = chemin
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it("envoie une seule page vue sans cookie, paramètres, fragment, titre privé ou référent interne", () => {
    vi.stubGlobal("document", { referrer: "https://gleba.example/reset-password?token=secret" })
    rendre(MesureAudience)
    rendre(MesureAudience) // Réexécution d'effet, notamment en StrictMode.
    expect(requete).toHaveBeenCalledTimes(1)
    const [url, options] = requete.mock.calls[0]
    expect(url).toBe("https://mesure.example/statistiques/matomo.php")
    expect(options).toMatchObject({ method: "POST", credentials: "omit", mode: "no-cors", referrerPolicy: "no-referrer" })
    const parametres = options?.body as URLSearchParams
    expect(Object.fromEntries(parametres)).toEqual({
      idsite: "7", rec: "1", apiv: "1", url: "https://gleba.example/tarifs",
      action_name: "/tarifs", cookie: "0", send_image: "0",
    })
  })

  it("compte une nouvelle visite après un passage par une page exclue", () => {
    rendre(MesureAudience)
    simulation.chemin = "/feedback/jeton"
    rendre(MesureAudience)
    simulation.chemin = "/tarifs"
    rendre(MesureAudience)
    expect(requete).toHaveBeenCalledTimes(2)
  })

  it("ne transmet que l'origine du référent externe", () => {
    vi.stubGlobal("document", { referrer: "https://recherche.example/prive?token=secret#fragment" })
    rendre(MesureAudience)
    const body = requete.mock.calls[0][1]?.body as URLSearchParams
    expect(body.get("urlref")).toBe("https://recherche.example")
    expect(body.toString()).not.toContain("secret")
  })

  it("cesse les appels après connexion et pendant la résolution de session", () => {
    rendre(MesureAudience)
    simulation.status = "loading"
    simulation.chemin = "/login"
    rendre(MesureAudience)
    simulation.status = "authenticated"
    rendre(MesureAudience)
    simulation.chemin = "/confidentialite"
    rendre(MesureAudience)
    expect(requete).toHaveBeenCalledTimes(1)
  })

  it.each(["/boutique/ferme", "/boutique/ferme/produit/12", "/tarifs", "/"])("conserve la page publique %s", (chemin) => {
    expect(estPageMesuree(chemin)).toBe(true)
  })

  it.each(["1", "yes"])("respecte Ne pas me pister (%s)", (doNotTrack) => {
    vi.stubGlobal("navigator", { doNotTrack })
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it("respecte Global Privacy Control", () => {
    vi.stubGlobal("navigator", { globalPrivacyControl: true })
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it.each(["", "http://mesure.example/", "invalide", "https://login:secret@mesure.example/", "https://mesure.example/?token=secret"])("aucun appel avec URL absente ou invalide : %s", (adresse) => {
    vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", adresse)
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it.each(["", "0", "abc"])("aucun appel avec identifiant de site invalide : %s", (id) => {
    vi.stubEnv("NEXT_PUBLIC_MATOMO_SITE_ID", id)
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it("ne bloque pas la navigation si Matomo est indisponible", async () => {
    requete.mockRejectedValue(new Error("Réseau indisponible"))
    expect(() => rendre(MesureAudience)).not.toThrow()
    await Promise.resolve()
  })
})

describe("opposition depuis les commandes réellement affichées", () => {
  it("un refus mémorisé interdit tout appel après rechargement", () => {
    stockage.set(CLE_CHOIX_COOKIES, JSON.stringify({ analytics: false }))
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it.each(["Tout refuser", "Enregistrer mes choix"])("%s bloque immédiatement, même si l'enregistrement serveur attend", async (libelle) => {
    rendre(CookieBanner)
    let arbre = rendre(CookieBanner)
    if (libelle === "Enregistrer mes choix") {
      trouverBouton(arbre, "Personnaliser")!.props.onClick!()
      arbre = rendre(CookieBanner)
    }
    let terminer!: (response: Response) => void
    requete.mockImplementation(() => new Promise((resolve) => { terminer = resolve }))
    const enregistrement = trouverBouton(arbre, libelle)!.props.onClick!()
    expect(JSON.parse(stockage.get(CLE_CHOIX_COOKIES)!)).toMatchObject({ analytics: false })
    simulation.etats = [] // Le tracker possède ses propres hooks.
    rendre(MesureAudience)
    expect(requete).toHaveBeenCalledTimes(1)
    expect(requete.mock.calls[0][0]).toBe("/api/cookie-consent")
    terminer({} as Response)
    await enregistrement
    simulation.etats = [] // Rechargement avec choix local conservé.
    rendre(MesureAudience)
    expect(requete).toHaveBeenCalledTimes(1)
  })

  it("le bouton de confidentialité refuse sans requête Matomo et conserve les autres choix", () => {
    stockage.set(CLE_CHOIX_COOKIES, JSON.stringify({ marketing: false, personnalisation: true }))
    rendre(OppositionMesureAudience)
    const arbre = rendre(OppositionMesureAudience)
    trouverBouton(arbre, "M’opposer à la mesure d’audience")!.props.onClick!()
    expect(JSON.parse(stockage.get(CLE_CHOIX_COOKIES)!)).toEqual({ analytics: false, marketing: false, personnalisation: true })
    simulation.etats = []
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })

  it("ne contourne pas un stockage inaccessible ou illisible", () => {
    stockage.set(CLE_CHOIX_COOKIES, "illisible")
    rendre(MesureAudience)
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Stockage inaccessible") } })
    rendre(MesureAudience)
    expect(requete).not.toHaveBeenCalled()
  })
})
