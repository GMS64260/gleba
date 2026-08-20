/**
 * Bibliotheque de calcul pour la planification des cultures
 * Logique métier historique.
 */

import prisma from '@/lib/prisma'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { calculerDateDepuisSemaine, dateSemaineChrono } from './assistant-helpers'
import { whereItpUtilisable } from './itp-acces'
import { alertesAssociations } from './associations-alertes'
import { appliquerDecalageItp, decalageItpPourLecteur } from './calendrier-climat'
import { moisDepuisSemaine, semaineSemisEffective } from './cultures/dates-itp'
import { projectionRecolteKg } from './recolte/projection'
import type { StatutSemence } from './semences/calcul'
import { zoneEffectiveUser } from './terroir'
import { etapeCycleRotation } from './rotation/etape-cycle'

export { etapeCycleRotation, EPOCH_ROTATION_SANS_ANCRAGE } from './rotation/etape-cycle'

/**
 * Bug #4 — Si la planche n'a pas d'îlot explicite, dériver depuis le préfixe
 * alpha du nom (A1 → A, B3 → B, Rang 01 → Rang). Évite que l'écran
 * "Par planches" affiche "-" sur l'intégralité des lignes pour les utilisateurs
 * qui n'ont pas formalisé leurs îlots.
 */
function deriveIlot(ilot: string | null, nom: string | null | undefined): string | null {
  if (ilot && ilot.trim().length > 0) return ilot
  if (!nom) return null
  const match = nom.match(/^[A-Za-zÀ-ÿ]+/)
  return match ? match[0] : null
}

// ============================================================
// TYPES
// ============================================================

export interface CulturePrevue {
  plancheId: string
  plancheLongueur: number | null
  plancheLargeur: number | null
  plancheSurface: number | null
  /** Portion de longueur réellement allouée à la culture, si saisie. */
  cultureLongueur: number | null
  /**
   * Nombre de plants calculé et ENREGISTRÉ par la fiche culture (champ
   * `quantite`). C'est le chiffre que l'utilisateur a validé : les écrans
   * de besoins doivent le reprendre tel quel plutôt que de le recalculer
   * (QA cmsqm5f3f : Poireau 198 plants sur la fiche, 66 à l'écran Plants).
   */
  cultureQuantite: number | null
  /**
   * Date de récolte RÉELLEMENT stockée sur la culture, quand elle existe.
   *
   * `semaineRecolte` en est dérivée et perd de l'information : une semaine ISO
   * chevauche deux mois, si bien qu'une récolte du 2 juillet appartient à une
   * semaine dont le lundi tombe le 29 juin. Ventiler les kilos sur la semaine
   * plaçait donc cette récolte en juin sur Planification, quand le tableau de
   * bord et le Calendrier la lisent en juillet depuis la même date. La date
   * fait foi partout ailleurs : elle doit descendre jusqu'ici.
   *
   * Null pour les suggestions de rotation, qui n'ont pas de date par
   * construction — la semaine de l'ITP est alors la seule information
   * disponible.
   */
  cultureDateRecolte: Date | null
  ilot: string | null
  rotationId: string | null
  rotationAnnee: number // Annee dans le cycle (1, 2, 3...)
  /**
   * QA cmswy9fyr — deux planches sur la MÊME rotation et la même année peuvent
   * légitimement être à des étapes différentes : la phase est ancrée sur
   * `Planche.annee` (« l'année où cette planche est à l'étape 1 »), ce qui permet
   * d'étaler un même cycle sur plusieurs planches. Mais rien ne l'exposait, et
   * une planche SANS année d'ancrage retombe sur un epoch fixe, donc sur une
   * phase arbitraire. Les écrans peuvent désormais nommer l'ancrage et la
   * position dans le cycle — ou signaler qu'il n'y en a pas.
   */
  rotationNbAnnees: number | null
  rotationAncrage: number | null
  itpId: string | null
  especeId: string | null
  especeCouleur: string | null
  varieteId: string | null
  annee: number // Annee reelle
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  surface: number
  existante: boolean // Culture deja creee ?
  cultureId: number | null // ID si existante
}

export interface RecoltePrevue {
  periode: string // "Janvier", "Fevrier"... ou "S1", "S2"...
  periodeNum: number // 1-12 pour mois, 1-52 pour semaines
  especes: {
    especeId: string
    especeCouleur: string | null
    quantite: number // kg
    surface: number // m2
  }[]
  totalKg: number
  totalSurface: number
}

/** Unités possibles de `Espece.uniteDose` (cf. prisma/schema.prisma). */
export type UniteDoseSemence = 'g_m2' | 'pieces_m2' | 'graines_plant' | 'caieux_m2' | null

export interface BesoinSemence {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  surfaceTotale: number
  nbPlants: number
  /** Mode de propagation décidé par l'espèce (cf. `Espece.modeSemis`). */
  mode: 'graine_directe' | 'plant_repique' | 'bulbe_caieu' | 'bouture'
  /** Besoin en grammes — 0 si `mode === 'bulbe_caieu'`. */
  grainesNecessaires: number
  /** Besoin en caieux/bulbes/plants entiers — 0 si mode graine_*. */
  besoinCaieux: number
  margeSecuritePct: number
  /** Stock actuel en grammes (modes graine). */
  stockActuel: number
  /** Stock actuel en plants/caieux (modes bulbe_caieu / bouture). */
  stockUnites: number
  /** Nombre de graines par gramme. Valeur de la variété, ou fallback par espèce
   *  si non saisie (cf. nbGrainesGEstime). */
  nbGrainesG: number | null
  /** true si nbGrainesG est une estimation (fallback espèce), pas la valeur saisie. */
  nbGrainesGEstime: boolean
  doseSemis: number | null
  /** Unité dans laquelle est exprimée la dose (cf. Espece.uniteDose). */
  uniteDose: 'g_m2' | 'pieces_m2' | 'graines_plant' | 'caieux_m2' | null
  /** Taux de germination réaliste (mémo pour tooltip marge). */
  tauxGerminationPct: number | null
  /** Manque à commander (en grammes pour modes graine). */
  aCommander: number
  /** Manque à commander (en unités pour mode bulbe_caieu). */
  caieuxACommander: number
  /**
   * Statut métier : OK / LOW / MISSING / IGNORE / DONNEE_MANQUANTE
   * (QA cmswxo3ri — culture planifiée dont le référentiel ne permet aucun calcul).
   */
  statut: StatutSemence
  /** Date de la dernière mise à jour du stock pour la variété (null si absent). */
  stockDateMaj: string | null
}

export interface BesoinPlant {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  nbPlants: number
  semainePlantation: number | null
  stockActuel: number
  aCommander: number
  cultures: {
    plancheId: string
    surface: number
    nbPlants: number
  }[]
}

