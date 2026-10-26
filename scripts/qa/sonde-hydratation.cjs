// Sonde générique : localiser une erreur d'hydratation React (#418, #423, #425)
// sur des pages de production. Compte démo, lecture seule : la page n'est que chargée.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-hydratation.cjs [BASE] [chemins] [largeurs]
//   ex. : node scripts/qa/sonde-hydratation.cjs https://gleba.fr "/aujourdhui,/maraichage" "1301,375"
//   CLOCK_PLUS_JOURS=<n> : horloge du navigateur avancée de n jours (ctx.clock.setFixedTime)
//   avant tout chargement. Une page prérendue fige la date du build : le jour même
//   du build, client et HTML servi disent le même jour et le #418 ne se voit pas ;
//   avec n ≥ 1, tout texte calculé sur la date à l'heure du rendu serveur diverge.
//
// QUATRE TÉMOINS PAR PAGE (2026-10-25)
//   - (console) : console.error de la page ;
//   - (patch)   : console.error enveloppé + écouteur window « error » posés avant tout
//     script (addInitScript). En production, Next passe `onRecoverableError` à React,
//     qui remonte le #418 par `window.reportError` : une exception NON RATTRAPÉE,
//     jamais un console.error. L'ancienne sonde, qui n'écoutait que la console, est
//     restée à 0 alors que le #418 de cmvnnwr70 se produisait (« aveugle ») ;
//   - (pageerror+date) : `page.on("pageerror")` (même exception, vue par Playwright),
//     plus 1 si le <h1> servi nomme un autre jour, ou si la date de l'accueil
//     (<time datetime>, affiché et servi s'il existe) diffère de l'API du jour.
//     L'API du serveur reste la référence, jamais CLOCK_PLUS_JOURS : l'horloge
//     avancée du navigateur ne doit pas changer la date de son registre ;
//   - mutations du DOM (MutationObserver posé avant tout script) : la réparation
//     d'hydratation remplace les nœuds rendus par le serveur (removedNodes) par le
//     rendu client ; imprimées dès qu'un compteur est non nul.
// Le <h1> servi (lu par page.request.get, cookies du contexte) et le <h1> affiché
// sont imprimés pour chaque page.
// 2026-10-12 : un #418 (texte) vu une fois sur /aujourdhui après la bascule de
// 09:08 UTC n'a pas été reproduit sur 20 chargements (6 chemins, 2 largeurs) : la
// sonde ne lisait que la console.
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const CHEMINS = (process.argv[3] || "/aujourdhui,/maraichage").split(",");
const LARGEURS = (process.argv[4] || "1301,375").split(",").map(Number);
const PLUS_JOURS = Number(process.env.CLOCK_PLUS_JOURS || 0);
const RE_HYDRATATION = /#418|#423|#425|hydrat/i;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const jourSemaineParis = (d) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long" }).format(d).toLowerCase();

// Premier <h1> du HTML brut servi, balises retirées et entités courantes décodées.
function h1Servi(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1]
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

