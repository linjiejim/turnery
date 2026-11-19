// Which model the built-in assistant talks to. A preset is where a provider lives and how to speak
// to it; a config is the person's choice (preset, model name, maybe their own address).
// Keys are not here: they come from the environment or from ~/.turnery/providers.json (the store).
import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"
import { ta } from "../../lib/agent-lang"

export type Preset = {
  id: string
  name: string
  /** How to speak to it. Most providers, and every local server, take the OpenAI chat format. */
  kind: "openai-compatible" | "anthropic" | "deepseek"
  baseURL?: string
  /** A model that is known to work with the tools; empty when the person has to name one. */
  model: string
  /** The default model takes images (look hands it the rendered views). */
  vision: boolean
  /** Runs on this machine: no key. */
  keyless?: boolean
}

export const PRESETS: Preset[] = [
  { id: "deepseek", name: "DeepSeek", kind: "deepseek", model: "deepseek-flash", vision: false },
  { id: "openrouter", name: "OpenRouter", kind: "openai-compatible", baseURL: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-v4.1-flash-1017", vision: false },
  { id: "anthropic", name: "Anthropic", kind: "anthropic", model: "claude-sonnet-5-5", vision: true },
  { id: "openai", name: "OpenAI", kind: "openai-compatible", baseURL: "https://api.openai.com/v1", model: "", vision: true },
  { id: "gemini", name: "Google Gemini", kind: "openai-compatible", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "", vision: true },
  // Names with words in them are read when shown (the language can change while the app runs).
  { id: "moonshot", get name() { return ta("Moonshot（Kimi）", "Moonshot (Kimi)") }, kind: "openai-compatible", baseURL: "https://api.moonshot.cn/v1", model: "", vision: false },
  { id: "zhipu", get name() { return ta("智谱", "Zhipu") }, kind: "openai-compatible", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "", vision: false },
  { id: "dashscope", get name() { return ta("通义（DashScope）", "Qwen (DashScope)") }, kind: "openai-compatible", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "", vision: false },
  { id: "siliconflow", name: "SiliconFlow", kind: "openai-compatible", baseURL: "https://api.siliconflow.cn/v1", model: "", vision: false },
  { id: "ollama", get name() { return ta("Ollama（本机）", "Ollama (this computer)") }, kind: "openai-compatible", baseURL: "http://localhost:11434/v1", model: "", vision: false, keyless: true },
  { id: "custom", get name() { return ta("自定义（OpenAI 兼容）", "Custom (OpenAI-compatible)") }, kind: "openai-compatible", model: "", vision: false },
]

export const presetOf = (id: string) => PRESETS.find((p) => p.id === id) ?? null

/** What the person chose for one preset. */
export type ModelConfig = { preset: string; model?: string; baseURL?: string; vision?: boolean }

/** The environment variable that carries a preset's key: TURNERY_API_KEY_DEEPSEEK. It wins over the stored key. */
export const keyEnvOf = (preset: string) => `TURNERY_API_KEY_${preset.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`

export type ResolvedModel = { model: LanguageModel; vision: boolean; label: string; providerOptions?: Record<string, Record<string, never>> }

/** The model to call, or a sentence saying what is missing. `fetch` lets the app go through the system proxy. */
export function languageModel(config: ModelConfig, apiKey: string | null, fetch?: typeof globalThis.fetch): ResolvedModel | { error: string } {
  const preset = presetOf(config.preset)
  if (!preset) return { error: ta(`没有这个预设：${config.preset}（可选：${PRESETS.map((p) => p.id).join("、")}）`, `No such preset: ${config.preset} (choose from: ${PRESETS.map((p) => p.id).join(", ")})`) }
  const name = (config.model || preset.model).trim()
  if (!name) return { error: ta(`${preset.name} 还没有填模型名`, `${preset.name} has no model name yet`) }
  const baseURL = (config.baseURL || preset.baseURL || "").trim() || undefined
  if (!preset.keyless && !apiKey) return { error: ta(`${preset.name} 还没有 key：设环境变量 ${keyEnvOf(preset.id)}，或者在模型设置里填`, `${preset.name} has no key yet: set the environment variable ${keyEnvOf(preset.id)}, or enter it in the model settings`) }
  const vision = config.vision ?? (name === preset.model ? preset.vision : false)
  const label = `${preset.name} · ${name}`
  if (preset.kind === "anthropic") return { model: createAnthropic({ apiKey: apiKey!, baseURL, fetch })(name), vision, label }
  if (preset.kind === "deepseek") {
    // Thinking on, at low effort: without it the smaller model drops steps (docs/dev/studio.md, the evals).
    const providerOptions = { deepseek: { thinking: { type: "enabled" }, reasoningEffort: "low" } as never }
    return { model: createDeepSeek({ apiKey: apiKey!, baseURL, fetch })(name), vision, label, providerOptions }
  }
  if (!baseURL) return { error: ta(`${preset.name} 还没有填地址（OpenAI 兼容的 /v1 地址）`, `${preset.name} has no address yet (an OpenAI-compatible /v1 address)`) }
  return { model: createOpenAICompatible({ name: preset.id, baseURL, apiKey: apiKey ?? undefined, fetch })(name), vision, label }
}
