// QA technique : vrais formulaires sur le banc fictif. Rejouable par phase.
import fs from 'node:fs/promises';
import { Script } from 'node:vm';
import { fiabiliserChunks, journalChunks } from '/srv/gleba-equipe/qa/chunks-stables.mjs';
import { execFileSync } from 'node:child_process';
import { chromium, expect as E } from '/srv/gleba-equipe/outils/node_modules/@playwright/test/index.mjs';
const expect=E.configure({timeout:90000});
const base='http://127.0.0.1:3900', preuve=process.env.PREUVES, phase=process.argv[2]||'annees';
const phases = new Set(phase === 'annees' ? ['recoltes', 'mobile', 'export', 'maraichage'] : [phase]);
if (![...phases].every(p => ['login', 'fixture', 'recoltes', 'mobile', 'export', 'maraichage', 'meteo'].includes(p))) throw Error('Phase inconnue : '+phase);
if(!preuve?.startsWith('/srv/gleba-equipe/'))throw Error('Preuves locales requises');
await fs.mkdir(preuve,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Paris',locale:'fr-FR'});
if (phase !== 'login') await fiabiliserChunks(context);
// Ne pas confondre réponse reçue et données déjà appliquées au formulaire.
const lecturesEnCours = new Set();
const estLecture = r => {
 const u = new URL(r.url());
 return u.origin === base && r.method() === 'GET' &&
  (u.pathname.startsWith('/api/') || (u.pathname.startsWith('/_next/static/') && u.pathname.endsWith('.js')));
};
context.on('request', r => { if (estLecture(r)) lecturesEnCours.add(r); });
context.on('requestfinished', r => lecturesEnCours.delete(r));
context.on('requestfailed', r => lecturesEnCours.delete(r));
const fragments = [], transferts = [], lectures = [];
context.on('response', r => {
 const u = new URL(r.url());
 if (u.origin !== base || !u.pathname.startsWith('/_next/static/') || !u.pathname.endsWith('.js')) return;
 transferts.push((async () => {
  const numero = fragments.length;
  const fragment = { url: r.url(), statut: r.status(), entetes: r.headers() };
  fragments.push(fragment);
  try {
   const corps = await r.body(); fragment.octets = corps.length;
   try { new Script(corps.toString(), { filename: u.pathname }); fragment.syntaxe = 'ok'; }
   catch (e) { fragment.syntaxe = e.message; fragment.fichier = `${phase}-fragment-${numero}.js`; await fs.writeFile(`${preuve}/${fragment.fichier}`, corps); }
  } catch (e) { fragment.erreur = e.message; }
 })());
});
const page=await context.newPage(); page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(180000);
const erreurs=[],reseau=[],bilan=[];
page.on('pageerror',e=>erreurs.push(e.message));
context.on('response', r => {
 const u = new URL(r.url());
 if (u.origin !== base || !u.pathname.startsWith('/api/') || u.pathname.startsWith('/api/auth/')) return;
 lectures.push((async () => {
  const e = { chemin: u.pathname+u.search, methode: r.request().method(), statut: r.status() };
  if (['/api/meteo', '/api/carte', '/api/recoltes', '/api/cultures', '/api/especes', '/api/itps'].includes(u.pathname)) e.corps = await r.json().catch(()=>null);
  else await r.finished();
  reseau.push(e);
 })());
});
const commit=execFileSync('git',['-C','/srv/gleba-equipe/gleba','rev-parse','HEAD'],{encoding:'utf8'}).trim();
const attendu=process.env.QA_BANC_COMMIT;
if(!attendu || !commit.startsWith(attendu))throw Error('QA_BANC_COMMIT requis et identique au banc : '+commit);
const annee = Number(new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date()));
async function capture(n){await page.screenshot({path:`${preuve}/${phase}-${n}.png`,fullPage:true});await fs.writeFile(`${preuve}/${phase}-${n}.json`,JSON.stringify({commit,url:page.url(),texte:await page.locator('body').innerText(),largeur:await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})),reseau,erreurs},null,2));}
async function open(p){console.log('Navigation',p);const debut=reseau.length;await page.goto(base+p,{waitUntil:'domcontentloaded'});return debut;}
async function react(l){await expect(l).toBeVisible();await expect.poll(()=>l.evaluate(e=>Object.keys(e).some(k=>k.startsWith('__reactProps$')))).toBe(true);}
async function click(l){await react(l);await l.click();}
async function mutation(path,fn){const reponse=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='POST');await fn();const r=await reponse,j=await r.json();expect(r.status(),JSON.stringify(j)).toBe(201);return j;}
async function lecture(debut, correspond) {
 await expect.poll(() => reseau.slice(debut).some(r => r.methode === 'GET' && r.statut === 200 && correspond(r)), {message:'Lecture attendue terminée'}).toBe(true);
 return reseau.slice(debut).findLast(r => r.methode === 'GET' && r.statut === 200 && correspond(r));
}
async function stabiliser(l = page.locator('main').first()) {
 await react(l);
 let precedent, depuis = Date.now();
 await expect.poll(async () => {
  const courant = await l.evaluate(e => JSON.stringify({
   texte:e.textContent,
   champs:[...e.querySelectorAll('input, select, button[role="combobox"]')].map(c=>[c.id,c.value,c.textContent,c.getAttribute('aria-expanded'),c.disabled]),
  }));
  if (courant !== precedent || lecturesEnCours.size) depuis = Date.now();
  precedent = courant;
  return Date.now() - depuis >= 1200;
 }, {message:'Formulaire rendu et lectures stabilisées', intervals:[200], timeout:90000}).toBe(true);
}
async function ouvrir(l, nomOption) {
 // La lecture/HMR peut remonter un contrôle : réouvrir seulement le menu,
 // jamais une mutation, si son état fermé est réellement constaté.
 await expect(async () => {
  if (await l.getAttribute('aria-expanded') !== 'true') await click(l);
  await expect(page.getByRole('option',{name:nomOption,exact:true}).first()).toBeVisible({timeout:1500});
 }).toPass({timeout:15000, intervals:[200,500]});
}
async function choisir2019(l,nom){
 await ouvrir(l,'2019');
 await page.getByRole('option',{name:'2019',exact:true}).click();
 await expect(l).toContainText('2019');
 await stabiliser();
 await capture(nom+'-selection');
 // Une capture peut prendre plusieurs secondes. Aucun clic sur une ancienne
 // option après la capture ; le menu ouvert est seulement une preuve visuelle.
 await ouvrir(l,'2019');await capture(nom+'-ouvert');await page.keyboard.press('Escape');
 await expect(l).toContainText('2019');
 bilan.push({scenario:nom,resultat:'ok'});
}
async function ouvrirRecoltes(){
 const debut=await open('/maraichage/recoltes');
 await lecture(debut,r=>r.chemin.startsWith('/api/recoltes?')&&r.chemin.includes('statut=en_stock'));
 await lecture(debut,r=>r.chemin.startsWith('/api/recoltes?')&&r.chemin.includes('statut=vendu'));
 await stabiliser();
 return page.locator('main button[role="combobox"]').first();
}
try{
 await open('/login?callbackUrl='+encodeURIComponent('/maraichage/recoltes'));
 const email=page.getByLabel('Email',{exact:true});await react(email);
 await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps$')&&typeof f[k]?.onSubmit==='function');},{},{timeout:90000});
 const refus=page.getByRole('button',{name:'Tout refuser',exact:true});if(await refus.isVisible())await click(refus);
 const compte=JSON.parse(await fs.readFile('/srv/gleba-equipe/banc/compte-debug.json','utf8'));
 await email.fill(compte.email);await page.getByLabel('Mot de passe',{exact:true}).fill(compte.motDePasse);
 await capture('login-hydrate');
 const connexion=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/callback/credentials'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();const c=await connexion;expect(c.status()).toBe(200);expect((await c.json()).url).not.toContain('error=');
 const session=await context.request.get(base+'/api/auth/session');expect(session.status()).toBe(200);expect((await session.json()).user.email).toBe(compte.email);
 bilan.push({scenario:'connexion réelle par formulaire',resultat:'ok',fragmentsStabilises:phase!=='login'});
 await capture('connexion-reussie');
 if(phase==='fixture'){
  const debut=await open('/maraichage/cultures/new?annee=2019');
  const catalogue=await lecture(debut,r=>r.chemin==='/api/especes?pageSize=500');
  await lecture(debut,r=>r.chemin==='/api/planches?pageSize=500');
  const carotte=catalogue.corps?.data?.find(e=>(e.nom??e.id)==='Carotte');
  expect(carotte,'Carotte présente dans le catalogue réel').toBeTruthy();
  const formulaire=page.locator('main form');
  await stabiliser(formulaire);
  // Position du champ dans le formulaire, indépendante de son libellé sélectionné.
  const choix=formulaire.getByRole('combobox').first();
  await expect(choix).toContainText('Rechercher une espèce');
  await ouvrir(choix,/Carotte/);
  const recherche=page.getByPlaceholder('Rechercher une espèce…',{exact:true});
  await recherche.fill('Carotte');await expect(recherche).toHaveValue('Carotte');
  const option=page.locator('[cmdk-item][data-value="Carotte"]').first();
  await expect(option).toBeVisible();
  const selection=reseau.length;
  await option.click();await expect(choix).toContainText('Carotte');
  await expect(choix).toHaveAttribute('aria-expanded','false');
  await lecture(selection,r=>r.chemin===`/api/especes/${encodeURIComponent(carotte.id)}`);
  const itps=await lecture(selection,r=>r.chemin.startsWith('/api/itps?')&&new URLSearchParams(r.chemin.split('?')[1]).get('especeId')===carotte.id);
  const choixItp=formulaire.getByRole('combobox',{name:'Itinéraire technique (ITP)',exact:true});
  if(itps.corps?.data?.length) await expect(choixItp).toBeEnabled();
  else await expect(choixItp).toContainText('Aucun ITP');
  await stabiliser(formulaire);
  await capture('espece-selectionnee');
  await page.getByLabel('Année',{exact:true}).fill('2019');
  for(const [label,date] of [['Date semis','2019-03-15'],['Date plantation','2019-04-15'],['Début de récolte','2019-06-15'],['Fin de récolte','2019-07-31']]){
   const input=page.getByLabel(label,{exact:true});await input.fill(date);await input.press('Tab');await expect(input).toHaveValue(date);
  }
  await stabiliser(formulaire);
  await expect(choix).toContainText('Carotte');
  await expect(page.getByLabel('Année',{exact:true})).toHaveValue('2019');
  for(const [label,date] of [['Date semis','2019-03-15'],['Date plantation','2019-04-15'],['Début de récolte','2019-06-15'],['Fin de récolte','2019-07-31']]) await expect(page.getByLabel(label,{exact:true})).toHaveValue(date);
  await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toBeEnabled();
  const culture=await mutation('/api/cultures',()=>page.getByRole('button',{name:'Enregistrer',exact:true}).click());
  await fs.writeFile(`${preuve}/culture-2019.json`,JSON.stringify(culture,null,2));
  const saisie=await open('/maraichage/recoltes/saisie');
  await lecture(saisie,r=>r.chemin==='/api/cultures?pageSize=200');
  const select=page.locator('main select');await react(select);
  await expect(select.locator(`option[value="${culture.id}"]`)).toHaveCount(1);
  await stabiliser();await select.selectOption(String(culture.id));
  await expect(select).toHaveValue(String(culture.id));await stabiliser();
  await page.locator('#saisie-recolte-date').fill('2019-06-15');await page.locator('#saisie-recolte-date').press('Tab');
  await page.locator('#saisie-recolte-quantite').fill('2.75');
  const recolte=await mutation('/api/recoltes',()=>page.getByRole('button',{name:'Enregistrer la récolte',exact:true}).click());
  expect(recolte.date).toContain('2019-06-15');await fs.writeFile(`${preuve}/recolte-2019.json`,JSON.stringify(recolte,null,2));
  await capture('recolte-creee');bilan.push({scenario:'récolte 2019 créée par UI',resultat:'ok',id:recolte.id});
 }
 if(phases.has('recoltes')){
  const filtre=await ouvrirRecoltes();const debut=reseau.length;await choisir2019(filtre,'recoltes');
  await expect.poll(()=>reseau.slice(debut).some(r=>r.chemin.startsWith('/api/recoltes?')&&r.chemin.includes('annee=2019')&&r.statut===200)).toBe(true);
  const recolte=JSON.parse(await fs.readFile(`${preuve}/recolte-2019.json`,'utf8'));
  await expect.poll(()=>reseau.slice(debut).some(r=>r.chemin.startsWith('/api/recoltes?')&&r.chemin.includes('annee=2019')&&r.corps?.data?.some(j=>j.id===recolte.id))).toBe(true);
  await expect(page.getByRole('row').filter({hasText:'Carotte'}).filter({hasText:'15/06/2019'}).filter({hasText:'2,75'}).first()).toBeVisible();
  await capture('recoltes-filtrees');
 }
 if(phases.has('mobile')){
  await page.setViewportSize({width:390,height:844});
  const filtre=await ouvrirRecoltes();await ouvrir(filtre,String(annee+1));
  const options = await page.getByRole('option').allTextContents();
  const nombres = options.filter(t=>/^20\d\d$/.test(t.trim())).map(Number);
  expect(nombres).toEqual(Array.from({length:annee+2-2000},(_,i)=>annee+1-i));
  await capture('recoltes-mobile-liste-haut');
  await ouvrir(filtre,String(annee+1));
  const ancienne = page.getByRole('option',{name:'2000',exact:true});
  await ancienne.scrollIntoViewIfNeeded(); await expect(ancienne).toBeInViewport();
  await ancienne.click();await expect(filtre).toContainText('2000');await stabiliser();
  await ouvrir(filtre,'2000');await page.getByRole('option',{name:'2000',exact:true}).scrollIntoViewIfNeeded();
  await capture('recoltes-mobile-liste-bas');await page.keyboard.press('Escape');
  await choisir2019(filtre,'recoltes-mobile'); await capture('recoltes-mobile');
  await fs.writeFile(`${preuve}/lisibilite-mobile.json`,JSON.stringify({commit,viewport:390,annees:nombres,nombreAnnees:nombres.length,annee2000Atteinte:true,annee2019Selectionnee:true,commentaire:'Liste Radix : haut et bas capturés ; défilement réel jusqu’à 2000, puis sélection 2019. La lisibilité visuelle reste à examiner sur les captures.'},null,2));
 }
 if(phases.has('export')){
  await page.setViewportSize({width:1440,height:1000});
  const debut=await open('/comptabilite/export');await lecture(debut,r=>r.chemin==='/api/exploitation');
  const exercice=page.getByLabel('Exercice',{exact:true});await stabiliser();await react(exercice);await expect(exercice).toHaveValue(String(annee));await capture('export-exercice-par-defaut');await expect(exercice.locator('option[value="2019"]')).toHaveCount(1);await exercice.selectOption('2019');await expect(exercice).toHaveValue('2019');await capture('export-fec');bilan.push({scenario:'exercice FEC 2019 et défaut année courante',resultat:'ok',anneeCourante:annee});
  await page.setViewportSize({width:390,height:844}); await exercice.focus(); await exercice.press('End'); await exercice.press('Enter'); await expect(exercice).toHaveValue('2000'); await capture('export-mobile-2000'); await exercice.selectOption('2019'); await capture('export-mobile-2019');
 }
 if(phases.has('maraichage')){
  await page.setViewportSize({width:1440,height:1000});
  await open('/maraichage'); const saison=page.getByRole('combobox',{name:'Année affichée',exact:true});await stabiliser();await ouvrir(saison,String(annee+5));
  const future=page.getByRole('option',{name:String(annee+5),exact:true});await future.click();await expect(saison).toContainText(String(annee+5));
  await stabiliser();await ouvrir(saison,String(annee+5));await capture('maraichage-n-plus-5');await page.keyboard.press('Escape');await expect(saison).toContainText(String(annee+5));
  bilan.push({scenario:'Maraîchage propose et sélectionne N+5',resultat:'ok',annee:annee+5});
 }
 if(phase==='meteo'){
  await open('/meteo');await expect(page.getByRole('heading',{name:/Météo/}).first()).toBeVisible();
  await expect.poll(()=>reseau.some(r=>r.chemin==='/api/carte'&&r.statut===200)).toBe(true);
  const carte=reseau.findLast(r=>r.chemin==='/api/carte'&&r.statut===200)?.corps;
  if(!carte?.some(p=>p.centroidLat&&p.centroidLng)){bilan.push({scenario:'météo du jour',resultat:'non_verifie',raison:'Aucune parcelle géolocalisée du compte debug disponible.'});}
  else {
   await expect.poll(()=>reseau.some(r=>r.chemin.startsWith('/api/meteo?')&&r.statut===200)).toBe(true);
   const m=reseau.findLast(r=>r.chemin.startsWith('/api/meteo?')&&r.statut===200)?.corps;
   await fs.writeFile(`${preuve}/meteo-reponse.json`,JSON.stringify(m,null,2));
   bilan.push({scenario:'prévisions météo réelles',resultat:'ok'});
  }
  await capture('bureau');await page.setViewportSize({width:360,height:800});await capture('mobile');
 }
}catch(e){await capture('echec').catch(()=>{});bilan.push({resultat:'echec',message:e.stack});console.error(e);process.exitCode=1;}
finally{await Promise.allSettled([...transferts,...lectures]);await fs.writeFile(`${preuve}/fragments-${phase}.json`,JSON.stringify({commit,fragments,journalChunks},null,2));await fs.writeFile(`${preuve}/bilan-${phase}.json`,JSON.stringify({commit,phase,bilan,reseau,erreurs},null,2));await browser.close();}
