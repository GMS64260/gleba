// Shell v2 (rail, barre de commande, navigation basse) sur un banc lancé en
// mode démo v2 (`scripts/banc/lancer-essai.sh demo-v2`) : le rail reste sur
// les modules, « Cultures » ouvre le module et non l'accueil, le bandeau
// « Essayer » se tait, aucun fond rouge ni badge « Critique » dans les
// listes du jour. Compte démo public uniquement, aucune écriture.
//
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/verif-shell-v2.mjs [BASE] [DOSSIER]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? "/var/www/escalier";
const { chromium } = await import(pathToFileURL(`${PLAYWRIGHT_DIR}/node_modules/playwright/index.mjs`).href);
const BASE = process.argv[2] ?? "http://127.0.0.1:3400";
const OUT = resolve(process.argv[3] ?? `audit/captures/${new Date().toISOString().slice(0, 10)}-shell-v2`);
mkdirSync(OUT, { recursive: true });
const PAGES = ["/dashboard", "/maraichage?tab=cultures", "/maraichage?tab=calendrier", "/verger?tab=calendrier", "/elevage", "/comptabilite"];
const browser = await chromium.launch({ headless: true });
const rapport = {};
for (const [vue, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", "demo@gleba.fr"); await page.fill("#password", "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click("button[type=submit]")]);
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.click('button:has-text("Tout refuser")').catch(() => {});
    const m = await page.evaluate(() => {
      const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none";
      const rail = document.querySelector("aside[aria-label='Navigation principale']");
      const header = [...document.querySelectorAll("header")].find((h) => h.querySelector("nav, a[href='/dashboard'], a[href='/']"));
      const lignes = [...document.querySelectorAll("div[data-etat]")];
      const petites = lignes.flatMap((l) => [...l.querySelectorAll("button, a")]).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0 && (r.height < 44 || r.width < 44)).length;
      return {
        url: location.pathname + location.search,
        coquilleV2: document.documentElement.classList.contains("coquille-v2"),
        railVisible: vis(rail),
        enTeteVisible: vis(header),
        paddingLeft: getComputedStyle(document.body).paddingLeft,
        ongletsModule: [...document.querySelectorAll("nav button[title]")].map((b) => b.title).slice(0, 8),
        bandeauEssayer: /Essayer le nouvel accueil|un accueil qui montre la ferme/i.test(document.body.innerText),
        lignesRegistre: lignes.length,
        ciblesSous44: petites,
        fondsRouges: document.querySelectorAll("[class*='bg-red-50']").length,
        badgesCritique: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Critique").length,
        deb: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    rapport[`${vue} ${path}`] = { ...m, erreurs: erreurs.splice(0) };
    await page.screenshot({ path: `${OUT}/${vue}${path.replace(/[/?=]/g, "_")}.png`, fullPage: vue === "mobile" || path.includes("calendrier"), animations: "disabled" });
  }
  if (vue === "desktop") {
    await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.click("aside[aria-label='Navigation principale'] a[href='/maraichage']");
    await page.waitForTimeout(3500);
    rapport["desktop clic rail Cultures"] = await page.evaluate(() => {
      const rail = document.querySelector("aside[aria-label='Navigation principale']");
      return {
        url: location.pathname + location.search,
        railVisible: !!rail && rail.getBoundingClientRect().width > 0,
        onglets: [...document.querySelectorAll("nav button[title]")].map((b) => b.title).slice(0, 8),
      };
    });
    await page.screenshot({ path: `${OUT}/desktop_clic_cultures.png`, animations: "disabled" });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(rapport, null, 1));
