/**
 * SEC-01 (revue Codex du 2026-11-12) : un lien « Mot de passe oublié » émis
 * avant un changement de mot de passe ne doit plus rien pouvoir écraser.
 *
 * Les chemins publics qui posent un mot de passe (changement depuis
 * Paramètres, réinitialisation par lien) tournent ici sur une même fausse
 * table `user` qui applique les clauses `where` comme PostgreSQL : une
 * écriture conditionnelle dont la condition ne tient plus n'écrit rien. Le
 * réglage par un administrateur (route de la zone privée) est couvert sur la
 * même table par `src/app/api/admin/users/[id]/revocation-jeton.test.ts` :
 * séparé pour que ce fichier reste dans le dépôt public (livraison du
 * 2026-11-16).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", async () => (await import("@/lib/__tests__/fixtures/table-utilisateurs-mot-de-passe")).modulePrismaFactice)
vi.mock("@/lib/auth-utils", async () => (await import("@/lib/__tests__/fixtures/table-utilisateurs-mot-de-passe")).moduleAuthUtilsFactice)
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => null,
  getClientIP: () => "127.0.0.1",
}))

import prisma from "@/lib/prisma"
import {
  demandeReinit,
  etat,
  reinitialiserTable,
  requeteJson,
  utilisateur,
} from "@/lib/__tests__/fixtures/table-utilisateurs-mot-de-passe"
import { POST as reinitialiser } from "./route"
import { POST as changer } from "../change-password/route"

const demandeChangement = () =>
  requeteJson("http://localhost/api/auth/change-password", {
    currentPassword: "ancien-mot-de-passe",
    newPassword: "nouveau-mot-de-passe",
  })

beforeEach(reinitialiserTable)

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
      sessionVersion: 1,
    })
  })

  it("un lien expiré est refusé", async () => {
    utilisateur().resetPasswordExpires = new Date(Date.now() - 1000)
    const res = await reinitialiser(demandeReinit("nouveau-mot-de-passe-12"))
    expect(res.status).toBe(400)
    expect(utilisateur().password).toBe("hash:ancien-mot-de-passe")
  })
})
