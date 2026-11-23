// The kit's own copy in the window's language, before any of it renders.
import "@/lib/kit-strings"
import "@fontsource-variable/ibm-plex-sans"
import "@fontsource/ibm-plex-mono/400.css"
import "@fontsource/ibm-plex-mono/500.css"
import "@fontsource/ibm-plex-mono/600.css"
import "../styles/fonts/turnery-sans-sc.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LucideProvider } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { DesktopApp } from "./app"
import { applyLocale, locale } from "@/lib/i18n"
import "../index.css"

applyLocale()
// The app's menus and dialogs follow the window's language.
void window.turnery?.setLanguage?.(locale)

// Same rule as the site: a saved choice, otherwise the system's.
const applyTheme = () => {
  let saved: string | null = null
  try {
    saved = localStorage.getItem("appearance")
  } catch {
    /* no storage: follow the system */
  }
  const dark = saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}
applyTheme()
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LucideProvider strokeWidth={1.75}>
      <TooltipProvider>
        <DesktopApp />
        {/* Below the 48px title bar (its buttons sit top right); sonner resets any side left out to 24px. */}
        <Toaster offset={{ top: 56, right: 16 }} />
      </TooltipProvider>
    </LucideProvider>
  </StrictMode>,
)