export interface AssociationCulture {
  plancheId: string
  ilot: string | null
  cultureEspeceId: string | null
  cultureSemaine: number | null
  planchesVoisines: string[]
  culturesVoisines: {
    plancheId: string
    especeId: string | null
    // Bug #6 — Évaluation de l'association culture⟷voisin pour signaler
    // les paires bénéfiques/néfastes (la promesse du bandeau d'info).
    eval: "favorable" | "defavorable" | "neutre"
    evalMessage: string | null
  }[]
  // Synthèse au niveau de la planche pour pouvoir trier / colorer la ligne.
  scoreAssociation: "favorable" | "defavorable" | "mixte" | "neutre"
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

/**
 * Calcule l'annee reelle a partir de l'annee de base et de l'annee dans le cycle
 */
function calculerAnneeReelle(anneeBase: number, anneeCycle: number, nbAnneesCycle: number): number {
  // anneeCycle est 1-indexed (1, 2, 3...)
  // On utilise modulo pour gerer les cycles
  return anneeBase + (anneeCycle - 1)
}

/**
 * Calcule l'annee du cycle pour une annee donnee
 */
function calculerAnneeCycle(annee: number, anneeBase: number, nbAnneesCycle: number): number {
  if (nbAnneesCycle <= 0) return 1
  const diff = annee - anneeBase
  return ((diff % nbAnneesCycle) + nbAnneesCycle) % nbAnneesCycle + 1
}

/**
 * Calcule le nombre de plants pour une planche/ITP donne
 */
function calculerNbPlants(
  longueur: number | null,
  largeur: number | null,
  nbRangs: number | null,
  espacement: number | null
): number {
  if (!longueur || !nbRangs || !espacement) return 0
  // espacement en cm, longueur en m
  const longueurCm = longueur * 100
  const nbPlantsParRang = Math.floor(longueurCm / espacement)
  return nbPlantsParRang * nbRangs
}

/**
 * Convertit une date en numero de semaine ISO (1-53) — sert de fallback
 * quand Culture.semaineRecolte n'est pas fourni par un ITP rattache.
 */
function dateVersSemaine(d: Date, anneeAttendue?: number): number | null {
  // Bug (testeur) : une récolte en janvier 2027 (carotte conservation) ne doit pas
  // apparaître en semaine 2 du calendrier 2026. Si la date n'est pas dans l'année
  // affichée, on retourne null (la culture sera exclue de cette vue annuelle).
  // Les dates issues d'un <input type="date"> peuvent être persistées à
  // 23:00 UTC la veille (minuit Europe/Paris). Le passage à midi UTC conserve
  // le jour civil choisi, quel que soit le décalage usuel du navigateur.
  const jourCivil = new Date(d.getTime() + 12 * 3_600_000)
  if (anneeAttendue != null && getISOWeekYear(jourCivil) !== anneeAttendue) return null
  return getISOWeek(jourCivil)
}

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

/**
 * Bug #1 (testeur) — Cohérence temporelle semis ≤ plantation ≤ récolte.
 *
 * Cas réel : Pomme de terre B3 (mode bulbe/tubercule) sans date de semis
 * saisie mais avec une date de plantation réelle (S15). Le calcul mélangeait
 * la semaine de semis THÉORIQUE de l'ITP (S16) avec la plantation RÉELLE
 * (S15) → « plantation avant semis ». Les tubercules/bulbes/semis directs
 * n'ont d'ailleurs pas d'étape de semis en pépinière distincte.
 *
 * Règle : la donnée RÉELLE (saisie) prime toujours. Si une semaine provient
 * d'un fallback ITP et casse l'ordre chronologique vis-à-vis d'une donnée
 * réelle, on la supprime (null) plutôt que d'afficher une incohérence.
 */
function coherenceSemaines(input: {
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  semisReel: boolean
  plantationReelle: boolean
  recolteReelle: boolean
}): { semaineSemis: number | null; semainePlantation: number | null; semaineRecolte: number | null } {
  let { semaineSemis, semainePlantation, semaineRecolte } = input

  // Semis théorique (ITP) postérieur à une plantation réelle → on l'écarte.
  if (
    semaineSemis != null &&
    semainePlantation != null &&
    semaineSemis > semainePlantation
  ) {
    if (!input.semisReel && input.plantationReelle) {
      semaineSemis = null
    } else if (input.semisReel && !input.plantationReelle) {
      // Plantation théorique antérieure au semis réel → on l'écarte.
      semainePlantation = null
    }
  }

  // Plantation théorique postérieure à une récolte réelle → on l'écarte.
  if (
    semainePlantation != null &&
    semaineRecolte != null &&
    semainePlantation > semaineRecolte
  ) {
    if (!input.plantationReelle && input.recolteReelle) {
      semainePlantation = null
    } else if (input.plantationReelle && !input.recolteReelle) {
      semaineRecolte = null
    }
  }

  // Semis théorique postérieur à une récolte réelle (sans plantation) → écarté.
  if (
    semaineSemis != null &&
    semaineRecolte != null &&
    semaineSemis > semaineRecolte &&
    !input.semisReel &&
    input.recolteReelle
  ) {
    semaineSemis = null
  }

  return { semaineSemis, semainePlantation, semaineRecolte }
}

// ============================================================
// FONCTIONS PRINCIPALES
// ============================================================

/**
 * Recupere les cultures prevues pour une annee donnee
 * Basee sur les rotations assignees aux planches
 */
export async function getCulturesPrevues(
  userId: string,
  annee: number,
  options?: {
    especeId?: string
    ilot?: string
    plancheId?: string
    /**
     * Les écrans d'inventaire et leurs compteurs doivent conserver toutes les
     * cultures réellement créées, y compris celles déjà récoltées/terminées.
     * Les calculs de besoins et de récoltes restantes gardent le filtre
     * historique quand cette option est absente.
     */
    includeAllCultures?: boolean
    /**
     * QA cmsbterw9 — une culture « en récolte » (recolteFaite=true mais non
     * terminée) occupe encore physiquement la planche : les associations
     * doivent la voir comme voisine. Les cultures terminées restent exclues.
     */
    inclureEnRecolte?: boolean
  }
): Promise<CulturePrevue[]> {
  const userZone = await zoneEffectiveUser(prisma, userId)

  // Mode 1: Cultures basées sur rotations
  const planches = await prisma.planche.findMany({
    where: {
      userId,
      rotationId: { not: null },
      ...(options?.ilot && { ilot: options.ilot }),
      ...(options?.plancheId && { nom: options.plancheId }),
    },
    include: {
      rotation: {
        include: {
          details: {
            include: {
              itp: {
                include: {
                  espece: true,
                },
              },
            },
            orderBy: { annee: 'asc' },
          },
        },
      },
      cultures: {
        where: { annee },
        select: {
          id: true,
          especeId: true,
          varieteId: true,
          itpId: true,
          dateSemis: true,
          datePlantation: true,
          dateRecolte: true,
          longueur: true,
          quantite: true,
          nbRangs: true,
          espacement: true,
          recolteFaite: true,
          terminee: true,
        },
      },
    },
  })

  const culturesPrevues: CulturePrevue[] = []
  /** Position dans le cycle de rotation, par planche (cf. QA cmswy9fyr). */
  const phaseParPlanche = new Map<
    string,
    { etape: number; nbAnnees: number; ancrage: number | null }
  >()

  for (const planche of planches) {
    if (!planche.rotation || planche.rotation.details.length === 0) continue

    const nbAnneesCycle = planche.rotation.nbAnnees || planche.rotation.details.length

    // Étape courante du cycle, ancrée sur planche.annee (année où la rotation
    // est à l'étape 1). Auparavant anneeBase = annee - 10 était relatif à
    // l'année demandée, donc l'équation de correspondance était constante et
    // la même étape ressortait chaque année (audit 2026-07, #26). Repli sur un
    // epoch fixe si planche.annee absent : la phase est alors arbitraire mais
    // progresse correctement d'une année sur l'autre.
    const etapeCourante = etapeCycleRotation(annee, planche.annee, nbAnneesCycle)
    // QA cmswy9fyr — la phase doit aussi être lisible sur les planches DÉJÀ
    // cultivées : elles passent par le mode 2 ci-dessous, qui ne connaît pas le
    // cycle. Sans ça, comparer une planche neuve à une planche en culture sur la
    // même rotation était impossible — c'est exactement ce qui a été signalé.
    phaseParPlanche.set(planche.id, {
      etape: etapeCourante,
      nbAnnees: nbAnneesCycle,
      ancrage: planche.annee ?? null,
    })

    for (const detail of planche.rotation.details) {
      if (detail.annee !== etapeCourante) continue

      // Filtrer par espece si demande
      if (options?.especeId && detail.itp?.especeId !== options.especeId) {
        continue
      }

      // Verifier si une culture existe deja
      const cultureExistante = planche.cultures.find(
        c => c.itpId === detail.itpId || c.especeId === detail.itp?.especeId
      )

      // Une culture récoltée/terminée reste visible dans les écrans
      // d'inventaire, mais ne doit plus alimenter les projections restantes.
      // On la traite ici avant le fallback rotation pour ne pas recréer une
      // suggestion fantôme sur une planche déjà occupée cette année.
      if (
        cultureExistante &&
        !options?.includeAllCultures &&
        (cultureExistante.terminee !== null ||
          (cultureExistante.recolteFaite && !options?.inclureEnRecolte))
      ) {
        continue
      }

      // Bug R3/B (testeur) : ne pas injecter de culture « fantôme » à créer
      // quand la planche est DÉJÀ occupée par des cultures réelles cette
      // année (la suggestion de rotation polluait l'inventaire réel).
      if (!cultureExistante && planche.cultures.length > 0) continue

      // Bug R19/R26 : si une culture réelle existe, ses dates SAISIES priment
      // sur les semaines théoriques de l'ITP (sinon toutes les successions
      // d'une planche affichent les mêmes semaines ITP).
      // Bug #1 : on applique ensuite `coherenceSemaines` pour éviter qu'un
      // fallback ITP (ex. semis théorique) casse l'ordre vis-à-vis d'une
      // date réelle (ex. plantation saisie sans semis → semis > plantation).
      const itpCalibreM1 = detail.itp
        ? appliquerDecalageItp(
            detail.itp,
            decalageItpPourLecteur(detail.itp, userZone, userId)
          )
        : null
      const semainesM1 = coherenceSemaines({
        semaineSemis: cultureExistante?.dateSemis ? dateVersSemaine(cultureExistante.dateSemis, annee) : (itpCalibreM1?.semaineSemis || null),
        semainePlantation: cultureExistante?.datePlantation ? dateVersSemaine(cultureExistante.datePlantation, annee) : (itpCalibreM1?.semainePlantation || null),
        semaineRecolte: cultureExistante?.dateRecolte ? dateVersSemaine(cultureExistante.dateRecolte, annee) : (itpCalibreM1?.semaineRecolte || null),
        semisReel: !!cultureExistante?.dateSemis,
        plantationReelle: !!cultureExistante?.datePlantation,
        recolteReelle: !!cultureExistante?.dateRecolte,
      })
      const surfacePlanche = (planche.longueur || 0) * (planche.largeur || 0)
      const surface =
        cultureExistante?.longueur && planche.largeur
          ? cultureExistante.longueur * planche.largeur
          : surfacePlanche

      culturesPrevues.push({
        plancheId: planche.nom,
        plancheLongueur: planche.longueur,
        plancheLargeur: planche.largeur,
        plancheSurface: planche.surface,
        cultureLongueur: cultureExistante?.longueur ?? null,
        cultureQuantite: cultureExistante?.quantite ?? null,
        cultureDateRecolte: cultureExistante?.dateRecolte ?? null,
        ilot: deriveIlot(planche.ilot, planche.nom),
        rotationId: planche.rotationId,
        rotationAnnee: detail.annee,
        rotationNbAnnees: nbAnneesCycle,
        rotationAncrage: planche.annee ?? null,
        itpId: detail.itpId,
        especeId: detail.itp?.especeId || null,
        especeCouleur: detail.itp?.espece?.couleur || null,
        varieteId: cultureExistante?.varieteId ?? null, // A definir lors de la creation
        annee,
        semaineSemis: semainesM1.semaineSemis,
        semainePlantation: semainesM1.semainePlantation,
        semaineRecolte: semainesM1.semaineRecolte,
        dureeCulture: detail.itp?.dureeCulture || null,
        nbRangs: cultureExistante?.nbRangs || detail.itp?.nbRangs || null,
        espacement: cultureExistante?.espacement || detail.itp?.espacement || null,
        surface,
        existante: !!cultureExistante,
        cultureId: cultureExistante?.id || null,
      })
    }
  }

  // Mode 2: Cultures directes (sans rotation)
  //
  // Bug feedback testeur 2026-05-25 (cmplk8h0e) — `getRecoltesPrevues`
  // utilisait toutes les cultures de l'année (y compris celles dont la
  // récolte est déjà faite ou terminées), tandis que `getRecoltesAnneeAggregat`
  // (utilisé par le header) filtre `recolteFaite=false AND terminee=null`.
  // Résultat : header 1367 kg attendu vs somme du détail 1692 kg.
  // On aligne ici en excluant les cultures déjà récoltées/terminées : la
  // récolte réelle saisie remplace la projection pour ces cultures (cf.
  // KPI annuel). La projection détaillée ne couvre désormais que ce qu'il
  // RESTE à produire — cohérent avec l'agrégat unifié.
  const culturesDirectes = await prisma.culture.findMany({
    where: {
      userId,
      annee,
      ...(!options?.includeAllCultures && {
        terminee: null,
        ...(options?.inclureEnRecolte ? {} : { recolteFaite: false }),
      }),
      ...(options?.especeId && { especeId: options.especeId }),
      ...(options?.plancheId && { planche: { nom: options.plancheId } }),
      ...(options?.ilot && { planche: { ilot: options.ilot } }),
    },
    include: {
      espece: {
        select: {
          id: true,
          couleur: true,
          rendement: true,
        },
      },
      itp: true,
      planche: true,
      variete: true,
    },
  })

  // Ajouter les cultures directes qui ne sont pas déjà dans les prevues (via rotation)
  for (const culture of culturesDirectes) {
    // `CulturePrevue.plancheId` contient le NOM affiché tandis que
    // `Culture.plancheId` contient le cuid. Les comparer empêchait la
    // déduplication et ajoutait une seconde ligne après création depuis une
    // rotation. L'identifiant de culture est globalement unique et suffit.
    const dejaPresente = culturesPrevues.some(cp => cp.cultureId === culture.id)

    // QA cmsw8wni8 (2026-08-16) — une culture SANS planche (saisie sans
    // planche, ou orpheline après suppression de sa planche) était écartée
    // silencieusement du tableau et des compteurs : Planification annonçait
    // 23 cultures quand l'écran Cultures et le tableau de bord en comptaient
    // 25. La planche est optionnelle sur Culture : on inclut ces lignes avec
    // plancheId vide (affiché « sans planche ») au lieu de les perdre.
    if (!dejaPresente) {
      const planche = culture.planche
      const phase = planche ? phaseParPlanche.get(planche.id) : undefined
      const surfacePlanche = (planche?.longueur || 0) * (planche?.largeur || 0)

      // Bug R19/R26 : la DATE RÉELLE saisie sur la culture prime sur la semaine
      // théorique de l'ITP (sinon 2 cultures en succession affichent la même
      // semaine ITP). Année-aware → exclut les récoltes d'une autre année.
      // Bug #1 : `coherenceSemaines` écarte le fallback ITP (ex. semis S16 pour
      // une PdT/tubercule) lorsqu'il devient postérieur à la plantation RÉELLE
      // (S15) — « plantation avant semis ».
      const itpCalibreM2 = culture.itp
        ? appliquerDecalageItp(
            culture.itp,
            decalageItpPourLecteur(culture.itp, userZone, userId)
          )
        : null
      const semainesM2 = coherenceSemaines({
        semaineSemis: culture.dateSemis ? dateVersSemaine(culture.dateSemis, annee) : (itpCalibreM2?.semaineSemis ?? null),
        semainePlantation: culture.datePlantation
          ? dateVersSemaine(culture.datePlantation, annee)
          : (itpCalibreM2?.semainePlantation ?? null),
        semaineRecolte: culture.dateRecolte
          ? dateVersSemaine(culture.dateRecolte, annee)
          : (itpCalibreM2?.semaineRecolte ?? null),
        semisReel: !!culture.dateSemis,
        plantationReelle: !!culture.datePlantation,
        recolteReelle: !!culture.dateRecolte,
      })

      culturesPrevues.push({
        plancheId: planche?.nom || '',
        plancheLongueur: planche?.longueur ?? null,
        plancheLargeur: planche?.largeur ?? null,
        plancheSurface: planche?.surface ?? null,
        cultureLongueur: culture.longueur,
        cultureQuantite: culture.quantite ?? null,
        cultureDateRecolte: culture.dateRecolte ?? null,
        ilot: planche ? deriveIlot(planche.ilot, planche.nom) : null,
        rotationId: planche?.rotationId ?? null,
        // 0 = planche sans rotation. Si elle en a une, on expose sa position
        // réelle dans le cycle et son ancrage (QA cmswy9fyr).
        rotationAnnee: phase?.etape ?? 0,
        rotationNbAnnees: phase?.nbAnnees ?? null,
        rotationAncrage: phase?.ancrage ?? planche?.annee ?? null,
        itpId: culture.itpId,
        especeId: culture.especeId,
        especeCouleur: culture.espece?.couleur || null,
        varieteId: culture.varieteId,
        annee: culture.annee || annee,
        semaineSemis: semainesM2.semaineSemis,
        semainePlantation: semainesM2.semainePlantation,
        semaineRecolte: semainesM2.semaineRecolte,
        dureeCulture: culture.itp?.dureeCulture || null,
        nbRangs: culture.nbRangs || culture.itp?.nbRangs || null,
        espacement: culture.espacement || culture.itp?.espacement || null,
        surface: culture.longueur && planche?.largeur
          ? culture.longueur * planche.largeur
          : surfacePlanche,
        existante: true, // Culture déjà créée
        cultureId: culture.id,
      })
    }
  }

  return culturesPrevues
}

/**
 * Recupere les recoltes prevues groupees par mois ou semaine
 */
/**
 * Détail des récoltes prévues : les périodes affichées ET la ventilation de la
 * projection entre cultures déjà créées et suggestions de rotation.
 *
 * QA cmswxpaer — l'écran « Récoltes prévues » affichait « 0,0 kg attendu » en
 * en-tête et sur ses trois cartes alors que sa ligne Juillet annonçait 361,9 kg.
 * Les deux nombres ne venaient pas de la même population : les cartes lisent
 * `getRecoltesAnneeAggregat`, borné aux cultures RÉELLEMENT créées, tandis que
 * le tableau projette aussi les cultures suggérées par les rotations. En 2028,
 * une seule culture était créée → cartes à zéro, tableau à 361,9 kg. La
 * ventilation permet à l'écran d'annoncer un total qui couvre ce qu'il montre,
 * comme le font déjà Semences et Plants (QA cmsob4f5t).
 */
export interface RecoltesPrevuesDetail {
  periodes: RecoltePrevue[]
  /** Projection des cultures déjà créées (kg) — déjà comprise dans l'agrégat annuel. */
  projectionCreeesKg: number
  /** Projection des cultures suggérées par les rotations, pas encore créées (kg). */
  projectionSuggestionsKg: number
}

export async function getRecoltesPrevues(
  userId: string,
  annee: number,
  groupBy: 'mois' | 'semaine' = 'mois'
): Promise<RecoltePrevue[]> {
  return (await getRecoltesPrevuesDetail(userId, annee, groupBy)).periodes
}

export async function getRecoltesPrevuesDetail(
  userId: string,
  annee: number,
  groupBy: 'mois' | 'semaine' = 'mois'
): Promise<RecoltesPrevuesDetail> {
  const culturesPrevues = await getCulturesPrevues(userId, annee)
  let projectionCreeesKg = 0
  let projectionSuggestionsKg = 0

  // Grouper par periode
  const groupedMap = new Map<number, {
    especes: Map<string, { especeId: string; especeCouleur: string | null; quantite: number; surface: number }>
  }>()

  // Recuperer les rendements des especes
  const especeIds = [...new Set(culturesPrevues.map(c => c.especeId).filter(Boolean))]
  const especes = await prisma.espece.findMany({
    where: { id: { in: especeIds as string[] } },
    // `rendement` est un nombre dont le sens dépend de `uniteRendement` : sans
    // elle, un Kiwi à 25 kg/ARBRE était projeté à 750 kg sur 30 m².
    select: { id: true, rendement: true, uniteRendement: true, couleur: true },
  })
  const especeMap = new Map(especes.map(e => [e.id, e]))

  for (const culture of culturesPrevues) {
    if (!culture.semaineRecolte || !culture.especeId) continue

    // La DATE stockée fait foi pour le mois : c'est elle que le tableau de
    // bord et le Calendrier lisent. La semaine ISO ne sert que pour les
    // cultures qui n'ont pas de date (suggestions de rotation), où elle est la
    // seule information disponible — et son lundi peut alors tomber dans le
    // mois précédent, ce qui est sans conséquence puisque rien d'autre ne
    // projette ces lignes.
    const periodeNum = groupBy === 'mois'
      ? (culture.cultureDateRecolte
          ? culture.cultureDateRecolte.getMonth() + 1
          : moisDepuisSemaine(culture.annee, culture.semaineRecolte))
      : culture.semaineRecolte

    if (!groupedMap.has(periodeNum)) {
      groupedMap.set(periodeNum, { especes: new Map() })
    }

    const group = groupedMap.get(periodeNum)!
    const especeData = especeMap.get(culture.especeId)

    const quantite = projectionRecolteKg(
      culture.surface,
      especeData?.rendement,
      especeData?.uniteRendement,
    )
    if (culture.existante) projectionCreeesKg += quantite
    else projectionSuggestionsKg += quantite
    const key = culture.especeId

    if (!group.especes.has(key)) {
      group.especes.set(key, {
        especeId: culture.especeId,
        especeCouleur: culture.especeCouleur,
        quantite: 0,
        surface: 0,
      })
    }

    const especeGroup = group.especes.get(key)!
    especeGroup.quantite += quantite
    especeGroup.surface += culture.surface
  }

  // Convertir en tableau
  const result: RecoltePrevue[] = []
  const maxPeriode = groupBy === 'mois' ? 12 : 52

  for (let i = 1; i <= maxPeriode; i++) {
    const group = groupedMap.get(i)
    const especesArray = group ? Array.from(group.especes.values()) : []

    result.push({
      // Bug cmp8scj32 (Marc 2026-05-16) — uniformisation format semaine
      // (padStart 2) pour cohérence avec formatSemaine() et tri texte stable.
      periode: groupBy === 'mois' ? MOIS_NOMS[i - 1] : `S${i.toString().padStart(2, '0')}`,
      periodeNum: i,
      especes: especesArray,
      totalKg: especesArray.reduce((sum, e) => sum + e.quantite, 0),
      totalSurface: especesArray.reduce((sum, e) => sum + e.surface, 0),
    })
  }

  return {
    periodes: result,
    projectionCreeesKg: Math.round(projectionCreeesKg * 100) / 100,
    projectionSuggestionsKg: Math.round(projectionSuggestionsKg * 100) / 100,
  }
}

/**
 * Ce que « pèse » une culture pour les écrans de besoins : sa surface et son
 * nombre de plants.
 *
 * Il en existait DEUX implémentations, qui ne rendaient pas les mêmes chiffres
 * pour la même ligne de base — Plants nécessaires annonçait 1 000 plants de
 * tomate là où Semences en annonçait 100, et la fiche culture 1 000. Deux
 * divergences en cause :
 *
 *  1. `Culture.quantite` — le nombre de plants que l'utilisateur a validé sur
 *     la fiche — faisait foi côté Plants et était purement ignoré côté
 *     Semences, qui repartait d'un calcul géométrique.
 *  2. Le prorata 1/N des planches partagées, conçu pour ne pas compter N fois
 *     la SURFACE d'une planche, était appliqué côté Semences au nombre de
 *     plants et à la surface propre de la culture : l'oignon annonçait
 *     « 37 bulbilles » pour 100 plants, la carotte 1,5 g pour 5 m² de rang.
 *     L'utilisateur commandait le tiers de ses semences.
 *
 * Une seule règle, ici, pour les deux écrans :
 *  - la quantité enregistrée sur la fiche est la vérité quand elle existe ;
 *  - le prorata ne s'applique QU'AUX grandeurs dérivées de la planche entière.
 *    Une culture qui porte sa propre longueur décrit déjà sa part : 198
 *    poireaux plantés demandent 198 plants, quelle que soit la colocation de
 *    la planche.
 */
export type MesureCulture = {
  /** Surface imputable à cette culture (m²). */
  surfaceM2: number
  /** Plants imputables à cette culture. */
  nbPlants: number
}

export function mesurerCulture(
  culture: CulturePrevue,
  refs: {
    culturesParPlanche: Map<string, number>
    itpFallback: Map<string, { nbRangs: number; espacement: number }>
    densiteFallback: Map<string, number>
  },
): MesureCulture {
  const partageFactor = culture.plancheId
    ? 1 / (refs.culturesParPlanche.get(culture.plancheId) ?? 1)
    : 1

  // La culture porte sa propre longueur : sa surface est déjà la sienne, et
  // tout ce qui en dérive aussi. Sinon la mesure vient de la planche entière,
  // partagée entre ses N occupantes.
  const longueurPropre = culture.cultureLongueur ?? null
  const facteurPlanche = longueurPropre ? 1 : partageFactor

  const surfaceM2 = culture.surface * facteurPlanche

  if (culture.cultureQuantite && culture.cultureQuantite > 0) {
    return { surfaceM2, nbPlants: Math.round(culture.cultureQuantite) }
  }

  // Fallbacks en cascade quand la fiche est incomplètement saisie :
  // nbRangs/espacement de la culture, puis d'un ITP de l'espèce, puis
  // densité (plants/m²) de l'espèce.
  const especeId = culture.especeId
  const fb = especeId ? refs.itpFallback.get(especeId) : undefined
  const nbRangs = culture.nbRangs ?? fb?.nbRangs ?? null
  const espacement = culture.espacement ?? fb?.espacement ?? null
  const longueurEffective =
    longueurPropre ??
    (culture.plancheLargeur && culture.surface > 0
      ? culture.surface / culture.plancheLargeur
      : culture.plancheLongueur)

  let nbPlantsBrut = calculerNbPlants(
    longueurEffective,
    culture.plancheLargeur,
    nbRangs,
    espacement,
  )
  if (nbPlantsBrut === 0 && especeId) {
    const dens = refs.densiteFallback.get(especeId)
    // Ce repli part de `culture.surface`, donc de la planche entière quand la
    // culture n'a pas de longueur propre : il suit le même facteur que tout
    // le reste.
    if (dens && culture.surface > 0) nbPlantsBrut = Math.ceil(culture.surface * dens)
  }

  return { surfaceM2, nbPlants: Math.round(nbPlantsBrut * facteurPlanche) }
}

/**
 * Calcule les besoins en semences pour une annee.
 *
 * Refactor PROMPT 06 : on délègue le calcul à `calculerBesoin` qui couvre
 * les 3 modes (graine_directe, plant_repique, bulbe_caieu) et applique une
 * marge de sécurité paramétrée sur l'espèce.
 */
export async function getBesoinsSemences(
  userId: string,
  annee: number
): Promise<BesoinSemence[]> {
  const { calculerBesoin, defaultGrainesParGramme } = await import('./semences/calcul')
  // QA cmsob4f5t — les suggestions (existante: false) comptent dans les
  // besoins, comme le fait déjà getBesoinsPlants : l'écran Plants incluait
  // les tomates suggérées, Semences ignorait les haricots suggérés. Le
  // Bug #8 historique (testeur Marc : suggestions gonflant les surfaces)
  // est couvert depuis par deux garde-fous dans getCulturesPrevues : pas de
  // suggestion sur une planche déjà occupée par des cultures réelles, et
  // prorata 1/N multi-cultures (BUG-21) — identiques à ceux de Plants.
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Référentiel : modes/dose par espèce, graines/g par variété, stocks user.
  // Feedback Marc 2026-05-16 — Bug 12 : on ajoute `densite` au select
  // pour pouvoir calculer nbPlants à partir de surface × densite quand
  // les ITPs/cultures n'ont pas nbRangs/espacement renseignés.
  const [especes, varietes, userStocks] = await Promise.all([
    prisma.espece.findMany({
      select: {
        id: true,
        couleur: true,
        modeSemis: true,
        doseSemis: true,
        uniteDose: true,
        tauxGermination: true,
        margeSecuritePct: true,
        densite: true,
        famille: { select: { couleur: true } },
      },
    }),
    prisma.variete.findMany({
      select: { id: true, especeId: true, nbGrainesG: true },
    }),
    prisma.userStockVariete.findMany({
      where: { userId },
      select: {
        varieteId: true,
        stockGraines: true,
        stockPlants: true,
        dateStock: true,
      },
    }),
  ])
  const especeMap = new Map(especes.map(e => [e.id, e]))
  const varieteMap = new Map(varietes.map(v => [v.id, v]))
  const userStockMap = new Map(userStocks.map(us => [us.varieteId, us]))

  // Feedback Marc 2026-05-16 — Bug 12 : fallback ITP référentiel quand
  // la culture n'a ni nbRangs ni espacement (cas le plus courant
  // tant qu'aucun ITP n'est rattaché).
  const especeIdsForFallback = [
    ...new Set(culturesPrevues.map(c => c.especeId).filter(Boolean) as string[]),
  ]
  const itpsForFallback = await prisma.iTP.findMany({
    where: {
      especeId: { in: especeIdsForFallback },
      nbRangs: { not: null },
      espacement: { not: null },
    },
    select: { especeId: true, nbRangs: true, espacement: true },
    orderBy: { dureeCulture: 'desc' },
  })
  const itpFallbackSemences = new Map<string, { nbRangs: number; espacement: number }>()
  for (const itp of itpsForFallback) {
    if (!itp.especeId || itpFallbackSemences.has(itp.especeId)) continue
    if (itp.nbRangs && itp.espacement) {
      itpFallbackSemences.set(itp.especeId, { nbRangs: itp.nbRangs, espacement: itp.espacement })
    }
  }

  // Doses de l'ITP RATTACHÉ à la culture.
  //
  // Deux doses de semis contradictoires cohabitaient : celle de l'ITP ne
  // servait qu'au décrément automatique de stock, cet écran ne lisait que
  // celle de l'espèce. Un épinard rattaché à un ITP affichant « Dose semis
  // 30 g/m² » recevait ici le bandeau « aucune dose de semis n'est renseignée
  // au référentiel », et corriger la dose de l'ITP ne déplaçait pas un gramme.
  // L'itinéraire décrit la conduite choisie : sa dose prime sur celle,
  // générique, de l'espèce.
  const itpIdsRattaches = [
    ...new Set(culturesPrevues.map(c => c.itpId).filter((v): v is string => !!v)),
  ]
  const itpsRattaches = itpIdsRattaches.length
    ? await prisma.iTP.findMany({
        where: { id: { in: itpIdsRattaches } },
        select: { id: true, doseSemis: true, nbGrainesPlant: true },
      })
    : []
  const itpDoseMap = new Map(itpsRattaches.map(i => [i.id, i]))

  // BUG-21 (audit Marc 2026-05-14) : double comptage de surface quand
  // plusieurs cultures partagent une même planche dans l'année (rotation
  // courte, ITPs multiples). Avant : Carotte 30 m² (B1) + Actinidia 30 m²
  // (B1) ⇒ besoins calculés sur 60 m² alors que la planche fait 30 m².
  // Fix prorata simple : la surface de chaque culture sur la planche est
  // pondérée par 1/N où N = nombre d'entrées sur la même planche.
  const culturesParPlanche = new Map<string, number>()
  for (const c of culturesPrevues) {
    if (!c.plancheId) continue
    culturesParPlanche.set(c.plancheId, (culturesParPlanche.get(c.plancheId) ?? 0) + 1)
  }

  // Accumulation par couple espèce + variété.
  type Acc = {
    especeId: string
    especeCouleur: string | null
    varieteId: string | null
    surfaceTotale: number
    nbPlants: number
    /** Dose de semis (g/m²) portée par l'ITP rattaché, si elle existe. */
    doseItpGParM2: number | null
    /** Graines par plant portées par l'ITP rattaché, si elles existent. */
    grainesParPlantItp: number | null
  }
  const densiteFallbackSemences = new Map<string, number>()
  for (const e of especes) {
    if (e.densite) densiteFallbackSemences.set(e.id, e.densite)
  }

  const accMap = new Map<string, Acc>()
  for (const culture of culturesPrevues) {
    if (!culture.especeId) continue
    const key = `${culture.especeId}|${culture.varieteId || ''}`

    // Mesure commune aux deux écrans de besoins (cf. `mesurerCulture`) :
    // `Culture.quantite` fait foi, et le prorata de planche partagée ne
    // touche que ce qui dérive de la planche entière.
    const mesure = mesurerCulture(culture, {
      culturesParPlanche,
      itpFallback: itpFallbackSemences,
      densiteFallback: densiteFallbackSemences,
    })

    const cur = accMap.get(key) || {
      especeId: culture.especeId,
      especeCouleur: culture.especeCouleur,
      varieteId: culture.varieteId,
      surfaceTotale: 0,
      nbPlants: 0,
      doseItpGParM2: null,
      grainesParPlantItp: null,
    }
    cur.surfaceTotale += mesure.surfaceM2
    cur.nbPlants += mesure.nbPlants
    // Dose de l'itinéraire rattaché : première renseignée du groupe.
    if (culture.itpId) {
      const dosesItp = itpDoseMap.get(culture.itpId)
      if (cur.doseItpGParM2 == null && dosesItp?.doseSemis != null) {
        cur.doseItpGParM2 = dosesItp.doseSemis
      }
      if (cur.grainesParPlantItp == null && dosesItp?.nbGrainesPlant != null) {
        cur.grainesParPlantItp = dosesItp.nbGrainesPlant
      }
    }
    accMap.set(key, cur)
  }

  // Pour chaque couple, on applique le mode déclaré sur l'espèce.
  const results: BesoinSemence[] = []
  for (const acc of accMap.values()) {
    const espece = especeMap.get(acc.especeId)
    const variete = acc.varieteId ? varieteMap.get(acc.varieteId) : null
    const stock = acc.varieteId ? userStockMap.get(acc.varieteId) : undefined

    // Dose : l'itinéraire rattaché prime, l'espèce sert de repli. L'ITP
    // exprime sa dose de semis en g/m² et ses graines/plant dans un champ
    // distinct : chacune ne peut suppléer l'espèce que dans l'unité qui lui
    // correspond. Une espèce comptée en pièces/m² ou en caïeux/m² garde donc
    // la sienne — substituer des g/m² à des pièces/m² changerait la grandeur.
    const uniteEspece = (espece?.uniteDose ?? null) as UniteDoseSemence
    const doseItp =
      uniteEspece === 'graines_plant'
        ? acc.grainesParPlantItp
        : uniteEspece === null || uniteEspece === 'g_m2'
          ? acc.doseItpGParM2
          : null
    const doseEffective = doseItp ?? espece?.doseSemis ?? null
    const uniteEffective: UniteDoseSemence =
      doseItp != null && uniteEspece === null ? 'g_m2' : uniteEspece

    const calc = calculerBesoin({
      mode: (espece?.modeSemis ?? 'graine_directe') as 'graine_directe' | 'plant_repique' | 'bulbe_caieu' | 'bouture',
      surfaceM2: acc.surfaceTotale,
      nbPlants: acc.nbPlants,
      doseGParM2: doseEffective,
      uniteDose: uniteEffective,
      tauxGerminationPct: espece?.tauxGermination ?? null,
      // Fallback PMG par espèce si la variété n'a pas de graines/g saisi
      // (évite « 0 g / — à commander » silencieux — cmpm700xw).
      grainesParGramme: variete?.nbGrainesG ?? defaultGrainesParGramme(acc.especeId),
      margeSecuritePct: espece?.margeSecuritePct ?? 15,
      stockGrammes: stock?.stockGraines ?? 0,
      stockUnites: stock?.stockPlants ?? 0,
    })

    results.push({
      especeId: acc.especeId,
      especeCouleur: acc.especeCouleur,
      varieteId: acc.varieteId,
      surfaceTotale: Math.round(acc.surfaceTotale * 10) / 10,
      nbPlants: acc.nbPlants,
      mode: calc.mode,
      grainesNecessaires: calc.besoinGrammes,
      besoinCaieux: calc.besoinCaieux,
      margeSecuritePct: calc.margeSecuritePct,
      stockActuel: calc.stockGrammes,
      stockUnites: calc.stockUnites,
      // Bug #7 (testeur Marc) : on retournait null alors que le calcul utilise le
      // fallback par espèce → l'UI affichait « - » avec un besoin pourtant calculé.
      // On expose la valeur réellement utilisée + un flag « estimé » pour la transparence.
      nbGrainesG: variete?.nbGrainesG ?? defaultGrainesParGramme(acc.especeId),
      nbGrainesGEstime: variete?.nbGrainesG == null,
      doseSemis: doseEffective,
      uniteDose: uniteEffective,
      tauxGerminationPct: espece?.tauxGermination ?? null,
      aCommander: calc.manqueGrammes,
      caieuxACommander: calc.manqueCaieux,
      statut: calc.statut,
      stockDateMaj: stock?.dateStock?.toISOString() ?? null,
    })
  }

  // Trier : on garde IGNORE en fin de liste, sinon par espèce/variété.
  return results
    .filter(b => b.statut !== 'IGNORE')
    .concat(results.filter(b => b.statut === 'IGNORE'))
    .sort((a, b) => {
      // IGNORE toujours après les autres.
      if (a.statut === 'IGNORE' && b.statut !== 'IGNORE') return 1
      if (b.statut === 'IGNORE' && a.statut !== 'IGNORE') return -1
      return a.especeId.localeCompare(b.especeId)
    })
}

/**
 * Calcule les besoins en plants pour une annee
 * (cultures avec plantation, pas semis direct)
 */
export async function getBesoinsPlants(
  userId: string,
  annee: number
): Promise<BesoinPlant[]> {
  const culturesPrevues = await getCulturesPrevues(userId, annee)

  // Bug R5 : « Plants à produire » ne concerne que les espèces semées en pépinière
  // puis repiquées (ou bouturées). Les bulbes/caïeux/tubercules (oignon, ail, PdT)
  // se plantent directement → ils relèvent de « Semences/bulbilles », PAS de « Plants »
  // (sinon double comptage entre les deux écrans).
  const modesEspeces = await prisma.espece.findMany({ select: { id: true, modeSemis: true } })
  const modeMap = new Map(modesEspeces.map(e => [e.id, e.modeSemis]))

  // Filtrer les cultures avec plantation (hors bulbe/caïeu et semis direct)
  const culturesAvecPlantation = culturesPrevues.filter((c) => {
    if (c.semainePlantation === null || !c.especeId) return false
    const mode = modeMap.get(c.especeId)
    return mode !== 'bulbe_caieu' && mode !== 'graine_directe'
  })

  // BUG #3 (audit Marc 2026-05-15) — Prorata identique à
  // `getBesoinsSemences` pour que les surfaces affichées dans
  // « Graines » et « Plants à produire » soient cohérentes
  // (sinon Plants montrait 4,8/9,6/12/30 m² brut, Graines montrait
  // 15 m² uniforme à cause du 1/N appliqué sur les planches partagées).
  const culturesParPlanche = new Map<string, number>()
  for (const c of culturesPrevues) {
    if (!c.plancheId) continue
    culturesParPlanche.set(c.plancheId, (culturesParPlanche.get(c.plancheId) ?? 0) + 1)
  }

  // BUG #4 — fallback nbRangs/espacement sur ITP référentiel par espèce
  // pour les cultures où les valeurs ne sont pas saisies (l'Aubergine
  // tombait à 0 plants alors qu'elle a 9,6 m² × densité 2/m² = 19).
  const especeIds = [...new Set(culturesAvecPlantation.map(c => c.especeId!).filter(Boolean))]
  const itpsParEspece = await prisma.iTP.findMany({
    where: { especeId: { in: especeIds }, nbRangs: { not: null }, espacement: { not: null } },
    select: { especeId: true, nbRangs: true, espacement: true },
    orderBy: { dureeCulture: 'desc' }, // ITP le plus long = plus représentatif
  })
  const itpFallback = new Map<string, { nbRangs: number; espacement: number }>()
  for (const itp of itpsParEspece) {
    if (!itp.especeId || itpFallback.has(itp.especeId)) continue
    if (itp.nbRangs && itp.espacement) {
      itpFallback.set(itp.especeId, { nbRangs: itp.nbRangs, espacement: itp.espacement })
    }
  }

  // Feedback Marc 2026-05-16 — Bug 12 : fallback densite (plants/m²)
  // quand ni la culture ni l'ITP ne fournissent nbRangs/espacement.
  const especesAvecDensite = await prisma.espece.findMany({
    where: { id: { in: especeIds }, densite: { not: null } },
    select: { id: true, densite: true },
  })
  const densiteFallback = new Map<string, number>()
  for (const e of especesAvecDensite) {
    if (e.densite) densiteFallback.set(e.id, e.densite)
  }

  // Recuperer les stocks par utilisateur
  const userStocks = await prisma.userStockVariete.findMany({
    where: { userId },
    select: { varieteId: true, stockGraines: true, stockPlants: true },
  })
  const userStockMap = new Map(userStocks.map(us => [us.varieteId, us]))

  // Grouper par espece/variete
  const besoinsMap = new Map<string, BesoinPlant>()

  for (const culture of culturesAvecPlantation) {
    if (!culture.especeId) continue

    // La semaine de plantation entre dans la clé : sans elle, une succession
    // (Poireau planté S29 puis S32) s'agrégeait en une seule ligne portant la
    // semaine de la PREMIÈRE culture rencontrée. L'écran annonçait « S29 —
    // 112 plants » : le maraîcher produisait 112 poireaux pour la semaine 29,
    // dont 60 ne sont plantés qu'en S32, et n'avait plus rien pour la seconde
    // plantation.
    const key = `${culture.especeId}|${culture.varieteId || ''}|${culture.semainePlantation}`

    // QA cmsqm5f3f — mesure commune aux deux écrans de besoins : la quantité
    // enregistrée sur la fiche fait foi, et le prorata 1/N des planches
    // partagées ne touche que ce qui dérive de la planche entière (cf.
    // `mesurerCulture`).
    const { nbPlants, surfaceM2: surfaceEffective } = mesurerCulture(culture, {
      culturesParPlanche,
      itpFallback,
      densiteFallback,
    })

    if (!besoinsMap.has(key)) {
      besoinsMap.set(key, {
        especeId: culture.especeId,
        especeCouleur: culture.especeCouleur,
        varieteId: culture.varieteId,
        nbPlants: 0,
        semainePlantation: culture.semainePlantation,
        stockActuel: culture.varieteId ? (userStockMap.get(culture.varieteId)?.stockPlants || 0) : 0,
        aCommander: 0,
        cultures: [],
      })
    }

    const besoin = besoinsMap.get(key)!
    besoin.nbPlants += nbPlants
    besoin.cultures.push({
      plancheId: culture.plancheId,
      surface: Math.round(surfaceEffective * 10) / 10,
      nbPlants,
    })
  }

  // Calculer les plants a commander.
  //
  // Le stock de plants est détenu par VARIÉTÉ, alors qu'une succession produit
  // désormais une ligne par semaine de plantation. Le déduire intégralement de
  // chaque ligne annoncerait « OK » partout : 100 plants en stock couvriraient
  // à la fois les 52 poireaux de S29 et les 60 de S32. On l'alloue donc dans
  // l'ordre chronologique — les premières plantations consomment le stock —,
  // ce qui conserve l'invariant « somme des à commander = besoin total − stock ».
  // `stockActuel` porte alors la part allouée à la ligne, pour que son
  // arithmétique reste lisible (plants + marge − stock = à commander).
  const parVariete = new Map<string, BesoinPlant[]>()
  for (const besoin of besoinsMap.values()) {
    const cle = `${besoin.especeId}|${besoin.varieteId || ''}`
    const lignes = parVariete.get(cle) ?? []
    lignes.push(besoin)
    parVariete.set(cle, lignes)
  }
  for (const lignes of parVariete.values()) {
    lignes.sort(
      (a, b) => (a.semainePlantation ?? Infinity) - (b.semainePlantation ?? Infinity)
    )
    let stockRestant = lignes[0]?.stockActuel ?? 0
    for (const besoin of lignes) {
      // Ajouter 10% de marge pour pertes
      const nbPlantsAvecMarge = Math.ceil(besoin.nbPlants * 1.1)
      const couvert = Math.min(stockRestant, nbPlantsAvecMarge)
      besoin.stockActuel = couvert
      besoin.aCommander = Math.max(0, nbPlantsAvecMarge - couvert)
      stockRestant -= couvert
    }
  }

  return Array.from(besoinsMap.values()).sort(
    (a, b) =>
      a.especeId.localeCompare(b.especeId) ||
      (a.semainePlantation ?? Infinity) - (b.semainePlantation ?? Infinity)
  )
}

/**
 * Recupere les associations de cultures (planches voisines)
 */
export async function getAssociations(
  userId: string,
  annee: number
): Promise<AssociationCulture[]> {
  // QA cmsbterw9 — une culture « en récolte » occupe encore la planche : elle
  // compte comme voisine (les terminées restent hors jeu).
  const culturesPrevues = await getCulturesPrevues(userId, annee, { inclureEnRecolte: true })

  // Bug cmp8sbe6d (Marc 2026-05-16) — Avant : on lisait uniquement le champ
  // CSV `planchesInfluencees` qui n'est exposé nulle part dans l'UI, donc
  // 0/19 cultures avaient des voisins en permanence. On dérive désormais les
  // voisinages automatiquement à partir des positions géographiques :
  // deux planches sont voisines si leurs bounding boxes se touchent
  // (distance ≤ 2 m). Le champ CSV reste prioritaire s'il est renseigné.
  const planches = await prisma.planche.findMany({
    where: { userId },
    select: {
      id: true,
      nom: true,
      ilot: true,
      planchesInfluencees: true,
      posX: true,
      posY: true,
      largeur: true,
      longueur: true,
    },
  })
  const plancheMap = new Map(planches.map(p => [p.nom, p]))
  // QA cmsbterw9 — une planche peut porter plusieurs cultures la même année
  // (successions) : multimap, sinon seule la dernière culture était visible
  // comme voisine.
  const cultureMap = new Map<string, CulturePrevue[]>()
  for (const c of culturesPrevues) {
    const list = cultureMap.get(c.plancheId)
    if (list) list.push(c)
    else cultureMap.set(c.plancheId, [c])
  }

  const SEUIL_VOISINAGE_M = 2

  function bbox(p: { posX: number | null; posY: number | null; largeur: number | null; longueur: number | null }) {
    if (p.posX == null || p.posY == null || p.largeur == null || p.longueur == null) return null
    return {
      x1: p.posX,
      y1: p.posY,
      x2: p.posX + (p.largeur ?? 0),
      y2: p.posY + (p.longueur ?? 0),
    }
  }
  function distanceBox(a: ReturnType<typeof bbox>, b: ReturnType<typeof bbox>): number {
    if (!a || !b) return Infinity
    const dx = Math.max(0, Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2))
    const dy = Math.max(0, Math.max(a.y1, b.y1) - Math.min(a.y2, b.y2))
    return Math.sqrt(dx * dx + dy * dy)
  }

