// Preuve par l'effet du lot du 2026-10-20 (campagne QA v8 du matin) sur
// gleba.fr, compte démo, API en lecture seule (une seule écriture tentée,
// refusée par construction : rendement carcasse à 65 %). La connexion écrit
// une ligne dans login_logs.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261020.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const res = [];
const ok = (nom, cond, detail) => { res.push({ nom, ok: !!cond }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };
const liste = (j, ...cles) => { for (const c of cles) { const v = c.split(".").reduce((a, k) => a?.[k], j); if (Array.isArray(v)) return v; } return Array.isArray(j) ? j : []; };
const court = (x) => JSON.stringify(x).slice(0, 220);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "demo@gleba.fr");
  await page.fill('input[type="password"]', "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);
  const get = async (u) => { const r = await ctx.request.get(`${BASE}${u}`); return { status: r.status(), json: await r.json().catch(() => null) }; };
  const post = async (u, data) => { const r = await ctx.request.post(`${BASE}${u}`, { data }); return { status: r.status(), json: await r.json().catch(() => null) }; };

  // cmvgdo90z — Stocks : effectif de lot reconstitué
  const st = await get("/api/comptabilite/stocks");
  const stocks = liste(st.json, "stocks", "data.stocks", "data");
  const pintades = stocks.find((s) => /Pintades perle A3 1708/i.test(s.nom ?? ""));
  ok("stocks : lot « Pintades perle A3 1708 » = 4 têtes", pintades && pintades.stock === 4, pintades ? `${pintades.stock} ${pintades.unite}` : court(st.json));

  // cmvgeecem — compteur de ventes du client
  const cl = await get("/api/comptabilite/clients");
  const clients = liste(cl.json, "clients", "data.clients", "data");
  const amap = clients.find((c) => /v8-Nathalie Amap 2010/i.test(c.nom ?? ""));
  ok("clients : « v8-Nathalie Amap 2010 » compte au moins 1 vente", amap && amap.nbVentes >= 1, amap ? `nbVentes=${amap.nbVentes}` : `client absent (${clients.length} clients)`);

  // cmvge3bqj — coûts de production : masses seules + autres unités à part
  let cp = await get("/api/comptabilite/couts-production?annee=2026");
  if (cp.status !== 200) cp = await get("/api/comptabilite/couts-production?year=2026");
  const tot = cp.json?.totaux ?? cp.json?.data?.totaux;
  const ppu = tot?.productionParUnite ?? {};
  ok("coûts de production : productionParUnite ventilée (kg + tiges)", tot && typeof ppu.kg === "number" && (ppu.tige ?? ppu.tiges ?? 0) > 0, tot ? `production=${tot.production} parUnite=${court(ppu)}` : court(cp.json));
  ok("coûts de production : totaux.production = part en kg", tot && Math.abs(Number(tot.production) - Number(ppu.kg)) < 0.01, tot ? `${tot.production} vs ${ppu.kg}` : "");

  // cmvge3o5z — tournée d'arrosage unique
  const ir = await get("/api/cultures/irriguer");
  const tourn = ir.json?.tournee ?? ir.json?.data?.tournee;
  const hors = tourn?.horsTournee ?? [];
  ok("irriguer : tournee servie avec horsTournee", tourn && Array.isArray(hors), tourn ? `nombre=${tourn.nombre ?? tourn.lignes?.length} hors=${hors.length}` : court(ir.json));
  ok("irriguer : le poireau C2 est nommé hors tournée", hors.some((h) => /poireau/i.test(JSON.stringify(h))), court(hors));

  // cmvgddn3l — porte-greffes avec « prunier » en minuscules
  const pg = await get("/api/verger/porte-greffes?especeId=prunier");
  const pgs = liste(pg.json, "data");
  ok("porte-greffes : « prunier » résolu (≥ 4 porte-greffes, especeId Prunier)", pgs.length >= 4 && pgs.length < 15 && pg.json?.especeId === "Prunier", `${pgs.length} porte-greffes, especeId=${pg.json?.especeId}`);

  // cmvgee5s9 — pollinisation : association démentie par les floraisons
  const po = await get("/api/arbres/pollinisation");
  const txt = JSON.stringify(po.json ?? {});
  const arbres = liste(po.json, "arbres", "data.arbres");
  const a835 = arbres.find((a) => a.id === 835);
  ok("pollinisation : floraisonIncompatible exposé par la matrice", /floraisonIncompatible/.test(txt), a835 ? `#835 valides=${a835.nombrePollinisateursValides} explicites=${a835.pollinisateursCompat?.length}` : `${arbres.length} arbres`);
  ok("pollinisation : #835 sans pollinisateur valide", a835 && a835.nombrePollinisateursValides === 0, a835 ? court(a835.associationsDementies ?? a835) : "arbre #835 absent");

  // cmvgef6ou — sorties de stock avec unité
  const co = await get("/api/consommations");
  const consos = liste(co.json, "consommations", "data.consommations", "data");
  ok("consommations : chaque sortie porte unite", consos.length > 0 && consos.every((c) => typeof c.unite === "string"), `${consos.length} sorties, unités ${[...new Set(consos.map((c) => c.unite))].join("/")}`);

  // cmvgeif10 — rendement carcasse en % refusé par la route (aucune création)
  const ea = await post("/api/elevage/especes-animales", { id: "sonde-v8-rendement", nom: "sonde-v8-rendement", type: "volaille", production: "mixte", filiere: "rente", poidsAdulte: 3, rendementCarcasse: 65 });
  ok("espèces animales : rendementCarcasse 65 refusé 400 en nommant le champ", ea.status === 400 && ea.json?.champ === "rendementCarcasse", `${ea.status} ${court(ea.json)}`);

  // cmvgeltj1 — registre phyto général : surface, ZNT, météo, applicateur
  let rp = await get("/api/tracabilite/registre-phyto?annee=2026");
  if (rp.status !== 200) rp = await get("/api/registre-phyto?annee=2026");
  const lignesRp = liste(rp.json, "registre", "data.registre", "lignes", "data.lignes", "data");
  const helene = lignesRp.find((l) => /v8-H[ée]l[èe]ne 0929/i.test(JSON.stringify(l)));
  ok("registre phyto : ligne v8-Hélène avec surface 100 m², ZNT 20 et applicateur saisi", helene && Number(helene.surfaceTraitee ?? helene.surface) === 100 && /20/.test(String(helene.zntDistanceM ?? helene.znt ?? "")) && /v8-H/i.test(String(helene.applicateur ?? "")), helene ? court({ surface: helene.surfaceTraitee ?? helene.surface, znt: helene.zntDistanceM ?? helene.znt, meteo: helene.meteo, applicateur: helene.applicateur }) : `${lignesRp.length} lignes (${rp.status})`);

  // cmvgdp9fn — refus de suppression de planche avec années
  const pl = await get("/api/planches");
  const planches = liste(pl.json, "planches", "data.planches", "data");
  const marc = planches.find((p) => /v8-Marc-2010/i.test(p.nom ?? ""));
  const sup = marc ? await get(`/api/planches/${marc.id}/suppression`) : { status: 0, json: null };
  const msg = sup.json?.error ?? sup.json?.message ?? sup.json?.refus?.error ?? "";
  ok("planches : refus de suppression nomme 2027 et un lien", marc && /2027/.test(JSON.stringify(sup.json)) && /\/maraichage\/cultures/.test(JSON.stringify(sup.json)), marc ? `${sup.status} ${court(sup.json)}` : "planche v8-Marc-2010 absente");

  // cmvgdzsf7 — écritures dérivées : écriture ou facture rattachée
  const rv = await get("/api/comptabilite/revenus?year=2026&limit=500");
  const revenus = liste(rv.json, "revenues", "data.revenues", "data", "revenus");
  const oeufs = revenus.find((r) => Math.abs(Number(r.montant) - 86.4) < 0.005);
  const dahlia = revenus.find((r) => Math.abs(Number(r.montant) - 48) < 0.005 && /dahlia/i.test(JSON.stringify(r)));
  ok("revenus : la vente d'œufs 86,40 € porte son écriture (suivi modifiable)", oeufs && oeufs.ecriture && typeof oeufs.ecriture.id === "number", oeufs ? court({ ecriture: oeufs.ecriture }) : `${revenus.length} lignes`);
  ok("revenus : la vente Dahlia 48 € renvoie vers sa facture", dahlia && dahlia.facture && /F-2026/.test(dahlia.facture.numero ?? ""), dahlia ? court({ facture: dahlia.facture }) : "ligne Dahlia 48 € absente");

  await browser.close();
  const ko = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - ko}/${res.length} OK`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
