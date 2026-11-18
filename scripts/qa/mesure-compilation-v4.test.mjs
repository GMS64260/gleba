// Test HTTP du pilote sans Next, sans base et sans commande de gestion du banc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./mesure-compilation-v4.sh', import.meta.url));
const tache = process.env.TACHE || '/srv/gleba-equipe/journees/20261117/taches/dev-10';

async function essai(action, { ignoreNom = false, compte = "debug", redirectionPatch = false } = {}) {
  await mkdir(path.join(tache, 'tmp'), { recursive: true });
  const tmp = await mkdtemp(path.join(tache, 'tmp/mesure-http-'));
  const preuves = path.join(tmp, 'preuves');
  const jar = path.join(tmp, 'session');
  await mkdir(path.join(preuves, 'test'), { recursive: true });
  await mkdir(jar);
  await writeFile(path.join(tmp, 'next.log'), '');
  await writeFile(path.join(jar, 'c'), '# Netscape HTTP Cookie File\n127.0.0.1\tFALSE\t/\tFALSE\t0\tsession\tfictive\n');
  const requetes = [];
  let nom = null;
  const server = http.createServer(async (req, res) => {
    requetes.push({ methode: req.method, url: req.url, cookie: req.headers.cookie });
    if (req.url === '/api/auth/csrf') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ csrfToken: 'csrf-fictif' }));
    }
    if (req.url === '/api/auth/callback/credentials') {
      let corps = '';
      for await (const chunk of req) corps += chunk;
      const donnees = new URLSearchParams(corps);
      assert.equal(donnees.get('csrfToken'), 'csrf-fictif');
      assert.equal(donnees.get('email'), 'recette@example.invalid');
      assert.equal(donnees.get('password'), 'secret-fictif');
      res.setHeader('Set-Cookie', 'session=fictive; Path=/; HttpOnly');
      return res.end('{}');
    }
    if (req.url === '/api/auth/session') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ user: req.headers.cookie === 'session=fictive'
        ? { email: 'recette@example.invalid' } : null }));
    }
    if (req.url === '/login') return res.end('Connexion');
    if (req.url === '/session-expiree' || req.headers.cookie !== 'session=fictive') {
      res.writeHead(307, { Location: '/login' });
      return res.end();
    }
    if (req.url === '/elevage/animaux') {
      res.writeHead(307, { Location: '/elevage?tab=animaux' });
      return res.end();
    }
    if (req.url === '/api/elevage/animaux/42') {
      if (req.method !== 'GET') {
        res.writeHead(405);
        return res.end();
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ data: { id: 42, nom } }));
    }
    if (req.url === '/api/elevage/animaux' && req.method === 'PATCH') {
      if (redirectionPatch) {
        res.writeHead(307, { Location: '/login' });
        return res.end();
      }
      let corps = '';
      for await (const chunk of req) corps += chunk;
      const donnees = JSON.parse(corps);
      requetes.at(-1).corps = donnees;
      if (donnees.id !== 42) { res.writeHead(400); return res.end(); }
      if (!ignoreNom) nom = donnees.nom;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ data: { id: 42, nom } }));
    }
    return res.end('Fiche fictive');
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const child = spawn('bash', ['-c', `
      source "$1"
      # Aucune mesure mémoire nécessaire pour le petit serveur HTTP du test.
      echantillonner() { echo 'RSS_TOTAL_NEXT_Mo 0' > "$2"; }
      banc() {
        if [ "$1" = comptes ]; then
          printf '%s\\n' 'debug : recette@example.invalid / secret-fictif (compte de recette)' 'démo : demo@example.invalid (même mot de passe sur le banc)'
        else echo 'Gestion du banc interdite dans ce test' >&2; exit 99; fi
      }
      ECHANT_PID=""; CURL_PID=""; RESTAURER_ROUTE=""
      ${action}
    `, 'test-mesure', script], {
      env: { ...process.env, TACHE: tache, PREUVES: preuves, JAR: jar, BASE: base,
        NEXT_LOG: path.join(tmp, 'next.log'), COMPTE: compte, DELAI: '5', INTERVALLE: '1' },
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    const verdict = await readFile(path.join(preuves, 'verdict.txt'), 'utf8').catch(e => {
      if (e.code === 'ENOENT') return '';
      throw e;
    });
    return { code, stdout, stderr, verdict, requetes, nom };
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(tmp, { recursive: true, force: true });
  }
}

