/**
 * Footer global de l'application
 * Affichage du copyright et attribution (requis AGPL-3.0)
 */

import Link from "next/link"
import { Leaf } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-white mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo et copyright */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Leaf className="h-4 w-4 text-green-600" />
            <span>
              Powered by{" "}
              <a
                href="https://github.com/GMS64260/gleba"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-green-600 hover:underline"
              >
                Gleba
              </a>
            </span>
            <span>•</span>
            <span>© 2024-2026 GMS64260</span>
          </div>

          {/* Liens */}
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://github.com/GMS64260/gleba"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-green-600 transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/LICENSE"
              className="text-muted-foreground hover:text-green-600 transition-colors"
            >
              Licence AGPL-3.0
            </Link>
            <span className="text-xs text-muted-foreground">
              v0.1.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