  function voisinsGeographiques(planche: typeof planches[number]): string[] {
    const a = bbox(planche)
    if (!a) return []
    const voisins: string[] = []
    for (const autre of planches) {
      if (autre.nom === planche.nom) continue
      const b = bbox(autre)
      if (!b) continue
      if (distanceBox(a, b) <= SEUIL_VOISINAGE_M) {
        const id = autre.nom ?? autre.id
        if (id) voisins.push(id)
      }
    }
    return voisins
  }

  const associations: AssociationCulture[] = []

  // Bug #6 — Précharger toutes les paires d'espèces présentes pour évaluer
  // les associations en un seul scan (vs lookup par paire qui multiplie les
  // requêtes). On collecte toutes les espèces uniques, puis on calcule la
  // table d'incompatibilité paire-à-paire.
  const allEspeceIds = new Set<string>()
  for (const c of culturesPrevues) {
    if (c.especeId) allEspeceIds.add(c.especeId)
  }
  const alertesAll = allEspeceIds.size >= 2
    ? await alertesAssociations(prisma, Array.from(allEspeceIds))
    : []

  // Map "especeA|especeB" → alerte la plus prioritaire (défavorable > favorable).
  const pairKey = (a: string, b: string) => {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort()
    return `${x}|${y}`
  }
  const alerteParPaire = new Map<string, { type: "favorable" | "defavorable"; message: string }>()
  for (const a of alertesAll) {
    const key = pairKey(a.especes[0], a.especes[1])
    const existing = alerteParPaire.get(key)
    // Conserver la défavorable si on a une collision (priorité au risque).
    if (!existing || (a.type === "defavorable" && existing.type !== "defavorable")) {
      alerteParPaire.set(key, { type: a.type, message: a.message })
    }
  }

