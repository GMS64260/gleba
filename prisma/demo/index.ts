/**
 * Assemble le jeu de données de la ferme démo, module par module.
 *
 * L'ordre compte : le terrain précède les cultures et le verger ; l'élevage
 * et les productions précèdent le commerce (devis, livraisons, factures qui
 * puisent dans leurs stocks) ; la banque passe en dernier, puisqu'elle
 * rapproche les règlements de tout le reste.
 *
 * `DEMO_MODULES=terrain,elevage` ne joue qu'une partie (essais sur base
 * jetable) ; `identite` et `terrain` sont toujours joués.
 */

import { AUJ, Y, type Contexte } from "./contexte"
import { seedIdentite } from "./identite"
import { seedTerrain } from "./terrain"

type Module = { nom: string; charger: () => Promise<(ctx: Contexte) => Promise<void>> }

const MODULES: Module[] = [
  { nom: "maraichage", charger: async () => (await import("./maraichage")).seedMaraichage },
  { nom: "verger", charger: async () => (await import("./verger")).seedVerger },
  { nom: "elevage", charger: async () => (await import("./elevage")).seedElevage },
  { nom: "compagnie", charger: async () => (await import("./compagnie")).seedCompagnie },
  { nom: "commerce", charger: async () => (await import("./commerce")).seedCommerce },
  { nom: "banque", charger: async () => (await import("./banque")).seedBanque },
]

export async function seedFerme(base: { userId: string; clone: boolean }) {
  const filtre = (process.env.DEMO_MODULES ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  const actif = (nom: string) => filtre.length === 0 || filtre.includes(nom)
  console.log(`▶ Ferme du Bois Joli — campagne ${Y}, jour de référence ${AUJ.toISOString().slice(0, 10)}${filtre.length ? ` — modules : ${filtre.join(", ")}` : ""}`)

  const ctx: Contexte = { ...base, exploitationId: "", parcelles: {}, planches: {}, clients: {}, partage: {} }
  await seedIdentite(ctx)
  await seedTerrain(ctx)
  for (const m of MODULES) {
    if (!actif(m.nom)) continue
    const seed = await m.charger()
    await seed(ctx)
  }
  return ctx
}
