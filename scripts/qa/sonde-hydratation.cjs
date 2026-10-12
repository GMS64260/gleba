// Sonde générique : localiser une erreur d'hydratation React (#418, #423, #425)
// sur des pages de production. Un MutationObserver est posé avant tout script
// (addInitScript) : la réparation d'hydratation remplace les nœuds rendus par le
// serveur (removedNodes) par le rendu client, et console.error est enveloppé
// pour dater l'erreur. Compte démo, lecture seule : la page n'est que chargée.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-hydratation.cjs [BASE] [chemins] [largeurs]
//   ex. : node scripts/qa/sonde-hydratation.cjs https://gleba.fr "/aujourdhui,/maraichage" "1301,375"
// 2026-10-12 : un #418 (texte) vu une fois sur /aujourdhui après la bascule de
// 09:08 UTC n'a pas été reproduit sur 20 chargements (6 chemins, 2 largeurs).
const { chromium } = require(`${process.env.PLAYWRIGHT_DIR || "/var/www/escalier"}/node_modules/playwright`);
const BASE = process.argv[2] || "https://gleba.fr";
const CHEMINS = (process.argv[3] || "/aujourdhui,/maraichage").split(",");
const LARGEURS = (process.argv[4] || "1301,375").split(",").map(Number);

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 933 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
    await ctx.addInitScript(() => {
      localStorage.setItem("gleba-cookie-consent", JSON.stringify({ essentiel: true, analytics: false, marketing: false, personnalisation: false, date: new Date().toISOString() }));
      window.__mut = [];
      window.__erreurs = [];
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
      console.error = (...a) => { const s = a.map(String).join(" "); if (/#418|#423|#425|Hydration|hydrat/i.test(s)) window.__erreurs.push({ t: Math.round(performance.now()), s: s.slice(0, 300) }); ce(...a); };
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
    try { await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }); } catch {
      await page.fill('input[type="email"]', "demo@gleba.fr");
      await page.fill('input[type="password"]', "demo2026");
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
    }
    for (const chemin of CHEMINS) {
      const consoleErreurs = [];
      const ecoute = (m) => { if (m.type() === "error" && /#418|#423|#425|hydrat/i.test(m.text())) consoleErreurs.push(m.text().slice(0, 200)); };
      page.on("console", ecoute);
      await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(8000);
      page.off("console", ecoute);
      const { mut, err } = await page.evaluate(() => ({ mut: window.__mut, err: window.__erreurs }));
      console.log(`\n===== ${largeur} px ${chemin} → ${page.url()} | erreurs hydratation : ${consoleErreurs.length} (console) / ${err.length} (patch)`);
      for (const e of err) console.log(`  [${e.t} ms] ${e.s.replace(/\n/g, " ").slice(0, 160)}`);
      if (err.length || consoleErreurs.length) {
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
