// Sonde du lot du 2026-10-11 c (`89a2243`) : quantité versée sur la page
// Tâches et l'onglet Calendrier, retouches de la relecture de `0e07f60`.
// Compte démo. Toute écriture est interceptée et annulée, sauf deux arrosages
// mesurés (Tâches : 20 L ; Calendrier : « 12,5 ») notés puis annulés par le
// « Annuler » du toast (identifiants d'intervention affichés pour contrôle en
// base). « Quantité inconnue » est essayé écritures coupées : il doit afficher
// l'erreur réseau en français et garder la fenêtre ouverte.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261011c.cjs [BASE] [etapes] [dossier captures]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const CAPTURES = process.argv[4] || null;
const DLG = '[role="dialog"]';
const PARCELLES = ["cms1i3lq9000a159dhyiwhl38", "cms1i3lqe000c159dzx5xhmjx", "cms1i3lqg000e159dhm9mud2q"];
let ecrituresPermises = null;

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

function semaine() {
  const d = new Date();
  const lundi = new Date(d);
  lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  lundi.setHours(0, 0, 0, 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);
  return `start=${lundi.toISOString()}&end=${dimanche.toISOString()}`;
}

async function lignesTaches(page) {
  return (await (await page.request.get(`${BASE}/api/taches?${semaine()}`)).json()).irrigation ?? [];
}

async function api(page) {
  console.log("\n===== API : lignes « à arroser » et préremplissage, comparés au conseiller");
  const lignes = await lignesTaches(page);
  const conseiller = [];
  for (const id of PARCELLES) {
    const r = await (await page.request.get(`${BASE}/api/meteo/irrigation?parcelleId=${id}&refresh=1`)).json();
    conseiller.push(...(r.recommandations ?? []));
  }
  for (const l of lignes) {
    const prerempli = l.litresParM2 > 0 && l.surfaceM2 > 0 ? Math.round(l.litresParM2 * l.surfaceM2) : null;
    const c = conseiller.find((r) => r.plancheId === l.plancheRefId);
    const cPrerempli = c && c.conseilQuantite > 0 && c.surfaceM2 > 0 ? Math.round(c.conseilQuantite * c.surfaceM2) : null;
    console.log(`${l.plancheNom} | ${l.urgence} | ${l.litresParM2} L/m² × ${l.surfaceM2} m² → ${prerempli} L | conseiller : ${c ? `${c.urgence}, ${c.conseilQuantite} L/m² × ${c.surfaceM2} m² → ${cPrerempli} L` : "absent"} | identique : ${c ? prerempli === cPrerempli : "-"}`);
  }
  console.log("\n===== Conseil (page Irriguer) : planche sans type à arroser dans les deux cas, second apport");
  const conseil = await (await page.request.get(`${BASE}/api/cultures/irriguer?annee=${new Date().getFullYear()}`)).json();
  const cultures = conseil.data ?? conseil.cultures ?? [];
  const deux = cultures.filter((c) => /^Type de planche à renseigner : à arroser sous abri comme en plein champ/.test(c.raisonUrgence ?? ""));
  for (const c of deux.slice(0, 3)) {
    const r = c.reserve;
    console.log(`${c.planche?.nom} ${c.espece?.nom} | dose ${r?.doseMm} mm ≤ réserve facile ${r?.reserveFacileMm} mm : ${r ? r.doseMm <= r.reserveFacileMm : "-"} | ~${c.consommationEauSemaine} L/sem`);
  }
  if (!deux.length) console.log("aucune planche sans type à arroser dans les deux cas aujourd'hui");
  const second = cultures.find((c) => /Un apport ne suffit pas/.test(c.raisonUrgence ?? ""));
  console.log("second apport :", second ? (second.raisonUrgence.match(/Un apport ne suffit pas[^.]*\.[^.]*\./) || [""])[0] : "aucun cas aujourd'hui");
}

async function carteArrosage(page) {
  const carte = page
    .locator("div", { has: page.getByText(/À arroser aujourd.hui/) })
    .filter({ has: page.getByRole("button", { name: "Noter", exact: true }) })
    .last();
  await carte.waitFor({ timeout: 30000 });
  return carte;
}

async function lireDialogue(page, nom) {
  const dlg = page.locator(DLG);
  await dlg.locator("#arrosage-litres").waitFor({ timeout: 10000 });
  console.log(`[${nom}] titre :`, await dlg.getByRole("heading").first().innerText());
  console.log(`[${nom}] libellé :`, await dlg.locator('label[for="arrosage-litres"]').innerText(), "| prérempli :", await dlg.locator("#arrosage-litres").inputValue(), "| type :", await dlg.locator("#arrosage-litres").getAttribute("type"));
  console.log(`[${nom}] aide :`, await dlg.locator("p.text-xs").first().innerText());
  console.log(`[${nom}] boutons :`, (await dlg.getByRole("button").allInnerTexts()).map((t) => t.trim()).filter(Boolean));
  return dlg;
}

