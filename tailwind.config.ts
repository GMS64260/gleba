import type { Config } from "tailwindcss";

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
  			'tech-green': '#10B981',
  			'carbone': '#1E293B',
  			'terre-cuite': '#B45309',
  			'gris-nuage': '#F8FAFC',
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
