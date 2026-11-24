// The window's only door to the engine: a small typed API on `window.turnery`.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import type { TurneryBridge, EngineEvent, LookRequest, MenuAction, Notice, UpdateStatus } from "../../../app/src/desktop/core/protocol"

declare const __TURNERY_VERSION__: string

function listen<T extends unknown[]>(channel: string, cb: (...args: T) => void) {
  const fn = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T))
  ipcRenderer.on(channel, fn)
  return () => void ipcRenderer.removeListener(channel, fn)
}

const bridge: TurneryBridge = {
  state: () => ipcRenderer.invoke("turnery:state"),
  subscribe: (cb) => listen<[EngineEvent]>("turnery:event", cb),
  call: (command, input, part) => ipcRenderer.invoke("turnery:call", command, input, part),
  kernel: (path, call) => ipcRenderer.invoke("turnery:kernel", path, call),
  onLook: (render) => {
    const off = listen<[number, LookRequest]>("turnery:look", async (id, req) => {
      try {
        ipcRenderer.send("turnery:look-done", id, { images: await render(req) })
      } catch (e) {
        ipcRenderer.send("turnery:look-done", id, { error: String((e as Error)?.message ?? e) })
      }
    })
    ipcRenderer.send("turnery:renderer-ready")
    return off
  },
  saveFigure: (figure) => ipcRenderer.invoke("turnery:save-figure", figure),
  answerPick: (id, answer) => ipcRenderer.invoke("turnery:answer-pick", id, answer),
  openPart: () => ipcRenderer.invoke("turnery:open-part"),
  newPart: () => ipcRenderer.invoke("turnery:new-part"),
  newProject: () => ipcRenderer.invoke("turnery:new-project"),
  openProject: () => ipcRenderer.invoke("turnery:open-project"),
  openProjectAt: (root) => ipcRenderer.invoke("turnery:open-project-at", root),
  recentProjects: () => ipcRenderer.invoke("turnery:recent-projects"),
  openExample: () => ipcRenderer.invoke("turnery:open-example"),
  models: () => ipcRenderer.invoke("turnery:models"),
  saveModel: (input) => ipcRenderer.invoke("turnery:models-save", input),
  assistantSend: (id, messages, lang, chat) => ipcRenderer.invoke("turnery:assistant-send", id, messages, lang, chat),
  agents: (check) => ipcRenderer.invoke("turnery:agents", check),
  saveAgents: (input) => ipcRenderer.invoke("turnery:agents-save", input),
  agentOptions: (chat) => ipcRenderer.invoke("turnery:agent-options", chat),
  setAgentOption: (chat, option, value) => ipcRenderer.invoke("turnery:agent-option", chat, option, value),
  answerPermission: (id, optionId) => ipcRenderer.invoke("turnery:agent-permission", id, optionId),
  onAgentsChanged: (cb) => {
    const handle = (_e: IpcRendererEvent, state: Parameters<typeof cb>[0]) => cb(state)
    ipcRenderer.on("turnery:agents-changed", handle)
    return () => ipcRenderer.removeListener("turnery:agents-changed", handle)
  },
  assistantStop: (id) => ipcRenderer.invoke("turnery:assistant-stop", id),
  setLanguage: (lang) => ipcRenderer.invoke("turnery:set-language", lang),
  onAssistant: (listener) => {
    const handle = (_e: unknown, id: string, chunk: unknown) => listener(id, chunk)
    ipcRenderer.on("turnery:assistant", handle)
    return () => ipcRenderer.removeListener("turnery:assistant", handle)
  },
  chats: (scope) => ipcRenderer.invoke("turnery:chats", scope),
  chatRead: (id) => ipcRenderer.invoke("turnery:chat-read", id),
  chatSave: (record, base) => ipcRenderer.invoke("turnery:chat-save", record, base),
  chatRename: (id, title) => ipcRenderer.invoke("turnery:chat-rename", id, title),
  chatDelete: (id) => ipcRenderer.invoke("turnery:chat-delete", id),
  pickFile: (kind) => ipcRenderer.invoke("turnery:pick-file", kind),
  reveal: (path) => ipcRenderer.invoke("turnery:reveal", path),
  exportPart: (format) => ipcRenderer.invoke("turnery:export", format),
  agentSetup: () => ipcRenderer.invoke("turnery:agent-setup"),
  copy: (text) => ipcRenderer.invoke("turnery:copy", text),
  onMenu: (cb) => listen<[MenuAction]>("turnery:menu", cb),
  update: () => ipcRenderer.invoke("turnery:update"),
  onUpdate: (cb) => listen<[UpdateStatus]>("turnery:update", cb),
  onNotice: (cb) => listen<[Notice]>("turnery:notice", cb),
  restartToUpdate: () => ipcRenderer.invoke("turnery:restart-to-update"),
  platform: process.platform,
  // package.json's, built in (scripts/build.mjs): the same as app.getVersion(), which the preload can't call.
  version: __TURNERY_VERSION__,
}

contextBridge.exposeInMainWorld("turnery", bridge)
