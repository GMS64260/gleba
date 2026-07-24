"use client"

/**
 * Provider de session NextAuth pour les composants client
 */

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { IconContext } from "@phosphor-icons/react"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "duotone", size: 20 }}>
      <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
    </IconContext.Provider>
  )
}
