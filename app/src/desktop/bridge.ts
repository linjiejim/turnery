// `window.turnery`, set up by the Electron preload script. The website's workbench installs its own
// (the engine running in the page, studio/web-host). Anywhere else every call fails and the page says
// where to open it.
import type { TurneryBridge } from "./core/protocol"
import { t } from "@/lib/i18n"

declare global {
  interface Window {
    turnery?: TurneryBridge
  }
}

export const inApp = typeof window !== "undefined" && Boolean(window.turnery)

const missing = () => Promise.reject(new Error(t("只能在 Turnery App 里使用", "Only works in the Turnery app")))

const unavailable: TurneryBridge = {
  state: missing,
  subscribe: () => () => {},
  call: missing,
  kernel: missing,
  onLook: () => () => {},
  saveFigure: missing,
  answerPick: missing,
  openPart: missing,
  newPart: missing,
  newProject: missing,
  openProject: missing,
  openProjectAt: missing,
  recentProjects: () => Promise.resolve([]),
  openExample: missing,
  models: () => Promise.resolve({ current: null, presets: [], keysEncrypted: false }),
  saveModel: missing,
  assistantSend: missing,
  assistantStop: () => Promise.resolve(),
  setLanguage: () => Promise.resolve(),
  onAssistant: () => () => {},
  chats: () => Promise.resolve([]),
  chatRead: () => Promise.resolve(null),
  chatSave: missing,
  chatRename: missing,
  chatDelete: missing,
  pickFile: missing,
  reveal: missing,
  exportPart: missing,
  agentSetup: missing,
  copy: missing,
  onMenu: () => () => {},
  update: () => Promise.resolve({ phase: "idle" }),
  onUpdate: () => () => {},
  onNotice: () => () => {},
  restartToUpdate: missing,
  platform: "web",
} satisfies TurneryBridge

let installed: TurneryBridge | null = null

/** The website's workbench: its engine answers in place of the app's. `null` takes it away again. */
export function installBridge(bridge: TurneryBridge | null) {
  installed = bridge
}

/** The app's bridge, else the one the page installed, else one that says where to open this. */
export const turnery: TurneryBridge = new Proxy(unavailable, {
  get: (_, key) => Reflect.get(window.turnery ?? installed ?? unavailable, key),
})
