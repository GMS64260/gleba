// Sonde QA cmv2r0t6a / cmv2r1kjv (2026-10-10) : l'arbre et le type choisis dans
// Verger > Opérations et Santé & Phyto sont ceux envoyés. Compte démo ; les
// envois (POST) sont interceptés puis annulés : la sonde n'écrit rien.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-verger-selecteurs.cjs [BASE]
// Avant correctif : Opérations envoyait le premier arbre sans choix ; le sélecteur
// d'arbre de Santé & Phyto revenait au placeholder.
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const DLG = '[role="dialog"]';

async function capturer(page, motif) {
  const envois = [];
  await page.route(motif, async (route) => {
    if (route.request().method() === "POST") {
      envois.push(route.request().postData());
      await route.abort();
    } else {
      await route.continue();
    }
  });
  return envois;
}

async function choisir(page, selecteur, index) {
  const champ = page.locator(`${DLG} ${selecteur}`);
  const valeur = await champ.evaluate((s, i) => s.options[i]?.value ?? null, index);
  await champ.selectOption(valeur);
  return valeur;
}

async function operations(page) {
  console.log("\n===== Opérations");
  const envois = await capturer(page, "**/api/arbres/operations");
  await page.goto(`${BASE}/verger?tab=operations`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Ajouter/ }).first().click();
  await page.waitForSelector(`${DLG} #operation-arbre`, { timeout: 30000 });
  await page.fill(`${DLG} textarea, ${DLG} input[name="description"]`, "QA sonde verger (non envoyée)").catch(() => {});
  await page.click(`${DLG} button[type="submit"]`);
  await page.waitForTimeout(800);
  console.log("sans arbre : envois =", envois.length, "| toasts :", await page.locator("[data-sonner-toast], li[role=status]").allInnerTexts());
  const arbre = await choisir(page, "#operation-arbre", 2);
  const type = await choisir(page, "#operation-type", 1);
  await page.click(`${DLG} button[type="submit"]`);
  await page.waitForTimeout(1200);
  const corps = envois[0] ? JSON.parse(envois[0]) : null;
  console.log("choisi : arbre", arbre, "type", type, "| envoyé :", corps && { arbreId: corps.arbreId, type: corps.type });
  await page.unroute("**/api/arbres/operations");
}

async function sante(page) {
  console.log("\n===== Santé & Phyto — observation");
  const envois = await capturer(page, "**/api/arbres/observations");
  await page.goto(`${BASE}/verger?tab=sante`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^Observation$/ }).first().click();
  await page.waitForSelector(`${DLG} #observation-arbre`, { timeout: 30000 });
  const arbre = await choisir(page, "#observation-arbre", 2);
  const type = await choisir(page, "#observation-type", 2);
  await page.waitForTimeout(500);
  console.log("après choix, champ :", await page.locator(`${DLG} #observation-arbre`).inputValue(), "/", await page.locator(`${DLG} #observation-type`).inputValue());
  await page.click(`${DLG} button[type="submit"]`);
  await page.waitForTimeout(1200);
  const corps = envois[0] ? JSON.parse(envois[0]) : null;
  console.log("choisi : arbre", arbre, "type", type, "| envoyé :", corps && { arbreId: corps.arbreId, type: corps.type });
  await page.keyboard.press("Escape");

  console.log("\n===== Santé & Phyto — traitement phyto");
  await page.goto(`${BASE}/verger?tab=sante`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /phyto/i }).first().click();
  await page.getByRole("button", { name: /Ajouter un traitement/ }).first().click();
  await page.waitForSelector(`${DLG} #traitement-arbre`, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const nbPhyto = await page.locator(`${DLG} #traitement-arbre option`).count();
  if (nbPhyto < 2) throw new Error(`liste d'arbres du traitement : ${nbPhyto} option(s) — ${JSON.stringify(await page.locator(`${DLG} #traitement-arbre option`).allInnerTexts())}`);
  const arbrePhyto = await choisir(page, "#traitement-arbre", nbPhyto - 1);
  // Une autre saisie après le choix : le champ doit garder l'arbre au rendu suivant.
  await page.locator(`${DLG} input[placeholder^="Ex: Tavelure"]`).fill("QA sonde");
  await page.waitForTimeout(500);
  console.log(nbPhyto, "options ; choisi", arbrePhyto, "| champ après une autre saisie :", await page.locator(`${DLG} #traitement-arbre`).inputValue());
  await page.keyboard.press("Escape");
  await page.unroute("**/api/arbres/observations");

  console.log("\n===== Santé & Phyto — pollinisation");
  const envoisPollin = await capturer(page, "**/api/arbres/pollinisation");
  await page.goto(`${BASE}/verger?tab=sante`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /pollinisation/i }).first().click();
  await page.getByRole("button", { name: /Association/ }).first().click();
  await page.waitForSelector(`${DLG} #pollinisation-arbre`, { timeout: 30000 });
  // La liste des arbres se charge en différé.
  await page.waitForFunction((sel) => (document.querySelector(sel)?.options.length ?? 0) > 1, `${DLG} #pollinisation-arbre`, { timeout: 15000 });
  const cible = await choisir(page, "#pollinisation-arbre", 1);
  await page.waitForTimeout(500);
  const nbPollinisateurs = await page.locator(`${DLG} #pollinisation-pollinisateur option`).count();
  const pollinisateur = nbPollinisateurs > 1 ? await choisir(page, "#pollinisation-pollinisateur", 1) : null;
  console.log("choisi : arbre", cible, "pollinisateur", pollinisateur, "| champs :", await page.locator(`${DLG} #pollinisation-arbre`).inputValue(), "/", await page.locator(`${DLG} #pollinisation-pollinisateur`).inputValue());
  if (pollinisateur) {
    await page.click(`${DLG} button[type="submit"]`);
    await page.waitForTimeout(1200);
    const corps = envoisPollin[0] ? JSON.parse(envoisPollin[0]) : null;
    console.log("envoyé :", corps);
  }
  await page.unroute("**/api/arbres/pollinisation");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1301, height: 876 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  } catch {
    await page.fill('input[type="email"]', "demo@gleba.fr");
    await page.fill('input[type="password"]', "demo2026");
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
      page.keyboard.press("Enter"),
    ]);
  }
  const etapes = process.argv[3] ? [operations, sante].filter((f) => process.argv[3].split(",").includes(f.name)) : [operations, sante];
  for (const etape of etapes) {
    try { await etape(page); } catch (e) { console.log("échec", etape.name, String(e).slice(0, 300)); }
  }
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
