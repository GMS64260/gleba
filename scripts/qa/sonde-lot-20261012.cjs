// Sonde du lot du 2026-10-12 : trois signalements QA du matin (cmv4z6yhg ITP
// proposé contre le type de planche, cmv4z983m filtre d'année des
// Interventions dans l'URL, cmv4zb9yy calendrier lunaire dans l'accueil v2).
// Compte démo, lecture seule : toute écriture d'API est interceptée et annulée.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261012.cjs [BASE] [etapes]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
// Planches de la démo : « Planche 15 » sans type, A1 (Serre), B1 (Plein champ).
const PLANCHES = { sansType: "cmsq80ip4001nk4gsrhqv9g3d", serre: "cms1i3lqw000k159dl3a56ebr", champ: "cms1i3lr5000q159dxjiwppbx" };

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

async function culture(page) {
  console.log("\n===== cmv4z6yhg — Nouvelle culture Radis : ITP proposé selon le type de la planche");
  await page.goto(`${BASE}/maraichage/cultures/new`, { waitUntil: "domcontentloaded" });
  const espece = page.locator('form button[role="combobox"]').first();
  await espece.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  console.log("champ espèce :", JSON.stringify(await espece.innerText()));
  await espece.click();
  await page.getByPlaceholder(/espèce/i).first().fill("Radis");
  await page.waitForTimeout(800);
  const option = page.locator('[cmdk-item]').filter({ hasText: "Radis" }).filter({ hasNotText: "noir" }).first();
  console.log("option :", JSON.stringify(await option.innerText().catch(() => "introuvable")));
  await option.click();
  const itp = page.locator('form button[role="combobox"]').nth(2);
  await page.waitForTimeout(2500);
  const dates = () => page.locator('input[type="date"]').evaluateAll((els) => els.map((e) => e.value));
  console.log("sans planche → ITP :", await itp.innerText(), "| dates :", await dates());
  const planche = page.locator('select[name="plancheId"]');
  await planche.selectOption(PLANCHES.sansType);
  await page.waitForTimeout(800);
  console.log("Planche 15 (sans type) → ITP :", await itp.innerText(), "| dates :", await dates());
  console.log("  avis :", await page.getByRole("status").filter({ hasText: /itinéraire|Planche à compléter/ }).first().innerText().catch(() => "aucun"));
  console.log("  lien « Planche à compléter » :", await page.getByRole("link", { name: /Planche à compléter/ }).first().getAttribute("href").catch(() => "absent"));
  await planche.selectOption(PLANCHES.serre);
  await page.waitForTimeout(800);
  console.log("A1 (Serre) → ITP :", await itp.innerText(), "| dates :", await dates());
  await planche.selectOption(PLANCHES.champ);
  await page.waitForTimeout(800);
  console.log("B1 (Plein champ) → ITP :", await itp.innerText(), "| dates :", await dates());
  // Choix manuel contraire : l'avis nomme l'incompatibilité, rien n'est écrasé.
  await itp.click();
  await page.getByRole("option", { name: /sous abri/ }).first().click();
  await page.waitForTimeout(500);
  console.log("choix manuel « sous abri » sur B1 → ITP :", await itp.innerText());
  console.log("  avis :", await page.getByRole("status").filter({ hasText: /conduit/ }).first().innerText().catch(() => "aucun"));
  await planche.selectOption(PLANCHES.sansType);
  await page.waitForTimeout(500);
  console.log("puis Planche 15 → ITP conservé :", await itp.innerText());
  console.log("  avis :", await page.getByRole("status").filter({ hasText: /conduit|itinéraire/ }).first().innerText().catch(() => "aucun"));
}