  for (const culture of culturesPrevues) {
    const planche = plancheMap.get(culture.plancheId)
    if (!planche) continue

    const csv = planche.planchesInfluencees
      ? planche.planchesInfluencees.split(',').map(s => s.trim()).filter(Boolean)
      : []
    const planchesVoisines = csv.length > 0 ? csv : voisinsGeographiques(planche)

    const culturesVoisines = planchesVoisines.flatMap(pvId =>
      (cultureMap.get(pvId) ?? []).map(cv => {
        let evalType: "favorable" | "defavorable" | "neutre" = "neutre"
        let evalMessage: string | null = null
        if (culture.especeId && cv.especeId) {
          const found = alerteParPaire.get(pairKey(culture.especeId, cv.especeId))
          if (found) {
            evalType = found.type
            evalMessage = found.message
          }
        }
        return { plancheId: pvId, especeId: cv.especeId, eval: evalType, evalMessage }
      })
    )

    const aDefavorable = culturesVoisines.some(cv => cv.eval === "defavorable")
    const aFavorable = culturesVoisines.some(cv => cv.eval === "favorable")
    const scoreAssociation: AssociationCulture["scoreAssociation"] =
      aDefavorable && aFavorable ? "mixte"
      : aDefavorable ? "defavorable"
      : aFavorable ? "favorable"
      : "neutre"

    associations.push({
      plancheId: culture.plancheId,
      ilot: culture.ilot,
      cultureEspeceId: culture.especeId,
      cultureSemaine: culture.semainePlantation || culture.semaineSemis,
      planchesVoisines,
      culturesVoisines,
      scoreAssociation,
    })
  }

