import type { Config } from "tailwindcss";

/**
 * Charte « carnet de ferme » (2026-10-09) : les palettes Tailwind employées
 * par des milliers de classes dans les pages de modules (`text-emerald-700`,
 * `bg-amber-50`, `border-red-200`, `text-slate-500`…) sont recartées sur les
 * teintes de la charte, en gardant la structure de contraste de Tailwind
 * (50 très clair → 950 très sombre). Un `bg-red-50 text-red-700` reste
 * lisible, mais en garance ; un `bg-emerald-600` devient sauge. Le sens des
 * couleurs est préservé (vert = bon, ambre = attention, rouge = danger, bleu
 * = information), seule la teinte change. Réversible en supprimant ce bloc.
 */
const LUMINOSITES = { 50: 96, 100: 91, 200: 83, 300: 72, 400: 58, 500: 47, 600: 40, 700: 33, 800: 26, 900: 20, 950: 13 } as const
function gamme(teinte: number, saturation: number): Record<string, string> {
  return Object.fromEntries(
    Object.entries(LUMINOSITES).map(([pas, l]) => [pas, `hsl(${teinte} ${saturation}% ${l}%)`]),
  )
}
const SAUGE = gamme(142, 26)
const PRAIRIE = gamme(136, 37)
const PAILLE = gamme(44, 54)
const OCRE = gamme(31, 69)
const GARANCE = gamme(4, 47)
const ARGILE = gamme(17, 48)
const EAU = gamme(190, 36)
// Neutres tirés du papier (clairs) vers l'encre (sombres) : les gris
// bleutés de Tailwind devenaient froids sur fond papier.
const NEUTRE: Record<string, string> = {
  50: "hsl(45 25% 96%)",
  100: "hsl(43 27% 90%)",
  200: "hsl(43 20% 83%)",
  300: "hsl(43 14% 74%)",
  400: "hsl(140 6% 55%)",
  500: "hsl(140 6% 46%)",
  600: "hsl(140 6% 38%)",
  700: "hsl(145 9% 30%)",
  800: "hsl(147 12% 22%)",
  900: "hsl(147 15% 14%)",
  950: "hsl(135 9% 9%)",
}

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // src/lib doit être scanné : kpi-theme.ts y déclare les classes de gradient
    // des KPI cards en littéral. Sans ça, Tailwind purge les teintes utilisées
    // uniquement là (ex. neutre slate-700/800) → carte sans fond, texte blanc
    // sur blanc.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			'tech-green': 'var(--sauge)',
  			'carbone': 'var(--encre)',
  			'terre-cuite': 'var(--argile)',
  			'gris-nuage': 'var(--papier)',
  			// Palettes Tailwind recartées (voir l'en-tête du fichier).
  			emerald: SAUGE,
  			teal: SAUGE,
  			green: PRAIRIE,
  			lime: PRAIRIE,
  			amber: PAILLE,
  			yellow: PAILLE,
  			orange: OCRE,
  			red: GARANCE,
  			rose: ARGILE,
  			pink: ARGILE,
  			blue: EAU,
  			sky: EAU,
  			cyan: EAU,
  			indigo: EAU,
  			violet: EAU,
  			purple: EAU,
  			fuchsia: EAU,
  			slate: NEUTRE,
  			gray: NEUTRE,
  			zinc: NEUTRE,
  			neutral: NEUTRE,
  			stone: NEUTRE,
  			// Charte « carnet de ferme » (palier 1, 2026-10-08) : jetons de
  			// globals.css, clair et sombre. Aucune classe existante renommée.
  			papier: 'var(--papier)',
  			craie: 'var(--craie)',
  			encre: 'var(--encre)',
  			ardoise: 'var(--ardoise)',
  			lin: { DEFAULT: 'var(--lin)', doux: 'var(--lin-doux)' },
  			sauge: { DEFAULT: 'var(--sauge)', doux: 'var(--sauge-doux)' },
  			foret: 'var(--foret)',
  			argile: { DEFAULT: 'var(--argile)', doux: 'var(--argile-doux)' },
  			paille: { DEFAULT: 'var(--paille)', doux: 'var(--paille-doux)' },
  			eau: { DEFAULT: 'var(--eau)', doux: 'var(--eau-doux)' },
  			prairie: 'var(--prairie)',
  			ocre: 'var(--ocre)',
  			garance: { DEFAULT: 'var(--garance)', doux: 'var(--garance-doux)' },
  			terre: { DEFAULT: 'var(--terre)', claire: 'var(--terre-claire)' },
  			herbe: { DEFAULT: 'var(--herbe)', sombre: 'var(--herbe-sombre)' },
  		},
  		boxShadow: {
  			fiche: 'var(--ombre-fiche)',
  		},
  		transitionDuration: {
  			fast: 'var(--d-fast)',
  			base: 'var(--d-base)',
  			slow: 'var(--d-slow)',
  		},
  		// Clés « entree »/« sortie » et non « in »/« out » : ces dernières
  		// écraseraient les classes ease-in / ease-out déjà employées.
  		transitionTimingFunction: {
  			entree: 'var(--e-out)',
  			sortie: 'var(--e-in)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			// Charte « carnet de ferme », livraison L2 (2026-10-09) : l'interface
  			// passe sur Geist (locale) et les titres sur Fraunces. Inter et
  			// Space Grotesk restent chargées jusqu'au retrait L5, après preuve par
  			// captures de toutes les pages (Geist est un peu plus large qu'Inter).
  			sans: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			heading: ['var(--font-display)', 'Georgia', 'serif'],
  			mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
  			ui: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			display: ['var(--font-display)', 'Georgia', 'serif'],
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
