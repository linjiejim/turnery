// Executing a tool call: a pure edit of the feature tree, a rebuild through a
// kernel port (a Web Worker in the browser, the Kernel directly in Node), and
// a short plain-text result the model can act on.
import { ta } from "../lib/agent-lang"
import { Check, Feature, OP_NAMES, Tree, displayName, opAgentName, type FeatureOp } from "./dsl"
import { changeText, isSet, lookText, ownLook, setPartLook, type Finish } from "./appearance"
import { resolveParams } from "./expr"
import type { BuildReport } from "./kernel/build"
import { InputError } from "./kernel/errors"
import type { ToolOutput } from "./tools"

export type KernelPort = {
  rebuild(tree: Tree): Promise<BuildReport>
  inspect(what: "body" | "faces" | "edges", selector?: unknown): Promise<string>
}

export type LookFn = (views: string[], highlight?: string) => Promise<string[]>

export type ToolRun = { tree: Tree; output: ToolOutput; report?: BuildReport; focus?: string }

const FEATURE_OPS = new Set(Object.keys(OP_NAMES))
const r1 = (x: number) => Math.round(x * 10) / 10

/** Ids a feature depends on (sketch, patterned features, selector `of`). */
export function referencesOf(f: Feature): string[] {
  const out = new Set<string>()
  const walk = (v: unknown, key?: string) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, key === "features" ? "feature-item" : undefined))
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k)
    else if (typeof v === "string" && (key === "of" || key === "sketch" || key === "feature-item")) out.add(v)
  }
  walk(f)
  out.delete(f.id)
  return [...out]
}

/** A sketch with text in it, or a feature made from one: lettering. */
export function isLettering(tree: Tree, f: Feature): boolean {
  const sk = f.op === "sketch" ? f : "sketch" in f && typeof f.sketch === "string" ? tree.features.find((x) => x.id === f.sketch) : undefined
  return sk?.op === "sketch" && sk.shapes.some((x) => x.type === "text")
}

/** Where the run of lettering at the end of the tree starts (the tree's length: none). */
export function letteringTail(tree: Tree): number {
  let i = tree.features.length
  while (i > 0 && isLettering(tree, tree.features[i - 1])) i--
  return i
}

/** Put `f` in place of the feature with its id, as a whole (fields left out are removed). */
export function replaceFeature(tree: Tree, f: unknown): Tree {
  const parsed = Feature.safeParse(f)
  if (!parsed.success) throw new InputError(ta(`有字段不对：${issuesText(parsed.error.issues, "；")}`, `Some fields are wrong: ${issuesText(parsed.error.issues, "; ")}`))
  const i = tree.features.findIndex((x) => x.id === parsed.data.id)
  if (i < 0) throw new InputError(noFeature(parsed.data.id))
  const features = [...tree.features]
  features[i] = parsed.data
  return { ...tree, features }
}

/** One field of one feature set to `value` (a dimension edited on the model). */
export function setFieldAt(tree: Tree, id: string, path: (string | number)[], value: unknown): Tree {
  const f = tree.features.find((x) => x.id === id)
  if (!f) throw new InputError(noFeature(id))
  const copy = structuredClone(f) as Record<string | number, unknown>
  let at: Record<string | number, unknown> = copy
  for (const k of path.slice(0, -1)) {
    const next = at[k]
    if (!next || typeof next !== "object") throw new InputError(ta(`「${displayName(tree, f)}」没有这个字段：${path.join(".")}`, `“${displayName(tree, f)}” has no such field: ${path.join(".")}`))
    at = next as Record<string | number, unknown>
  }
  at[path[path.length - 1]] = value
  return replaceFeature(tree, copy)
}

/** A plain number in a feature made a named parameter: same model, now on the parameters panel. */
export function promoteToParam(tree: Tree, id: string, path: (string | number)[], name: string, note: string, value: number): Tree {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    throw new InputError(ta("参数名只能用字母、数字和下划线，不能以数字开头", "A parameter name can only use letters, digits and underscores, and can't start with a digit"))
  if (name in tree.params) throw new InputError(ta(`已经有参数「${name}」了`, `There is already a parameter “${name}”`))
  const withParam: Tree = { ...tree, params: { ...tree.params, [name]: value }, paramNotes: { ...tree.paramNotes, [name]: note } }
  return setFieldAt(withParam, id, path, name)
}

