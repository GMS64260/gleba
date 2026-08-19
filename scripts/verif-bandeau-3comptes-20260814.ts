/**
 * LECTURE SEULE — le bandeau de recalage (parcelle d'exemple restée à Paris)
 * se déclenchera-t-il pour les 3 comptes actifs du 14/08/2026 ?
 */
import { detecterLocalisationARecaler } from '@/lib/localisation-exemple'

const CIBLES: Array<[string, string]> = [
  ['jean-claude martin', 'cmsam60za002f137zzrpjfonw'],
  ['Cyril', 'cmruohnjt000lv8w9ttd0w3s2'],
  ['Poujol', 'cms63gbkl000bdd203qan649n'],
]

async function main() {
  for (const [nom, id] of CIBLES) {
    const r = await detecterLocalisationARecaler(id)
    console.log(
      `${r.aRecaler ? 'BANDEAU ' : '  rien  '} | planches=${String(r.nbPlanches).padStart(3)} cultures=${String(r.nbCultures).padStart(3)} | parcelle=${r.parcelleNom ?? '-'} | ${nom}`
    )
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
