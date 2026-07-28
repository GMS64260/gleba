import { z } from "zod"

export const TYPES_LIEU_DETENTION = [
  "SITE",
  "BATIMENT",
  "PARCELLE",
  "AUTRE",
] as const

export const LABELS_TYPE_LIEU: Record<(typeof TYPES_LIEU_DETENTION)[number], string> = {
  SITE: "Site d’élevage",
  BATIMENT: "Bâtiment",
  PARCELLE: "Parcelle / plein air",
  AUTRE: "Autre lieu",
}

export const ROLES_INTERVENANT_ELEVAGE = [
  "DETENTEUR",
  "PROPRIETAIRE_ANIMAUX",
  "RESPONSABLE_REGISTRE",
  "VETERINAIRE_SUIVI",
  "VETERINAIRE_SANITAIRE",
  "GDS_OVS",
  "ORGANISATION_PRODUCTION",
  "PROGRAMME_SANITAIRE",
  "SALARIE",
  "AUTRE",
] as const

export type RoleIntervenantElevage = (typeof ROLES_INTERVENANT_ELEVAGE)[number]

export const LABELS_ROLE_INTERVENANT: Record<RoleIntervenantElevage, string> = {
  DETENTEUR: "Détenteur des animaux",
  PROPRIETAIRE_ANIMAUX: "Propriétaire des animaux",
  RESPONSABLE_REGISTRE: "Personne chargée du registre",
  VETERINAIRE_SUIVI: "Vétérinaire de suivi régulier",
  VETERINAIRE_SANITAIRE: "Vétérinaire sanitaire",
  GDS_OVS: "GDS / organisme à vocation sanitaire",
  ORGANISATION_PRODUCTION: "Organisation de production",
  PROGRAMME_SANITAIRE: "Programme sanitaire d’élevage",
  SALARIE: "Salarié / intervenant interne",
  AUTRE: "Autre intervenant",
}

export const STATUTS_INTERVENANT_ELEVAGE = [
  "ACTIF",
  "TERMINE",
  "NON_CONCERNE",
] as const

export type StatutIntervenantElevage = (typeof STATUTS_INTERVENANT_ELEVAGE)[number]

export const LABELS_STATUT_INTERVENANT: Record<StatutIntervenantElevage, string> = {
  ACTIF: "Actif",
  TERMINE: "Terminé",
  NON_CONCERNE: "Non concerné / non adhérent",
}

export const ROLES_POUVANT_ETRE_NON_CONCERNES: RoleIntervenantElevage[] = [
  "PROPRIETAIRE_ANIMAUX",
  "GDS_OVS",
  "ORGANISATION_PRODUCTION",
  "PROGRAMME_SANITAIRE",
]

const listeCourte = z.array(z.string().trim().min(1).max(100)).max(30)
const texteOptionnel = (max: number) =>
  z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  )
const dateOptionnelle = z.preprocess(
  (value) => value === "" ? null : value,
  z.coerce.date().nullable().optional(),
)

export const lieuDetentionInputSchema = z.object({
  type: z.enum(TYPES_LIEU_DETENTION),
  nom: z.string().trim().min(1, "Nom du lieu requis").max(160),
  parentId: texteOptionnel(100),
  numeroEde: texteOptionnel(40),
  adresse: texteOptionnel(500),
  codePostal: texteOptionnel(20),
  ville: texteOptionnel(120),
  especes: listeCourte.default([]),
  usages: texteOptionnel(500),
  planMasseUrl: texteOptionnel(1000),
})

