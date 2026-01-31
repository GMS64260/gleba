/**
 * Layout pour les pages d'authentification (sans navigation)
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50/30 to-white relative overflow-hidden">
      {/* Décoration arrière-plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Cercles décoratifs */}
        <div className="absolute top-20 -left-20 w-96 h-96 bg-green-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-100/10 rounded-full blur-3xl" />

        {/* Motifs végétaux subtils */}
        <div className="absolute top-10 right-10 text-green-200/30 text-9xl">🌿</div>
        <div className="absolute bottom-10 left-10 text-emerald-200/30 text-8xl">🌱</div>
        <div className="absolute top-1/3 right-1/4 text-green-200/20 text-7xl">🍃</div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 w-full py-12">
        {children}
      </div>
    </div>
  )
}