/** Move a feature one step up or down, never above something it uses or below something that uses it. */
export function moveFeature(tree: Tree, id: string, by: -1 | 1): Tree {
  const i = tree.features.findIndex((x) => x.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= tree.features.length) throw new InputError(ta("已经到头了", "It is already at the end"))
  const [a, b] = by < 0 ? [tree.features[j], tree.features[i]] : [tree.features[i], tree.features[j]]
  // After the swap `b` comes first: it must not use `a`.
  if (referencesOf(b).includes(a.id))
    throw new InputError(
      ta(`「${displayName(tree, b)}」用到了「${displayName(tree, a)}」，不能排到它前面`, `“${displayName(tree, b)}” uses “${displayName(tree, a)}”, so it can't go before it`),
    )
  const features = [...tree.features]
  features[i] = tree.features[j]
  features[j] = tree.features[i]
  return { ...tree, features }
}

export function applyEdit(tree: Tree, name: string, input: Record<string, unknown>): { tree: Tree; target?: string; note?: string } {
  if (name === "set_params") {
    const params = { ...tree.params }
    const notes = { ...tree.paramNotes }
    for (const k of (input.remove as string[] | undefined) ?? []) {
      delete params[k]
      delete notes[k]
    }
    for (const [k, v] of Object.entries((input.set as Record<string, number | string>) ?? {})) {
      if (!/^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*$/.test(k))
        throw new InputError(
          ta(
            `参数名「${k}」不合法：用字母、数字、下划线或中文，不以数字开头`,
            `The parameter name “${k}” isn't valid: use letters, digits, underscores or Chinese characters, not starting with a digit`,
          ),
        )
      params[k] = v
    }
    for (const [k, v] of Object.entries((input.notes as Record<string, string>) ?? {})) if (k in params && typeof v === "string") notes[k] = v.trim().slice(0, 60)
    resolveParams(params) // unknown names / cycles fail here, before the tree changes
    return { tree: { ...tree, params, ...(Object.keys(notes).length ? { paramNotes: notes } : { paramNotes: undefined }) } }
  }
  if (FEATURE_OPS.has(name)) {
    const { after, ...rest } = input as { after?: string } & Record<string, unknown>
    const parsed = Feature.safeParse({ ...rest, op: name })
    if (!parsed.success) throw new InputError(ta(`参数不对：${issuesText(parsed.error.issues, "；")}`, `The arguments are wrong: ${issuesText(parsed.error.issues, "; ")}`))
    const f = parsed.data
    if (tree.features.some((x) => x.id === f.id))
      throw new InputError(ta(`已经有 id 为「${f.id}」的特征了，换一个 id，或用 edit_feature 修改它`, `There is already a feature with id “${f.id}”: pick another id, or change it with edit_feature`))
    const features = [...tree.features]
    let at = after ? features.findIndex((x) => x.id === after) : features.length - 1
    if (after && at < 0) throw new InputError(noFeature(after))
    // `after` that would put it before what it uses (a sketch made just now): after the last of those instead.
    const uses = referencesOf(f).map((id) => features.findIndex((x) => x.id === id)).filter((i) => i >= 0)
    const latest = uses.length ? Math.max(...uses) : -1
    let note: string | undefined
    // Lettering stays last: a text has thousands of edges, and everything after it rebuilds on them.
    // Without `after`, a new feature goes in before the lettering at the end (unless it is lettering itself).
    const tail = letteringTail(tree)
    if (!after && tail < features.length && !isLettering(tree, f) && Math.max(latest, tail - 1) < at) {
      at = Math.max(latest, tail - 1)
      const texts = features.slice(tail).filter((x) => x.op !== "sketch")
      note = ta(
        `已放在文字特征（${texts.map((x) => `「${displayName(tree, x)}」`).join("、")}）前面：文字的边很多，放在最后重建最快。要放在文字后面就写 after。`,
        `Put before the text features (${texts.map((x) => `“${displayName(tree, x)}”`).join(", ")}): text has many edges, and it rebuilds fastest last. To put it after the text, write after.`,
      )
    }
    if (latest > at) {
      const used = displayName(tree, features[latest])
      note = ta(
        `after「${after}」会排在它用到的「${used}」前面，已改为放在「${used}」后面。after 只在要插到中间时才写。`,
        `after “${after}” would put it before “${used}”, which it uses, so it went after “${used}” instead. Write after only to insert in the middle.`,
      )
      at = latest
    }
    features.splice(at + 1, 0, f)
    return { tree: { ...tree, features }, target: f.id, note }
  }
  if (name === "edit_feature") {
    const { id, changes } = input as { id: string; changes: Record<string, unknown> }
    const i = tree.features.findIndex((x) => x.id === id)
    if (i < 0) throw new InputError(noFeature(id))
    const { op: _op, id: _id, ...rest } = changes ?? {}
    void _op
    void _id
    // null removes a field: { "thin": null } turns a thin wall back into a plain extrusion.
    const merged: Record<string, unknown> = { ...tree.features[i], ...rest }
    for (const [k, v] of Object.entries(rest)) if (v === null) delete merged[k]
    const parsed = Feature.safeParse(merged)
    if (!parsed.success) throw new InputError(ta(`修改后的特征不合法：${issuesText(parsed.error.issues, "；")}`, `The changed feature isn't valid: ${issuesText(parsed.error.issues, "; ")}`))
    const features = [...tree.features]
    features[i] = parsed.data
    return { tree: { ...tree, features }, target: id }
  }
  if (name === "delete_feature") {
    const { id, cascade } = input as { id: string; cascade?: boolean }
    if (!tree.features.some((x) => x.id === id)) throw new InputError(noFeature(id))
    const doomed = new Set([id])
    let grew = true
    while (grew) {
      grew = false
      for (const f of tree.features) {
        if (!doomed.has(f.id) && referencesOf(f).some((r) => doomed.has(r))) {
          doomed.add(f.id)
          grew = true
        }
      }
    }
    doomed.delete(id)
    if (doomed.size && !cascade)
      throw new InputError(
        ta(
          `后面的特征引用了「${id}」：${[...doomed].join("、")}。要一起删，设 cascade=true；或者先改它们的引用`,
          `Later features refer to “${id}”: ${[...doomed].join(", ")}. To delete them too, set cascade=true; or change their references first`,
        ),
      )
    doomed.add(id)
    return { tree: { ...tree, features: tree.features.filter((f) => !doomed.has(f.id)) } }
  }
  throw new InputError(ta(`未知工具「${name}」`, `Unknown tool “${name}”`))
}

