#!/usr/bin/env node
// Sonde cumulative (2026-10-25) : rejoue en production, l'une après l'autre,
// les sondes navigateur des lots précédents, pour voir si un correctif déjà
// livré a régressé. Compte démo public, Playwright emprunté à /var/www/escalier.
//
// USAGE
//   node scripts/qa/sonde-cumulative.cjs --lister
//   PLAYWRIGHT_DIR=/var/www/escalier node scripts/qa/sonde-cumulative.cjs \
//     [--base=https://gleba.fr] [--seulement=carte-fond-20261020,lot-20261013] [--rapport=<dossier>]
//   --lister     table des sondes (classe, lot, tickets, verdict, écritures, coût),
//                sans rien lancer ni rien écrire.
//   --seulement  ne rejoue que ces sondes (noms de --lister), dans l'ordre de la table.
//   --base       site sondé (défaut https://gleba.fr). Les sondes de classe b visent
//                des objets de la démo de PRODUCTION : sur un banc, elles échouent.
//   --rapport    dossier du rapport : rapport-<horodatage>.json, et dans
//                <horodatage>/ un journal par sonde (stdout + stderr) et les captures.
//                Défaut : scratchpad de la session du 2026-10-25, sous /tmp (tmpfs,
//                vidé au redémarrage) : passer un dossier durable pour garder l'historique.
//
// QUAND LE LANCER
//   - après chaque bascule, une fois faite la preuve du lot du jour ;
//   - un autre jour que celui du build pour les défauts de prérendu : une page
//     prérendue fige la date du build, le #418 (cmvnnwr70) est invisible le jour même ;
//   - jamais pendant une campagne QA (des sondes écrivent sur la démo et liraient
//     les objets des agents), un build, ni à côté d'un autre Chromium.
//
// CE QU'IL FAIT
//   - une sonde à la fois (jamais deux navigateurs), chacune en sous-processus avec
//     PLAYWRIGHT_DIR et BASE transmis ; les variables d'injection ou de variante
//     (CSS_CORRECTIF, PROFIL, GESTES, PARCELLE, VP, REOUV, CULTURE_ID, OUT_DIR,
//     CLOCK_PLUS_JOURS) sont retirées de l'environnement hérité : on sonde la page
//     servie telle quelle (CLOCK_PLUS_JOURS n'est rendu qu'à la sonde hydratation) ;
//   - délai maximal par sonde (4 min par défaut, réglé dans SONDES) : SIGINT, puis
//     SIGKILL du processus et de ses Chromium 15 s plus tard ;
//   - garde-fou mémoire : avant chaque sonde, MemAvailable (/proc/meminfo) doit
//     dépasser 700 Mo ; sinon attente (10 min au plus, en le disant), puis arrêt de
//     la campagne. Pendant une sonde, sous 250 Mo, la sonde est arrêtée et la
//     campagne aussi ;
//   - verdict de chaque sonde : code de sortie + lecture de sa sortie par l'analyseur
//     déclaré dans SONDES. « natif » = le verdict que la sonde imprime (lignes OK/KO,
//     bilan) ; « dérivé » = valeurs imprimées comparées par le lanceur à l'attendu
//     écrit en tête de la sonde ou dans le vault (à confirmer au premier passage) ;
//   - tableau final (sonde, lot, verdict, durée, dernière ligne utile), objets
//     restés en base (« À NETTOYER »), rapport JSON.
//
// VERDICTS
//   OK ; RÉGRESSION (classe a : un contrôle lit la valeur fautive) ; ILLISIBLE
//   (classe a : sonde plantée, contrôle non vu, à trier) ; À TRIER (état de la démo ?)
//   (classe b, tout échec : jamais appelé régression, le tri reste humain) ;
//   HORS DÉLAI ; NON LANCÉE / ARRÊTÉE (mémoire ou interruption).
//   Code de sortie : 0 tout OK ; 1 au moins une sonde non OK ; 2 campagne incomplète
//   (mémoire, interruption) sans autre échec, ou lanceur empêché (option, Playwright).
//
// ÉCRITURES EN PRODUCTION (à dire après chaque passage)
//   - chaque connexion démo écrit une ligne `login_logs` (≈ 25 par passage complet,
//     nombre exact et fenêtre horaire dans le rapport, pour les retrouver par id) ;
//   - écrivent puis défont : suppression-arbre (arbre + opération), dates-culture et
//     dates-avant-plantation (cultures « QA sonde dates »), lot-20261011b et
//     lot-20261011c (arrosages notés puis annulés ; lot-20261011c annule par l'API si
//     le toast échoue, « annulation (repli API) ») ; ce qui n'est pas défait est listé
//     « À NETTOYER » avec son identifiant ;
//   - une sonde qui journalise « erreur JS : … #418 » reçoit une note : la page a été
//     re-rendue côté client, un clic juste après le chargement a pu être perdu ;
//   - n'écrivent qu'en cas de régression : lot-20261020 (espèce « sonde-v8-rendement »,
//     non supprimée, signalée), lot-20261013b (PATCH défait aussitôt).
//
// CE QU'IL NE COUVRE PAS
//   - les lots sans sonde : tout ce qui précède le 2026-10-10 ; la part du lot gleba-0c
//     du 2026-10-10 prouvée à la main (planche refusée en 409, arbre Cerisier → Pommier,
//     `?sub=lots` après F5, carte au zoom 18…) ; la zone privée de l'assistant (lots du
//     19 et du 23/10) ; le lot du 2026-10-25 (15 tickets, déployé le jour même : sa
//     sonde reste à écrire, puis à ajouter dans SONDES) ;
//   - les comptes autres que la démo (admin, vrais comptes, isolation entre
//     exploitations), le téléphone réel et l'appli Android, les courriels, la boutique ;
//   - ce qu'une sonde ne mesure pas : un vert prouve ses contrôles, pas l'écran entier ;
//     les sondes API des lots du 19 au 23/10 ne regardent pas l'écran ;
//   - une démo remise à zéro ou nettoyée rend caduques les sondes de classe b.
//
// ÉCARTÉES (classe c, détail dans ECARTEES et dans --lister)
//   - scripts/verif-navigateur-carte-fond.cjs : BASE figée, attend `networkidle`
//     (jamais atteint sur gleba.fr), aucun verdict ; remplacée par les carte-fond.
//   - sonde-soin-rappel.cjs : diagnostic d'un ticket non reproduit, sans correctif à
//     surveiller ; variantes clavier vouées à l'échec sans interface ; écrit des soins.
//   - sonde-dates-culture-recolte.cjs, mode « recolte » : exige CULTURE_ID d'une culture
//     démo déjà récoltée (témoin) ; les modes « culture » et « avant-plantation » restent.
//   - verif-personnaliser.mjs : si la garde démo régressait, « Terminer » réécrirait la
//     disposition de l'accueil de la démo sans retour possible ; JSON sans verdict.
//   - verif-registres.mjs : preuve d'une conversion (pas d'un correctif), JSON sans
//     verdict, débordement préexistant de /taches à 390 px : bruit à chaque passage.
//
// AJOUTER UNE SONDE : une entrée dans SONDES (fichier, lot, tickets, classe, coût,
// connexions, arguments, analyseur). Une sonde qui imprime « OK  … » / « KO  … » et
// sort en 1 sur un KO se branche sur verdictOkKo sans autre code.
"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..", "..");
const RAPPORT_DEFAUT = "/tmp/claude-1000/-var-www-gleba/0251a7be-cc93-47b6-a841-23c7aa5eb5f8/scratchpad/sonde-cumulative/";
const BASE_DEFAUT = "https://gleba.fr";
const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR || "/var/www/escalier";
const MEMOIRE_MIN_MO = 700;
const MEMOIRE_PLANCHER_MO = 250;
const ATTENTE_MEMOIRE_MS = 10 * 60_000;
const DELAI_DEFAUT_MS = 4 * 60_000;
const GRACE_MS = 15_000;
const SORTIE_MAX = 2_000_000;
const VARIABLES_RETIREES = ["CSS_CORRECTIF", "PROFIL", "GESTES", "PARCELLE", "VP", "REOUV", "CULTURE_ID", "OUT_DIR", "BASE", "CLOCK_PLUS_JOURS"];

// ---------------------------------------------------------------- analyseurs

const reussi = (code) => /^2\d\d$/.test(String(code));

// Jour civil à Paris d'une date envoyée ou stockée (« 2026-10-25 » ou ISO UTC).
function jourParis(valeur) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return valeur;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Blocs « ===== titre » imprimés par les sondes à étapes.
function decouperBlocs(sortie) {
  const blocs = [];
  let courant = { titre: "", texte: "" };
  for (const ligne of sortie.split("\n")) {
    const m = ligne.match(/^===== (.*)$/);
    if (m) {
      blocs.push(courant);
      courant = { titre: m[1].trim(), texte: "" };
    } else courant.texte += `${ligne}\n`;
  }
  blocs.push(courant);
  return blocs;
}

const etapesPlantees = (sortie) => (sortie.match(/^(échec|ERREUR) .*$/gm) || []).map((l) => l.slice(0, 160));

// Une règle : { nom, re, ok(m), bloc?, tous?, facultatif? }. Non vue → « absent »
// (illisible) ; vue avec une mauvaise valeur → « faux » (échec) ; facultative non
// vue → « non_observe » (ne compte pas).
function controler(sortie, regles) {
  const blocs = decouperBlocs(sortie);
  return regles.map((r) => {
    const texte = r.bloc ? blocs.filter((b) => b.titre.startsWith(r.bloc)).map((b) => b.texte).join("\n") : sortie;
    const absent = { nom: r.nom, etat: r.facultatif ? "non_observe" : "absent" };
    if (r.tous) {
      const re = new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : `${r.re.flags}g`);
      const vus = [...texte.matchAll(re)];
      if (!vus.length) return absent;
      const faux = vus.filter((m) => !r.ok(m));
      return { nom: r.nom, etat: faux.length ? "faux" : "ok", vu: (faux[0] || vus[0])[0].trim().slice(0, 160) };
    }
    const m = texte.match(r.re);
    if (!m) return absent;
    return { nom: r.nom, etat: r.ok(m) ? "ok" : "faux", vu: m[0].trim().slice(0, 160) };
  });
}

