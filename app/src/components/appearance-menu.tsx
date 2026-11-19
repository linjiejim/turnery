import { Monitor, Moon, Sun } from "lucide-react"
import { IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAppearance, type Appearance } from "@/lib/appearance"
import { t } from "@/lib/i18n"

export function AppearanceMenu() {
  const { preference, resolved, setAppearance } = useAppearance()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t("外观", "Appearance")} className="text-muted-foreground">
          {resolved === "dark" ? <Moon /> : <Sun />}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setAppearance(v as Appearance)}>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            {t("跟随系统", "System")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun />
            {t("浅色", "Light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            {t("深色", "Dark")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
