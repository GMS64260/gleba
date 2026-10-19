// Preuve par l'effet du lot du 2026-10-19 sur gleba.fr, compte démo, lecture
// seule (la connexion écrit une ligne dans login_logs, à nettoyer ensuite).
//   1. `c80c804` : après une connexion par le formulaire (signIn sans
//      redirection, navigation côté client), OnboardingRedirect interroge
//      /api/onboarding sur la première vraie page. Avant le correctif, il
//      s'était verrouillé sur /login et ne l'appelait jamais.
//   2. `50dd184` : GET /api/cultures/irriguer renvoie `variete.nom`.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261019.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const resultats = [];
const ok = (nom, cond, detail) => { resultats.push({ nom, ok: !!cond, detail }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1446, height: 1037 }, locale: "fr-FR" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();

  // Appels GET /api/onboarding, horodatés par rapport à la sortie de /login.
  const appels = [];
  let connecte = false;
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname === "/api/onboarding" && req.method() === "GET") appels.push({ apresConnexion: connecte, page: page.url() });
  });

  // --- 1. Connexion par le formulaire, comme un inscrit par mot de passe
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@gleba.fr");
  await page.fill('input[type="password"]', "demo2026");
  let pleinsChargements = 0;
  page.on("load", () => { pleinsChargements += 1; });
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);
  connecte = true;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(4000);
  const apres = appels.filter((a) => a.apresConnexion);
  console.log("après connexion :", page.url(), `(${pleinsChargements} chargement(s) complet(s) après /login)`);
  ok("navigation post-connexion côté client (le cas qui cassait)", pleinsChargements === 0, `${pleinsChargements} chargement complet`);
  ok("GET /api/onboarding appelé après la connexion", apres.length >= 1, `${apres.length} appel(s), ${appels.length - apres.length} avant`);
  ok("compte démo (parcours fini) laissé sur sa page", !new URL(page.url()).pathname.startsWith("/onboarding"), page.url());

  // --- 2. Conseil d'irrigation : le nom de la variété est renvoyé
  const r = await ctx.request.get(`${BASE}/api/cultures/irriguer`);
  const j = await r.json().catch(() => ({}));
  const items = Array.isArray(j?.data) ? j.data : [];
  const avecVariete = items.filter((c) => c.variete);
  ok("GET /api/cultures/irriguer 200", r.status() === 200, `${items.length} cultures, ${avecVariete.length} avec variété`);
  ok("variete.nom présent", avecVariete.length > 0 && avecVariete.every((c) => Object.prototype.hasOwnProperty.call(c.variete, "nom")),
    avecVariete.slice(0, 2).map((c) => JSON.stringify(c.variete)).join(" "));

  await browser.close();
  const ko = resultats.filter((x) => !x.ok).length;
  console.log(ko ? `${ko} KO` : "TOUT OK");
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
