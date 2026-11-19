import * as React from "react"
import type { UIMessage } from "ai"
import { Button } from "@/components/ui/button"
import { Callout } from "@/components/ui/callout"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CopyButton } from "@/components/ui/copy-button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input, Textarea } from "@/components/ui/input"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import type { Tree } from "../dsl"
import { LIMITS } from "../limits"
import { chatLines, createShare, deleteShare, payloadProblem, sharePayload, shareUrl, type ShareCreated } from "../share"

/** 「法兰盘」rather than 「草图1」: the first feature that isn't a sketch, named by the model. */
function defaultTitle(tree: Tree) {
  const named = tree.features.find((f) => f.op !== "sketch" && f.name?.trim())
  return named?.name?.trim().slice(0, LIMITS.title) || t("我的模型", "My model")
}

/**
 * Make a link to the current model: title, an optional note, and (only when
 * ticked) the text of the chat. Once made, the link can be copied or deleted
 * again; deleting is the one irreversible step, so it asks first.
 */
export function ShareDialog({ open, onOpenChange, tree, messages }: { open: boolean; onOpenChange: (o: boolean) => void; tree: Tree; messages: UIMessage[] }) {
  const [title, setTitle] = React.useState("")
  const [note, setNote] = React.useState("")
  const [withChat, setWithChat] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [made, setMade] = React.useState<ShareCreated | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const lines = React.useMemo(() => (open ? chatLines(messages).length : 0), [open, messages])

  // Every opening starts a new link from the model as it is now.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(defaultTitle(tree))
      setNote("")
      setWithChat(false)
      setError(null)
      setMade(null)
    }
  }

  const generate = async () => {
    const payload = sharePayload({ title, note, tree, messages: withChat ? messages : undefined })
    const problem = payloadProblem(payload)
    if (problem) return setError(problem)
    setPending(true)
    setError(null)
    try {
      setMade(await createShare(payload))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  const url = made ? shareUrl(made.id) : ""

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader
            title={t("分享模型", "Share model")}
            description={made ? t("知道链接的人都能打开、拖参数、复制到自己的工作台；链接不会被列出或搜到。", "Anyone with the link can open it, drag the parameters and copy it to their own Workbench. The link isn’t listed or searchable.") : t("生成一个链接，别人打开就能看到同一个模型。", "Make a link that opens this same model for anyone.")}
          />
          {made ? (
            <DialogBody>
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label={t("分享链接", "Share link")} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
                <CopyButton value={url} label={t("复制链接", "Copy link")} variant="primary" size="md" />
              </div>
              <p className="mt-3 text-small text-muted-foreground">{t("一年里没人打开过的链接会自动删除。之后再改模型，链接里的不会跟着变。", "Links nobody opens for a year are deleted. Later changes to the model don’t reach the link.")}</p>
              <Button variant="link" size="sm" className="mt-4 text-destructive" onClick={() => setConfirmDelete(true)}>
                {t("删除这个链接", "Delete this link")}
              </Button>
            </DialogBody>
          ) : (
            <DialogBody>
              <FieldGroup>
                <Field label={t("标题", "Title")} required>
                  <Input value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label={t("说明", "Description")} hint={t(`可选，最多 ${LIMITS.note} 字`, `Optional, up to ${LIMITS.note} characters`)}>
                  <Textarea value={note} maxLength={LIMITS.note} rows={2} placeholder={t("例如：第三课作业", "e.g. Lesson 3 homework")} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <label className="flex items-start gap-2">
                  <Checkbox className="mt-0.5" checked={withChat} disabled={!lines} onCheckedChange={(c) => setWithChat(c === true)} />
                  <span>
                    <span className="block text-body">{t("附上和助教的对话（只含文字）", "Include the chat with the tutor (text only)")}</span>
                    <span className="block text-small text-faint-foreground">
                      {lines ? t(`会带上 ${lines} 条消息；图片、思考过程和工具调用不会带上`, `${lines} ${lines === 1 ? "message" : "messages"}; images, thinking and tool calls are left out`) : t("还没有对话", "No chat yet")}
                    </span>
                  </span>
                </label>
              </FieldGroup>
              {error && (
                <Callout tone="danger" className="mt-4">
                  {error}
                </Callout>
              )}
            </DialogBody>
          )}
          <DialogFooter>
            {made ? (
              <Button onClick={() => onOpenChange(false)}>{t("关闭", "Close")}</Button>
            ) : (
              <Button variant="primary" loading={pending} disabled={!title.trim()} onClick={() => void generate()}>
                {t("生成链接", "Create link")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("删除这个链接？", "Delete this link?")}
        description={t("之后打开它的人只会看到「链接不存在」。删除后不能恢复。", "Anyone who opens it will see “Link not found”. This can’t be undone.")}
        confirmLabel={t("删除链接", "Delete link")}
        tone="danger"
        onConfirm={async () => {
          if (!made) return
          await deleteShare(made.id, made.deleteToken)
          setMade(null)
          onOpenChange(false)
          notify.success(t("已删除链接", "Link deleted"))
        }}
      />
    </>
  )
}
