/**
 * Importe les CSV enrichis par IA dans Gleba
 * Fusionne les données actuelles avec les enrichissements IA
 *
 * Usage: npx tsx scripts/import-enriched-csv.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const data: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: any = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || null
    })
    data.push(row)
  }

  return data
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function parseNumber(value: string | null): number | null {
  if (!value || value === '') return null
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

function parseInt(value: string | null): number | null {
  if (!value || value === '') return null
  const num = Number.parseInt(value)
  return isNaN(num) ? null : num
}

/**
 * Ne garder que les champs REELLEMENT vides en base.
 *
 * Ce script passe d'un lancement manuel à un lancement au démarrage (issue #29).
 * Le dépôt a déjà payé une fois le prix d'un import rejoué à chaque boot :
 * `doseSemis_AI` du CSV écrasait à chaque redémarrage les doses agronomiques
 * corrigées par migration (feedback Marc, 2026-05-16, cf. migrate-data-v1.ts).
 * La règle est donc : le CSV COMPLÈTE un référentiel, il ne le corrige jamais.
 * Une valeur déjà posée — par une migration, par l'admin, par un membre — reste.
 */
function champsAComplete<T extends Record<string, unknown>>(
  proposes: Record<string, unknown>,
  existant: T | null,
): Record<string, unknown> {
  if (!existant) return proposes
  const retenus: Record<string, unknown> = {}
  for (const [champ, valeur] of Object.entries(proposes)) {
    // Une valeur CSV illisible donne `null` après parsing. L'écrire par-dessus
    // un `null` ne change rien mais compte comme une mise à jour : sans ce
    // filtre, l'import ne CONVERGE jamais et chaque démarrage réécrit les mêmes
    // lignes (vérifié : 22 espèces et 8 ITP « mis à jour » à chaque passage).
    if (valeur === null || valeur === undefined) continue
    const actuel = existant[champ as keyof T]
    if (actuel === null || actuel === undefined || actuel === '') retenus[champ] = valeur
  }
  return retenus
}

/**
 * Une ligne de CSV qui ne correspond à aucune entrée en base n'est pas une
 * erreur d'exécution : c'est un référentiel plus étroit que le fichier. On la
 * compte et on la nomme, au lieu d'imprimer une trace qui noie le vrai signal
 * (constaté le 2026-08-26 : sur une base neuve, l'écrasante majorité des lignes
 * tombait dans ce cas et personne ne le voyait).
 */
function estEntreeAbsente(erreur: unknown): boolean {
  return (erreur as { code?: string })?.code === 'P2025'
}

