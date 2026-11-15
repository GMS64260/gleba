import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ chargee: null as { source: string; devise: string } | null, effet: null as (() => () => void) | null }))
vi.mock("react", () => ({
  useState: () => [m.chargee, (chargee: typeof m.chargee) => { m.chargee = chargee }],
  useEffect: (effet: () => () => void) => { m.effet = effet },
}))
import { useDevise } from "./use-devise"

beforeEach(() => { m.chargee = null; m.effet = null })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("devise de l'exploitation active", () => {
  it.each([
    [{ devise: "XPF", territoire: "METROPOLE" }, "XPF"],
    [{ devise: "EUR", territoire: "NOUVELLE_CALEDONIE" }, "EUR"],
    [{ territoire: "POLYNESIE" }, "XPF"],
    [null, "EUR"],
  ])("lit la fiche serveur et respecte la devise explicite : %o", async (data, attendu) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) })
    vi.stubGlobal("fetch", fetchMock)
    expect(useDevise()).toBeNull()
    m.effet!()
    await vi.waitFor(() => expect(m.chargee?.devise).toBe(attendu))
    expect(useDevise()).toBe(attendu)
    expect(fetchMock).toHaveBeenCalledWith("/api/exploitation", { signal: expect.any(AbortSignal) })
  })

  it("ignore une réponse arrivée après avoir quitté l'écran", async () => {
    let repondre!: (value: unknown) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { repondre = resolve })))
    useDevise()
    const quitter = m.effet!()
    quitter()
    repondre({ ok: true, json: async () => ({ data: { devise: "XPF" } }) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(m.chargee).toBeNull()
  })

  it.each(["http", "réseau", "json"])("reste sans devise en cas d'échec %s, sans supposer EUR", async (type) => {
    const consoleErreur = vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = type === "réseau"
      ? vi.fn().mockRejectedValue(new Error("Réseau indisponible"))
      : vi.fn().mockResolvedValue({ ok: type !== "http", json: async () => { throw new Error("JSON illisible") } })
    vi.stubGlobal("fetch", fetchMock)
    useDevise()
    m.effet!()
    await vi.waitFor(() => expect(consoleErreur).toHaveBeenCalled())
    expect(useDevise()).toBeNull()
  })
})

describe("devise de la boutique publique visitée", () => {
  it.each(["http", "réseau", "json", "devise absente"])("oublie une devise chargée lors d'un retour après échec %s", async (type) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const echec = () => type === "réseau"
      ? Promise.reject(new Error("Réseau indisponible"))
      : Promise.resolve({ ok: type !== "http", json: async () => {
        if (type === "json") throw new Error("JSON illisible")
        return {}
      } })
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ devise: "XPF" }) }).mockImplementation(echec)
    vi.stubGlobal("fetch", fetchMock)
    useDevise("a")
    let quitter = m.effet!()
    await vi.waitFor(() => expect(useDevise("a")).toBe("XPF"))
    quitter()
    useDevise("b")
    quitter = m.effet!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(useDevise("b")).toBeNull()
    quitter()
    useDevise("a")
    m.effet!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(useDevise("a")).toBeNull()
  })

  it("lit la boutique sans interroger l'exploitation de la session du visiteur", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ devise: "XPF" }) })
    vi.stubGlobal("fetch", fetchMock)
    useDevise("ferme-fictive")
    m.effet!()
    await vi.waitFor(() => expect(useDevise("ferme-fictive")).toBe("XPF"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/boutique/public/ferme-fictive", { signal: expect.any(AbortSignal) })
    expect(useDevise("autre-ferme")).toBeNull()
    expect(useDevise()).toBeNull()
  })

  it.each([{ ok: false }, { ok: true, json: async () => ({}) }])("n'invente aucune devise si la boutique ne peut pas la fournir : %o", async (response) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))
    useDevise("ferme-fictive")
    m.effet!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(useDevise("ferme-fictive")).toBeNull()
  })
})
