/**
 * Reprise de données — dates de récolte incohérentes (friction du 2026-08-14).
 *
 * Deux motifs, même cause racine : les formulaires ne recalculaient les dates
 * qu'au changement d'ITP, jamais au changement de la date de début saisie
 * (corrigé le même jour dans les trois formulaires via `recolteApresDebut`).
 *
 * 1. Récolte ANTÉRIEURE au début de cycle (chronologiquement impossible,
 *    créée avant les gardes serveur du 30/07) : recalée à début + durée du
 *    cycle ITP. La culture redevient visible du plan d'arrosage, dont elle
 *    était sortie (« terminée » aux yeux du planificateur).
 * 2. Culture n°934 (cas signalé) : récolte marquée FAITE le 2026-08-02 avec
 *    une date de récolte encore au 2027-07-11 (ancrage ITP d'automne jamais
 *    recalé sur la plantation du 05/03). Invariant cmsp66tdm (une étape faite
 *    ne porte pas une date future) : date ramenée au jour de la déclaration.
 *    Les lignes analogues des comptes admin/démo sont listées mais NON
 *    touchées (données internes, la démo est pilotée par son seed).
 *
 * Dry-run par défaut ; `--apply` pour écrire. Chaque écriture journalise la
 * valeur AVANT pour permettre un retour arrière ligne à ligne.
 *
 * Usage : TZ=Europe/Paris npx tsx --env-file=.env scripts/fix-dates-recolte-20260814.ts [--apply]
 */
import prisma from '@/lib/prisma'
import { recolteApresDebut } from '@/lib/cultures/dates-itp'

const APPLY = process.argv.includes('--apply')
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : 'null')

// Cas signalé : ail du compte réel, récolte faite le 2026-08-02 (updated_at).
const CULTURE_AIL_ID = 934
const DATE_DECLARATION_AIL = new Date('2026-08-02T12:00:00.000Z')

async function main() {
  console.log(`Mode : ${APPLY ? 'APPLY' : 'dry-run'}`)

  // ── Motif 1 : récolte antérieure au début de cycle ──
  const incoherentes = await prisma.culture.findMany({
    where: { dateRecolte: { not: null } },
    select: {
      id: true,
      userId: true,
      especeId: true,
      dateSemis: true,
      datePlantation: true,
      dateRecolte: true,
      itp: {
        select: {
          semaineSemis: true,
          semainePlantation: true,
          semaineRecolte: true,
          semaineImplantationDebut: true,
          dureeCulture: true,
        },
      },
    },
  })

  let corrigees = 0
  for (const c of incoherentes) {
    const debut = c.datePlantation ?? c.dateSemis
    if (!debut || !c.dateRecolte || c.dateRecolte.getTime() > debut.getTime()) continue
    const nouvelle = c.itp ? recolteApresDebut(debut, c.itp) : null
    if (!nouvelle) {
      console.log(
        `#${c.id} (${c.especeId}) : récolte ${iso(c.dateRecolte)} <= début ${iso(debut)}, ` +
          `AUCUN recalcul possible (pas d'ITP exploitable) — laissée telle quelle, à corriger à la main.`
      )
      continue
    }
    console.log(
      `#${c.id} (${c.especeId}) : récolte ${iso(c.dateRecolte)} <= début ${iso(debut)} ` +
        `→ ${iso(nouvelle)} (durée du cycle ITP) [avant=${c.dateRecolte.toISOString()}]`
    )
    if (APPLY) {
      await prisma.culture.update({ where: { id: c.id }, data: { dateRecolte: nouvelle } })
    }
    corrigees++
  }

  // ── Motif 2 : cas signalé n°934, récolte faite à date future ──
  const ail = await prisma.culture.findUnique({
    where: { id: CULTURE_AIL_ID },
    select: { id: true, especeId: true, recolteFaite: true, dateRecolte: true },
  })
  if (ail?.recolteFaite && ail.dateRecolte && ail.dateRecolte.getTime() > Date.now()) {
    console.log(
      `#${ail.id} (${ail.especeId}) : récolte FAITE datée ${iso(ail.dateRecolte)} (future) ` +
        `→ ${iso(DATE_DECLARATION_AIL)} (jour de la déclaration) [avant=${ail.dateRecolte.toISOString()}]`
    )
    if (APPLY) {
      await prisma.culture.update({
        where: { id: ail.id },
        data: { dateRecolte: DATE_DECLARATION_AIL },
      })
    }
    corrigees++
  } else {
    console.log(`#${CULTURE_AIL_ID} : rien à faire (état déjà cohérent ou introuvable).`)
  }

  // Inventaire informatif des lignes analogues NON touchées (admin/démo).
  const analogues = await prisma.culture.findMany({
    where: { recolteFaite: true, dateRecolte: { gt: new Date() }, id: { not: CULTURE_AIL_ID } },
    select: { id: true, especeId: true, dateRecolte: true, user: { select: { email: true } } },
  })
  for (const a of analogues) {
    console.log(
      `(non touchée) #${a.id} (${a.especeId}) récolte faite datée ${iso(a.dateRecolte)} — compte interne/démo.`
    )
  }

  console.log(`\n${corrigees} culture(s) ${APPLY ? 'corrigée(s)' : 'à corriger'}.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
