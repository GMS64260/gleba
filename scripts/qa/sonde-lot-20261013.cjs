// Preuve par l'effet du lot du 2026-10-13 (tickets cmv5jwqub semaine du
// calendrier, cmv5jxvcy accents Économie, cmv5jfsol effectif pondeur) sur
// gleba.fr, compte démo, lecture seule (aucune écriture d'API).
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261013.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const resultats = [];
const ok = (nom, cond, detail) => { resultats.push({ nom, ok: !!cond, detail }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1446, height: 1037 }, locale: "fr-FR" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  // Garde-fou : toute écriture d'API est bloquée.
  await page.route(/\/api\//, (route) => { const m = route.request().method(); if (m !== "GET" && m !== "HEAD" && !route.request().url().includes("/api/auth/")) { console.log("ECRITURE BLOQUEE", m, route.request().url()); return route.abort(); } return route.continue(); });
  await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
  try { await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); }
  catch { await page.fill('input[type="email"]', "demo@gleba.fr"); await page.fill('input[type="password"]', "demo2026");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]); }
  console.log("après login:", page.url());

  // --- Calendrier : semaine dans l'URL
  await page.goto(`${BASE}/elevage?tab=calendrier`, { waitUntil: "domcontentloaded" });
  // Le bouton-titre de la semaine (classe min-w-[180px]) ; un filtre sur le
  // texte attrapait le sélecteur d'année masqué (« 2026 »).
  const titre = page.locator("button.min-w-\\[180px\\]").first();
  await titre.waitFor({ timeout: 30000 });
  ok("calendrier : semaine courante au départ", (await titre.textContent()).includes("Cette semaine"), await titre.textContent());
  await page.getByRole("button", { name: "Semaine suivante" }).click();
  await page.waitForTimeout(500);
  const url1 = new URL(page.url());
  ok("calendrier : URL porte semaine= après « suivante »", /^\d{4}-\d{2}-\d{2}$/.test(url1.searchParams.get("semaine") || "") && url1.searchParams.get("tab") === "calendrier", url1.search);
  await page.reload({ waitUntil: "domcontentloaded" });
  await titre.waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  ok("calendrier : « Semaine prochaine » conservée après F5", (await titre.textContent()).includes("Semaine prochaine"), await titre.textContent());
  await page.getByRole("button", { name: "Semaine précédente" }).click();
  await page.getByRole("button", { name: "Semaine précédente" }).click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await titre.waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  ok("calendrier : « Semaine dernière » conservée après F5", (await titre.textContent()).includes("Semaine dernière"), new URL(page.url()).search);
  await titre.click();
  await page.waitForTimeout(500);
  ok("calendrier : « Cette semaine » retire le paramètre", !new URL(page.url()).searchParams.has("semaine"), new URL(page.url()).search);
  await page.goto(`${BASE}/elevage?tab=calendrier&semaine=2026-13-45`, { waitUntil: "domcontentloaded" });
  await titre.waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  ok("calendrier : paramètre invalide → semaine courante", (await titre.textContent()).includes("Cette semaine"), await titre.textContent());

  // --- Économie : accents
  await page.goto(`${BASE}/elevage/economie`, { waitUntil: "domcontentloaded" });
  const fil = page.locator('nav[aria-label="Breadcrumb"]');
  await fil.waitFor({ timeout: 30000 });
  const filTexte = (await fil.textContent()) || "";
  ok("économie : fil d'Ariane « Économie »", filTexte.includes("Économie") && !/Economie/.test(filTexte), filTexte.trim());
  const annee = new Date().getFullYear();
  const ateliers = [];
  for (const a of [annee, annee - 1]) {
    const r = await page.request.get(`${BASE}/api/elevage/analyse-couts?annee=${a}`);
    if (r.ok()) { const j = await r.json(); ateliers.push(...(j.ateliers || []).map((x) => x.libelle)); }
  }
  const ventes = ateliers.filter((l) => /^Ventes /.test(l));
  ok("économie : libellés « Ventes … » accentués (API)", ventes.length === 0 || ventes.every((l) => !/oeuf|gelee/.test(l)), ventes.join(" | ") || "aucun atelier Ventes sur deux ans");

  // --- Pondeuses : champ servi par /api/elevage/lots et /api/elevage/stats
  const lots = await page.request.get(`${BASE}/api/elevage/lots`).then((r) => r.json());
  const pondeurs = (lots.data || []).filter((l) => ["oeufs", "mixte"].includes(l.especeAnimale?.production));
  ok("pondeuses : effectifPondeuses présent sur les lots pondeurs", pondeurs.length > 0 && pondeurs.every((l) => typeof l.effectifPondeuses === "number" && l.effectifPondeuses <= (l.effectifCalcule ?? l.quantiteActuelle)), pondeurs.map((l) => `${l.nom}: ${l.effectifPondeuses}/${l.effectifCalcule}`).join(" | "));
  const autres = (lots.data || []).filter((l) => !["oeufs", "mixte"].includes(l.especeAnimale?.production));
  ok("pondeuses : null hors espèce pondeuse", autres.every((l) => l.effectifPondeuses === null), `${autres.length} lot(s)`);
  const stats = await page.request.get(`${BASE}/api/elevage/stats?annee=${annee}`).then((r) => r.json());
  const somme = pondeurs.filter((l) => l.statut === "actif").reduce((s, l) => s + l.effectifPondeuses, 0);
  ok("pondeuses : nbPondeuses de /stats = somme des effectifs pondeurs des lots actifs", stats.stats?.nbPondeuses === somme, `${stats.stats?.nbPondeuses} vs ${somme}`);

  await browser.close();
  const ko = resultats.filter((r) => !r.ok).length;
  console.log(`\n${resultats.length - ko}/${resultats.length} vérifications OK`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ECHEC", e); process.exit(1); });
