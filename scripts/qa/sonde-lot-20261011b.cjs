// Sonde du lot du 2026-10-11 b (arrosage : cmv3ja7nr, cmv3japsf, cmv3jaru7,
// cmv3jatw8, cmv3javy4 ; élevage : cmv3ik186, cmv3ikt5l, cmv3ivtzp). Compte
// démo. Toute écriture est interceptée et annulée, sauf l'étape `noter`, qui
// note un vrai arrosage mesuré puis l'annule par son « Annuler » (l'identifiant
// de l'intervention est affiché pour contrôle en base).
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261011b.cjs [BASE] [etapes]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const DLG = '[role="dialog"]';
const PARCELLES = {
  serre: "cms1i3lq9000a159dhyiwhl38",
  plein: "cms1i3lqe000c159dzx5xhmjx",
  tunnel: "cms1i3lqg000e159dhm9mud2q",
};
let ecrituresPermises = null; // RegExp du chemin autorisé à écrire, le temps d'une étape

async function interdireEcritures(page) {
  const bloquees = [];
  await page.route("**/api/**", async (route) => {
    const m = route.request().method();
    const chemin = new URL(route.request().url()).pathname;
    if (m === "GET" || m === "HEAD") return route.continue();
    if (ecrituresPermises && ecrituresPermises.test(chemin)) return route.continue();
    bloquees.push(`${m} ${chemin} ${route.request().postData() || ""}`);
    return route.abort();
  });
  return bloquees;
}

const jourLocal = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

async function conseils(page) {
  console.log("\n===== API /api/meteo/irrigation (cmv3ja7nr, cmv3jaru7, cmv3javy4)");
  for (const [nom, id] of Object.entries(PARCELLES)) {
    const r = await (await page.request.get(`${BASE}/api/meteo/irrigation?parcelleId=${id}&refresh=1`)).json();
    for (const c of r.recommandations ?? []) {
      console.log(`[${nom}] ${c.plancheName} | ${c.urgence} | abri=${c.sousAbri} | à compléter=${JSON.stringify(c.plancheACompleter)} | ${c.conseilQuantite} L/m² | dernier=${c.derniereIrrigation} | j=${c.joursDepuisIrrigation}`);
      console.log(`    ${c.conseilMessage}`);
    }
  }
}

async function ecran(page) {
  console.log("\n===== Écran Météo (libellés, lien planche)");
  for (const parcelle of [PARCELLES.plein, PARCELLES.serre]) await ecranParcelle(page, parcelle)
}

async function ecranParcelle(page, parcelle) {
  await page.goto(`${BASE}/meteo?parcelleId=${parcelle}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Conseils irrigation").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const lien = page.getByRole("link", { name: /Planche à compléter/ }).first();
  console.log("lien planche :", await lien.innerText().catch(() => "aucun"), "→", await lien.getAttribute("href").catch(() => ""));
  // Titres des lignes du conseiller (LigneRegistre porte data-etat).
  const lignes = page.locator('[data-etat] button[aria-expanded="false"]');
  const n = await lignes.count();
  for (let i = 0; i < n; i++) await page.locator('[data-etat] button[aria-expanded="false"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const texte = await page.locator("body").innerText();
  console.log("« L/m2 » sans exposant :", /L\/m2\b/.test(texte), "| « Goutte-a-goutte » :", /Goutte-a-goutte/.test(texte), "| décimale à point :", /\d\.\d L\/m²/.test(texte));
  console.log("extraits :", (texte.match(/(Équipement : [^\n]+|Bilan 7 j : [^\n]+|Type de planche[^\n]{0,160})/g) || []).slice(0, 6));
}

async function noter(page) {
  console.log("\n===== cmv3japsf — « Noter » avec quantité (Demo-A · Serre), puis Annuler");
  await page.goto(`${BASE}/meteo?parcelleId=${PARCELLES.serre}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Conseils irrigation").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const bouton = page.getByRole("button", { name: "Noter", exact: true }).first();
  if (!(await bouton.count())) return console.log("aucun bouton Noter");
  await bouton.click();
  const champ = page.locator('input[id^="litres-"]').first();
  await champ.waitFor({ timeout: 10000 });
  const plancheId = (await champ.getAttribute("id")).replace("litres-", "");
  console.log("formulaire ouvert, quantité préremplie :", await champ.inputValue(), "L | planche", plancheId);
  const avant = (await (await page.request.get(`${BASE}/api/meteo/irrigation?parcelleId=${PARCELLES.serre}&refresh=1`)).json())
    .recommandations.find((c) => c.plancheId === plancheId);
  console.log("avant :", avant.urgence, "|", avant.conseilQuantite, "L/m² | dernier", avant.derniereIrrigation);
  await champ.fill("20");
  ecrituresPermises = /^\/api\/cultures\/irriguer$/;
  const [rep] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cultures/irriguer") && r.request().method() === "PATCH"),
    page.getByRole("button", { name: "Enregistrer" }).first().click(),
  ]);
  const corps = rep.request().postDataJSON();
  const json = await rep.json();
  console.log("envoyé :", JSON.stringify(corps), "→", rep.status(), "intervention", json.interventionId);
  await page.waitForTimeout(2000);
  const apres = (await (await page.request.get(`${BASE}/api/meteo/irrigation?parcelleId=${PARCELLES.serre}`)).json())
    .recommandations.find((c) => c.plancheId === plancheId);
  console.log("après :", apres.urgence, "| j =", apres.joursDepuisIrrigation, "| dernier", apres.derniereIrrigation);
  console.log("    ", apres.conseilMessage);
  console.log("toast :", await page.getByText("Arrosage noté").first().innerText().catch(() => "aucun"));
  const [annul] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cultures/irriguer") && r.request().method() === "PATCH"),
    page.getByRole("button", { name: "Annuler" }).first().click(),
  ]);
  console.log("annulation :", JSON.stringify(annul.request().postDataJSON()), "→", annul.status(), JSON.stringify(await annul.json()));
  ecrituresPermises = null;
  const retour = (await (await page.request.get(`${BASE}/api/meteo/irrigation?parcelleId=${PARCELLES.serre}&refresh=1`)).json())
    .recommandations.find((c) => c.plancheId === plancheId);
  console.log("retour :", retour.urgence, "|", retour.conseilQuantite, "L/m² | dernier", retour.derniereIrrigation, "| identique à avant :", retour.urgence === avant.urgence && retour.derniereIrrigation === avant.derniereIrrigation);
}

