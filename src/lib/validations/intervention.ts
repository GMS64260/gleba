import { z } from 'zod'
import { MESSAGE_AMM_INVALIDE, numAMMValide } from '@/lib/tracabilite/amm'
import { isValidSiret } from '@/lib/siret'
import { UTILISATIONS_SEMENCES } from '@/lib/tracabilite/utilisation-semences'
import { NATURES_PRODUIT_DECLAREES } from '@/lib/phyto/delai-avant-recolte'

/**
 * Les formulaires HTML envoient TOUJOURS des chaînes (`<input type="number">`
 * inclus). Avant coercition, `doseAppliquee: ""` ou `"2,5"` faisait échouer
 * `z.number()` → 400 systématique à la création d'intervention (audit 2026-07).
 *
 * `numInput` normalise ces entrées : "" / null / undefined → null,
 * "2,5" ou "2.5" → 2.5, valeur non numérique laissée telle quelle pour
 * déclencher un message d'erreur zod explicite. Les nombres passent inchangés
 * (rétro-compatible avec les appelants qui envoient déjà des number).
 */
const coerceNum = (v: unknown): unknown => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').trim())
    return Number.isNaN(n) ? v : n
  }
  return v
}
const numInput = () => z.preprocess(coerceNum, z.number().min(0).nullable()).optional()
const intInput = () => z.preprocess(coerceNum, z.number().int().min(0).nullable()).optional()
/** Chaîne facultative : "" et espaces → null. */
const texteFacultatif = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v),
    z.string().max(max).nullable(),
  ).optional()
const texteVideNul = (v: unknown): unknown =>
  typeof v === 'string' ? v.trim() || null : v
/** Heure « HH:MM » sur 24 h (arrêté du 24 décembre 2025, annexe II). */
const heureInput = () =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:MM').nullable(),
  ).optional()

