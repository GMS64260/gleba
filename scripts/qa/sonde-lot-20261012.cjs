// Sonde du lot du 2026-10-12 : trois signalements QA du matin (cmv4z6yhg ITP
// proposé contre le type de planche, cmv4z983m filtre d'année des
// Interventions dans l'URL, cmv4zb9yy calendrier lunaire dans l'accueil v2).
// Compte démo, lecture seule : toute écriture d'API est interceptée et annulée.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261012.cjs [BASE] [etapes] [dossier captures]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const fs = require("node:fs");
const path = require("node:path");
const CAPTURES = process.argv[4] || null;
if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });
async function capture(page, nom) {
  if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, nom + ".png"), fullPage: false, animations: "disabled" });
}
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
  console.log("\n===== cmv4zb9yy — Calendrier lunaire : barre commune sur PC, palette et Météo sur téléphone");
  const barreCommune = page.locator("header[data-app-topbar]");
  const rail = page.locator('aside[aria-label="Navigation principale"]');
  const petiteLune = barreCommune.locator('a[aria-label^="Calendrier lunaire"]').first();
  const section = page.locator("#calendrier-lunaire");
  const deborde = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const actionnableDansFenetre = async largeur => {
    const geometrie = await section.evaluate(e => {
      const rect = element => { const r=element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom }; };
      const section=rect(e), barre=document.querySelector("[data-app-topbar]"), nav=document.querySelector("[data-navigation-basse]");
      const haut=barre ? Math.max(0,barre.getBoundingClientRect().bottom) : 0;
      const bas=nav && nav.getBoundingClientRect().height > 0 ? Math.min(innerHeight,nav.getBoundingClientRect().top) : innerHeight;
      const jours=[...e.querySelectorAll("button[aria-pressed]")].map(bouton => {
        const r=rect(bouton),x=r.x+r.width/2,y=r.y+r.height/2;
        return { jour:bouton.getAttribute("aria-label"),rect:r,centreVisible:x>0 && x<innerWidth && y>haut && y<bas && document.elementFromPoint(x,y)?.closest("button[aria-pressed]")===bouton };
      });
      return { section,hautUtile:haut,basUtile:bas,intersection:section.bottom>haut && section.y<bas,joursVisibles:jours.filter(j=>j.centreVisible) };
    });
    console.log("géométrie calendrier",largeur,JSON.stringify(geometrie));
    return geometrie.intersection && geometrie.joursVisibles.length>0;
  };
  const calendrierPret = () => page.locator('#calendrier-lunaire button[aria-pressed]').first().waitFor({ timeout: 30000 });
  // Une vraie navigation recharge SessionProvider : attendre sa requête armée
  // avant goto puis deux frames, plutôt que réessayer des clics d'hydratation.
  async function accueilPret() {
    const auth = page.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/session" && r.request().method() === "GET", { timeout: 30000 }).then(async r => {
      const erreur = await r.finished(); if (erreur) throw erreur;
      if (r.status() !== 200 || (await r.json())?.user?.email?.toLowerCase() !== "demo@gleba.fr") throw new Error("Session autre que la démonstration : arrêt");
    }).catch(e => ({ erreur:e.message }));
    await page.goto(`${BASE}/aujourdhui`, { waitUntil: "domcontentloaded" });
    const resultat = await auth;
    if (resultat?.erreur) throw new Error(resultat.erreur);
    await barreCommune.waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("button", { name: "Menu du compte", exact: true }).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function paletteLunaire() {
    await barreCommune.getByRole("button", { name: /Demander ou chercher dans Gleba/ }).click();
    const item = page.locator('[cmdk-item]', { hasText: "Calendrier lunaire" }).first();
    await item.waitFor({ state: "visible", timeout: 30000 });
    return item;
  }

  await page.setViewportSize({ width: 1301, height: 933 });
  await accueilPret();
  await petiteLune.waitFor({ state: "visible", timeout: 30000 });
  console.log("1301 px : lune dans barre commune =", await petiteLune.isVisible(), "| rail sans entrée lunaire =", (await rail.getByRole("link", { name: /Calendrier lunaire/ }).count()) === 0, "| débordement :", await deborde());
  console.log("  lune :", JSON.stringify(await petiteLune.getAttribute("aria-label")));
  await capture(page, "lune-barre-1301");
  await petiteLune.click();
  await page.waitForURL(u => u.pathname === "/meteo" && u.hash === "#calendrier-lunaire", { timeout: 30000 });
  await calendrierPret();
  console.log("  → /meteo", page.url().replace(BASE, ""), "| jours du mois :", await section.locator('button[aria-pressed]').count(), "| titre :", JSON.stringify(await section.locator("h2").innerText()));
  console.log("  calendrier actionnable dans la fenêtre =", await actionnableDansFenetre(1301));
  await capture(page, "lune-calendrier-1301");

  await accueilPret();
  const itemBureau = await paletteLunaire();
  console.log("palette bureau : entrée présente =", await itemBureau.isVisible());
  await itemBureau.click();
  await page.waitForURL(u => u.pathname === "/meteo" && u.hash === "#calendrier-lunaire", { timeout: 30000 });
  console.log("palette bureau →", page.url().replace(BASE, ""));

  // Le header mobile reste sur une rangée : lune dédiée cachée, accès complet
  // par la palette et par Plus > Météo. Aucun disque supplémentaire attendu.
  await page.setViewportSize({ width: 375, height: 812 });
  await accueilPret();
  const compact = await barreCommune.isVisible() && !await petiteLune.isVisible() && !await rail.isVisible();
  const itemMobile = await paletteLunaire();
  const presentMobile = await itemMobile.isVisible();
  await capture(page, "lune-palette-375");
  await itemMobile.click();
  await page.waitForURL(u => u.pathname === "/meteo" && u.hash === "#calendrier-lunaire", { timeout: 30000 });
  await calendrierPret();
  console.log("375 px : accès lunaire par palette =", presentMobile, "| URL", page.url().replace(BASE, ""), "| en-tête compact =", compact, "| calendrier actionnable =", await actionnableDansFenetre(375), "| débordement :", await deborde());
  await capture(page, "lune-calendrier-375");
  await page.getByRole("button", { name: "Plus de pages", exact: true }).click();
  const plus = page.getByRole("dialog", { name: "Toutes les pages" });
  const meteo = plus.getByRole("link", { name: "Météo", exact: true });
  await meteo.waitFor({ state: "visible" });
  console.log("375 px : Plus propose Météo =", await meteo.isVisible(), "| destination", await meteo.getAttribute("href"));
  await capture(page, "lune-plus-meteo-375");
  await meteo.click();
  await page.waitForURL(u => u.pathname === "/meteo" && !u.hash, { timeout: 30000 });
  await plus.waitFor({ state: "hidden" });
  await calendrierPret();
  console.log("  /meteo à 375 px : jours", await section.locator('button[aria-pressed]').count(), "| débordement :", await deborde());
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
    try { await etape(page, bloquees); } catch (e) { console.log("échec", etape.name, String(e)); await capture(page, "echec-" + etape.name).catch(() => {}); }
  }
  console.log("\nécritures annulées :", bloquees.length ? bloquees : "aucune");
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
