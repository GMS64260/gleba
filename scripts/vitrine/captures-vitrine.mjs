// Captures de la vitrine publique (gleba.fr) prises sur le compte démo, pour
// illustrer la page d'accueil et les pages métier avec l'interface réelle.
// À rejouer après chaque évolution visible de l'application.
//
// Compte démo public uniquement (identifiants publics de LoginForm.tsx),
// aucune écriture en base. Les PNG bruts vont dans DOSSIER, les WebP publiés
// dans public/screenshots/vitrine-*.webp (relire chaque image avant commit :
// le dépôt est public).
//
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/vitrine/captures-vitrine.mjs [BASE] [DOSSIER]
//   BASE par défaut : https://gleba.fr ; DOSSIER par défaut : audit/captures/vitrine-<date>
//   CAPTURES_SEULES=plan-bureau,meteo-bureau pour n'en rejouer que certaines.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? "/var/www/escalier";
const { chromium } = await import(pathToFileURL(`${PLAYWRIGHT_DIR}/node_modules/playwright/index.mjs`).href);

const BASE = process.argv[2] ?? "https://gleba.fr";
const jour = new Date().toISOString().slice(0, 10);
const OUT = resolve(process.argv[3] ?? `audit/captures/vitrine-${jour}`);
const PUBLIC = resolve("public/screenshots");
// CAPTURES_SEULES=nom1,nom2 pour ne rejouer que certaines captures.
const SEULES = process.env.CAPTURES_SEULES?.split(",").filter(Boolean);
mkdirSync(OUT, { recursive: true });

// [nom publié, chemin, vue, attente supplémentaire en ms, découpe en px CSS,
//  texte d'un onglet à cliquer avant la capture]
// La découpe écarte ce qui ne sert pas la page (barre d'outils, tuile sans
// libellé, lignes de test de la démo) ; sans découpe, la fenêtre entière est
// publiée. L'écran Aujourd'hui de la vitrine est un aperçu HTML
// (src/components/seo/ApercuAujourdhui.tsx), pas une capture.
const CAPTURES = [
  ["plan-bureau", "/jardin", "bureau", 6000, { x: 216, y: 166, width: 922, height: 554 }],
  ["verger-bureau", "/verger", "bureau", 3000],
  ["meteo-bureau", "/meteo", "bureau", 6000, { x: 216, y: 100, width: 1224, height: 560 }],
  ["elevage-bureau", "/elevage", "bureau", 4000, { x: 216, y: 440, width: 1224, height: 460 }],
  ["comptabilite-bureau", "/comptabilite", "bureau", 3000, { x: 200, y: 280, width: 1230, height: 620 }],
  ["maraichage-bureau", "/maraichage", "bureau", 8000, { x: 216, y: 130, width: 1224, height: 560 }],
  ["planification-bureau", "/maraichage/planification", "bureau", 3000],
  ["rotations-bureau", "/maraichage/rotations", "bureau", 3000],
  ["calendrier-itp-bureau", "/maraichage/itps/calendrier", "bureau", 4000],
  ["tracabilite-bureau", "/tracabilite", "bureau", 4000, { x: 216, y: 20, width: 1224, height: 540 }],
  ["carnet-culture-bureau", "/tracabilite", "bureau", 4000, { x: 216, y: 20, width: 1224, height: 540 }, "Registre de culture"],
];

const VUES = {
  bureau: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, largeur: 1920 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, largeur: 780, isMobile: true, hasTouch: true },
};

// Bulles flottantes (feedback, assistant) et bandeau cookies : hors sujet sur
// une capture de vitrine.
const CSS_MASQUE = `
  button[aria-label="Envoyer un feedback"],
  button[aria-label="Assistant IA"],
  [role="region"][aria-label*="cookie" i] { display: none !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
`;

async function connexionDemo(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", "demo@gleba.fr");
  await page.fill("#password", "demo2026");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click("button[type=submit]"),
  ]);
}

const navigateur = await chromium.launch();
try {
  for (const [nomVue, vue] of Object.entries(VUES)) {
    const aFaire = CAPTURES.filter(([nom, , v]) => v === nomVue && (!SEULES || SEULES.includes(nom)));
    if (aFaire.length === 0) continue;
    const ctx = await navigateur.newContext({ ...vue, locale: "fr-FR", timezoneId: "Europe/Paris" });
    // Consentement déjà donné : le bandeau ne recouvre pas la capture.
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("gleba-cookie-consent", JSON.stringify({ essentiel: true, analytics: false, marketing: false, personnalisation: false, date: new Date().toISOString() }));
      } catch {}
    });
    const page = await ctx.newPage();
    await connexionDemo(page);
    for (const [nom, chemin, , attente, decoupe, onglet] of aFaire) {
      try {
        await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(attente);
        if (onglet) {
          await page.getByRole("tab", { name: onglet }).or(page.getByText(onglet, { exact: true })).first().click();
          await page.waitForTimeout(attente);
        }
        await page.addStyleTag({ content: CSS_MASQUE });
        await page.waitForTimeout(300);
        const png = `${OUT}/${nom}.png`;
        await page.screenshot({ path: png, timeout: 90000, ...(decoupe ? { clip: decoupe } : {}) });
        const largeur = Math.min(vue.largeur, (decoupe?.width ?? vue.viewport.width) * vue.deviceScaleFactor);
        await sharp(png).resize({ width: largeur }).webp({ quality: 78 }).toFile(`${PUBLIC}/vitrine-${nom}.webp`);
        console.log(`${nom} ← ${chemin} (${nomVue})`);
      } catch (e) {
        // Un écran lent ne bloque pas les autres ; l'ancienne image reste.
        console.error(`ÉCHEC ${nom} ← ${chemin} : ${e.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
} finally {
  await navigateur.close();
}
