import * as React from "react"
import { Link } from "react-router"
import { ArrowRight, Monitor, X } from "lucide-react"
import { IconButton } from "@/components/ui/button"
import { t } from "@/lib/i18n"

const STORE = "ft-studio-desktop-banner"

/**
 * A strip over the workbench pointing to the desktop app, for what the browser can't do: an agent on
 * your machine (Claude Code, Codex) working on files in your own folders. Closed once, it stays closed.
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
    <aside aria-label={t("桌面版", "Desktop app")} className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted pr-1 pl-3 text-small text-muted-foreground">
      <Monitor aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="max-md:hidden">{t("想让本机的 Claude Code、Codex 直接改你电脑上的项目文件夹？用桌面版。", "Want Claude Code or Codex on your machine to work on project folders on your computer? Use the desktop app.")}</span>
        <span className="md:hidden">{t("桌面版接本机的 Claude Code、Codex。", "The desktop app connects local agents.")}</span>
      </span>
      <Link to="/desktop" className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
        {t("下载桌面版", "Get the desktop app")}
        <ArrowRight className="size-3.5" />
      </Link>
      <IconButton label={t("不再显示", "Don’t show again")} size="icon-sm" className="ml-auto text-muted-foreground" onClick={close}>
        <X />
      </IconButton>
    </aside>
  )
}
