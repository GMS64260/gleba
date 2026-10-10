/// <reference types="vite/client" />
import { describe, expect, it } from "vitest"
import type { Metadata } from "next"

import { OG_IMAGE } from "./og"

/**
 * Garde-fous SEO des pages publiques (constats du 2026-10-10 sur gleba.fr) :
 * - une canonical héritée du layout racine désignait l'accueil comme original
 *   de /communaute, /glossaire et /licence ;
 * - un `openGraph` déclaré par une page remplaçait celui du layout : l'image
 *   de partage, le nom du site et la locale disparaissaient.
 */

const pagesMetier = import.meta.glob<{ metadata: Metadata }>("/src/app/\\(marketing\\)/*/page.tsx", { eager: true })
const autres: Record<string, () => Promise<{ metadata: Metadata }>> = {
  "": () => import("@/app/page"),
  "/communaute": () => import("@/app/communaute/layout"),
  "/glossaire": () => import("@/app/glossaire/page"),
  "/licence": () => import("@/app/licence/page"),
  "/suppression-compte": () => import("@/app/suppression-compte/page"),
  "/referentiel": () => import("@/app/referentiel/page"),
}

function cheminDe(fichier: string): string {
  return "/" + fichier.split("/").at(-2)
}

function titreDe(m: Metadata): string {
  const t = m.title
  if (typeof t === "string") return t
  if (t && typeof t === "object" && "absolute" in t) return String(t.absolute)
  return ""
}

function verifier(chemin: string, m: Metadata) {
  expect(m.alternates?.canonical, `canonical de ${chemin || "/"}`).toBe(`https://gleba.fr${chemin}`)
  const og = m.openGraph as { images?: unknown[]; siteName?: string; locale?: string } | undefined
  if (og) {
    expect(og.images, `image de partage de ${chemin || "/"}`).toContainEqual(OG_IMAGE)
    expect(og.siteName).toBe("Gleba")
    expect(og.locale).toBe("fr_FR")
  }
  // Le gabarit du layout ajoute « | Gleba » : le titre ne répète pas la marque.
  if (typeof m.title === "string") expect(m.title, `titre de ${chemin}`).not.toMatch(/Gleba/)
  expect(titreDe(m).length, `titre de ${chemin || "/"}`).toBeGreaterThan(10)
  expect(m.description?.length ?? 0, `description de ${chemin || "/"}`).toBeGreaterThan(60)
}

describe("métadonnées des pages publiques", () => {
  it("couvre les 19 pages métier", () => {
    expect(Object.keys(pagesMetier)).toHaveLength(19)
  })

  for (const [fichier, mod] of Object.entries(pagesMetier)) {
    it(`${cheminDe(fichier)} : canonical propre et image de partage`, () => {
      verifier(cheminDe(fichier), mod.metadata)
    })
  }

  for (const [chemin, charger] of Object.entries(autres)) {
    it(`${chemin || "/"} : canonical propre et image de partage`, async () => {
      verifier(chemin, (await charger()).metadata)
    })
  }
})