export const intervenantElevageInputSchema = z.object({
  role: z.enum(ROLES_INTERVENANT_ELEVAGE),
  statut: z.enum(STATUTS_INTERVENANT_ELEVAGE).default("ACTIF"),
  nom: texteOptionnel(200),
  fonction: texteOptionnel(200),
  organisme: texteOptionnel(200),
  adresse: texteOptionnel(500),
  email: z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().email("Adresse électronique invalide").max(200).nullable().optional(),
  ),
  telephone: texteOptionnel(40),
  especes: listeCourte.default([]),
  typesProduction: listeCourte.default([]),
  dateDebut: dateOptionnelle,
  dateFin: dateOptionnelle,
  perimetreDelegation: texteOptionnel(500),
}).superRefine((data, ctx) => {
  if (
    data.statut === "NON_CONCERNE"
    && !ROLES_POUVANT_ETRE_NON_CONCERNES.includes(data.role)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["statut"],
      message: "Cette responsabilité ne peut pas être marquée non concernée",
    })
  }
  if (data.statut !== "NON_CONCERNE" && !data.nom && !data.organisme) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nom"],
      message: "Nom de la personne ou de l’organisme requis",
    })
  }
  if (data.dateDebut && data.dateFin && data.dateFin < data.dateDebut) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateFin"],
      message: "La date de fin doit être postérieure à la date de début",
    })
  }
})

export const cadreReglementaireMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lieu"),
    id: z.string().trim().min(1).optional(),
    data: lieuDetentionInputSchema,
  }),
  z.object({
    kind: z.literal("intervenant"),
    id: z.string().trim().min(1).optional(),
    data: intervenantElevageInputSchema,
  }),
])

export const cadreReglementaireArchiveSchema = z.object({
  kind: z.enum(["lieu", "intervenant"]),
  id: z.string().trim().min(1),
  archived: z.boolean().default(true),
})

export function normaliserListeSaisie(value: string): string[] {
  const uniques = new Map<string, string>()
  for (const item of value.split(/[,;\n]/)) {
    const propre = item.trim()
    const cle = propre.toLocaleLowerCase("fr")
    if (propre && !uniques.has(cle)) uniques.set(cle, propre)
  }
  return [...uniques.values()]
}

type LieuPourCompletude = {
  archivedAt: Date | string | null
}

type IntervenantPourCompletude = {
  role: string
  statut: string
  archivedAt: Date | string | null
}

export function manquesCadreReglementaire(args: {
  lieux: LieuPourCompletude[]
  intervenants: IntervenantPourCompletude[]
  veterinaireSanitaireLegacy?: string | null
}): string[] {
  const lieuxActifs = args.lieux.filter((lieu) => !lieu.archivedAt)
  const intervenantsDocumentes = args.intervenants.filter((intervenant) =>
    !intervenant.archivedAt && intervenant.statut !== "TERMINE",
  )
  const roleDocumente = (role: RoleIntervenantElevage) =>
    intervenantsDocumentes.some((intervenant) => intervenant.role === role)

  const manques: string[] = []
  if (!lieuxActifs.length) {
    manques.push("Lieux et constructions de détention non structurés")
  }
  if (!roleDocumente("DETENTEUR")) {
    manques.push("Détenteur des animaux non renseigné")
  }
  if (!roleDocumente("PROPRIETAIRE_ANIMAUX")) {
    manques.push("Propriétaire des animaux ou identité avec le détenteur non documenté")
  }
  if (!roleDocumente("RESPONSABLE_REGISTRE")) {
    manques.push("Personne chargée de tenir le registre et période de délégation non renseignées")
  }
  if (!roleDocumente("VETERINAIRE_SUIVI")) {
    manques.push("Vétérinaire de suivi régulier non renseigné")
  }
  if (!roleDocumente("VETERINAIRE_SANITAIRE") && !args.veterinaireSanitaireLegacy) {
    manques.push("Vétérinaire sanitaire non renseigné")
  }
  if (!roleDocumente("GDS_OVS")) {
    manques.push("Adhésion GDS/OVS ou absence d’adhésion non documentée")
  }
  if (!roleDocumente("ORGANISATION_PRODUCTION")) {
    manques.push("Organisation de production ou absence d’adhésion non documentée")
  }
  if (!roleDocumente("PROGRAMME_SANITAIRE")) {
    manques.push("Programme sanitaire d’élevage ou absence d’application non documenté")
  }
  return manques
}
