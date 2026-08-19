import { cleCanonique } from '@/lib/elevage/import-animaux'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

type DbRaces = {
  raceAnimale: {
    findMany(args: {
      where: Record<string, unknown>
      select: { id: true; nom: true }
    }): Promise<{ id: string; nom: string }[]>
  }
}

/**
 * Relie une race saisie en texte libre au référentiel `races_animales`
 * quand la correspondance est UNIVOQUE pour l'espèce. Né de l'import CSV
 * du 2026-08-06 : la colonne `race` restait un texte orphelin, jamais
 * rattachée au référentiel, donc invisible des regroupements par race.
 * Comparaison canonique (casse, accents, ponctuation) ; en cas d'absence
 * ou d'ambiguïté, renvoie null et le texte libre reste tel quel.
 */
export async function resoudreRaceTexte(
  db: DbRaces,
  userId: string,
  especeAnimaleId: string,
  raceTexte: string,
): Promise<{ id: string; nom: string } | null> {
  const cle = cleCanonique(raceTexte)
  if (!cle) return null
  const races = await db.raceAnimale.findMany({
    where: { especeAnimaleId, AND: [visibiliteReferentiel(userId)] },
    select: { id: true, nom: true },
  })
  const correspondances = races.filter((race) => cleCanonique(race.nom) === cle)
  return correspondances.length === 1 ? correspondances[0] : null
}
