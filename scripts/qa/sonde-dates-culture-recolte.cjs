// Sonde QA du 2026-10-10 : dates saisies à la création d'une culture (cmv2qzhkf),
// date de récolte relue dans le champ (cmv2r0qua), récolte refusée avant la
// plantation (cmv2r19al). Compte démo, fenêtre 856 px.
// ÉCRIT sur le compte démo (cultures et récoltes « QA sonde dates ») puis supprime ce
// qu'elle a créé ; ne pas lancer pendant une campagne QA ni quand la mémoire du VPS est basse.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-dates-culture-recolte.cjs [BASE] culture [A-fill,E-avant-itp,P15-retrait-itp]
//   PLAYWRIGHT_DIR=/var/www/escalier CULTURE_ID=<culture démo DÉJÀ récoltée> node … [BASE] recolte [A-fill,B-setter-dernier]
//   PLAYWRIGHT_DIR=/var/www/escalier node … [BASE] avant-plantation
// Le mode « recolte » exige une culture déjà marquée récoltée : supprimer la récolte de
// sonde ne décoche pas « récolte faite » sur la culture.
// Variantes culture (planche par identifiant, dates saisies RELATIVES au jour de Paris :
// semis J+7, plantation J+49, récolte J+105, imprimées sur la ligne « saisies : »
// que lit le lanceur ; jusqu'au 2026-10-25 elles étaient figées au 25/10/2026,
// 06/12/2026 et 31/01/2027 et la planche prise au rang 1 de la liste) :
//   A-fill          ITP reçu, planche B1, puis dates tapées ;
//   E-avant-itp     dates tapées avant la réponse des ITP, puis planche B1 ;
//   P15-retrait-itp ITP reçu (dates pré-remplies), dates tapées, puis « Planche 15 »
//                   (sans type) : l'ITP imposant une conduite est retiré, les dates
//                   tapées doivent rester ;
//   F-semis-seul-avant-itp, G-annee-changee (hors lanceur).
// Trois relevés des champs de date par variante, dans l'ordre où ils se produisent :
// « après saisie », « après ITP », « après planche » (avec l'ITP affiché).
// Avant correctif : E-avant-itp part aux dates de l'ITP ; F part sans plantation ni
// récolte ; G garde les dates de l'année sur une culture de l'année suivante ;
// B-setter-dernier affiche le 17/10 et envoie la date du jour ; avant-plantation rend 201.
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const CIBLE = process.argv[3] || "culture";
const VARIANTES = (process.argv[4] || (CIBLE === "recolte" ? "A-fill,B-setter-dernier" : "A-fill,E-avant-itp,P15-retrait-itp")).split(",");
const MARQUE = "QA sonde dates (à supprimer)";
// Planches de la démo : B1 (plein champ), « Planche 15 » (sans type).
const PLANCHES = { B1: "cms1i3lr5000q159dxjiwppbx", P15: "cmsq80ip4001nk4gsrhqv9g3d" };
// Jour civil à Paris décalé de n jours (AAAA-MM-JJ).
function jourParis(n) {
  const [a, m, j] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}
const SAISIES = [jourParis(7), jourParis(49), jourParis(105)];

async function poserDate(loc, valeur, mode) {
  if (mode === "setter") {
    // Outil qui pose la valeur sans que React la voie (setter d'instance + événements).
    await loc.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, valeur);
  } else {
    await loc.fill(valeur);
  }
}

async function supprimer(page, url) {
  return page.evaluate(async (u) => (await fetch(u, { method: "DELETE" })).status, url);
}

