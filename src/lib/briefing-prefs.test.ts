import { describe, expect, it } from "vitest"
import { BRIEFING_AUTO_PAR_DEFAUT, CLE_PREF_BRIEFING_AUTO, briefingAutoActive } from "./briefing-prefs"

describe("préférence de briefing automatique", () => {
  // La clé est partagée avec le module privé de l'assistant : la changer
  // ici sans lui ferait ignorer le réglage enregistré par la page.
  it("garde la clé lue par l'assistant", () => {
    expect(CLE_PREF_BRIEFING_AUTO).toBe("briefingQuotidienAuto")
  })

  it("reste éteinte par défaut et lit booléens et chaînes", () => {
    expect(BRIEFING_AUTO_PAR_DEFAUT).toBe(false)
    expect(briefingAutoActive(null)).toBe(false)
    expect(briefingAutoActive({})).toBe(false)
    expect(briefingAutoActive({ briefingQuotidienAuto: true })).toBe(true)
    expect(briefingAutoActive({ briefingQuotidienAuto: "true" })).toBe(true)
    expect(briefingAutoActive({ briefingQuotidienAuto: "false" })).toBe(false)
    expect(briefingAutoActive({ briefingQuotidienAuto: 1 })).toBe(false)
  })
})
