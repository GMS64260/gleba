// Preuve par l'effet du lot du 2026-10-23 (campagne QA v8 du matin) sur
// gleba.fr, compte démo, en lecture seule : le plan n'est jamais enregistré
// et le dialogue de récolte se referme sans valider. La connexion écrit une
// ligne dans login_logs.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261023.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const res = [];
const ok = (nom, cond, detail) => { res.push({ nom, ok: !!cond }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };
const court = (x) => String(JSON.stringify(x)).slice(0, 220);

// Arbres de la campagne (compte démo) : 863 porte le porte-greffe du catalogue
// sans saisie libre ; 865 est une Mirabelle de Nancy (S33, 2 semaines) dont la
// récolte est datée du 10/07/2026.
const ARBRE_PG = 863;
const ARBRE_MIRABELLE = 865;
const PORTE_GREFFE = "Prunier Saint-Julien A";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris", viewport: { width: 1686, height: 951 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "demo@gleba.fr");
  await page.fill('input[type="password"]', "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);
  const get = async (u) => { const r = await ctx.request.get(`${BASE}${u}`); return { status: r.status(), json: await r.json().catch(() => null) }; };

  // --- API : ce que les écrans reçoivent
  const ar = await get("/api/arbres");
  const arbres = Array.isArray(ar.json) ? ar.json : [];
  const a863 = arbres.find((a) => a.id === ARBRE_PG);
  const a865 = arbres.find((a) => a.id === ARBRE_MIRABELLE);
  ok("GET /api/arbres : 863 porte porteGreffeRef « Prunier Saint-Julien A »", a863?.porteGreffeRef?.nom === PORTE_GREFFE, a863 ? court({ portGreffe: a863.portGreffe, ref: a863.porteGreffeRef }) : `${arbres.length} arbres`);
  ok("GET /api/arbres : 865 sert la période de récolte de sa variété (S33, 2 sem.)", a865?.periodeRecolteVariete?.semaineRecolte === 33, a865 ? court(a865.periodeRecolteVariete) : "arbre absent");
  const fiche = await get(`/api/arbres/${ARBRE_PG}`);
  ok("GET /api/arbres/863 : porteGreffeRef joint", fiche.json?.porteGreffeRef?.nom === PORTE_GREFFE, court(fiche.json?.porteGreffeRef));

  // --- cmvkp3kqc + cmvkpb0g9 : inspecteur du plan, avant et après rechargement
  const parcelle = a863?.parcelleGeoId;
  const lireInspecteur = async () => {
    await page.locator(`g[data-arbre-id="${ARBRE_PG}"]`).first().waitFor({ timeout: 30000 });
    await page.locator(`g[data-arbre-id="${ARBRE_PG}"] path`).nth(1).click({ force: true });
    const champ = page.locator("#inspecteur-porte-greffe");
    await champ.waitFor({ timeout: 15000 });
    // Le champ passe par « Chargement… » le temps de lire le catalogue.
    await page.waitForFunction(() => {
      const el = document.querySelector("#inspecteur-porte-greffe");
      return el && !(el instanceof HTMLInputElement && el.disabled);
    }, null, { timeout: 15000 });
    const valeur = await champ.evaluate((el) => (el instanceof HTMLInputElement ? el.value : el.textContent || ""));
    const texte = await page.locator("body").innerText();
    return { valeur: valeur.trim(), parDefaut: texte.includes("Par défaut"), sansAccent: texte.includes("Par defaut") };
  };
  if (parcelle) {
    await page.goto(`${BASE}/jardin?parcelle=${parcelle}`, { waitUntil: "domcontentloaded" });
    const avant = await lireInspecteur().catch((e) => ({ erreur: String(e).slice(0, 160) }));
    ok("plan : l'inspecteur affiche le porte-greffe de la fiche", avant.valeur?.includes(PORTE_GREFFE), court(avant));
    ok("plan : « Par défaut » accentué, aucun « Par defaut »", avant.parDefaut && !avant.sansAccent, court(avant));
    await page.reload({ waitUntil: "domcontentloaded" });
    const apres = await lireInspecteur().catch((e) => ({ erreur: String(e).slice(0, 160) }));
    ok("plan : même porte-greffe après rechargement", apres.valeur?.includes(PORTE_GREFFE), court(apres));
  } else {
    ok("plan : parcelle de l'arbre 863 connue", false, "parcelleGeoId absent");
  }

  // --- cmvkoxe5o : encart hors saison du formulaire de récolte (modification)
  await page.goto(`${BASE}/verger?tab=productions`, { waitUntil: "domcontentloaded" });
  const ligne = page.locator("tr", { hasText: "v8-Hélène 2310 prunier (3)" }).filter({ hasText: "10/07/2026" }).first();
  try {
    await ligne.waitFor({ timeout: 30000 });
    await ligne.locator('button[title^="Modifier"]').first().click();
    const dialogue = page.getByRole("dialog");
    await dialogue.waitFor({ timeout: 15000 });
    const texte = await dialogue.innerText();
    ok("récolte du 10/07 : l'encart cite la période de la Mirabelle de Nancy", /Mirabelle de Nancy/.test(texte) && /S33/.test(texte), texte.split("\n").find((l) => /habituellement/.test(l)) || "encart absent");
    await page.keyboard.press("Escape");
  } catch (e) {
    ok("récolte du 10/07 : dialogue de modification ouvert", false, String(e).slice(0, 160));
  }

  // --- libellés : page publique d'inscription
  await page.context().clearCookies();
  await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  const inscription = await page.locator("body").innerText();
  ok("inscription : « Déjà un compte ? » accentué", inscription.includes("Déjà un compte") && !inscription.includes("Deja un compte"), "");

  await browser.close();
  const ko = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - ko}/${res.length} OK`);
  process.exit(ko ? 1 : 0);
})();
