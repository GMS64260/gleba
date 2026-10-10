// Sonde QA cmv29egw6 (2026-10-10) : rappel planifié saisi en dernier puis Enregistrer
// direct, sur un lot, fenêtre 375 px. Compte démo ; les soins créés sont
// supprimés à la fin (sonde nommée « QA sonde rappel »).
// ÉCRIT sur le compte démo (soins « QA sonde rappel ») puis supprime ce qu'elle a créé ; ne pas lancer pendant une campagne QA.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-soin-rappel.cjs [BASE] [mobile|desktop] [variantes,séparées,par,virgule]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const MODE = process.argv[3] || "desktop";
const VARIANTES = (process.argv[4] || "A-fill,B-clavier,E-slashes,F-fill-enter,G-fill-souris").split(",");
const DLG = '[role="dialog"]:has(form)';
const MARQUE = "QA sonde rappel (à supprimer)";

function champApresLabel(page, texte) {
  return page.locator(`${DLG} label`, { hasText: texte }).first().locator("xpath=following-sibling::*[self::input or self::select][1]");
}

async function scenario(page, variante) {
  console.log(`\n===== variante ${variante} (${MODE})`);
  const posts = [];
  const onReq = (r) => { if (r.url().includes("/api/elevage/soins") && r.method() === "POST") posts.push(r.postData()); };
  page.on("request", onReq);
  await page.goto(`${BASE}/elevage?tab=alimentation&sub=soins`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button:has-text("Nouveau soin")', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.click('button:has-text("Nouveau soin")');
  await page.waitForSelector(DLG, { timeout: 10000 });
  await page.click(`${DLG} button:text-is("Lot")`);
  const selects = page.locator(`${DLG} select`);
  await selects.nth(0).selectOption({ index: 1 });
  await selects.nth(1).selectOption("Vermifuge");
  await page.fill(`${DLG} input[name="dateSoin"]`, "2026-10-10");
  await page.fill(`${DLG} input[placeholder="Libellé produit (si saisie libre)"]`, `${MARQUE} ${variante}`);
  await champApresLabel(page, "Dose").fill("1 ml");
  await champApresLabel(page, "Délai d'attente viande").fill("14");
  await champApresLabel(page, "Délai d'attente œufs").fill("3");
  const fait = page.locator(`${DLG} #fait`);
  const faitAvant = await fait.getAttribute("aria-checked");
  if (faitAvant !== "true") await fait.click();
  const rappel = page.locator(`${DLG} input[name="datePrevue"]`);
  const bouton = page.locator(`${DLG} button[type="submit"]`, { hasText: "Enregistrer" });
  const attenteReponse = page.waitForResponse((r) => r.url().includes("/api/elevage/soins") && r.request().method() === "POST", { timeout: 15000 });
  if (variante === "A-fill") {
    await rappel.fill("2026-10-14");
    await bouton.click();
  } else if (variante === "B-clavier") {
    await rappel.click();
    await page.keyboard.type("14102026");
    console.log("valeur DOM après frappe:", await rappel.inputValue());
    await bouton.click();
  } else if (variante === "E-slashes") {
    await rappel.click();
    await page.keyboard.type("14/10/2026");
    console.log("valeur DOM après frappe:", await rappel.inputValue());
    await bouton.click();
  } else if (variante === "F-fill-enter") {
    await rappel.fill("2026-10-14");
    await rappel.press("Enter");
  } else if (variante === "H-setter-change") {
    // Outil qui pose la valeur sans que React le voie (setter d'instance + change).
    await rappel.evaluate((el) => { el.value = "2026-10-14"; el.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.waitForTimeout(2500);
    await bouton.hover();
    await page.waitForTimeout(500);
    console.log("valeur DOM avant clic:", await rappel.inputValue());
    await bouton.click();
  } else if (variante === "I-setter-input-attente") {
    await rappel.evaluate((el) => { el.value = "2026-10-14"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitForTimeout(6000);
    console.log("valeur DOM avant clic:", await rappel.inputValue());
    await bouton.click();
  } else if (variante === "J-focus-clavier") {
    await rappel.focus();
    await page.keyboard.type("14102026");
    console.log("valeur DOM après frappe:", await rappel.inputValue(), "badInput:", await rappel.evaluate((e) => e.validity.badInput));
    await bouton.click();
  } else if (variante === "K-clic-gauche-clavier") {
    const b = await rappel.boundingBox();
    await page.mouse.click(b.x + 8, b.y + b.height / 2);
    await page.keyboard.type("14102026");
    console.log("valeur DOM après frappe:", await rappel.inputValue(), "badInput:", await rappel.evaluate((e) => e.validity.badInput));
    await bouton.click();
  } else if (variante === "G-fill-souris") {
    await rappel.fill("2026-10-14");
    const b = await bouton.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  const r = await attenteReponse;
  const json = await r.json().catch(() => null);
  console.log("fait coché avant:", faitAvant, "| POST:", posts.map((p) => { try { const j = JSON.parse(p); return { datePrevue: j.datePrevue, date: j.date, fait: j.fait, lotId: j.lotId }; } catch { return p; } }));
  console.log("statut:", r.status(), "soin:", json?.soin?.id ?? JSON.stringify(json).slice(0, 160), "rappel:", json?.rappel?.id ?? null);
  page.off("request", onReq);
  await page.waitForTimeout(800);
  const trouves = await page.evaluate(async (marque) => {
    const res = await fetch("/api/elevage/soins?annee=all&limit=1000");
    const j = await res.json();
    const liste = j.data ?? j.soins ?? j;
    return liste.filter((s) => (s.produit || "").includes(marque)).map((s) => ({ id: s.id, date: s.date, datePrevue: s.datePrevue, fait: s.fait }));
  }, MARQUE);
  console.log("soins en base:", JSON.stringify(trouves));
  for (const s of trouves) {
    const st = await page.evaluate(async (id) => (await fetch(`/api/elevage/soins?id=${id}`, { method: "DELETE" })).status, s.id);
    console.log("suppression", s.id, "→", st);
  }
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
  for (const v of VARIANTES) {
    try { await scenario(page, v); } catch (e) { console.log("échec variante", v, String(e).slice(0, 300)); }
  }
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
