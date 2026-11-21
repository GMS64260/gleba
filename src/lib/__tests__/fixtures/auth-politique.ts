import { afterEach, beforeEach, vi } from "vitest"

const etat = vi.hoisted(() => ({
  acteur: "", proprietaire: "", session: true, versionBase: 0,
  role: "MEMBRE", modules: [] as string[], enTetes: new Headers(),
}))
const db = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  membreExploitation: { findUnique: vi.fn() },
  abonnementGleba: { findUnique: vi.fn() },
}))
const authentifier = vi.hoisted(() => vi.fn())
export { etat, db, authentifier }
vi.mock("@/lib/auth", () => ({ auth: authentifier }))
vi.mock("@/lib/prisma", () => ({ default: db }))
vi.mock("@/lib/activity", () => ({ touchActivity: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => etat.enTetes }))

let numero = 0
export function preparerGarde() {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"))
    vi.stubEnv("GLEBA_ABONNEMENTS_ACTIFS", "false")
    numero++
    Object.assign(etat, {
      acteur: `acteur-${numero}`, proprietaire: `ferme-${numero}`, session: true,
      versionBase: 0, role: "MEMBRE", modules: [], enTetes: new Headers(),
    })
    // Ancienne session sans version et adhésion sans restriction de modules.
    authentifier.mockImplementation(async () => etat.session
      ? { user: { id: etat.acteur, role: "USER" } } : null)
    db.user.findMany.mockImplementation(async () => [
      { id: etat.acteur, active: true, role: "USER", sessionVersion: etat.versionBase },
    ])
    db.membreExploitation.findUnique.mockImplementation(async () => ({
      userId: etat.acteur, proprietaireId: etat.proprietaire, role: etat.role,
      modules: etat.modules, accepteLe: new Date("2029-01-01"), revoqueLe: null,
    }))
    db.user.findUnique.mockResolvedValue({ createdAt: new Date("2029-01-01"), email: "fictif@example.invalid" })
    db.abonnementGleba.findUnique.mockResolvedValue(null)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })
}

export function requete(chemin = "/api/cultures", method = "GET", ip = `ip-${numero}`) {
  return new Request(`http://localhost${chemin}`, { method, headers: { "x-forwarded-for": ip } })
}
