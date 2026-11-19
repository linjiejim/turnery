import * as React from "react"
import { Link } from "react-router"
import { ArrowRight, Monitor, X } from "lucide-react"
import { IconButton } from "@/components/ui/button"

const STORE = "ft-studio-desktop-banner"

/**
 * A strip over the workbench pointing to the desktop app, for what the browser can't do: an agent on
 * your machine, assemblies, STEP files. Closed once, it stays closed (in this browser).
 */
export function DesktopBanner() {
  const [shown, setShown] = React.useState(() => {
    try {
      return localStorage.getItem(STORE) !== "closed"
    } catch {
      return true
    }
  })
  if (!shown) return null
  const close = () => {
    setShown(false)
    try {
      localStorage.setItem(STORE, "closed")
    } catch {
      /* private mode: closed for this visit only */
    }
  }
  return (
    <aside aria-label="桌面版" className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted pr-1 pl-3 text-small text-muted-foreground">
      <Monitor aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="max-md:hidden">要建更复杂的零件？桌面版接入 Claude Code、Codex，支持装配、STEP 导入和标准件。</span>
        <span className="md:hidden">桌面版能建更复杂的零件。</span>
      </span>
      <Link to="/desktop" className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
        下载桌面版
        <ArrowRight className="size-3.5" />
      </Link>
      <IconButton label="不再显示" size="icon-sm" className="ml-auto text-muted-foreground" onClick={close}>
        <X />
      </IconButton>
    </aside>
  )
}