async function culture(page, variante) {
  console.log(`\n===== culture ${variante}`);
  console.log("saisies :", SAISIES.join(" "));
  let post = null;
  const onReq = (r) => { if (r.url().endsWith("/api/cultures") && r.method() === "POST") post = r.postData(); };
  page.on("request", onReq);
  await page.goto(`${BASE}/maraichage/cultures/new`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[role="combobox"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('button[role="combobox"]');
  await page.keyboard.type("Zinnia");
  await page.waitForTimeout(400);
  const itpResp = page.waitForResponse((r) => r.url().includes("/api/itps?"), { timeout: 15000 });
  await page.locator("[cmdk-item]", { hasText: "Zinnia" }).first().click();
  const dates = page.locator('input[type="date"]');
  const itp = page.locator('form button[role="combobox"]').nth(2);
  const releve = async (quand) => {
    const v = await dates.evaluateAll((els) => els.slice(0, 3).map((e) => e.value || "∅"));
    const nomItp = (await itp.innerText({ timeout: 2000 }).catch(() => "?")).replace(/\s+/g, " ").trim();
    console.log(`relevé ${quand} : ${v.join(" ")} | ITP : ${nomItp}`);
  };
  // Chaque date est vidée puis tapée : `fill` d'une valeur identique à celle du
  // champ n'émet aucun onChange React, et la date ne compte pas comme saisie.
  // Le cas se produit ici : J+49 → J+105 fait 56 jours, l'écart plantation →
  // récolte de l'ITP Zinnia, donc la récolte recalée sur la plantation tapée vaut
  // déjà J+105 ; restée « calculée », elle tombait au retrait de l'ITP (2026-10-25).
  // Un utilisateur qui tape la date passe par des valeurs intermédiaires.
  const saisir = async () => {
    for (const [i, v] of SAISIES.entries()) {
      await dates.nth(i).fill("");
      await poserDate(dates.nth(i), v, "fill");
    }
    await page.waitForTimeout(300);
    await releve("après saisie");
  };
  const attendreItp = async () => {
    await itpResp;
    await page.waitForTimeout(1500);
    await releve("après ITP");
  };
  const choisirPlanche = async (cle) => {
    await page.selectOption('select[name="plancheId"]', PLANCHES[cle]);
    await page.waitForTimeout(800);
    await releve(`après planche (${cle === "P15" ? "Planche 15" : cle})`);
  };
  if (variante.startsWith("E")) {
    // Dates posées tout de suite, avant la réponse des ITP (cause de cmv2qzhkf).
    await saisir();
    await attendreItp();
    await choisirPlanche("B1");
  } else if (variante.startsWith("P15")) {
    // Dates tapées par-dessus le calendrier de l'ITP, puis planche sans type :
    // l'ITP proposé d'office est retiré, ses dates calculées aussi, pas les saisies.
    await attendreItp();
    await saisir();
    await choisirPlanche("P15");
  } else if (variante.startsWith("F")) {
    // Semis seul avant les ITP : plantation et récolte complétées depuis l'ITP,
    // recalées sur ce semis (attendu : non vides, décalées comme le semis).
    await poserDate(dates.nth(0), SAISIES[0], "fill");
    await releve("après saisie (semis seul)");
    await attendreItp();
    await choisirPlanche("B1");
  } else if (variante.startsWith("G")) {
    // Dates saisies puis année changée : attendu, dates décalées d'un an.
    await attendreItp();
    await choisirPlanche("B1");
    await saisir();
    await page.locator('input[name="annee"]').fill(String(Number(SAISIES[0].slice(0, 4)) + 1));
    await page.waitForTimeout(800);
    await releve("après changement d'année");
  } else {
    await attendreItp();
    await choisirPlanche("B1");
    await saisir();
  }
  await page.fill('textarea[name="notes"]', MARQUE);
  console.log("champs avant envoi :", await dates.evaluateAll((els) => els.slice(0, 3).map((e) => e.value)), "| message :", await page.locator("p.text-amber-700").allInnerTexts());
  const rep = page.waitForResponse((r) => r.url().endsWith("/api/cultures") && r.request().method() === "POST", { timeout: 15000 }).catch(() => null);
  await page.click('button[type="submit"]:has-text("Enregistrer")');
  const r = await rep;
  page.off("request", onReq);
  if (!r) {
    console.log("aucun envoi ; messages :", await page.locator("[role=alert], p.text-red-600").allInnerTexts());
    return;
  }
  const j = JSON.parse(post || "{}");
  console.log("envoyé :", j.dateSemis, j.datePlantation, j.dateRecolte, "| ITP", j.itpId, "| planche", j.plancheId);
  const json = await r.json().catch(() => null);
  console.log("statut :", r.status(), "| culture", json?.id, "| stocké :", json?.dateSemis, json?.datePlantation, json?.dateRecolte);
  if (json?.id) console.log("suppression", json.id, "→", await supprimer(page, `/api/cultures/${json.id}`));
}

async function recolte(page, variante) {
  console.log(`\n===== récolte ${variante}`);
  if (!process.env.CULTURE_ID) throw new Error("CULTURE_ID requis (culture démo déjà récoltée)");
  let post = null;
  const onReq = (r) => { if (r.url().endsWith("/api/recoltes") && r.method() === "POST") post = r.postData(); };
  page.on("request", onReq);
  await page.goto(`${BASE}/maraichage/recoltes/saisie`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("form select option:nth-child(2)", { state: "attached", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.locator("form select").first().selectOption(process.env.CULTURE_ID);
  const mode = variante.startsWith("B") ? "setter" : "fill";
  const champDate = page.locator('input[type="date"]').first();
  const dernier = variante.includes("dernier");
  if (!dernier) await poserDate(champDate, "2026-10-17", mode);
  await page.locator('input[type="number"]').fill("3");
  await page.locator('input[placeholder="Qualité, remarques..."]').fill(MARQUE);
  if (dernier) await poserDate(champDate, "2026-10-17", mode);
  console.log("champ avant envoi :", await champDate.inputValue());
  const rep = page.waitForResponse((r) => r.url().endsWith("/api/recoltes") && r.request().method() === "POST", { timeout: 15000 }).catch(() => null);
  await page.click('button[type="submit"]');
  const r = await rep;
  page.off("request", onReq);
  if (!r) { console.log("aucun envoi"); return; }
  console.log("envoyé :", JSON.parse(post || "{}").date);
  const json = await r.json().catch(() => null);
  console.log("statut :", r.status(), "| récolte", json?.id, "| stockée au", json?.date);
  if (json?.id) console.log("suppression", json.id, "→", await supprimer(page, `/api/recoltes/${json.id}`));
}

async function avantPlantation(page) {
  console.log("\n===== récolte avant la plantation");
  await page.goto(`${BASE}/maraichage/recoltes/saisie`, { waitUntil: "domcontentloaded" });
  // Culture de sonde : semée aujourd'hui, plantation dans six semaines.
  const cree = await page.evaluate(async (marque) => {
    const planches = await (await fetch("/api/planches?pageSize=5")).json();
    const jour = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const res = await fetch("/api/cultures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        especeId: "Zinnia", plancheId: planches.data?.[0]?.id ?? null, annee: new Date().getFullYear(),
        dateSemis: jour(0), datePlantation: jour(42), dateRecolte: jour(98), nbRangs: 1, notes: marque, confirmRotation: true,
        semisFait: false, plantationFaite: false, recolteFaite: false,
      }),
    });
    return { statut: res.status, corps: await res.json().catch(() => null) };
  }, MARQUE);
  if (cree.statut !== 201) { console.log("culture de sonde refusée :", cree.statut, JSON.stringify(cree.corps).slice(0, 200)); return; }
  const id = cree.corps.id;
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(`form select option[value="${id}"]`, { state: "attached", timeout: 30000 });
    await page.locator("form select").first().selectOption(String(id));
    await page.locator('input[type="number"]').fill("25");
    const rep = page.waitForResponse((r) => r.url().endsWith("/api/recoltes") && r.request().method() === "POST", { timeout: 15000 });
    await page.click('button[type="submit"]');
    const r = await rep;
    const json = await r.json().catch(() => null);
    console.log("statut :", r.status(), "| réponse :", json?.error ?? json?.id);
    await page.waitForTimeout(500);
    console.log("message sous le formulaire :", await page.locator('form [role="alert"]').allInnerTexts());
    if (json?.id) console.log("suppression récolte", json.id, "→", await supprimer(page, `/api/recoltes/${json.id}`));
  } finally {
    console.log("suppression culture", id, "→", await supprimer(page, `/api/cultures/${id}`));
  }
}

(async () => {
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
  if (CIBLE === "avant-plantation") {
    await avantPlantation(page);
  } else {
    for (const v of VARIANTES) {
      try { await (CIBLE === "recolte" ? recolte : culture)(page, v); } catch (e) { console.log("échec variante", v, String(e).slice(0, 300)); }
    }
  }
  await browser.close();
})().catch((e) => { console.error("ERREUR", e); process.exit(1); });
