/**
 * Centre d'aide (PROMPT 22 §4).
 *
 * FAQ par module, liens vers glossaire, /feedback, /communaute, /raccourcis.
 * Les tutoriels vidéo sont des placeholders pour le MVP.
 */

import Link from "next/link"
import { ArrowLeft, BookOpen, HelpCircle, Keyboard, MessageSquare, Map, BookCopy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RelancerTours } from "@/components/relancer-tours"

export const metadata = {
  title: "Centre d'aide — Gleba",
}

const FAQ = [
  {
    section: "Démarrage",
    items: [
      {
        q: "Comment configurer mon exploitation après l'onboarding ?",
        a: "Rendez-vous dans Paramètres > Exploitation pour modifier raison sociale, SIRET, régime fiscal/TVA, coordonnées bancaires et mentions de pied de facture.",
      },
      {
        q: "Comment relancer le tour guidé d'un module ?",
        a: "Chaque module a son propre tour Shepherd.js. Utilisez les boutons « Relancer le tour » au bas de cette page (Maraîchage, Verger, Élevage, Comptabilité).",
      },
      {
        q: "Comment naviguer rapidement ?",
        a: "Cmd/Ctrl + K ouvre la recherche globale. Le préfixe `g` puis `m/v/e/c` bascule entre modules. La touche `?` ouvre la page raccourcis. Voir /raccourcis pour la liste complète.",
      },
    ],
  },
  {
    section: "Maraîchage",
    items: [
      {
        q: "Pourquoi mes dates de semis/plantation/récolte ne se remplissent pas automatiquement ?",
        a: "Il faut d'abord choisir Espèce + Variété + ITP + Année. Les semaines de semis/plantation/récolte définies sur l'ITP servent au calcul (semaine ISO de l'année). Si un champ reste vide, c'est que l'ITP ne renseigne pas la semaine correspondante.",
      },
      {
        q: "Comment marquer plusieurs tâches faites d'un coup ?",
        a: 'Dans le calendrier de la semaine, le bouton "Tout fait (N)" apparaît dès qu\'il y a 2 tâches non terminées dans une section (semis ou plantations).',
      },
    ],
  },
  {
    section: "Élevage",
    items: [
      {
        q: "Pourquoi je ne peux pas appliquer un soin à mon animal hors lot ?",
        a: "Depuis la mise à jour PROMPT 19B, le formulaire de soin permet de cibler soit un animal individuel, soit un lot. Choisissez « Animal individuel » dans le sélecteur cible.",
      },
      {
        q: "Pourquoi mon lait est-il marqué « écarté » ?",
        a: "Un soin avec temps d'attente lait > 0 a été appliqué à cet animal ou ce lot. Les collectes effectuées dans la fenêtre d'attente sont automatiquement écartées (non transformables, non vendables) jusqu'à la date `finAttenteLait`.",
      },
      {
        q: "Quand suggérer un tarissement ?",
        a: "L'écran Lactation suggère le tarissement à partir de DIM > 270 jours (jours depuis la mise-bas) ou production moyenne 7 jours < 0,5 L/j.",
      },
    ],
  },
  {
    section: "Comptabilité",
    items: [
      {
        q: "Mes factures n'ont pas de SIRET. Pourquoi ?",
        a: "L'identité légale n'a pas été renseignée dans Paramètres > Exploitation. Sans elle, les factures émises ne sont pas conformes (art. 242 nonies A CGI). Le PDF affiche un avertissement rouge.",
      },
      {
        q: "Qu'est-ce que l'export FEC ?",
        a: "Fichier des Écritures Comptables au format normalisé (arrêté du 29/07/2013). Document exigible en contrôle fiscal pour les exploitations au réel. Téléchargeable depuis Comptabilité > Export FEC.",
      },
    ],
  },
  {
    section: "Productivité",
    items: [
      {
        q: "Où trouver les raccourcis clavier ?",
        a: 'La touche ? ouvre la page /raccourcis. Cmd/Ctrl + K ouvre la recherche globale (cherche dans cultures, variétés, arbres, animaux, lots, clients, factures, parcelles, soins, récoltes, produits boutique).',
      },
    ],
  },
]

export default function AidePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-slate-600" />
            <h1 className="text-xl font-bold">Centre d'aide</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ressources rapides</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
            <Link href="/raccourcis" className="flex items-start gap-2 p-3 border rounded hover:bg-slate-50">
              <Keyboard className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <strong>Raccourcis clavier</strong>
                <p className="text-xs text-slate-500 mt-1">Cmd+K, g+m/v/e/c, etc.</p>
              </div>
            </Link>
            <Link href="/feedback" className="flex items-start gap-2 p-3 border rounded hover:bg-slate-50">
              <MessageSquare className="h-4 w-4 text-pink-600 mt-0.5" />
              <div>
                <strong>Feedback / suggestions</strong>
                <p className="text-xs text-slate-500 mt-1">Signaler un bug, demander une fonctionnalité</p>
              </div>
            </Link>
            <Link href="/communaute" className="flex items-start gap-2 p-3 border rounded hover:bg-slate-50">
              <Map className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <strong>Community Voice</strong>
                <p className="text-xs text-slate-500 mt-1">Proposez, votez et suivez la roadmap</p>
              </div>
            </Link>
            <Link href="/glossaire" className="flex items-start gap-2 p-3 border rounded hover:bg-slate-50">
              <BookCopy className="h-4 w-4 text-emerald-600 mt-0.5" />
              <div>
                <strong>Glossaire technique</strong>
                <p className="text-xs text-slate-500 mt-1">Termes agricoles, FCR, DIM, IPG, BDNI...</p>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-slate-600" />
              Questions fréquentes
            </CardTitle>
            <CardDescription>
              Les bases pour démarrer chaque module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {FAQ.map((section) => (
              <div key={section.section}>
                <h3 className="font-semibold text-slate-900 mb-2">{section.section}</h3>
                <div className="space-y-3">
                  {section.items.map((item, i) => (
                    <details key={i} className="border rounded p-3 [&[open]]:bg-slate-50">
                      <summary className="cursor-pointer font-medium text-sm text-slate-800 select-none">
                        {item.q}
                      </summary>
                      <p className="text-sm text-slate-600 mt-2 pl-1">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tour guidé</CardTitle>
            <CardDescription>
              Chaque module propose un tour Shepherd.js qui présente les fonctionnalités clés. Cliquez sur un bouton pour le relancer (5 étapes par tour).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RelancerTours />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tutoriels vidéo</CardTitle>
            <CardDescription>
              En préparation — les premiers tutoriels seront publiés au fil des sprints.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-500 italic">
            Placeholder MVP. Les captures et vidéos viendront enrichir cette section.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
