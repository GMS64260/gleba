/**
 * Plafond des essais de connexion (MC4). L'invariant : au-delà du plafond,
 * `authorize` refuse AVANT la recherche du compte et avant bcrypt, et le refus
 * est le même que le mot de passe soit juste ou faux, que le compte existe ou
 * non.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    account: { create: vi.fn() },
    loginLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async (a: string, b: string) => a === b) },
}))

import bcrypt from "bcryptjs"
import { CredentialsSignin } from "next-auth"
import prisma from "@/lib/prisma"
import { authorizeCredentials } from "@/lib/auth"
import { REFUS_CONNEXION, messageRefusConnexion } from "@/lib/auth-refus"
import { getClientIP } from "@/lib/ip-client"
import {
  PLAFOND_CONNEXION,
  autoriserEssaiConnexion,
  reinitialiserPlafondConnexion,
  solderEssaisConnexion,
} from "@/lib/auth-plafond"

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> }
  loginLog: { create: ReturnType<typeof vi.fn> }
}
const compare = bcrypt.compare as unknown as ReturnType<typeof vi.fn>

const EMAIL = "jean.dupont@example.com"
const compte = {
  id: "u1",
  email: EMAIL,
  name: "Jean",
  role: "USER",
  active: true,
  emailVerified: true,
  password: "le-bon-mot-de-passe",
}

/** `xff` : la dernière valeur est celle qu'ajoute Caddy (l'IP réelle). */
const requete = (xff = "203.0.113.7") =>
  new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: { "x-forwarded-for": xff },
  })

const essai = (password: string, email = EMAIL, xff?: string) =>
  authorizeCredentials({ email, password }, requete(xff))

async function refus(promesse: Promise<unknown>) {
  try {
    await promesse
  } catch (e) {
    return e as CredentialsSignin & { code: string }
  }
  throw new Error("la connexion aurait dû être refusée")
}

async function epuiser(email = EMAIL, xff?: string) {
  for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE; i++) {
    const e = await refus(essai("faux", email, xff))
    expect(e.code).toBe(REFUS_CONNEXION.IDENTIFIANTS)
  }
}

/**
 * Le refus du plafond porte le même code qu'un mot de passe erroné : ce qui le
 * distingue, côté serveur seulement, est qu'il ne cherche pas le compte.
 */
