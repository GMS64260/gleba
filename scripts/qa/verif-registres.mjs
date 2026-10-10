// P4 « une liste est un registre » (2026-10-09) : preuve par l'effet sur un
// banc ou la prod, compte démo public uniquement, aucune écriture.
// Pour chaque liste du jour convertie : des lignes de registre ([data-etat])
// sont rendues, aucun fond rouge ne subsiste, cibles ≥ 44 px, pas de
// débordement à 390 px, captures bureau et téléphone.
//
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/verif-registres.mjs [BASE] [DOSSIER]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? "/var/www/escalier";
const { chromium } = await import(pathToFileURL(`${PLAYWRIGHT_DIR}/node_modules/playwright/index.mjs`).href);
const BASE = process.argv[2] ?? "http://127.0.0.1:3400";
const OUT = resolve(process.argv[3] ?? `audit/captures/${new Date().toISOString().slice(0, 10)}-registres`);
mkdirSync(OUT, { recursive: true });
const PAGES = ["/taches", "/maraichage?tab=calendrier", "/elevage?tab=calendrier", "/verger?tab=calendrier"];
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
    await page.waitForTimeout(4500);
    await page.click('button:has-text("Tout refuser")').catch(() => {});
    const m = await page.evaluate(() => {
      const lignes = [...document.querySelectorAll("div[data-etat]")];
      const etats = {};
      for (const l of lignes) etats[l.dataset.etat] = (etats[l.dataset.etat] ?? 0) + 1;
      const pastilles = [...document.querySelectorAll("span[data-etat]")].map((s) => s.textContent.trim());
      const actions = lignes.flatMap((l) => [...l.querySelectorAll("button, a")].map((b) => b.textContent.trim() || b.getAttribute("aria-label"))).filter(Boolean);
      const petites = lignes.flatMap((l) => [...l.querySelectorAll("button, a")]).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0 && (r.height < 44 || r.width < 44)).length;
      return {
        lignes: lignes.length, etats, pastilles: [...new Set(pastilles)].slice(0, 12), actions: [...new Set(actions)].slice(0, 12),
        ciblesSous44: petites, fondsRouges: document.querySelectorAll("[class*='bg-red-50']").length,
        deb: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    rapport[`${vue} ${path}`] = { ...m, erreurs: erreurs.splice(0) };
    await page.screenshot({ path: `${OUT}/${vue}${path.replace(/[/?=]/g, "_")}.png`, fullPage: true, animations: "disabled" });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(rapport, null, 1));
