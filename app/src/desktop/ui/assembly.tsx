import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { turnery } from "../bridge"
import type { DocState } from "../core/protocol"
import { PaletteChoice } from "@/studio/ui/look-picker"

/** 「+ 零件」 over an assembly's parts: a new part, an existing file, or a STEP. */
export function AddPartMenu({ doc }: { doc: DocState }) {
  const [naming, setNaming] = React.useState(false)
  const add = async (input: { name?: string; file?: string; color?: string }) => {
    const r = await turnery.call("add_part", input, doc.path)
    if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
    return r.ok
  }
  const pick = async (kind: "part" | "step") => {
    const file = await turnery.pickFile(kind)
    if (file) await add({ file })
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-small text-muted-foreground">
            <Plus />
            {t("零件", "Part")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setNaming(true)}>{t("新零件…", "New part…")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void pick("part")}>{t("已有零件或装配…", "Existing part or assembly…")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void pick("step")}>{t("STEP 参考件…", "STEP reference…")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewPartDialog open={naming} onOpenChange={setNaming} onCreate={(name, color) => add({ name, ...(color ? { color } : {}) })} />
    </>
  )
}

function NewPartDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (name: string, color: string | null) => Promise<boolean> }) {
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await onCreate(name.trim(), color)
    setBusy(false)
    if (ok) {
      setName("")
      setColor(null)
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t("新零件", "New part")} description={t("建在 parts/ 下，放进这个装配，然后在装配里编辑它", "Created under parts/ and added to this assembly, where you then edit it")} />
        <DialogBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <Input autoFocus placeholder={t("零件名，例如 笔杆", "Part name, e.g. barrel")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("零件名", "Part name")} />
          </form>
          <div className="mt-4 space-y-2">
            <div className="text-small text-muted-foreground">{t("颜色（可以以后再改）", "Color (can be changed later)")}</div>
            <PaletteChoice value={color} onChange={setColor} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" disabled={!name.trim()} loading={busy} onClick={() => void submit()}>
            {t("新建", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
