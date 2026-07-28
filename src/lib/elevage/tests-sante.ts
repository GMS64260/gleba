/** Types de tests proposés par l'interface et acceptés par l'API. */
export const TYPES_TEST_SANTE = [
  "dysplasie_hanche",
  "dysplasie_coude",
  "oeil",
  "adn_maladie",
  "adn_filiation",
  "radio_osteochondrose",
  "aie",
  "bilan_sante",
  "autre",
] as const

export type TypeTestSante = (typeof TYPES_TEST_SANTE)[number]

export function estTypeTestSante(value: unknown): value is TypeTestSante {
  return typeof value === "string"
    && (TYPES_TEST_SANTE as readonly string[]).includes(value)
}
