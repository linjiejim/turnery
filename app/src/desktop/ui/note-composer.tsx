import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/input"
import { t } from "@/lib/i18n"

/**
 * A note for the agent about the part, some parts or one step, not a spot on the model:
 * what the site's 「让助教改」 buttons start (a step's panel, a failed requirement), the selected
 * parts' 备注 and C. `text` null = closed; otherwise the text it opens with. `about` says what it's on.
 */
/** `onSave` resolves true when the note was saved: only then does the dialog close (the draft stays otherwise). */
export function NoteComposer({ text, about, onClose, onSave }: { text: string | null; about: string; onClose: () => void; onSave: (text: string) => Promise<boolean> }) {
  const [value, setValue] = React.useState(text ?? "")
  const [opened, setOpened] = React.useState(text)
  if (opened !== text) {
    setOpened(text)
    setValue(text ?? "")
  }
  const [saving, setSaving] = React.useState(false)
  const save = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={text !== null} onOpenChange={(open) => !open && onClose()} dirty={value.trim() !== (text ?? "").trim()}>
      <DialogContent size="md">
        <DialogHeader title={t("给 agent 留一条备注", "Leave a note for the agent")} description={t(`${about}Agent 下一次调用时会知道，用 get_notes 读到全文。`, `${about} The agent learns of it on its next call and reads it in full with get_notes.`)} />
        <DialogBody>
          <Textarea
            rows={5}
            autoFocus
            value={value}
            maxLength={600}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void save()
              }
            }}
            placeholder={t("例如：把外圆角改成 R6，顶部开口边再倒个 C0.5", "For example: make the outer fillets R6 and chamfer the top opening C0.5")}
            aria-label={t("备注", "Note")}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("取消", "Cancel")}
          </Button>
          <Button variant="primary" loading={saving} disabled={!value.trim()} onClick={() => void save()}>
            {t("记下备注", "Save note")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
