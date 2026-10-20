// Sonde du ticket cmvgebfkr (2026-10-20, QA 1686x951, Chrome 155) : « Satellite
// IGN perdu au rechargement », recontrôle de cmvflvsk4 (FB-UTUBCT). Rejoue le
// parcours du ticket dans un contexte neuf (aucune préférence enregistrée) :
// « Layers » ouvert par un CLIC sur son bouton, Cadastre IGN puis Satellite IGN
// cochés par un clic réel sur leur libellé, 5 s d'attente, rechargement, puis
// « Layers » ROUVERT par un clic sur son bouton, comme le fait la QA.
//
// Diagnostic du 2026-10-20 : le choix est bien enregistré et restauré (stockage
// relu au chargement = Satellite IGN, radio et tuiles Satellite). Il est perdu
// à la RÉOUVERTURE : le contrôle Calques de Leaflet s'ouvre au survol et son
// bouton disparaît (display: none) ; le clic qui visait « Layers » tombe alors
// sur la première ligne du menu ouvert, le libellé « OpenStreetMap ». Rapide
// (même tâche que l'ouverture), il est annulé par la garde `_expandSafely` de
// Leaflet puis rejoué par MapContainer (correctif cmv5cpu7q) ; lent (geste
// humain), Leaflet l'applique directement. Dans les deux cas OpenStreetMap est
// coché et enregistré. Les sondes précédentes rouvraient par survol.
//
// Pour chaque taille d'écran (VP, liste « LxH » séparée par des virgules) et
// chaque façon de rouvrir :
//   clic_rapide  clic souris au centre du bouton (déplacement, appui, relâche)
//   clic_lent    souris posée sur le bouton, 400 ms, puis appui et relâche
//   double_clic  double clic sur le bouton
//   survol       survol seul (témoin : passait déjà avant le correctif)
// Verdicts : OK ; PERDU_AU_RECHARGEMENT (Satellite non restauré : écriture ou
// restauration en défaut) ; PERDU_A_LA_REOUVERTURE (restauré, puis remplacé
// par le clic sur « Layers » : le défaut du ticket) ; NON_COCHE (le geste n'a
// pas coché Satellite) ; ERREUR. « sousBouton » nomme ce qui se trouve sous le
// centre du bouton une fois le menu ouvert : « bouton Layers » attendu.
//
// Attendu sur gleba-app:5beb523 (prod du 2026-10-20) : clic_rapide, clic_lent
// et double_clic PERDU_A_LA_REOUVERTURE, survol OK, sousBouton = libellé
// OpenStreetMap. Après bascule du correctif : tout OK, sousBouton = bouton.
// CSS_CORRECTIF=1 injecte la règle du correctif dans la page servie (aperçu
// du correctif sur la production avant bascule).
//
// Contextes neufs, aucune écriture en base ; rien ne reste dans un profil.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-carte-fond-20261020.cjs
//   VP=1686x951 REOUV=clic_rapide,survol CSS_CORRECTIF=1 ... (variantes)
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const VIEWPORTS = (process.env.VP || "1686x951,1280x720,1920x1080,1041x701").split(",").map((v) => {
  const [width, height] = v.trim().split("x").map(Number);
  return { width, height };
});
const REOUVERTURES = (process.env.REOUV || "clic_rapide,clic_lent,double_clic,survol").split(",").map((r) => r.trim());
const CSS_CORRECTIF = process.env.CSS_CORRECTIF === "1";
const SAT = "Satellite IGN";
const CAD = "Cadastre IGN";
const TOGGLE = "a.leaflet-control-layers-toggle";
// Même règle que la classe posée par MapContainer (bouton « Layers » laissé en
// place, menu ouvert dessous) ; sélecteur équivalent pour l'aperçu.
const REGLE_CORRECTIF =
  ".leaflet-container .leaflet-control-layers-expanded .leaflet-control-layers-toggle{display:block;margin:-6px -10px 0 auto}";

async function etat(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".leaflet-control-layers");
    const nom = (i) => (i.closest("label") ? i.closest("label").textContent.trim() : null);
    const base = c && c.querySelector(".leaflet-control-layers-base input:checked");
    const genre = (src) =>
      /ORTHOIMAGERY/.test(src) ? "Satellite IGN" : /PLANIGNV2/.test(src) ? "Plan IGN" : /CADASTRALPARCELS/.test(src) ? "Cadastre IGN" : /openstreetmap/.test(src) ? "OpenStreetMap" : "?";
    return {
      fondCoche: base ? nom(base) : null,
      calquesCoches: c ? [...c.querySelectorAll(".leaflet-control-layers-overlays input:checked")].map(nom) : null,
      carte: [...document.querySelectorAll(".leaflet-tile-pane .leaflet-layer")].map((l) => {
        const img = l.querySelector("img");
        return img ? genre(img.src) : "(sans tuile)";
      }),
      ouvert: !!c && c.classList.contains("leaflet-control-layers-expanded"),
      ls_fond: localStorage.getItem("gleba_carte_fond"),
      ls_calques: localStorage.getItem("gleba_carte_overlays"),
    };
  });
}

const estOuvert = (page) =>
  page.evaluate(() => document.querySelector(".leaflet-control-layers").classList.contains("leaflet-control-layers-expanded"));

// Ce qui reçoit un clic au point donné (menu ouvert).
async function sousLePoint(page, x, y) {
  return page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return null;
    if (el.closest("a.leaflet-control-layers-toggle")) return "bouton Layers";
    const label = el.closest(".leaflet-control-layers label");
    if (label) return `libellé ${label.textContent.trim()}`;
    return `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`;
  }, [x, y]);
}

