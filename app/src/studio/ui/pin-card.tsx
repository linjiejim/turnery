import * as React from "react"
import { Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import type { PinNote } from "../pin-notes"
import { useViewAnchor } from "./use-view-anchor"

type V3 = [number, number, number]

/** A note already on the model, opened from its pin: change the words, mark it handled, or delete it. */
export function PinNoteCard({
  viewer,
  point,
  note,
  onSave,
  onResolve,
  onRemove,
  onClose,
}: {
  viewer: Viewer
  /** Where the pin is drawn now (pulled-apart parts moved). */
  point: V3
  note: PinNote
  onSave: (text: string) => Promise<boolean>
  onResolve: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const [text, setText] = React.useState(note.text)
  const [saving, setSaving] = React.useState(false)
  const { anchor, moving, place } = useViewAnchor(viewer, point)
  const changed = text.trim() !== note.text.trim()
  const save = async () => {
    if (!changed) return onClose()
    setSaving(true)
    try {
      if (await onSave(text)) onClose()
    } finally {
      setSaving(false)
    }
  }
  return (
    <Popover open={!moving} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        key={place}
        side="right"
        align="start"
        sideOffset={16}
        className="w-80 max-w-[calc(100vw-1rem)]"
        aria-label={t(`备注 ${note.n}`, `Note ${note.n}`)}
        onInteractOutside={(e) => {
          if (viewer.renderer.domElement.contains(e.target as Node)) e.preventDefault()
        }}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground tabular">{note.n}</span>
          <span className="min-w-0 truncate text-small text-muted-foreground">{note.about}</span>
        </div>
        <Textarea
          className="mt-3 resize-none"
          rows={3}
          autoFocus
          maxLength={600}
          value={text}
          placeholder={t("这里想怎么改？", "What should change here?")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void save()
            }
          }}
          aria-label={t("备注", "Note")}
        />
        {note.reply && (
          <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-small">
            <span className="font-medium">{t("Agent：", "Agent: ")}</span>
            {note.reply}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1">
          <Button size="sm" variant="ghost" className="-ml-2 text-muted-foreground" onClick={onRemove}>
            <Trash2 />
            {t("删除", "Delete")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onResolve}>
            <Check />
            {t("标为已处理", "Mark as handled")}
          </Button>
          <Button size="sm" variant="primary" className="ml-auto" loading={saving} disabled={!changed} onClick={() => void save()}>
            {t("保存", "Save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