async function noterPuisAnnuler(page, dlg, nom, saisie, observation) {
  await dlg.locator("#arrosage-litres").fill(saisie);
  if (observation) await dlg.locator("#arrosage-notes").fill(observation);
  ecrituresPermises = /^\/api\/cultures\/irriguer$/;
  let squelettes = 0;
  const veille = (async () => {
    for (let i = 0; i < 20; i++) {
      squelettes = Math.max(squelettes, await page.locator(".animate-pulse").count());
      await page.waitForTimeout(100);
    }
  })();
  const [rep] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cultures/irriguer") && r.request().method() === "PATCH"),
    dlg.getByRole("button", { name: "Enregistrer" }).click(),
  ]);
  const json = await rep.json();
  console.log(`[${nom}] envoyé :`, JSON.stringify(rep.request().postDataJSON()), "→", rep.status(), "intervention", json.interventionId);
  await veille;
  console.log(`[${nom}] squelettes de chargement pendant 2 s :`, squelettes, "| fenêtre fermée :", !(await page.locator(DLG).isVisible()));
  const toast = page.getByText("Arrosage noté").first().locator("xpath=..");
  console.log(`[${nom}] toast :`, (await toast.innerText().catch(() => "aucun")).replace(/\s+/g, " "));
  const [annul] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cultures/irriguer") && r.request().method() === "PATCH"),
    page.getByRole("button", { name: "Annuler" }).first().click(),
  ]);
  console.log(`[${nom}] annulation :`, JSON.stringify(annul.request().postDataJSON()), "→", annul.status(), JSON.stringify(await annul.json()));
  ecrituresPermises = null;
  return json.interventionId;
}

async function taches(page) {
  console.log("\n===== Page Tâches : « Noter » avec quantité");
  await page.goto(`${BASE}/taches`, { waitUntil: "domcontentloaded" });
  const carte = await carteArrosage(page);
  const avant = await lignesTaches(page);
  await carte.getByRole("button", { name: "Noter", exact: true }).first().click();
  const dlg = await lireDialogue(page, "Tâches");
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/taches-dialogue.png` });
  const id = await noterPuisAnnuler(page, dlg, "Tâches", "20", "sonde lot c");
  await page.waitForTimeout(1500);
  const apres = await lignesTaches(page);
  console.log("[Tâches] lignes avant / après annulation :", avant.length, "/", apres.length, "| mêmes planches :", JSON.stringify(avant.map((l) => l.cle)) === JSON.stringify(apres.map((l) => l.cle)));
  return id;
}

async function calendrier(page, bloquees) {
  console.log("\n===== Onglet Calendrier (390 px) : virgule, puis « Quantité inconnue » écritures coupées");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/maraichage`, { waitUntil: "domcontentloaded" });
  const carte = await carteArrosage(page);
  await carte.scrollIntoViewIfNeeded();
  await carte.getByRole("button", { name: "Noter", exact: true }).first().click();
  let dlg = await lireDialogue(page, "Calendrier");
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/calendrier-dialogue-390.png` });
  const boite = await dlg.boundingBox();
  console.log("[Calendrier] fenêtre dans l'écran (390 px) :", boite && boite.x >= 0 && boite.x + boite.width <= 390, JSON.stringify(boite));
  await noterPuisAnnuler(page, dlg, "Calendrier", "12,5", null);
  await page.waitForTimeout(1500);

  await (await carteArrosage(page)).getByRole("button", { name: "Noter", exact: true }).first().click();
  dlg = await lireDialogue(page, "Calendrier");
  const n = bloquees.length;
  await dlg.getByRole("button", { name: "Quantité inconnue" }).click();
  await page.waitForTimeout(1500);
  console.log("[Calendrier] requête coupée :", bloquees.slice(n));
  console.log("[Calendrier] message :", (await page.getByText(/pas de connexion au serveur/).first().innerText().catch(() => "aucun")).replace(/\s+/g, " "));
  console.log("[Calendrier] fenêtre toujours ouverte :", await page.locator(DLG).isVisible());
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1301, height: 933 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1301, height: 933 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript(() => {
    localStorage.setItem("gleba-cookie-consent", JSON.stringify({ essentiel: true, analytics: false, marketing: false, personnalisation: false, date: new Date().toISOString() }));
    sessionStorage.setItem("gleba.tour.maraichage.dismissed", new Date().toISOString());
    localStorage.setItem("gleba.tour.maraichage.done", new Date().toISOString());
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
  const toutes = [api, taches, calendrier];
  const etapes = process.argv[3] ? toutes.filter((f) => process.argv[3].split(",").includes(f.name)) : toutes;
  for (const etape of etapes) {
    try { await etape(page, bloquees); } catch (e) { ecrituresPermises = null; console.log("échec", etape.name, String(e).slice(0, 300)); }
  }
  console.log("\nécritures annulées :", bloquees.length ? bloquees : "aucune");
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
