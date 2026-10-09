// Captures de référence de l'accueil et des pages principales (palier L0 du
// plan « accueil bento », 2026-10-08), rejouées à chaque livraison pour
// prouver l'absence de changement visible (L1) ou le comparer (L2+).
//
// Compte démo public uniquement (identifiants publics de LoginForm.tsx),
// aucune écriture en base. Sortie : audit/captures/AAAA-MM-JJ/ (hors git).
//
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/captures-accueil.mjs [BASE] [DOSSIER]
//   BASE par défaut : https://gleba.fr ; DOSSIER par défaut : audit/captures/<date du jour>
//
// Produit aussi metriques.json : poids JS transféré, premier contenu (FCP),
// nombre de requêtes API à l'ouverture de /dashboard, à comparer d'une
// livraison à l'autre.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? "/var/www/escalier";
const { chromium } = await import(pathToFileURL(`${PLAYWRIGHT_DIR}/node_modules/playwright/index.mjs`).href);

const BASE = process.argv[2] ?? "https://gleba.fr";
const jour = new Date().toISOString().slice(0, 10);
const OUT = resolve(process.argv[3] ?? `audit/captures/${jour}`);
mkdirSync(OUT, { recursive: true });

const PAGES = ["/dashboard", "/maraichage", "/taches", "/jardin", "/meteo", "/elevage", "/comptabilite"];
const VUES = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];
// Les captures servent à un diff pixel : on fige l'horloge au moment du
// relevé pour que les deux séries (avant / après) partagent la même date.
const HORLOGE = process.env.CAPTURES_HORLOGE ?? `${jour}T10:00:00`;

async function connexionDemo(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", "demo@gleba.fr");
  await page.fill("#password", "demo2026");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click("button[type=submit]"),
  ]);
}

async function attendreStable(page) {
  // networkidle n'arrive jamais sur gleba.fr (Gleba-exploitation) : on attend
  // le DOM puis un délai fixe pour les données chargées côté client.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
}

function nomFichier(vue, path) {
  return `${vue}${path.replace(/\//g, "_")}.png`;
}

async function metriquesDashboard(ctx) {
  // Contexte sans horloge figée : les entrées Performance en dépendent.
  const page = await ctx.newPage();
  let octetsJs = 0;
  let fichiersJs = 0;
  let requetesApi = 0;
  const tailles = [];
  page.on("response", (r) => {
    const url = r.url();
    if (/\.js(\?|$)/.test(url)) {
      fichiersJs += 1;
      tailles.push(r.request().sizes().then((t) => { octetsJs += t.responseBodySize; }).catch(() => {}));
    }
    if (url.includes("/api/")) requetesApi += 1;
  });
  const debut = Date.now();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await Promise.all(tailles);
  const perf = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
    };
  });
  await page.close();
  return { ...perf, fichiersJs, octetsJsTransferes: octetsJs, requetesApi, dureeTotaleMs: Date.now() - debut };
}

const browser = await chromium.launch({ headless: true });
const erreursConsole = {};
const metriques = { base: BASE, jour, horloge: HORLOGE, vues: {} };
try {
  for (const [vue, viewport] of VUES) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "fr-FR", timezoneId: "Europe/Paris" });
    await ctx.clock.install({ time: HORLOGE });
    const page = await ctx.newPage();
    let pageCourante = "/login";
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      // Les fetch interrompus par la navigation suivante remontent en
      // « Failed to fetch » : bruit de la capture, pas de l'application.
      if (m.text().includes("Failed to fetch")) return;
      (erreursConsole[`${vue} ${pageCourante}`] ??= []).push(m.text().slice(0, 160));
    });
    await connexionDemo(page);
    for (const path of PAGES) {
      pageCourante = path;
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await attendreStable(page);
      await page.screenshot({ path: `${OUT}/${nomFichier(vue, path)}`, fullPage: vue === "mobile", animations: "disabled" });
      process.stdout.write(`${vue} ${path} ok\n`);
    }
    await page.close();
    const etat = await ctx.storageState();
    await ctx.close();
    const ctxMesure = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "fr-FR", timezoneId: "Europe/Paris", storageState: etat });
    metriques.vues[vue] = await metriquesDashboard(ctxMesure);
    await ctxMesure.close();
  }
} finally {
  await browser.close();
}
metriques.erreursConsole = erreursConsole;
writeFileSync(`${OUT}/metriques.json`, JSON.stringify(metriques, null, 2));
console.log(JSON.stringify(metriques, null, 2));
console.log(`captures dans ${OUT}`);