// Souris éloignée du contrôle (le menu se referme), puis geste sur le bouton.
async function ouvrir(page, facon, viewport) {
  await page.mouse.move(5, viewport.height - 5);
  await page.waitForTimeout(300);
  const b = await page.locator(TOGGLE).boundingBox();
  if (!b) throw new Error("bouton Layers introuvable");
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  if (facon === "clic_rapide") await page.mouse.click(x, y);
  else if (facon === "double_clic") await page.mouse.dblclick(x, y);
  else if (facon === "clic_lent") {
    await page.mouse.move(x, y);
    await page.waitForTimeout(400);
    await page.mouse.down();
    await page.mouse.up();
  } else await page.mouse.move(x, y);
  await page.waitForTimeout(400);
  return { ouvert: await estOuvert(page), sousBouton: await sousLePoint(page, x, y) };
}

async function cocherParLibelle(page, texte) {
  await page.locator(".leaflet-control-layers label", { hasText: texte }).first().click({ timeout: 4000 });
}

async function connecter(page) {
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
}

async function chargerCarte(page) {
  await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
  await page.waitForTimeout(2000);
}

function verdict(t5, recharge, rouvert, erreur) {
  if (erreur) return "ERREUR";
  if (!t5 || t5.fondCoche !== SAT) return "NON_COCHE";
  if (!recharge || recharge.fondCoche !== SAT || recharge.ls_fond !== SAT) return "PERDU_AU_RECHARGEMENT";
  if (!rouvert || rouvert.fondCoche !== SAT || rouvert.ls_fond !== SAT) return "PERDU_A_LA_REOUVERTURE";
  return "OK";
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const bilan = {};
  const lignes = [];
  for (const viewport of VIEWPORTS) {
    for (const facon of REOUVERTURES) {
      // Contexte neuf : aucune préférence de fond ni de calque.
      const ctx = await browser.newContext({ viewport, locale: "fr-FR", timezoneId: "Europe/Paris" });
      await ctx.addInitScript(
        ([css, regle]) => {
          try {
            if (!localStorage.getItem("gleba-cookie-consent")) {
              localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() }));
            }
            window.__sondeStockageAuChargement = localStorage.getItem("gleba_carte_fond");
          } catch {}
          if (css) {
            const poser = () => {
              const s = document.createElement("style");
              s.textContent = regle;
              document.head.appendChild(s);
            };
            if (document.head) poser();
            else document.addEventListener("DOMContentLoaded", poser);
          }
        },
        [CSS_CORRECTIF, REGLE_CORRECTIF],
      );
      const page = await ctx.newPage();
      const avertissements = [];
      page.on("console", (m) => {
        if (m.type() === "warning" && /Carte/.test(m.text())) avertissements.push(m.text().slice(0, 140));
      });
      let erreur = null;
      let premiere = null;
      let reouverture = null;
      let t5 = null;
      let recharge = null;
      let rouvert = null;
      let stockageAuChargement = null;
      try {
        await connecter(page);
        await page.goto(`${BASE}/jardin/carte`, { waitUntil: "domcontentloaded" });
        await chargerCarte(page);
        const depart = await etat(page);
        if (depart.ls_fond !== null || depart.ls_calques !== null) throw new Error(`contexte non vierge : ${JSON.stringify(depart)}`);
        premiere = await ouvrir(page, "clic_rapide", viewport);
        await cocherParLibelle(page, CAD);
        await page.waitForTimeout(800);
        if (!(await estOuvert(page))) await ouvrir(page, "survol", viewport);
        await cocherParLibelle(page, SAT);
        await page.waitForTimeout(5000);
        t5 = await etat(page);
        await page.reload({ waitUntil: "domcontentloaded" });
        await chargerCarte(page);
        stockageAuChargement = await page.evaluate(() => window.__sondeStockageAuChargement);
        recharge = await etat(page);
        reouverture = await ouvrir(page, facon, viewport);
        await page.waitForTimeout(600);
        rouvert = await etat(page);
      } catch (e) {
        erreur = e.message.split("\n")[0].slice(0, 160);
      }
      const v = verdict(t5, recharge, rouvert, erreur);
      bilan[v] = (bilan[v] || 0) + 1;
      const cadastre = rouvert && rouvert.calquesCoches && rouvert.calquesCoches.includes(CAD) ? "Cadastre conservé" : "Cadastre PERDU";
      lignes.push(`${viewport.width}x${viewport.height} ${facon}: ${v}`);
      console.log(`${viewport.width}x${viewport.height} réouverture ${facon} [${v}] ${cadastre}${erreur ? `\n   erreur: ${erreur}` : ""}`);
      console.log("   1re ouverture (clic) :", JSON.stringify(premiere));
      console.log("   t+5s                 :", JSON.stringify(t5));
      console.log("   stockage au chargement:", JSON.stringify(stockageAuChargement));
      console.log("   rechargé             :", JSON.stringify(recharge));
      console.log("   réouverture          :", JSON.stringify(reouverture));
      console.log("   après réouverture    :", JSON.stringify(rouvert));
      if (avertissements.length) console.log("   console:", avertissements.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(CSS_CORRECTIF ? "(aperçu : règle du correctif injectée)" : "(page servie telle quelle)");
  console.log("bilan:", JSON.stringify(bilan), bilan.PERDU_A_LA_REOUVERTURE || bilan.PERDU_AU_RECHARGEMENT ? "→ DÉFAUT REPRODUIT" : "→ fond conservé");
  console.log(lignes.join("\n"));
})().catch((e) => {
  console.error("ECHEC", e);
  process.exit(1);
});