async function attendreBlocage(promesse: Promise<unknown>) {
  mocked.user.findUnique.mockClear()
  compare.mockClear()
  const e = await refus(promesse)
  expect(e.code).toBe(REFUS_CONNEXION.IDENTIFIANTS)
  expect(mocked.user.findUnique).not.toHaveBeenCalled()
  expect(compare).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  reinitialiserPlafondConnexion()
  mocked.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) =>
    where.email === EMAIL ? compte : null
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe("authorizeCredentials — plafond des essais", () => {
  it("journalise l'IP de getClientIP utilisée par le plafond malgré une première IP forgée", async () => {
    const xff = "1.2.3.4, 203.0.113.7"
    const ip = getClientIP(requete(xff))
    expect(ip).toBe("203.0.113.7")
    await refus(essai("faux", EMAIL, xff))
    // Les autres essais épuisent la même clé, sans l'en-tête forgé.
    for (let i = 1; i < PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE; i++) {
      await refus(essai("faux", EMAIL, ip))
    }
    await attendreBlocage(essai("faux", EMAIL, xff))
    expect(mocked.loginLog.create.mock.calls.map(([appel]) => appel.data.ip)).toEqual(
      Array(PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE + 1).fill(ip)
    )
    expect(mocked.loginLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({
      ip,
      reason: "rate_limited",
    }) })
  })

  it("au-delà du plafond, refuse sans chercher le compte ni appeler bcrypt", async () => {
    await epuiser()
    expect(compare).toHaveBeenCalledTimes(PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE)
    compare.mockClear()
    mocked.user.findUnique.mockClear()

    const e = await refus(essai("faux"))
    expect(e.code).toBe(REFUS_CONNEXION.IDENTIFIANTS)
    expect(compare).not.toHaveBeenCalled()
    expect(mocked.user.findUnique).not.toHaveBeenCalled()

    // Le bon mot de passe est refusé de la même façon, toujours sans bcrypt.
    const bon = await refus(essai("le-bon-mot-de-passe"))
    expect(bon.code).toBe(REFUS_CONNEXION.IDENTIFIANTS)
    expect(compare).not.toHaveBeenCalled()
    expect(mocked.user.findUnique).not.toHaveBeenCalled()
  })

  it("le refus est identique à celui d'un mauvais mot de passe, que le mot de passe soit juste ou le compte inconnu", async () => {
    const mauvais = await refus(essai("faux", EMAIL, "198.51.100.1"))

    await epuiser()
    await epuiser("inconnu@example.com")
    const avecFaux = await refus(essai("faux"))
    const avecBon = await refus(essai("le-bon-mot-de-passe"))
    const inconnu = await refus(essai("faux", "inconnu@example.com"))

    // Tout ce qu'Auth.js transmet au client (classe, type, code, donc l'URL
    // de redirection et le message du formulaire) est identique.
    for (const e of [avecFaux, avecBon, inconnu]) {
      expect(e).toBeInstanceOf(CredentialsSignin)
      expect(e.constructor).toBe(mauvais.constructor)
      expect(e.type).toBe(mauvais.type)
      expect(e.code).toBe(mauvais.code)
      expect(e.message).toBe(mauvais.message)
      expect(messageRefusConnexion(e.code)).toBe("Adresse email ou mot de passe incorrect.")
    }
    expect(compare).toHaveBeenCalledTimes(1 + PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE)
  })

  it("aucun motif de refus propre au plafond n'est exposé au client", () => {
    expect(Object.values(REFUS_CONNEXION).join(" ")).not.toMatch(/essai|plafond|limit/i)
  })

  it("le bon mot de passe est accepté une fois la fenêtre écoulée", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-13T08:00:00Z"))
    await epuiser()
    await attendreBlocage(essai("le-bon-mot-de-passe"))

    vi.setSystemTime(new Date(Date.now() + PLAFOND_CONNEXION.FENETRE_MS - 1000))
    await attendreBlocage(essai("le-bon-mot-de-passe"))

    vi.setSystemTime(new Date(Date.now() + 1000))
    await expect(essai("le-bon-mot-de-passe")).resolves.toMatchObject({ id: "u1" })
  })

  it("le compteur suit l'adresse normalisée", async () => {
    for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE; i++) {
      await refus(essai("faux", i % 2 ? "  Jean.Dupont@Example.com " : EMAIL))
    }
    await attendreBlocage(essai("faux", "JEAN.DUPONT@example.com"))
  })

  it("l'IP comptée est la dernière de X-Forwarded-For : varier la première ne contourne rien", async () => {
    for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE; i++) {
      await refus(essai("faux", EMAIL, `10.0.0.${i}, 203.0.113.7`))
    }
    await attendreBlocage(essai("faux", EMAIL, "10.9.9.9, 203.0.113.7"))
  })

  it("une autre IP ou un autre compte ne sont pas bloqués", async () => {
    await epuiser()
    await attendreBlocage(essai("le-bon-mot-de-passe"))
    // Même adresse depuis une autre IP : le titulaire entre.
    await expect(essai("le-bon-mot-de-passe", EMAIL, "198.51.100.1")).resolves.toMatchObject({ id: "u1" })
    // Autre compte depuis l'IP bloquée pour le premier : l'essai est traité
    // (le compte est bien cherché), il n'est pas refusé par le plafond.
    mocked.user.findUnique.mockClear()
    expect((await refus(essai("faux", "autre@example.com"))).code).toBe(REFUS_CONNEXION.IDENTIFIANTS)
    expect(mocked.user.findUnique).toHaveBeenCalledTimes(1)
    // Et le premier compte reste bloqué depuis la première IP.
    await attendreBlocage(essai("le-bon-mot-de-passe"))
  })

  it("une connexion réussie remet le compteur du compte à zéro", async () => {
    for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE - 1; i++) await refus(essai("faux"))
    await expect(essai("le-bon-mot-de-passe")).resolves.toMatchObject({ id: "u1" })
    compare.mockClear()
    for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE; i++) await refus(essai("faux"))
    expect(compare).toHaveBeenCalledTimes(PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE)
    await attendreBlocage(essai("faux"))
  })

  it("des essais simultanés sont comptés avant bcrypt", async () => {
    const resultats = await Promise.all(
      Array.from({ length: PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE + 5 }, () => refus(essai("faux")))
    )
    expect(resultats).toHaveLength(PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE + 5)
    expect(new Set(resultats.map((e) => e.code))).toEqual(new Set([REFUS_CONNEXION.IDENTIFIANTS]))
    expect(mocked.user.findUnique).toHaveBeenCalledTimes(PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE)
    expect(compare).toHaveBeenCalledTimes(PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE)
  })

  it("journalise le refus sous le motif rate_limited", async () => {
    await epuiser()
    mocked.loginLog.create.mockClear()
    await refus(essai("faux"))
    await new Promise((r) => setTimeout(r, 0))
    expect(mocked.loginLog.create.mock.calls[0]?.[0]?.data).toMatchObject({
      email: EMAIL,
      success: false,
      reason: "rate_limited",
    })
  })
})

describe("plafond par IP seule (liste d'identifiants essayée compte par compte)", () => {
  it("bloque l'IP au-delà de 100 essais, sans toucher les autres IP", () => {
    const t = 1_000_000
    for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP; i++) {
      expect(autoriserEssaiConnexion("203.0.113.7", `c${i}@example.com`, t)).toBe(true)
    }
    expect(autoriserEssaiConnexion("203.0.113.7", "encore@example.com", t)).toBe(false)
    expect(autoriserEssaiConnexion("198.51.100.1", "encore@example.com", t)).toBe(true)
    expect(
      autoriserEssaiConnexion("203.0.113.7", "encore@example.com", t + PLAFOND_CONNEXION.FENETRE_MS)
    ).toBe(true)
  })

  it("une connexion réussie rend son essai à l'IP", () => {
    const t = 1_000_000
    for (let i = 0; i < PLAFOND_CONNEXION.MAX_PAR_IP; i++) {
      autoriserEssaiConnexion("203.0.113.7", `c${i}@example.com`, t)
    }
    solderEssaisConnexion("203.0.113.7", "c0@example.com", t)
    expect(autoriserEssaiConnexion("203.0.113.7", "encore@example.com", t)).toBe(true)
    expect(autoriserEssaiConnexion("203.0.113.7", "encore2@example.com", t)).toBe(false)
  })
})
