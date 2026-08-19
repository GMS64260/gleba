/**
 * Reprise des dates de culture écrites avec l'ancienne convention de semaine.
 *
 * QA cmswxqnaz (2026-08-17) — `calculerDateDepuisSemaine` ancrait la semaine 1
 * sur « la semaine contenant le 1er janvier » (convention `getWeek`) alors que
 * toute l'application relit les dates en semaine ISO (`getISOWeek`). Dès que le
 * 1er janvier tombe un vendredi, samedi ou dimanche — 2027, 2028, 2032, 2033… —
 * les deux conventions divergent d'une semaine. `creerCulturesBatch` (écran
 * « Créer les cultures ») était le seul chemin d'écriture concerné : une culture
 * 2028 matérialisée depuis une rotation en S31/S43 se relisait en S30/S42, et
 * ses dates réelles tombaient une semaine trop tôt.
 *
 * Le code est corrigé. Ce script rattrape les lignes déjà écrites, avec un
 * critère strictement vérifiable : on rejoue le pipeline de production
 * (calibrage ITP par zone comprise) dans les DEUX conventions, et on ne corrige
 * une date que si elle est EXACTEMENT celle produite par l'ancienne et qu'elle
 * diffère de la nouvelle. Toute date saisie ou modifiée à la main tombe donc à
 * côté du critère et reste intacte.
 *
 * Usage :
 *   npx tsx scripts/fix-semaine-iso-cultures-20260817.ts            (simulation)
 *   npx tsx scripts/fix-semaine-iso-cultures-20260817.ts --apply    (écriture)
 */

import { PrismaClient } from "@prisma/client"
import { addWeeks, startOfWeek, startOfYear } from "date-fns"

import { appliquerDecalageItp, decalageItpPourZone } from "../src/lib/calendrier-climat"
import { semaineSemisEffective, semaineVersDate } from "../src/lib/cultures/dates-itp"
import { zoneEffectiveUser } from "../src/lib/terroir"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

/** Ancienne conversion semaine → date (convention « semaine contenant le 1er janvier »). */
function dateAncienneConvention(annee: number, semaine: number): Date {
  return startOfWeek(addWeeks(startOfYear(new Date(annee, 0, 1)), semaine - 1), {
    weekStartsOn: 1,
  })
}

/** Chronologie : une étape antérieure à sa référence tombe l'année suivante. */
function chrono(
  conversion: (annee: number, semaine: number) => Date,
  annee: number,
  semaine: number,
  reference?: number | null,
): Date {
  let s = Math.max(Math.round(semaine), 1)
  if (reference != null) {
    while (s < reference) s += 52
  }
  return conversion(annee, s)
}

const memeInstant = (a: Date | null, b: Date | null) =>
  a != null && b != null && a.getTime() === b.getTime()

async function main() {
  // Seules les années où les deux conventions divergent peuvent être touchées ;
  // on les détecte au lieu de les lister (le 1er janvier tombe un ven./sam./dim.).
  const cultures = await prisma.culture.findMany({
    where: { itpId: { not: null } },
    select: {
      id: true,
      userId: true,
      annee: true,
      itpId: true,
      dateSemis: true,
      datePlantation: true,
      dateRecolte: true,
      espece: { select: { id: true, nom: true } },
      planche: { select: { nom: true } },
    },
    orderBy: { id: "asc" },
  })

  const itps = await prisma.iTP.findMany({
    where: { id: { in: [...new Set(cultures.map((c) => c.itpId!))] } },
  })
  const itpMap = new Map(itps.map((i) => [i.id, i]))
  const zoneCache = new Map<string, Awaited<ReturnType<typeof zoneEffectiveUser>>>()

  const corrections: {
    id: number
    libelle: string
    champs: { champ: string; avant: Date; apres: Date }[]
  }[] = []
  let examinees = 0

  for (const culture of cultures) {
    const itp = itpMap.get(culture.itpId!)
    if (!itp || culture.annee == null) continue
    const annee = culture.annee

    // Une année dont le 1er janvier tombe lundi→jeudi donne les mêmes dates dans
    // les deux conventions : rien à examiner.
    const jourDu1erJanvier = new Date(annee, 0, 1).getDay()
    if (jourDu1erJanvier >= 1 && jourDu1erJanvier <= 4) continue
    examinees++

    if (!zoneCache.has(culture.userId)) {
      zoneCache.set(culture.userId, await zoneEffectiveUser(prisma, culture.userId))
    }
    const itpCalibre = appliquerDecalageItp(
      itp,
      decalageItpPourZone(itp.zoneClimat, zoneCache.get(culture.userId)!),
    )

    const semaineSemis = semaineSemisEffective(itpCalibre)
    const jalons = [
      { champ: "dateSemis", valeur: culture.dateSemis, semaine: semaineSemis, reference: null },
      {
        champ: "datePlantation",
        valeur: culture.datePlantation,
        semaine: itpCalibre.semainePlantation,
        reference: semaineSemis,
      },
      {
        champ: "dateRecolte",
        valeur: culture.dateRecolte,
        semaine: itpCalibre.semaineRecolte,
        reference: itpCalibre.semainePlantation ?? semaineSemis,
      },
    ] as const

    const champs: { champ: string; avant: Date; apres: Date }[] = []
    for (const jalon of jalons) {
      if (!jalon.valeur || !jalon.semaine) continue
      const ancienne =
        jalon.reference == null
          ? dateAncienneConvention(annee, jalon.semaine)
          : chrono(dateAncienneConvention, annee, jalon.semaine, jalon.reference)
      const nouvelle =
        jalon.reference == null
          ? semaineVersDate(annee, jalon.semaine)
          : chrono(semaineVersDate, annee, jalon.semaine, jalon.reference)
      if (memeInstant(jalon.valeur, ancienne) && !memeInstant(ancienne, nouvelle)) {
        champs.push({ champ: jalon.champ, avant: jalon.valeur, apres: nouvelle })
      }
    }

    if (champs.length > 0) {
      corrections.push({
        id: culture.id,
        libelle: `${culture.espece?.nom ?? culture.espece?.id ?? "?"} · ${
          culture.planche?.nom ?? "sans planche"
        } · ${annee}`,
        champs,
      })
    }
  }

  const jour = (d: Date) => d.toISOString().slice(0, 10)
  console.log(`Cultures avec ITP : ${cultures.length}`)
  console.log(`Cultures sur une année où les conventions divergent : ${examinees}`)
  console.log(`Cultures à recaler : ${corrections.length}`)
  for (const c of corrections) {
    console.log(
      `  #${c.id} ${c.libelle} — ` +
        c.champs.map((f) => `${f.champ} ${jour(f.avant)} → ${jour(f.apres)}`).join(", "),
    )
  }

  if (!APPLY) {
    console.log("\nSimulation : aucune écriture. Relancer avec --apply.")
    return
  }

  for (const c of corrections) {
    await prisma.culture.update({
      where: { id: c.id },
      data: Object.fromEntries(c.champs.map((f) => [f.champ, f.apres])),
    })
  }
  console.log(`\n${corrections.length} culture(s) recalée(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
