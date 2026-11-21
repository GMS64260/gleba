import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SourceOpenMeteo } from "./SourceOpenMeteo"

/** Texte lu à l'écran : sans les balises ni les précisions pour lecteur d'écran. */
function texteVisible(html: string): string {
  return html.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "")
}

describe("SourceOpenMeteo", () => {
  it("cite Open-Meteo avec un lien vers son site et vers la licence CC BY 4.0", () => {
    const html = renderToStaticMarkup(createElement(SourceOpenMeteo))
    expect(texteVisible(html)).toBe("Données météo : Open-Meteo.com (CC BY 4.0)")
    expect(html).toContain('href="https://open-meteo.com/"')
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/deed.fr"')
    expect(html).toContain('rel="license noopener noreferrer"')
    expect(html.startsWith("<p ")).toBe(true)
  })

  it("signale un calcul de Gleba tiré de ces données, et se place dans une ligne de texte", () => {
    const html = renderToStaticMarkup(createElement(SourceOpenMeteo, { calcul: true, as: "span" }))
    expect(texteVisible(html)).toBe("Calcul Gleba d’après les données météo d’Open-Meteo.com (CC BY 4.0)")
    expect(html.startsWith("<span ")).toBe(true)
  })
})
