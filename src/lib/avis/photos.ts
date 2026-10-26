/** Métadonnées uniquement : les images ne passent jamais dans les listes JSON. */
export const MAX_PHOTOS_AVIS = 3
export const MAX_OCTETS_PHOTO_AVIS = 700 * 1024
export const MAX_CORPS_AVIS = 3 * 1024 * 1024
export const COTE_MAX_PHOTO_AVIS = 1600
export interface PhotoAvisVue { id: string; url: string; width: number; height: number; legende: string | null }
export type PhotoAvisEnvoi = { id: string; legende?: string } | { dataUrl: string; legende?: string }
export interface TemoignageRecolteVue {
  id: string; dateRecolte: string; quantite: number | null; unite: string | null; commentaire: string | null
  photos: PhotoAvisVue[]; isMine: boolean; createdAt: string
}
export interface VuePartageRecolte {
  dateRecolte: string; quantite: number; unite: string; empreinte: string
  cibles: Array<{ refType: 'ESPECE' | 'VARIETE' | 'ITP'; refId: string; nom: string }>
  partages: Array<{ id: string; refType: string; refId: string }>
}
export interface StatsPartagesAvis { nbRecoltes: number; nbContributeurs: number; quantitesParUnite: Record<string, number> }
// Même préparation locale (canvas, orientation et compression) que les photos
// de l'assistant, sans dépendance à son API ni à ses conversations privées.
export { preparerPhotoAssistant as preparerPhotoAvis } from '@/lib/photos-assistant'
