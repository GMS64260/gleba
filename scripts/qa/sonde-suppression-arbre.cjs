// Sonde QA cmv2sr80i (2026-10-11) : une opération planifiée puis réalisée sur
// un arbre disparaît avec l'arbre. Compte démo, par l'API de l'écran : crée un
// arbre de sonde, y planifie une taille, la réalise, supprime l'arbre, puis
// vérifie que l'opération n'est plus listée. L'arbre de sonde et tout ce qui
// s'y rattache partent avec la suppression ; la sonde le vérifie et le dit.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-suppression-arbre.cjs [BASE]
// Le choix de l'arbre dans le formulaire (cause du ticket : le premier arbre de
// la liste était envoyé) est prouvé par sonde-verger-selecteurs.cjs.
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";

;(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await ctx.newPage();
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
  const api = page.request;
  const jour = new Date().toISOString().slice(0, 10);
  let arbreId = null;
  try {
    const arbre = await api.post(`${BASE}/api/arbres`, {
      data: { nom: "QA sonde suppression 1011", type: "fruitier", espece: "Pommier", datePlantation: jour },
    });
    const corpsArbre = await arbre.json();
    if (!arbre.ok()) throw new Error(`création de l'arbre : ${arbre.status()} ${JSON.stringify(corpsArbre)}`);
    arbreId = corpsArbre.id;
    console.log("arbre de sonde :", arbreId);

    const op = await api.post(`${BASE}/api/arbres/operations`, {
      data: { arbreId, type: "taille", description: "QA sonde taille 1011", fait: false, datePrevue: jour },
    });
    const corpsOp = await op.json();
    if (!op.ok()) throw new Error(`planification : ${op.status()} ${JSON.stringify(corpsOp)}`);
    console.log("opération planifiée :", corpsOp.id, "rattachée à l'arbre", corpsOp.arbreId);
    const realisation = await api.put(`${BASE}/api/arbres/operations/${corpsOp.id}`, { data: { fait: true, date: jour } });
    console.log("réalisation :", realisation.status());

    const fiche = await (await api.get(`${BASE}/api/arbres/${arbreId}`)).json();
    console.log("liées annoncées par la fiche :", JSON.stringify(fiche._count));

    const suppression = await api.delete(`${BASE}/api/arbres/${arbreId}`);
    console.log("suppression de l'arbre :", suppression.status());
    if (suppression.ok()) arbreId = null;

    const liste = await (await api.get(`${BASE}/api/arbres/operations`)).json();
    const lignes = Array.isArray(liste) ? liste : liste.data ?? liste.operations ?? [];
    const restantes = lignes.filter((o) => o.id === corpsOp.id || o.description === "QA sonde taille 1011");
    console.log(`opérations listées : ${lignes.length} ; opération de sonde encore présente : ${restantes.length}`);
  } finally {
    if (arbreId) {
      const nettoyage = await api.delete(`${BASE}/api/arbres/${arbreId}`);
      console.log("nettoyage de l'arbre de sonde :", nettoyage.status());
    }
    await browser.close();
  }
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
