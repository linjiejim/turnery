import { Link } from "react-router"
import { Boxes, Download, Ruler, Terminal } from "lucide-react"
import { TurneryMark } from "@/components/turnery-mark"
import { CodeBlock } from "@/components/code-block"
import { Button } from "@/components/ui/button"
import { Page } from "@/components/ui/page"
import { REPO_URL } from "@/lib/site"
import { t } from "@/lib/i18n"

const RELEASES = `${REPO_URL}/releases/latest`
const ADD_CLAUDE = "claude mcp add --scope user turnery -- /Applications/Turnery.app/Contents/Resources/bin/turnery mcp"

const ABILITIES = [
  {
    icon: <Terminal />,
    title: t("agent 来建模", "Your agent models"),
    text: t(
      "Claude Code、Codex 等通过 MCP 调用 40 个建模、观测和核对工具。你在窗口里看每一步，拖参数，在面上给它留备注。",
      "Claude Code, Codex and other agents call 40 tools over MCP to model, look and check. You watch every step in the window, drag parameters, and leave notes on faces.",
    ),
  },
  {
    icon: <Boxes />,
    title: t("项目和装配", "Projects and assemblies"),
    text: t(
      "一个文件夹就是一个项目。零件各是一个文件，组成装配一起看，共用一份参数；用贴合摆放零件，螺钉、螺母、热熔螺母直接从标准件里放，零件清单按规格计数。",
      "A folder is a project. Each part is its own file; an assembly puts them together on one shared set of parameters. Mates place the parts, screws, nuts and heat-set inserts come from the standard parts, and the bill of materials counts them by size.",
    ),
  },
  {
    icon: <Ruler />,
    title: t("STEP 和核对", "STEP files and checks"),
    text: t(
      "导入开发板、元件的官方 STEP，围着它建外壳；尺寸、间隙、干涉写成要求，每次重建自动核对。",
      "Import the official STEP file of a board or component and build the enclosure around it. Sizes, clearances and interferences become requirements that every rebuild checks again.",
    ),
  },
]

/** Turnery 桌面版: what it adds over the workbench here, where to get it, how to hook up an agent. */
export function DesktopPage() {
  return (
    <Page width="narrow" className="mx-auto">
      <div className="flex flex-col items-start gap-4 pt-6">
        <TurneryMark className="size-14" />
        <h1 className="text-title-lg font-semibold">{t("Turnery 桌面版", "Turnery desktop app")}</h1>
        <p className="max-w-[40rem] text-reading text-muted-foreground">
          {t(
            "让你电脑上的 coding agent 来建参数化零件。和这里的工作台是同一个内核、同一种文件；网页适合学，桌面版适合做真东西。",
            "Parametric parts, built by the coding agent on your computer. It has the same kernel and the same file format as the Workbench on this site: the site is for learning, the desktop app is for making real things.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="primary">
            <a href={RELEASES} target="_blank" rel="noopener noreferrer">
              <Download />
              {t("下载 macOS 版", "Download for macOS")}
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/studio">{t("先在网页上试试", "Try it in the browser first")}</Link>
          </Button>
        </div>
        <p className="text-small text-faint-foreground">{t("Apple 芯片选 arm64，Intel 选 x64。装好后会自动更新。", "arm64 for Apple silicon, x64 for Intel. Once installed, it updates itself.")}</p>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {ABILITIES.map((a) => (
          <div key={a.title} className="rounded-lg border p-4">
            <div className="text-muted-foreground [&_svg]:size-5">{a.icon}</div>
            <div className="mt-2 text-heading font-semibold">{a.title}</div>
            <p className="mt-1 text-small text-muted-foreground">{a.text}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-heading font-semibold">{t("第一次打开", "First launch")}</h2>
        <p className="mt-2 text-body text-muted-foreground">
          {t(
            "Turnery 没有 Apple 签名：第一次打开时，到「系统设置 → 隐私与安全性」点「仍要打开」。然后在 Turnery 右上角点「接入 Agent」，复制对应的命令到终端运行一次，例如 Claude Code：",
            "Turnery is not signed with an Apple certificate yet, so macOS blocks it the first time: open System Settings → Privacy & Security and choose “Open Anyway”. Then click “Connect an agent” at the top right of Turnery and run the command for your agent once in a terminal. For Claude Code:",
          )}
        </p>
        <CodeBlock code={ADD_CLAUDE} className="mt-3" />
        <p className="mt-3 text-body text-muted-foreground">
          {t(
            "之后对 agent 说要建什么，比如「用 turnery 建一个 80×50×30 的盒子，壁厚 2，四角 M3 螺纹孔」。",
            "Then tell the agent what to build, for example “use turnery to build an 80×50×30 box with 2 mm walls and an M3 tapped hole in each corner”.",
          )}
        </p>
      </section>
    </Page>
  )
}