function conclure(controles, { code, plantees = [], residus = [], notes = [] }) {
  const comptes = controles.filter((c) => c.etat !== "non_observe");
  const bons = comptes.filter((c) => c.etat === "ok").length;
  const faux = controles.filter((c) => c.etat === "faux");
  const absents = controles.filter((c) => c.etat === "absent");
  const compte = `${bons}/${comptes.length}`;
  if (faux.length) {
    return { statut: "ECHEC", compte, detail: `valeur fautive : ${faux.map((c) => `${c.nom} [${c.vu}]`).join(" ; ")}`, controles, residus };
  }
  if (absents.length || plantees.length || code !== 0 || !comptes.length) {
    const raisons = [
      absents.length && `non vu : ${absents.map((c) => c.nom).join(" ; ")}`,
      plantees.length && `plantée : ${plantees.join(" ; ")}`,
      code !== 0 && `code de sortie ${code}`,
      !comptes.length && "aucun contrôle lisible",
    ].filter(Boolean);
    return { statut: "INDETERMINE", compte, detail: raisons.join(" | "), controles, residus };
  }
  return { statut: "OK", compte, detail: [`${compte} contrôles conformes`, ...notes].join(" ; "), controles, residus };
}

const parRegles = (regles, residus) => (sortie, code) =>
  conclure(controler(sortie, regles), { code, plantees: etapesPlantees(sortie), residus: residus ? residus(sortie) : [] });

// Sondes qui impriment « OK  nom — détail » / « KO  nom — détail » et sortent en 1
// sur un KO (lots du 13/10 au 23/10). Les lignes « INFO » (cas absent de la démo)
// sont comptées à part.
function verdictOkKo(residus) {
  return (sortie, code) => {
    const lignes = [...sortie.matchAll(/^(OK|KO) {2,}(.*)$/gm)];
    const ko = lignes.filter((m) => m[1] === "KO");
    const infos = (sortie.match(/^INFO /gm) || []).length;
    const compte = `${lignes.length - ko.length}/${lignes.length}`;
    const controles = lignes.map((m) => ({ nom: m[2].split(" — ")[0].trim(), etat: m[1] === "OK" ? "ok" : "faux", vu: m[2].trim().slice(0, 160) }));
    const r = residus ? residus(sortie) : [];
    const info = infos ? ` ; ${infos} cas absents de la démo (INFO)` : "";
    if (ko.length) return { statut: "ECHEC", compte, detail: `KO : ${ko.map((m) => m[2].trim().slice(0, 120)).join(" ; ")}`, controles, residus: r };
    if (code !== 0 || !lignes.length) {
      const fin = (sortie.trim().split("\n").pop() || "").slice(0, 120);
      return { statut: "INDETERMINE", compte, detail: `plantée avant le bilan (code ${code}) ; dernière ligne : ${fin}`, controles, residus: r };
    }
    return { statut: "OK", compte, detail: `${compte} vérifications OK${info}`, controles, residus: r };
  };
}

// Verdicts par geste « nom [OK|PERDU|…] » des sondes de la carte.
function gestesCarte(sortie, re) {
  const vus = [...sortie.matchAll(re)].map((m) => ({ nom: m[1], verdict: m[2], cadastre: m[3] || "" }));
  const par = (v) => vus.filter((g) => g.verdict.startsWith(v)).map((g) => g.nom);
  return { vus, ok: par("OK"), perdus: par("PERDU"), autres: vus.filter((g) => !g.verdict.startsWith("OK") && !g.verdict.startsWith("PERDU")).map((g) => `${g.nom} ${g.verdict}`), cadastrePerdu: vus.filter((g) => /Cadastre PERDU/.test(g.cadastre)).map((g) => g.nom) };
}

function verdictCarte({ g, code, attendus, extraEchec = [], extraDoute = [] }) {
  const compte = `${g.ok.length}/${g.vus.length}`;
  const controles = g.vus.map((x) => ({ nom: x.nom, etat: x.verdict === "OK" ? "ok" : x.verdict.startsWith("PERDU") ? "faux" : "absent", vu: x.verdict }));
  if (g.perdus.length || extraEchec.length) {
    return { statut: "ECHEC", compte, detail: [g.perdus.length && `fond perdu : ${g.perdus.join(", ")}`, ...extraEchec].filter(Boolean).join(" ; "), controles, residus: [] };
  }
  const doutes = [
    g.autres.length && `sans verdict OK : ${g.autres.join(", ")}`,
    g.cadastrePerdu.length && `Cadastre perdu (hors verdict d'origine) : ${g.cadastrePerdu.join(", ")}`,
    g.vus.length < attendus && `${g.vus.length} gestes lus sur ${attendus}`,
    code !== 0 && `code de sortie ${code}`,
    ...extraDoute,
  ].filter(Boolean);
  if (doutes.length) return { statut: "INDETERMINE", compte, detail: doutes.join(" ; "), controles, residus: [] };
  return { statut: "OK", compte, detail: `${compte} gestes : fond gardé`, controles, residus: [] };
}

function analyserCarte20261013(sortie, code) {
  const g = gestesCarte(sortie, /^(\w+) \[(OK|PERDU)\]()/gm);
  const erreurs = [...sortie.matchAll(/^(\w+) ERREUR action/gm)].map((m) => `${m[1]} geste refusé`);
  return verdictCarte({ g, code, attendus: 8, extraDoute: erreurs });
}

function analyserCarte20261019(sortie, code) {
  const g = gestesCarte(sortie, /^(\w+) \[(OK|PERDU|NON_COCHE|ERREUR)\]( Cadastre \S+)?/gm);
  const extraEchec = [];
  const extraDoute = [];
  const rec = sortie.match(/^recouvrement: (\{.*\})$/m);
  if (!rec) extraDoute.push("mesure du recouvrement absente");
  else {
    try {
      const m = JSON.parse(rec[1]);
      if (m.erreur) extraDoute.push(`recouvrement : ${m.erreur}`);
      else if (m.centreRadio !== "libellé" || m.centreTexte !== "libellé") extraEchec.push(`contrôle Calques recouvert (radio : ${m.centreRadio}, texte : ${m.centreTexte}, visible ${m.partVisibleLibelle})`);
    } catch {
      extraDoute.push("recouvrement illisible");
    }
  }
  if (!/^bilan: /m.test(sortie)) extraDoute.push("bilan absent");
  return verdictCarte({ g, code, attendus: 9, extraEchec, extraDoute });
}

function analyserCarte20261020(sortie, code) {
  const g = gestesCarte(sortie, /^(\d+x\d+ réouverture \w+) \[(\w+)\]( Cadastre \S+)?/gm);
  const extraDoute = [];
  if (!/^\(page servie telle quelle\)$/m.test(sortie)) extraDoute.push("règle du correctif injectée ou fin absente : la page n'a pas été sondée telle quelle");
  if (!/^bilan: /m.test(sortie)) extraDoute.push("bilan absent");
  return verdictCarte({ g, code, attendus: 4, extraDoute });
}

const HYDRATATION_CHEMINS = ["/aujourdhui", "/tracabilite", "/maraichage/recoltes/saisie", "/maraichage"];
const HYDRATATION_LARGEURS = [1346, 375];

// Troisième compteur « / N (pageerror+date) » depuis le 2026-10-25 (facultatif pour
// relire les anciens journaux) : le #418 de production passe par window.reportError
// (pageerror), jamais par la console ; un <h1> servi qui nomme un autre jour que
// celui de Paris compte comme date figée au build.
function analyserHydratation(sortie, code) {
  const pages = [...sortie.matchAll(/^===== (\d+) px (\S+) → (\S+) \| erreurs hydratation : (\d+) \(console\) \/ (\d+) \(patch\)(?: \/ (\d+) \(pageerror\+date\))?/gm)].map((m) => ({
    page: `${m[2]} @${m[1]}`,
    arrivee: m[3],
    erreurs: Number(m[4]) + Number(m[5]) + Number(m[6] || 0),
  }));
  const attendues = HYDRATATION_CHEMINS.length * HYDRATATION_LARGEURS.length;
  const fautives = pages.filter((p) => p.erreurs > 0);
  const deconnectees = pages.filter((p) => /\/login/.test(p.arrivee));
  const controles = pages.map((p) => ({ nom: p.page, etat: p.erreurs ? "faux" : /\/login/.test(p.arrivee) ? "absent" : "ok", vu: `${p.erreurs} erreur(s), arrivée ${p.arrivee}` }));
  const compte = `${pages.length - fautives.length}/${attendues}`;
  if (fautives.length) return { statut: "ECHEC", compte, detail: `erreur d'hydratation ou date figée sur ${fautives.map((p) => p.page).join(", ")} (journal : h1 servi / affiché, nœuds retirés et ajoutés)`, controles, residus: [] };
  if (pages.length < attendues || deconnectees.length || code !== 0) {
    return { statut: "INDETERMINE", compte, detail: [pages.length < attendues && `${pages.length} pages lues sur ${attendues}`, deconnectees.length && `renvoyé sur /login : ${deconnectees.map((p) => p.page).join(", ")}`, code !== 0 && `code de sortie ${code}`].filter(Boolean).join(" ; "), controles, residus: [] };
  }
  return { statut: "OK", compte, detail: `${attendues} pages sans erreur d'hydratation`, controles, residus: [] };
}

