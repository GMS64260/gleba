// Mode Personnaliser de l'accueil v2 (glisser-déposer, taille, catalogue),
// sur un banc en mode démo v2. Compte démo public uniquement : ses
// préférences sont figées, donc « Terminer » doit répondre par le message
// « Disposition non enregistrée » et rien n'est écrit. Le glisser est
// prouvé au clavier (espace, flèche, espace), le plus déterministe.
//
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/verif-personnaliser.mjs [BASE] [DOSSIER]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? "/var/www/escalier";
const { chromium } = await import(pathToFileURL(`${PLAYWRIGHT_DIR}/node_modules/playwright/index.mjs`).href);
const BASE = process.argv[2] ?? "http://127.0.0.1:3400";
const OUT = resolve(process.argv[3] ?? `audit/captures/${new Date().toISOString().slice(0, 10)}-personnaliser`);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
const page = await ctx.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 160)));
const requetes = [];
page.on("request", (r) => { if (r.url().includes("/api/accueil/aujourdhui")) requetes.push(r.url().replace(BASE, "")); });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill("#email", "demo@gleba.fr"); await page.fill("#password", "demo2026");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click("button[type=submit]")]);
await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.click('button:has-text("Tout refuser")').catch(() => {});

const ordreTuiles = () => page.$$eval("[data-tuile]", (els) => els.map((e) => e.getAttribute("data-tuile")));
const rapport = { avant: await ordreTuiles() };

// Entrer en édition
await page.click('button[aria-label="Personnaliser l\'accueil"]');
await page.waitForTimeout(600);
rapport.poignees = await page.$$eval('button[aria-label^="Déplacer «"]', (els) => els.length);
rapport.catalogue = await page.$$eval('section[aria-label="Ajouter une tuile"] li', (els) => els.map((li) => ({ libelle: li.querySelector("b")?.textContent?.trim(), grisee: li.className.includes("opacity-70"), bouton: !li.querySelector("button")?.disabled })));
rapport.catalogueAvantReperes = await page.evaluate(() => {
  const cat = document.querySelector('section[aria-label="Ajouter une tuile"]');
  const reperes = document.querySelector('[aria-label="Repères"]');
  return !!cat && !!reperes && cat.compareDocumentPosition(reperes) === Node.DOCUMENT_POSITION_FOLLOWING;
});
await page.screenshot({ path: `${OUT}/01-edition.png`, fullPage: true, animations: "disabled" });

// Glisser au clavier : « Semaine météo » (3e) vient prendre la place de « Plan de la ferme » (2e)
const poignee = page.locator('button[aria-label^="Déplacer « Semaine météo »"]');
await poignee.focus();
await page.keyboard.press("Space");
await page.waitForTimeout(300);
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(600);
rapport.cibleMarquee = await page.$$eval("[data-tuile]", (els) => els.filter((e) => e.parentElement?.className.includes("outline-[3px]")).map((e) => e.getAttribute("data-tuile")));
await page.keyboard.press("Space");
await page.waitForTimeout(800);
rapport.apresGlisser = await ordreTuiles();

// Glisser à la souris : « Gleba » déposée sur « Aujourd'hui »
const poigneeAgent = page.locator('button[aria-label^="Déplacer « Gleba »"]');
const cible = page.locator('[data-tuile="aujourdhui"]');
const a = await poigneeAgent.boundingBox();
const b = await cible.boundingBox();
if (a && b) {
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(800);
}
rapport.apresSouris = await ordreTuiles();

// Taille : la tuile « Plan de la ferme » passe à la taille suivante
const boutonTaille = page.locator('button[aria-label^="Taille de « Plan de la ferme »"]');
rapport.tailleAvant = await boutonTaille.textContent().catch(() => null);
await boutonTaille.click().catch(() => {});
await page.waitForTimeout(400);
rapport.tailleApres = await boutonTaille.textContent().catch(() => null);
rapport.classePlan = await page.$eval('[data-tuile="plan"]', (el) => el.parentElement?.className ?? "").catch(() => null);

// Catalogue : ajouter « Raccourcis » et « Carte »
for (const libelle of ["Raccourcis", "Carte"]) {
  await page.click(`button[aria-label="Ajouter la tuile « ${libelle} »"]`).catch(() => {});
  await page.waitForTimeout(1500);
}
rapport.apresAjout = await ordreTuiles();
rapport.requetesAccueil = requetes;
await page.screenshot({ path: `${OUT}/02-ajout.png`, fullPage: true, animations: "disabled" });
rapport.carteRendue = await page.$eval('[data-tuile="carte"]', (el) => ({ polygones: el.querySelectorAll("polygon").length, texte: el.textContent?.slice(0, 80) })).catch(() => null);
rapport.raccourcis = await page.$$eval('[data-tuile="raccourcis"] li', (els) => els.length);

// Terminer : la démo est figée, le message doit le dire sans écraser l'écran
await page.click('button:has-text("Terminer")');
await page.waitForTimeout(1500);
rapport.toast = await page.$eval("body", (b) => /Disposition (non )?enregistrée/.exec(b.innerText)?.[0] ?? null);
rapport.apresTerminer = await ordreTuiles();
rapport.erreurs = erreurs;
await page.screenshot({ path: `${OUT}/03-fin.png`, fullPage: true, animations: "disabled" });
await browser.close();
console.log(JSON.stringify(rapport, null, 1));
