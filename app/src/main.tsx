import "@fontsource-variable/inter"
import "@fontsource-variable/jetbrains-mono"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LucideProvider } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { App } from "./App"
import { takeMovedFromAddress } from "./lib/moved"
import { applyLocale } from "./lib/i18n"
import "./index.css"

takeMovedFromAddress()

// A stored choice of English moves a Chinese address to its /en twin: nothing to render here then.
if (!applyLocale()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LucideProvider strokeWidth={1.75}>
        <TooltipProvider>
          <App />
          {/* Below the 48 px top bar every page has (as the desktop's below its title bar): its actions stay clickable. */}
          <Toaster offset={{ top: 56, right: 16 }} />
        </TooltipProvider>
      </LucideProvider>
    </StrictMode>,
  )
}
