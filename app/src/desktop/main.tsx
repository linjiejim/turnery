import "@fontsource-variable/inter"
import "@fontsource-variable/jetbrains-mono"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LucideProvider } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { DesktopApp } from "./app"
import "../index.css"

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
