// Preuve par l'effet du correctif `27667b1` (facturation électronique, lot 1
// relu : professionnel sans SIREN refusé à l'export, adresse électronique de
// l'acheteur exigée, cadre « déjà payée » réservé au paiement à l'émission,
// SIRET ou SIREN exigé à la mise à jour d'un client professionnel) sur
// gleba.fr, compte démo. Lecture seule, sauf UNE écriture volontairement
// refusée par le serveur (PATCH client particulier → professionnel sans SIREN,
// attendu 400) ; si elle passait, la sonde la défait aussitôt et le signale.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-lot-20261013b.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const resultats = [];
const ok = (nom, cond, detail) => { resultats.push({ nom, ok: !!cond, detail }); console.log(`${cond ? "OK  " : "KO  "} ${nom}${detail ? " — " + detail : ""}`); };
const info = (nom, detail) => console.log(`INFO ${nom}${detail ? " — " + detail : ""}`);
const jourParis = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
const chiffres = (v) => (v || "").replace(/\D/g, "");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1446, height: 1037 }, locale: "fr-FR" });
  await ctx.addInitScript(() => { try { localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
  try { await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); }
  catch { await page.fill('input[type="email"]', "demo@gleba.fr"); await page.fill('input[type="password"]', "demo2026");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]); }
  console.log("après login:", page.url());
  const api = ctx.request;
  const lire = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
  const liste = (j) => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : []);

  // --- Inventaire (lecture seule)
  const clients = liste(await lire(await api.get(`${BASE}/api/comptabilite/clients`)));
  const factures = liste(await lire(await api.get(`${BASE}/api/comptabilite/factures?year=all`)));
  const parId = new Map(clients.map((c) => [c.id, c]));
  const emises = factures.filter((f) => f.statut !== "brouillon");
  info("inventaire", `${clients.length} clients, ${factures.length} factures dont ${emises.length} émises ou payées`);
  const avecClient = emises.map((f) => ({ f, c: f.clientId ? parId.get(f.clientId) : null }));
  const sansSiren = (c) => !chiffres(c?.siren).match(/^\d{9}$/) && !chiffres(c?.siret).match(/^\d{14}$/);
  const proSansSiren = avecClient.find(({ f, c }) => c && c.type === "professionnel" && sansSiren(c) && !chiffres(f.clientSiren).match(/^\d{9}$/) && !chiffres(f.clientSiret).match(/^\d{14}$/));
  const particulierSansMail = avecClient.find(({ f, c }) => c && c.type !== "professionnel" && sansSiren(c) && !(c.email || "").trim() && !chiffres(f.clientSiren).match(/^\d{9}$/));
  const complete = avecClient.find(({ f, c }) => c && (chiffres(c.siren).match(/^\d{9}$/) || chiffres(c.siret).match(/^\d{14}$/) || chiffres(f.clientSiren).match(/^\d{9}$/) || (c.email || "").trim()));

  // --- 1. Professionnel sans SIREN : export refusé (422), jamais dégradé en B2C
  if (proSansSiren) {
    const r = await api.get(`${BASE}/api/comptabilite/factures/${proSansSiren.f.id}/ubl`);
    const j = await lire(r);
    const texte = JSON.stringify(j);
    ok("pro sans SIREN : UBL refusé 422", r.status() === 422, `${r.status()} facture ${proSansSiren.f.numero}`);
    ok("pro sans SIREN : motif « SIREN de l'acheteur manquant »", /SIREN de l.acheteur manquant/.test(texte), texte.slice(0, 160));
    const r2 = await api.get(`${BASE}/api/comptabilite/factures/${proSansSiren.f.id}/facturx`);
    ok("pro sans SIREN : Factur-X refusé 422", r2.status() === 422, String(r2.status()));
  } else info("pro sans SIREN", "aucune facture émise à un professionnel sans SIRET ni SIREN sur la démo : non testable sans écriture");

  // --- 2. Particulier sans courriel : adresse électronique manquante (BT-49)
  if (particulierSansMail) {
    const r = await api.get(`${BASE}/api/comptabilite/factures/${particulierSansMail.f.id}/ubl`);
    const texte = JSON.stringify(await lire(r));
    ok("particulier sans courriel : UBL refusé 422", r.status() === 422, `${r.status()} facture ${particulierSansMail.f.numero}`);
    ok("particulier sans courriel : motif BT-49", /BT-49/.test(texte), texte.slice(0, 160));
  } else info("particulier sans courriel", "aucune facture émise à un particulier sans courriel sur la démo : non testable sans écriture");

  // --- 3. Facture complète : export 200, note BAR, cadre selon la date de paiement
  if (complete) {
    const r = await api.get(`${BASE}/api/comptabilite/factures/${complete.f.id}/ubl`);
    const xml = await r.text();
    ok("facture complète : UBL 200", r.status() === 200, `${r.status()} facture ${complete.f.numero}`);
    ok("facture complète : note BAR présente", /#BAR#(B2B|B2C)/.test(xml), (xml.match(/#BAR#(B2B|B2C)/) || [])[0]);
    const r2 = await api.get(`${BASE}/api/comptabilite/factures/${complete.f.id}/facturx`);
    const pdf = await r2.body();
    ok("facture complète : Factur-X 200 PDF 1.7 avec factur-x.xml", r2.status() === 200 && pdf.subarray(0, 8).toString("latin1") === "%PDF-1.7" && pdf.toString("latin1").includes("factur-x.xml"), `${r2.status()} ${pdf.length} octets`);
  } else info("facture complète", "aucune facture exportable sur la démo");
  for (const { f } of avecClient.filter(({ f }) => f.statut === "payee" && f.type !== "avoir").slice(0, 3)) {
    const r = await api.get(`${BASE}/api/comptabilite/factures/${f.id}/ubl`);
    if (r.status() !== 200) { info(`payée ${f.numero}`, `UBL ${r.status()}, cadre non vérifiable`); continue; }
    const xml = await r.text();
    const cadre = (xml.match(/<cbc:ProfileID>([A-Z]\d)<\/cbc:ProfileID>/) || [])[1];
    const payeeALEmission = jourParis(f.datePaiement || f.date) <= jourParis(f.date);
    ok(`payée ${f.numero} : cadre ${payeeALEmission ? "x2 (payée à l'émission)" : "x1 (encaissée après)"}`, cadre && cadre.endsWith(payeeALEmission ? "2" : "1"), `${cadre} ; paiement ${jourParis(f.datePaiement || f.date)}, émission ${jourParis(f.date)}`);
    if (!payeeALEmission) ok(`payée ${f.numero} : net à payer = TTC`, xml.includes(`<cbc:PayableAmount currencyID="EUR">${Number(f.totalTTC).toFixed(2)}</cbc:PayableAmount>`), Number(f.totalTTC).toFixed(2));
  }

  // --- 4. Garde à la mise à jour : particulier sans identifiant → professionnel refusé (400), aucune écriture
  const particulier = clients.find((c) => c.type === "particulier" && sansSiren(c));
  if (particulier) {
    const r = await api.patch(`${BASE}/api/comptabilite/clients`, { data: { id: particulier.id, type: "professionnel" } });
    const j = await lire(r);
    ok("PATCH client particulier → professionnel sans SIREN : refusé 400", r.status() === 400 && /SIRET ou SIREN requis/.test(JSON.stringify(j)), `${r.status()} ${JSON.stringify(j).slice(0, 120)}`);
    if (r.status() === 200) {
      const retour = await api.patch(`${BASE}/api/comptabilite/clients`, { data: { id: particulier.id, type: particulier.type } });
      console.log("ECRITURE PASSEE PUIS DEFAITE", retour.status());
    }
    const apres = liste(await lire(await api.get(`${BASE}/api/comptabilite/clients`))).find((c) => c.id === particulier.id);
    ok("PATCH refusé : fiche inchangée en base", apres && apres.type === particulier.type, `${apres?.type}`);
  } else info("PATCH client", "aucun client particulier sans identifiant sur la démo");

  await browser.close();
  const ko = resultats.filter((r) => !r.ok);
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications OK`);
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error("ERREUR", e); process.exit(2); });
