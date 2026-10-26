const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { createRequire } = require('node:module')
const { chromium } = createRequire('/var/www/escalier/package.json')('playwright')

async function main() {
  const base = 'http://127.0.0.1:3007'
  const fixture = JSON.parse(await fs.readFile('/tmp/gleba-stock-ui-fixture.json', 'utf8'))
  const dossier = '/tmp/gleba-stock-captures'
  await fs.mkdir(dossier, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 1024 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.79' } })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  page.setDefaultTimeout(30000)
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e)))
  const connexion = async (ctx, email) => {
    const csrf = await (await ctx.request.get(`${base}/api/auth/csrf`)).json()
    const r = await ctx.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email, password: fixture.password, callbackUrl: `${base}/comptabilite/factures`, json: 'true' }, headers: { 'X-Auth-Return-Redirect': '1' } })
    assert.equal(r.status(), 200); assert(!((await r.json()).url || '').includes('error='))
  }
  const api = async (path, data, method = 'POST', status = 200) => {
    const r = await context.request.fetch(`${base}${path}`, { method, data }); const j = await r.json()
    assert.equal(r.status(), status, JSON.stringify(j)); return j.data
  }
  try {
    await connexion(context, 'demo@gleba.fr')
    await page.goto(`${base}/comptabilite/factures?tab=livraisons&stock=recolte:${fixture.recolteId}`, { waitUntil: 'networkidle' })
    const cookies = page.getByRole('button', { name: 'Tout refuser', exact: true }); if (await cookies.isVisible()) await cookies.click()
    const formulaire = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Nouveau bon de livraison', exact: true }) })
    await formulaire.getByLabel('Désignation *', { exact: true }).waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.value === 'Carottes QA interface'))
    assert.equal(await formulaire.getByLabel('Unité *', { exact: true }).inputValue(), 'kg')
    assert(await formulaire.getByLabel('Unité *', { exact: true }).getAttribute('readonly') !== null)
    assert.equal(await formulaire.getByLabel('Prix unitaire HT *', { exact: true }).inputValue(), '3.0047')
    await formulaire.locator('#doc-client').selectOption(String(fixture.clientId))
    await formulaire.locator('#doc-objet').fill('Livraison QA interface')
    await formulaire.getByLabel('Quantité *', { exact: true }).fill('4')
    await page.screenshot({ path: `${dossier}/bl-stock-desktop.png`, fullPage: true })
    const sauvegarde = page.waitForResponse((r) => r.url().endsWith('/api/comptabilite/documents') && r.request().method() === 'POST')
    await formulaire.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click()
    const bon = (await (await sauvegarde).json()).data
    assert(bon?.id); assert.equal(bon.lignes[0].articleStockId, String(fixture.recolteId))
    assert.equal(bon.lignes[0].statutBio, 'AB')
    const stock = async () => (await (await context.request.get(`${base}/api/comptabilite/documents/stock`)).json()).data.find((a) => a.type === 'recolte' && a.id === String(fixture.recolteId))?.disponible
    assert.equal(await stock(), 20, 'brouillon sans débit')
    await api(`/api/comptabilite/documents/${bon.id}`, { action: 'emettre' }, 'PATCH')
    await page.reload({ waitUntil: 'networkidle' })
    const article = page.locator(`#document-${bon.id}`)
    await article.getByRole('button', { name: 'Marquer livré', exact: true }).click()
    const dialogue = page.getByRole('dialog', { name: 'Confirmer la livraison', exact: true })
    const livrer = page.waitForResponse((r) => r.url().endsWith(`/api/comptabilite/documents/${bon.id}`) && r.request().method() === 'PATCH')
    await dialogue.getByRole('button', { name: 'Confirmer la livraison', exact: true }).click(); assert.equal((await livrer).status(), 200)
    assert.equal(await stock(), 16)
    const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const facture = await api('/api/comptabilite/documents/facturer', { ids: [bon.id], dateEcheance: jour }, 'POST', 201)
    assert.equal(await stock(), 16, 'la facture du BL ne débite pas à nouveau')
    // Le vrai POST facture partage le même contrôle et sa clé de reprise ne double ni facture ni stock.
    const corps = { cleCreationStock: crypto.randomUUID(), type: 'facture', clientId: fixture.clientId, objet: 'Facture directe QA', totalHT: 6, totalTVA: 0.33, totalTTC: 6.33, statut: 'emise', lignes: [{ articleStockType: 'recolte', articleStockId: String(fixture.recolteId), description: 'Carottes QA interface', quantite: 2, unite: 'kg', prixUnitaire: 3, tauxTVA: 5.5, montantHT: 6, montantTVA: 0.33, montantTTC: 6.33 }] }
    const [f1, f2] = await Promise.all([api('/api/comptabilite/factures', corps, 'POST', 201), api('/api/comptabilite/factures', corps, 'POST', 201)])
    assert.equal(f1.id, f2.id); assert.equal(await stock(), 14)
    await api(`/api/comptabilite/factures/${f1.id}/stock`, { action: 'retourner' })
    await api(`/api/comptabilite/factures/${f1.id}/stock`, { action: 'retourner' })
    assert.equal(await stock(), 16, 'retour facture appliqué une fois')
    // Mauvais stock : la route refuse avant émission et conserve le reliquat.
    const faux = { ...corps, cleCreationStock: crypto.randomUUID(), lignes: [{ ...corps.lignes[0], quantite: 100, montantHT: 300, montantTVA: 16.5, montantTTC: 316.5 }], totalHT: 300, totalTVA: 16.5, totalTTC: 316.5 }
    await api('/api/comptabilite/factures', faux, 'POST', 409); assert.equal(await stock(), 16)
    const avantFactures = (await (await context.request.get(`${base}/api/comptabilite/factures?year=all`)).json()).data.length
    const autre = await browser.newContext(); await connexion(autre, 'autre-commercial@example.test')
    assert.equal((await (await autre.request.get(`${base}/api/comptabilite/documents/stock`)).json()).data.length, 0)
    assert.equal((await autre.request.post(`${base}/api/comptabilite/factures/${facture.id}/stock`, { data: { action: 'retourner' } })).status(), 404); await autre.close()
    const lecteur = await browser.newContext(); await connexion(lecteur, 'lecture-commercial@example.test')
    assert.equal((await lecteur.request.get(`${base}/api/comptabilite/documents/stock`)).status(), 200)
    assert.equal((await lecteur.request.post(`${base}/api/comptabilite/factures/${facture.id}/stock`, { data: { action: 'retourner' } })).status(), 403); await lecteur.close()
    await page.goto(`${base}/comptabilite/factures?tab=generer`, { waitUntil: 'networkidle' })
    const picker = page.getByLabel('Produit disponible', { exact: true })
    await picker.selectOption(`recolte:${fixture.recolteId}`)
    await page.getByRole('button', { name: 'Ajouter ce produit', exact: true }).click()
    assert.equal(await page.locator('input[placeholder="Description"]').inputValue(), 'Carottes QA interface')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${base}/comptabilite/factures?tab=livraisons&stock=recolte:${fixture.recolteId}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.value === 'Carottes QA interface'))
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'absence de débordement sur mobile')
    await page.screenshot({ path: `${dossier}/bl-stock-mobile.png`, fullPage: true })
    assert.equal((await (await context.request.get(`${base}/api/comptabilite/factures?year=all`)).json()).data.length, avantFactures, 'aucune facture créée par une saisie refusée')
    assert.deepEqual(erreurs, [])
    console.log('Interface stock : sélection préremplie, BL livré/facturé, facture directe idempotente, refus de survente, retour unique, isolation, lecture seule et mobile validés.')
  } finally { await browser.close() }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
