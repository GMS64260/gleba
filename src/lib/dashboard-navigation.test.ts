import { afterEach, describe, expect, it, vi } from "vitest"
import { updateDashboardSearchParams } from "./dashboard-navigation"

describe("updateDashboardSearchParams", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("ajoute une entrée pour un changement d'onglet principal", () => {
    const pushState = vi.fn()
    const replaceState = vi.fn()
    vi.stubGlobal("window", {
      location: { pathname: "/", hash: "" },
      history: { pushState, replaceState },
    })

    updateDashboardSearchParams(
      new URLSearchParams("tab=planification&sub=itps"),
      "push",
    )

    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/?tab=planification&sub=itps",
    )
    expect(replaceState).not.toHaveBeenCalled()
  })

  it("remplace la query du sous-onglet sans perdre le chemin ni l'ancre", () => {
    const pushState = vi.fn()
    const replaceState = vi.fn()
    vi.stubGlobal("window", {
      location: { pathname: "/dashboard", hash: "#contenu" },
      history: { pushState, replaceState },
    })

    updateDashboardSearchParams(
      new URLSearchParams("tab=planification&sub=stocks"),
      "replace",
    )

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/dashboard?tab=planification&sub=stocks#contenu",
    )
    expect(pushState).not.toHaveBeenCalled()
  })

  it("retire proprement toute query en revenant au calendrier", () => {
    const pushState = vi.fn()
    vi.stubGlobal("window", {
      location: { pathname: "/", hash: "" },
      history: { pushState, replaceState: vi.fn() },
    })

    updateDashboardSearchParams(new URLSearchParams(), "push")

    expect(pushState).toHaveBeenCalledWith(null, "", "/")
  })
})