async function importEspeces(file: string) {
  console.log('\n🌱 Import Espèces enrichies...')

  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`)
    return
  }

  const data = parseCSV(file)
  let updated = 0
  let skipped = 0
  let absentes = 0

  for (const row of data) {
    try {
      const updateData: any = {}
      let hasUpdates = false

      // Fusionner les données AI si présentes et différentes de l'actuel
      if (row.rendement_AI && row.rendement_AI !== row.rendement_actuel) {
        updateData.rendement = parseNumber(row.rendement_AI)
        hasUpdates = true
      }
      if (row.besoinN_AI && row.besoinN_AI !== row.besoinN_actuel) {
        updateData.besoinN = parseInt(row.besoinN_AI)
        hasUpdates = true
      }
      if (row.besoinP_AI && row.besoinP_AI !== row.besoinP_actuel) {
        updateData.besoinP = parseInt(row.besoinP_AI)
        hasUpdates = true
      }
      if (row.besoinK_AI && row.besoinK_AI !== row.besoinK_actuel) {
        updateData.besoinK = parseInt(row.besoinK_AI)
        hasUpdates = true
      }
      if (row.besoinEau_AI && row.besoinEau_AI !== row.besoinEau_actuel) {
        updateData.besoinEau = parseInt(row.besoinEau_AI)
        hasUpdates = true
      }
      if (row.densite_AI && row.densite_AI !== row.densite_actuel) {
        updateData.densite = parseNumber(row.densite_AI)
        hasUpdates = true
      }
      // Feedback Marc 2026-05-16 — V3 Bug 2 : le CSV `especes_enriched.csv`
      // contient des `doseSemis_AI` exprimés en « g pour 100 m² » (100
      // pour Carotte) qui réécrasaient à chaque démarrage les valeurs
      // agronomiques posées par les migrations Prisma (Carotte = 0.8).
      // On ne touche plus à `doseSemis` ici — la source de vérité reste
      // les migrations SQL.
      // if (row.doseSemis_AI && row.doseSemis_AI !== row.doseSemis_actuel) {
      //   updateData.doseSemis = parseNumber(row.doseSemis_AI)
      //   hasUpdates = true
      // }
      if (row.tauxGermination_AI && row.tauxGermination_AI !== row.tauxGermination_actuel) {
        updateData.tauxGermination = parseInt(row.tauxGermination_AI)
        hasUpdates = true
      }
      if (row.temperatureGerm_AI && row.temperatureGerm_AI !== row.temperatureGerm_actuel) {
        updateData.temperatureGerm = row.temperatureGerm_AI
        hasUpdates = true
      }
      if (row.joursLevee_AI && row.joursLevee_AI !== row.joursLevee_actuel) {
        updateData.joursLevee = parseInt(row.joursLevee_AI)
        hasUpdates = true
      }
      if (row.prixKg_AI && row.prixKg_AI !== row.prixKg_actuel) {
        updateData.prixKg = parseNumber(row.prixKg_AI)
        hasUpdates = true
      }
      if (row.description_AI && row.description_AI !== row.description_actuelle) {
        // Ajouter la source si fournie
        const newDesc = row.sources_AI
          ? `${row.description_AI}\n\nSource: ${row.sources_AI}`
          : row.description_AI
        updateData.description = newDesc
        hasUpdates = true
      }

      if (hasUpdates) {
        const existante = await prisma.espece.findUnique({ where: { id: row.id } })
        if (!existante) {
          absentes++
          continue
        }
        const aEcrire = champsAComplete(updateData, existante as Record<string, unknown>)
        if (Object.keys(aEcrire).length === 0) {
          skipped++
          continue
        }
        await prisma.espece.update({ where: { id: row.id }, data: aEcrire })
        updated++
      } else {
        skipped++
      }
    } catch (error) {
      if (estEntreeAbsente(error)) {
        absentes++
        continue
      }
      console.error(`Erreur ${row.id}:`, error)
    }
  }

  console.log(
    `✓ ${updated} espèces mises à jour, ${skipped} inchangées` +
      (absentes > 0 ? `, ${absentes} absentes du référentiel` : '')
  )
}

async function importITPs(file: string) {
  console.log('\n📋 Import ITPs enrichis...')

  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`)
    return
  }

  const data = parseCSV(file)
  let updated = 0
  let skipped = 0
  let absentes = 0

  // Les espèces semées en place n'ont PAS de semaine de plantation : le trigger
  // `enforce_itp_dates` remet `s_plantation` à NULL pour `semis_direct`. Le CSV
  // en propose pourtant une pour la carotte, la betterave, l'épinard et le
  // haricot : la proposer quand même faisait « mettre à jour » 8 ITP à CHAQUE
  // démarrage, sans que rien ne change jamais en base. On ne la propose plus.
  const semisDirect = new Set(
    (
      await prisma.espece.findMany({
        where: { typeCultureSemis: 'semis_direct' },
        select: { id: true },
      })
    ).map((e) => e.id)
  )
  const itpsParId = new Map(
    (await prisma.iTP.findMany({ select: { id: true, especeId: true } })).map((i) => [
      i.id,
      i.especeId,
    ])
  )

  for (const row of data) {
    try {
      const updateData: any = {}
      let hasUpdates = false

      if (row.semaineSemis_AI && row.semaineSemis_AI !== row.semaineSemis_actuel) {
        updateData.semaineSemis = parseInt(row.semaineSemis_AI)
        hasUpdates = true
      }
      const especeItp = itpsParId.get(row.id)
      if (
        row.semainePlantation_AI &&
        row.semainePlantation_AI !== row.semainePlantation_actuel &&
        !(especeItp && semisDirect.has(especeItp))
      ) {
        updateData.semainePlantation = parseInt(row.semainePlantation_AI)
        hasUpdates = true
      }
      if (row.semaineRecolte_AI && row.semaineRecolte_AI !== row.semaineRecolte_actuel) {
        updateData.semaineRecolte = parseInt(row.semaineRecolte_AI)
        hasUpdates = true
      }
      if (row.dureeRecolte_AI && row.dureeRecolte_AI !== row.dureeRecolte_actuel) {
        updateData.dureeRecolte = parseInt(row.dureeRecolte_AI)
        hasUpdates = true
      }
      if (row.dureePepiniere_AI && row.dureePepiniere_AI !== row.dureePepiniere_actuel) {
        updateData.dureePepiniere = parseInt(row.dureePepiniere_AI)
        hasUpdates = true
      }
      if (row.dureeCulture_AI && row.dureeCulture_AI !== row.dureeCulture_actuel) {
        updateData.dureeCulture = parseInt(row.dureeCulture_AI)
        hasUpdates = true
      }
      if (row.nbRangs_AI && row.nbRangs_AI !== row.nbRangs_actuel) {
        updateData.nbRangs = parseInt(row.nbRangs_AI)
        hasUpdates = true
      }
      if (row.espacement_AI && row.espacement_AI !== row.espacement_actuel) {
        updateData.espacement = parseInt(row.espacement_AI)
        hasUpdates = true
      }
      if (row.espacementRangs_AI && row.espacementRangs_AI !== row.espacementRangs_actuel) {
        updateData.espacementRangs = parseInt(row.espacementRangs_AI)
        hasUpdates = true
      }
      if (row.notes_AI && row.notes_AI !== row.notes_actuelle) {
        const newNotes = row.sources_AI
          ? `${row.notes_AI}\nSource: ${row.sources_AI}`
          : row.notes_AI
        updateData.notes = newNotes
        hasUpdates = true
      }

      if (hasUpdates) {
        const existant = await prisma.iTP.findUnique({ where: { id: row.id } })
        if (!existant) {
          absentes++
          continue
        }
        const aEcrire = champsAComplete(updateData, existant as Record<string, unknown>)
        if (Object.keys(aEcrire).length === 0) {
          skipped++
          continue
        }
        await prisma.iTP.update({ where: { id: row.id }, data: aEcrire })
        updated++
      } else {
        skipped++
      }
    } catch (error) {
      if (estEntreeAbsente(error)) {
        absentes++
        continue
      }
      console.error(`Erreur ${row.id}:`, error)
    }
  }

  console.log(
    `✓ ${updated} ITPs mis à jour, ${skipped} inchangés` +
      (absentes > 0 ? `, ${absentes} absents du référentiel` : '')
  )
}

