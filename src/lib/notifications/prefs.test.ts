import { describe, expect, it } from "vitest"
import {
  DEFAULT_NOTIF_PREFS,
  parseNotifPrefs,
  typeAlerteEstActivee,
} from "./prefs"
import type { NotifPrefs } from "./prefs"
import type { TypeAlerteUrgente } from "./types"

describe("préférences de notifications", () => {
  it("retourne toutes les notifications activées par défaut", () => {
    expect(parseNotifPrefs(null)).toEqual(DEFAULT_NOTIF_PREFS)
  })

  it("complète un objet partiel avec les valeurs par défaut", () => {
    expect(parseNotifPrefs({ meteo: false, stocks: false })).toEqual({
      ...DEFAULT_NOTIF_PREFS,
      meteo: false,
      stocks: false,
    })
  })

  it.each([null, undefined, "invalide", 42, [], { meteo: "false" }])(
    "ignore une préférence invalide : %j",
    (value) => {
      expect(parseNotifPrefs(value)).toEqual(DEFAULT_NOTIF_PREFS)
    }
  )

  it.each([
    ["stock-bas", "stocks"],
    ["tache-itp-semaine", "itpSemaine"],
    ["recolte-mure", "recoltes"],
    ["irrigation-inutile", "irrigations"],
    ["irrigation-rappel", "irrigations"],
    ["association-incompatible", "autresUrgentes"],
    ["tache-retard", "autresUrgentes"],
  ] as const)("mappe %s vers %s", (type, preference) => {
    const prefs: NotifPrefs = { ...DEFAULT_NOTIF_PREFS, [preference]: false }

    expect(typeAlerteEstActivee(type as TypeAlerteUrgente, prefs)).toBe(false)
    expect(typeAlerteEstActivee(type as TypeAlerteUrgente, DEFAULT_NOTIF_PREFS)).toBe(true)
  })
})