// Arrosages notés par la sonde : chaque « envoyé … intervention <id> » doit être
// suivi de son « annulation … → 200 », par le toast ou, à défaut, par l'API
// (« annulation (repli API) : … », sonde-lot-20261011c depuis le 2026-10-25).
function arrosagesNonAnnules(etiquettes) {
  const echapper = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (sortie) => {
    const out = [];
    for (const e of etiquettes) {
      const p = e ? `${echapper(e)} ` : "";
      const envoi = sortie.match(new RegExp(`^${p}envoyé : .* → (\\d{3}) intervention (\\S+)`, "m"));
      if (!envoi || !reussi(envoi[1])) continue;
      const annulations = [...sortie.matchAll(new RegExp(`^${p}annulation(?: \\(repli API\\))? : .* → (\\d{3}) `, "gm"))];
      if (!annulations.some((a) => reussi(a[1]))) out.push(`intervention ${envoi[2]} (arrosage noté par la sonde${e ? `, ${e}` : ""}) non annulée`);
    }
    return out;
  };
}

const vrai = (i) => (m) => m[i] === "true";
const faux = (i) => (m) => m[i] === "false";

const reglesLot20261011 = [
  { nom: "375 px : « Plus de pages » mène aux Interventions", re: /menu Plus → Interventions : (\d+)/, ok: (m) => Number(m[1]) >= 1 },
  { nom: "375 px : le lien ouvre /interventions", re: /^ouvre : (\S+)/m, ok: (m) => m[1] === "/interventions" },
  { nom: "Tâches → fiche d'intervention ouverte", re: /Tâches → fiche ouverte : (.*?) \| URL : (\S+)/, ok: (m) => m[1].trim() !== "" },
  { nom: "palette sur /interventions → fiche sans navigation", re: /palette sur \/interventions → fiche : (.*)$/m, ok: (m) => m[1].trim() !== "aucune" },
  { nom: "types d'intervention listés", re: /^options : (.*)$/m, ok: (m) => m[1].split(", ").filter(Boolean).length >= 2 },
  { nom: "2,5 tiges refusé, rien d'envoyé", re: /2,5 tiges : envois = (\d+) \| message : (.*)$/m, ok: (m) => m[1] === "0" && /nombre entier de tiges/i.test(m[2]) },
];