/**
 * Clés normalisées calculées par la BASE, pas par le script.
 *
 * `varietes.nom_normalise` est la colonne portée par l'index unique partiel
 * `(espece, nom_normalise) WHERE user_id IS NULL`. La formule vit à deux
 * endroits déjà synchronisés — `normalizeReferentielKey` côté TypeScript et
 * `gleba_cle_referentiel()` côté SQL. Ce script ne dépend que de
 * `@prisma/client` (il doit tourner dans l'image standalone) : on interroge donc
 * la fonction SQL plutôt que d'ajouter une troisième copie de la formule, qui
 * finirait par diverger.
 */
async function clesNormalisees(noms: string[]): Promise<Map<string, string>> {
  const cles = new Map<string, string>()
  if (noms.length === 0) return cles
  const uniques = Array.from(new Set(noms))
  const lignes = await prisma.$queryRaw<{ nom: string; cle: string }[]>`
    SELECT n AS nom, gleba_cle_referentiel(n) AS cle
    FROM unnest(${uniques}::text[]) AS n
  `
  for (const ligne of lignes) cles.set(ligne.nom, ligne.cle)
  return cles
}

async function importVarietes(file: string) {
  console.log('\n🌾 Import Variétés enrichies...')

  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`)
    return
  }

  const data = parseCSV(file)
  let updated = 0
  let created = 0
  let skipped = 0
  const especesManquantes = new Set<string>()
  let ignoreesEspeceAbsente = 0

  // Issue #29 (Siruv, 2026-08-26) : ce script ne faisait que des `update`. Sur
  // une base neuve — mesuré le 2026-08-26 — 132 des 155 variétés du CSV
  // n'existent pas encore : elles produisaient une erreur avalée par le catch,
  // et l'import « réussissait » sans rien créer. Une variété absente est
  // désormais CRÉÉE, ce qui suppose de connaître son espèce et sa clé.
  const especesConnues = new Set(
    (await prisma.espece.findMany({ select: { id: true } })).map((e) => e.id)
  )
  const cles = await clesNormalisees(data.map((row) => row.id).filter(Boolean))

  for (const row of data) {
    try {
      const updateData: any = {}
      let hasUpdates = false

      if (row.semaineRecolte_AI && row.semaineRecolte_AI !== row.semaineRecolte_actuel) {
        updateData.semaineRecolte = parseInt(row.semaineRecolte_AI)
        hasUpdates = true
      }
      if (row.dureeRecolte_AI && row.dureeRecolte_AI !== row.dureeRecolte_actuel) {
        updateData.dureeRecolte = parseInt(row.dureeRecolte_AI)
        hasUpdates = true
      }
      if (row.nbGrainesG_AI && row.nbGrainesG_AI !== row.nbGrainesG_actuel) {
        updateData.nbGrainesG = parseNumber(row.nbGrainesG_AI)
        hasUpdates = true
      }
      if (row.prixGraine_AI && row.prixGraine_AI !== row.prixGraine_actuel) {
        updateData.prixGraine = parseNumber(row.prixGraine_AI)
        hasUpdates = true
      }
      if (row.description_AI && row.description_AI !== row.description_actuelle) {
        const newDesc = row.sources_AI
          ? `${row.description_AI}\nSource: ${row.sources_AI}`
          : row.description_AI
        updateData.description = newDesc
        hasUpdates = true
      }

      // Identifier une variété par sa CLÉ, jamais par son identifiant seul.
      // L'identifiant du CSV et celui du catalogue diffèrent souvent de la
      // graphie (« Betterave Detroit » contre « Betterave-Detroit »), or la
      // clé d'unicité en base est (espece, nom_normalise) et `-` y vaut espace.
      // Chercher par identifiant faisait conclure « absente », puis la création
      // heurtait l'index unique partiel : 8 lignes en P2002 au premier essai.
      const cle = cles.get(row.id)
      const existante = cle
        ? await prisma.variete.findFirst({
            where: { especeId: row.espece, nomNormalise: cle, userId: null },
          })
        : await prisma.variete.findUnique({ where: { id: row.id } })

      if (!existante) {
        // Une variété ne peut pas exister sans son espèce (clé étrangère). On
        // NOMME ce qui manque au lieu de l'avaler : c'est la seule façon de
        // savoir qu'un référentiel d'espèces incomplet ampute le catalogue.
        if (!row.espece || !especesConnues.has(row.espece)) {
          if (row.espece) especesManquantes.add(row.espece)
          ignoreesEspeceAbsente++
          continue
        }
        if (!cle) {
          ignoreesEspeceAbsente++
          continue
        }
        await prisma.variete.create({
          data: {
            id: row.id,
            nom: row.id,
            nomNormalise: cle,
            especeId: row.espece,
            ...updateData,
          },
        })
        created++
        continue
      }

      if (hasUpdates) {
        const aEcrire = champsAComplete(updateData, existante as Record<string, unknown>)
        if (Object.keys(aEcrire).length === 0) {
          skipped++
          continue
        }
        await prisma.variete.update({ where: { id: existante.id }, data: aEcrire })
        updated++
      } else {
        skipped++
      }
    } catch (error) {
      console.error(`Erreur ${row.id}:`, error)
    }
  }

  console.log(
    `✓ ${created} variétés créées, ${updated} mises à jour, ${skipped} inchangées`
  )
  if (ignoreesEspeceAbsente > 0) {
    console.log(
      `⚠️  ${ignoreesEspeceAbsente} variété(s) ignorée(s), espèce absente du référentiel : ` +
        Array.from(especesManquantes).sort().join(', ')
    )
  }
}

async function main() {
  console.log('🔄 Import des CSV enrichis par IA\n')

  const files = {
    especes: fs.existsSync('especes_enriched.csv') ? 'especes_enriched.csv' : 'especes_to_enrich.csv',
    itps: fs.existsSync('itps_enriched.csv') ? 'itps_enriched.csv' : 'itps_to_enrich.csv',
    varietes: fs.existsSync('varietes_enriched.csv') ? 'varietes_enriched.csv' : 'varietes_to_enrich.csv',
  }

  // Vérifier quels fichiers existent
  const existing = Object.entries(files).filter(([_, file]) => fs.existsSync(file))

  if (existing.length === 0) {
    console.log('❌ Aucun fichier enrichi trouvé.')
    console.log('Fichiers attendus: especes_to_enrich.csv, itps_to_enrich.csv, varietes_to_enrich.csv')
    return
  }

  console.log(`Fichiers trouvés: ${existing.map(([name]) => name).join(', ')}\n`)

  // Importer chaque type
  if (fs.existsSync(files.especes)) {
    await importEspeces(files.especes)
  }

  if (fs.existsSync(files.itps)) {
    await importITPs(files.itps)
  }

  if (fs.existsSync(files.varietes)) {
    await importVarietes(files.varietes)
  }

  console.log('\n✅ Import terminé !')
  console.log('\n💡 Les données ont été enrichies avec les informations de l\'IA')
  console.log('   Les sources sont ajoutées dans les descriptions/notes')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
