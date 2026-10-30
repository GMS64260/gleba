import { describe, expect, it, vi } from "vitest"
import { Auth, type AuthConfig } from "@auth/core"

// Inscription Google du 2026-10-27 : un second retour de Google, une seconde
// après celui qui avait créé le compte, a échoué au contrôle PKCE
// (`InvalidCheck`) et a mené à la page d'erreur par défaut d'Auth.js, en
// anglais. Toute erreur hors de la liste « client » d'Auth.js suit
// `pages.error` : on rejoue ce chemin avec la configuration réelle de Gleba.
const capture = vi.hoisted(() => ({ config: null as AuthConfig | null }))
vi.mock("next-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-auth")>()),
  default: (config: AuthConfig) => {
    capture.config = config
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }
  },
}))
vi.mock("./prisma", () => ({ default: {} }))

await import("./auth")

function demander(chemin: string) {
  return Auth(new Request("https://gleba.fr" + chemin), {
    ...capture.config!,
    secret: "secret-de-test-auth-erreur",
    trustHost: true,
    basePath: "/api/auth",
  })
}

describe("erreurs Auth.js : retour sur la page de connexion", () => {
  it("une erreur serveur d'Auth.js renvoie vers /login?error=Configuration, pas vers la page anglaise", async () => {
    const reponse = await demander("/api/auth/error?error=Configuration")
    expect(reponse.status).toBe(302)
    const destination = new URL(reponse.headers.get("location")!, "https://gleba.fr")
    expect(destination.pathname).toBe("/login")
    expect(destination.searchParams.get("error")).toBe("Configuration")
    expect(await reponse.text()).not.toMatch(/Server error/)
  })
})
