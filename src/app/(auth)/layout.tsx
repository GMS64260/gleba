/**
 * Layout auth — fond aurora animé + dot grid, scrollable
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 scroll-smooth">
      {/* Fond aurora animé */}
      <div className="fixed inset-0 aurora-bg pointer-events-none" />
      {/* Dot grid overlay */}
      <div className="fixed inset-0 dot-grid pointer-events-none" />
      {/* Contenu */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
