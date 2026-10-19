// Sonde du ticket cmvflvsk4 (2026-10-19, QA 1041x701, Chromium headless) :
// « Fond satellite encore perdu au rechargement ». Rejoue le geste du ticket
// sur /jardin/carte à la taille de la campagne : contrôle Calques ouvert, menu
// partiellement recouvert par la barre « Dessiner une parcelle / Importer du
// cadastre », « Satellite IGN » choisi par son libellé, boutons radio lus
// 5 s après le geste puis après rechargement, contrôle rouvert. Cadastre IGN
// déjà enregistré, comme dans le ticket.
//
// Mesure d'abord le recouvrement (part visible du libellé, élément qui reçoit
// un clic au centre du libellé et au centre du bouton radio), puis rejoue :
//   A   clic Playwright ordinaire sur le libellé (refusé si son centre est recouvert)
//   B   clic souris sur la partie visible du libellé (le geste humain)
//   C   clic forcé au centre du libellé (repli d'un automate après le refus de A)
//   D   dispatchEvent('click') sur le libellé
//   E   clavier seul : focus sur le bouton Layers, Entrée, Tab, flèche bas
//   E2  clavier : Entrée sur Layers, focus sur le radio OpenStreetMap, flèche bas
//   E3  clavier : Entrée sur Layers, focus sur le radio Satellite IGN, Espace
//   F   coche posée par script, sans aucun événement (radio coché, Leaflet
//       ne pose pas le fond, rien n'est écrit tant que la page vit)
//   G   check() Playwright sur le radio (refusé s'il est recouvert)
// Verdicts : OK (Satellite relu après rechargement), PERDU (coché 5 s après le
// geste, perdu après rechargement : le défaut du ticket), NON_COCHE (le geste
// n'a pas coché Satellite, rien à enregistrer : voir le recouvrement), ERREUR
// (geste refusé par Playwright). « carte » donne les couches réellement
// affichées (tuiles), pour comparer ce qui est coché à ce qui est montré.
//
// Attendu avant le correctif du 2026-10-19 (gleba-app:075aae8) : libellé et
// radio en partie sous la barre quand la carte est étroite (rail v2 + liste),
// F PERDU, les gestes qui émettent click, input ou change OK (ou refusés par
// Playwright quand leur cible est recouverte). Après bascule : contrôle sous
// la barre (centreRadio et centreTexte = « libellé », 100 % visible), aucun
// PERDU.
// Un PERDU sur un geste à événement, ou un « stockage » en échec, désigne le
// navigateur (stockage plein ou partagé) et non le geste.
//
// Lecture seule pour les données métier (aucune écriture en base). Variantes :
//   PARCELLE=1      sélectionne d'abord une parcelle de la liste (panneau
//                   ouvert, barre élargie : recouvrement plus fort) ;
//   PROFIL=/chemin  profil Chromium persistant (celui d'un agent QA) : mesure
//                   seulement son stockage et le choix enregistré, sans geste
//                   (GESTES=1 pour rejouer aussi, ce qui réécrit le choix) ;
//   GESTES=A,F      ne rejouer que ces gestes.
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-carte-fond-20261019.cjs
const { chromium } = require(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/node_modules/playwright` : "playwright");
const BASE = process.env.BASE || "https://gleba.fr";
const PROFIL = process.env.PROFIL || "";
const AVEC_PARCELLE = process.env.PARCELLE === "1";
const FILTRE = (process.env.GESTES || "").split(",").map((g) => g.trim()).filter((g) => g && g !== "1");
const VIEWPORT = { width: 1041, height: 701 };
const SAT = "Satellite IGN";
const OSM = "OpenStreetMap";
const CAD = "Cadastre IGN";
const TOGGLE = "a.leaflet-control-layers-toggle";
const TIMEOUT_GESTE = 4000;

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

async function santeStockage(page) {
  return page.evaluate(() => {
    let octets = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      octets += (k.length + (localStorage.getItem(k) || "").length) * 2;
    }
    let ecriture = "ok";
    try {
      localStorage.setItem("gleba_sonde_ecriture", "x".repeat(2048));
      localStorage.removeItem("gleba_sonde_ecriture");
    } catch (e) {
      ecriture = String((e && e.name) || e);
    }
    return {
      cles: localStorage.length,
      koApprox: Math.round(octets / 1024),
      ecriture,
      ls_fond: localStorage.getItem("gleba_carte_fond"),
      ls_calques: localStorage.getItem("gleba_carte_overlays"),
    };
  });
}

async function chargerCarte(page) {
  await page.goto(`${BASE}/jardin/carte`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (AVEC_PARCELLE) {
    const carteParcelle = page.locator('div.cursor-pointer:has(button[title="Centrer sur la parcelle"])').first();
    if (await carteParcelle.count()) {
      await carteParcelle.click({ position: { x: 12, y: 12 } });
      await page.waitForTimeout(800);
    } else {
      console.log("PARCELLE=1 : aucune parcelle dans la liste");
    }
  }
}

// La sortie de la carte enregistre ce qui est coché (correctif du
// 2026-10-19) : on la quitte AVANT de remettre le choix de départ, sur une
// page du même site sans carte.
async function reinitialiser(page) {
  await page.goto(`${BASE}/manifest.json`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([osm, cad]) => {
    localStorage.setItem("gleba_carte_fond", osm);
    localStorage.setItem("gleba_carte_overlays", JSON.stringify([cad]));
  }, [OSM, CAD]);
  await chargerCarte(page);
}

// Ouvre le contrôle comme une souris : survol du bouton Layers (Leaflet
// l'ouvre sur mouseenter) ; repli clavier s'il est recouvert.
async function ouvrirSouris(page) {
  const boite = await page.locator(TOGGLE).boundingBox();
  if (boite) {
    await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await page.waitForTimeout(400);
  }
  let ouvert = await page.evaluate(() => document.querySelector(".leaflet-control-layers").classList.contains("leaflet-control-layers-expanded"));
  if (!ouvert) {
    await page.focus(TOGGLE);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    ouvert = await page.evaluate(() => document.querySelector(".leaflet-control-layers").classList.contains("leaflet-control-layers-expanded"));
    return ouvert ? "clavier (survol recouvert)" : "fermé";
  }
  return "survol";
}

async function ouvrirClavier(page) {
  await page.mouse.move(5, VIEWPORT.height - 5);
  await page.focus(TOGGLE);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
}

// Recouvrement du libellé et du radio « Satellite IGN » (contrôle ouvert).
async function recouvrement(page) {
  return page.evaluate((sat) => {
    const c = document.querySelector(".leaflet-control-layers");
    const label = [...c.querySelectorAll(".leaflet-control-layers-base label")].find((l) => l.textContent.trim() === sat);
    if (!label) return { erreur: "libellé introuvable" };
    const input = label.querySelector("input");
    const texte = label.querySelector("span > span") || label;
    const boite = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), l: Math.round(r.width), h: Math.round(r.height) };
    };
    const decrire = (el) => {
      if (!el) return null;
      if (label.contains(el)) return "libellé";
      const bouton = el.closest("button");
      if (bouton) return `bouton « ${bouton.textContent.trim().slice(0, 40)} »`;
      return `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`;
    };
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    };
    const rl = label.getBoundingClientRect();
    const rt = texte.getBoundingClientRect();
    const y = rl.top + rl.height / 2;
    let total = 0;
    const visibles = [];
    for (let x = rl.left + 1; x < rl.right - 1; x += 3) {
      total++;
      const el = document.elementFromPoint(x, y);
      if (el && label.contains(el)) visibles.push(x);
    }
    // Point visible le plus proche du centre du texte : là où viserait un humain.
    const cx = rt.left + rt.width / 2;
    const surTexte = visibles.filter((x) => x >= rt.left && x <= rt.right);
    const candidats = surTexte.length ? surTexte : visibles;
    const vise = candidats.length ? candidats.reduce((a, b) => (Math.abs(b - cx) < Math.abs(a - cx) ? b : a)) : null;
    const bouton = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Dessiner une parcelle"));
    return {
      carte: boite(document.querySelector(".leaflet-container")),
      controle: boite(c),
      libelle: boite(label),
      barre: bouton ? boite(bouton.parentElement) : null,
      partVisibleLibelle: total ? `${Math.round((100 * visibles.length) / total)} %` : "0 %",
      centreLibelle: decrire(centre(label)),
      centreTexte: decrire(centre(texte)),
      centreRadio: decrire(centre(input)),
      pointVisible: vise === null ? null : { x: Math.round(vise), y: Math.round(y) },
    };
  }, SAT);
}

function verdict(avant, apres, erreur) {
  if (erreur) return "ERREUR";
  if (!avant || avant.fondCoche !== SAT) return "NON_COCHE";
  return apres && apres.fondCoche === SAT ? "OK" : "PERDU";
}

(async () => {
  const options = { viewport: VIEWPORT, locale: "fr-FR", timezoneId: "Europe/Paris" };
  let browser = null;
  let ctx;
  if (PROFIL) {
    ctx = await chromium.launchPersistentContext(PROFIL, { headless: true, ...options });
  } else {
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext(options);
  }
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem("gleba-cookie-consent")) {
        localStorage.setItem("gleba-cookie-consent", JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() }));
      }
    } catch {}
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const consoleMessages = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleMessages.push(`${m.type()}: ${m.text().slice(0, 160)}`);
  });

  await page.goto(`${BASE}/login?demo=1`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  } catch {
    console.log("auto-démo non déclenchée, saisie manuelle");
    await page.fill('input[type="email"]', "demo@gleba.fr");
    await page.fill('input[type="password"]', "demo2026");
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
      page.keyboard.press("Enter"),
    ]);
  }
  console.log("après login:", page.url());

  // Stockage du navigateur AVANT toute remise à zéro : dans un profil d'agent
  // QA, un stockage plein ou refusé suffit à perdre le choix.
  await page.goto(`${BASE}/manifest.json`, { waitUntil: "domcontentloaded" });
  console.log("stockage:", JSON.stringify(await santeStockage(page)));
  if (PROFIL && process.env.GESTES === undefined) {
    await chargerCarte(page);
    console.log("choix relu dans ce profil:", JSON.stringify(await etat(page)));
    await ctx.close();
    if (browser) await browser.close();
    return;
  }

  await reinitialiser(page);
  console.log("état initial:", JSON.stringify(await etat(page)));
  console.log("ouverture:", await ouvrirSouris(page));
  const mesure = await recouvrement(page);
  console.log("recouvrement:", JSON.stringify(mesure));

  const libelle = () => page.getByText(SAT, { exact: true });
  const gestes = {
    A_libelle_clic: async () => {
      await ouvrirSouris(page);
      await libelle().click({ timeout: TIMEOUT_GESTE });
    },
    B_libelle_partie_visible: async () => {
      await ouvrirSouris(page);
      const m = await recouvrement(page);
      if (!m.pointVisible) throw new Error("aucune partie visible du libellé");
      await page.mouse.click(m.pointVisible.x, m.pointVisible.y);
    },
    C_libelle_clic_force: async () => {
      await ouvrirSouris(page);
      await libelle().click({ force: true, timeout: TIMEOUT_GESTE });
    },
    D_libelle_dispatchEvent: async () => {
      await ouvrirSouris(page);
      await libelle().dispatchEvent("click");
    },
    E_clavier_tab_fleche: async () => {
      await ouvrirClavier(page);
      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowDown");
    },
    E2_clavier_focus_osm_fleche: async () => {
      await ouvrirClavier(page);
      await page.getByRole("radio", { name: OSM }).focus();
      await page.keyboard.press("ArrowDown");
    },
    E3_clavier_focus_satellite_espace: async () => {
      await ouvrirClavier(page);
      await page.getByRole("radio", { name: SAT }).focus();
      await page.keyboard.press("Space");
    },
    F_coche_par_script_sans_evenement: async () => {
      await ouvrirSouris(page);
      await page.evaluate((sat) => {
        const inp = [...document.querySelectorAll(".leaflet-control-layers-base input")].find((i) => i.closest("label").textContent.trim() === sat);
        inp.checked = true;
      }, SAT);
    },
    G_radio_check: async () => {
      await ouvrirSouris(page);
      await page.getByRole("radio", { name: SAT }).check({ timeout: TIMEOUT_GESTE });
    },
  };

  const bilan = {};
  for (const [nom, action] of Object.entries(gestes)) {
    if (FILTRE.length && !FILTRE.some((f) => nom === f || nom.startsWith(`${f}_`))) continue;
    await reinitialiser(page);
    const depart = consoleMessages.length;
    let erreur = null;
    try {
      await action();
    } catch (e) {
      erreur = e.message.split("\n")[0].slice(0, 160);
    }
    await page.waitForTimeout(300);
    const t03 = await etat(page);
    await page.waitForTimeout(5000);
    const avant = await etat(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".leaflet-control-layers", { timeout: 30000 });
    await page.waitForTimeout(2000);
    await ouvrirSouris(page);
    const apres = await etat(page);
    const v = verdict(avant, apres, erreur);
    bilan[v] = (bilan[v] || 0) + 1;
    const cadastre = apres.calquesCoches && apres.calquesCoches.includes(CAD) ? "Cadastre conservé" : "Cadastre PERDU";
    console.log(`${nom} [${v}] ${cadastre}${erreur ? `\n   erreur: ${erreur}` : ""}`);
    console.log("   t+0,3s :", JSON.stringify(t03));
    console.log("   t+5s   :", JSON.stringify(avant));
    console.log("   reload :", JSON.stringify(apres));
    const nouveaux = consoleMessages.slice(depart).filter((m) => /Carte|stockage|storage|quota/i.test(m));
    if (nouveaux.length) console.log("   console:", nouveaux.slice(0, 3));
  }
  console.log("bilan:", JSON.stringify(bilan), bilan.PERDU ? "→ DÉFAUT REPRODUIT" : "→ aucun choix coché perdu au rechargement");
  console.log("console (erreurs et avertissements):", consoleMessages.length, consoleMessages.slice(0, 5));
  await ctx.close();
  if (browser) await browser.close();
})().catch((e) => {
  console.error("ECHEC", e);
  process.exit(1);
});
