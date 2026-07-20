const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  await page.goto("https://gleba.fr/login", { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill("demo@gleba.fr");
  await page.getByLabel(/mot de passe/i).fill("demo2026");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 }),
    page.getByRole("button", { name: /se connecter/i }).click(),
  ]);
  const rejectCookies = page.getByRole("button", { name: "Tout refuser" });
  if (await rejectCookies.isVisible().catch(() => false)) await rejectCookies.click();

  const targets = [
    ["/maraichage?tab=planification", "public/screenshots/gleba-planification-maraichage.png"],
    ["/maraichage/rotations", "public/screenshots/gleba-rotations-maraichage.png"],
    ["/verger", "public/screenshots/gleba-gestion-verger.png"],
    ["/elevage", "public/screenshots/gleba-gestion-elevage.png"],
    ["/elevage/animaux", "public/screenshots/gleba-gestion-troupeau.png"],
    ["/comptabilite", "public/screenshots/gleba-comptabilite.png"],
    ["/jardin", "public/screenshots/gleba-plan-jardin.png"],
    ["/tracabilite", "public/screenshots/gleba-registre-phytosanitaire.png"],
    ["/meteo", "public/screenshots/gleba-meteo-irrigation.png"],
    ["/maraichage/itps/calendrier", "public/screenshots/gleba-calendrier-lunaire.png"],
  ];

  for (const [path, output] of targets) {
    await page.goto(`https://gleba.fr${path}`, { waitUntil: "networkidle" });
    const closeTour = page.locator(".shepherd-cancel-icon");
    if (await closeTour.isVisible().catch(() => false)) {
      await closeTour.click();
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: output, type: "png", fullPage: false });
  }

  await browser.close();
})();
