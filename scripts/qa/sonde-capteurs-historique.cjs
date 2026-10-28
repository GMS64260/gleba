/**
 * Banc navigateur de la vraie page Capteurs, sur réponses HTTP synthétiques.
 * Aucun serveur Next ni accès à la production. Esbuild vient des dépendances
 * de développement ; Playwright est résolu via PLAYWRIGHT_DIR si nécessaire.
 * Lancer : PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-capteurs-historique.cjs
 */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { build } = require('esbuild')
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_DIR || process.cwd()] }))

async function main() {
  const racine = path.resolve(__dirname, '../..')
  const dossier = await fs.mkdtemp(path.join(os.tmpdir(), 'gleba-capteurs-ui-'))
  let navigateur
  let serveur
  try {
    const stubs = {
      'next/link': 'import React from "react"; export default function Link(props) { return React.createElement("a", props) }',
      '@/hooks/use-is-demo': 'export const useIsDemoAccount = () => false',
      '@/hooks/use-exploitation': 'export const useExploitation = () => ({ peutEcrire: false })',
    }
    await build({
      stdin: {
        contents: 'import React from "react"; import { createRoot } from "react-dom/client"; import Page from "./src/app/parametres/capteurs/page"; createRoot(document.getElementById("root")).render(<Page />)',
        loader: 'tsx', resolveDir: racine,
      },
      bundle: true, platform: 'browser', outfile: path.join(dossier, 'page.js'),
      tsconfig: path.join(racine, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'contexte-synthetique', setup(b) {
        b.onResolve({ filter: /^(next\/link|@\/hooks\/use-is-demo|@\/hooks\/use-exploitation)$/ }, args => ({ path: args.path, namespace: 'banc' }))
        b.onLoad({ filter: /.*/, namespace: 'banc' }, args => ({ contents: stubs[args.path], resolveDir: racine }))
      } }],
    })
    await fs.writeFile(path.join(dossier, 'style.css.in'), '@tailwind base; @tailwind components; @tailwind utilities;')
    execFileSync(path.join(racine, 'node_modules/.bin/tailwindcss'), [
      '-i', path.join(dossier, 'style.css.in'), '-o', path.join(dossier, 'style.css'),
      '--config', path.join(racine, 'tailwind.config.ts'), '--content', path.join(racine, 'src/**/*.tsx'),
    ], { cwd: racine, stdio: 'pipe' })
    const html = '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/page.js"></script></html>'
    serveur = http.createServer(async (req, res) => {
      if (req.url === '/page.js' || req.url === '/style.css') {
        res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css')
        res.end(await fs.readFile(path.join(dossier, req.url.slice(1))))
      } else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html) }
    })
    await new Promise(resolve => serveur.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${serveur.address().port}`
    navigateur = await chromium.launch({ headless: true })
    for (const largeur of [375, 1280]) {
      const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } })
      const erreurs = []
      const demandes = []
      page.on('pageerror', e => erreurs.push(e.message))
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()) })
      await page.route('**/api/capteurs**', async route => {
        const url = new URL(route.request().url())
        let corps
        if (url.pathname.endsWith('/mesures')) {
          const jours = Number(url.searchParams.get('jours'))
          demandes.push(jours)
          corps = jours <= 31 ? { type: 'brut', unite: '°C', tronque: false, points: [] } : {
            type: 'jour', unite: '°C', jours: [45, 44, 43].map((j, i) => ({
              jour: new Date(Date.now() - j * 86400000).toISOString().slice(0, 10),
              min: 8 + i, moyenne: 10 + i, max: 12 + i, nombre: 24,
            })),
          }
        } else {
          corps = {
            estProprietaire: false, cibles: [],
            connecteurs: [{ id: 'conn-1', nom: 'Banc', type: 'generique', jetonPrefixe: 'glc_essai', fuseau: 'Pacific/Noumea', actif: true, derniereReceptionA: null, nombreCapteurs: 1 }],
            capteurs: [{ id: 'cap-1', connecteurId: 'conn-1', identifiantExterne: 'sonde-muette', nom: 'Sonde muette', modele: null, cible: null,
              correspondances: null, clesInconnues: [], clesRecues: [], refus: null, avertissement: null, derniereVueA: null,
              batterie: null, rssi: null, snr: null, dernieresValeurs: [] }],
          }
        }
        await route.fulfill({ json: corps })
      })
      await page.goto(base)
      const choix = page.getByLabel('Consulter l’historique').or(page.getByLabel("Consulter l'historique"))
      await choix.waitFor()
      assert.equal(demandes.length, 0, 'aucune série chargée avant un choix')
      assert.equal(await page.getByText('Aucune mesure lisible depuis 30 jours.').count(), 1)
      await choix.selectOption('temperature_air')
      await page.getByText('Aucune mesure sur la période.').waitFor()
      await page.getByRole('button', { name: '90 j', exact: true }).click()
      await page.locator('svg.recharts-surface').waitFor()
      const annuel = page.waitForResponse(r => r.url().includes('jours=365'))
      await page.getByRole('button', { name: '1 an', exact: true }).click()
      await annuel
      await page.locator('svg.recharts-surface').waitFor()
      assert(demandes.includes(90) && demandes.includes(365), 'historiques 90 jours et un an accessibles')
      await page.evaluate(() => { document.body.style.overflowX = 'visible' })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de débordement horizontal')
      assert.deepEqual(erreurs, [], 'aucune erreur navigateur')
      await page.reload()
      await choix.waitFor()
      assert.equal(await choix.inputValue(), '', 'le sélecteur reste disponible à la réouverture')
      await page.close()
      console.log(`OK historique d'un capteur muet, lecture seule, 90 jours et un an, ${largeur} px`)
    }
  } finally {
    if (navigateur) await navigateur.close()
    if (serveur) await new Promise(resolve => serveur.close(resolve))
    await fs.rm(dossier, { recursive: true, force: true })
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
