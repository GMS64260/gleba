// Preuve par l'effet du lot du 2026-10-19 (après-midi) sur gleba.fr, compte
// démo, lecture seule (la connexion écrit une ligne dans login_logs).
//   1. cmv9dy2ow : une ponte faite pendant un délai d'attente œufs reste
//      écartée pour toujours. Le tableau « Traçabilité du stock » annonçait
//      « vendables dès le <date passée> » ; il nomme désormais la fin du délai
//      et dit « jamais vendables ». La démo porte le cas : ponte du 28/09 sur
//      le lot 54, soin fait le 28/09 avec fin d'attente œufs au 01/10.
//   2. cmv9e1u2r : chaque action de ligne de la table des animaux (et des
//      lots) expose un nom accessible qui nomme le geste et la ligne.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261019b.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const resultats = [];
const ok = (nom, cond, detail) => { resultats.push({ nom, ok: !!cond, detail }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };

// Nom accessible approché (aria-label, aria-labelledby, texte, title) : suffit
// à distinguer un bouton-icône muet d'un bouton nommé.
const nomsActions = (racine) => racine.evaluateAll((els) => els.map((el) => {
  const ref = el.getAttribute("aria-labelledby")
  const parRef = ref ? ref.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ") : ""
  return (el.getAttribute("aria-label") || parRef || el.textContent || el.getAttribute("title") || "").trim()
}));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1446, height: 1037 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@gleba.fr");
  await page.fill('input[type="password"]', "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);

  // --- 1. Œufs écartés par un délai d'attente
  const r = await ctx.request.get(`${BASE}/api/elevage/stock-oeufs`);
  const j = await r.json().catch(() => ({}));
  const lots = Array.isArray(j?.data) ? j.data : [];
  const bloques = lots.filter((l) => l.statut === "bloque_attente_veto");
  ok("API : au moins un lot démo écarté par un délai d'attente", bloques.length > 0, `${bloques.length} lot(s) sur ${lots.length}`);
  ok("API : le lot écarté porte la fin du délai (finAttenteVeto)", bloques.length > 0 && bloques.every((l) => l.finAttenteVeto), bloques.map((l) => `${l.datePonte?.slice(0, 10)} fin ${l.finAttenteVeto ?? "∅"}`).join(", "));

  await page.goto(`${BASE}/elevage?tab=production`, { waitUntil: "networkidle" });
  const tableStock = page.locator("table").filter({ has: page.locator("th", { hasText: "Limite vente" }) }).first();
  await tableStock.waitFor({ timeout: 20000 });
  const lignes = tableStock.locator("tbody tr").filter({ hasText: /délai véto/i });
  const n = await lignes.count();
  const textes = [];
  for (let i = 0; i < n; i++) textes.push((await lignes.nth(i).innerText()).replace(/\s+/g, " "));
  ok("écran : ligne écartée affichée", n > 0, textes[0]);
  ok("écran : plus de « vendables dès le » sur une ponte écartée", n > 0 && textes.every((t) => !/vendables dès le/i.test(t)), "");
  ok("écran : la ligne dit « jamais vendables » et la fin du délai", n > 0 && textes.every((t) => /jamais vendables/i.test(t) && /fin le \d{2}\/\d{2}\/\d{4}/.test(t)), "");
  const limites = [];
  for (let i = 0; i < n; i++) limites.push((await lignes.nth(i).locator("td").nth(3).innerText()).trim());
  ok("écran : pas de limite de vente sur une ponte écartée", n > 0 && limites.every((x) => x === "-"), limites.join(", "));

  // --- 2. Actions de ligne nommées (animaux, puis lots)
  await page.goto(`${BASE}/elevage?tab=animaux`, { waitUntil: "networkidle" });
  const tableAnimaux = page.locator("table").filter({ has: page.locator("th", { hasText: "Identifiant" }) }).first();
  await tableAnimaux.waitFor({ timeout: 20000 });
  const actionsAnimaux = tableAnimaux.locator("tbody tr td:last-child").locator("button, a");
  const nomsA = await nomsActions(actionsAnimaux);
  const mutsA = nomsA.filter((nom) => !nom || nom === "×");
  ok("animaux : actions de ligne trouvées", nomsA.length > 0, `${nomsA.length} action(s)`);
  ok("animaux : aucune action sans nom", nomsA.length > 0 && mutsA.length === 0, `${mutsA.length} muette(s) ; ex. ${[...new Set(nomsA.map((x) => x.split(" ")[0]))].join(", ")}`);
  ok("animaux : « Vendre <animal> » joignable par son nom", (await page.getByRole("button", { name: /^Vendre \S/ }).count()) > 0, nomsA.find((x) => x.startsWith("Vendre")));

  await page.goto(`${BASE}/elevage?tab=animaux&sub=lots`, { waitUntil: "networkidle" });
  const tableLots = page.locator("table").filter({ has: page.locator("tbody a[href^='/elevage/lots/']") }).first();
  await tableLots.waitFor({ timeout: 20000 });
  const nomsL = await nomsActions(tableLots.locator("tbody tr td:last-child").locator("button"));
  const mutsL = nomsL.filter((nom) => !nom);
  ok("lots : aucune action sans nom", nomsL.length > 0 && mutsL.length === 0, `${nomsL.length} action(s), ${mutsL.length} muette(s) ; ex. ${nomsL[0]}`);

  await browser.close();
  const ko = resultats.filter((x) => !x.ok).length;
  console.log(ko ? `${ko} KO` : "TOUT OK");
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