async function interventions(page) {
  console.log("\n===== cmv3jatw8 — Interventions : réalisée datée dans le futur");
  await page.goto(`${BASE}/interventions?nouvelle=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`${DLG} input[type="date"]`, { timeout: 20000 });
  const date = page.locator(`${DLG} input[type="date"]`).first();
  const fait = page.locator(`${DLG} input[type="checkbox"]`).first();
  const demain = jourLocal(new Date(Date.now() + 86_400_000));
  console.log("au départ : réalisée =", await fait.isChecked(), "| date", await date.inputValue());
  await date.fill(demain);
  await page.waitForTimeout(300);
  console.log(`date ${demain} → réalisée =`, await fait.isChecked());
  await fait.check();
  await page.waitForTimeout(300);
  console.log("cochée « Réalisée » → date", await date.inputValue(), "(aujourd'hui :", jourLocal(), ")");
  await page.keyboard.press("Escape");
}

async function animaux(page, bloquees) {
  console.log("\n===== Élevage (1056 px)");
  await page.setViewportSize({ width: 1056, height: 1037 });
  // cmv3ikt5l : premier animal de la liste servi avec un prix d'achat à 0 €.
  let animalId = null;
  await page.route("**/api/elevage/animaux?**", async (route) => {
    const rep = await route.fetch();
    const json = await rep.json();
    const liste = Array.isArray(json.data) ? json.data : [];
    if (liste[0]) { liste[0].prixAchat = 0; animalId = liste[0].id; }
    return route.fulfill({ response: rep, json });
  });
  await page.goto(`${BASE}/elevage?tab=animaux`, { waitUntil: "domcontentloaded" });
  const ligne = page.locator("tr.cursor-pointer").first();
  await ligne.waitFor({ timeout: 30000 });
  // cmv3ivtzp : clic sur une cellule sans lien.
  await ligne.locator("td").nth(2).click();
  await page.waitForURL(/\/elevage\/animaux\/\d+/, { timeout: 15000 }).catch(() => {});
  console.log("cmv3ivtzp clic sur la ligne →", new URL(page.url()).pathname);

  await page.goto(`${BASE}/elevage?tab=animaux&edit=${animalId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`${DLG} input[name="dateNaissance"]`, { timeout: 20000 });
  const prix = page.locator(`${DLG} input[type="number"][step="0.01"]`).first();
  console.log(`cmv3ikt5l Modifier l'animal ${animalId} servi à 0 € → champ prix = « ${await prix.inputValue()} »`);
  await page.keyboard.press("Escape");
  await page.unroute("**/api/elevage/animaux?**");

  // cmv3ik186 : date posée comme un automate (setter + événement input), puis
  // un autre champ saisi (re-rendu) : la date doit rester.
  await page.goto(`${BASE}/elevage?tab=animaux`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^Ajouter$/ }).first().click();
  const champDate = page.locator(`${DLG} input[name="dateNaissance"]`);
  await champDate.waitFor({ timeout: 15000 });
  await champDate.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "2026-10-10");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await prix.fill("0");
  await page.waitForTimeout(300);
  console.log("cmv3ik186 date posée par setter puis prix saisi → date =", `« ${await champDate.inputValue()} »`);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1301, height: 933 });
  console.log("écritures élevage bloquées :", bloquees.filter((b) => b.includes("elevage")).length);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1301, height: 933 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
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
  const toutes = [conseils, ecran, noter, interventions, animaux];
  const etapes = process.argv[3] ? toutes.filter((f) => process.argv[3].split(",").includes(f.name)) : toutes;
  for (const etape of etapes) {
    try { await etape(page, bloquees); } catch (e) { ecrituresPermises = null; console.log("échec", etape.name, String(e).slice(0, 300)); }
  }
  console.log("\nécritures annulées :", bloquees.length ? bloquees : "aucune");
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