test('307 suivi avec cookie : deux accès fiche, PATCH, persistance et restauration de null', async () => {
  const r = await essai(`
    mesurer test liste /elevage/animaux 30 '/elevage?tab=animaux'
    mesurer test fiche-animal-1er-acces /elevage/animaux/42 30
    mesurer test fiche-animal-2e-acces /elevage/animaux/42 10
    mesurer test api-fiche-animal /api/elevage/animaux/42
    mesurer_nom test 42
  `);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.verdict, /liste\s+SUCCES.*finale=\/elevage\?<paramètres>/);
  assert.match(r.verdict, /fiche-animal-1er-acces\s+SUCCES/);
  assert.match(r.verdict, /fiche-animal-2e-acces\s+SUCCES/);
  assert.match(r.verdict, /patch-nom\s+SUCCES/);
  const mutations = r.requetes.filter(r => r.methode === 'PATCH');
  assert.equal(mutations.length, 2);
  assert.ok(mutations.every(r => r.url === '/api/elevage/animaux' && r.corps.id === 42));
  assert.ok(r.requetes.every(r => r.cookie === 'session=fictive'));
  assert.equal(r.nom, null);
});

test('307 vers connexion suivi de HTTP 200 : échec de session, chaîne arrêtée', async () => {
  const r = await essai(`
    mesurer test liste /session-expiree 30 '/elevage?tab=animaux'
    mesurer test fiche-interdite /elevage/animaux/42
  `);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.verdict, /ECHEC_SESSION/);
  assert.ok(!r.requetes.some(r => r.url === '/elevage/animaux/42'));
});

test('HTTP 200 du PATCH sans persistance : échec explicite, pas de faux succès', async () => {
  const r = await essai(`
    mesurer test api-fiche-animal /api/elevage/animaux/42
    mesurer_nom test 42
  `, { ignoreNom: true });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.verdict, /patch-nom\s+SUCCES/);
  assert.match(r.verdict, /patch-nom-persistance ECHEC_METIER/);
  assert.match(r.stdout, /nom initial restauré et relu/);
  assert.equal(r.nom, null);
});


test('connexion credentials : CSRF, cookie et session vérifiés sans secret dans les journaux', async () => {
  const r = await essai('connecter');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /session=ok/);
  assert.deepEqual(r.requetes.map(r => r.url), [
    '/api/auth/csrf', '/api/auth/callback/credentials', '/api/auth/session',
  ]);
  assert.doesNotMatch(r.stdout + r.stderr, /recette@example|secret-fictif|csrf-fictif/);
});

test('compte sans identifiants explicites : arrêt avant toute requête HTTP', async () => {
  const r = await essai('connecter', { compte: 'demo' });
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(r.requetes.length, 0);
});

test('journaux : durées et panique conservées, données et identifiants écartés', async () => {
  const r = await essai(`
    printf '%s\n' \
      'GET /api/elevage/animaux/42?nom=Secret 200 in 123ms (compile: 100ms)' \
      '○ Compiling /elevage/animaux/42 ...' \
      'console: cookie=session-fictive email=recette@example.invalid nom=Secret' \
      "thread panicked at aggregation_update.rs:1864: Secret" | compiler_journal
  `);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /GET \/api\/elevage\/animaux\/<id> 200 in 123ms/);
  assert.match(r.stdout, /Compiling \/elevage\/animaux\/<id>/);
  assert.match(r.stdout, /PANIQUE Turbopack.*aggregation_update\.rs:1864/);
  assert.match(r.stdout, /compile: 100ms/);
  assert.doesNotMatch(r.stdout, /Secret|42|recette@example|session-fictive/);
});


test('PATCH redirigé : aucun suivi de la redirection de mutation', async () => {
  const r = await essai(`
    mesurer test api-fiche-animal /api/elevage/animaux/42
    mesurer_nom test 42
  `, { redirectionPatch: true });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.verdict, /patch-nom\s+ECHEC_SESSION/);
  assert.ok(!r.requetes.some(r => r.url === '/login'));
  assert.equal(r.nom, null);
});
