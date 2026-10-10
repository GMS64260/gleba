/**
 * Seuils de décision de l'arrosage, PARTAGÉS par les deux moteurs qui disent
 * s'il faut arroser : `computeConseilIrrigation` (src/lib/irrigation-conseil.ts,
 * source des lignes « à arroser » des tâches, de l'accueil et des courriels) et
 * `genererRecommandationIrrigation` (src/lib/meteo-agro.ts, conseiller du
 * Calendrier potager et de /meteo). Revue du 2026-10-10 : le conseiller
 * multipliait encore ses seuils par un facteur de besoin (critique dès 4 mm de
 * déficit pour une tomate) et disait « critique » sur une planche absente des
 * tâches. Module pur, importable côté client.
 */

/**
 * Pluie qui compte comme un apport d'eau (mm/jour). Une bruine de 1 mm ne
 * remet pas à zéro les « jours sans eau » : elle masquait un vrai déficit.
 */
export const SEUIL_PLUIE_SIGNIFICATIVE = 3

/**
 * Déficits (mm) qui rendent l'arrosage nécessaire. ABSOLUS : le déficit dérive
 * déjà de l'évapotranspiration de la culture (une culture gourmande le creuse
 * plus vite). Multipliés par le besoin de l'espèce, ils s'inversaient.
 * Calibrage : la réserve facilement utilisable de légumes à enracinement court
 * vaut 30 à 40 mm, on arrose vers la moitié. Mesuré sur les comptes réels le
 * 2026-10-10 (octobre, pluie significative = 3 mm) : 10 mm faisait sortir 83
 * comptes sur 109 « à arroser », 15 mm en laisse 4 (9 planches) ; en été,
 * 15 mm de déficit est atteint en trois jours.
 */
export const DEFICIT_MOYENNE_MM = 5
export const DEFICIT_HAUTE_MM = 15
export const DEFICIT_CRITIQUE_MM = 25

/** Une culture dont la récolte est finie depuis plus longtemps n'est plus à arroser. */
export const JOURS_APRES_FIN_RECOLTE = 14

/**
 * Sans fin de récolte connue, `dateRecolte` n'est que le DÉBUT de la récolte :
 * une courgette récoltée tout l'été sortirait 14 jours après sa première
 * récolte. Marge plus large dans ce cas.
 */
export const JOURS_APRES_DEBUT_RECOLTE_SANS_FIN = 60
