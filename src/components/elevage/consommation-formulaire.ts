export interface ConsommationAEditer {
  id: number
  aliment: { id: string }
  lot: { id: number } | null
  animal: { id: number } | null
  date: string
  quantite: number
  notes: string | null
}

interface ChampsConsommation {
  alimentId: string
  cible: "tous" | "lot" | "animal"
  lotId: string
  animalId: string
  date: string
  quantite: string
  notes: string
}

export interface FormulaireConsommation {
  isDialogOpen: boolean
  editingConsoId: number | null
  formData: ChampsConsommation
}

type ActionConsommation =
  | { type: "creer" | "fermer"; jour: string }
  | { type: "modifier"; consommation: ConsommationAEditer }
  | { type: "saisir"; champs: Partial<ChampsConsommation> }

export function formulaireConsommationVierge(jour: string): FormulaireConsommation {
  return {
    isDialogOpen: false,
    editingConsoId: null,
    formData: { alimentId: "", cible: "tous", lotId: "", animalId: "", date: jour, quantite: "", notes: "" },
  }
}

/** Les ouvertures en création et les fermetures abandonnent tout l'état précédent. */
export function reduireFormulaireConsommation(
  etat: FormulaireConsommation,
  action: ActionConsommation,
): FormulaireConsommation {
  switch (action.type) {
    case "creer":
    case "fermer":
      return { ...formulaireConsommationVierge(action.jour), isDialogOpen: action.type === "creer" }
    case "modifier": {
      const c = action.consommation
      return {
        isDialogOpen: true,
        editingConsoId: c.id,
        formData: {
          alimentId: c.aliment.id,
          cible: c.animal ? "animal" : c.lot ? "lot" : "tous",
          lotId: c.lot?.id != null ? String(c.lot.id) : "",
          animalId: c.animal?.id != null ? String(c.animal.id) : "",
          date: c.date.split("T")[0],
          quantite: String(c.quantite),
          notes: c.notes ?? "",
        },
      }
    }
    case "saisir":
      return { ...etat, formData: { ...etat.formData, ...action.champs } }
  }
}