/** English: 「1 part」, 「2 parts」. */
const count = (n: number, what: string) => `${n} ${what}${n === 1 ? "" : "s"}`

const noFeature = (id: string) => ta(`找不到特征「${id}」`, `There is no feature “${id}”`)

/** A parse's problems, field by field. */
const issuesText = (issues: { path: PropertyKey[]; message: string }[], sep: string) => issues.map((x) => `${x.path.join(".")} ${x.message}`).join(sep)

export async function executeTool(port: KernelPort, tree: Tree, name: string, input: Record<string, unknown>, look?: LookFn): Promise<ToolRun> {
  try {
    if (name === "inspect") {
      const what = input.what as "tree" | "body" | "faces" | "edges"
      if (what === "tree") {
        const report = await port.rebuild(tree)
        return { tree, output: { ok: true, text: treeText(tree, report) }, report }
      }
      const text = await port.inspect(what, what === "faces" ? input.faces : what === "edges" ? input.edges : undefined)
      return { tree, output: { ok: true, text } }
    }
    if (name === "check") {
      const items = Check.array().parse(input.items ?? [])
      const drop = new Set([...((input.remove as string[] | undefined) ?? []), ...items.map((c) => c.id)])
      const checks = [...(tree.checks ?? []).filter((c) => !drop.has(c.id)), ...items]
      const next: Tree = { ...tree, checks: checks.length ? checks : undefined }
      const report = await port.rebuild(next)
      return { tree: next, output: { ok: true, text: checkText(report) }, report }
    }
    if (name === "set_appearance") {
      const parts = (input.parts as string[] | undefined)?.filter(Boolean)
      const change = { color: input.color as string | null | undefined, finish: input.finish as Finish | null | undefined }
      if (change.color === undefined && change.finish === undefined) return { tree, output: { ok: false, text: ta("✗ 写 color 或 finish（写 null 是清除）。", "✗ Write color or finish (null clears it).") } }
      const next = setPartLook(tree, parts?.length ? parts : undefined, change)
      // One build (it re-runs the checks): the names are checked on its report. A wrong name puts the
      // kernel back on the tree that stays, which only then costs a second build.
      const report = await port.rebuild(next)
      const names = report.parts?.map((p) => p.name) ?? []
      const unknown = (parts ?? []).filter((p) => !names.includes(p))
      if (unknown.length) {
        await port.rebuild(tree)
        return {
          tree,
          output: {
            ok: false,
            text: names.length
              ? ta(`✗ 没有叫「${unknown.join("、")}」的零件：现在有 ${names.join("、")}`, `✗ There is no part called “${unknown.join(", ")}”: the parts now are ${names.join(", ")}`)
              : ta("✗ 这个零件没有拆开：不写 parts，就是整个零件。", "✗ This part isn't split: leave out parts, and it is the whole part."),
          },
        }
      }
      const one = (name?: string) => lookText(ownLook(next.appearance, name), ta("未设置（白模）", "not set (clay)"))
      const now = names.length ? names.map((n) => `${n} ${one(n)}`).join(ta("、", ", ")) : one()
      const what = changeText(change)
      const whole = isSet(next.appearance) && names.length
      return {
        tree: next,
        output: {
          ok: true,
          text: ta(
            `已设置${what ? `（${what}）` : ""}，不改几何。外观：${now}${whole ? "（整体的颜色用在没有自己颜色的零件上）" : ""}`,
            `Set${what ? ` (${what})` : ""}; the geometry is unchanged. Appearance: ${now}${whole ? " (the whole part's color applies to parts without their own)" : ""}`,
          ),
        },
        report,
      }
    }
    if (name === "look") {
      if (!look) return { tree, output: { ok: false, text: ta("这个环境不能渲染视图。", "This environment can't render views.") } }
      const views = (input.views as string[] | undefined)?.length ? (input.views as string[]) : ["iso", "front", "top", "right"]
      const images = await look(views, input.highlight as string | undefined)
      return { tree, output: { ok: true, text: ta(`视图：${views.join("、")}（蓝色 = 高亮的特征，灰色 = 其余）`, `Views: ${views.join(", ")} (blue = the highlighted feature, gray = the rest)`), images } }
    }
    const { tree: next, target, note } = applyEdit(tree, name, input)
    const report = await port.rebuild(next)
    return { tree: next, output: { ok: resultOk(report, target), text: [note && `⚠ ${note}`, resultText(name, report, target)].filter(Boolean).join("\n") }, report, focus: target }
  } catch (e) {
    if (e instanceof InputError || (e as Error)?.name === "ExprError") return { tree, output: { ok: false, text: `✗ ${(e as Error).message}` } }
    return { tree, output: { ok: false, text: ta(`✗ 出错了：${(e as Error)?.message ?? e}`, `✗ Something went wrong: ${(e as Error)?.message ?? e}`) } }
  }
}

