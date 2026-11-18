import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const entrypoint = join(process.cwd(), 'docker-entrypoint.sh')
const seeds = [
  'prisma/seed.ts',
  'prisma/seed-demo.ts',
  'prisma/seed-races.ts',
  'prisma/seed-referentiel-geographique.ts',
  'prisma/seed-varietes-arbres.ts',
  'scripts/import-enriched-csv.ts',
]

// Les liens lancent /bin/sh, qui lit les scripts factices même sur un tmp noexec.
// Aucune commande réelle Node/Prisma/tsx n'est joignable.
function simuler(options: { seed?: string; code?: number; deja?: boolean; migration?: number; serveur?: number } = {}) {
  const parent = process.env.TACHE ? join(process.env.TACHE, 'tmp') : tmpdir()
  mkdirSync(parent, { recursive: true })
  const dossier = mkdtempSync(join(parent, 'entrypoint-'))
  try {
    symlinkSync('/bin/sh', join(dossier, 'node'))
    symlinkSync('/bin/sh', join(dossier, 'npx'))
    mkdirSync(join(dossier, 'node_modules/prisma/build'), { recursive: true })
    writeFileSync(join(dossier, 'node_modules/prisma/build/index.js'), `echo 'MIGRATION_SIMULÉE'
exit "\${MIGRATION_CODE:-0}"
`)
    writeFileSync(join(dossier, 'server.js'), `echo 'APPLICATION_DÉMARRÉE'
exit "\${SERVEUR_CODE:-0}"
`)
    writeFileSync(join(dossier, 'tsx'), `printf 'SORTIE_UTILE %s\n' "$1"
if [ "$1" = "$SEED_CIBLE" ]; then
  if [ "$DEJA" = oui ]; then echo 'ℹ La ferme existe déjà (3 planches).'; fi
  if [ "$SEED_CODE" -ne 0 ]; then echo 'DIAGNOSTIC_SIMULÉ : connexion refusée (P1001)' >&2; fi
  exit "$SEED_CODE"
fi
echo 'AVERTISSEMENT_UTILE' >&2
`)
    return spawnSync('/bin/sh', [entrypoint], {
      cwd: dossier,
      encoding: 'utf8',
      timeout: 5000,
      // Environnement inventé et fermé : aucune configuration réelle transmise.
      env: {
        PATH: dossier,
        AUTH_SECRET: 'secret-fictif-session-pour-test-uniquement',
        DATABASE_URL: 'postgresql://test:secret-fictif-base@localhost/test',
        ADMIN_PASSWORD: 'secret-fictif-admin',
        SEED_CIBLE: options.seed ?? '',
        SEED_CODE: String(options.code ?? 0),
        DEJA: options.deja ? 'oui' : 'non',
        MIGRATION_CODE: String(options.migration ?? 0),
        SERVEUR_CODE: String(options.serveur ?? 0),
      },
    })
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

describe('démarrage shell isolé sans Docker ni base', () => {
  it('conserve les sorties utiles et identifie les seeds terminés normalement', () => {
    const resultat = simuler()
    expect(resultat.status).toBe(0)
    for (const seed of seeds) {
      expect(resultat.stdout).toContain(`SORTIE_UTILE ${seed}`)
      expect(resultat.stdout).toContain(`SUCCÈS du seed ${seed}`)
    }
    expect(resultat.stderr.match(/AVERTISSEMENT_UTILE/g)).toHaveLength(seeds.length)
    expect(resultat.stderr).not.toContain('ÉCHEC')
    expect(resultat.stdout).toContain('APPLICATION_DÉMARRÉE')
  })

  it('conserve le diagnostic explicite déjà initialisé renvoyé avec succès par le seed', () => {
    const resultat = simuler({ seed: seeds[1], deja: true })
    expect(resultat.status).toBe(0)
    expect(resultat.stdout).toContain('ℹ La ferme existe déjà (3 planches).')
    expect(resultat.stdout).toContain(`SUCCÈS du seed ${seeds[1]}`)
    expect(resultat.stderr).not.toContain('ÉCHEC')
  })

  it.each(seeds)('rend visible un échec de %s et continue tous les seeds puis le serveur', (seed) => {
    const resultat = simuler({ seed, code: 42 })
    expect(resultat.status).toBe(0)
    expect(resultat.stderr).toContain(`ÉCHEC du seed ${seed} (code de sortie 42)`)
    expect(resultat.stderr).toContain('DIAGNOSTIC_SIMULÉ : connexion refusée (P1001)')
    expect(resultat.stdout).not.toContain(`SUCCÈS du seed ${seed}`)
    for (const suivant of seeds) expect(resultat.stdout).toContain(`SORTIE_UTILE ${suivant}`)
    expect(resultat.stdout).toContain('APPLICATION_DÉMARRÉE')
    expect(resultat.stdout + resultat.stderr).not.toMatch(/already seeded|already exists|skipped|secret-fictif/)
  })

  it('traite un code non nul comme un échec même si des données existent déjà', () => {
    const resultat = simuler({ seed: seeds[1], code: 1, deja: true })
    expect(resultat.stdout).toContain('La ferme existe déjà')
    expect(resultat.stderr).toContain(`ÉCHEC du seed ${seeds[1]} (code de sortie 1)`)
    expect(resultat.stdout).toContain('APPLICATION_DÉMARRÉE')
  })

  it('conserve la valeur 127 lorsque la commande du seed est introuvable', () => {
    const resultat = simuler({ seed: seeds[0], code: 127 })
    expect(resultat.stderr).toContain(`ÉCHEC du seed ${seeds[0]} (code de sortie 127)`)
    expect(resultat.status).toBe(0)
  })

  it('arrête toujours le lancement lorsque les migrations échouent', () => {
    const resultat = simuler({ migration: 3 })
    expect(resultat.status).toBe(3)
    expect(resultat.stdout).not.toContain('SORTIE_UTILE')
    expect(resultat.stdout).not.toContain('APPLICATION_DÉMARRÉE')
  })

  it('transmet toujours le code du serveur exécuté après les seeds', () => {
    const resultat = simuler({ seed: seeds[0], code: 42, serveur: 7 })
    expect(resultat.status).toBe(7)
    expect(resultat.stdout).toContain('APPLICATION_DÉMARRÉE')
  })

  it('ne supprime plus stderr des seeds et reste valide en bash et en sh', () => {
    expect(readFileSync(entrypoint, 'utf8')).not.toContain('2>/dev/null')
    for (const shell of ['/bin/bash', '/bin/sh']) {
      expect(spawnSync(shell, ['-n', entrypoint]).status).toBe(0)
    }
  })
})
