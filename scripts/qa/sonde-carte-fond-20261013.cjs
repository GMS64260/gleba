// Sonde du ticket cmv5cpu7q (2026-10-12, QA 1640x1024) : « Fond satellite perdu
// au rechargement ». Rejoue le parcours de la campagne (ouvrir le contrôle
// Calques par son bouton, choisir « Satellite IGN », attendre 5 s, F5) avec
// plusieurs gestes, Cadastre IGN déjà persisté comme dans le ticket.
// Avant le correctif (gleba-app:c369b25) : tout passe sauf I et I2 (clic forcé
// dans la même tâche que l'ouverture, annulé par la garde de Leaflet ; I vise le
// libellé, I2 le bouton radio) et P (`checked` posé puis seul `input` émis).
// Attendu après bascule : tout OK.
// Compte démo public, aucune écriture métier.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-carte-fond-20261013.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
async function etat(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".leaflet-control-layers");
    const base = c && c.querySelector(".leaflet-control-layers-base input:checked");
    return {
      fondCoche: base ? base.parentElement.textContent.trim() : null,
      overlays: c ? [...c.querySelectorAll(".leaflet-control-layers-overlays input:checked")].map(i => i.parentElement.textContent.trim()) : null,
      ls_fond: localStorage.getItem("gleba_carte_fond"),
      ls_overlays: localStorage.getItem("gleba_carte_overlays"),
      tuiles: [...document.querySelectorAll(".leaflet-tile-pane img")].slice(0, 1).map(i => i.src.replace(/^https?:\/\//, "").slice(0, 40)),
    };
  });
}
async function chargerCarte(page) {
  await page.goto(`${BASE}/jardin/carte`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
  await page.waitForTimeout(1500);
}
async function reinitialiser(page) {
  await page.evaluate(() => {
    localStorage.setItem("gleba_carte_fond", "OpenStreetMap");
    localStorage.setItem("gleba_carte_overlays", JSON.stringify(["Cadastre IGN"]));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
  await page.waitForTimeout(1500);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1640, height: 1024 }, locale: "fr-FR" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  const consoleErreurs = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErreurs.push(m.text().slice(0, 160)); });
  await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  } catch {
    console.log("auto-démo non déclenchée, saisie manuelle");
    await page.fill('input[type="email"]', "demo@gleba.fr");
    await page.fill('input[type="password"]', "demo2026");
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
      page.keyboard.press("Enter"),
    ]);
  }
  console.log("après login:", page.url());
  await chargerCarte(page);
  await reinitialiser(page);
  console.log("état initial:", JSON.stringify(await etat(page)));

  // Le bouton « Layers » disparaît dès que la souris le survole (le contrôle
  // s'ouvre au survol) : un clic Playwright ordinaire expire, un clic forcé
  // atterrit sur la liste ouverte, comme le ferait un automate pressé.
  const toggle = "a.leaflet-control-layers-toggle";
  const primitives = {
    E_bouton_puis_texte: async () => {
      await page.click(toggle, { force: true });
      await page.getByText("Satellite IGN", { exact: true }).click();
    },
    F_bouton_puis_check_role: async () => {
      await page.click(toggle, { force: true });
      await page.getByRole("radio", { name: "Satellite IGN" }).check();
    },
    G_survol_puis_label: async () => {
      await page.hover(".leaflet-control-layers");
      await page.waitForTimeout(300);
      await page.click(".leaflet-control-layers-base label:has-text('Satellite IGN')");
    },
    H_clavier: async () => {
      await page.focus(toggle);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      await page.getByRole("radio", { name: "OpenStreetMap" }).focus();
      await page.keyboard.press("ArrowDown");
    },
    I_bouton_puis_label_force_immediat: async () => {
      await page.click(toggle, { noWaitAfter: true });
      await page.click(".leaflet-control-layers-base label:has-text('Satellite IGN')", { force: true, noWaitAfter: true });
    },
    I2_bouton_puis_input_force_immediat: async () => {
      await page.click(toggle, { noWaitAfter: true });
      await page.click(".leaflet-control-layers-base label:has-text('Satellite IGN') input", { force: true, noWaitAfter: true });
    },
    P_checked_puis_input_event: async () => {
      await page.evaluate(() => {
        const inp = [...document.querySelectorAll(".leaflet-control-layers-base input")].find(i => i.parentElement.textContent.includes("Satellite IGN"));
        inp.checked = true;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    J_bouton_puis_input_evaluate_click: async () => {
      await page.click(toggle, { force: true });
      await page.evaluate(() => {
        const inp = [...document.querySelectorAll(".leaflet-control-layers-base input")].find(i => i.parentElement.textContent.includes("Satellite IGN"));
        inp.click();
      });
    },
  };
  for (const [nom, action] of Object.entries(primitives)) {
    await reinitialiser(page);
    try { await action(); } catch (e) { console.log(nom, "ERREUR action:", e.message.slice(0, 160)); continue; }
    await page.waitForTimeout(300);
    const tot = await etat(page);
    await page.waitForTimeout(5000);
    const avant = await etat(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
    await page.waitForTimeout(2000);
    const apres = await etat(page);
    const verdict = apres.fondCoche === "Satellite IGN" ? "OK" : "PERDU";
    console.log(`${nom} [${verdict}]`, "\n   t+0,3s:", JSON.stringify(tot), "\n   t+5s  :", JSON.stringify(avant), "\n   reload:", JSON.stringify(apres));
  }
  console.log("erreurs console:", consoleErreurs.length, consoleErreurs.slice(0, 5));
  await browser.close();
})().catch((e) => { console.error("ECHEC", e); process.exit(1); });
