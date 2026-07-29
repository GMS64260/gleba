import { describe, expect, it } from "vitest"
import {
  TREE_CARE_PROFILES,
  getMonthlyCalendar,
} from "@/lib/tree-care-calendar"

describe("calendrier d'entretien du verger", () => {
  it("utilise les libellés de mois français", () => {
    const calendrier = getMonthlyCalendar(TREE_CARE_PROFILES[0])

    expect(calendrier.map((mois) => mois.label)).toEqual([
      "Janv.",
      "Févr.",
      "Mars",
      "Avr.",
      "Mai",
      "Juin",
      "Juil.",
      "Août",
      "Sept.",
      "Oct.",
      "Nov.",
      "Déc.",
    ])
  })
})