  return associations
}

/**
 * Cree les cultures en batch a partir des cultures prevues
 */
export async function creerCulturesBatch(
  userId: string,
  cultures: { plancheId: string; itpId: string; annee: number; varieteId?: string }[]
): Promise<{
  created: number
  cultures: { id: number; plancheId: string; especeId: string }[]
  ignorees: { plancheId: string; itpId: string; motif: string }[]
}> {
  const results: { id: number; plancheId: string; especeId: string }[] = []
  // Quatre motifs faisaient jusqu'ici disparaître une ligne en silence : la
  // réponse annonçait « 3 cultures créées » sur 5 demandées sans dire lesquelles
  // ni pourquoi. Même famille que la QA cmsw8wni8 (2 cultures absentes du
  // total) : on n'écarte plus rien sans le nommer.
  const ignorees: { plancheId: string; itpId: string; motif: string }[] = []

  // Recuperer les ITPs pour avoir les infos necessaires
  const itpIds = [...new Set(cultures.map(c => c.itpId))]
  // Le correctif IDOR de 2026-07 avait borné la résolution des PLANCHES à
  // celles de l'utilisateur (cf. plus bas) mais laissé l'ITP en accès libre :
  // n'importe quel identifiant faisait l'affaire, y compris l'itinéraire privé
  // d'un autre membre ou un itinéraire retiré du service.
  const itps = await prisma.iTP.findMany({
    where: { AND: [{ id: { in: itpIds } }, whereItpUtilisable(userId)] },
    include: { espece: true },
  })
  const itpMap = new Map(itps.map(itp => [itp.id, itp]))
  const userZone = await zoneEffectiveUser(prisma, userId)

  // Resolve planche noms to cuid IDs
  const plancheNoms = [...new Set(cultures.map(c => c.plancheId))]
  // Résolution par nom OU par id, mais UNIQUEMENT parmi les planches de
  // l'utilisateur (audit 2026-07, #42 IDOR : le fallback sur l'id brut du
  // client permettait de rattacher une culture à la planche d'un autre compte).
  const planchesDb = await prisma.planche.findMany({
    where: { userId, OR: [{ nom: { in: plancheNoms } }, { id: { in: plancheNoms } }] },
    select: { id: true, nom: true, largeur: true },
  })
  const plancheNomToId = new Map(planchesDb.map(p => [p.nom, p.id]))
  const plancheIdsUser = new Set(planchesDb.map(p => p.id))

  for (const culture of cultures) {
    const itp = itpMap.get(culture.itpId)
    if (!itp) {
      ignorees.push({
        plancheId: culture.plancheId,
        itpId: culture.itpId,
        motif: "itinéraire introuvable, privé ou retiré du service",
      })
      continue
    }
    if (!itp.especeId) {
      ignorees.push({
        plancheId: culture.plancheId,
        itpId: culture.itpId,
        motif: "itinéraire sans espèce rattachée",
      })
      continue
    }
    const itpCalibre = appliquerDecalageItp(
      itp,
      decalageItpPourLecteur(itp, userZone, userId)
    )

    // Resolve planche nom → cuid (appartenance vérifiée : nom OU id de l'user)
    const plancheCuidId = plancheNomToId.get(culture.plancheId)
      ?? (plancheIdsUser.has(culture.plancheId) ? culture.plancheId : null)
    if (!plancheCuidId) {
      ignorees.push({
        plancheId: culture.plancheId,
        itpId: culture.itpId,
        motif: "planche inconnue dans votre exploitation",
      })
      continue
    }

    // Verifier si la culture existe deja
    const existing = await prisma.culture.findFirst({
      where: {
        userId,
        plancheId: plancheCuidId,
        especeId: itp.especeId,
        annee: culture.annee,
      },
    })

    if (existing) {
      ignorees.push({
        plancheId: culture.plancheId,
        itpId: culture.itpId,
        motif: `déjà une culture de ${itp.especeId} sur cette planche en ${culture.annee}`,
      })
      continue
    }

    // Calculer les dates a partir des semaines
    const annee = culture.annee
    // Chronologie : récolte/plantation antérieures au semis tombent l'année suivante.
    // QA cmsfxvbab — 173 ITP du référentiel n'ont ni semaine de semis ni semaine
    // de plantation : la culture concrétisée n'obtenait qu'une date de récolte,
    // sans début de cycle (état « Non défini », aucun décrément de semences).
    // La fenêtre d'implantation sert de jalon de semis.
    // QA cmswxqnaz — ce chemin écrit des dates en base, relues en semaine ISO :
    // `calculerDateDepuisSemaine` est désormais ancrée sur l'ISO (jan. 4) comme
    // `dates-itp.ts`. Avant, la culture 2028 matérialisée en S31 se relisait en
    // S30 (convention « semaine contenant le 1er janvier »).
    const semaineSemisEff = semaineSemisEffective(itpCalibre)
    const dateSemis = semaineSemisEff
      ? calculerDateDepuisSemaine(annee, semaineSemisEff)
      : null
    const datePlantation = itpCalibre.semainePlantation
      ? dateSemaineChrono(annee, itpCalibre.semainePlantation, semaineSemisEff)
      : null
    const dateRecolte = itpCalibre.semaineRecolte
      ? dateSemaineChrono(
          annee,
          itpCalibre.semaineRecolte,
          itpCalibre.semainePlantation ?? semaineSemisEff
        )
      : null

    // Creer la culture
    const newCulture = await prisma.culture.create({
      data: {
        userId,
        especeId: itp.especeId,
        varieteId: culture.varieteId || null,
        itpId: culture.itpId,
        plancheId: plancheCuidId,
        annee: culture.annee,
        dateSemis,
        datePlantation,
        dateRecolte,
        nbRangs: itp.nbRangs,
      },
    })

    // Pas de décrément automatique du stock de semences ici.
    //
    // Ce chemin en portait un, mort depuis toujours : la culture est créée
    // sans `longueur`, dont dépendaient les deux formules — aucun gramme n'a
    // jamais bougé par « Créer les cultures », là où le formulaire unitaire
    // débitait. Le stock est désormais tenu par le seul écran Semences, qui
    // affiche le besoin et le manque (cf. POST /api/cultures).

    results.push({
      id: newCulture.id,
      plancheId: culture.plancheId, // Keep nom for display
      especeId: itp.especeId,
    })
  }

  return {
    created: results.length,
    cultures: results,
    ignorees,
  }
}

