// Preuve navigateur du ticket cmul80vst (2026-09-28) : le fond « Satellite IGN »
// choisi dans le contrôle Calques survit-il au rechargement ? Quatre façons de
// choisir (clic Playwright, element.click(), checked + change, clic sur le
// label). Compte démo public, aucune écriture en base.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/verif-navigateur-carte-fond.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = "https://gleba.fr";
async function etat(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".leaflet-control-layers");
    const base = c && c.querySelector(".leaflet-control-layers-base input:checked");
    return {
      fondCoche: base ? base.parentElement.textContent.trim() : null,
      overlays: c ? [...c.querySelectorAll(".leaflet-control-layers-overlays input:checked")].map(i => i.parentElement.textContent.trim()) : null,
      ls_fond: localStorage.getItem("gleba_carte_fond"),
      ls_overlays: localStorage.getItem("gleba_carte_overlays"),
    };
  });
}
async function ouvrirCarte(page) {
  await page.goto(`${BASE}/jardin/carte`, { waitUntil: "networkidle" });
  await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
  await page.waitForTimeout(1500);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1134, height: 734 }, locale: "fr-FR" });
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
  await ouvrirCarte(page);
  await page.evaluate(() => { localStorage.setItem("gleba_carte_fond", "OpenStreetMap"); });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log("état initial:", JSON.stringify(await etat(page)));

  const primitives = {
    A_clic_playwright: async () => {
      await page.hover(".leaflet-control-layers");
      await page.waitForTimeout(400);
      await page.click(".leaflet-control-layers-base label:has-text('Satellite IGN') input");
    },
    B_element_click: async () => {
      await page.evaluate(() => {
        const inp = [...document.querySelectorAll(".leaflet-control-layers-base input")].find(i => i.parentElement.textContent.includes("Satellite IGN"));
        inp.click();
      });
    },
    C_checked_puis_change: async () => {
      await page.evaluate(() => {
        const inp = [...document.querySelectorAll(".leaflet-control-layers-base input")].find(i => i.parentElement.textContent.includes("Satellite IGN"));
        inp.checked = true;
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      });
    },
    D_click_sur_label: async () => {
      await page.hover(".leaflet-control-layers");
      await page.waitForTimeout(400);
      await page.click(".leaflet-control-layers-base label:has-text('Satellite IGN')");
    },
  };
  for (const [nom, action] of Object.entries(primitives)) {
    await page.evaluate(() => { localStorage.setItem("gleba_carte_fond", "OpenStreetMap"); });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
    await page.waitForTimeout(1500);
    try { await action(); } catch (e) { console.log(nom, "ERREUR action:", e.message.slice(0, 120)); continue; }
    await page.waitForTimeout(800);
    const avant = await etat(page);
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
    await page.waitForTimeout(1500);
    const apres = await etat(page);
    console.log(nom, "| avant reload:", JSON.stringify(avant), "| après reload:", JSON.stringify(apres));
  }
  console.log("erreurs console:", consoleErreurs.length, consoleErreurs.slice(0, 5));
  await browser.close();
})().catch((e) => { console.error("ECHEC", e); process.exit(1); });