/** One line per requirement: 「✓ size「80×50×30」：实际 80 × 50 × 30」 (English: ✓ size “80×50×30”: …). */
export function checkText(report: BuildReport) {
  if (report.checksPending) return ta("装配已生成，精确检查正在后台进行。", "The assembly is built; the exact checks are running in the background.")
  if (report.checksError) return ta(`精确检查失败：${report.checksError}`, `The exact checks failed: ${report.checksError}`)
  const rows = report.checks ?? []
  if (!rows.length) return ta("没有核对项。", "No check items.")
  const failed = rows.filter((r) => !r.pass && !r.invalid).length
  const invalid = rows.filter((r) => r.invalid && !r.tooComplex).length
  const tooComplex = rows.filter((r) => r.tooComplex).length
  const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`
  return [
    ...rows.map((r) =>
      r.invalid
        ? ta(`? ${r.id}「${r.said}」：量不了，${r.actual}`, `? ${r.id} “${r.said}”: can't measure, ${r.actual}`)
        : ta(`${r.pass ? "✓" : "✗"} ${r.id}「${r.said}」：要求 ${r.expected}，实际 ${r.actual}`, `${r.pass ? "✓" : "✗"} ${r.id} “${r.said}”: required ${r.expected}, actual ${r.actual}`),
    ),
    ...(failed
      ? [
          ta(
            `${failed} 项不满足：先确认量的位置对不对（size 是整个零件的外形；局部尺寸用 distance / thickness，选择器要正好选中那个面）。量错了就用同一个 id 改写这一项；确实没做到再用 edit_feature 修模型，然后再核对。不要为了通过去改期望值。`,
            `${items(failed)} not met: first make sure the measurement is in the right place (size is the whole part's overall size; for local dimensions use distance / thickness, with the selector selecting exactly that face). If it measured the wrong place, rewrite the item with the same id; if the model really falls short, fix it with edit_feature, then check again. Don't change the expected value to make it pass.`,
          ),
        ]
      : []),
    ...(invalid
      ? [
          ta(
            `${invalid} 项量不了：是这一项的选择器写得不对（要正好选中要量的面或边，例如加上 normal、of），用同一个 id 改写这一项，不是改模型。`,
            `${items(invalid)} can't be measured: the item's selector is wrong (it must select exactly the face or edge to measure, e.g. add normal, of). Rewrite the item with the same id; don't change the model.`,
          ),
        ]
      : []),
    ...(tooComplex
      ? [
          ta(
            `${tooComplex} 项太复杂没有算：不是没满足，也不是写错了，是要精确计算的实体太多。可以把 ref 缩小到具体的零件，或者把外购件换成精简的模型（例如只留包络盒）再核对。`,
            `${items(tooComplex)} too complex, not computed: not unmet and not written wrong; there are too many solids to compute exactly. Narrow ref to a specific part, or replace the purchased part with a simplified model (e.g. only its bounding box), then check again.`,
          ),
        ]
      : []),
    ...(!failed && !invalid && !tooComplex ? [ta("全部满足。", "All met.")] : []),
  ].join("\n")
}

