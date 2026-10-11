// Sonde du lot du 2026-10-11 (cmv2r1oao, cmv2r21ns, cmv2r2rl8, cmv2r57qk ;
// cmv2r1v63 : scripts/qa/sonde-rangs-suggestion.cjs). Compte démo, lecture
// seule : toute écriture (POST/PATCH/PUT/DELETE) est interceptée puis annulée.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261011.cjs [BASE] [etapes]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const DLG = '[role="dialog"]';

async function interdireEcritures(page) {
  const bloquees = [];
  await page.route("**/api/**", async (route) => {
    const m = route.request().method();
    if (m === "GET" || m === "HEAD") return route.continue();
    bloquees.push(`${m} ${new URL(route.request().url()).pathname} ${route.request().postData() || ""}`);
    return route.abort();
  });
  return bloquees;
}

async function navigation(page) {
  console.log("\n===== cmv2r57qk — navigation (375 px)");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Plus de pages" }).click();
  const lien = page.locator('[role="dialog"] a[href="/interventions"]');
  console.log("menu Plus → Interventions :", await lien.count(), await lien.first().innerText().catch(() => ""));
  await lien.first().click();
  await page.waitForURL(/\/interventions$/, { timeout: 20000 });
  console.log("ouvre :", new URL(page.url()).pathname);

  await page.goto(`${BASE}/taches`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Noter une intervention hors liste/ }).click();
  await page.waitForSelector(`${DLG}`, { timeout: 20000 });
  console.log("Tâches → fiche ouverte :", await page.locator(`${DLG} h2`).first().innerText(), "| URL :", new URL(page.url()).pathname + new URL(page.url()).search);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Palette depuis le registre déjà affiché : fiche ouverte sans navigation.
  await page.keyboard.press("Control+k");
  await page.getByText("Noter une intervention", { exact: true }).click();
  await page.waitForTimeout(800);
  console.log("palette sur /interventions → fiche :", await page.locator(`${DLG} h2`).first().innerText().catch(() => "aucune"));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1301, height: 933 });
}

async function types(page) {
  console.log("\n===== cmv2r21ns — types d'intervention");
  await page.goto(`${BASE}/interventions?nouvelle=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`${DLG} select[required]`, { timeout: 20000 });
  const options = await page.locator(`${DLG} select[required]`).first().locator("option").allInnerTexts();
  console.log("options :", options.join(", "));
  await page.keyboard.press("Escape");
}

async function rotation(page) {
  console.log("\n===== cmv2r2rl8 — étapes de rotation non suivies");
  for (const annee of [2026, 2027]) {
    const r = await (await page.request.get(`${BASE}/api/planification/cultures-prevues?annee=${annee}`)).json();
    console.log(annee, "stats :", JSON.stringify(r.stats && { total: r.stats.total, existantes: r.stats.existantes, aCreer: r.stats.aCreer, etapesNonSuivies: r.stats.etapesNonSuivies }));
    for (const e of (r.etapesNonSuivies || []).slice(0, 3)) {
      console.log(`   ${e.plancheId} étape ${e.rotationAnnee}/${e.rotationNbAnnees} ${e.especeNom ?? e.especeId} ; présentes : ${e.especesPresentes.join(", ")} ; entamée : ${e.etapeEntamee}`);
    }
    if ((r.etapesNonSuivies || []).length > 0) {
      await page.goto(`${BASE}/maraichage/planification/creer-cultures?annee=${annee}`, { waitUntil: "domcontentloaded" });
      const carte = page.getByText(/de la rotation non créée/).first();
      await carte.waitFor({ timeout: 20000 });
      console.log("   écran :", await carte.innerText());
    }
  }
  const stats = await (await page.request.get(`${BASE}/api/planification/stats?annee=2026`)).json();
  console.log("hub 2026 :", JSON.stringify({ culturesACreer: stats.culturesACreer, etapesRotationNonSuivies: stats.etapesRotationNonSuivies }));
}

async function vente(page) {
  console.log("\n===== cmv2r1oao — vente d'une récolte en tiges");
  // Le compte démo n'a aucune récolte en tiges en stock : une ligne fictive est
  // ajoutée à la réponse de lecture, la vente est interceptée (rien d'écrit).
  await page.route("**/api/recoltes?*", async (route) => {
    const reponse = await route.fetch();
    const corps = await reponse.json();
    const modele = (corps.data || []).find((r) => r.statut === "en_stock") || (corps.data || [])[0];
    corps.data = [{ ...modele, id: 999999, especeId: "Zinnia", quantite: 5, unite: "tige", statut: "en_stock", prixKg: null, factureId: null }, ...(corps.data || [])];
    await route.fulfill({ response: reponse, json: corps });
  });
  const envois = [];
  await page.route("**/api/recoltes/999999", async (route) => {
    envois.push(route.request().postData());
    await route.abort();
  });
  await page.goto(`${BASE}/maraichage/recoltes`, { waitUntil: "domcontentloaded" });
  const ligne = page.locator("tr", { hasText: "5 tiges" }).first();
  await ligne.waitFor({ timeout: 20000 });
  await ligne.getByRole("button", { name: /Vendre/ }).click();
  const fenetre = page.getByRole("dialog", { name: /Vendre cette récolte/ });
  await fenetre.waitFor({ timeout: 15000 });
  console.log("fenêtre :", (await fenetre.innerText()).split("\n").filter((l) => /tige|Prix|Quantité/.test(l)).join(" | "));
  const nombres = fenetre.locator('input[type="number"]');
  await nombres.nth(0).fill("1.2");
  await nombres.nth(1).fill("2.5");
  await fenetre.getByRole("button", { name: /Confirmer la vente/ }).click();
  await page.waitForTimeout(800);
  console.log("2,5 tiges : envois =", envois.length, "| message :", await page.getByText(/nombre entier de tiges/).first().innerText().catch(() => "aucun"));
  await page.keyboard.press("Escape");
  await page.unroute("**/api/recoltes?*");
  await page.unroute("**/api/recoltes/999999");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1301, height: 933 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  // Consentement « tout refusé » posé en local : sans lui, la bannière cookies
  // (role="dialog", z-index 100) recouvre la navigation basse et se confond
  // avec les fenêtres testées. Aucune écriture serveur.
  await ctx.addInitScript(() => {
    localStorage.setItem("gleba-cookie-consent", JSON.stringify({ essentiel: true, analytics: false, marketing: false, personnalisation: false, date: new Date().toISOString() }));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("erreur JS :", String(e).slice(0, 200)));
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
  const bloquees = await interdireEcritures(page);
  const toutes = [navigation, types, rotation, vente];
  const etapes = process.argv[3] ? toutes.filter((f) => process.argv[3].split(",").includes(f.name)) : toutes;
  for (const etape of etapes) {
    try { await etape(page); } catch (e) { console.log("échec", etape.name, String(e).slice(0, 300)); }
  }
  console.log("\nécritures annulées :", bloquees.length ? bloquees : "aucune");
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
