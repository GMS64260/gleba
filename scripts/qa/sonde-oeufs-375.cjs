// Sonde QA cmv298ouh (2026-10-10) : le formulaire « Saisie rapide » œufs déborde-t-il à
// 375 px, et `min-width:0` sur le <form> suffit-il ? Compte démo public,
// aucune écriture en base.
//   PLAYWRIGHT_DIR=/var/www/escalier OUT_DIR=audit/captures node scripts/qa/sonde-oeufs-375.cjs [BASE] [mobile|desktop]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const MODE = process.argv[3] || "desktop";
const OUT = process.env.OUT_DIR || __dirname;
const DLG = '[role="dialog"]:has(form)';

async function mesurer(page, etiquette) {
  const r = await page.evaluate((sel) => {
    const dlg = document.querySelector(sel);
    if (!dlg) return { erreur: "pas de dialog" };
    const vw = document.documentElement.clientWidth;
    const b = dlg.getBoundingClientRect();
    const form = dlg.querySelector("form");
    const fb = form.getBoundingClientRect();
    const larges = [];
    for (const el of dlg.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 0.5 || r.right > vw + 0.5 || r.left < -0.5) {
        larges.push({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === "string" ? el.className : "").slice(0, 60), left: Math.round(r.left), width: Math.round(r.width) });
      }
    }
    return {
      vw,
      dialog: { left: Math.round(b.left), width: Math.round(b.width), sw: dlg.scrollWidth, cw: dlg.clientWidth, minW: getComputedStyle(form).minWidth },
      form: { left: Math.round(fb.left), width: Math.round(fb.width), sw: form.scrollWidth },
      larges: larges.slice(0, 12),
    };
  }, DLG);
  console.log(`--- ${etiquette}`);
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${OUT}/oeufs-375-${MODE}-${etiquette}.png` });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext(
    MODE === "mobile"
      ? { viewport: { width: 375, height: 812 }, locale: "fr-FR", isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 375, height: 812 }, locale: "fr-FR" },
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  } catch {
    await page.fill('input[type="email"]', "demo@gleba.fr");
    await page.fill('input[type="password"]', "demo2026");
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
      page.keyboard.press("Enter"),
    ]);
  }
  await page.goto(`${BASE}/elevage?tab=production`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button:has-text("Saisie rapide")', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Saisie rapide")');
  await page.waitForSelector(DLG, { timeout: 10000 });
  await page.waitForTimeout(500);
  await mesurer(page, "sans-lot");
  await page.click(`${DLG} [role="combobox"]`);
  await page.waitForSelector('[role="option"]', { timeout: 5000 });
  const opts = await page.$$eval('[role="option"]', (o) => o.map((e) => e.textContent.trim()));
  // Libellé de longueur comparable au ticket : « Julien v7 — 30 pondeuses (33 Poule pondeuse) »
  const cible = opts.find((t) => /^Pondeuses 2026/.test(t)) || opts.find((t) => !/Sélectionner/i.test(t));
  console.log("lot choisi:", cible);
  if (cible) await page.click(`[role="option"]:has-text("${cible.slice(0, 20)}")`);
  await page.waitForTimeout(500);
  await mesurer(page, "lot-court");
  // Même chose avec le plus long libellé disponible.
  await page.click(`${DLG} [role="combobox"]`);
  await page.waitForSelector('[role="option"]', { timeout: 5000 });
  const long = opts.filter((t) => !/Sélectionner/i.test(t)).sort((a, b) => b.length - a.length)[0];
  console.log("lot long:", long);
  await page.click(`[role="option"]:has-text("${long.slice(0, 20)}")`);
  await page.waitForTimeout(500);
  await mesurer(page, "lot-long");
  // Correctif candidat : min-width:0 sur le <form> (item de grille).
  await page.evaluate((sel) => { document.querySelector(sel).querySelector("form").style.minWidth = "0"; }, DLG);
  await page.waitForTimeout(300);
  await mesurer(page, "lot-long-minw0");
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
