/** Données publiques de l'encyclopédie : aucune identité technique de compte. */
export const SECTIONS_ENCYCLOPEDIE = ["presentation", "semis", "conduite", "recolte", "varietes", "sources"] as const
export type SectionEncyclopedie = typeof SECTIONS_ENCYCLOPEDIE[number]
export const TITRES_SECTIONS: Record<SectionEncyclopedie, string> = {
  presentation: "Connaître la plante", semis: "Semer et planter", conduite: "Conduire la culture",
  recolte: "Récolter et conserver", varietes: "Variétés et itinéraires", sources: "Sources et références",
}
export type StatutContribution = "EN_ATTENTE" | "PUBLIEE" | "A_REPRENDRE" | "REFUSEE"
export interface RevisionEncyclopedieVue {
  id: string; section: SectionEncyclopedie; contenu: string; source: string; signature: string
  version: number; createdAt: string; licence: string; cibleType?: "SECTION" | TypeCibleCorrection; refId?: string
}
export interface SectionEncyclopedieVue extends Omit<RevisionEncyclopedieVue, "id"> { revisionId: string }
export interface ReponseEncyclopedieVue {
  id: string; contenu: string; signature: string; createdAt: string; supprimable: boolean
}
export interface DiscussionEncyclopedieVue extends ReponseEncyclopedieVue {
  titre: string; reponses: ReponseEncyclopedieVue[]; nbReponses: number
}
export interface CommunauteVegetalVue {
  sections: SectionEncyclopedieVue[]; revisions: RevisionEncyclopedieVue[]; discussions: DiscussionEncyclopedieVue[]; corrections?: CorrectionPublieeVue[]
}
export interface ContributionEncyclopedieVue {
  id: string; espece: { id: string; nom: string }; section: SectionEncyclopedie
  contenu: string; source: string; motif: string; signature: string; revisionBaseId: string | null
  statut: StatutContribution; decisionMotif: string | null; createdAt: string; licence: string; correction?: DetailCorrection
}
export interface ContributionModerationVue extends ContributionEncyclopedieVue {
  contenuActuel: string; revisionActuelleId: string | null; cibleActuelle?: CibleCorrectionVue; correctionObsolete?: boolean
}

export const CATEGORIES_FORUM = ["GENERAL", "ENTRAIDE", "PRATIQUES", "ENCYCLOPEDIE"] as const
export type CategorieForum = typeof CATEGORIES_FORUM[number]
export interface SujetForumVue {
  id: string; titre: string; signature: string; categorie: CategorieForum; createdAt: string; derniereActiviteAt: string
  epingle: boolean; resolu: boolean; nbReponses: number; espece: { id: string; nom: string } | null; supprimable: boolean
}
export interface FilForumVue extends SujetForumVue { contenu: string; reponses: ReponseEncyclopedieVue[]; pageReponses: number; pagesReponses: number }

export interface PageForumVue { sujets: SujetForumVue[]; total: number; page: number; pages: number }


export const TYPES_CIBLE_CORRECTION = ["ESPECE", "VARIETE", "ITP"] as const
export type TypeCibleCorrection = typeof TYPES_CIBLE_CORRECTION[number]
export type ValeurCorrection = string | number | boolean | null
export type ValeursCorrection = Record<string, ValeurCorrection>
export interface ChampCorrection {
  cle: string; libelle: string; type: "texte" | "nombre" | "booleen"; min?: number; max?: number; pas?: number; unite?: string; options?: readonly string[]
}
export const CHAMPS_CORRECTION: Record<TypeCibleCorrection, readonly ChampCorrection[]> = {
  ESPECE: [
    { cle: "nom", libelle: "Nom", type: "texte" },
    { cle: "nomLatin", libelle: "Nom botanique", type: "texte" },
    { cle: "description", libelle: "Présentation", type: "texte" },
    { cle: "vivace", libelle: "Plante vivace", type: "booleen" },
    { cle: "besoinEau", libelle: "Besoin en eau", type: "nombre", min: 1, max: 5, pas: 1 },
    { cle: "irrigation", libelle: "Indication d’irrigation", type: "texte" },
    { cle: "densite", libelle: "Densité indicative", type: "nombre", min: 0.01, max: 100000, unite: "plants/m²", pas: 0.01 },
    { cle: "joursLevee", libelle: "Durée de levée", type: "nombre", min: 1, max: 365, unite: "jours", pas: 1 },
    { cle: "temperatureGerm", libelle: "Température de germination", type: "texte" },
    { cle: "besoinFroid", libelle: "Besoin de froid", type: "texte", options: ["aucun", "faible", "modere", "eleve"] },
    { cle: "zonesAdaptees", libelle: "Zones climatiques adaptées", type: "texte" },
  ],
  VARIETE: [
    { cle: "nom", libelle: "Nom de la variété", type: "texte" },
    { cle: "bio", libelle: "Mention biologique", type: "booleen" },
    { cle: "semaineFloraison", libelle: "Début de floraison", type: "nombre", min: 1, max: 52, pas: 1, unite: "semaine ISO" },
    { cle: "dureeFloraison", libelle: "Durée de floraison", type: "nombre", min: 0, max: 52, pas: 1, unite: "semaines" },
    { cle: "semaineRecolte", libelle: "Début de récolte", type: "nombre", min: 1, max: 52, pas: 1, unite: "semaine ISO" },
    { cle: "dureeRecolte", libelle: "Durée de récolte", type: "nombre", min: 0, max: 52, pas: 1, unite: "semaines" },
    { cle: "groupePollinisation", libelle: "Groupe de floraison", type: "texte" },
    { cle: "ploidie", libelle: "Ploïdie", type: "texte" },
  ],
  ITP: [
    { cle: "nom", libelle: "Nom de l’itinéraire", type: "texte" },
    { cle: "typePlanche", libelle: "Conduite", type: "texte", options: ["Plein champ", "Sous abri", "Serre", "Tunnel", "Chassis"] },
    { cle: "modeDemarrage", libelle: "Démarrage", type: "texte", options: ["Plein champ", "Sous abri", "Pépinière"] },
    { cle: "semaineSemis", libelle: "Semis", type: "nombre", min: 1, max: 52, pas: 1, unite: "semaine ISO" },
    { cle: "semainePlantation", libelle: "Plantation", type: "nombre", min: 1, max: 52, pas: 1, unite: "semaine ISO" },
    { cle: "semaineRecolte", libelle: "Récolte", type: "nombre", min: 1, max: 52, pas: 1, unite: "semaine ISO" },
    { cle: "zoneClimat", libelle: "Zone climatique", type: "texte" },
  ],
}
export interface CibleCorrectionVue {
  cibleType: TypeCibleCorrection; refId: string; espece: { id: string; nom: string }; titre: string; valeurs: ValeursCorrection; empreinte: string; source: string; licenceSource?: string; cycleBase?: { dureeCulture: number | null; semaineImplantationDebut: number | null; delaiPremiereRecolteAnnees: number | null }
}
export interface DetailCorrection {
  cibleType: TypeCibleCorrection; refId: string; titre: string; avant: ValeursCorrection; apres: ValeursCorrection; changements: ValeursCorrection
}
export type CorrectionPublieeVue = Omit<RevisionEncyclopedieVue, "cibleType" | "refId"> & DetailCorrection
