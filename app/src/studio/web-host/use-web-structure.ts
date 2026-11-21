// What the open file is made of, for the left panel's 「结构」 and the view: an assembly's parts
// (select, hide, isolate, colour, rename, open, edit in the assembly, add). The desktop window's
// own glue (desktop/app.tsx) without its notes; the components are the same.
import * as React from "react"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { renamedPart } from "@/desktop/core/rename"
import type { DocState } from "@/desktop/core/protocol"
import { openTarget } from "@/desktop/open-target"
import type { Instance, Structure } from "@/desktop/ui/parts-sidebar"
import { setPartLook, type LookChange } from "../appearance"
import { selectGroup, wholeOf } from "../part-selection"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "../scene"
import type { Studio } from "../use-studio"
import type { WebHost } from "./web-host"

const NONE: string[] = []

/** The component a part belongs to: 「螺钉#2/垫圈」→「螺钉」 (the longest name among the parts that fits). */
function componentOf(part: string, all: string[]) {
  const bases = [...new Set(all.map((n) => n.replace(/[#/].*$/, "")))].filter((b) => part === b || part.startsWith(`${b}#`) || part.startsWith(`${b}/`))
  return bases.sort((a, b) => b.length - a.length)[0] ?? part.replace(/[#/].*$/, "")
}

export function useWebStructure(host: WebHost, doc: DocState | null, studio: Studio, add?: React.ReactNode) {
  const path = doc?.path
  const display = studio.display
  const tree = studio.tree
  const assembly = doc?.kind === "assembly" && !doc.context
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  const [pointed, setPointed] = React.useState<{ path?: string; id: string | null; part?: string; piece?: boolean } | null>(null)
  const [selected, setSelected] = React.useState<{ path?: string; id: string | null; parts: string[] } | null>(null)

  // Each file keeps what was hidden, isolated, pulled apart and selected while another one is open.
  const [kept, setKept] = React.useState<Record<string, { view: PartsView; selected: { id: string | null; parts: string[] } | null }>>({})
  const [partsPath, setPartsPath] = React.useState(path)
  if (partsPath !== path) {
    if (partsPath) setKept((k) => ({ ...k, [partsPath]: { view: partsView, selected: selected?.path === partsPath ? { id: selected.id, parts: selected.parts } : null } }))
    setPartsPath(path)
    const back = path ? kept[path] : undefined
    setPartsView(back?.view ?? NO_PARTS_VIEW)
    if (back?.selected && path) setSelected({ path, ...back.selected })
  }

  const selectedNames = selected && selected.path === path ? selected.parts : NONE
  const selectedParts = React.useMemo(() => {
    const at = new Map(display?.parts?.map((p, i) => [p.name, i]))
    return selectedNames.flatMap((name) => (at.has(name) ? [at.get(name)!] : []))
  }, [selectedNames, display])
  const selectedFeature = selected && selected.path === path ? (selectedParts.length ? (display?.groups.find((g) => g.part === selectedParts.at(-1))?.origin ?? null) : selected.parts.length ? null : selected.id) : null
  const pointedPart = pointed?.part && pointed.path === path ? display?.parts?.findIndex((p) => p.name === pointed.part) : undefined
  const pointedFeature = pointed?.path === path ? pointed?.id : null

  const pointFeature = React.useCallback(
    (id: string | null, part?: number, piece = false) => {
      const name = part === undefined ? undefined : display?.parts?.[part]?.name
      setPointed((p) => (p?.id === id && p.path === path && p.part === name && Boolean(p.piece) === piece ? p : { path, id, part: name, piece }))
    },
    [path, display],
  )
  // A click in the view takes the whole part: every piece it was split into. `piece`: just that one.
  const selectFeature = React.useCallback(
    (id: string | null, part?: number, additive = false, piece = false) => {
      if (!id && additive) return
      const all = display?.parts ?? []
      const indices = part === undefined || !all[part] ? [] : piece ? [part] : wholeOf(all, part)
      const group = indices.map((i) => all[i].name)
      setSelected((p) => {
        const names = group.length ? selectGroup(p && p.path === path ? p.parts : [], group, additive) : []
        return { path, id: group.length ? (names.length ? id : null) : id, parts: names }
      })
      if (indices.length)
        setPartsView((v) => {
          if (!indices.some((i) => v.hidden.has(i))) return v
          const hidden = new Set(v.hidden)
          for (const i of indices) hidden.delete(i)
          return { ...v, hidden }
        })
    },
    [path, display],
  )

  // What lights up under the pointer is what a click would select.
  const pieces = display?.parts
  const faces = display?.groups
  const pointedPiece = pointed?.piece
  const hoverFaces = React.useMemo(() => {
    if (pointedPart === undefined || pointedPart < 0 || !pieces || !faces) return undefined
    const lit = new Set(pointedPiece ? [pointedPart] : wholeOf(pieces, pointedPart))
    return faces.filter((g) => g.part !== undefined && lit.has(g.part)).map((g) => g.hash)
  }, [pointedPart, pointedPiece, pieces, faces])
  const hover = React.useMemo<Hover | null>(() => (pointedFeature ? { ids: [pointedFeature], feature: pointedFeature, label: t("零件或步骤", "Part or step"), faces: hoverFaces } : null), [pointedFeature, hoverFaces])

  const assemblyParts = React.useMemo<Instance[]>(() => {
    const origin = new Map<number, string>()
    for (const g of display?.groups ?? []) if (g.part !== undefined && !origin.has(g.part)) origin.set(g.part, g.origin)
    const features = new Map(tree.features.map((f) => [f.id, f]))
    return (display?.parts ?? []).map((p, index) => {
      const id = p.component ?? origin.get(index) ?? ""
      const feature = features.get(id)
      const file = feature?.op === "component" ? (feature.file ?? "") : ""
      return { name: p.name, index, id, file, look: p.look, here: p.here, under: p.under, whole: p.whole, own: !!file && !/\.(step|stp)$/i.test(file) && !/-asm\.json$/i.test(file), layered: !!file && !/\.(step|stp)$/i.test(file) }
    })
  }, [display, tree])

  const openPart = React.useCallback(
    async (file: string, inPlace: boolean) => {
      if (!doc) return
      const target = openTarget(doc, file)
      if (target.reason) return notify(target.reason)
      const r = await host.call("open_part", inPlace && !target.nested ? { path: target.path, context: doc.path } : { path: target.path })
      if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
    },
    [doc, host],
  )

  const indexOf = (name: string) => display?.parts?.findIndex((p) => p.name === name) ?? -1
  const isolated = new Set(partsView.focus?.mode === "isolate" ? partsView.focus.parts.map(indexOf).filter((i) => i >= 0) : [])

  /** Only an assembly's parts are listed: a split part keeps its rows on the timeline, as before. */
  const structure: Structure | null =
    !doc || !assembly
      ? null
      : {
          kind: "assembly",
          items: assemblyParts,
          hidden: partsView.hidden,
          isolated,
          onToggleHidden: (p) => {
            const hidden = new Set(partsView.hidden)
            if (hidden.has(p.index)) hidden.delete(p.index)
            else hidden.add(p.index)
            setPartsView({ ...partsView, hidden })
          },
          onIsolate: (p) => {
            const alone = partsView.focus?.mode === "isolate" && partsView.focus.parts.length === 1 && partsView.focus.parts[0] === p.name
            setPartsView({ ...partsView, focus: alone ? undefined : { parts: [p.name], mode: "isolate" } })
          },
          canOpen: (p) => openTarget(doc, p.file).reason ?? true,
          onOpen: (p) => void openPart(p.file, false),
          onEditInPlace: (p) => void openPart(p.file, true),
          onRename: async (p, name) => {
            const before = componentOf(p.name, assemblyParts.map((x) => x.name))
            const r = await host.call("rename_part", { id: p.id, name }, doc.path)
            if (!r.ok) {
              notify.error(r.text.replace(/^✗ /, ""))
              return false
            }
            const to = (n: string) => renamedPart(n, before, name.trim())
            setPartsView((v) => ({
              ...v,
              ...(v.focus ? { focus: { ...v.focus, parts: v.focus.parts.map(to) } } : {}),
              ...(v.moved ? { moved: Object.fromEntries(Object.entries(v.moved).map(([n, m]) => [to(n), m])) } : {}),
            }))
            setSelected((s) => (s && s.path === doc.path ? { ...s, parts: s.parts.map(to) } : s))
            return true
          },
          add,
        }

  const onLook = async (parts: string[], change: LookChange, here: boolean) => {
    if (!assembly) {
      const err = await studio.editTree((tr) => setPartLook(tr, parts, change))
      if (err) notify.error(err)
      return
    }
    const r = await host.call("set_appearance", { parts, ...change, ...(here ? { where: "assembly" } : {}) }, path ?? undefined)
    if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
  }

  // One part of the assembly selected (all of it, or some of its pieces): it can be opened.
  const picked = assembly ? assemblyParts.filter((x) => selectedParts.includes(x.index)) : []
  const one = picked.length && picked.every((x) => x.id === picked[0].id) ? picked[0] : undefined
  const why = !assembly ? null : picked.length && !one ? t("一次打开一个零件", "Open one part at a time") : one && doc ? (openTarget(doc, one.file).reason ?? null) : null
  const openPartAt = (index: number, inPlace = false) => {
    const p = assemblyParts.find((x) => x.index === index)
    if (assembly && p) void openPart(p.file, inPlace)
  }

  return {
    assembly,
    structure,
    partsView,
    setPartsView,
    hover,
    selectedNames,
    selectedParts,
    selectedFeature,
    pointFeature,
    selectFeature,
    onLook,
    openPartAt: assembly ? openPartAt : undefined,
    selection: assembly ? { one, why, open: (inPlace: boolean) => one && void openPart(one.file, inPlace) } : null,
  }
}