function resultOk(report: BuildReport, target?: string) {
  if (report.paramError) return false
  if (!target) return report.features.every((f) => f.state === "ok" || f.state === "suppressed")
  return report.features.find((f) => f.id === target)?.state === "ok"
}

export function bodyLine(report: BuildReport) {
  const b = report.body
  if (!b) return ta("还没有实体。", "No solid yet.")
  if (report.parts)
    return ta(
      `实体：${b.size.join(" × ")} mm，${report.parts.length} 个零件：${report.parts.map((p) => `${p.name}（${p.size.join(" × ")} mm，${r1(p.volume / 1000)} cm³）`).join("、")}。`,
      `Solid: ${b.size.join(" × ")} mm, ${count(report.parts.length, "part")}: ${report.parts.map((p) => `${p.name} (${p.size.join(" × ")} mm, ${r1(p.volume / 1000)} cm³)`).join(", ")}.`,
    )
  const solids = b.solids > 1 ? ta(`，${b.solids} 个不相连的实体`, `, ${b.solids} separate solids`) : ""
  return ta(`实体：${b.size.join(" × ")} mm，体积 ${r1(b.volume / 1000)} cm³${solids}。`, `Solid: ${b.size.join(" × ")} mm, volume ${r1(b.volume / 1000)} cm³${solids}.`)
}

