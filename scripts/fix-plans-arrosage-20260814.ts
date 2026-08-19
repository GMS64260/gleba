/**
 * Reprise de données — plans d'arrosage incomplets (friction du 2026-08-14).
 *
 * Un plan d'arrosage généré une fois n'était jamais étendu : toute culture
 * « à irriguer » créée APRÈS la génération restait sans passage tant que
 * l'utilisateur ne recliquait pas dans l'onglet Calendrier (cas réel : plan
 * généré le 30/07 à 17:01, 8 cultures créées ensuite jamais couvertes).
 * Le code est corrigé (`etendrePlanArrosage`, appelé à chaque mutation de
 * culture) ; ce script comble les trous EXISTANTS, uniquement pour les
 * comptes qui ont déjà un plan (opt-in : ≥ 1 ligne IrrigationPlanifiee) —
 * même périmètre que le bouton « Planifier l'arrosage » de leur écran.
 *
 * La génération ne crée que des passages FUTURS (à partir d'aujourd'hui),
 * bornés par la date de récolte : aucun retard artificiel n'est créé, la
 * péremption n'a rien à abandonner.
 *
 * À jouer APRÈS fix-dates-recolte-20260814.ts (une récolte antérieure au
 * début de cycle rend la culture ingénérable).
 *
 * Dry-run par défaut ; `--apply` pour écrire (utilise le VRAI générateur,
 * même code que le bouton de l'écran).
 *
 * Usage : TZ=Europe/Paris npx tsx --env-file=.env scripts/fix-plans-arrosage-20260814.ts [--apply]
 */
import prisma from '@/lib/prisma'
import { compterCulturesSansPlan, genererIrrigationsPlanifiees } from '@/lib/irrigation-scheduler'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`Mode : ${APPLY ? 'APPLY' : 'dry-run'}`)

  // Comptes ayant déjà un plan d'arrosage (opt-in).
  const comptes = await prisma.irrigationPlanifiee.groupBy({
    by: ['userId'],
    _count: { id: true },
  })
  console.log(`${comptes.length} compte(s) avec un plan d'arrosage existant.\n`)

  let totalCultures = 0
  let totalPassages = 0
  for (const compte of comptes) {
    const sansPlan = await compterCulturesSansPlan(compte.userId)
    if (sansPlan === 0) continue
    totalCultures += sansPlan
    if (APPLY) {
      const r = await genererIrrigationsPlanifiees(compte.userId)
      totalPassages += r.created
      console.log(
        `${compte.userId.slice(0, 10)}… : ${sansPlan} culture(s) sans plan → ${r.created} passage(s) créé(s)`
      )
    } else {
      console.log(`${compte.userId.slice(0, 10)}… : ${sansPlan} culture(s) sans plan (génération possible)`)
    }
  }

  console.log(
    `\nTotal : ${totalCultures} culture(s) à couvrir${APPLY ? `, ${totalPassages} passage(s) créés` : ''}.`
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
