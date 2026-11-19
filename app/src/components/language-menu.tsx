import { Languages } from "lucide-react"
import { IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { isEn, LOCALES, locale, setLocale, type Locale } from "@/lib/i18n"

/** In both languages on purpose: someone who can't read the page can still find it. */
const LABEL = isEn ? "Language · 语言" : "语言 · Language"

/** 中文 / English. Each name is written in its own language, so it can be found from either. */
export function LanguageMenu({ size = "icon", className }: { size?: "icon" | "icon-sm"; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={LABEL} size={size} className={className ?? "text-muted-foreground"}>
          <Languages />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => v !== locale && setLocale(v as Locale)}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l.id} value={l.id} lang={l.html}>
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
