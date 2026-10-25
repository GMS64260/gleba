// Preuve par l'effet du lot du 2026-10-23 (campagne QA v8 du matin) sur
// gleba.fr, compte démo, en lecture seule : le plan n'est jamais enregistré
// et le dialogue de récolte se referme sans valider. La connexion écrit une
// ligne dans login_logs.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261023.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const res = [];
const ok = (nom, cond, detail) => { res.push({ nom, ok: !!cond }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };
const court = (x) => String(JSON.stringify(x)).slice(0, 220);

// Arbres de la campagne (compte démo) : 863 porte le porte-greffe du catalogue
// sans saisie libre ; 865 est une Mirabelle de Nancy (S33, 2 semaines) dont la
// récolte est datée du 10/07/2026.
const ARBRE_PG = 863;
const ARBRE_MIRABELLE = 865;
const PORTE_GREFFE = "Prunier Saint-Julien A";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris", viewport: { width: 1686, height: 951 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("erreur JS :", String(e).slice(0, 200)));
  // Catalogue lu par le champ Porte-greffe : statut, durée, nombre. Un catalogue
  // vide ou en erreur change le champ de composant (Combobox), qui n'avait pas
  // d'id avant le 2026-10-25 : le contrôle discrimine ainsi « données » et « écran ».
  const journaliserCatalogue = async (req, echec) => {
    if (!req.url().includes("/api/verger/porte-greffes?especeId=")) return;
    const especeId = new URL(req.url()).searchParams.get("especeId");
    const t = req.timing();
    const duree = t.responseEnd >= 0 ? `${Math.round(t.responseEnd)} ms` : "durée inconnue";
    if (echec) return console.log(`catalogue porte-greffes ?especeId=${especeId} → échec réseau (${echec}) après ${duree}`);
    const rep = await req.response().catch(() => null);
    const corps = rep ? await rep.json().catch(() => null) : null;
    console.log(`catalogue porte-greffes ?especeId=${especeId} → ${rep ? rep.status() : "?"} en ${duree}, ${Array.isArray(corps?.data) ? corps.data.length : "?"} résultat(s)`);
  };
  page.on("requestfinished", (req) => { journaliserCatalogue(req, null).catch(() => {}); });
  page.on("requestfailed", (req) => { journaliserCatalogue(req, req.failure()?.errorText || "?").catch(() => {}); });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "demo@gleba.fr");
  await page.fill('input[type="password"]', "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);
  const get = async (u) => { const r = await ctx.request.get(`${BASE}${u}`); return { status: r.status(), json: await r.json().catch(() => null) }; };

  // --- API : ce que les écrans reçoivent
  const ar = await get("/api/arbres");
  const arbres = Array.isArray(ar.json) ? ar.json : [];
  const a863 = arbres.find((a) => a.id === ARBRE_PG);
  const a865 = arbres.find((a) => a.id === ARBRE_MIRABELLE);
  ok("GET /api/arbres : 863 porte porteGreffeRef « Prunier Saint-Julien A »", a863?.porteGreffeRef?.nom === PORTE_GREFFE, a863 ? court({ portGreffe: a863.portGreffe, ref: a863.porteGreffeRef }) : `${arbres.length} arbres`);
  ok("GET /api/arbres : 865 sert la période de récolte de sa variété (S33, 2 sem.)", a865?.periodeRecolteVariete?.semaineRecolte === 33, a865 ? court(a865.periodeRecolteVariete) : "arbre absent");
  const fiche = await get(`/api/arbres/${ARBRE_PG}`);
  ok("GET /api/arbres/863 : porteGreffeRef joint", fiche.json?.porteGreffeRef?.nom === PORTE_GREFFE, court(fiche.json?.porteGreffeRef));

  // --- cmvkp3kqc + cmvkpb0g9 : inspecteur du plan, avant et après rechargement
  const parcelle = a863?.parcelleGeoId;
  // Le champ se lit dans le bloc de son libellé (`label[for="inspecteur-porte-greffe"]`),
  // sans dépendre de son id : selon le catalogue, c'est un Input désactivé
  // (« Chargement… »), un Select (bouton) ou un Combobox (champ texte), et le
  // Combobox n'avait pas d'id avant le 2026-10-25. La branche est journalisée.
  // Sélection de l'arbre par un clic réel à un point où il est AU-DESSUS : le
  // 2026-10-25, le clic forcé au centre de sa couronne tombait sur un pied de
  // vigne dessiné par-dessus (catalogue demandé pour « Vigne », 0 résultat), et
  // l'inspecteur affichait l'arbre voisin. Le point est cherché sur une grille de
  // la couronne par elementFromPoint ; la sélection est relue (contour bleu).
  const selectionnerArbre = async (id) => {
    const g = page.locator(`g[data-arbre-id="${id}"]`).first();
    await g.waitFor({ timeout: 30000 });
    const couronne = g.locator("path").nth(1);
    await couronne.scrollIntoViewIfNeeded().catch(() => {});
    const boite = await couronne.boundingBox();
    if (!boite) throw new Error(`arbre ${id} sans boîte visible`);
    const vise = await page.evaluate(({ id, b }) => {
      const parts = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
      const dessus = (x, y) => document.elementFromPoint(x, y)?.closest("g[data-arbre-id]")?.getAttribute("data-arbre-id") ?? "fond";
      const auCentre = dessus(b.x + b.width / 2, b.y + b.height / 2);
      for (const fy of parts) for (const fx of parts) {
        const x = b.x + b.width * fx;
        const y = b.y + b.height * fy;
        if (dessus(x, y) === String(id)) return { x, y, auCentre };
      }
      return { x: null, y: null, auCentre };
    }, { id, b: boite });
    if (vise.x === null) throw new Error(`arbre ${id} entièrement recouvert (au centre : ${vise.auCentre})`);
    await page.mouse.click(vise.x, vise.y);
    const choisi = await page
      .waitForFunction((n) => document.querySelector(`g[data-arbre-id="${n}"] path:nth-of-type(2)`)?.getAttribute("stroke") === "#3b82f6", id, { timeout: 3000 })
      .then(() => true, () => false);
    console.log(`arbre ${id} : clic à (${Math.round(vise.x)}, ${Math.round(vise.y)}), au centre de sa couronne : ${vise.auCentre === String(id) ? "lui-même" : `arbre ${vise.auCentre}`} | sélectionné : ${choisi}`);
  };
  const lireInspecteur = async (etape, id) => {
    await selectionnerArbre(id);
    const libelle = page.locator('label[for="inspecteur-porte-greffe"]');
    await libelle.waitFor({ timeout: 15000 });
    const bloc = libelle.locator("xpath=..");
    const lire = () =>
      bloc.evaluate((div) => {
        const el = div.querySelector("button, input");
        if (!el) return { branche: "aucun champ", valeur: "" };
        const estInput = el instanceof HTMLInputElement;
        const valeur = ((estInput ? el.value : el.textContent) || "").trim();
        if (estInput && el.disabled) return { branche: "input disabled", valeur };
        if (el.id !== "inspecteur-porte-greffe") return { branche: estInput ? "combobox sans id" : `${el.tagName.toLowerCase()} sans id`, valeur };
        return { branche: "ok", valeur, composant: estInput ? "input" : `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}` };
      });
    let r = await lire();
    const fin = Date.now() + 15000;
    while (r.branche === "input disabled" && Date.now() < fin) {
      await page.waitForTimeout(250);
      r = await lire();
    }
    console.log(`inspecteur (${etape}) : branche ${r.branche}${r.composant ? ` (${r.composant})` : ""}, valeur ${JSON.stringify(r.valeur)}`);
    const texte = await page.locator("body").innerText();
    return { valeur: r.valeur, branche: r.branche, parDefaut: texte.includes("Par défaut"), sansAccent: texte.includes("Par defaut") };
  };
  if (parcelle) {
    // Témoin : 863. S'il est entièrement recouvert sur le plan (objets de campagne
    // posés au même point : neuf arbres en (0, 0) de cette parcelle le 2026-10-25,
    // dont 872, prunier de même envergure, dessiné par-dessus), repli sur un autre
    // arbre de la parcelle qui porte un porte-greffe du catalogue (ligne INFO).
    const candidats = [a863, ...arbres.filter((a) => a.id !== ARBRE_PG && a.parcelleGeoId === parcelle && a.porteGreffeRef?.nom).reverse()];
    await page.goto(`${BASE}/jardin?parcelle=${parcelle}`, { waitUntil: "domcontentloaded" });
    let temoin = null;
    let avant = { erreur: "aucun arbre candidat" };
    for (const c of candidats) {
      try {
        avant = await lireInspecteur("avant rechargement", c.id);
        temoin = c;
        break;
      } catch (e) {
        avant = { erreur: String(e).split("\n")[0].slice(0, 160) };
        console.log(`arbre ${c.id} : ${avant.erreur}`);
        if (!/recouvert/.test(avant.erreur)) break;
      }
    }
    if (temoin && temoin.id !== ARBRE_PG) console.log(`INFO arbre ${ARBRE_PG} recouvert sur le plan : repli sur l'arbre ${temoin.id} « ${temoin.nom} » (${temoin.porteGreffeRef.nom})`);
    const attendu = temoin?.porteGreffeRef?.nom ?? PORTE_GREFFE;
    const arbreLu = temoin ? `arbre ${temoin.id}, ` : "";
    ok("plan : l'inspecteur affiche le porte-greffe de la fiche", avant.valeur?.includes(attendu), `${arbreLu}${court(avant)}`);
    ok("plan : « Par défaut » accentué, aucun « Par defaut »", avant.parDefaut && !avant.sansAccent, court(avant));
    await page.reload({ waitUntil: "domcontentloaded" });
    const apres = temoin ? await lireInspecteur("après rechargement", temoin.id).catch((e) => ({ erreur: String(e).slice(0, 160) })) : avant;
    ok("plan : même porte-greffe après rechargement", apres.valeur?.includes(attendu), `${arbreLu}${court(apres)}`);
  } else {
    ok("plan : parcelle de l'arbre 863 connue", false, "parcelleGeoId absent");
  }

  // --- cmvkoxe5o : encart hors saison du formulaire de récolte (modification)
  await page.goto(`${BASE}/verger?tab=productions`, { waitUntil: "domcontentloaded" });
  const ligne = page.locator("tr", { hasText: "v8-Hélène 2310 prunier (3)" }).filter({ hasText: "10/07/2026" }).first();
  try {
    await ligne.waitFor({ timeout: 30000 });
    await ligne.locator('button[title^="Modifier"]').first().click();
    const dialogue = page.getByRole("dialog");
    await dialogue.waitFor({ timeout: 15000 });
    const texte = await dialogue.innerText();
    ok("récolte du 10/07 : l'encart cite la période de la Mirabelle de Nancy", /Mirabelle de Nancy/.test(texte) && /S33/.test(texte), texte.split("\n").find((l) => /habituellement/.test(l)) || "encart absent");
    await page.keyboard.press("Escape");
  } catch (e) {
    ok("récolte du 10/07 : dialogue de modification ouvert", false, String(e).slice(0, 160));
  }

  // --- libellés : page publique d'inscription
  await page.context().clearCookies();
  await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  // Formulaire rendu côté client sous Suspense : le HTML servi n'a que le
  // chargement, lire le texte avant son arrivée donnait un KO (2026-10-25).
  await page.getByText(/D[ée]j[àa] un compte/).first().waitFor({ timeout: 20000 }).catch(() => {});
  const inscription = await page.locator("body").innerText();
  ok("inscription : « Déjà un compte ? » accentué", inscription.includes("Déjà un compte") && !inscription.includes("Deja un compte"), "");

  await browser.close();
  const ko = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - ko}/${res.length} OK`);
  process.exit(ko ? 1 : 0);
})();
