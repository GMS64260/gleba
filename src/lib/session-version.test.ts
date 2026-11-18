/**
 * MC3 : rappels Auth.js de la version de session. Le rappel `jwt` déclenché
 * par `update` (POST /api/auth/session, ouvert à tout détenteur du cookie) ne
 * doit jamais modifier la version : sinon une session coupée se rafraîchirait.
 */
import { describe, expect, it } from "vitest"
import { rappelJwt, rappelSession, versionSession } from "./session-version"

describe("version de session dans le jeton", () => {
  it("la connexion inscrit la version lue avec le compte", () => {
    const jeton = rappelJwt({ token: { sub: "u1" }, user: { id: "u1", role: "USER", sessionVersion: 3 } })
    expect(jeton).toMatchObject({ id: "u1", role: "USER", impersonatedBy: null, sessionVersion: 3, adminSessionVersion: null })
  })

  it("une consultation inscrit aussi la version de l'administrateur qui l'ouvre", () => {
    const jeton = rappelJwt({ token: { sub: "t1" }, user: { id: "t1", role: "USER", impersonatedBy: "a1", sessionVersion: 2, adminSessionVersion: 5 } })
    expect(jeton).toMatchObject({ impersonatedBy: "a1", sessionVersion: 2, adminSessionVersion: 5 })
    const session = rappelSession({
      session: { user: { id: "", role: "" } as { id: string; role: string; impersonatedBy?: string | null; adminSessionVersion?: number | null }, expires: "" },
      token: jeton,
    })
    expect(session.user).toMatchObject({ id: "t1", impersonatedBy: "a1", adminSessionVersion: 5 })
  })

  it("un appel update avec sessionVersion dans le corps ne modifie pas la version", () => {
    const avant = { sub: "u1", id: "u1", role: "USER", impersonatedBy: "a1", sessionVersion: 0, adminSessionVersion: 0 }
    for (const corps of [{ sessionVersion: 7 }, { user: { sessionVersion: 7 } }, { sessionVersion: "7", id: "autre", role: "ADMIN" }, { adminSessionVersion: 7, impersonatedBy: null }]) {
      const jeton = rappelJwt({ token: { ...avant }, user: undefined, trigger: "update", session: corps })
      expect(jeton).toEqual(avant)
    }
  })

  it("un jeton sans version (émis avant le déploiement) vaut 0", () => {
    const session = rappelSession({
      session: { user: { id: "", role: "" } as { id: string; role: string; sessionVersion?: number }, expires: "" },
      token: { sub: "u1", id: "u1", role: "USER", impersonatedBy: null },
    })
    expect(session.user.sessionVersion).toBe(0)
  })

  it("toute valeur hors entier positif vaut 0", () => {
    expect([undefined, null, -1, 1.5, "2", Number.NaN].map(versionSession)).toEqual([0, 0, 0, 0, 0, 0])
    expect(versionSession(4)).toBe(4)
  })
})
