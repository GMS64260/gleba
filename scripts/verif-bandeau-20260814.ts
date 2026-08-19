/**
 * Vérification post-bascule, LECTURE SEULE, sur des comptes réels.
 * Le bandeau de recalage se déclenche-t-il là où il doit, et nulle part ailleurs ?
 * Aucune mutation.
 */
import { detecterLocalisationARecaler } from '@/lib/localisation-exemple'

const CIBLES: Array<[string, string]> = [
  ['compte A — 11 planches / 23 cultures, parcelle restée à Paris', 'cmsam60za002f137zzrpjfonw'],
  ['compte B — plus gros retard d arrosage', 'cmmxlj7c700291edmazsrsrep'],
  ['demo — parcelles en Vendée', 'cml3ygezz000010oxbdy53n8k'],
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
