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
  version: number; createdAt: string; licence: string
}
export interface SectionEncyclopedieVue extends Omit<RevisionEncyclopedieVue, "id"> { revisionId: string }
export interface ReponseEncyclopedieVue {
  id: string; contenu: string; signature: string; createdAt: string; supprimable: boolean
}
export interface DiscussionEncyclopedieVue extends ReponseEncyclopedieVue {
  titre: string; reponses: ReponseEncyclopedieVue[]; nbReponses: number
}
export interface CommunauteVegetalVue {
  sections: SectionEncyclopedieVue[]; revisions: RevisionEncyclopedieVue[]; discussions: DiscussionEncyclopedieVue[]
}
export interface ContributionEncyclopedieVue {
  id: string; espece: { id: string; nom: string }; section: SectionEncyclopedie
  contenu: string; source: string; motif: string; signature: string; revisionBaseId: string | null
  statut: StatutContribution; decisionMotif: string | null; createdAt: string; licence: string
}
export interface ContributionModerationVue extends ContributionEncyclopedieVue {
  contenuActuel: string; revisionActuelleId: string | null
}

export const CATEGORIES_FORUM = ["GENERAL", "ENTRAIDE", "PRATIQUES", "ENCYCLOPEDIE"] as const
export type CategorieForum = typeof CATEGORIES_FORUM[number]
export interface SujetForumVue {
  id: string; titre: string; signature: string; categorie: CategorieForum; createdAt: string; derniereActiviteAt: string
  epingle: boolean; resolu: boolean; nbReponses: number; espece: { id: string; nom: string } | null; supprimable: boolean
}
export interface FilForumVue extends SujetForumVue { contenu: string; reponses: ReponseEncyclopedieVue[]; pageReponses: number; pagesReponses: number }

export interface PageForumVue { sujets: SujetForumVue[]; total: number; page: number; pages: number }
