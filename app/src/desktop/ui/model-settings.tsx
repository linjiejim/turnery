import * as React from "react"
import { Check, Copy } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { turnery } from "../bridge"
import type { AgentInfo, AgentsState, ModelSettings } from "../core/protocol"

/** The main process says how a key is kept in Chinese (desktop/src/main/assistant.ts KEY_NOTE): its English. */
const KEY_NOTE_EN: Record<string, string> = { "来自环境变量": "From an environment variable", "已加密保存": "Saved, encrypted", "已保存（明文，文件权限 600）": "Saved (plain text, file mode 600)" }

/**
 * Who answers in the chat window: the built-in assistant (a provider, a model name, a key) or an
 * outside agent the person installed and signed in to themselves (Codex).
 */
export function ModelSettingsDialog({
  open,
  onOpenChange,
  onSaved,
  onAgents,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (s: ModelSettings) => void
  onAgents: (s: AgentsState) => void
}) {
  const [agents, setAgents] = React.useState<AgentsState | null>(null)
  const [use, setUse] = React.useState("builtin")
  const [checking, setChecking] = React.useState(false)
  const [agentPath, setAgentPath] = React.useState("")
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
    let alive = true
    void turnery.models().then((s) => {
      if (!alive) return
      setSettings(s)
      pick(s, s.current ?? s.presets[0]?.id ?? "")
    })
    // The agent in use is started and asked who is signed in; the others are only looked for.
    void turnery.agents().then((a) => {
      if (!alive) return
      setAgents(a)
      setUse(a.use)
    })
    return () => {
      alive = false
    }
  }, [open, pick])
  const run = async (job: () => Promise<AgentsState>) => {
    setChecking(true)
    try {
      setAgents(await job())
    } finally {
      setChecking(false)
    }
  }
  /** Look for the agent again (at `path`, when given), restarting it. Who answers doesn't change. */
  const recheck = (id: string, path?: string) =>
    run(async () => {
      if (path !== undefined) await turnery.saveAgents({ agent: id, path })
      return turnery.agents("recheck")
    })
  const choose = (v: string) => {
    setUse(v)
    setAgentPath("")
    // Only found so far: start it and ask who is signed in.
    const a = agents?.agents.find((x) => x.id === v)
    if (a && !a.checked) void run(() => turnery.agents("status"))
  }
  const agent = agents?.agents.find((a) => a.id === use) ?? null
  const busy = checking || (open && agents === null)

  const p = settings?.presets.find((x) => x.id === preset)
  const save = async () => {
    if (agent) {
      setSaving(true)
      try {
        onAgents(await turnery.saveAgents({ use: agent.id, ...(agentPath.trim() ? { agent: agent.id, path: agentPath.trim() } : {}) }))
        onOpenChange(false)
      } catch {
        notify.error(t("没能保存设置", "Couldn’t save the settings"))
      } finally {
        setSaving(false)
      }
      return
    }
    if (!p) return
    setSaving(true)
    try {
      const next = await turnery.saveModel({ preset, model: model.trim(), baseURL: baseURL.trim(), vision, key: key.trim() ? key.trim() : undefined })
      onSaved(next)
      if (agents && agents.use !== "builtin") onAgents(await turnery.saveAgents({ use: "builtin" }))
      onOpenChange(false)
    } catch {
      notify.error(t("没能保存模型设置", "Couldn’t save the model settings"))
    } finally {
      setSaving(false)
    }
  }
  const ready = agent
    ? !agent.problem && !busy
    : Boolean(p && (model.trim() || p.defaultModel) && (p.keyless || p.hasKey || key.trim()) && (p.defaultBaseURL || baseURL.trim() || p.id === "anthropic" || p.id === "deepseek"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader
          title={t("谁来回答", "Who answers")}
          description={
            agent
              ? t("用你自己装好、登录好的 agent 和它原本的订阅。Turnery 只把对话显示在这里，登录和用量都在它那边。", "Your own agent, installed and signed in by you, on its own subscription. Turnery only shows the conversation here; signing in and usage stay with the agent.")
              : t("对话建模用你自己的模型和 key。key 只留在这台电脑上，不进项目文件夹。", "Modeling by chat uses your own model and key. The key stays on this computer and never goes into the project folder.")
          }
        />
        <DialogBody className="space-y-4 pb-2">
          {agents && agents.agents.length > 0 && (
            <Segmented
              aria-label={t("谁来回答", "Who answers")}
              value={use}
              onValueChange={choose}
              options={[{ value: "builtin", label: t("内置助手", "Built-in assistant") }, ...agents.agents.map((a) => ({ value: a.id, label: a.name }))]}
            />
          )}
          {agent && <AgentStatus agent={agent} checking={busy} path={agentPath} onPath={setAgentPath} onRecheck={() => void recheck(agent.id, agentPath.trim() || undefined)} />}
          {!agent && settings && p && (
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
            {agent ? t(`使用 ${agent.name}`, `Use ${agent.name}`) : t("保存并使用", "Save and use")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A command for the person to run in a terminal, with a copy button. */
function Command({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted py-1 pr-1 pl-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-small">{text}</code>
      <IconButton
        label={copied ? t("已复制", "Copied") : t("复制", "Copy")}
        size="icon-sm"
        onClick={() => {
          void turnery.copy(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? <Check /> : <Copy />}
      </IconButton>
    </div>
  )
}

/** Whether the agent is ready (found, new enough, signed in), and what to run in a terminal if not. */
function AgentStatus({ agent, checking, path, onPath, onRecheck }: { agent: AgentInfo; checking: boolean; path: string; onPath: (p: string) => void; onRecheck: () => void }) {
  const steps: { text: React.ReactNode; command?: string }[] = []
  if (agent.problem === "missing") {
    steps.push({ text: t(`这台电脑上没找到 ${agent.name}。在终端里安装：`, `${agent.name} isn’t on this computer. Install it in a terminal:`), command: agent.install })
    steps.push({ text: t("再用你的 ChatGPT 账号登录：", "Then sign in with your ChatGPT account:"), command: agent.login })
  } else if (agent.problem === "old") {
    steps.push({ text: t(`${agent.name} 的版本是 ${agent.version ?? "未知"}，要 ${agent.minVersion} 或更新。在终端里更新：`, `${agent.name} is version ${agent.version ?? "unknown"}; ${agent.minVersion} or newer is needed. Update it in a terminal:`), command: agent.install })
  } else if (agent.problem === "signed-out") {
    steps.push({ text: t(`${agent.name} 还没登录。在终端里运行：`, `${agent.name} isn’t signed in. Run this in a terminal:`), command: agent.login })
  } else if (agent.problem === "failed") {
    steps.push({ text: t(`没能启动 ${agent.name}：${agent.detail ?? ""}`, `Couldn’t start ${agent.name}: ${agent.detail ?? ""}`) })
  }
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-body" role="status">
        {checking ? <Spinner className="mt-0.5 size-4" /> : agent.problem ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" /> : <Check className="mt-0.5 size-4 shrink-0 text-success" />}
        <div className="min-w-0 flex-1">
          <p>
            {checking
              ? t(`正在找 ${agent.name}…`, `Looking for ${agent.name}…`)
              : agent.problem
                ? t(`${agent.name} 还不能用`, `${agent.name} isn’t ready`)
                : agent.signedIn
                  ? t(`${agent.name} ${agent.version} · 已登录${agent.account ? `（${agent.account}）` : ""}`, `${agent.name} ${agent.version} · signed in${agent.account ? ` (${agent.account})` : ""}`)
                  : t(`${agent.name} ${agent.version} · 没能确认是否已登录`, `${agent.name} ${agent.version} · couldn’t tell whether it’s signed in`)}
          </p>
          {agent.path && !checking && <p className="truncate text-caption text-faint-foreground">{agent.path}</p>}
        </div>
        <Button variant="ghost" size="sm" disabled={checking} onClick={onRecheck}>
          {t("重新检查", "Check again")}
        </Button>
      </div>
      {!checking &&
        steps.map((s, i) => (
          <div key={i} className="space-y-1.5">
            <p className="text-small text-muted-foreground">{s.text}</p>
            {s.command && <Command text={s.command} />}
          </div>
        ))}
      {!checking && !agent.problem && agent.checked && agent.signedIn === null && (
        <div className="space-y-1.5">
          <p className="text-small text-muted-foreground">{t("没登录的话，在终端里运行：", "If it isn’t signed in, run this in a terminal:")}</p>
          <Command text={agent.login} />
        </div>
      )}
      {!checking && agent.problem && agent.problem !== "failed" && <p className="text-small text-muted-foreground">{t("做完点「重新检查」。", "Then click “Check again”.")}</p>}
      <p className="text-small text-muted-foreground">
        {t(
          `${agent.name} 在项目文件夹里工作，用 Turnery 的建模命令建模，你在窗口里看到每一步。改文件、跑会改东西的命令、用别的工具之前，它会在对话里先问你。`,
          `${agent.name} works in the project folder and builds with Turnery’s modeling commands; you see every step in the window. Before it edits files, runs commands that change things or uses other tools, it asks you in the chat.`,
        )}
      </p>
      <Field label={t(`${agent.name} 程序的位置`, `Where ${agent.name} is`)} hint={t("一般不用填。找不到、或者想用另一份时填。", "Usually left blank. Fill it in when it can’t be found, or to use another copy.")}>
        <Input value={path} onChange={(e) => onPath(e.target.value)} placeholder={agent.path ?? `/opt/homebrew/bin/${agent.id}`} spellCheck={false} />
      </Field>
    </div>
  )
}
