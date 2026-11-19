import * as React from "react"
import { CopyButton } from "@/components/ui/copy-button"
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { t } from "@/lib/i18n"
import { turnery } from "../bridge"
import type { AgentSetup } from "../core/protocol"

const EXAMPLE_ASK = t("用 turnery 建一个 80×50×30 的盒子，壁厚 2，外圆角 R4，四角 M3 螺纹孔，建完核对尺寸再看一眼。", "Use turnery to build an 80×50×30 box: 2 mm walls, R4 outer fillets, M3 tapped holes in the four corners. When done, check the dimensions and take a look.")

/** How to plug a local coding agent into Turnery: one command per agent. */
export function AgentSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [setup, setSetup] = React.useState<AgentSetup | null>(null)
  React.useEffect(() => {
    if (open && !setup) void turnery.agentSetup().then(setSetup)
  }, [open, setup])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title={t("接入 coding agent", "Connect a coding agent")} description={t("Turnery 通过 MCP 把建模和查看的工具交给本机的 agent；agent 每改一步，这个窗口都实时显示。", "Turnery gives the agents on this computer its modeling and viewing tools over MCP. Every step an agent takes shows up live in this window.")} />
        <DialogBody className="space-y-5 pb-5">
          {setup ? (
            <>
              <Section title="Claude Code" hint={t("在终端里运行一次：", "Run once in a terminal:")}>
                <Command text={setup.claude} />
              </Section>
              <Section title="Codex" hint={t("在终端里运行一次：", "Run once in a terminal:")}>
                <Command text={setup.codex} />
              </Section>
              <Section title={t("其他支持 MCP 的 agent", "Other agents that support MCP")} hint={t("Cursor、Claude Desktop 等，写进它们的 MCP 配置：", "Cursor, Claude Desktop and others: add this to their MCP config:")}>
                <Command text={setup.json} />
              </Section>
              <Section title={t("然后对 agent 说", "Then tell the agent")} hint={t("例如：", "For example:")}>
                <Command text={EXAMPLE_ASK} />
              </Section>
              <p className="text-small text-muted-foreground">
                {t("同一个程序也是命令行工具：", "The same program is also a command-line tool: ")}
                <code className="font-mono text-small">{setup.bin} help</code>
                {t(
                  "。窗口没开时 agent 也能建模、核对、导出，用到看图或点选时会自动打开 Turnery。",
                  ". Without the window open, the agent can still model, check and export; Turnery opens by itself when it needs to look at the model or ask you to pick.",
                )}
              </p>
            </>
          ) : (
            <p className="text-body text-muted-foreground">{t("正在读取…", "Loading…")}</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-body font-medium">{title}</h3>
      <p className="mt-0.5 mb-1.5 text-small text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

export function Command({ text }: { text: string }) {
  return (
    <div className="group relative rounded-md border bg-sunken">
      <pre className="overflow-x-auto py-2 pr-10 pl-3 font-mono text-small leading-relaxed whitespace-pre-wrap break-all">{text}</pre>
      <CopyButton value={text} iconOnly className="absolute top-1 right-1" />
    </div>
  )
}