export const createInterventionSchema = z.object({
  date: z.coerce.date(),
  type: z.string().min(1, 'Type requis'),
  cultureId: z.preprocess(coerceNum, z.number().int().nullable()).optional(),
  plancheId: z.string().nullable().optional(),
  arbreId: z.preprocess(coerceNum, z.number().int().nullable()).optional(),
  description: z.string().max(1000).nullable().optional(),
  dureeMinutes: intInput(),
  nbPersonnes: z.preprocess(coerceNum, z.number().int().min(1).nullable()).optional().transform((v) => v ?? 1),
  coutMainOeuvre: numInput(),
  coutTotal: numInput(),
  datePrevue: z.coerce.date().nullable().optional(),
  fait: z.boolean().optional().default(true),
  // Phyto
  produitPhyto: z.string().max(200).nullable().optional(),
  // QA cmv2962ey — « ABC » passait pour une AMM : sept chiffres ou rien.
  numAMM: z
    .string()
    .max(50)
    .nullable()
    .optional()
    .refine((v) => !v || numAMMValide(v), { message: MESSAGE_AMM_INVALIDE }),
  cibleTraitement: z.string().max(200).nullable().optional(),
  doseAppliquee: numInput(),
  uniteDose: z.string().max(50).nullable().optional(),
  surfaceTraitee: numInput(),
  dar: intInput(),
  delaiReentree: intInput(),
  // QA 2026-07-30 — La ZNT (zone non traitée, distance aux points d'eau) est une
  // donnée réglementaire : les colonnes existaient en base et l'export du
  // registre les restituait déjà, mais rien ne les acceptait en écriture.
  zntDistanceM: intInput(),
  zntRespectee: z.boolean().nullable().optional(),
  conditionsMeteo: z.string().max(200).nullable().optional(),
  // Intrant
  intrantNom: z.string().max(200).nullable().optional(),
  intrantQuantite: numInput(),
  intrantUnite: z.string().max(50).nullable().optional(),
  intrantCout: numInput(),
  intrantNumLot: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  // PROMPT 11 LOT B/D — Réglementaire phyto + traçabilité PBI
  produitPhytoId: z.string().nullable().optional(),
  // Contre-revue CR-DAR-01 : nature déclarée d'un produit saisi librement.
  natureProduit: z.preprocess((v) => (v === '' ? null : v), z.enum(NATURES_PRODUIT_DECLAREES, { message: 'Nature du produit inconnue.' }).nullable()).optional(),
  volumeBouillieLHa: numInput(),
  temperatureC: z.preprocess(coerceNum, z.number().nullable()).optional(),
  ventKmh: numInput(),
  hygrometriePct: z.preprocess(coerceNum, z.number().int().min(0).max(100).nullable()).optional(),
  operateurId: z.string().nullable().optional(),
  certiphytoNum: z.string().max(50).nullable().optional(),
  certiphytoValidite: z.coerce.date().nullable().optional(),
  justification: z.string().max(2000).nullable().optional(),
  observationLieeId: z.preprocess(coerceNum, z.number().int().nullable()).optional(),
  // Arrêté du 24 décembre 2025 relatif aux registres d'utilisation des
  // produits phytopharmaceutiques, annexe I, mentions « le cas échéant ».
  stadeBBCH: z.preprocess(
    (v) => (v === '' ? null : typeof v === 'number' ? String(v).padStart(2, '0') : v),
    z.string().regex(/^\d{2}$/, 'Stade BBCH sur deux chiffres (ex. 65)').nullable(),
  ).optional(),
  heureDebut: heureInput(),
  heureFin: heureInput(),
  rentreeAnticipee: texteFacultatif(1000),
  siretBeneficiaire: z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/\s/g, '') || null : v),
    z.string().refine((v) => isValidSiret(v), { message: 'SIRET du bénéficiaire invalide (14 chiffres)' }).nullable(),
  ).optional(),
  // Annexe II, tableaux C (traitement de semences ou de plants) et D (semis
  // de semences traitées). Aucun de ces champs n'est exigé à la saisie : une
  // mention manquante est signalée « à compléter » au registre.
  utilisationPhyto: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(UTILISATIONS_SEMENCES, { message: "Type d'utilisation phytosanitaire inconnu." }).nullable(),
  ).optional(),
  substancesActives: texteFacultatif(500),
  quantiteSemences: numInput(),
  uniteQuantiteSemences: texteFacultatif(50),
  densiteSemis: numInput(),
  uniteDensiteSemis: texteFacultatif(50),
  gpsLat: z.preprocess(coerceNum, z.number().min(-90, 'Latitude entre -90 et 90').max(90, 'Latitude entre -90 et 90').nullable()).optional(),
  gpsLng: z.preprocess(coerceNum, z.number().min(-180, 'Longitude entre -180 et 180').max(180, 'Longitude entre -180 et 180').nullable()).optional(),
  // RPG : numéro d'îlot, numéro de parcelle dans l'îlot, code commune Insee (5 caractères).
  rpgIlot: z.preprocess(texteVideNul, z.string().regex(/^\d{1,4}$/, "Numéro d'îlot RPG : 1 à 4 chiffres").nullable()).optional(),
  rpgParcelle: z.preprocess(texteVideNul, z.string().regex(/^\d{1,3}$/, 'Numéro de parcelle RPG : 1 à 3 chiffres').nullable()).optional(),
  rpgCommuneInsee: z.preprocess(texteVideNul, z.string().regex(/^(\d{5}|2[AB]\d{3})$/i, 'Code commune Insee : 5 caractères').nullable()).optional(),
  // Dénomination de la culture (code OEPP ou texte) et conduite biologique,
  // saisies quand les fiches de l'exploitation ne les donnent pas.
  cultureRegistre: texteFacultatif(200),
  conduiteBio: z.boolean().nullable().optional(),
})

export const updateInterventionSchema = createInterventionSchema.partial().extend({
  id: z.coerce.number().int().min(1, 'ID requis'),
  // Contre-revue ADV221 : l'exploitant confirme que le délai affiché (ancienne
  // indication du catalogue) est celui de l'étiquette, même s'il est inchangé.
  darConfirme: z.boolean().optional(),
})
