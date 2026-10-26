// Interface réelle, sans Next ni base de données. API simulée, photos publiques de QA.
// PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-assistant-photos-ui.cjs /chemin/fixtures /chemin/rapports
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : 'playwright');

(async () => {
  const racine = process.cwd();
  const fixtures = process.argv[2];
  const rapports = process.argv[3];
  if (!fixtures || !rapports) throw new Error('Indiquez les dossiers de photos de QA et de rapports.');
  const imageFixture = fs.readFileSync(path.join(fixtures, 'plante-rosette.jpg'));
  const js = await build({
    stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { ChatBubble } from './src/components/chat/ChatBubble'; createRoot(document.getElementById('root')).render(<ChatBubble />);`, resolveDir: racine, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', tsconfig: path.join(racine, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    plugins: [{ name: 'session-du-banc', setup(b) {
      b.onResolve({ filter: /^(next-auth\/react|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'session-simulee' }));
      b.onLoad({ filter: /.*/, namespace: 'session-simulee' }, args => ({ loader: 'js', resolveDir: racine, contents: args.path === 'next/navigation'
        ? 'export function usePathname() { return "/maraichage/recoltes" }'
        : 'import { useState } from "react"; export function useSession() { const [id, changer] = useState("banc-ui"); window.__changerActeurUi = changer; return { data: { user: { id: "banc-exploitation", acteurId: id } } } }' }));
    } }],
  });
  const config = require('tailwindcss/loadConfig')(path.join(racine, 'tailwind.config.ts'));
  config.content = ['./src/components/chat/*.tsx', './src/components/ui/{button,dialog,presence-description}.tsx'];
  const css = await require('postcss')([require('tailwindcss')(config)]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.join(racine, 'src/app/globals.css') });
  const serveur = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js.outputFiles[0].text); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
  });
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  let browser;
  const resultats = [];
  try {
    browser = await chromium.launch({ headless: true });
    for (const largeur of [375, 768]) {
      const context = await browser.newContext({ viewport: { width: largeur, height: 850 }, locale: 'fr-FR' });
      const page = await context.newPage();
      const erreurs = [];
      page.on('pageerror', e => { erreurs.push(e.message); console.error('Erreur navigateur du banc :', e.message); });
      const envois = [];
      let echec = false;
      let traitementLong = false;
      let terminerAncienneReponse = false;
      await page.route('**/api/chat', async route => {
        envois.push(route.request().postDataJSON());
        if (echec) return route.abort('failed');
        if (traitementLong) return route.fulfill({ status: 202, headers: { 'Content-Type': 'application/json', 'X-Conversation-Id': 'vision-qa' }, body: JSON.stringify({ status: 'processing', conversationId: 'vision-qa' }) });
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/plain', 'X-Conversation-Id': 'vision-qa' }, body: 'Des taches sont visibles. Regardez le dessous de la feuille pour distinguer les causes possibles.' });
      });
      await page.route('**/api/chat/conversations', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'historique', title: 'Vision du verger', messageCount: 2, updatedAt: new Date().toISOString() }] }) }));
      await page.route('**/api/chat/conversations/vision-qa', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: terminerAncienneReponse ? [{ role: 'assistant', content: 'Ancienne réponse devenue disponible' }] : [{ role: 'user', content: 'Analyse en cours' }] }) }));
      await page.route('**/api/chat/conversations/historique', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [{ id: 5, role: 'user', content: 'Mon pommier', photos: [{ id: 'photo-qa', url: '/api/chat/conversations/historique/photos/5/photo-qa', width: 1000, height: 750 }] }, { id: 6, role: 'assistant', content: 'Ces taches peuvent évoquer une tavelure.' }] }) }));
      await page.route('**/api/chat/conversations/historique/photos/**', route => route.fulfill({ contentType: 'image/jpeg', body: imageFixture, headers: { 'Cache-Control': 'private, no-store' } }));
      await page.route('**/api/user/preferences', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
      await page.goto(`http://127.0.0.1:${serveur.address().port}/`);
      await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Votre message à Gleba' });
      const fichier = page.getByLabel('Choisir des photos pour Gleba', { exact: true });
      const preview = page.getByRole('img', { name: /^Aperçu photo/ });
      const plante = path.join(fixtures, 'plante-rosette.jpg');
      await fichier.setInputFiles([plante, plante, plante, plante]);
      await page.getByRole('alert').filter({ hasText: 'Trois photos maximum' }).waitFor();
      assert.equal(await preview.count(), 0);
      assert.equal(await page.getByText('3 photos maximum', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Micro : dicter · Envoyer : préparer la saisie · « Oui » : confirmer', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Prendre une photo', exact: true }).count(), 0);
      await fichier.setInputFiles({ name: 'invalide.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('faux fichier') });
      await page.getByRole('alert').filter({ hasText: 'illisible' }).waitFor();
      await fichier.setInputFiles(plante);
      await page.waitForFunction(() => document.querySelectorAll('img[alt^="Aperçu photo"]').length === 1);
      await fichier.setInputFiles([path.join(fixtures, 'tomate-taches.jpg'), path.join(fixtures, 'pommier-taches.jpg')]);
      await page.waitForFunction(() => document.querySelectorAll('img[alt^="Aperçu photo"]').length === 3);
      assert.ok(await page.getByRole('button', { name: 'Joindre des photos', exact: true }).isDisabled());
      await page.getByRole('button', { name: 'Retirer la photo 2', exact: true }).click();
      assert.equal(await preview.count(), 2);
      await input.fill('Mon brouillon photographié');
      await page.getByRole('button', { name: "Fermer l'assistant", exact: true }).first().click();
      await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
      assert.equal(await preview.count(), 2);
      assert.equal(await input.inputValue(), 'Mon brouillon photographié');
      await input.fill('');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.getByText('Des taches sont visibles.', { exact: false }).waitFor();
      assert.equal(envois[0].photos.length, 2);
      assert.match(envois[0].message, /Aide-moi à comprendre ces photos/);
      assert.ok(envois[0].photos.every(p => p.dataUrl.startsWith('data:image/jpeg;base64,') && p.dataUrl.length < 956000));
      await page.getByRole('button', { name: 'Agrandir la photo 1', exact: true }).click();
      await page.getByRole('dialog', { name: 'Photo du message' }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: 'Photo du message' }).waitFor({ state: 'hidden' });
      const geometrie = await page.evaluate(() => ({ largeur: innerWidth, contenu: document.documentElement.scrollWidth, bouton: document.querySelector('input[type=file]').parentElement.querySelector('button').getBoundingClientRect().height }));
      assert.ok(geometrie.contenu <= geometrie.largeur, 'Pas de débordement horizontal');
      await page.screenshot({ path: path.join(rapports, `assistant-photos-${largeur}.png`) });
      await page.getByRole('button', { name: 'Nouvelle conversation', exact: true }).click();
      await fichier.setInputFiles(plante);
      await page.waitForFunction(() => document.querySelectorAll('img[alt^="Aperçu photo"]').length === 1);
      await input.fill('Feuilles jaunes depuis hier');
      echec = true;
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('textarea').value === 'Feuilles jaunes depuis hier');
      assert.equal(await preview.count(), 1, 'Le réessai conserve la photo');
      assert.equal(await page.getByRole('button', { name: 'Agrandir la photo 1', exact: true }).count(), 0, 'Aucune fausse copie envoyée');
      echec = false;
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.getByText('Des taches sont visibles.', { exact: false }).waitFor();
      traitementLong = true;
      await input.fill('Un autre détail à analyser');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.waitForTimeout(100);
      await page.getByRole('button', { name: 'Historique', exact: true }).click();
      await page.getByText('Vision du verger', { exact: true }).click();
      await page.getByText('Ces taches peuvent évoquer une tavelure.', { exact: true }).waitFor();
      terminerAncienneReponse = true;
      await page.waitForTimeout(2300);
      assert.equal(await page.getByText('Ancienne réponse devenue disponible', { exact: true }).count(), 0, 'Un ancien poll ne remplace pas la conversation choisie');
      const historique = page.getByRole('img', { name: 'Photo 1 envoyée à Gleba', exact: true });
      assert.match(await historique.getAttribute('src'), /^\/api\/chat\/conversations\/historique\/photos\//);
      await page.evaluate(() => window.__changerActeurUi('autre-acteur'));
      await page.waitForFunction(() => document.querySelector('textarea').value === '');
      assert.equal(await page.getByText('Mon pommier', { exact: true }).count(), 0);
      assert.deepEqual(erreurs, []);
      resultats.push({ largeur, limitePhotos: true, fichierInvalide: true, compression: true, envoiSansTexte: true, apercuAgrandissable: true, brouillonConserve: true, photosRestitueesAuReseau: true, historiquePrive: true, changementConversationPendantAnalyse: true, isolationActeur: true, geometrie });
      await context.close();
    }
    fs.writeFileSync(path.join(rapports, 'interface-resultats.json'), JSON.stringify(resultats, null, 2));
    console.log(JSON.stringify(resultats, null, 2));
  } finally { await browser?.close(); await new Promise(r => serveur.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
