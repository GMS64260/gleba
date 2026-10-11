// Sonde QA cmv2r1v63 (2026-10-11) : après un refus de largeur de planche, la
// suggestion « Réduire à N rangs » appliquée est-elle celle envoyée ? Compte
// démo ; les POST /api/cultures sont interceptés : le premier reçoit le refus
// que renverrait le serveur, les suivants sont relevés puis annulés. La sonde
// n'écrit rien.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-rangs-suggestion.cjs [BASE] [PLANCHE_ID]
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const PLANCHE = process.argv[3] || "cms1i3lr5000q159dxjiwppbx"; // B1 de la démo

const REFUS = {
  error: "Largeur insuffisante : besoin de 0.70m, disponible 0.50m (manque 0.20m). Espacement entre rangs de l'itinéraire technique : 35 cm.",
  suggestions: ["Réduire à 2 rangs (au lieu de 3)"],
}

;(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 856, height: 1037 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
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

  const envois = [];
  await page.route("**/api/cultures", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    envois.push(JSON.parse(route.request().postData() || "{}"));
    if (envois.length === 1) {
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(REFUS) });
    }
    return route.abort();
  });

  await page.goto(`${BASE}/maraichage/cultures/new?plancheId=${PLANCHE}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox").filter({ hasText: /Rechercher une espèce/ }).click();
  await page.keyboard.type("Zinnia");
  await page.getByRole("option", { name: /Zinnia/ }).first().click();
  const rangs = page.locator('input[name="nbRangs"]');
  await page.waitForFunction(() => document.querySelector('input[name="nbRangs"]')?.value === "3", null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  console.log("rangs pré-remplis :", await rangs.inputValue());

  const enregistrer = page.getByRole("button", { name: /^Enregistrer/ });
  await enregistrer.click();
  await page.waitForTimeout(1500);
  const alerte = () => page.locator('form [role="alert"]').allInnerTexts();
  console.log("1er envoi : nbRangs =", envois[0]?.nbRangs, "| alerte :", await alerte());
  const boutons = await page.getByRole("button", { name: /Réduire à 2 rangs/ }).count();
  console.log("suggestion cliquable :", boutons > 0);

  if (boutons > 0) {
    await page.getByRole("button", { name: /Réduire à 2 rangs/ }).first().click();
  } else {
    await rangs.fill("2");
  }
  await page.waitForTimeout(500);
  console.log("champ après application :", await rangs.inputValue(), "| alerte :", await alerte(), "| info :", await page.locator('form [role="status"]').allInnerTexts());
  await enregistrer.click();
  await page.waitForTimeout(2000);
  console.log("2e envoi :", envois.length >= 2 ? `nbRangs = ${envois[1].nbRangs}` : "aucun", "| alerte :", await alerte());
  const messages = await page.locator("form p.text-destructive, form [id$='-form-item-message']").allInnerTexts();
  console.log("messages de champ :", messages.filter(Boolean));
  console.log("dates envoyées :", envois.map((e) => [e.dateSemis, e.datePlantation, e.dateRecolte].map((d) => d && String(d).slice(0, 10)).join(" / ")));
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
