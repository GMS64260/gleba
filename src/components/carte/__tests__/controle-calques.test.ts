import { readFileSync } from "node:fs"
import path from "node:path"
import micromatch from "micromatch"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import loadConfig from "tailwindcss/loadConfig"
import { describe, expect, it } from "vitest"

import { CLASSES_BOUTON_CALQUES_EN_PLACE } from "../controle-calques"

/**
 * QA cmvgebfkr (2026-10-20) : un clic sur « Layers » cochait OpenStreetMap,
 * parce que le bouton disparaissait à l'ouverture du menu au survol et que la
 * première ligne du menu prenait sa place. Le correctif est une règle CSS
 * produite par Tailwind : on vérifie la règle réellement générée (une faute de
 * syntaxe de variante arbitraire ne produit rien, sans erreur de compilation)
 * et qu'elle replace le bouton exactement là où il était, menu fermé.
 */

const regleGeneree = async (): Promise<string> => {
  const resultat = await postcss([
    tailwindcss({
      content: [{ raw: CLASSES_BOUTON_CALQUES_EN_PLACE, extension: "html" }],
      corePlugins: { preflight: false },
    }),
  ]).process("@tailwind utilities;", { from: undefined })
  return resultat.css
}

/** Déclarations de la règle Leaflet `sélecteur { ... }` (feuille livrée avec la bibliothèque). */
const declarationsLeaflet = (selecteur: string): Record<string, string> => {
  const css = readFileSync(path.resolve(__dirname, "../../../../node_modules/leaflet/dist/leaflet.css"), "utf8")
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const bloc = css.match(new RegExp(`(?:^|\\n|\\})\\s*${echappe}\\s*\\{([^}]*)\\}`))
  if (!bloc) throw new Error(`règle Leaflet introuvable : ${selecteur}`)
  return Object.fromEntries(
    bloc[1]
      .split(";")
      .map((d) => d.split(":").map((p) => p.trim()))
      .filter((d) => d.length === 2 && d[0])
      .map(([k, v]) => [k, v]),
  )
}

describe("bouton « Layers » laissé en place menu ouvert (cmvgebfkr)", () => {
  it("la règle générée vise le bouton du contrôle ouvert, sous le conteneur de la carte", async () => {
    const css = await regleGeneree()
    expect(css).toMatch(/ \.leaflet-control-layers-expanded \.leaflet-control-layers-toggle\s*\{\s*display:\s*block/)
    expect(css).toMatch(/ \.leaflet-control-layers-expanded \.leaflet-control-layers-toggle\s*\{\s*margin:\s*-6px -10px 0 auto/)
  })

  it("Leaflet masque bien le bouton menu ouvert (le défaut que la règle neutralise)", () => {
    // Si une version de Leaflet cesse de le masquer, la règle devient inutile ;
    // si elle change de classes, la règle ne s'applique plus : le test le dit.
    const css = readFileSync(path.resolve(__dirname, "../../../../node_modules/leaflet/dist/leaflet.css"), "utf8")
    expect(css).toMatch(/\.leaflet-control-layers-expanded \.leaflet-control-layers-toggle\s*\{\s*display:\s*none/)
  })

  it("les marges négatives compensent exactement le rembourrage du contrôle ouvert", async () => {
    const [haut, droite] = declarationsLeaflet(".leaflet-control-layers-expanded").padding.split(/\s+/)
    const css = await regleGeneree()
    const marge = css.match(/margin:\s*(-?\d+px) (-?\d+px) 0 auto/)
    expect(marge).not.toBeNull()
    // Bouton au même coin haut droit, menu fermé ou ouvert : un clic sur
    // « Layers » l'atteint toujours, jamais la ligne OpenStreetMap.
    expect(marge![1]).toBe(`-${haut}`)
    expect(marge![2]).toBe(`-${droite}`)
  })
})

/**
 * Revue du 2026-10-20 : la compilation isolée ci-dessus (`content: [{ raw }]`)
 * ne prouve ni que la configuration du projet scanne `controle-calques.ts`
 * (fichier `.ts`, pas `.tsx`), ni que les cartes posent la constante sur un
 * ancêtre du contrôle Calques. Ces maillons sont vérifiés ici.
 */
const RACINE = path.resolve(__dirname, "../../../..")
const FICHIER = "src/components/carte/controle-calques.ts"
const source = (fichier: string) => readFileSync(path.join(RACINE, fichier), "utf8")

describe("règle réellement produite par la configuration du projet et posée par les cartes (cmvgebfkr)", () => {
  it("les globs `content` de tailwind.config.ts couvrent controle-calques.ts", () => {
    const config = loadConfig(path.join(RACINE, "tailwind.config.ts"))
    const globs = (Array.isArray(config.content) ? config.content : config.content.files)
      .filter((g): g is string => typeof g === "string")
      .map((g) => g.replace(/^\.\//, ""))
    expect(micromatch.isMatch(FICHIER, globs)).toBe(true)
  })

  it("la configuration du projet, appliquée au fichier sur disque, émet les deux règles", async () => {
    const config = loadConfig(path.join(RACINE, "tailwind.config.ts"))
    const resultat = await postcss([
      tailwindcss({
        ...config,
        content: [{ raw: source(FICHIER), extension: "ts" }],
      }),
    ]).process("@tailwind utilities;", { from: undefined })
    expect(resultat.css).toMatch(/ \.leaflet-control-layers-expanded \.leaflet-control-layers-toggle\s*\{\s*display:\s*block/)
    expect(resultat.css).toMatch(/ \.leaflet-control-layers-expanded \.leaflet-control-layers-toggle\s*\{\s*margin:\s*-6px -10px 0 auto/)
  })

  it("MapContainer pose la constante sur le conteneur qui enveloppe la carte Leaflet, contrôle en topright", () => {
    const code = source("src/components/carte/MapContainer.tsx")
    expect(code).toMatch(/<div className=\{`[^`]*\$\{CLASSES_BOUTON_CALQUES_EN_PLACE\}[^`]*`\}>\s*<LeafletMapContainer/)
    expect(code).toMatch(/<LayersControl position="topright">/)
  })

  it("GpsMapPickerMap pose la constante sur le conteneur Leaflet lui-même, contrôle en topright", () => {
    const code = source("src/components/gps/GpsMapPickerMap.tsx")
    expect(code).toMatch(/<MapContainer\b[^>]*className=\{`[^`]*\$\{CLASSES_BOUTON_CALQUES_EN_PLACE\}[^`]*`\}[^>]*>\s*<LayersControl position="topright">/)
  })
})
