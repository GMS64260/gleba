/* eslint-disable @typescript-eslint/no-require-imports -- Harnais CommonJS exécuté directement par Node. */
/** Tests de composant dans Chromium, sans serveur Next ni données réelles.
 * PLAYWRIGHT_DIR=/srv/gleba-equipe/outils node scripts/qa/sonde-terrain-parcelle-grille.cjs
 * Utilise le React embarqué de Next pour reproduire le rejeu des refs en StrictMode.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { build } = require('esbuild')
const { execFileSync } = require('node:child_process')
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_DIR || process.cwd()] }))

async function main() {
  const root = path.resolve(__dirname, '../..')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gleba-terrain-'))
  let browser
  let server
  try {
    const stubs = {
      'next/dynamic': `import React from 'react'; export default (loader) => { const C = React.lazy(loader); return props => <React.Suspense fallback={null}><C {...props}/></React.Suspense> }`,
      'next/navigation': 'export const useSearchParams = () => new URLSearchParams()',
      'next/link': 'import React from "react"; export default props => <a {...props}/>',
      'next-auth/react': 'export const useSession = () => ({status: "authenticated", data: {user: {id: "acteur-fictif"}}})',
      '@/components/shell/AppHeader': 'export const AppHeader = () => null',
      '@/components/shell/PageEntete': 'import React from "react"; export const PageEntete = () => null; export const ConteneurPage = ({children}) => <div>{children}</div>',
      '@/hooks/use-fond-plan': 'export const useFondPlan = () => ({fond: null})',
      '@/hooks/use-toast': 'export const useToast = () => ({toast: () => {}})',
      '@/components/garden/NewCultureDialog': 'export const NewCultureDialog = () => null',
      '@/components/meteo/PluviometriePlanche': 'export const PluviometriePlanche = () => null',
    }
    await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ParcelleFormMap} from './src/components/parcelles/ParcelleFormMap'; import Page from './src/app/jardin/page';
        window.reactVersion = React.version; let root; window.mount = (mode, strict = true) => { root = createRoot(document.getElementById('root')); const c = mode === 'map' ? <ParcelleFormMap geometry={null} onGeometryChange={() => {}}/> : <Page/>; root.render(strict ? <React.StrictMode>{c}</React.StrictMode> : c) }; window.unmount = () => root.unmount();`, resolveDir: root, loader: 'tsx' },
      loader: {'.png': 'dataurl', '.svg': 'dataurl'},
      bundle: true, platform: 'browser', outfile: path.join(dir, 'page.js'), jsx: 'automatic',
      tsconfig: path.join(root, 'tsconfig.json'), define: {'process.env.NODE_ENV': '"development"'},
      plugins: [{ name: 'contexte-test', setup(b) {
        b.onResolve({filter: /^(react|react-dom)(\/.*)?$/}, args => ({path: require.resolve(`next/dist/compiled/${args.path}`, {paths: [root]})}))
        b.onResolve({filter: /.*/}, args => stubs[args.path] ? {path: args.path, namespace: 'test'} : undefined)
        // REFERENCE permet de rejouer le même test contre le code avant correction,
        // sans toucher à l'arbre de travail ni lancer un serveur Next.
        if (process.env.REFERENCE) {
          b.onLoad({filter: /src\/(app\/jardin\/page|components\/carte\/MapContainer)\.tsx$/}, args => ({
            contents: execFileSync('git', ['show', `${process.env.REFERENCE}:${path.relative(root, args.path)}`], {cwd: root, encoding: 'utf8'}),
            loader: 'tsx', resolveDir: path.dirname(args.path),
          }))
        }
        b.onLoad({filter: /.*/, namespace: 'test'}, args => ({contents: stubs[args.path], loader: 'tsx', resolveDir: root}))
      }}],
    })
    server = http.createServer(async (req, res) => {
      const name = req.url === '/page.js' ? 'page.js' : req.url === '/page.css' ? 'page.css' : null
      res.setHeader('Content-Type', name?.endsWith('.js') ? 'text/javascript' : name ? 'text/css' : 'text/html')
      res.end(name ? await fs.readFile(path.join(dir, name)) : '<html><head><link rel="stylesheet" href="/page.css"></head><body><div id="root" style="height:600px"></div><script src="/page.js"></script></body></html>')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    browser = await chromium.launch({headless: true, args: ['--no-sandbox']})
    const page = await browser.newPage({viewport: {width: 1000, height: 800}})
    let tenant = 'exploitation-a'
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      const data = url.pathname === '/api/exploitation/contexte' ? {data: {tenantId: tenant, estProprietaire: false, peutEcrire: true, role: 'MEMBRE', exploitation: {nom: 'Ferme fictive'}}} : url.pathname === '/api/jardin' ? [] : {data: []}
      return route.fulfill({json: data})
    })
    await page.route(/https:\/\//, route => route.abort())
    const errors = []
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message) })
    const url = `http://127.0.0.1:${server.address().port}`
    await page.goto(url)
    console.log('React du test :', await page.evaluate(() => window.reactVersion))
    // Remontage de vrais composants Leaflet, en mode normal puis StrictMode.
    for (const strict of process.env.CAS === 'grille' ? [] : [false, true]) {
      for (let n = 0; n < 2; n++) {
        await page.evaluate(strict => window.mount('map', strict), strict)
        await page.locator('.leaflet-control-layers').waitFor({timeout: 5000})
        assert.deepEqual(errors, [], 'aucune erreur au montage de ParcelleFormMap')
        await page.evaluate(() => window.unmount())
        assert.equal(await page.locator('.leaflet-container').count(), 0)
      }
      console.log(`OK ParcelleFormMap monter/démonter/remonter, StrictMode=${strict}`)
    }
    if (process.env.CAS === 'carte') return
    const openPlan = async () => {
      await page.reload()
      await page.evaluate(() => window.mount('plan'))
      await page.getByRole('button', {name: "Calques d'affichage"}).first().click()
    }
    await openPlan()
    const grille = page.getByRole('menuitemcheckbox', {name: 'Grille', exact: true})
    assert.equal(await grille.getAttribute('aria-checked'), 'true')
    await grille.click()
    await openPlan()
    assert.equal(await grille.getAttribute('aria-checked'), 'false', 'grille conservée après remontage de la page')
    const keys = await page.evaluate(() => Object.keys(localStorage))
    assert(keys.some(k => k.includes('exploitation-a')), 'clé liée au tenant, pas à l’acteur')
    tenant = 'exploitation-b'
    await openPlan()
    assert.equal(await grille.getAttribute('aria-checked'), 'true', 'exploitation B indépendante')
    tenant = 'exploitation-a'
    await openPlan()
    assert.equal(await grille.getAttribute('aria-checked'), 'false', 'retour exploitation A')
    const key = keys.find(k => k.includes('exploitation-a'))
    await page.evaluate(key => localStorage.setItem(key, '{invalide'), key)
    await openPlan()
    assert.equal(await grille.getAttribute('aria-checked'), 'true', 'stockage invalide : valeurs par défaut')
    await page.addInitScript(() => {
      const lire = Storage.prototype.getItem
      const ecrire = Storage.prototype.setItem
      Storage.prototype.getItem = function(key) {
        if (key.startsWith('gleba_jardin_calques:')) throw new Error('Stockage refusé')
        return lire.call(this, key)
      }
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('gleba_jardin_calques:')) throw new Error('Stockage refusé')
        return ecrire.call(this, key, value)
      }
    })
    await openPlan()
    assert.equal(await grille.getAttribute('aria-checked'), 'true', 'stockage refusé : page utilisable')
    assert.deepEqual(errors, [])
    console.log('OK grille persistée après rechargement, deux exploitations indépendantes pour un même acteur')
  } finally {
    if (browser) await browser.close()
    if (server) await new Promise(resolve => server.close(resolve))
    await fs.rm(dir, {recursive: true, force: true})
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