const reglesLot20261011b = [
  { nom: "Météo : « L/m² », « Goutte-à-goutte », décimale à virgule", re: /« L\/m2 » sans exposant : (\w+) \| « Goutte-a-goutte » : (\w+) \| décimale à point : (\w+)/, tous: true, ok: (m) => m[1] === "false" && m[2] === "false" && m[3] === "false" },
  { nom: "« Noter » : arrosage annulé (200)", re: /^annulation : .* → (\d{3}) /m, ok: (m) => m[1] === "200" },
  { nom: "« Noter » : conseil revenu à l'état d'avant", re: /identique à avant : (\w+)/, ok: vrai(1) },
  { nom: "intervention datée demain : « Réalisée » décochée", re: /^date \d{4}-\d{2}-\d{2} → réalisée = (\w+)/m, ok: faux(1) },
  { nom: "« Réalisée » cochée : date ramenée à aujourd'hui", re: /cochée\s*«\s*Réalisée\s*»\s*→ date (\S*) \(aujourd'hui : (\S+) \)/, ok: (m) => m[1] === m[2] },
  { nom: "clic sur une ligne d'animal → sa fiche", re: /cmv3ivtzp clic sur la ligne → (\S+)/, ok: (m) => /^\/elevage\/animaux\/\d+$/.test(m[1]) },
  { nom: "prix d'achat à 0 € affiché « 0 »", re: /cmv3ikt5l .*champ prix =\s*«\s*(.*?)\s*»/, ok: (m) => m[1] === "0" },
  { nom: "date posée par automate gardée au re-rendu", re: /cmv3ik186 .*date =\s*«\s*(.*?)\s*»/, ok: (m) => m[1] === "2026-10-10" },
];

const reglesLot20261011c = [
  { nom: "API : préremplissage Tâches = conseiller", re: /\| identique : (true|false|-)$/m, tous: true, facultatif: true, ok: (m) => m[1] !== "false" },
  { nom: "Tâches : fenêtre refermée après envoi", re: /^\[Tâches\] squelettes .*\| fenêtre fermée : (\w+)/m, ok: vrai(1) },
  { nom: "Tâches : arrosage annulé (200)", re: /^\[Tâches\] annulation : .* → (\d{3}) /m, ok: (m) => m[1] === "200" },
  { nom: "Tâches : mêmes lignes après annulation", re: /^\[Tâches\] lignes avant \/ après annulation : \d+ \/ \d+ \| mêmes planches : (\w+)/m, ok: vrai(1) },
  { nom: "Calendrier 390 px : fenêtre dans l'écran", re: /^\[Calendrier\] fenêtre dans l'écran \(390 px\) : (\w+)/m, ok: vrai(1) },
  { nom: "Calendrier : « 12,5 » envoyé 12.5", re: /^\[Calendrier\] envoyé : (.*) → (\d{3}) intervention/m, ok: (m) => /12\.5\b/.test(m[1]) && m[2] === "200" },
  { nom: "Calendrier : arrosage annulé (200)", re: /^\[Calendrier\] annulation : .* → (\d{3}) /m, ok: (m) => m[1] === "200" },
  { nom: "« Quantité inconnue » hors ligne : message en français", re: /^\[Calendrier\] message : (.*)$/m, ok: (m) => m[1].trim() !== "aucun" },
  { nom: "« Quantité inconnue » hors ligne : fenêtre gardée", re: /^\[Calendrier\] fenêtre toujours ouverte : (\w+)/m, ok: vrai(1) },
];

const reglesLot20261012 = [
  { nom: "Radis sur A1 (serre) : ITP sous abri", re: /A1 \(Serre\) → ITP : (.*?) \| dates/, ok: (m) => /abri/i.test(m[1]) },
  { nom: "Radis sur B1 (plein champ) : aucun ITP sous abri proposé", re: /B1 \(Plein champ\) → ITP : (.*?) \| dates/, ok: (m) => !/abri/i.test(m[1]) },
  { nom: "planche sans type : avis affiché", re: /Planche 15 \(sans type\) → ITP : .*\n\s+avis : (.*)$/m, ok: (m) => m[1].trim() !== "aucun" },
  { nom: "choix manuel « sous abri » gardé sur B1", re: /choix manuel\s*«\s*sous abri\s*»\s*sur B1 → ITP : (.*)$/m, ok: (m) => /abri/i.test(m[1]) },
  { nom: "choix manuel : avis d'incompatibilité", re: /choix manuel[^\n]*\n\s+avis : (.*)$/m, ok: (m) => m[1].trim() !== "aucun" },
  { nom: "choix manuel conservé en changeant de planche", re: /puis Planche 15 → ITP conservé : (.*)$/m, ok: (m) => /abri/i.test(m[1]) },
  { nom: "Interventions : année 2025 gardée après F5 (URL, appels)", re: /après F5 : année (\S+) \| URL (\S*) \| appels ([\d,]*) \(attendu/, ok: (m) => m[1] === "2025" && /annee=2025/.test(m[2]) && m[3] !== "" && m[3].split(",").every((a) => a === "2025") },
  { nom: "?annee=2025&nouvelle=1 : fiche ouverte, année gardée", re: /annee=2025&nouvelle=1 : fiche ouverte, URL nettoyée → (\S*)/, ok: (m) => m[1] === "?annee=2025" },
  { nom: "1301 px : lune dans la barre commune, rail sans doublon et sans débordement", re: /1301 px : lune dans barre commune = (\w+) \| rail sans entrée lunaire = (\w+) \| débordement : (\w+)/, ok: (m) => m[1] === "true" && m[2] === "true" && m[3] === "false" },
  { nom: "petite lune → /meteo, calendrier du mois", re: /→ \/meteo \S+ \| jours du mois : (\d+)/, ok: (m) => Number(m[1]) >= 28 },
  { nom: "calendrier lunaire actionnable à l'arrivée", re: /calendrier actionnable dans la fenêtre = (\w+)/, ok: vrai(1) },
  { nom: "palette bureau : entrée « Calendrier lunaire »", re: /palette bureau : entrée présente = (\w+)/, ok: vrai(1) },
  { nom: "palette bureau → /meteo#calendrier-lunaire", re: /^palette bureau → (\/meteo#calendrier-lunaire)\s*$/m, ok: () => true },
  { nom: "375 px : calendrier par palette actionnable, en-tête compact et sans débordement", re: /375 px : accès lunaire par palette = (\w+) \| URL (\S+) \| en-tête compact = (\w+) \| calendrier actionnable = (\w+) \| débordement : (\w+)/, ok: (m) => m[1] === "true" && m[2] === "/meteo#calendrier-lunaire" && m[3] === "true" && m[4] === "true" && m[5] === "false" },
  { nom: "375 px : Plus ouvre Météo, calendrier sans débordement", re: /375 px : Plus propose Météo = (\w+) \| destination (\S+)\n[\s\S]*?\/meteo à 375 px : jours (\d+) \| débordement : (\w+)/, ok: (m) => m[1] === "true" && m[2] === "/meteo" && Number(m[3]) >= 28 && m[4] === "false" },
];

// Dates saisies relatives au jour du passage (J+7, J+49, J+105 à Paris, depuis le
// 2026-10-25) : l'attendu se lit sur la ligne « saisies : a b c » du bloc de la
// variante, en tête des relevés, de l'envoi et du stockage.
const memesJours = (valeurs, attendues) => attendues.length === 3 && valeurs.every((v, i) => jourParis(v) === attendues[i]);
const VARIANTES_DATES = ["A-fill", "E-avant-itp", "P15-retrait-itp"];
const SAISIES_RE = "saisies : (\\d{4}-\\d{2}-\\d{2}) (\\d{4}-\\d{2}-\\d{2}) (\\d{4}-\\d{2}-\\d{2})";

// Relevés pris à partir de « relevé après saisie » : les dates tapées ne doivent
// plus bouger (ITP reçu, planche choisie, ITP retiré).
function relevesApresSaisie(m) {
  const attendues = [m[1], m[2], m[3]];
  const releves = [...m[4].matchAll(/^relevé (après [^:]*?) : (\S+) (\S+) (\S+) \|/gm)];
  const debut = releves.findIndex((r) => r[1] === "après saisie");
  if (debut < 0) return false;
  return releves.slice(debut).every((r) => memesJours([r[2], r[3], r[4]], attendues));
}

const reglesDatesCulture = VARIANTES_DATES.flatMap((v) => [
  { nom: `${v} : dates gardées dans les champs après la saisie (relevés)`, bloc: `culture ${v}`, re: new RegExp(`${SAISIES_RE}\\n([\\s\\S]*?)\\nchamps avant envoi`), ok: relevesApresSaisie },
  { nom: `${v} : dates envoyées = dates saisies`, bloc: `culture ${v}`, re: new RegExp(`${SAISIES_RE}[\\s\\S]*?envoyé : (\\S+) (\\S+) (\\S+) \\| ITP`), ok: (m) => memesJours([m[4], m[5], m[6]], [m[1], m[2], m[3]]) },
  { nom: `${v} : culture créée aux dates saisies`, bloc: `culture ${v}`, re: new RegExp(`${SAISIES_RE}[\\s\\S]*?statut : (\\d+) \\| culture (\\S+) \\| stocké : (\\S+) (\\S+) (\\S+)`), ok: (m) => m[4] === "201" && memesJours([m[6], m[7], m[8]], [m[1], m[2], m[3]]) },
  { nom: `${v} : culture de sonde supprimée`, bloc: `culture ${v}`, re: /suppression (\S+) → (\d+)/, ok: (m) => reussi(m[2]) },
]);

function culturesDeSondeRestantes(sortie) {
  const out = [];
  for (const m of sortie.matchAll(/\| culture (\d+) \|/g)) {
    if (!new RegExp(`suppression ${m[1]} → 2\\d\\d`).test(sortie)) out.push(`culture ${m[1]} « QA sonde dates (à supprimer) »`);
  }
  const avant = sortie.match(/suppression culture (\S+) → (\d+)/);
  if (avant && !reussi(avant[2])) out.push(`culture ${avant[1]} « QA sonde dates (à supprimer) » (avant plantation)`);
  const recolte = sortie.match(/suppression récolte (\S+) → (\d+)/);
  if (recolte && !reussi(recolte[2])) out.push(`récolte ${recolte[1]} de la sonde avant plantation`);
  return out;
}

const reglesAvantPlantation = [
  { nom: "récolte avant la plantation refusée (4xx)", re: /^statut : (\d{3}) \| réponse : (.*)$/m, ok: (m) => m[1].startsWith("4") },
  { nom: "message de refus sous le formulaire", re: /message sous le formulaire : (.*)$/m, ok: (m) => m[1].trim() !== "[]" },
  { nom: "culture de sonde supprimée", re: /suppression culture (\S+) → (\d+)/, ok: (m) => reussi(m[2]) },
];

const reglesRangs = [
  { nom: "premier envoi à 3 rangs (ITP)", re: /1er envoi : nbRangs = (\S+)/, ok: (m) => m[1] === "3" },
  { nom: "suggestion « Réduire à 2 rangs » cliquable", re: /suggestion cliquable : (\w+)/, ok: vrai(1) },
  { nom: "champ à 2 après la suggestion", re: /champ après application : (\S+)/, ok: (m) => m[1] === "2" },
  { nom: "second envoi à 2 rangs", re: /2e envoi : (.*?) \|/, ok: (m) => m[1] === "nbRangs = 2" },
];

const reglesSuppressionArbre = [
  { nom: "arbre de sonde créé", re: /^arbre de sonde : (\S+)/m, ok: (m) => m[1] !== "undefined" },
  { nom: "opération planifiée sur cet arbre", re: /opération planifiée : (\S+) rattachée à l'arbre (\S+)/, ok: (m) => m[1] !== "undefined" },
  { nom: "arbre supprimé", re: /suppression de l'arbre : (\d+)/, ok: (m) => reussi(m[1]) },
  { nom: "opération partie avec l'arbre", re: /opération de sonde encore présente : (\d+)/, ok: (m) => m[1] === "0" },
];

function arbreDeSondeRestant(sortie) {
  const out = [];
  const arbre = sortie.match(/^arbre de sonde : (\d+)/m);
  const sup = sortie.match(/suppression de l'arbre : (\d+)/);
  const nettoyage = sortie.match(/nettoyage de l'arbre de sonde : (\d+)/);
  if (arbre && !(sup && reussi(sup[1])) && !(nettoyage && reussi(nettoyage[1]))) out.push(`arbre ${arbre[1]} « QA sonde suppression 1011 »`);
  const reste = sortie.match(/opération de sonde encore présente : (\d+)/);
  const op = sortie.match(/opération planifiée : (\d+)/);
  if (reste && reste[1] !== "0") out.push(`opération ${op ? op[1] : "?"} « QA sonde taille 1011 » encore listée`);
  return out;
}

// « choisi : arbre X type Y | envoyé : { arbreId: 12, type: 'taille' } »
const choixEnvoye = (m) => {
  const id = m[3].match(/arbreId: '?([^,' }]+)'?/);
  const type = m[3].match(/type: '([^']*)'/);
  return Boolean(id && type && id[1] === m[1] && type[1] === m[2]);
};

const reglesVerger = [
  { nom: "Opérations : rien d'envoyé sans arbre", bloc: "Opérations", re: /sans arbre : envois = (\d+)/, ok: (m) => m[1] === "0" },
  { nom: "Opérations : arbre et type envoyés = choisis", bloc: "Opérations", re: /choisi : arbre (\S+) type (\S+) \| envoyé : (.*)$/m, ok: choixEnvoye },
  { nom: "Observation : choix gardés dans les champs", bloc: "Santé & Phyto — observation", re: /après choix, champ : (\S*) \/ (\S*)\n[\s\S]*?choisi : arbre (\S+) type (\S+)/, ok: (m) => m[1] === m[3] && m[2] === m[4] },
  { nom: "Observation : arbre et type envoyés = choisis", bloc: "Santé & Phyto — observation", re: /choisi : arbre (\S+) type (\S+) \| envoyé : (.*)$/m, ok: choixEnvoye },
  { nom: "Traitement : arbre gardé après une autre saisie", bloc: "Santé & Phyto — traitement", re: /\d+ options ; choisi (\S+) \| champ après une autre saisie : (\S*)/, ok: (m) => m[1] === m[2] },
  { nom: "Pollinisation : arbre et pollinisateur gardés", bloc: "Santé & Phyto — pollinisation", re: /choisi : arbre (\S+) pollinisateur (\S+) \| champs : (\S*) \/ (\S*)/, ok: (m) => m[1] === m[3] && (m[2] === "null" || m[2] === m[4]) },
];

function analyserOeufs375(sortie, code) {
  // Les trois premières mesures sont prises sur la page servie ; la 4e
  // (lot-long-minw0) injecte le correctif candidat du 2026-10-10 : non lue.
  const mesures = new Map([...sortie.matchAll(/^--- (\S+)\n(\{.*\})$/gm)].map((m) => [m[1], m[2]]));
  const controles = ["sans-lot", "lot-court", "lot-long"].map((etiquette) => {
    const nom = `fenêtre « Saisie rapide » à 375 px (${etiquette})`;
    let r;
    try {
      r = JSON.parse(mesures.get(etiquette));
    } catch {
      return { nom, etat: "absent" };
    }
    if (r.erreur || !r.dialog || !r.form || !Array.isArray(r.larges)) return { nom, etat: "absent", vu: r.erreur || "mesure incomplète" };
    const ok = r.larges.length === 0 && r.dialog.sw <= r.dialog.cw + 1 && r.form.sw <= r.form.width + 1;
    return { nom, etat: ok ? "ok" : "faux", vu: `fenêtre ${r.dialog.sw}/${r.dialog.cw} px, formulaire ${r.form.sw}/${r.form.width} px, ${r.larges.length} élément(s) hors écran` };
  });
  return conclure(controles, { code, plantees: etapesPlantees(sortie) });
}

// verif-shell-v2.mjs imprime un seul objet JSON (une entrée par vue et page).
function analyserShellV2(sortie, code) {
  let rapport;
  try {
    rapport = JSON.parse(sortie.slice(sortie.indexOf("{")));
  } catch {
    return { statut: "INDETERMINE", compte: "0/0", detail: `rapport JSON illisible (code ${code})`, controles: [], residus: [] };
  }
  const controles = [];
  const doutes = [];
  if (rapport._interrompu) doutes.push("rapport partiel (sonde interrompue)");
  for (const [cle, m] of Object.entries(rapport)) {
    if (cle.startsWith("_")) continue;
    if (Array.isArray(m.erreurs)) {
      controles.push(m.erreurs.length ? { nom: `${cle} : erreurs de page`, etat: "faux", vu: m.erreurs[0] } : { nom: `${cle} : sans erreur de page`, etat: "ok" });
    }
    if (cle === "desktop clic rail Cultures") {
      controles.push({ nom: "rail « Cultures » ouvre le module, rail gardé", etat: String(m.url).startsWith("/maraichage") && m.railVisible ? "ok" : "faux", vu: `${m.url} rail=${m.railVisible}` });
      continue;
    }
    if (cle.startsWith("desktop")) controles.push({ nom: `${cle} : rail visible (coquille v2)`, etat: m.railVisible && m.coquilleV2 ? "ok" : "faux", vu: `rail=${m.railVisible} coquille=${m.coquilleV2}` });
    if (m.bandeauEssayer) doutes.push(`${cle} : bandeau « Essayer »`);
    if (m.fondsRouges || m.badgesCritique) doutes.push(`${cle} : ${m.fondsRouges} fond(s) rouge(s), ${m.badgesCritique} badge(s) « Critique »`);
    if (cle.startsWith("mobile") && m.deb > 0) doutes.push(`${cle} : débordement de ${m.deb} px à 390 px`);
  }
  const r = conclure(controles, { code });
  if (r.statut === "OK" && doutes.length) return { ...r, statut: "INDETERMINE", detail: `à regarder : ${doutes.join(" ; ")}` };
  return r;
}

// ---------------------------------------------------------------- table des sondes

const SONDES = [
  // ----- classe a : rejouables telles quelles, lecture seule ou autonettoyantes
  {
    nom: "carte-fond-20261013",
    fichier: "scripts/qa/sonde-carte-fond-20261013.cjs",
    lot: "2026-10-13",
    tickets: ["cmv5cpu7q"],
    prouve: "fond « Satellite IGN » relu après rechargement pour 8 gestes (souris, clavier, check, clics forcés dans la tâche d'ouverture, coche + seul « input »), 1640x1024",
    classe: "a",
    verdict: "natif",
    ecrit: "non",
    cout: "1 contexte, ~20 chargements de /jardin/carte",
    connexions: 1,
    analyser: analyserCarte20261013,
  },
  {
    nom: "carte-fond-20261019",
    fichier: "scripts/qa/sonde-carte-fond-20261019.cjs",
    lot: "2026-10-19",
    tickets: ["cmvflvsk4"],
    prouve: "contrôle Calques sous la barre « Dessiner une parcelle » à 1041x701 (radio et libellé au centre) et aucun fond coché perdu, 9 gestes dont coche sans événement",
    classe: "a",
    verdict: "natif",
    ecrit: "non",
    cout: "1 contexte, ~30 chargements de /jardin/carte",
    connexions: 1,
    analyser: analyserCarte20261019,
  },
  {
    nom: "carte-fond-20261020",
    fichier: "scripts/qa/sonde-carte-fond-20261020.cjs",
    lot: "2026-10-20 (bascule du 21/10)",
    tickets: ["cmvgebfkr", "cmvflvsk4"],
    prouve: "fond gardé à la RÉOUVERTURE de « Layers » (clic rapide, lent, double, survol), contexte vierge, page servie sans injection CSS",
    classe: "a",
    verdict: "natif",
    ecrit: "non",
    cout: "4 contextes neufs à 1686x951 (VP réduit à la taille du ticket), ~12 chargements",
    connexions: 4,
    env: () => ({ VP: "1686x951" }),
    analyser: analyserCarte20261020,
  },
  {
    nom: "hydratation",
    fichier: "scripts/qa/sonde-hydratation.cjs",
    lot: "2026-10-12 et 2026-10-25 (2d4e130)",
    tickets: ["cmvnnwr70"],
    prouve: "aucune erreur d'hydratation React (#418/#423/#425 : console, window.reportError, pageerror) ni <h1> servi daté d'un autre jour sur /aujourdhui, /tracabilite, /maraichage/recoltes/saisie, /maraichage à 1346 et 375 px",
    classe: "a",
    verdict: "natif",
    ecrit: "non",
    cout: "2 contextes, 8 pages de 8 s",
    connexions: 2,
    notes: "2d4e130 en production depuis le 2026-10-25 ; le jour d'un build, CLOCK_PLUS_JOURS=2 (transmis à cette seule sonde) avance l'horloge du navigateur pour rendre visible une date figée",
    args: (c) => [c.base, HYDRATATION_CHEMINS.join(","), HYDRATATION_LARGEURS.join(",")],
    env: () => (process.env.CLOCK_PLUS_JOURS ? { CLOCK_PLUS_JOURS: process.env.CLOCK_PLUS_JOURS } : {}),
    analyser: analyserHydratation,
  },
  {
    nom: "lot-20261011",
    fichier: "scripts/qa/sonde-lot-20261011.cjs",
    lot: "2026-10-11",
    tickets: ["cmv2r57qk", "cmv2r21ns", "cmv2r2rl8", "cmv2r1oao"],
    prouve: "« Plus de pages » → Interventions à 375 px, fiche d'intervention depuis Tâches et la palette, 2,5 tiges refusé à la vente (ligne injectée, rien d'envoyé)",
    classe: "a",
    verdict: "dérivé",
    ecrit: "non",
    cout: "1 contexte, ~8 pages (écritures interceptées)",
    connexions: 1,
    notes: "étape rotation (cmv2r2rl8) imprimée, non jugée",
    analyser: parRegles(reglesLot20261011),
  },
  {
    nom: "lot-20261013",
    fichier: "scripts/qa/sonde-lot-20261013.cjs",
    lot: "2026-10-13",
    tickets: ["cmv5jwqub", "cmv5jxvcy", "cmv5jfsol"],
    prouve: "semaine du calendrier élevage dans l'URL et après F5, accents de la page Économie, effectif pondeur (suppose un lot pondeur, graine de la démo)",
    classe: "a",
    verdict: "natif",
    ecrit: "non",
    cout: "1 contexte, 4 pages + 4 appels d'API",
    connexions: 1,
    analyser: verdictOkKo(),
  },
  {
    nom: "lot-20261013b",
    fichier: "scripts/qa/sonde-lot-20261013b.cjs",
    lot: "2026-10-13 b (27667b1)",
    tickets: ["facturation électronique, lot 1 relu"],
    prouve: "exports UBL/Factur-X refusés (422) ou conformes selon l'acheteur, cadre de paiement, PATCH particulier → professionnel sans SIREN refusé (400)",
    classe: "a",
    verdict: "natif",
    ecrit: "si régression (PATCH défait aussitôt)",
    cout: "1 contexte, API seulement",
    connexions: 1,
    notes: "les cas absents de la démo sont des lignes INFO, non comptées",
    analyser: verdictOkKo(),
  },
  {
    nom: "suppression-arbre",
    fichier: "scripts/qa/sonde-suppression-arbre.cjs",
    lot: "2026-10-11",
    tickets: ["cmv2sr80i"],
    prouve: "une opération planifiée puis réalisée part avec son arbre",
    classe: "a",
    verdict: "dérivé",
    ecrit: "nettoie (arbre et opération de sonde)",
    cout: "1 contexte, API seulement",
    connexions: 1,
    analyser: parRegles(reglesSuppressionArbre, arbreDeSondeRestant),
  },
  {
    nom: "verger-selecteurs",
    fichier: "scripts/qa/sonde-verger-selecteurs.cjs",
    lot: "2026-10-10 (gleba-0c)",
    tickets: ["cmv2r0t6a", "cmv2r1kjv"],
    prouve: "arbre et type choisis = envoyés (Opérations, Observation), arbre gardé (Traitement, Pollinisation)",
    classe: "a",
    verdict: "dérivé",
    ecrit: "non",
    cout: "1 contexte, 5 pages (POST interceptés)",
    connexions: 1,
    args: (c) => [c.base, "", c.captures("verger-selecteurs")],
    analyser: parRegles(reglesVerger),
  },
  // ----- classe b : rejouables, mais dépendantes d'un état de la démo (à surveiller)
  {
    nom: "lot-20261011b",
    fichier: "scripts/qa/sonde-lot-20261011b.cjs",
    lot: "2026-10-11 b",
    tickets: ["cmv3ja7nr", "cmv3japsf", "cmv3jaru7", "cmv3jatw8", "cmv3javy4", "cmv3ik186", "cmv3ikt5l", "cmv3ivtzp"],
    prouve: "libellés du conseiller d'irrigation, « Noter » avec quantité puis Annuler, intervention réalisée datée dans le futur, ligne d'animal cliquable, prix 0 €, date posée par automate",
    classe: "b",
    etat: "identifiants des parcelles démo (serre, plein champ, tunnel), un bouton « Noter » dans les conseils de la serre, des animaux",
    verdict: "dérivé",
    ecrit: "nettoie (un arrosage de 20 L noté puis annulé)",
    cout: "1 contexte, ~8 pages, 4 conseils météo recalculés",
    connexions: 1,
    delaiMs: 5 * 60_000,
    analyser: parRegles(reglesLot20261011b, arrosagesNonAnnules([""])),
  },
  {
    nom: "lot-20261011c",
    fichier: "scripts/qa/sonde-lot-20261011c.cjs",
    lot: "2026-10-11 c (89a2243)",
    tickets: ["cmv3japsf (retouches de 0e07f60)"],
    prouve: "quantité versée sur Tâches et l'onglet Calendrier (virgule décimale, 390 px), annulation, « Quantité inconnue » hors ligne",
    classe: "b",
    etat: "carte « À arroser aujourd'hui » présente (météo et cultures du jour), parcelles démo par identifiant",
    verdict: "dérivé",
    ecrit: "nettoie (deux arrosages notés puis annulés : toast, sinon API)",
    cout: "1 contexte, ~6 pages, 3 conseils météo recalculés",
    connexions: 1,
    delaiMs: 5 * 60_000,
    analyser: parRegles(reglesLot20261011c, arrosagesNonAnnules(["[Tâches]", "[Calendrier]"])),
  },
  {
    nom: "lot-20261012",
    fichier: "scripts/qa/sonde-lot-20261012.cjs",
    lot: "2026-10-12",
    tickets: ["cmv4z6yhg", "cmv4z983m", "cmv4zb9yy"],
    prouve: "ITP proposé selon le type de planche et choix manuel conservé, année des Interventions dans l'URL, lien lunaire PC et accès mobile par palette et Météo",
    classe: "b",
    etat: "planches démo « Planche 15 » (sans type), A1 (serre), B1 (plein champ) par identifiant ; ITP Radis sous abri et plein champ",
    verdict: "dérivé",
    ecrit: "non",
    cout: "1 contexte, ~9 pages",
    connexions: 1,
    delaiMs: 5 * 60_000,
    args: (c) => [c.base, "", c.captures("lot-20261012")],
    analyser: parRegles(reglesLot20261012),
  },
  {
    nom: "lot-20261019",
    fichier: "scripts/qa/sonde-lot-20261019.cjs",
    lot: "2026-10-19 (c80c804, 50dd184)",
    tickets: ["parcours après connexion par formulaire", "variete.nom de l'irrigation"],
    prouve: "OnboardingRedirect interroge /api/onboarding après une connexion par le formulaire ; /api/cultures/irriguer sert variete.nom",
    classe: "b",
    etat: "des cultures avec variété dans le conseil d'irrigation (saison) ; /login attendu en « networkidle »",
    verdict: "natif",
    ecrit: "non",
    cout: "1 contexte, 2 pages + 1 appel d'API",
    connexions: 1,
    analyser: verdictOkKo(),
  },
  {
    nom: "lot-20261019b",
    fichier: "scripts/qa/sonde-lot-20261019b.cjs",
    lot: "2026-10-19 b",
    tickets: ["cmv9dy2ow", "cmv9e1u2r"],
    prouve: "œufs d'une ponte sous délai d'attente « jamais vendables » avec la fin du délai ; actions de ligne Animaux et Lots nommées",
    classe: "b",
    etat: "ponte du 28/09 du lot 54 écartée par un délai d'attente ; pages /elevage attendues en « networkidle »",
    verdict: "natif",
    ecrit: "non",
    cout: "1 contexte, 4 pages + 1 appel d'API",
    connexions: 1,
    analyser: verdictOkKo(),
  },
  {
    nom: "lot-20261019c",
    fichier: "scripts/qa/sonde-lot-20261019c.cjs",
    lot: "2026-10-19 (soir)",
    tickets: ["cmvfm1aj3", "cmvfm1ow7", "cmvflv6ku", "cmvfm9wi5", "cmvflua2x", "cmvfljv98", "cmvflyt1w", "cmvflq0sf", "cmvfm1yvc", "garde démo"],
    prouve: "carnet sanitaire typé, cave valorisée à la pièce, soins en retard séparés, compte de résultat au centime, floraisons, opérations par année, lianes, garde démo 403, duplication de planche validée",
    classe: "b",
    etat: "année 2026 en dur ; Vermifuge et Vaccination au carnet, un lot de cave à la pièce, deux arbres avec floraison, des opérations 2027",
    verdict: "natif",
    ecrit: "non (deux POST refusés par construction)",
    cout: "1 contexte, API seulement (~12 appels)",
    connexions: 1,
    analyser: verdictOkKo(),
  },
  {
    nom: "lot-20261020",
    fichier: "scripts/qa/sonde-lot-20261020.cjs",
    lot: "2026-10-20 (bascule du 21/10)",
    tickets: ["cmvgdo90z", "cmvgeecem", "cmvge3bqj", "cmvge3o5z", "cmvgddn3l", "cmvgee5s9", "cmvgef6ou", "cmvgeif10", "cmvgeltj1", "cmvgdp9fn", "cmvgdzsf7"],
    prouve: "effectif de lot, compteur de ventes, coûts par unité, tournée d'arrosage, porte-greffes, pollinisation démentie, unités des sorties, rendement carcasse refusé, registre phyto, refus de suppression de planche, écritures dérivées",
    classe: "b",
    etat: "objets de la campagne v8 sur la démo (Pintades perle A3 1708, v8-Nathalie Amap 2010, v8-Hélène 0929, v8-Marc-2010, arbre 835, poireau C2, ventes 86,40 € et Dahlia 48 €)",
    verdict: "natif",
    ecrit: "si régression : espèce « sonde-v8-rendement » créée, non supprimée",
    cout: "1 contexte, API seulement (~13 appels)",
    connexions: 1,
    analyser: verdictOkKo((sortie) => {
      const m = sortie.match(/^KO {2,}espèces animales : .* — (\d{3}) /m);
      return m && reussi(m[1]) ? ["espèce animale « sonde-v8-rendement » créée par la sonde (rendement 65 accepté) : à supprimer"] : [];
    }),
  },
  {
    nom: "lot-20261023",
    fichier: "scripts/qa/sonde-lot-20261023.cjs",
    lot: "2026-10-23",
    tickets: ["cmvkp3kqc", "cmvkpb0g9", "cmvkoxe5o", "libellés"],
    prouve: "porte-greffe du catalogue dans l'inspecteur du plan avant et après rechargement, « Par défaut », période de récolte de la variété dans la récolte du verger, « Déjà un compte ? »",
    classe: "b",
    etat: "arbres 863 (porte-greffe Prunier Saint-Julien A) et 865 (Mirabelle de Nancy), récolte « v8-Hélène 2310 prunier (3) » du 10/07/2026",
    verdict: "natif",
    ecrit: "non",
    cout: "1 contexte, 4 pages + 3 appels d'API",
    connexions: 1,
    analyser: verdictOkKo(),
  },
  {
    nom: "dates-culture",
    fichier: "scripts/qa/sonde-dates-culture-recolte.cjs",
    lot: "2026-10-10 (gleba-0c)",
    tickets: ["cmv2qzhkf"],
    prouve: "dates saisies à la création d'une culture gardées dans les champs, envoyées et stockées telles quelles : saisies avant ou après la réponse des ITP, et quand une planche sans type retire l'ITP",
    classe: "b",
    etat: "espèce Zinnia et son ITP ; planches B1 et « Planche 15 » (sans type) par identifiant ; dates relatives au jour (J+7, J+49, J+105)",
    verdict: "dérivé",
    ecrit: "nettoie (trois cultures « QA sonde dates (à supprimer) »)",
    cout: "1 contexte, 3 formulaires",
    connexions: 1,
    args: (c) => [c.base, "culture", VARIANTES_DATES.join(",")],
    analyser: parRegles(reglesDatesCulture, culturesDeSondeRestantes),
  },
  {
    nom: "dates-avant-plantation",
    fichier: "scripts/qa/sonde-dates-culture-recolte.cjs",
    lot: "2026-10-10 (gleba-0c)",
    tickets: ["cmv2r19al"],
    prouve: "récolte refusée avant la plantation, message sous le formulaire",
    classe: "b",
    etat: "espèce Zinnia, première planche de la démo",
    verdict: "dérivé",
    ecrit: "nettoie (culture de sonde ; récolte supprimée si acceptée)",
    cout: "1 contexte, 1 formulaire",
    connexions: 1,
    args: (c) => [c.base, "avant-plantation"],
    analyser: parRegles(reglesAvantPlantation, culturesDeSondeRestantes),
  },
  {
    nom: "rangs-suggestion",
    fichier: "scripts/qa/sonde-rangs-suggestion.cjs",
    lot: "2026-10-11",
    tickets: ["cmv2r1v63"],
    prouve: "après un refus de largeur, « Réduire à 2 rangs » appliqué = valeur envoyée",
    classe: "b",
    etat: "planche B1 par identifiant, ITP Zinnia à 3 rangs",
    verdict: "dérivé",
    ecrit: "non (POST interceptés, refus simulé)",
    cout: "1 contexte, 1 formulaire + 2 aperçus d'API",
    connexions: 1,
    analyser: parRegles(reglesRangs),
  },
  {
    nom: "oeufs-375",
    fichier: "scripts/qa/sonde-oeufs-375.cjs",
    lot: "2026-10-10 (gleba-0c)",
    tickets: ["cmv298ouh"],
    prouve: "fenêtre « Saisie rapide » des œufs sans débordement à 375 px (DialogContent [&>*]:min-w-0), avec le plus long libellé de lot",
    classe: "b",
    etat: "libellés des lots pondeurs de la démo ; la 4e mesure injecte le correctif candidat et n'est pas lue",
    verdict: "dérivé",
    ecrit: "non (4 captures dans le dossier du rapport)",
    cout: "1 contexte, 1 page",
    connexions: 1,
    args: (c) => [c.base, "desktop"],
    env: (c) => ({ OUT_DIR: c.captures("oeufs-375") }),
    analyser: analyserOeufs375,
  },
  {
    nom: "shell-v2",
    fichier: "scripts/qa/verif-shell-v2.mjs",
    lot: "2026-10-10 (accueil v2, f230d3f)",
    tickets: ["« Cultures » ramenait à l'accueil", "rail absent sur /verger"],
    prouve: "rail sur les modules en bureau, « Cultures » ouvre le module, aucune erreur de page ; débordement, fonds rouges et badges « Critique » à regarder",
    classe: "b",
    etat: "attendus du banc du 2026-10-10 revus le 2026-10-25 sur la production : fonds rouges comptés dans les lignes des listes du jour seulement (les alertes sanitaires de /elevage sont voulues et décrites à part)",
    verdict: "dérivé",
    ecrit: "non (captures dans le dossier du rapport)",
    cout: "2 contextes, 13 pages et 13 captures",
    connexions: 2,
    delaiMs: 5 * 60_000,
    args: (c) => [c.base, c.captures("shell-v2")],
    analyser: analyserShellV2,
  },
];

const ECARTEES = [
  {
    fichier: "scripts/verif-navigateur-carte-fond.cjs",
    lot: "2026-09-28",
    tickets: ["cmul80vst"],
    raison: "BASE figée sur gleba.fr, attend « networkidle » (jamais atteint sur gleba.fr), aucun verdict (états bruts) ; remplacée par les trois carte-fond",
  },
  {
    fichier: "scripts/qa/sonde-soin-rappel.cjs",
    lot: "2026-10-10",
    tickets: ["cmv29egw6"],
    raison: "diagnostic d'un ticket non reproduit (aucun correctif à surveiller) ; variantes clavier vouées à l'échec dans Chromium sans interface ; écrit des soins (supprimés) aux dates figées d'octobre 2026",
  },
  {
    fichier: "scripts/qa/sonde-dates-culture-recolte.cjs, mode « recolte »",
    lot: "2026-10-10",
    tickets: ["cmv2r0qua"],
    raison: "exige CULTURE_ID d'une culture démo déjà récoltée (témoin) ; supprimer la récolte de sonde ne décoche pas « récolte faite ». Modes « culture » et « avant-plantation » rejoués",
  },
  {
    fichier: "scripts/qa/verif-personnaliser.mjs",
    lot: "2026-10-10 (accueil v2)",
    tickets: [],
    raison: "si la garde démo régressait, « Terminer » enregistrerait l'accueil réordonné de la démo, sans retour arrière ; noms de tuiles figés ; rapport JSON sans verdict",
  },
  {
    fichier: "scripts/qa/verif-registres.mjs",
    lot: "2026-10-10 (P4)",
    tickets: [],
    raison: "preuve d'une conversion (fonctionnalité, pas un correctif), rapport JSON sans verdict ; débordement préexistant de /taches à 390 px : bruit à chaque passage",
  },
];

// ---------------------------------------------------------------- utilitaires

function memoireDisponibleMo() {
  try {
    const m = fs.readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+) kB/m);
    return m ? Math.round(Number(m[1]) / 1024) : null;
  } catch {
    return null;
  }
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function horodatage(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function duree(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

const couper = (texte, n) => (texte.length > n ? `${texte.slice(0, n - 1)}…` : texte);
const colonne = (texte, n) => couper(String(texte), n).padEnd(n);

// Descendants d'un processus (Chromium lancé par Playwright), par /proc/*/stat.
function descendants(pid) {
  const enfants = new Map();
  for (const d of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, "utf8");
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      if (!enfants.has(ppid)) enfants.set(ppid, []);
      enfants.get(ppid).push(Number(d));
    } catch {}
  }
  const out = [];
  const pile = [pid];
  while (pile.length) {
    for (const c of enfants.get(pile.pop()) || []) {
      out.push(c);
      pile.push(c);
    }
  }
  return out;
}

function estNavigateurOuNode(pid) {
  try {
    return /chrom|playwright|node/i.test(fs.readFileSync(`/proc/${pid}/cmdline`, "utf8"));
  } catch {
    return false;
  }
}

// SIGINT d'abord (Playwright ferme ses navigateurs), puis SIGKILL du processus et
// de tous ses descendants relevés au moment de l'arrêt (orphelins compris).
function arreter(enfant) {
  if (enfant.exitCode !== null || enfant.signalCode !== null) return;
  const famille = descendants(enfant.pid);
  try {
    enfant.kill("SIGINT");
  } catch {}
  setTimeout(() => {
    const vivants = enfant.exitCode === null && enfant.signalCode === null ? [enfant.pid, ...descendants(enfant.pid)] : [];
    for (const pid of new Set([...vivants, ...famille])) {
      if (estNavigateurOuNode(pid)) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }
  }, GRACE_MS);
}

function environnement(ctx, propre) {
  const env = { ...process.env };
  for (const v of VARIABLES_RETIREES) delete env[v];
  return { ...env, PLAYWRIGHT_DIR, BASE: ctx.base, FORCE_COLOR: "0", ...propre };
}

function executer(sonde, ctx) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const args = [path.resolve(RACINE, sonde.fichier), ...(sonde.args ? sonde.args(ctx) : [ctx.base])];
    const journal = path.join(ctx.dossierRun, `${sonde.nom}.log`);
    const flux = fs.createWriteStream(journal);
    flux.write(`# ${sonde.nom} (${sonde.fichier}) — ${new Date(debut).toISOString()}\n# arguments : ${args.slice(1).join(" ")}\n`);
    let sortie = "";
    let erreurs = "";
    let motifArret = null;
    let fini = false;
    const enfant = spawn(process.execPath, args, { cwd: ctx.dossierRun, env: environnement(ctx, sonde.env ? sonde.env(ctx) : {}), stdio: ["ignore", "pipe", "pipe"] });
    const stopper = (motif) => {
      if (motifArret) return;
      motifArret = motif;
      arreter(enfant);
    };
    ctx.stopperCourant = stopper;
    enfant.stdout.on("data", (d) => {
      const t = d.toString();
      if (sortie.length < SORTIE_MAX) sortie += t;
      flux.write(t);
    });
    enfant.stderr.on("data", (d) => {
      const t = d.toString();
      if (erreurs.length < SORTIE_MAX) erreurs += t;
      flux.write(t);
    });
    const delai = sonde.delaiMs || DELAI_DEFAUT_MS;
    const minuterie = setTimeout(() => {
      console.log(`  délai de ${duree(delai)} dépassé : SIGINT, puis SIGKILL dans ${GRACE_MS / 1000} s`);
      stopper("delai");
    }, delai);
    const veille = setInterval(() => {
      const dispo = memoireDisponibleMo();
      if (dispo !== null && dispo < MEMOIRE_PLANCHER_MO) {
        console.log(`  mémoire disponible ${dispo} Mo < ${MEMOIRE_PLANCHER_MO} Mo pendant la sonde : arrêt de la sonde et de la campagne`);
        stopper("memoire");
      }
    }, 5000);
    const terminer = (code, signal) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      clearInterval(veille);
      ctx.stopperCourant = null;
      flux.end(`\n# fin : code ${code} signal ${signal} arrêt ${motifArret || "-"} durée ${duree(Date.now() - debut)}\n`);
      resolve({ code, signal, sortie, erreurs, motifArret, dureeMs: Date.now() - debut, journal });
    };
    enfant.on("error", (e) => {
      erreurs += `\n[lanceur] ${e.message}`;
      terminer(-1, null);
    });
    enfant.on("exit", (code, signal) => setTimeout(() => terminer(code, signal), 5000).unref());
    enfant.on("close", (code, signal) => terminer(code, signal));
  });
}

function qualifier(statut, classe) {
  switch (statut) {
    case "OK":
      return "OK";
    case "ECHEC":
      return classe === "a" ? "RÉGRESSION" : "À TRIER (état de la démo ?)";
    case "INDETERMINE":
      return classe === "a" ? "ILLISIBLE, à trier" : "À TRIER (état de la démo ?)";
    case "DELAI":
      return "HORS DÉLAI";
    case "ARRETEE":
      return "ARRÊTÉE (mémoire)";
    case "INTERROMPUE":
      return "INTERROMPUE";
    default:
      return "NON LANCÉE";
  }
}

function derniereLigneUtile(res) {
  const utiles = (texte) => texte.split("\n").map((l) => l.trim()).filter((l) => /[A-Za-zÀ-ÿ]{3,}/.test(l) && !l.startsWith("#"));
  const l = utiles(res.sortie).pop() || utiles(res.erreurs).pop() || "";
  return couper(l, 160);
}

// ---------------------------------------------------------------- affichage

function lister(base) {
  const a = SONDES.filter((s) => s.classe === "a").length;
  const connexions = SONDES.reduce((n, s) => n + s.connexions, 0);
  console.log(`Sonde cumulative — ${SONDES.length} sondes rejouées (${a} de classe a, ${SONDES.length - a} de classe b), ${ECARTEES.length} écartées (classe c).`);
  console.log(`Base : ${base}. Ordre de passage, une sonde à la fois :\n`);
  console.log(` #  Cl  ${colonne("Nom", 23)} ${colonne("Lot", 30)} ${colonne("Verdict", 7)} ${colonne("Écrit", 40)} Délai`);
  SONDES.forEach((s, i) => {
    console.log(`${String(i + 1).padStart(2)}  ${s.classe}   ${colonne(s.nom, 23)} ${colonne(s.lot, 30)} ${colonne(s.verdict, 7)} ${colonne(s.ecrit, 40)} ${duree(s.delaiMs || DELAI_DEFAUT_MS)}`);
    console.log(`        ${s.fichier}${s.args ? ` (arguments : ${s.args({ base, captures: (n) => `<rapport>/captures/${n}` }).slice(1).join(" ")})` : ""}`);
    console.log(`        tickets : ${s.tickets.join(", ")} — ${s.prouve}`);
    console.log(`        coût : ${s.cout} ; connexions démo : ${s.connexions}`);
    if (s.etat) console.log(`        état de la démo : ${s.etat}`);
    if (s.notes) console.log(`        note : ${s.notes}`);
  });
  console.log("\nÉcartées (classe c) :");
  for (const e of ECARTEES) console.log(`  - ${e.fichier} (${e.lot}${e.tickets.length ? `, ${e.tickets.join(", ")}` : ""}) : ${e.raison}`);
  const pw = path.join(PLAYWRIGHT_DIR, "node_modules", "playwright", "package.json");
  let version = "absent";
  try {
    version = `présent, ${JSON.parse(fs.readFileSync(pw, "utf8")).version}`;
  } catch {}
  const dispo = memoireDisponibleMo();
  console.log(`\nPassage complet : ≈ ${connexions} connexions démo (une ligne login_logs chacune).`);
  console.log(`Playwright : ${PLAYWRIGHT_DIR} (${version}) ; mémoire disponible : ${dispo === null ? "illisible" : `${dispo} Mo`} (seuil ${MEMOIRE_MIN_MO} Mo).`);
  console.log(`Rapport par défaut : ${RAPPORT_DEFAUT}`);
}

function tableau(resultats) {
  console.log(`\n${colonne("Sonde", 23)} Cl ${colonne("Lot", 22)} ${colonne("Verdict", 34)} ${colonne("Durée", 10)} Dernière ligne utile`);
  for (const r of resultats) {
    console.log(`${colonne(r.nom, 23)} ${r.classe}  ${colonne(r.lot, 22)} ${colonne(`${r.qualificatif}${r.compte ? ` ${r.compte}` : ""}`, 34)} ${colonne(r.dureeMs ? duree(r.dureeMs) : "-", 10)} ${couper(r.derniereLigne || "", 70)}`);
  }
}

// ---------------------------------------------------------------- programme

function lireOptions(argv) {
  const o = { lister: false, base: BASE_DEFAUT, seulement: null, rapport: RAPPORT_DEFAUT };
  for (const a of argv) {
    if (a === "--lister") o.lister = true;
    else if (a.startsWith("--base=")) o.base = a.slice(7).replace(/\/+$/, "");
    else if (a.startsWith("--seulement=")) o.seulement = a.slice(12).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--rapport=")) o.rapport = path.resolve(a.slice(10));
    else if (a === "-h" || a === "--aide" || a === "--help") o.aide = true;
    else throw new Error(`option inconnue : ${a} (voir --aide)`);
  }
  if (!/^https?:\/\/[^/]+$/.test(o.base)) throw new Error(`--base attend une origine http(s) sans chemin : ${o.base}`);
  if (o.seulement) {
    const connus = new Set(SONDES.map((s) => s.nom));
    for (const n of o.seulement) {
      if (connus.has(n)) continue;
      const ecartee = ECARTEES.find((e) => e.fichier.includes(n));
      throw new Error(ecartee ? `${n} est écartée (classe c) : ${ecartee.raison}` : `sonde inconnue : ${n} (noms : ${[...connus].join(", ")})`);
    }
  }
  return o;
}

async function attendreMemoire(nom) {
  let dispo = memoireDisponibleMo();
  if (dispo === null) {
    console.log("  /proc/meminfo illisible : garde-fou mémoire inactif");
    return true;
  }
  if (dispo >= MEMOIRE_MIN_MO) return true;
  console.log(`  mémoire disponible ${dispo} Mo < ${MEMOIRE_MIN_MO} Mo avant ${nom} : attente, ${duree(ATTENTE_MEMOIRE_MS)} au plus`);
  const fin = Date.now() + ATTENTE_MEMOIRE_MS;
  while (Date.now() < fin) {
    await pause(30_000);
    dispo = memoireDisponibleMo();
    if (dispo >= MEMOIRE_MIN_MO) {
      console.log(`  mémoire revenue à ${dispo} Mo : reprise`);
      return true;
    }
  }
  console.log(`  mémoire toujours à ${dispo} Mo : campagne arrêtée, sondes restantes non lancées`);
  return false;
}

async function main() {
  let o;
  try {
    o = lireOptions(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (o.aide) {
    const doc = fs.readFileSync(__filename, "utf8").split("\n");
    console.log(doc.slice(1, doc.findIndex((l) => l.startsWith('"use strict"'))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    return;
  }
  if (o.lister) {
    lister(o.base);
    return;
  }
  if (!fs.existsSync(path.join(PLAYWRIGHT_DIR, "node_modules", "playwright"))) {
    console.error(`Playwright introuvable dans ${PLAYWRIGHT_DIR}/node_modules : passer PLAYWRIGHT_DIR=/var/www/escalier`);
    process.exit(2);
  }
  const choisies = o.seulement ? SONDES.filter((s) => o.seulement.includes(s.nom)) : SONDES;
  const debut = new Date();
  const stamp = horodatage(debut);
  const dossierRun = path.join(o.rapport, stamp);
  fs.mkdirSync(dossierRun, { recursive: true });
  const ctx = {
    base: o.base,
    dossierRun,
    stopperCourant: null,
    interrompu: false,
    captures: (nom) => {
      const d = path.join(dossierRun, "captures", nom);
      fs.mkdirSync(d, { recursive: true });
      return d;
    },
  };
  process.on("SIGINT", () => {
    if (ctx.interrompu) process.exit(2);
    ctx.interrompu = true;
    console.log("\nInterruption : arrêt de la sonde en cours, rapport partiel (second Ctrl-C : sortie immédiate).");
    if (ctx.stopperCourant) ctx.stopperCourant("interruption");
  });

  const ecrivent = choisies.filter((s) => s.ecrit !== "non" && !s.ecrit.startsWith("non "));
  console.log(`Sonde cumulative ${stamp} — ${choisies.length} sonde(s) sur ${o.base}, une à la fois.`);
  if (o.base !== BASE_DEFAUT) console.log(`Attention : les sondes de classe b visent des objets de la démo de ${BASE_DEFAUT}.`);
  console.log(`Écritures possibles sur la démo : ${ecrivent.map((s) => `${s.nom} (${s.ecrit})`).join(" ; ") || "aucune"} ; plus une ligne login_logs par connexion.`);
  console.log(`Journaux : ${dossierRun}\n`);

  const resultats = [];
  let arretCampagne = null;
  for (const [i, sonde] of choisies.entries()) {
    const entete = { nom: sonde.nom, fichier: sonde.fichier, lot: sonde.lot, tickets: sonde.tickets, classe: sonde.classe, verdictMode: sonde.verdict, ecrit: sonde.ecrit, connexions: 0 };
    if (!arretCampagne && ctx.interrompu) arretCampagne = "interruption";
    if (!arretCampagne && !(await attendreMemoire(sonde.nom))) arretCampagne = "memoire";
    if (arretCampagne) {
      resultats.push({ ...entete, statut: "NON_LANCEE", qualificatif: `NON LANCÉE (${arretCampagne === "memoire" ? "mémoire" : "interruption"})`, compte: "", detail: "", residus: [] });
      continue;
    }
    console.log(`[${i + 1}/${choisies.length}] ${sonde.nom} (classe ${sonde.classe}, lot ${sonde.lot}) — mémoire disponible ${memoireDisponibleMo() ?? "?"} Mo`);
    const res = await executer(sonde, ctx);
    let analyse;
    try {
      analyse = sonde.analyser(res.sortie, res.code === null ? -1 : res.code);
    } catch (e) {
      analyse = { statut: "INDETERMINE", compte: "", detail: `analyseur en erreur : ${e.message}`, controles: [], residus: [] };
    }
    // Une sonde qui journalise ses exceptions (« erreur JS : … ») et voit un #418 :
    // React a réparé la page en la re-rendant côté client, un clic donné juste
    // après le chargement a pu tomber sur un nœud remplacé (2026-10-25).
    if (/^erreur JS : .*#418/m.test(`${res.sortie}\n${res.erreurs}`)) {
      const note = "hydratation en échec (#418 au journal) : un clic juste après le chargement a pu être perdu";
      analyse = { ...analyse, notes: [...(analyse.notes || []), note], detail: [analyse.detail, `note : ${note}`].filter(Boolean).join(" ; ") };
    }
    if (res.motifArret === "delai") analyse = { ...analyse, statut: "DELAI", detail: `délai dépassé ; ${analyse.detail}` };
    else if (res.motifArret === "memoire") analyse = { ...analyse, statut: "ARRETEE", detail: `mémoire sous ${MEMOIRE_PLANCHER_MO} Mo ; ${analyse.detail}` };
    else if (res.motifArret === "interruption") analyse = { ...analyse, statut: "INTERROMPUE", detail: `interrompue ; ${analyse.detail}` };
    if (res.motifArret) {
      await pause(GRACE_MS + 1000); // laisse passer le SIGKILL des Chromium avant la sonde suivante
      if (res.motifArret !== "delai") arretCampagne = res.motifArret;
    }
    const r = {
      ...entete,
      ...analyse,
      qualificatif: qualifier(analyse.statut, sonde.classe),
      code: res.code,
      signal: res.signal,
      dureeMs: res.dureeMs,
      derniereLigne: derniereLigneUtile(res),
      journal: res.journal,
      connexions: sonde.connexions,
    };
    resultats.push(r);
    console.log(`  → ${r.qualificatif}${r.compte ? ` ${r.compte}` : ""} en ${duree(r.dureeMs)} : ${couper(r.detail || "", 200)}`);
    for (const x of r.residus || []) console.log(`  → À NETTOYER : ${x}`);
  }

  const fin = new Date();
  tableau(resultats);
  const nonOk = resultats.filter((r) => !["OK", "NON_LANCEE", "ARRETEE", "INTERROMPUE"].includes(r.statut));
  if (nonOk.length) {
    console.log("\nÀ regarder :");
    for (const r of nonOk) console.log(`  - ${r.nom} [${r.qualificatif}] ${r.detail}\n    journal : ${r.journal}`);
  }
  const residus = resultats.flatMap((r) => (r.residus || []).map((x) => `${r.nom} : ${x}`));
  if (residus.length) {
    console.log("\nÀ NETTOYER sur la démo (la sonde n'a pas défait son écriture) :");
    for (const x of residus) console.log(`  - ${x}`);
  }
  const connexions = resultats.reduce((n, r) => n + (r.connexions || 0), 0);
  console.log(`\nConnexions démo : ≈ ${connexions} lignes login_logs entre ${debut.toISOString()} et ${fin.toISOString()} (compte démo, IP du VPS), à supprimer par id.`);

  const INCOMPLETS = ["NON_LANCEE", "ARRETEE", "INTERROMPUE"];
  const incomplet = resultats.some((r) => INCOMPLETS.includes(r.statut));
  const codeSortie = nonOk.length ? 1 : incomplet ? 2 : 0;
  const rapport = {
    lanceur: "scripts/qa/sonde-cumulative.cjs",
    base: o.base,
    playwrightDir: PLAYWRIGHT_DIR,
    debut: debut.toISOString(),
    fin: fin.toISOString(),
    dureeS: Math.round((fin - debut) / 1000),
    seuilsMemoireMo: { avantSonde: MEMOIRE_MIN_MO, pendantSonde: MEMOIRE_PLANCHER_MO },
    connexionsDemo: { nombre: connexions, fenetre: [debut.toISOString(), fin.toISOString()] },
    resume: {
      ok: resultats.filter((r) => r.statut === "OK").length,
      regressions: resultats.filter((r) => r.classe === "a" && r.statut === "ECHEC").length,
      aTrier: resultats.filter((r) => ["INDETERMINE", "DELAI"].includes(r.statut) || (r.classe === "b" && r.statut === "ECHEC")).length,
      incompletes: resultats.filter((r) => INCOMPLETS.includes(r.statut)).length,
      aNettoyer: residus,
    },
    codeSortie,
    sondes: resultats,
    ecartees: ECARTEES,
  };
  const fichierRapport = path.join(o.rapport, `rapport-${stamp}.json`);
  fs.writeFileSync(fichierRapport, `${JSON.stringify(rapport, null, 2)}\n`);
  console.log(`Rapport : ${fichierRapport}`);
  process.exit(codeSortie);
}

module.exports = { SONDES, ECARTEES, jourParis, verdictOkKo, controler, executer, qualifier };

if (require.main === module) {
  main().catch((e) => {
    console.error("lanceur en erreur :", e);
    process.exit(2);
  });
}
