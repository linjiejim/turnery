// Which model answers in `npm run eval:studio`, and what a call cost.
//
// Two routes:
//   DeepSeek direct — DEEPSEEK_API_KEY.
//   OpenRouter      — OPENROUTER_API_KEY; takes precedence when both are set.
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel, ProviderMetadata } from "ai"

export type Thinking = "enabled" | "disabled"

export type ModelRoute = {
  model: LanguageModel
  /** Shown in the eval summary and the report's file name. */
  label: string
  via: "deepseek" | "openrouter"
  providerOptions?: Record<string, Record<string, never>>
  /** Dollars for one call: the provider's own figure when it reports one. */
  cost: (usage: Usage, meta: ProviderMetadata | undefined) => number
}

export function deepseekRoute(apiKey: string, model: string, thinking: Thinking, baseURL?: string): ModelRoute {
  const deepseek = createDeepSeek({ apiKey, baseURL })
  return {
    model: deepseek(model),
    label: model,
    via: "deepseek",
    providerOptions: { deepseek: { thinking: { type: thinking }, ...(thinking === "enabled" ? { reasoningEffort: "low" } : {}) } as never },
    cost: (usage) => costUSD(model, usage),
  }
}

/**
 * OpenRouter serves the same weights from many hosts. Routing stays on fp8 or
 * better (several hosts run fp4), cheapest first; the account's data policy
 * decides which hosts are allowed at all. Sticking to the cheapest host also
 * keeps the prompt cache warm between steps.
 */
export const OPENROUTER_MODEL = "deepseek/deepseek-v4.1-flash-1017"

export const OPENROUTER_ROUTING = { quantizations: ["fp8", "fp16", "bf16"], sort: "price" }

/** `routing` is OpenRouter's `provider` object; OPENROUTER_ROUTING (JSON) in the environment overrides it. */
export function openrouterRoute(apiKey: string, model: string, thinking: Thinking, routing: object = OPENROUTER_ROUTING): ModelRoute {
  const openrouter = createOpenRouter({ apiKey, headers: { "HTTP-Referer": "https://turnery.linjiejim.com", "X-Title": "Turnery" } })
  return {
    model: openrouter.chat(model, {
      provider: routing as never,
      reasoning: thinking === "enabled" ? { effort: "low" } : { effort: "none" },
      usage: { include: true },
    }),
    label: model.replace(/^[^/]+\//, ""),
    via: "openrouter",
    cost: (usage, meta) => {
      const reported = (meta?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
      return typeof reported === "number" ? reported : costUSD("deepseek-flash", usage)
    },
  }
}

/** DeepSeek list prices per 1M tokens (USD), peak / off-peak. https://api-docs.deepseek.com/quick_start/pricing */
export const PRICE = {
  "deepseek-flash": { hit: [0.006, 0.003], miss: [0.3, 0.15], out: [1.2, 0.6] },
  "deepseek-v4-pro": { hit: [0.044, 0.022], miss: [1.32, 0.66], out: [3.96, 1.98] },
} as const

/** Peak = 01–04 and 06–10 UTC on weekdays (Chinese public holidays are off-peak; ignored here, which only over-counts). */
export function isPeak(d = new Date()) {
  const day = d.getUTCDay()
  const h = d.getUTCHours()
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
}

export type Usage = { inputTokens?: number; cacheReadTokens?: number; outputTokens?: number }

export function costUSD(model: string, u: Usage, at = new Date()) {
  const p = PRICE[model as keyof typeof PRICE] ?? PRICE["deepseek-v4-pro"]
  const k = isPeak(at) ? 0 : 1
  const hit = u.cacheReadTokens ?? 0
  const miss = Math.max(0, (u.inputTokens ?? 0) - hit)
  return (hit * p.hit[k] + miss * p.miss[k] + (u.outputTokens ?? 0) * p.out[k]) / 1e6
}
