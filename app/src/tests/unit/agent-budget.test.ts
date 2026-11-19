// What every agent gets before its first call — the tool list and the guide — in English. The tool
// descriptions are built when the catalog loads, in the process's language (lib/agent-lang.ts), so
// this loads it afresh with TURNERY_LANG=en. desktop.test.ts holds the Chinese budget.
import { afterAll, describe, expect, it, vi } from "vitest"

const before = process.env.TURNERY_LANG
afterAll(() => {
  if (before === undefined) delete process.env.TURNERY_LANG
  else process.env.TURNERY_LANG = before
  vi.resetModules()
})

async function englishCatalog() {
  process.env.TURNERY_LANG = "en"
  vi.resetModules()
  return import("@/desktop/core/catalog")
}

describe("the agent's English", () => {
  it("keeps the tool list within its budget", async () => {
    const { agentCommands, inputJsonSchema } = await englishCatalog()
    let total = 0
    // Measured as desktop.test.ts measures the Chinese: the input schemas.
    for (const c of agentCommands()) total += JSON.stringify(inputJsonSchema(c)).length
    // English runs about 1.45× the characters of the Chinese (66 500) for about the same tokens.
    // 2026-11-20: ~96 300.
    expect(total).toBeLessThan(100_000)
  })

  it("has no Chinese left in tool descriptions, parameter descriptions or the guide, except the main body's name", async () => {
    const { AGENT_GUIDE, agentCommands, inputJsonSchema } = await englishCatalog()
    const texts = [AGENT_GUIDE, ...agentCommands().flatMap((c) => [c.description, JSON.stringify(inputJsonSchema(c))])]
    // 「主体」 is a part key agents write back, so it stays as it is in every language.
    const left = texts.flatMap((s) => s.replace(/主体/g, "").match(/[一-龥][一-龥，。、：（）「」]*/g) ?? [])
    expect([...new Set(left)]).toEqual([])
  })
})
