// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const etat = vi.hoisted(() => ({ pathname: "/aujourdhui", modules: ["maraichage"] as string[], loading: false, acces: {} as object | null }))
vi.mock("next/navigation", () => ({ usePathname: () => etat.pathname }))
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ modules: etat.modules, loading: etat.loading }) }))
vi.mock("@/hooks/use-acces-service", () => ({ useAccesService: () => ({ acces: etat.acces }) }))

import { LienNoter } from "./LienNoter"

const monter = (pathname: string, modules: string[]) => {
  etat.pathname = pathname
  etat.modules = modules
  render(createElement(LienNoter, { className: "bouton" }, "Noter"))
}

afterEach(() => {
  cleanup()
  etat.loading = false
  etat.acces = {}
})

describe("LienNoter", () => {
  it("mène directement un éleveur à sa tournée", () => {
    monter("/aujourdhui", ["elevage", "comptabilite"])
    const lien = screen.getByRole("link", { name: "Noter · Élevage" })
    expect(lien.getAttribute("href")).toBe("/elevage/tournee")
  })

  it("propose les univers de la ferme quand il y en a plusieurs", () => {
    monter("/aujourdhui", ["maraichage", "verger", "elevage"])
    expect(screen.queryByRole("link")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Noter/ }))
    const liens = screen.getAllByRole("link").map(l => l.getAttribute("href"))
    expect(liens).toEqual(["/taches", "/verger?tab=calendrier", "/elevage/tournee"])
  })

  it("attend la lecture des univers plutôt que d'ouvrir les tâches du maraîchage", () => {
    etat.acces = null
    monter("/aujourdhui", [])
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByRole("button", { name: "Noter" }).getAttribute("aria-busy")).toBe("true")
    cleanup()
    etat.acces = {}
    etat.loading = true
    monter("/aujourdhui", ["maraichage", "verger", "elevage"])
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByRole("button", { name: "Noter" }).getAttribute("data-noter")).toBe("attente")
  })

  it("propose encore le choix depuis la page d'un univers, pour en changer", () => {
    monter("/elevage/tournee", ["maraichage", "verger", "elevage"])
    expect(screen.queryByRole("link")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Noter/ }))
    const liens = screen.getAllByRole("link")
    expect(liens.map(l => l.getAttribute("href"))).toEqual(["/taches", "/verger?tab=calendrier", "/elevage/tournee"])
    expect(liens.map(l => l.getAttribute("aria-current"))).toEqual([null, null, "true"])
    expect(liens[2].textContent).toContain("Ici")
  })

  it("marque la page courante quand la ferme n'a qu'un univers", () => {
    monter("/elevage/tournee", ["elevage"])
    const lien = screen.getByRole("link", { name: "Noter · Élevage" })
    expect(lien.getAttribute("aria-current")).toBe("page")
  })
})