(async () => {
  const aujourdhui = jourSemaineParis(new Date());
  console.log(`aujourd'hui à Paris : ${aujourdhui}${PLUS_JOURS ? ` ; horloge du navigateur avancée de ${PLUS_JOURS} jour(s) (CLOCK_PLUS_JOURS) : ${jourSemaineParis(new Date(Date.now() + PLUS_JOURS * 86400e3))}` : ""}`);
  const browser = await chromium.launch({ headless: true });
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 933 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
    if (PLUS_JOURS) await ctx.clock.setFixedTime(Date.now() + PLUS_JOURS * 86400e3);
    await ctx.addInitScript(() => {
      localStorage.setItem("gleba-cookie-consent", JSON.stringify({ essentiel: true, analytics: false, marketing: false, personnalisation: false, date: new Date().toISOString() }));
      window.__mut = [];
      window.__erreurs = [];
      const re = /#418|#423|#425|hydrat/i;
      const texte = (n) => (n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
      const chemin = (n) => { const out = []; let e = n.nodeType === 1 ? n : n.parentElement; let i = 0; while (e && e !== document.body && i < 5) { out.unshift(e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.split(" ").slice(0, 2).join(".") : "")); e = e.parentElement; i++; } return out.join(">"); };
      const obs = new MutationObserver((ms) => {
        for (const m of ms) {
          if (window.__mut.length >= 80) return;
          if (m.type === "characterData") window.__mut.push({ t: Math.round(performance.now()), type: "texte", ou: chemin(m.target), avant: (m.oldValue || "").slice(0, 90), apres: texte(m.target) });
          else if (m.type === "childList" && (m.removedNodes.length || m.addedNodes.length)) {
            const rm = [...m.removedNodes].map(texte).filter(Boolean);
            const ad = [...m.addedNodes].map(texte).filter(Boolean);
            if (rm.length || ad.length) window.__mut.push({ t: Math.round(performance.now()), type: "noeuds", ou: chemin(m.target), retires: rm.slice(0, 3), ajoutes: ad.slice(0, 3) });
          }
        }
      });
      const brancher = () => obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
      if (document.documentElement) brancher(); else document.addEventListener("readystatechange", brancher, { once: true });
      const ce = console.error.bind(console);
      console.error = (...a) => { const s = a.map(String).join(" "); if (re.test(s)) window.__erreurs.push({ t: Math.round(performance.now()), s: `console.error : ${s.slice(0, 280)}` }); ce(...a); };
      // Production : onRecoverableError → window.reportError → événement « error ».
      window.addEventListener("error", (e) => {
        const s = String((e && (e.message || (e.error && e.error.message))) || "");
        if (re.test(s)) window.__erreurs.push({ t: Math.round(performance.now()), s: `window error : ${s.slice(0, 280)}` });
      });
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
    try { await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }); } catch {
      await page.fill('input[type="email"]', "demo@gleba.fr");
      await page.fill('input[type="password"]', "demo2026");
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
    }
    // Preuve que l'horloge avancée s'applique (le titre de /aujourdhui suit la date
    // servie par l'API quand elle est là, pas l'horloge du navigateur).
    if (PLUS_JOURS) console.log(`horloge du navigateur (${largeur} px) : ${await page.evaluate(() => new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}`);
    for (const chemin of CHEMINS) {
      const consoleErreurs = [];
      const pageErreurs = [];
      const autresErreurs = [];
      const ecoute = (m) => { if (m.type() === "error" && RE_HYDRATATION.test(m.text())) consoleErreurs.push(m.text().slice(0, 200)); };
      const ecouteExceptions = (e) => { const s = String(e && e.message ? e.message : e); (RE_HYDRATATION.test(s) ? pageErreurs : autresErreurs).push(s.replace(/\s+/g, " ").slice(0, 200)); };
      page.on("console", ecoute);
      page.on("pageerror", ecouteExceptions);
      // HTML brut servi pour ce chemin (cookies du contexte : même session).
      let servi = null;
      let dateServie = null;
      let statutServi = "-";
      const estAccueil = new URL(chemin, BASE).pathname === "/aujourdhui";
      try {
        const r = await page.request.get(`${BASE}${chemin}`, { headers: { Accept: "text/html" }, timeout: 60000 });
        statutServi = String(r.status());
        const html = await r.text();
        servi = h1Servi(html);
        if (estAccueil) dateServie = await page.evaluate((texte) => {
          const doc = new DOMParser().parseFromString(texte, "text/html");
          return doc.querySelector('[data-page-entete="aujourdhui"] time[datetime]')?.getAttribute("datetime") ?? null;
        }, html);
      } catch (e) {
        statutServi = `échec ${String(e).slice(0, 80)}`;
      }
      // Armer avant goto : la réponse peut précéder DOMContentLoaded. Lire le
      // GET réellement utilisé par l'accueil évite un second appel et les faux
      // écarts si le jour change pendant la sonde. Le rejet est toujours traité.
      const dateApiPromise = estAccueil ? page.waitForResponse((r) => {
        const url = new URL(r.url());
        return r.request().method() === "GET" && url.origin === new URL(BASE).origin && url.pathname === "/api/accueil/aujourdhui";
      }, { timeout: 20000 }).then(async (r) => {
        if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
        const donnees = await r.json();
        if (typeof donnees?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(donnees.date)) throw new Error("date API absente ou invalide");
        const midi = new Date(`${donnees.date}T12:00:00Z`);
        if (!Number.isFinite(midi.getTime()) || midi.toISOString().slice(0, 10) !== donnees.date) throw new Error("date API hors calendrier");
        return { date: donnees.date, erreur: null };
      }).catch((e) => ({ date: null, erreur: String(e).replace(/\s+/g, " ").slice(0, 180) })) : null;
      await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(8000);
      page.off("console", ecoute);
      page.off("pageerror", ecouteExceptions);
      const affiche = await page.locator("h1").first().innerText({ timeout: 2000 }).then((t) => t.replace(/\s+/g, " ").trim()).catch(() => null);
      const champDate = await page.locator('input[type="date"]').first().inputValue({ timeout: 1000 }).catch(() => null);
      const jourServi = servi ? JOURS.find((j) => new RegExp(`\\b${j}\\b`, "i").test(servi)) || null : null;
      const erreursDate = [];
      let dateApi = null;
      let dateAffichee = null;
      if (estAccueil) {
        const resultat = await dateApiPromise;
        dateApi = resultat.date;
        if (resultat.erreur) erreursDate.push(`API du jour : ${resultat.erreur}`);
        const temps = page.locator('[data-page-entete="aujourdhui"] time[datetime]').first();
        await temps.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
        dateAffichee = await temps.evaluate((el) => ({ date: el.getAttribute("datetime"), texte: (el.textContent || "").replace(/\s+/g, " ").trim() })).catch(() => null);
        if (!dateAffichee) erreursDate.push("date affichée absente (<time datetime>)");
        if (dateApi) {
          if (dateAffichee && dateAffichee.date !== dateApi) erreursDate.push(`date affichée ${JSON.stringify(dateAffichee.date)} différente de l'API ${dateApi}`);
          if (dateServie !== null && dateServie !== dateApi) erreursDate.push(`date HTML servie ${JSON.stringify(dateServie)} différente de l'API ${dateApi}`);
          const libelleAttendu = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dateApi}T12:00:00Z`));
          if (dateAffichee && dateAffichee.texte.toLocaleLowerCase("fr-FR") !== libelleAttendu.toLocaleLowerCase("fr-FR")) erreursDate.push(`texte de la date différent de l'API : ${JSON.stringify(dateAffichee.texte)}`);
        }
      }
      const jourAttendu = dateApi ? jourSemaineParis(new Date(`${dateApi}T12:00:00Z`)) : aujourdhui;
      const dateFigee = Boolean((jourServi && jourServi !== jourAttendu) || erreursDate.length);
      const { mut, err } = await page.evaluate(() => ({ mut: window.__mut, err: window.__erreurs }));
      console.log(`\n===== ${largeur} px ${chemin} → ${page.url()} | erreurs hydratation : ${consoleErreurs.length} (console) / ${err.length} (patch) / ${pageErreurs.length + (dateFigee ? 1 : 0)} (pageerror+date)`);
      console.log(`  h1 servi : ${servi === null ? "(aucun)" : JSON.stringify(servi)} (HTTP ${statutServi})`);
      console.log(`  h1 affiché : ${affiche === null ? "(aucun)" : JSON.stringify(affiche)}${champDate !== null ? ` | premier champ date : ${JSON.stringify(champDate)}` : ""}`);
      if (jourServi) console.log(`  jour nommé par le h1 servi : ${jourServi} ; aujourd'hui : ${jourAttendu}${dateFigee ? " → DATE FIGÉE" : ""}`);
      if (estAccueil) console.log(`  date accueil : API ${JSON.stringify(dateApi)} ; HTML servi ${JSON.stringify(dateServie)} ; affichée ${JSON.stringify(dateAffichee)}${erreursDate.length ? " → DATE INVALIDE" : ""}`);
      for (const erreur of erreursDate) console.log(`  contrôle date : ${erreur}`);
      for (const e of err) console.log(`  [${e.t} ms] ${e.s.replace(/\n/g, " ").slice(0, 160)}`);
      for (const e of pageErreurs) console.log(`  pageerror : ${e}`);
      for (const e of autresErreurs) console.log(`  erreur JS (hors hydratation) : ${e}`);
      if (err.length || consoleErreurs.length || pageErreurs.length || dateFigee) {
        const tErr = err[0]?.t ?? Infinity;
        console.log("  mutations autour de l'erreur :");
        for (const m of mut.filter((m) => m.t <= tErr + 300).slice(0, 40)) {
          if (m.type === "texte") console.log(`   [${m.t}] texte @ ${m.ou} : ${JSON.stringify(m.avant)} → ${JSON.stringify(m.apres)}`);
          else console.log(`   [${m.t}] nœuds @ ${m.ou} : -${JSON.stringify(m.retires)} +${JSON.stringify(m.ajoutes)}`);
        }
      }
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error("échec :", e); process.exit(1); });
