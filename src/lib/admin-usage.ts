/**
 * Mesure d'usage par compte pour /admin/usage.
 *
 * Deux sources seulement, toutes deux sans contenu :
 *  - `activity_days` : un jour UTC par compte au premier appel authentifié
 *    (consultation comprise) — dit QUAND un compte vient ;
 *  - les `created_at` des tables métier — disent CE QU'IL SAISIT, et donc
 *    quels modules il utilise vraiment. Un module activé dans les
 *    paramètres n'est pas un module utilisé.
 *
 * Les lignes sont attribuées au propriétaire (`user_id`) : la saisie d'un
 * membre d'exploitation compte chez le propriétaire.
 *
 * Exclusions :
 *  - données d'exemple : lignes créées dans les 2 minutes suivant
 *    l'inscription (ancien seed du signup), ou dans la fenêtre du jeu
 *    d'exemple proposé en fin de parcours (repéré par ses noms fixes, voir
 *    `src/lib/user-sample-data.ts`) ;
 *  - miroirs comptables automatiques (`auto = true`) : une récolte vendue
 *    ne doit pas faire passer un maraîcher pour un utilisateur de la compta ;
 *  - lignes de relevé bancaire : un import en crée des centaines, on compte
 *    l'import (`tentatives_import_releve`), pas ses lignes.
 */

import { Prisma } from "@prisma/client"
import type { GroupeUsageId } from "@/lib/admin-usage-groupes"

export * from "@/lib/admin-usage-groupes"

interface SourceUsage {
  /** Nom de table SQL (liste blanche : interpolé tel quel dans la requête). */
  table: string
  groupe: GroupeUsageId
  libelle: string
  /** Filtre SQL supplémentaire, constant. */
  filtre?: string
  /** Table sans `created_at` : comptée au total, jamais dans une période. */
  sansDate?: boolean
}

export const SOURCES_USAGE: SourceUsage[] = [
  // Maraîchage
  { table: "cultures", groupe: "maraichage", libelle: "Cultures" },
  { table: "recoltes", groupe: "maraichage", libelle: "Récoltes" },
  { table: "interventions", groupe: "maraichage", libelle: "Interventions" },
  { table: "irrigations_planifiees", groupe: "maraichage", libelle: "Irrigations" },
  { table: "fertilisations", groupe: "maraichage", libelle: "Fertilisations" },
  {
    table: "planches",
    groupe: "maraichage",
    libelle: "Planches",
    filtre: "nom NOT IN ('Planche A', 'Planche B')",
    sansDate: true,
  },
  // Verger
  { table: "arbres", groupe: "verger", libelle: "Arbres" },
  { table: "recoltes_arbres", groupe: "verger", libelle: "Récoltes d'arbres" },
  { table: "operations_arbres", groupe: "verger", libelle: "Opérations sur arbres" },
  { table: "lots_arbres", groupe: "verger", libelle: "Lots d'arbres" },
  { table: "zones_verger", groupe: "verger", libelle: "Zones de verger" },
  { table: "production_bois", groupe: "verger", libelle: "Production de bois" },
  { table: "campagnes_plantation", groupe: "verger", libelle: "Campagnes de plantation" },
  { table: "observations_campagne", groupe: "verger", libelle: "Observations de campagne" },
  // Élevage
  { table: "animaux", groupe: "elevage", libelle: "Animaux" },
  { table: "lots_animaux", groupe: "elevage", libelle: "Lots d'animaux" },
  { table: "production_oeufs", groupe: "elevage", libelle: "Ponte" },
  { table: "soins_animaux", groupe: "elevage", libelle: "Soins" },
  { table: "observations_sante", groupe: "elevage", libelle: "Observations de santé" },
  { table: "naissances_animales", groupe: "elevage", libelle: "Naissances" },
  { table: "saillies", groupe: "elevage", libelle: "Saillies" },
  { table: "pesees", groupe: "elevage", libelle: "Pesées" },
  { table: "abattages", groupe: "elevage", libelle: "Abattages" },
  { table: "mouvements_cheptel", groupe: "elevage", libelle: "Mouvements de cheptel" },
  { table: "consommations_aliments", groupe: "elevage", libelle: "Alimentation" },
  { table: "collectes_lait", groupe: "elevage", libelle: "Collectes de lait" },
  { table: "livraisons_lait", groupe: "elevage", libelle: "Livraisons de lait" },
  { table: "lots_fromage", groupe: "elevage", libelle: "Lots de fromage" },
  { table: "productions_ruche", groupe: "elevage", libelle: "Récoltes de ruche" },
  { table: "realisations_taches_elevage", groupe: "elevage", libelle: "Tournées réalisées" },
  { table: "ventes_produits", groupe: "elevage", libelle: "Ventes d'élevage" },
  // Comptabilité
  { table: "factures", groupe: "comptabilite", libelle: "Factures" },
  { table: "documents_commerciaux", groupe: "comptabilite", libelle: "Devis et bons de livraison" },
  { table: "ventes_manuelles", groupe: "comptabilite", libelle: "Ventes saisies", filtre: "auto = false" },
  { table: "depenses_manuelles", groupe: "comptabilite", libelle: "Dépenses saisies", filtre: "auto = false" },
  { table: "reglements", groupe: "comptabilite", libelle: "Règlements" },
  { table: "clients", groupe: "comptabilite", libelle: "Clients" },
  { table: "tentatives_import_releve", groupe: "comptabilite", libelle: "Imports de relevés" },
  // Transverse
  { table: "notes", groupe: "terrain", libelle: "Notes" },
  { table: "objets_jardin", groupe: "terrain", libelle: "Objets du plan" },
  { table: "fonds_plan", groupe: "terrain", libelle: "Fonds de plan" },
  { table: "consommations", groupe: "terrain", libelle: "Sorties de stock" },
  { table: "capteurs", groupe: "terrain", libelle: "Capteurs" },
  // Communauté
  { table: "messages_salon", groupe: "communaute", libelle: "Messages du salon" },
  { table: "discussions_encyclopedie", groupe: "communaute", libelle: "Discussions encyclopédie" },
  { table: "reponses_encyclopedie", groupe: "communaute", libelle: "Réponses encyclopédie" },
  { table: "contributions_encyclopedie", groupe: "communaute", libelle: "Contributions encyclopédie" },
  { table: "avis", groupe: "communaute", libelle: "Avis" },
  { table: "evolutions", groupe: "communaute", libelle: "Idées proposées" },
  { table: "evolution_votes", groupe: "communaute", libelle: "Votes sur les idées" },
  { table: "signalements", groupe: "communaute", libelle: "Signalements" },
]

