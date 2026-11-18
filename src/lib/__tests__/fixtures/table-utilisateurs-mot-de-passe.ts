/**
 * Fausse table `user` partagée par les tests SEC-01 (révocation du lien de
 * réinitialisation) : `src/app/api/auth/reset-password/revocation-jeton.test.ts`
 * (Paramètres et lien « Mot de passe oublié », dépôt public) et
 * `src/app/api/admin/users/[id]/revocation-jeton.test.ts` (réglage par un
 * administrateur, route de la zone privée).
 *
 * Elle applique les clauses `where` comme PostgreSQL : une écriture
 * conditionnelle dont la condition ne tient plus n'écrit rien (`updateMany`
 * renvoie 0, `update` lève P2025). Les tests la branchent par
 * `vi.mock("@/lib/prisma", async () => (await import(…)).modulePrismaFactice)`.
 */

import { vi } from "vitest"
import { NextRequest } from "next/server"

export type Utilisateur = {
  id: string
  email: string
  password: string | null
  active: boolean
  role: "USER" | "ADMIN"
  apiToken: string | null
  resetPasswordToken: string | null
  resetPasswordExpires: Date | null
  sessionVersion: number
}

export const etat = {
  table: new Map<string, Utilisateur>(),
  // Point d'entrelacement : appelé juste après la lecture du jeton par
  // reset-password, pour simuler une écriture concurrente.
  apresLectureJeton: null as null | (() => Promise<void>),
  session: { user: { id: "u1", acteurId: "u1", email: "x@example.com", role: "USER" } },
}

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

// `{ increment: n }` appliqué comme PostgreSQL (version de session, MC3).
function appliquer(u: Utilisateur, data: Record<string, unknown>) {
  for (const [cle, valeur] of Object.entries(data)) {
    const increment = valeur && typeof valeur === "object" && !(valeur instanceof Date) ? (valeur as { increment?: number }).increment : undefined
    ;(u as Record<string, unknown>)[cle] = increment !== undefined ? ((u as Record<string, unknown>)[cle] as number) + increment : valeur
  }
}

const user = {
  findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    for (const u of etat.table.values()) if (correspond(u, where)) return { ...u }
    return null
  }),
  update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Utilisateur> }) => {
    const u = [...etat.table.values()].find((x) => correspond(x, where))
    if (!u) throw Object.assign(new Error("enregistrement introuvable"), { code: "P2025" })
    appliquer(u, data)
    return { ...u }
  }),
  updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Utilisateur> }) => {
    let count = 0
    for (const u of etat.table.values()) {
      if (correspond(u, where)) {
        appliquer(u, data)
        count++
      }
    }
    return { count }
  }),
}
const findUniqueTable = user.findUnique.getMockImplementation()!

/** Module `@/lib/prisma` factice. */
export const modulePrismaFactice = { default: { user } }

/** Module `@/lib/auth-utils` factice : session fixe, hachage lisible. */
export const moduleAuthUtilsFactice = {
  requireAuthApi: async () => ({ error: null, session: etat.session }),
  requireAdminApi: async () => ({ error: null, session: { user: { id: "admin", role: "ADMIN" } } }),
  hashPassword: async (mdp: string) => `hash:${mdp}`,
  verifyPassword: async (mdp: string, hash: string) => hash === `hash:${mdp}`,
}

export const JETON = "jeton-emis-avant-le-changement"

export function requeteJson(url: string, corps: unknown, methode = "POST") {
  return new NextRequest(url, {
    method: methode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })
}

export const demandeReinit = (password: string) =>
  requeteJson("http://localhost/api/auth/reset-password", { token: JETON, password })

export function utilisateur(): Utilisateur {
  return etat.table.get("u1")!
}

/** À appeler dans `beforeEach` : un titulaire avec un lien valide, et le crochet d'entrelacement branché. */
export function reinitialiserTable() {
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
    sessionVersion: 0,
  })
  user.findUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const resultat = await findUniqueTable(args)
    if ("resetPasswordToken" in args.where && etat.apresLectureJeton) {
      const crochet = etat.apresLectureJeton
      etat.apresLectureJeton = null
      await crochet()
    }
    return resultat
  })
}
