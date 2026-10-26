// Banc d'interface isolé : vrai ChatPanel et useChat, API et reconnaissance
// vocale simulées. Aucun serveur Next, aucune donnée de production.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const racine = process.cwd();
  const js = await build({
    stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { ChatBubble } from './src/components/chat/ChatBubble'; createRoot(document.getElementById('root')).render(<ChatBubble />);`, resolveDir: racine, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', tsconfig: path.join(racine, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'session-du-banc', setup(b) {
      b.onResolve({ filter: /^(next-auth\/react|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'session-simulee' }));
      b.onLoad({ filter: /.*/, namespace: 'session-simulee' }, args => ({ loader: 'js', resolveDir: racine, contents: args.path === 'next/navigation'
        ? 'export function usePathname() { return "/maraichage/recoltes" }'
        : 'import { useState } from "react"; export function useSession() { const [id, changer] = useState("banc-ui"); window.__changerActeurUi = changer; return { data: { user: { id: "banc-exploitation", acteurId: id } } } }' }));
    } }],
  });
  const config = require('tailwindcss/loadConfig')(path.join(racine, 'tailwind.config.ts'));
  config.content = ['./src/components/chat/ChatPanel.tsx', './src/components/chat/ChatBubble.tsx', './src/components/ui/button.tsx'];
  const css = await require('postcss')([require('tailwindcss')(config)]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.join(racine, 'src/app/globals.css') });
  const serveur = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js.outputFiles[0].text); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root" style="height:100dvh"></div><script src="/app.js"></script></body></html>'); }
  });
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  let browser;
  const resultats = [];
  try {
    browser = await chromium.launch({ headless: true });
    for (const largeur of [375, 768]) {
      const context = await browser.newContext({ viewport: { width: largeur, height: 800 }, locale: 'fr-FR' });
      await context.addInitScript(() => {
        const MicroSimule = class {
          start() { window.__micro = this; }
          stop() { this.onend?.(); }
          abort() { this.aborted = true; }
        };
        window.SpeechRecognition = MicroSimule;
        window.webkitSpeechRecognition = MicroSimule;
      });
      const page = await context.newPage();
      const messages = [];
      const erreurs = [];
      page.on('pageerror', e => erreurs.push(e.message));
      let echecReseau = false;
      await page.route('**/api/chat', async route => {
        const message = route.request().postDataJSON().message;
        messages.push(message);
        if (echecReseau) return route.abort('failed');
        const court = message.toLowerCase().replace(/[.!?]/g, '').trim();
        const proposition = court !== 'oui' && court !== 'non';
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/plain', 'X-Conversation-Id': 'banc-ui', 'X-Gleba-Action': proposition ? 'proposed' : 'executed' }, body: proposition ? 'Enregistrer cette récolte ?\n\n• 0,75 kg de Carotte · planche B1 · 26/10/2026\n\nDites « oui » pour confirmer.' : 'Récolte enregistrée : 0,75 kg de Carotte.' });
      });
      await page.route('**/api/user/preferences', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await page.goto(`http://127.0.0.1:${serveur.address().port}/`);
      await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Votre message à Gleba' });
      await page.getByRole('button', { name: 'Dicter un message', exact: true }).click();
      await page.evaluate(() => {
        window.__micro.onresult({ results: [[{ transcript: 'Note 750 grammes de' }]] });
        window.__micro.onresult({ results: [[{ transcript: 'Note 750 grammes de carottes sur B1' }]] });
        window.__micro.onend();
      });
      await input.waitFor();
      assert.equal(await input.inputValue(), 'Note 750 grammes de carottes sur B1');
      assert.equal(messages.length, 0, 'La transcription doit être relue avant tout envoi');
      // Fermer puis rouvrir conserve le brouillon et coupe le micro.
      await page.getByRole('button', { name: 'Dicter un message', exact: true }).click();
      await page.getByRole('button', { name: "Fermer l'assistant", exact: true }).first().click();
      assert.equal(await page.evaluate(() => window.__micro.aborted), true);
      await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
      assert.equal(await input.inputValue(), 'Note 750 grammes de carottes sur B1');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmer', exact: true }).waitFor();
      await page.getByRole('button', { name: "Fermer l'assistant", exact: true }).first().click();
      await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmer', exact: true }).waitFor();
      if (largeur === 375) await page.screenshot({ path: '/home/tinky/gleba-sondes/assistant-terrain-mobile-20261026.png' });
      await page.getByRole('button', { name: 'Dicter un message', exact: true }).click();
      await page.evaluate(() => { window.__micro.onresult({ results: [[{ transcript: 'Oui.' }]] }); window.__micro.onend(); });
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.getByText('Récolte enregistrée : 0,75 kg de Carotte.', { exact: true }).waitFor();
      assert.deepEqual(messages, ['Note 750 grammes de carottes sur B1', 'Oui.']);
      // La dictée refusée est expliquée et laisse le brouillon intact.
      await input.fill('Mon brouillon');
      await page.getByRole('button', { name: 'Dicter un message', exact: true }).click();
      await page.evaluate(() => { window.__micro.onerror({ error: 'not-allowed' }); window.__micro.onend(); });
      await page.getByRole('status').filter({ hasText: 'refusé' }).waitFor();
      assert.equal(await input.inputValue(), 'Mon brouillon');
      // Une panne réseau restitue le texte pour le réessai.
      echecReseau = true;
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('textarea').value === 'Mon brouillon');
      const geometrie = await page.evaluate(() => { document.body.style.overflowX = 'visible'; return { largeur: window.innerWidth, contenu: document.documentElement.scrollWidth, micro: document.querySelector('[aria-label="Dicter un message"]').getBoundingClientRect().width }; });
      assert.ok(geometrie.contenu <= geometrie.largeur, 'Aucun débordement horizontal');
      assert.ok(geometrie.micro >= 44, 'Cible tactile du micro');
      assert.deepEqual(erreurs, []);
      if (largeur === 375) await page.screenshot({ path: '/home/tinky/gleba-sondes/assistant-terrain-reseau-20261026.png' });
      await page.evaluate(() => window.__changerActeurUi('autre-acteur-ui'));
      await page.waitForFunction(() => document.querySelector('textarea').value === '');
      assert.equal(await page.getByText('Récolte enregistrée : 0,75 kg de Carotte.', { exact: true }).count(), 0, 'Une autre personne ne doit pas retrouver la conversation');
      resultats.push({ largeur, dictee: true, confirmationVocale: true, refusMicro: true, brouillonReseau: true, conservationFermeture: true, changementActeur: true, geometrie });
      await context.close();
    }
    // Navigateur sans API vocale : le micro du clavier reste indiqué.
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
    await page.goto(`http://127.0.0.1:${serveur.address().port}/`);
    await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
    await page.getByText('Vous pouvez dicter avec le micro du clavier de votre téléphone.').waitFor();
    resultats.push({ sansApiVocale: true });
    console.log(JSON.stringify(resultats, null, 2));
  } finally {
    await browser?.close();
    await new Promise(r => serveur.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