/**
 * Statistiques de planification
 */
export async function getStatsPlanification(userId: string, annee: number) {
  const culturesPrevues = await getCulturesPrevues(userId, annee, {
    includeAllCultures: true,
  })
  const recoltesPrevues = await getRecoltesPrevues(userId, annee, 'mois')

  // Bug #2 (testeur) — Le compteur « Cultures prévues » affichait 24 (longueur
  // de `culturesPrevues` qui inclut les cultures DÉRIVÉES des rotations non
  // encore créées en base) alors que la liste « Cultures » montre 22 (cultures
  // réellement créées). On aligne le chiffre mis en avant sur les cultures
  // créées ; les cultures planifiées via rotation restent exposées via
  // `culturesACreer` (sous-libellé « X à créer »).
  const culturesExistantes = culturesPrevues.filter(c => c.existante).length
  const culturesACreer = culturesPrevues.length - culturesExistantes
  const totalCultures = culturesExistantes
  const surfaceTotale = culturesPrevues.reduce((sum, c) => sum + c.surface, 0)
  const recoltesTotales = recoltesPrevues.reduce((sum, r) => sum + r.totalKg, 0)

  // Especes uniques (projection rotation/ITP)
  const especesUniques = new Set(culturesPrevues.map(c => c.especeId).filter(Boolean))

  // BUG-14 — Variétés réellement planifiées : on compte les variétés
  // distinctes des `Culture` créées en base pour l'année (pas les
  // détails de rotation, qui multiplient × N le compteur). On filtre
  // aussi les variétés null (cultures pour lesquelles le maraîcher n'a
  // pas encore choisi une variété précise).
  // Bug R6 : exclure les variétés « placeholder » (« Non spécifiée ») du compteur.
  const cultureRows = await prisma.culture.findMany({
    where: { userId, annee, varieteId: { not: null }, variete: { isPlaceholder: false } },
    select: { varieteId: true, especeId: true },
    distinct: ['varieteId'],
  })
  const nbVarietes = cultureRows.length
  const especesAvecVariete = new Set(cultureRows.map(c => c.especeId).filter(Boolean))

  return {
    totalCultures,
    culturesExistantes,
    culturesACreer,
    surfaceTotale: Math.round(surfaceTotale * 100) / 100,
    recoltesTotales: Math.round(recoltesTotales * 100) / 100,
    nbEspeces: especesUniques.size,
    nbVarietes,
    nbEspecesAvecVariete: especesAvecVariete.size,
  }
}
