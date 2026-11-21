// Tests for Web-Desktop Parity:
// 1. workbenchTools exposes the full Desktop modeling & check toolset while STUDIO_TOOLS stays tutor-scoped.
// 2. Browser virtual project store resolves multi-file assemblies, shared parameters, STEP imports, and ZIP bundles.
import { describe, expect, it } from "vitest"
import { DESKTOP_OPS, STUDIO_TOOLS, workbenchTools } from "@/studio/tools"
import {
  binaryFile,
  createAssemblyProject,
  createDefaultProject,
  exportProjectZip,
  importIntoProject,
  resolveProjectFile,
} from "@/studio/project-store"

const VALID_STEP = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"

describe("Web-Desktop Parity: AI Workbench Tools", () => {
  it("exposes full Desktop modeling & assembly tools in workbenchTools while keeping STUDIO_TOOLS restricted", () => {
    const zhTools = workbenchTools("zh")
    const enTools = workbenchTools("en")
    for (const op of DESKTOP_OPS) {
      expect(op in zhTools, `workbenchTools(zh) should include ${op}`).toBe(true)
      expect(op in enTools, `workbenchTools(en) should include ${op}`).toBe(true)
      expect(op in STUDIO_TOOLS, `STUDIO_TOOLS must keep ${op} out of tutor subset`).toBe(false)
    }
    expect("check" in zhTools).toBe(true)
    expect("look" in zhTools).toBe(true)
  })
})

describe("Web-Desktop Parity: Browser Multi-File Project Store", () => {
  it("resolves multi-part assemblies, shared parameter inheritance, and sub-components identically to Desktop", async () => {
    const project = createAssemblyProject("Bracket Kit")
    const resolved = await resolveProjectFile(project, project.activeFile)
    // Shared params (L, W, H) from `bracket-kit.params.json` are merged into effective tree
    expect(resolved.effective.params.L).toBe(60)
    expect(resolved.effective.params.W).toBe(40)
    expect(resolved.effective.params.H).toBe(12)
    // Sub-component `parts/base.turnery.json` is gathered for the OpenCascade worker
    expect(resolved.gathered.components.map((c) => c.file)).toContain("parts/base.turnery.json")
  })

  it("round-trips a full multi-file project (assembly + shared params + STEP asset) via ZIP export/import", async () => {
    const src = createAssemblyProject("Motor Unit")
    src.files["assets/motor.step"] = binaryFile(new TextEncoder().encode(VALID_STEP))

    const zipBlob = exportProjectZip(src, { license: "CERN-OHL-P-2.0", category: "robotics", version: "1.0.0" })
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer())
    const zipFile = new File([zipBytes], "motor-unit.zip", { type: "application/zip" })

    const dst = createDefaultProject()
    const imported = await importIntoProject(dst, zipFile)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(dst.files["assets/motor.step"]).toBeDefined()
    expect(dst.files["parts/base.turnery.json"]).toBeDefined()
    expect(dst.files["motor-unit.params.json"]).toBeDefined()
    expect(imported.activeFile).toBe("motor-unit.turnery-asm.json")
  })

  it("accepts valid ISO-10303-21 STEP imports and rejects corrupted STEP files", async () => {
    const proj = createDefaultProject()
    const good = await importIntoProject(proj, new File([VALID_STEP], "gear.step"))
    expect(good.ok).toBe(true)
    expect(proj.files["assets/gear.step"]).toBeDefined()

    const bad = await importIntoProject(proj, new File(["not a step"], "broken.step"))
    expect(bad.ok).toBe(false)
  })
})
