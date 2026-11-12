/**
 * SEC-01 (revue Codex du 2026-11-12) : un lien « Mot de passe oublié » émis
 * avant un changement de mot de passe ne doit plus rien pouvoir écraser.
 *
 * Les trois chemins qui posent un mot de passe (changement depuis Paramètres,
 * réinitialisation par lien, réglage par un administrateur) tournent ici sur
 * une même fausse table `user` qui applique les clauses `where` comme
 * PostgreSQL : une écriture conditionnelle dont la condition ne tient plus
 * n'écrit rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

type Utilisateur = {
  id: string
  email: string
  password: string | null
  active: boolean
  role: "USER" | "ADMIN"
  apiToken: string | null
  resetPasswordToken: string | null
  resetPasswordExpires: Date | null
}

const etat = vi.hoisted(() => ({
  table: new Map<string, Utilisateur>(),
  // Point d'entrelacement : appelé juste après la lecture du jeton par
  // reset-password, pour simuler une écriture concurrente.
  apresLectureJeton: null as null | (() => Promise<void>),
  session: { user: { id: "u1", acteurId: "u1", email: "x@example.com", role: "USER" } },
}))

function correspond(u: Utilisateur, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([cle, attendu]) => {
    const valeur = (u as Record<string, unknown>)[cle]
    if (attendu && typeof attendu === "object" && !(attendu instanceof Date)) {
      const filtre = attendu as { gt?: Date }
      if (filtre.gt) return valeur instanceof Date && valeur > filtre.gt
      return false
    }
    if (attendu instanceof Date) return valeur instanceof Date && valeur.getTime() === attendu.getTime()
    return valeur === attendu
  })
}

vi.mock("@/lib/prisma", () => {
  const user = {
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      for (const u of etat.table.values()) if (correspond(u, where)) return { ...u }
      return null
    }),
    update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Utilisateur> }) => {
      const u = [...etat.table.values()].find((x) => correspond(x, where))
      if (!u) throw new Error("P2025 : enregistrement introuvable")
      Object.assign(u, data)
      return { ...u }
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Utilisateur> }) => {
      let count = 0
      for (const u of etat.table.values()) {
        if (correspond(u, where)) {
          Object.assign(u, data)
          count++
        }
      }
      return { count }
    }),
  }
  return { default: { user } }
})

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: async () => ({ error: null, session: etat.session }),
  requireAdminApi: async () => ({ error: null, session: { user: { id: "admin", role: "ADMIN" } } }),
  hashPassword: async (mdp: string) => `hash:${mdp}`,
  verifyPassword: async (mdp: string, hash: string) => hash === `hash:${mdp}`,
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => null,
  getClientIP: () => "127.0.0.1",
}))
vi.mock("@/lib/abonnement/stripe", () => ({ arreterAvantSuppression: vi.fn() }))
vi.mock("@/lib/account-lifecycle", () => ({
  COMMUNAUTE_USER_ID: "communaute",
  reprendreReferentielCommunaute: vi.fn(),
  supprimerDonneesSansCleEtrangere: vi.fn(),
  supprimerFichiersUtilisateur: vi.fn(),
}))

import prisma from "@/lib/prisma"
import { POST as reinitialiser } from "./route"
import { POST as changer } from "../change-password/route"
import { PATCH as patchAdmin } from "../../admin/users/[id]/route"

const JETON = "jeton-emis-avant-le-changement"

function requeteJson(url: string, corps: unknown, methode = "POST") {
  return new NextRequest(url, {
    method: methode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })
}

const demandeReinit = (password: string) =>
  requeteJson("http://localhost/api/auth/reset-password", { token: JETON, password })
const demandeChangement = () =>
  requeteJson("http://localhost/api/auth/change-password", {
    currentPassword: "ancien-mot-de-passe",
    newPassword: "nouveau-mot-de-passe",
  })

function utilisateur(): Utilisateur {
  return etat.table.get("u1")!
}

beforeEach(() => {
  etat.table.clear()
  etat.apresLectureJeton = null
  etat.table.set("u1", {
    id: "u1",
    email: "maraicher@example.com",
    password: "hash:ancien-mot-de-passe",
    active: true,
    role: "USER",
    apiToken: "glb_jeton",
    resetPasswordToken: JETON,
    resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
  })
  const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
  const original = findUnique.getMockImplementation()!
  findUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const resultat = await original(args)
    if ("resetPasswordToken" in args.where && etat.apresLectureJeton) {
      const crochet = etat.apresLectureJeton
      etat.apresLectureJeton = null
      await crochet()
    }
    return resultat
  })
})

describe("SEC-01 : jeton de réinitialisation et changement de mot de passe", () => {
  it("le changement depuis Paramètres invalide le lien émis avant", async () => {
    const res = await changer(demandeChangement())
    expect(res.status).toBe(200)
    expect(utilisateur().resetPasswordToken).toBeNull()
    expect(utilisateur().resetPasswordExpires).toBeNull()

    const reinit = await reinitialiser(demandeReinit("mot-de-passe-de-l-attaquant"))
    expect(reinit.status).toBe(400)
    expect(utilisateur().password).toBe("hash:nouveau-mot-de-passe")
  })

  it("le réglage par un administrateur invalide le lien émis avant", async () => {
    const res = await patchAdmin(
      requeteJson("http://localhost/api/admin/users/u1", { password: "pose-par-admin-123" }, "PATCH"),
      { params: Promise.resolve({ id: "u1" }) }
    )
    expect(res.status).toBe(200)
    expect(utilisateur().resetPasswordToken).toBeNull()

    const reinit = await reinitialiser(demandeReinit("mot-de-passe-de-l-attaquant"))
    expect(reinit.status).toBe(400)
    expect(utilisateur().password).toBe("hash:pose-par-admin-123")
  })

  it("un changement survenu entre la lecture du jeton et l'écriture fait échouer la réinitialisation", async () => {
    etat.apresLectureJeton = async () => {
      const res = await changer(demandeChangement())
      expect(res.status).toBe(200)
    }

    const reinit = await reinitialiser(demandeReinit("mot-de-passe-de-l-attaquant"))

    expect(reinit.status).toBe(400)
    expect(utilisateur().password).toBe("hash:nouveau-mot-de-passe")
  })

  it("deux réinitialisations concurrentes avec le même lien : une seule passe", async () => {
    etat.apresLectureJeton = async () => {
      const premiere = await reinitialiser(demandeReinit("premier-mot-de-passe"))
      expect(premiere.status).toBe(200)
    }

    const seconde = await reinitialiser(demandeReinit("second-mot-de-passe"))

    expect(seconde.status).toBe(400)
    expect(utilisateur().password).toBe("hash:premier-mot-de-passe")
    expect(utilisateur().resetPasswordToken).toBeNull()
  })

  it("une réinitialisation entre la vérification du mot de passe actuel et l'écriture fait échouer le changement", async () => {
    // Le changement a lu l'ancien hash ; la réinitialisation le remplace
    // avant l'écriture : le changement ne doit pas écraser ce nouveau mot de passe.
    const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
    const precedente = findUnique.getMockImplementation()!
    let fait = false
    findUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      const r = await precedente(args)
      if (!fait && args.where.id === "u1" && "password" in ((args as { select?: object }).select ?? {})) {
        fait = true
        const reinit = await reinitialiser(demandeReinit("reinitialise-par-le-titulaire"))
        expect(reinit.status).toBe(200)
      }
      return r
    })

    const res = await changer(demandeChangement())

    expect(res.status).toBe(409)
    expect(utilisateur().password).toBe("hash:reinitialise-par-le-titulaire")
  })

  it("la réinitialisation légitime marche toujours et révoque jeton et clé d'API", async () => {
    const res = await reinitialiser(demandeReinit("nouveau-mot-de-passe-12"))
    expect(res.status).toBe(200)
    expect(utilisateur()).toMatchObject({
      password: "hash:nouveau-mot-de-passe-12",
      resetPasswordToken: null,
      resetPasswordExpires: null,
      apiToken: null,
    })
  })

  it("un lien expiré est refusé", async () => {
    utilisateur().resetPasswordExpires = new Date(Date.now() - 1000)
    const res = await reinitialiser(demandeReinit("nouveau-mot-de-passe-12"))
    expect(res.status).toBe(400)
    expect(utilisateur().password).toBe("hash:ancien-mot-de-passe")
  })
})
