import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { turnery } from "../bridge"
import type { ModelSettings } from "../core/protocol"

/** The main process says how a key is kept in Chinese (desktop/src/main/assistant.ts KEY_NOTE): its English. */
const KEY_NOTE_EN: Record<string, string> = { "来自环境变量": "From an environment variable", "已加密保存": "Saved, encrypted", "已保存（明文，文件权限 600）": "Saved (plain text, file mode 600)" }

/** Which model the built-in assistant uses: a provider, a model name, a key. */
export function ModelSettingsDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (s: ModelSettings) => void }) {
  const [settings, setSettings] = React.useState<ModelSettings | null>(null)
  const [preset, setPreset] = React.useState("")
  const [model, setModel] = React.useState("")
  const [baseURL, setBaseURL] = React.useState("")
  const [vision, setVision] = React.useState(false)
  const [key, setKey] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const pick = React.useCallback((s: ModelSettings, id: string) => {
    const p = s.presets.find((x) => x.id === id)
    if (!p) return
    setPreset(id)
    setModel(p.model)
    setBaseURL(p.baseURL)
    setVision(p.vision ?? p.defaultVision)
    setKey("")
  }, [])
  React.useEffect(() => {
    if (!open) return
    void turnery.models().then((s) => {
      setSettings(s)
      pick(s, s.current ?? s.presets[0]?.id ?? "")
    })
  }, [open, pick])

  const p = settings?.presets.find((x) => x.id === preset)
  const save = async () => {
    if (!p) return
    setSaving(true)
    try {
      const next = await turnery.saveModel({ preset, model: model.trim(), baseURL: baseURL.trim(), vision, key: key.trim() ? key.trim() : undefined })
      onSaved(next)
      onOpenChange(false)
    } catch {
      notify.error(t("没能保存模型设置", "Couldn’t save the model settings"))
    } finally {
      setSaving(false)
    }
  }
  const ready = Boolean(p && (model.trim() || p.defaultModel) && (p.keyless || p.hasKey || key.trim()) && (p.defaultBaseURL || baseURL.trim() || p.id === "anthropic" || p.id === "deepseek"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader title={t("助手用哪个模型", "Assistant model")} description={t("对话建模用你自己的模型和 key。key 只留在这台电脑上，不进项目文件夹。", "Modeling by chat uses your own model and key. The key stays on this computer and never goes into the project folder.")} />
        <DialogBody className="space-y-4 pb-2">
          {settings && p && (
            <>
              <Field label={t("服务商", "Provider")}>
                <Select aria-label={t("服务商", "Provider")} value={preset} onValueChange={(id) => pick(settings, id)} options={settings.presets.map((x) => ({ value: x.id, label: x.name }))} />
              </Field>
              <Field label={t("模型名", "Model name")} hint={p.defaultModel ? t(`不填就用 ${p.defaultModel}`, `Leave blank to use ${p.defaultModel}`) : t("这家要自己填模型名，照它的文档写", "This provider needs a model name; use the one from its docs")}>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={p.defaultModel || t("模型名", "Model name")} spellCheck={false} />
              </Field>
              <Field label={t("地址", "Base URL")} hint={p.defaultBaseURL ? t("一般不用改", "Usually left as is") : p.id === "custom" ? t("OpenAI 兼容的地址，通常以 /v1 结尾", "An OpenAI-compatible URL, usually ending in /v1") : t("不填用官方地址", "Leave blank for the official URL")}>
                <Input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder={p.defaultBaseURL || "https://…/v1"} spellCheck={false} />
              </Field>
              {!p.keyless && (
                <Field
                  label="Key"
                  hint={
                    p.hasKey
                      ? t(`${p.keyNote}。留空就继续用它。`, `${KEY_NOTE_EN[p.keyNote] ?? p.keyNote}. Leave blank to keep it.`)
                      : settings.keysEncrypted
                        ? t("保存时用系统的钥匙串加密。", "Encrypted with the system keychain when saved.")
                        : t("保存在 ~/.turnery/providers.json，明文，文件只有你能读。", "Saved in ~/.turnery/providers.json as plain text; only you can read the file.")
                  }
                >
                  <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={p.hasKey ? "••••••••" : t("粘贴 key", "Paste key")} autoComplete="off" spellCheck={false} />
                </Field>
              )}
              <label className="flex items-center justify-between gap-3 text-body">
                <span>
                  {t("这个模型能看图", "This model can see images")}
                  <span className="block text-caption text-muted-foreground">{t("打开后，助手用「看一眼」时会收到渲染图；看不了图的模型改用测量来确认。", "When on, the assistant gets rendered images when it looks at the model. Models that can’t see images check by measuring instead.")}</span>
                </span>
                <Switch checked={vision} onCheckedChange={setVision} aria-label={t("这个模型能看图", "This model can see images")} />
              </label>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("取消", "Cancel")}
          </Button>
          <Button variant="primary" disabled={!ready} loading={saving} onClick={() => void save()}>
            {t("保存并使用", "Save and use")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