function resultText(name: string, report: BuildReport, target?: string) {
  const lines: string[] = []
  if (report.paramError) lines.push(ta(`✗ 参数有错：${report.paramError}`, `✗ Parameter error: ${report.paramError}`))
  if (name === "set_params") {
    const values = Object.entries(report.params).map(([k, v]) => `${k}=${r1(v)}`)
    lines.push(ta(`参数：${values.join("，")}`, `Parameters: ${values.join(", ")}`))
  }
  if (name === "delete_feature") lines.push(ta("已删除。", "Deleted."))
  const r = target ? report.features.find((f) => f.id === target) : undefined
  if (r) {
    if (r.state === "ok") {
      const faces = r.faces ? ta(`新生成 ${r.faces.new} 个面，修改 ${r.faces.modified} 个。`, `${count(r.faces.new, "new face")}, ${r.faces.modified} modified.`) : ""
      lines.push(ta(`✓ ${r.name}（${r.id}）：${r.summary ?? ""}。${faces}`, `✓ ${r.name} (${r.id}): ${r.summary ?? ""}.${faces ? ` ${faces}` : ""}`))
    } else if (r.state === "error") {
      lines.push(ta(`✗ ${r.name}（${r.id}）失败：${r.message}`, `✗ ${r.name} (${r.id}) failed: ${r.message}`))
      if (r.hint) lines.push(ta(`建议：${r.hint}`, `Suggestion: ${r.hint}`))
      lines.push(
        ta(
          "这个特征留在特征树里并标为失败：用 edit_feature 修好它，或 delete_feature 删掉。",
          "The feature stays in the feature tree, marked as failed: fix it with edit_feature, or delete it with delete_feature.",
        ),
      )
    } else lines.push(ta(`… ${r.name}（${r.id}）没有重建：前面有特征失败。`, `… ${r.name} (${r.id}) wasn't rebuilt: an earlier feature failed.`))
    for (const w of r.warnings ?? []) lines.push(`⚠ ${w}`)
  }
  const failed = report.features.filter((f) => f.state === "error" && f.id !== target)
  if (failed.length)
    lines.push(
      ta(
        `特征树里还有失败的特征：${failed.map((f) => `${f.name}（${f.id}）：${f.message}`).join("；")}`,
        `The feature tree still has failed features: ${failed.map((f) => `${f.name} (${f.id}): ${f.message}`).join("; ")}`,
      ),
    )
  const skipped = report.features.filter((f) => f.state === "skipped").length
  if (skipped) lines.push(ta(`因此后面 ${skipped} 个特征没有重建。`, `So ${count(skipped, "later feature")} ${skipped === 1 ? "wasn't" : "weren't"} rebuilt.`))
  lines.push(bodyLine(report))
  return lines.join("\n")
}

export function treeText(tree: Tree, report: BuildReport) {
  const params = Object.entries(tree.params)
    .map(([k, v]) => `${k} = ${v}${typeof v === "string" ? ta(`（= ${r1(report.params[k] ?? NaN)}）`, ` (= ${r1(report.params[k] ?? NaN)})`) : ""}`)
    .join(ta("，", ", "))
  const rows = tree.features.map((f, i) => {
    const r = report.features[i]
    const mark = r?.state === "ok" ? "✓" : r?.state === "error" ? "✗" : r?.state === "suppressed" ? "⊘" : "…"
    const why = f.intent ? ` — ${f.intent}` : ""
    const msg = r?.state === "error" ? ta(` 失败：${r.message}`, ` failed: ${r.message}`) : ""
    const warn = r?.warnings?.length ? ta(`（⚠ ${r.warnings.join("；")}）`, ` (⚠ ${r.warnings.join("; ")})`) : ""
    return ta(
      `${i + 1}. ${mark} ${f.id}（${displayName(tree, f)}，${OP_NAMES[f.op as FeatureOp]}）${r?.summary ? `：${r.summary}` : ""}${warn}${msg}${why}`,
      `${i + 1}. ${mark} ${f.id} (${displayName(tree, f)}, ${opAgentName(f.op as FeatureOp)})${r?.summary ? `: ${r.summary}` : ""}${warn}${msg}${why}`,
    )
  })
  return [
    ta(`参数：${params || "无"}`, `Parameters: ${params || "none"}`),
    ...(rows.length ? rows : [ta("（特征树是空的）", "(The feature tree is empty)")]),
    bodyLine(report),
    ...(report.checksPending ? [ta("精确检查正在后台进行，可以继续查看和编辑。", "The exact checks are running in the background; you can keep inspecting and editing.")] : []),
  ].join("\n")
}
