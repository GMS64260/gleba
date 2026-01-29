/**
 * Layout pour les pages d'authentification (sans navigation)
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
      {children}
    </div>
  )
}
