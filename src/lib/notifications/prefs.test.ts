import { describe, expect, it } from "vitest"
import {
  auMoinsUneAlerteUrgenteActivee,
  DEFAULT_NOTIF_PREFS,
  parseNotifPrefs,
  TOUTES_NOTIF_PREFS,
  typeAlerteEstActivee,
} from "./prefs"
import type { NotifPrefs } from "./prefs"
import type { TypeAlerteUrgente } from "./types"

describe("préférences de notifications", () => {
  it("n'envoie RIEN par défaut : les alertes email sont sur opt-in", () => {
    expect(parseNotifPrefs(null)).toEqual(DEFAULT_NOTIF_PREFS)
    expect(Object.values(DEFAULT_NOTIF_PREFS).every((actif) => actif === false)).toBe(true)
    expect(auMoinsUneAlerteUrgenteActivee(DEFAULT_NOTIF_PREFS)).toBe(false)
  })

  it("considère le scan urgent nécessaire dès qu'un seul type est demandé", () => {
    expect(auMoinsUneAlerteUrgenteActivee({ ...DEFAULT_NOTIF_PREFS, recoltes: true })).toBe(true)
    // « météo » et « résumé » ne passent pas par le scan urgent.
    expect(auMoinsUneAlerteUrgenteActivee({ ...DEFAULT_NOTIF_PREFS, meteo: true })).toBe(false)
    expect(auMoinsUneAlerteUrgenteActivee({ ...DEFAULT_NOTIF_PREFS, resume: true })).toBe(false)
    expect(auMoinsUneAlerteUrgenteActivee(TOUTES_NOTIF_PREFS)).toBe(true)
  })

  it("complète un objet partiel avec les valeurs par défaut", () => {
    expect(parseNotifPrefs({ meteo: true, stocks: true })).toEqual({
      ...DEFAULT_NOTIF_PREFS,
      meteo: true,
      stocks: true,
    })
  })

  it("respecte une activation explicite déjà enregistrée", () => {
    expect(parseNotifPrefs(TOUTES_NOTIF_PREFS)).toEqual(TOUTES_NOTIF_PREFS)
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
    const eteint: NotifPrefs = { ...TOUTES_NOTIF_PREFS, [preference]: false }

    expect(typeAlerteEstActivee(type as TypeAlerteUrgente, eteint)).toBe(false)
    expect(typeAlerteEstActivee(type as TypeAlerteUrgente, TOUTES_NOTIF_PREFS)).toBe(true)
    // Défaut opt-in : aucun type n'est actif tant que l'utilisateur n'a rien coché.
    expect(typeAlerteEstActivee(type as TypeAlerteUrgente, DEFAULT_NOTIF_PREFS)).toBe(false)
  })
})