async function interventions(page) {
  console.log("\n===== cmv4z983m — Interventions : filtre d'année dans l'URL");
  const appels = [];
  page.on("request", (r) => { if (r.url().includes("/api/interventions?")) appels.push(new URL(r.url()).searchParams.get("annee")); });
  await page.goto(`${BASE}/interventions`, { waitUntil: "domcontentloaded" });
  const select = page.locator("select").filter({ hasText: String(new Date().getFullYear()) }).first();
  await select.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log("au départ : année", await select.inputValue(), "| URL", new URL(page.url()).search || "(vide)", "| appels", appels.join(","));
  appels.length = 0;
  await select.selectOption("2025");
  await page.waitForTimeout(1500);
  console.log("choix 2025 : URL", new URL(page.url()).search, "| appels", appels.join(","));
  appels.length = 0;
  await page.reload({ waitUntil: "domcontentloaded" });
  await select.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  console.log("après F5 : année", await select.inputValue(), "| URL", new URL(page.url()).search, "| appels", appels.join(","), "(attendu : 2025 seul)");
  // `?annee=2025&nouvelle=1` : la fiche s'ouvre, l'année reste.
  await page.goto(`${BASE}/interventions?annee=2025&nouvelle=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
  console.log("annee=2025&nouvelle=1 : fiche ouverte, URL nettoyée →", new URL(page.url()).search);
  await page.keyboard.press("Escape");
}

async function lune(page) {
  console.log("\n===== cmv4zb9yy — Calendrier lunaire depuis l'accueil v2 (intégration du 2026-10-12 après-midi : petite lune + page Météo)");
  await page.setViewportSize({ width: 1301, height: 933 });
  await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
  const rail = page.locator('aside[aria-label="Navigation principale"]');
  const petiteLune = page.locator('main a[aria-label^="Calendrier lunaire"]').first();
  await petiteLune.waitFor({ timeout: 30000 });
  console.log("1301 px : petite lune", JSON.stringify(await petiteLune.getAttribute("aria-label")), "| texte :", JSON.stringify((await petiteLune.innerText()).replace(/\s+/g, " ")));
  console.log("  rail sans entrée lunaire =", (await rail.getByRole("button", { name: /Calendrier lunaire/ }).count()) === 0, "| débordement :", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await petiteLune.click();
  await page.waitForURL((u) => u.pathname === "/meteo", { timeout: 30000 });
  const section = page.locator("#calendrier-lunaire");
  await section.waitFor({ timeout: 30000 });
  await page.locator('#calendrier-lunaire button[aria-label^="1 :"]').first().waitFor({ timeout: 30000 });
  console.log("  → /meteo", page.url().replace(BASE, ""), "| jours du mois :", await page.locator('#calendrier-lunaire button[aria-pressed]').count(), "| titre :", JSON.stringify(await section.locator("h2").innerText()));
  const box = await section.boundingBox();
  console.log("  section visible dans la fenêtre =", Boolean(box && box.y >= 0 && box.y < 933));
  // Palette : entrée « Calendrier lunaire » → page Météo.
  await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Demander ou chercher dans Gleba|Demander à Gleba/ }).first().click();
  const item = page.locator('[cmdk-item]', { hasText: "Calendrier lunaire" }).first();
  console.log("palette : entrée présente =", (await item.count()) > 0);
  await item.click();
  await page.waitForURL((u) => u.pathname === "/meteo" && u.hash === "#calendrier-lunaire", { timeout: 30000 });
  console.log("  → ", page.url().replace(BASE, ""));
  // Téléphone : disque seul dans la rangée d'en-tête, sans débordement ; carte Météo sans débordement.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
  await petiteLune.waitFor({ timeout: 30000 });
  const b375 = await petiteLune.boundingBox();
  console.log("375 px : petite lune visible =", await petiteLune.isVisible(), "| largeur", b375 && Math.round(b375.width), "px | rail visible =", await rail.isVisible().catch(() => false), "| débordement :", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await page.goto(`${BASE}/meteo#calendrier-lunaire`, { waitUntil: "domcontentloaded" });
  await page.locator('#calendrier-lunaire button[aria-pressed]').first().waitFor({ timeout: 30000 });
  console.log("  /meteo à 375 px : jours", await page.locator('#calendrier-lunaire button[aria-pressed]').count(), "| débordement :", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await page.setViewportSize({ width: 1301, height: 933 });
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
  const toutes = [culture, interventions, lune];
  const etapes = process.argv[3] ? toutes.filter((f) => process.argv[3].split(",").includes(f.name)) : toutes;
  for (const etape of etapes) {
    try { await etape(page, bloquees); } catch (e) { console.log("échec", etape.name, String(e).slice(0, 300)); }
  }
  console.log("\nécritures annulées :", bloquees.length ? bloquees : "aucune");
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
