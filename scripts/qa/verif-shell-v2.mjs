// Shell v2 (rail, barre de commande, navigation basse), écrit pour un banc lancé
// en mode démo v2 (`scripts/banc/lancer-essai.sh demo-v2`, 2026-10-10), rejoué en
// production par la sonde cumulative : le rail reste sur les modules, « Cultures »
// ouvre le module et non l'accueil, le bandeau « Essayer » se tait, aucun fond
// rouge ni badge « Critique » dans les listes du jour. Compte démo public
// uniquement, aucune écriture.
// Attendus revus sur la production du 2026-10-25 : les fonds rouges ne sont
// comptés que dans les lignes des listes du jour (`div[data-etat]`), ce que
// visait le banc ; les alertes voulues des modules (encart « Produits bloqués —
// délais vétérinaires actifs », pastille « urgent(s) » de /elevage) sont
// décrites à part (`fondsRougesHorsListes`), sans verdict.
//
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/verif-shell-v2.mjs [BASE] [DOSSIER]
//
// 2026-10-25 (sonde cumulative) : le passage d'après bascule a dépassé 5 min et n'a
// rien imprimé. Chaque page attendait 30 s un « Tout refuser » qui n'existe plus
// après le premier refus ; le consentement est désormais posé avant tout script
// (clé `gleba-cookie-consent`, comme sonde-lot-20261011.cjs) et le clic de secours
// borné à 1,5 s. Ctrl-C (ou le SIGINT du lanceur) imprime le rapport partiel
// (`_interrompu: true`) et ferme le navigateur.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? "/var/www/escalier";
const { chromium } = await import(pathToFileURL(`${PLAYWRIGHT_DIR}/node_modules/playwright/index.mjs`).href);
const BASE = process.argv[2] ?? "http://127.0.0.1:3400";
const OUT = resolve(process.argv[3] ?? `audit/captures/${new Date().toISOString().slice(0, 10)}-shell-v2`);
mkdirSync(OUT, { recursive: true });
const PAGES = ["/dashboard", "/maraichage?tab=cultures", "/maraichage?tab=calendrier", "/verger?tab=calendrier", "/elevage", "/comptabilite"];
const rapport = {};
let browser;
let interrompu = false;
let rapportImprime = false;
let etape = "lancement du navigateur";
let connexion = null;
function imprimerRapport() {
  if (rapportImprime) return;
  rapportImprime = true;
  console.log(JSON.stringify(rapport, null, 1));
}
process.on("SIGINT", async () => {
  if (interrompu) process.exit(130);
  interrompu = true;
  rapport._interrompu = true;
  imprimerRapport();
  await Promise.race([browser?.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(130);
});
try {
browser = await chromium.launch({ headless: true, handleSIGINT: false });
for (const [vue, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  etape = `${vue} : création du contexte`;
  const ctx = await browser.newContext({ viewport, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("gleba-cookie-consent", JSON.stringify({ essentiel: true, analytics: false, marketing: false, personnalisation: false, date: new Date().toISOString() }));
    } catch {}
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 120)));
  connexion = { vue, sessionHTTP: null, callbackHTTP: null };
  page.on("response", (r) => {
    const url = new URL(r.url());
    if (url.origin === new URL(BASE).origin && url.pathname === "/api/auth/callback/credentials" && r.request().method() === "POST") connexion.callbackHTTP = r.status();
  });
  // SessionProvider ne reçoit pas de session initiale : son effet client émet
  // ce GET public après hydratation. Armer l'attente AVANT goto pour ne pas
  // perdre une réponse rapide, puis attendre la fin du transfert. Aucun accès
  // aux internes React et aucune nouvelle tentative de connexion.
  const sessionInitiale = page.waitForResponse((r) => {
    const url = new URL(r.url());
    return r.request().method() === "GET" && url.origin === new URL(BASE).origin && url.pathname === "/api/auth/session";
  }, { timeout: 45000 }).then(async (r) => {
    const erreur = await r.finished();
    if (erreur) throw erreur;
    if (!r.ok()) throw new Error(`GET /api/auth/session HTTP ${r.status()}`);
    return { statut: r.status(), erreur: null };
  }).catch((e) => ({ statut: null, erreur: String(e).replace(/\s+/g, " ").slice(0, 180) }));
  etape = `${vue} : chargement de la connexion`;
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  etape = `${vue} : hydratation de la connexion`;
  const session = await sessionInitiale;
  connexion.sessionHTTP = session.statut;
  if (session.erreur) throw new Error(`Initialisation de la connexion impossible : ${session.erreur}`);
  await page.locator("#email").waitFor({ state: "visible" });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  etape = `${vue} : soumission unique de la connexion`;
  await page.fill("#email", "demo@gleba.fr"); await page.fill("#password", "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000, waitUntil: "domcontentloaded" }), page.click("button[type=submit]")]);
  for (const path of PAGES) {
    etape = `${vue} : ${path}`;
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.click('button:has-text("Tout refuser")', { timeout: 1500 }).catch(() => {});
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
        fondsRouges: lignes.reduce((n, l) => n + (l.matches("[class*='bg-red-50']") ? 1 : 0) + l.querySelectorAll("[class*='bg-red-50']").length, 0),
        fondsRougesHorsListes: [...document.querySelectorAll("[class*='bg-red-50']")]
          .filter((el) => !el.closest("div[data-etat]") && el.getBoundingClientRect().width > 0)
          .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60))
          .slice(0, 5),
        badgesCritique: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Critique").length,
        deb: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    rapport[`${vue} ${path}`] = { ...m, erreurs: erreurs.splice(0) };
    await page.screenshot({ path: `${OUT}/${vue}${path.replace(/[/?=]/g, "_")}.png`, fullPage: vue === "mobile" || path.includes("calendrier"), animations: "disabled" });
  }
  if (vue === "desktop") {
    etape = "desktop : clic rail Cultures";
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
} catch (e) {
  if (!interrompu) {
    rapport._erreur = { etape, message: String(e).replace(/\s+/g, " ").slice(0, 350), connexion };
    process.exitCode = 1;
  }
} finally {
  try {
    await browser?.close();
  } catch (e) {
    if (!interrompu) {
      rapport._erreurFermeture = String(e).replace(/\s+/g, " ").slice(0, 200);
      process.exitCode = 1;
    }
  }
  imprimerRapport();
}
