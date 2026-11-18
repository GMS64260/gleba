// Tests du vrai composant et du vrai hook, avec API et session simulées, sans serveur Next ni base.
// Harnais de test : les réponses simulées (fetch, session) ne vivent que dans ce fichier *.test.*.
// PLAYWRIGHT_DIR=/srv/gleba-equipe/outils OUT_DIR=<preuves> lourd node scripts/qa/tva-a-preciser-ecran.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const { default: { chromium } } = await import(pathToFileURL(require.resolve('playwright', {
  paths: [process.env.PLAYWRIGHT_DIR ? path.join(process.env.PLAYWRIGHT_DIR, 'node_modules') : process.cwd()],
})).href)

const endpoint = '/api/comptabilite/tva/a-preciser'
const metropole = { regimeTva: 'reel-normal', territoire: 'METROPOLE', devise: 'EUR', source: 'profil-inchange' }
const commandes = [{
  id: 'commande-fictive-1', numero: 'B-2026-001', date: '2026-11-14T12:00:00.000Z', totalTTC: 32.4, contexte: metropole,
  lignes: [
    { ligneId: 'ligne-carottes', produitNom: 'Carottes de conservation de la ferme en sac de cinq kilogrammes', montantTTC: 12.4, categorie: 'legumes', tauxSuggere: 5.5 },
    { ligneId: 'ligne-jus', produitNom: 'Jus de pomme', montantTTC: 20, categorie: 'boissons', tauxSuggere: 10 },
  ],
}, {
  id: 'commande-fictive-2', numero: 'B-2026-002', date: '2026-11-13T12:00:00.000Z', totalTTC: 7.6, contexte: metropole,
  lignes: [{ ligneId: 'ligne-autre', produitNom: 'Produit sans suggestion', montantTTC: 7.6, categorie: null, tauxSuggere: null }],
}]

