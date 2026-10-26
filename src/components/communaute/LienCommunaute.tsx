"use client"

import * as React from "react"
import NextLink from "next/link"

/** Les changements de query restent locaux et sont synchronisés avec useSearchParams. */
export function naviguerCommunaute(href: string, mode: "push" | "replace" = "push") {
  if (mode === "replace") window.history.replaceState(null, "", href)
  else if (`${window.location.pathname}${window.location.search}` !== href) window.history.pushState(null, "", href)
}

export const LienCommunaute = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<typeof NextLink>>(
  ({ href, onClick, ...props }, ref) => (
    <NextLink ref={ref} href={href} {...props} onClick={(event) => {
      onClick?.(event)
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || (props.target && props.target !== "_self")) return
      const url = new URL(event.currentTarget.href)
      if (url.origin !== window.location.origin || url.pathname !== "/communaute" || window.location.pathname !== "/communaute") return
      event.preventDefault()
      naviguerCommunaute(`${url.pathname}${url.search}${url.hash}`)
    }} />
  ),
)
LienCommunaute.displayName = "LienCommunaute"
