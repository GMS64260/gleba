// Preuve par l'effet (API, lecture seule) du lot du soir du 2026-10-19 sur
// gleba.fr, compte démo (la connexion écrit une ligne dans login_logs).
// Sans écriture : la seule requête mutante est un POST /api/exploitation/membres
// à corps vide, que l'ancien code refusait déjà (400) et que le nouveau refuse
// avant lecture du corps (403 COMPTE_DEMO). Carte : voir sonde-carte-fond-20261019.cjs.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261019c.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const res = [];
const ok = (nom, cond, detail) => { res.push({ nom, ok: !!cond }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };
const annee = (d) => (d ? new Date(d).getFullYear() : null);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@gleba.fr");
  await page.fill('input[type="password"]', "demo2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);
  const get = async (u) => { const r = await ctx.request.get(`${BASE}${u}`); return { status: r.status(), json: await r.json().catch(() => null) }; };

  // 1. Carnet sanitaire : types réels, plus de « Autre » par défaut (cmvfm1aj3, cmvfm1ow7)
  const cs = await get("/api/tracabilite/carnet-sanitaire?annee=2026");
  const lignes = cs.json?.carnet ?? cs.json?.data?.carnet ?? [];
  const types = [...new Set(lignes.map((l) => l.type))];
  ok("carnet sanitaire : Vermifuge et Vaccination présents", types.includes("Vermifuge") && types.includes("Vaccination"), types.join(", "));
  ok("carnet sanitaire : typeLabel servi", lignes.length > 0 && lignes.every((l) => typeof l.typeLabel === "string"), `${lignes.length} lignes`);

  // 2. Cave : valorisation au prix constaté dans son unité (cmvflv6ku)
  const af = await get("/api/elevage/affinage");
  const lotsCave = af.json?.lots ?? af.json?.data?.lots ?? af.json?.data ?? [];
  const lotPiece = lotsCave.find((l) => l.unitePrixConstate === "piece");
  ok("cave : un lot valorisé à la pièce", !!lotPiece, lotPiece ? `${lotPiece.numeroLot ?? lotPiece.id} : ${lotPiece.stockPieces} pc · ${lotPiece.stockKg} kg · ${lotPiece.valorisation} € à ${lotPiece.prixConstate} €/pièce` : JSON.stringify(af.json).slice(0, 200));
  ok("cave : valorisation = pièces × prix", lotPiece && Math.abs(lotPiece.valorisation - lotPiece.stockPieces * lotPiece.prixConstate) < 0.005, "");
  ok("cave : nbLotsMasques servi", typeof (af.json?.stats?.nbLotsMasques ?? af.json?.data?.stats?.nbLotsMasques) === "number", "");

  // 3. Soins à planifier : retards séparés des 30 prochains jours (cmvfm9wi5)
  const d0 = new Date(); const d1 = new Date(Date.now() + 30 * 864e5);
  const ta = await get(`/api/elevage/taches?start=${d0.toISOString().slice(0, 10)}&end=${d1.toISOString().slice(0, 10)}&retards=1`);
  const e = ta.json?.stats?.echeancesSoins ?? ta.json?.data?.stats?.echeancesSoins;
  ok("soins : stats.echeancesSoins servi et cohérent", e && e.total === e.enRetard + e.aVenir + e.auDela, e ? JSON.stringify(e) : JSON.stringify(ta.json).slice(0, 160));

  // 4. Compte de résultat : modules = total au centime (cmvflua2x)
  const st = await get("/api/comptabilite/stats?year=2026");
  const s = st.json?.stats ?? st.json?.data?.stats ?? st.json;
  const pm = s?.revenusParModule ?? {};
  const somme = Object.values(pm).reduce((a, b) => a + (Number(b) || 0), 0);
  ok("rapports : revenusEcart = 0", s?.coherenceCheck && Math.abs(s.coherenceCheck.revenusEcart ?? 1) < 0.005, JSON.stringify(s?.coherenceCheck ?? {}).slice(0, 160));
  ok("rapports : somme des modules = revenus", s && Math.abs(somme - Number(s.revenus)) < 0.005, `${somme.toFixed(2)} vs ${s?.revenus}`);

  // 5. Pollinisation : périodes de floraison des variétés perso (cmvfljv98)
  const po = await get("/api/arbres/pollinisation");
  const arbres = po.json?.arbres ?? po.json?.data?.arbres ?? [];
  const avecPeriode = arbres.filter((a) => a.periodeFloraison);
  ok("pollinisation : au moins deux arbres avec periodeFloraison", avecPeriode.length >= 2, avecPeriode.map((a) => `${a.nom ?? a.id}: S${a.periodeFloraison?.debut}+${a.periodeFloraison?.duree} ${a.pollinisateurDeriveCertitude ?? ""}`).join(" ; ") || JSON.stringify(po.json).slice(0, 160));

  // 6. Opérations du verger filtrées par année (cmvflyt1w)
  const refOp = (o) => (o.fait ? o.date : (o.datePrevue ?? o.date));
  const o25 = await get("/api/arbres/operations?annee=2025"); const o27 = await get("/api/arbres/operations?annee=2027"); const oAll = await get("/api/arbres/operations");
  const l25 = o25.json?.data ?? o25.json ?? [], l27 = o27.json?.data ?? o27.json ?? [], lAll = oAll.json?.data ?? oAll.json ?? [];
  ok("opérations : annee=2027 ne rend que 2027", Array.isArray(l27) && l27.length > 0 && l27.every((o) => annee(refOp(o)) === 2027), `${l27.length} op.`);
  ok("opérations : annee=2025 sans 2026 ni 2027", Array.isArray(l25) && l25.every((o) => ![2026, 2027].includes(annee(refOp(o)))), `${l25.length} op. ; sans paramètre ${lAll.length}`);

  // 7. Types d'arbre : les lianes comptées (cmvflq0sf)
  const ar = await get("/api/arbres/stats");
  const stA = ar.json?.stats ?? ar.json?.data?.stats ?? ar.json;
  ok("arbres/stats : compteur arbresLianes servi", typeof stA?.arbresLianes === "number", `arbresLianes=${stA?.arbresLianes}`);

  // 8. Garde démo : invitation refusée avant lecture du corps (lot sécurité)
  const inv = await ctx.request.post(`${BASE}/api/exploitation/membres`, { data: {} });
  const invJ = await inv.json().catch(() => ({}));
  ok("démo : POST /api/exploitation/membres → 403 COMPTE_DEMO", inv.status() === 403 && invJ.code === "COMPTE_DEMO", `${inv.status()} ${invJ.code ?? invJ.error ?? ""}`);

  // 9. Duplication : la route existe et refuse un corps invalide en nommant le champ (cmvfm1yvc), sans créer
  const pl = await get("/api/planches"); const planches = pl.json?.data ?? pl.json ?? [];
  const p0 = Array.isArray(planches) && planches[0];
  const dup = p0 ? await ctx.request.post(`${BASE}/api/planches/${p0.id}/dupliquer`, { data: { nombre: 0 } }) : null;
  const dupJ = dup ? await dup.json().catch(() => ({})) : {};
  ok("planches : POST /dupliquer refuse nombre=0 en nommant le champ (rien créé)", dup && dup.status() === 400 && /nombre/i.test(JSON.stringify(dupJ)), dup ? `${dup.status()} ${JSON.stringify(dupJ).slice(0, 120)}` : "aucune planche");

  await browser.close();
  const ko = res.filter((r) => !r.ok).length;
  console.log(`\nBilan : ${res.length - ko}/${res.length} OK`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ERREUR", e); process.exit(2); });