async function main() {
  const dir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : await fs.mkdtemp(path.join(os.tmpdir(), 'gleba-tva-'))
  await fs.mkdir(dir, { recursive: true })
  const resultats = []
  const composant = path.resolve('src/components/comptabilite/TvaAPreciser.tsx')
  await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {TvaAPreciser} from ${JSON.stringify(composant)};
        import {invaliderContexteExploitation} from '@/hooks/use-exploitation';
        window.envois = []; window.corrections = 0;
        window.rafraichirDroits = invaliderContexteExploitation;
        window.fetch = async (url, options = {}) => {
          window.envois.push({url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null});
          const f = window.fixture;
          if (url === '/api/exploitation/contexte') {
            if (f.chargementDroits) await new Promise(() => {});
            if (f.reseauDroits) throw new Error('Hors connexion');
            return new Response(JSON.stringify({data: {
              role: f.lectureSeule ? 'CONSULTATION' : 'PROPRIETAIRE',
              estProprietaire: !f.lectureSeule, peutEcrire: !f.lectureSeule, modules: null,
              exploitation: {nom: null, emailProprietaire: null},
            }}), {status: f.statutDroits || 200});
          }
          if (options.method === 'PATCH') {
            if (f.delai) await new Promise(r => setTimeout(r, f.delai));
            if (f.reseauPatch) throw new Error('Hors connexion');
            return new Response(JSON.stringify(f.patch || {id: 'commande-fictive-1', fiscaliteSnapshot: {origine: 'manuel'}}), {status: f.statutPatch || 200});
          }
          if (f.reseauGet) throw new Error('Hors connexion');
          return new Response(JSON.stringify(f.get), {status: f.statutGet || 200});
        };
        createRoot(document.getElementById('root')).render(<TvaAPreciser onCorrection={() => window.corrections++}/>);`,
      resolveDir: process.cwd(), loader: 'jsx',
    },
    bundle: true, platform: 'browser', format: 'iife', outfile: path.join(dir, 'composant.js'),
    tsconfig: 'tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'session-simulee',
      setup(b) {
        b.onResolve({ filter: /^next-auth\/react$/ }, args => ({ path: args.path, namespace: 'simulation' }))
        b.onLoad({ filter: /.*/, namespace: 'simulation' }, () => ({ contents: `
          export function useSession() { return {status: 'authenticated', data: {user: {impersonatedBy: window.fixture.impersonation ? 'admin-fictif' : undefined}}}; }
        ` }))
      },
    }],
  })
  execFileSync('node_modules/.bin/tailwindcss', [
    '-i', 'src/app/globals.css', '-o', path.join(dir, 'composant.css'),
    '--content', 'src/components/comptabilite/TvaAPreciser.tsx,src/components/ui/{button,card,label,select-natif}.tsx',
  ], { stdio: 'pipe' })
  await fs.writeFile(path.join(dir, 'composant.html'), `<!doctype html><html lang="fr"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>Test TVA — données fictives</title>
    <link rel="stylesheet" href="composant.css"><style>body{overflow-x:visible!important;padding:16px}</style>
    </head><body><div id="root"></div><script src="composant.js"></script></body></html>`)

  const browser = await chromium.launch({ headless: true })
  const erreurs = []
  async function ouvrir(surcharge = {}, width = 390) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, locale: 'fr-FR', hasTouch: true })
    page.on('pageerror', e => erreurs.push(e.message))
    await page.addInitScript(fixture => { window.fixture = fixture }, {
      get: { commandes, total: { nombre: 2, totalTTC: 40 } }, ...surcharge,
    })
    await page.goto(pathToFileURL(path.join(dir, 'composant.html')).href)
    await page.waitForFunction(() => window.envois?.some(e => e.url === '/api/comptabilite/tva/a-preciser') && !document.querySelector('[role="status"]'))
    return page
  }
  async function test(nom, action) {
    await action()
    resultats.push({ test: nom, resultat: 'ok' })
    console.log(`OK ${nom}`)
  }
  try {
    await test('Liste vide : encart masqué', async () => {
      const page = await ouvrir({ get: { commandes: [], total: { nombre: 0, totalTTC: 0 } } })
      assert.equal(await page.locator('section').count(), 0)
      await page.close()
    })
    await test('Nombre, TTC, cinq taux et suggestions présélectionnées', async () => {
      const page = await ouvrir()
      assert.match(await page.locator('section').innerText(), /2 commande\(s\) · 40,00\s€ TTC/)
      const select = page.getByRole('combobox').first()
      assert.equal(await select.inputValue(), '5.5')
      assert.deepEqual(await select.locator('option:not([disabled])').allTextContents(), ['0 %', '2,1 %', '5,5 % — suggestion', '10 %', '20 %'])
      assert.equal(await page.getByRole('combobox').nth(1).inputValue(), '10')
      assert.equal(await page.getByRole('combobox').nth(2).inputValue(), '')
      assert.equal(await page.getByRole('button', { name: 'Confirmer les taux' }).nth(1).isDisabled(), true)
      assert.deepEqual(await page.evaluate(url => window.envois.find(e => e.url === url), endpoint), { url: endpoint, method: 'GET', body: null })
      await page.close()
    })
    await test('Devise établie de chaque commande : francs Pacifique, pas de total mêlant deux devises', async () => {
      const pf = { regimeTva: 'reel-simplifie', territoire: 'POLYNESIE', devise: 'XPF', source: 'profil-inchange' }
      const xpf = await ouvrir({ get: { commandes: commandes.map(c => ({ ...c, contexte: pf })), total: { nombre: 2, totalTTC: 40 } } })
      const texteXpf = (await xpf.locator('section').innerText()).replace(/[\u00a0\u202f]/g, ' ')
      assert.match(texteXpf, /2 commande\(s\) · 40 F TTC/)
      assert.match(texteXpf, /12 F TTC/)
      assert.doesNotMatch(texteXpf, /€/)
      await xpf.close()
      const mixte = await ouvrir({ get: { commandes: [commandes[0], { ...commandes[1], contexte: pf }], total: { nombre: 2, totalTTC: 40 } } })
      const texteMixte = (await mixte.locator('section').innerText()).replace(/[\u00a0\u202f]/g, ' ')
      assert.match(texteMixte, /2 commande\(s\) · total non calculé : plusieurs devises/)
      assert.match(await mixte.getByRole('form', { name: 'Commande B-2026-001', exact: true }).innerText(), /32,40\s€ TTC/)
      assert.match((await mixte.getByRole('form', { name: 'Commande B-2026-002', exact: true }).innerText()).replace(/[\u00a0\u202f]/g, ' '), /8 F TTC/)
      await mixte.close()
    })
    await test('Contexte inconnu (GET contexte:null) : ni devise ni total supposés, déclaration du territoire et du régime envoyée avec les taux', async () => {
      // Ancienne commande de 120 en euros, profil passé depuis en XPF : le GET réel renvoie contexte:null.
      const ancienne = { id: 7, numero: 'B-2025-120', date: '2025-06-01T10:00:00.000Z', totalTTC: 120, contexte: null,
        lignes: [{ ligneId: '70', produitNom: 'Tablier fictif', montantTTC: 120, categorie: 'autre', tauxSuggere: 20 }] }
      const page = await ouvrir({ get: { commandes: [ancienne, commandes[1]], total: { nombre: 2, totalTTC: 127.6 } } })
      const texte = (await page.locator('section').innerText()).replace(/[\u00a0\u202f]/g, ' ')
      assert.match(texte, /2 commande\(s\) · total non calculé : devise à préciser pour 1 commande\(s\)/)
      assert.match(texte, /120 \(devise à préciser\) TTC/)
      assert.doesNotMatch(texte, /120 F|127/)
      const form = page.getByRole('form', { name: 'Commande B-2025-120', exact: true })
      assert.equal(await form.getByLabel('Territoire à la date de la commande').inputValue(), '')
      assert.equal(await form.getByLabel('Régime de taxe à la date de la commande').isDisabled(), true)
      assert.equal(await form.getByRole('button', { name: 'Confirmer les taux' }).isDisabled(), true)
      await form.getByLabel('Territoire à la date de la commande').selectOption('METROPOLE')
      assert.equal(await form.getByRole('button', { name: 'Confirmer les taux' }).isDisabled(), true)
      // Régime sans taxe : seul 0 % est proposé et présélectionné.
      await form.getByLabel('Régime de taxe à la date de la commande').selectOption('franchise-293b')
      assert.deepEqual(await form.getByRole('combobox', { name: /Taux de TVA/ }).locator('option:not([disabled])').allTextContents(), ['0 % — suggestion'])
      assert.equal(await form.getByRole('combobox', { name: /Taux de TVA/ }).inputValue(), '0')
      // Régime réel : retour à la suggestion du produit.
      await form.getByLabel('Régime de taxe à la date de la commande').selectOption('reel-normal')
      assert.equal(await form.getByRole('combobox', { name: /Taux de TVA/ }).inputValue(), '20')
      assert.match((await form.innerText()).replace(/[\u00a0\u202f]/g, ' '), /120,00 € TTC/)
      await form.getByRole('button', { name: 'Confirmer les taux' }).click()
      await form.waitFor({ state: 'detached' })
      assert.deepEqual(await page.evaluate(() => window.envois.filter(e => e.method === 'PATCH')), [
        { url: `${endpoint}/7`, method: 'PATCH', body: { lignes: [{ ligneId: '70', taux: 20 }], contexte: { regimeTva: 'reel-normal', territoire: 'METROPOLE', devise: 'EUR' } } },
      ])
      await page.close()
    })
    await test('TGC (établie ou déclarée) : aucune suggestion ni taux, message explicite, aucun PATCH possible', async () => {
      const tgc = { ...commandes[1], contexte: { regimeTva: 'tgc', territoire: 'NOUVELLE_CALEDONIE', devise: 'XPF', source: 'profil-inchange' } }
      const etablie = await ouvrir({ get: { commandes: [tgc], total: { nombre: 1, totalTTC: 7.6 } } })
      assert.match(await etablie.getByRole('note').innerText(), /taxe locale \(TGC\).*aucun taux n’est supposé/)
      assert.equal(await etablie.getByRole('combobox').count(), 0)
      assert.equal(await etablie.getByRole('button', { name: 'Confirmer les taux' }).count(), 0)
      await etablie.getByRole('form').evaluate(form => form.requestSubmit())
      assert.equal(await etablie.evaluate(() => window.envois.filter(e => e.method === 'PATCH').length), 0)
      await etablie.close()
      const declaree = await ouvrir({ get: { commandes: [{ ...commandes[1], contexte: null }], total: { nombre: 1, totalTTC: 7.6 } } })
      await declaree.getByLabel('Territoire à la date de la commande').selectOption('NOUVELLE_CALEDONIE')
      await declaree.getByLabel('Régime de taxe à la date de la commande').selectOption('tgc')
      assert.match(await declaree.getByRole('note').innerText(), /taxe locale \(TGC\)/)
      assert.equal(await declaree.getByRole('combobox', { name: /Taux de TVA/ }).count(), 0)
      assert.equal(await declaree.getByRole('button', { name: 'Confirmer les taux' }).count(), 0)
      assert.match((await declaree.locator('section').innerText()).replace(/[\u00a0\u202f]/g, ' '), /8 F TTC/)
      await declaree.close()
    })
    await test('PATCH complet, taux choisi dont zéro, retrait et nouveau total', async () => {
      const page = await ouvrir()
      await page.getByRole('combobox').first().selectOption('20')
      await page.getByRole('combobox').nth(1).selectOption('2.1')
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().click()
      await page.getByRole('form', { name: 'Commande B-2026-001', exact: true }).waitFor({ state: 'detached' })
      assert.match(await page.locator('section').innerText(), /1 commande\(s\) · 7,60\s€ TTC/)
      await page.getByRole('combobox').selectOption('0')
      await page.getByRole('button', { name: 'Confirmer les taux' }).click()
      await page.locator('section').waitFor({ state: 'detached' })
      const envois = await page.evaluate(() => window.envois.filter(e => e.method === 'PATCH'))
      assert.deepEqual(envois, [
        { url: `${endpoint}/commande-fictive-1`, method: 'PATCH', body: { lignes: [{ ligneId: 'ligne-carottes', taux: 20 }, { ligneId: 'ligne-jus', taux: 2.1 }] } },
        { url: `${endpoint}/commande-fictive-2`, method: 'PATCH', body: { lignes: [{ ligneId: 'ligne-autre', taux: 0 }] } },
      ])
      assert.equal(await page.evaluate(() => window.corrections), 2)
      await page.close()
    })
    await test('Suggestion zéro présélectionnée et identifiant de commande numérique', async () => {
      const commande = { ...commandes[0], id: 101, totalTTC: 12.4, lignes: [{ ...commandes[0].lignes[0], tauxSuggere: 0 }] }
      const page = await ouvrir({ get: { commandes: [commande], total: { nombre: 1, totalTTC: commande.totalTTC } } })
      assert.equal(await page.getByRole('combobox').inputValue(), '0')
      assert.equal(await page.locator('option:checked').innerText(), '0 % — suggestion')
      await page.getByRole('button', { name: 'Confirmer les taux' }).click()
      await page.locator('section').waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.envois.at(-1).url), `${endpoint}/101`)
      await page.close()
    })
    for (const statut of [400, 403, 404, 409]) {
      await test(`PATCH ${statut} : message du serveur intact et commande conservée`, async () => {
        const message = `Refus ${statut} : commande à vérifier — exercice clôturé.`
        const page = await ouvrir({ statutPatch: statut, patch: { error: message } })
        await page.getByRole('button', { name: 'Confirmer les taux' }).first().click()
        await page.getByRole('alert').waitFor()
        assert.equal(await page.getByRole('alert').innerText(), message)
        assert.equal(await page.getByRole('form').count(), 2)
        assert.equal(await page.evaluate(() => window.corrections), 0)
        await page.close()
      })
    }
    await test('Consultation, droits en cours et impersonation : correction masquée', async () => {
      for (const droits of [{ lectureSeule: true }, { chargementDroits: true }, { impersonation: true }]) {
        const page = await ouvrir(droits)
        assert.equal(await page.getByRole('button', { name: 'Confirmer les taux' }).count(), 0)
        assert.equal(await page.getByRole('combobox').first().isDisabled(), true)
        await page.close()
      }
    })
    await test('Vrai hook, droits indisponibles : correction masquée sans PATCH', async () => {
      for (const panne of [{ statutDroits: 503 }, { reseauDroits: true }]) {
        const page = await ouvrir(panne)
        assert.equal(await page.getByRole('form').count(), 2)
        assert.equal(await page.getByRole('button', { name: 'Confirmer les taux' }).count(), 0)
        assert.equal(await page.getByRole('combobox').first().isDisabled(), true)
        await page.getByRole('form').first().evaluate(form => form.requestSubmit())
        assert.equal(await page.evaluate(() => window.envois.filter(e => e.method === 'PATCH').length), 0)
        await page.close()
      }
    })
    await test('Vrai hook : retrait des corrections après échec de rafraîchissement, puis reprise', async () => {
      const page = await ouvrir()
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().waitFor()
      await page.evaluate(() => { window.fixture.statutDroits = 503; window.rafraichirDroits() })
      await page.waitForFunction(() => window.envois.filter(e => e.url === '/api/exploitation/contexte').length === 2)
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().waitFor({ state: 'detached' })
      assert.equal(await page.getByRole('combobox').first().isDisabled(), true)
      await page.evaluate(() => { window.fixture.statutDroits = 200; window.rafraichirDroits() })
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().waitFor()
      assert.equal(await page.getByRole('combobox').first().isDisabled(), false)
      assert.equal(await page.evaluate(() => window.envois.filter(e => e.method === 'PATCH').length), 0)
      await page.close()
    })
    await test('GET refusé : erreur visible puis réessai', async () => {
      const message = 'Lecture comptable refusée.'
      const page = await ouvrir({ statutGet: 403, get: { error: message } })
      assert.equal(await page.getByRole('alert').innerText(), message)
      await page.evaluate(data => { window.fixture.statutGet = 200; window.fixture.get = data }, { commandes, total: { nombre: 2, totalTTC: 40 } })
      await page.getByRole('button', { name: 'Réessayer' }).click()
      await page.getByRole('form').first().waitFor()
      assert.equal(await page.getByRole('form').count(), 2)
      await page.close()
    })
    await test('Panne réseau : message visible, choix conservé et réessai possible', async () => {
      const page = await ouvrir({ reseauPatch: true })
      await page.getByRole('combobox').first().selectOption('20')
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().click()
      await page.getByRole('alert').waitFor()
      assert.match(await page.getByRole('alert').innerText(), /connexion/)
      assert.equal(await page.getByRole('combobox').first().inputValue(), '20')
      await page.evaluate(() => { window.fixture.reseauPatch = false })
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().click()
      await page.getByRole('form', { name: 'Commande B-2026-001', exact: true }).waitFor({ state: 'detached' })
      await page.close()
    })
    await test('Enregistrement en cours : bouton et sélecteurs désactivés', async () => {
      const page = await ouvrir({ delai: 1000 })
      await page.getByRole('button', { name: 'Confirmer les taux' }).first().click()
      assert.equal(await page.getByRole('button', { name: 'Enregistrement…' }).isDisabled(), true)
      assert.equal(await page.getByRole('combobox').first().isDisabled(), true)
      await page.getByRole('form', { name: 'Commande B-2026-001', exact: true }).waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => window.envois.filter(e => e.method === 'PATCH').length), 1)
      await page.close()
    })
    for (const width of [360, 390, 1440]) {
      await test(`Rendu ${width} px (dont déclaration du contexte) : pas de débordement, cibles tactiles de 44 px`, async () => {
        const page = await ouvrir({ get: { commandes: [{ ...commandes[0], contexte: null }, commandes[1]], total: { nombre: 2, totalTTC: 40 } } }, width)
        assert.equal(await page.getByRole('group', { name: 'Situation à la date de la commande' }).count(), 1)
        const mesures = await page.evaluate(() => ({
          largeur: document.documentElement.clientWidth,
          contenu: document.documentElement.scrollWidth,
          champs: [...document.querySelectorAll('select,button')].map(e => ({ height: e.getBoundingClientRect().height, right: e.getBoundingClientRect().right })),
        }))
        assert.ok(mesures.contenu <= mesures.largeur, JSON.stringify(mesures))
        assert.ok(mesures.champs.every(c => c.height >= 44 && c.right <= width), JSON.stringify(mesures))
        await page.screenshot({ path: path.join(dir, `tva-${width}.png`), fullPage: true })
        await page.close()
      })
    }
    assert.deepEqual(erreurs, [])
  } finally {
    await browser.close()
    await fs.writeFile(path.join(dir, 'resultats-composant.json'), JSON.stringify({ resultats, erreurs }, null, 2))
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
