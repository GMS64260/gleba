/**
 * Rechargement du plan sans perte des modifications en attente.
 *
 * PLAN-01 (revue Codex du 2026-11-12) : le plan s'écrit 1 s après le dernier
 * geste (`handleSave`, sauvegarde différentielle). Tout rechargement —
 * changement de parcelle, création, suppression, renommage, duplication —
 * remplaçait les tableaux ET la référence sauvegardée par la base : déplacer
 * A puis changer de parcelle avant la sauvegarde effaçait le déplacement, et
 * la sauvegarde suivante annonçait « Plan sauvegardé » sans rien envoyer.
 *
 * Règle : la référence suit la base relue, mais une entité modifiée et pas
 * encore écrite garde ses champs persistés locaux. Si elle sort de la vue
 * (autre parcelle), elle attend dans une file « hors vue » que la sauvegarde
 * suivante envoie. Une entité supprimée ne va jamais en file.
 */

import { entitesModifiees, type EmpreinteEntite } from "./sauvegarde-differentielle"

type Id = string | number
type Entite = { id: Id }

/** Empreinte et report construits sur la MÊME liste de champs persistés. */
export function champsPersistes<T>(champs: readonly (keyof T)[]) {
  return {
    /** Valeurs des champs, dans l'ordre : comparée à la référence sauvée. */
    empreinte: (entite: T) => JSON.stringify(champs.map((champ) => entite[champ])),
    /** Version relue en base, avec les champs persistés de la version locale. */
    reporter: (serveur: T, locale: T): T => {
      const fusion = { ...serveur }
      for (const champ of champs) fusion[champ] = locale[champ]
      return fusion
    },
  }
}

export interface ResultatRechargement<T> {
  /** Entités à afficher. */
  entites: T[]
  /** Nouvelle référence : l'état relu en base. */
  etatSauve: Map<Id, string>
  /** Modifications non écrites dont l'entité n'est plus affichée. */
  horsVue: Map<Id, T>
}

/** Fonction pure : ne modifie ni `etatSauve` ni `horsVue` reçus. */
export function fusionnerRechargement<T extends Entite>(params: {
  /** Entités relues (éventuellement posées localement pour l'affichage). */
  rechargees: readonly T[]
  /** Empreintes de l'état relu EN BASE (avant tout positionnement local). */
  etatServeur: Map<Id, string>
  /** Entités affichées juste avant le rechargement. */
  locales: readonly T[]
  /** Référence sauvée avant le rechargement. */
  etatSauve: ReadonlyMap<Id, string>
  /** File hors vue avant le rechargement. */
  horsVue: ReadonlyMap<Id, T>
  /** Entités supprimées : leurs modifications n'ont plus lieu d'être écrites. */
  supprimees?: Iterable<Id>
  /**
   * Empreintes des placements faits par l'écran seul (planche sans position
   * posée à l'affichage) : une entité restée à ce placement n'est pas une
   * modification de l'utilisateur. Elle est replacée au prochain affichage et
   * n'entre pas en file : sa position dépend de la vue quittée.
   */
  placementsLocaux?: ReadonlyMap<Id, string>
  empreinte: EmpreinteEntite<T>
  reporter: (serveur: T, locale: T) => T
}): ResultatRechargement<T> {
  const enAttente = new Map(params.horsVue)
  for (const locale of entitesModifiees(params.locales, params.etatSauve, params.empreinte)) {
    if (params.placementsLocaux?.get(locale.id) === params.empreinte(locale)) continue
    enAttente.set(locale.id, locale)
  }
  for (const id of params.supprimees ?? []) enAttente.delete(id)

  const entites = params.rechargees.map((serveur) => {
    const locale = enAttente.get(serveur.id)
    if (!locale) return serveur
    enAttente.delete(serveur.id)
    return params.reporter(serveur, locale)
  })
  return { entites, etatSauve: new Map(params.etatServeur), horsVue: enAttente }
}

/** Entités de la file hors vue qui ne sont pas (ou plus) affichées. */
export function enAttenteHorsVue<T extends Entite>(entites: readonly T[], horsVue: ReadonlyMap<Id, T>): T[] {
  const affichees = new Set(entites.map((e) => e.id))
  return [...horsVue.values()].filter((e) => !affichees.has(e.id))
}

/** Tout ce que la sauvegarde doit envoyer : modifications affichées + file hors vue. */
export function aSauvegarder<T extends Entite>(
  entites: readonly T[],
  etatSauve: ReadonlyMap<Id, string>,
  horsVue: ReadonlyMap<Id, T>,
  empreinte: EmpreinteEntite<T>
): T[] {
  return [...entitesModifiees(entites, etatSauve, empreinte), ...enAttenteHorsVue(entites, horsVue)]
}

/**
 * Après un envoi réussi : la référence avance pour les entités envoyées, et la
 * file hors vue les oublie, sauf si une version plus récente y a été mise
 * pendant l'envoi.
 */
export function confirmerSauvegarde<T extends Entite>(
  etatSauve: Map<Id, string>,
  horsVue: Map<Id, T>,
  envoyees: readonly T[],
  empreinte: EmpreinteEntite<T>
): void {
  for (const entite of envoyees) {
    etatSauve.set(entite.id, empreinte(entite))
    if (horsVue.get(entite.id) === entite) horsVue.delete(entite.id)
  }
}

export interface AnnonceSauvegarde {
  variant?: "destructive"
  title: string
  description: string
}

/** Message de fin de sauvegarde ; null quand rien n'a été envoyé. */
export function annonceSauvegarde(bilan: { envoyes: number; differes: number; reussi: boolean }): AnnonceSauvegarde | null {
  if (!bilan.reussi) {
    return { variant: "destructive", title: "Erreur", description: "Certaines positions n'ont pas pu être enregistrées" }
  }
  if (bilan.envoyes === 0) return null
  const n = bilan.differes
  return {
    title: "Plan sauvegardé",
    description: n > 0
      ? `Positions enregistrées. ${n} arbre${n > 1 ? "s" : ""} en attente de confirmation GPS ${n > 1 ? "n'ont" : "n'a"} pas été déplacé${n > 1 ? "s" : ""}.`
      : "Les positions ont été enregistrées",
  }
}