const NOM_TABLE = /^[a-z_]+$/

/**
 * Sous-requête `(source, groupe, user_id, created_at)` de toutes les saisies
 * réelles, données d'exemple exclues. Les noms de tables et filtres viennent
 * de `SOURCES_USAGE` (constantes), jamais d'une entrée utilisateur.
 */
export function sqlSaisies(userIds: string[]): Prisma.Sql {
  const branches = SOURCES_USAGE.map((s) => {
    if (!NOM_TABLE.test(s.table)) throw new Error(`table d'usage invalide : ${s.table}`)
    const colonnes = Prisma.raw(
      `'${s.table}'::text AS source, '${s.groupe}'::text AS groupe, user_id, ` +
        (s.sansDate ? "NULL::timestamp" : "created_at::timestamp") +
        " AS created_at"
    )
    const filtre = s.filtre ? Prisma.raw(` AND ${s.filtre}`) : Prisma.empty
    return Prisma.sql`SELECT ${colonnes} FROM ${Prisma.raw(s.table)} WHERE user_id = ANY(${userIds})${filtre}`
  })
  return Prisma.sql`(
    WITH exemple AS (
      SELECT user_id, min(t) AS t FROM (
        SELECT c.user_id, c.created_at AS t FROM cultures c
          JOIN planches p ON p.id = c.planche
          WHERE p.nom IN ('Planche A', 'Planche B') AND c.user_id = ANY(${userIds})
        UNION ALL
        SELECT a.user_id, a.created_at FROM arbres a
          WHERE a.nom IN ('Pommier Golden', 'Cerisier Burlat') AND a.user_id = ANY(${userIds})
      ) x GROUP BY user_id
    ),
    brut AS (${Prisma.join(branches, " UNION ALL ")})
    SELECT b.source, b.groupe, b.user_id, b.created_at
    FROM brut b
    JOIN users u ON u.id = b.user_id
    LEFT JOIN exemple e ON e.user_id = b.user_id
    WHERE b.created_at IS NULL
       OR (b.created_at > u.created_at + interval '2 minutes'
           AND (e.t IS NULL
                OR b.created_at NOT BETWEEN e.t - interval '1 minute' AND e.t + interval '2 minutes'))
  )`
}

// ---------------------------------------------------------------------------
// Périodes (buckets), alignées sur date_trunc de Postgres en UTC
// ---------------------------------------------------------------------------

export const BUCKETS = ["day", "week", "month"] as const
export type Bucket = (typeof BUCKETS)[number]

export function parseBucket(raw: string | null): Bucket {
  return (BUCKETS as readonly string[]).includes(raw ?? "") ? (raw as Bucket) : "week"
}

export function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : NaN
  if (Number.isNaN(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** Aligne une date sur le début de son bucket (UTC), façon date_trunc Postgres. */
export function startOfBucket(d: Date, bucket: Bucket): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  if (bucket === "month") {
    x.setUTCDate(1)
  } else if (bucket === "week") {
    // ISO : lundi = début de semaine (getUTCDay : 0=dim..6=sam)
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  }
  return x
}

/** Liste continue des buckets (clés YYYY-MM-DD) entre start et end inclus. */
export function buildBuckets(start: Date, end: Date, bucket: Bucket): string[] {
  const out: string[] = []
  const cur = startOfBucket(start, bucket)
  const last = startOfBucket(end, bucket)
  let guard = 0
  while (cur <= last && guard < 5000) {
    out.push(cur.toISOString().slice(0, 10))
    if (bucket === "month") cur.setUTCMonth(cur.getUTCMonth() + 1)
    else if (bucket === "week") cur.setUTCDate(cur.getUTCDate() + 7)
    else cur.setUTCDate(cur.getUTCDate() + 1)
    guard++
  }
  return out
}
