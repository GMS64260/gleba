/**
 * Forme d'un ITP telle que les vues la consomment — une seule déclaration.
 *
 * Quatre copies divergentes de ce type coexistaient (calendrier ITP, GanttRow,
 * dialog d'édition rapide, calendrier du tableau de bord). C'est cette
 * divergence qui a laissé le dialog d'édition ignorer `userId`, donc ignorer la
 * règle « seul l'auteur d'un ITP personnel peut le modifier », et proposer
 * l'édition de 241 itinéraires officiels avec un 403 à l'enregistrement.
 *
 * Les champs facultatifs le sont parce que toutes les routes ne les projettent
 * pas ; `id`, `nom` et `userId` sont en revanche exigés partout : ce sont eux
 * qui décident du libellé affiché, du calage climatique et du droit d'édition.
 */
export interface ItpVue {
  id: string
  nom: string | null
  /** null = catalogue Gleba officiel ; renseigné = créé par un membre. */
  userId: string | null
  especeId: string | null
  espece?: {
    id: string
    nom: string | null
    couleur: string | null
    /** BUG #15 — mode_semis pour différencier pépinière vs caïeux/bulbe direct */
    modeSemis?: string | null
    /**
     * `semis_direct` | `pepiniere_puis_repiquage` | … — dit si l'espèce se
     * repique, ce que le couple semis/plantation d'un ITP ne suffit pas à
     * déduire.
     */
    typeCultureSemis?: string | null
    famille?: { id?: string } | null
  } | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  semaineImplantationDebut?: number | null
  semaineImplantationFin?: number | null
  semaineRecolteFin?: number | null
  dureeRecolte: number | null
  dureePepiniere?: number | null
  typePlanche: string | null
  zoneClimat?: string | null
  implantation?: string | null
  statutValidation?: string | null
  sourceRecordId?: string | null
  notes: string | null
}
