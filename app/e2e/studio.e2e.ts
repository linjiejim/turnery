import { PRACTICE } from "../src/content/practice"
import { expect, expectRendered, test } from "./fixtures"

/**
 * The AI studio against the scripted model (STUDIO_MOCK=1): the whole loop —
 * stream, tool calls executed in the browser kernel, feature tree, look — plus
 * a ready-made tree that needs no model at all.
 */
test.describe("工作台", () => {
  test.setTimeout(120_000)

  test("/studio 对话建模（脚本模型）", async ({ page }) => {
    await page.goto("/studio")
    const example = page.getByRole("button", { name: /80×50×30/ })
    await expect(example, "kernel loads and enables the examples").toBeEnabled({ timeout: 90_000 })
    await example.click()
    await expect(page.getByText(/^做好了/), "the scripted turn finishes").toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole("img", { name: "助教看到的视图" }).first(), "look renders views for the model").toBeVisible()
    await expectRendered(page.locator("canvas").first(), "/studio model")
    // The feature tree sits over the 3D view; pointing at a step shows a small card of what it is.
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible()
    await tree.locator("[data-step]").nth(2).hover()
    await expect(page.getByRole("tooltip"), "pointing at a step says which it is").toContainText(/第 \d 步/)
    await expect(page.getByRole("status"), "the turn's status line is gone once it's done").toHaveCount(0)
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "代码" }).click()
    await expect(page.getByRole("dialog", { name: "代码" }).getByText(/extrude\(sk_sk1, amount=H\)/).first()).toBeVisible()
    await page.keyboard.press("Escape")

    // The requirements, measured by the kernel: a card in the chat, a live list on the parameters tab.
    await page.getByRole("tab", { name: "对话" }).click()
    await expect(page.getByRole("button", { name: "核对要求 · 3/3" })).toBeVisible()
    await page.getByRole("tab", { name: "参数" }).click()
    const list = page.getByRole("region", { name: "要求核对" })
    await expect(list.getByText("3/3")).toBeVisible()
    // The learner's own edit moves a requirement: 「已偏离」, not a red failure.
    await page.getByLabel("t", { exact: true }).fill("3")
    await page.getByLabel("t", { exact: true }).press("Enter")
    await expect(list.getByText(/已偏离：要求 2 mm，现在 3 mm/)).toBeVisible()
  })

  test("/studio 在模型上标注（脚本模型）", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByText("5 个特征").first()).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio annotate")
    // Click around the disc until a face card opens.
    const box = (await page.locator("canvas").first().boundingBox())!
    const card = page.getByRole("dialog")
    for (const [fx, fy] of [[0.62, 0.42], [0.66, 0.5], [0.4, 0.42], [0.55, 0.35], [0.7, 0.45], [0.35, 0.5]]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
      if (await card.getByText(/^① 面 ·/).isVisible().catch(() => false)) break
    }
    await expect(card.getByText(/^① 面 ·/), "a click on the model opens the note card").toBeVisible()
    await card.getByLabel("标注备注").fill("在这里加一个 ⌀6 的通孔")
    await card.getByRole("button", { name: "加到消息" }).click()
    const pins = page.locator(".scene-labels .bg-primary")
    await expect(pins, "the annotation stays on the model as pin 1").toHaveCount(1)
    await page.getByRole("tab", { name: "对话" }).click()
    await expect(page.getByLabel("要随消息发出的标注").getByText("在这里加一个 ⌀6 的通孔")).toBeVisible()
    await page.getByRole("button", { name: "发送" }).click()
    await expect(page.getByText(/^做好了/), "the scripted turn finishes").toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole("img", { name: "标注截图" }), "the annotated view went with the message").toBeVisible()
    await expect(page.getByRole("button", { name: /① 在这里加一个 ⌀6 的通孔/ }), "the sent message keeps its chip").toBeVisible()
    await expect(pins, "pins clear once the reply is done").toHaveCount(0)
  })

  test("/studio 不用 AI：特征卡片、参数说明、测量、剖视", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio tools")

    // Click a feature: what it did and its dimensions in words; a dimension edits in place.
    await tree.getByRole("button", { name: /螺栓孔/ }).click()
    const card = page.getByRole("dialog", { name: "「螺栓孔」" })
    await expect(card.getByText("第 3 步")).toBeVisible()
    await expect(tree.getByRole("button", { name: "回到最新" }), "clicking a step shows the model at that step").toBeVisible()
    await card.getByRole("button", { name: /螺栓孔直径/ }).click()
    await card.getByRole("textbox", { name: "螺栓孔直径" }).fill("10")
    await card.getByRole("textbox", { name: "螺栓孔直径" }).press("Enter")
    await expect(card.getByRole("button", { name: /⌀10（bolt）/ }), "the edit rebuilt the hole").toBeVisible()
    // 「让助教改这一步」 starts a message about this step.
    await card.getByRole("button", { name: /让助教改这一步/ }).click()
    await expect(page.getByLabel("给建模助教的消息")).toHaveValue("改「螺栓孔」（h1）：")
    await expect(card, "the details make way for the message").toHaveCount(0)

    // Re-pick on the model: the view goes back to what a fillet-like step starts from.
    await page.goto("/studio?start=box-fillet-first")
    await expect(tree.getByText("4 个特征")).toBeVisible({ timeout: 90_000 })
    await tree.getByRole("button", { name: /外圆角/ }).click()
    const fillet = page.getByRole("dialog", { name: "「外圆角」" })
    await expect(fillet.getByText("除了最上面一圈以外的边")).toBeVisible()
    await fillet.getByRole("button", { name: "在模型上重选" }).click()
    await expect(page.getByRole("status").filter({ hasText: "之前的样子" })).toBeVisible()
    await expect(fillet.getByText("直线边，除了最上面一圈 · 8 条")).toBeVisible()
    await fillet.getByRole("button", { name: "取消" }).click()
    await expect(page.getByRole("status").filter({ hasText: "之前的样子" })).toHaveCount(0)
    await page.goto("/studio?start=flange")
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })

    // Parameters say what they are and where they're used.
    await page.getByRole("tab", { name: "参数" }).click()
    await expect(page.getByText("螺栓孔所在圆的直径（节圆）")).toBeVisible()
    await expect(page.getByText("用在：螺栓孔 · 位置")).toBeVisible()

    // Measure: a click on the model shows what it is.
    await page.getByRole("button", { name: "测量" }).click()
    const box = (await page.locator("canvas").first().boundingBox())!
    const panel = page.getByRole("region", { name: "测量结果" })
    for (const [fx, fy] of [[0.62, 0.42], [0.66, 0.5], [0.4, 0.42], [0.55, 0.35], [0.7, 0.45], [0.35, 0.5]]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
      // Picking is async, and a second click on the same face would deselect it: wait for the answer.
      if (await panel.getByText(/^① /).waitFor({ timeout: 3000 }).then(() => true, () => false)) break
    }
    await expect(panel.getByText(/^① /), "the measure panel describes the click").toBeVisible()
    await page.keyboard.press("Escape")
    await expect(panel).toHaveCount(0)

    // Section: a plane through the middle, with its own controls.
    await page.getByRole("button", { name: "剖视" }).click()
    await expect(page.getByRole("group", { name: "剖视" }).getByLabel(/剖切位置/)).toBeVisible()
    await expectRendered(page.locator("canvas").first(), "/studio section")
  })

  test("/studio 尺寸标在模型上：指向参数连线，单击就改", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await page.getByRole("tab", { name: "参数" }).click()

    // Pointing at pcd: the pitch circle on the model, joined to the row by a line.
    await page.getByText("螺栓孔所在圆的直径（节圆）").hover()
    const label = page.getByRole("button", { name: /螺栓孔所在圆的直径（节圆）：⌀90（pcd）/ })
    await expect(label).toBeVisible()
    await expect(page.locator("svg path.stroke-primary"), "a connector from the row to the label").toHaveCount(1)

    // Click it, type a new value: the parameter changes; undo brings it back.
    await label.click()
    const editor = page.getByRole("dialog", { name: /修改 螺栓孔所在圆的直径/ })
    await editor.getByRole("textbox").fill("100")
    await editor.getByRole("button", { name: "应用" }).click()
    await expect(editor).toHaveCount(0)
    await expect(page.getByLabel("pcd", { exact: true })).toHaveValue("100")
    await page.getByRole("button", { name: "撤销" }).click()
    await expect(page.getByLabel("pcd", { exact: true })).toHaveValue("90")

    // 「显示尺寸」: the main dimensions without pointing at anything.
    await page.mouse.move(5, 5)
    await page.getByRole("button", { name: "显示尺寸" }).click()
    await expect(page.locator("[data-dim-id]").first()).toBeVisible()
    expect(await page.locator("[data-dim-id]").count()).toBeLessThanOrEqual(12)
  })

  test("/studio 显示样式：白模 / 彩色 / 线描 / 半透明一排，颜色不再单独一个按钮", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    const tools = page.getByRole("toolbar", { name: "视图工具" })
    await expect(tools.getByRole("button", { name: "颜色" }), "colours live in the display card now").toHaveCount(0)

    const button = tools.getByRole("button", { name: "显示样式" })
    await button.click()
    const card = page.getByRole("dialog", { name: "显示样式" })
    const looks = card.getByRole("radiogroup", { name: "样式" })
    await expect(looks.getByRole("radio")).toHaveText(["白模", "彩色", "线描", "半透明"])
    await expect(card.getByRole("radiogroup", { name: "投影" }).getByRole("radio")).toHaveText(["透视", "正交"])

    // The flange has no colours: 彩色 looks like 白模, and the card says why and where colours are set.
    await looks.getByRole("radio", { name: "彩色" }).click()
    await expect(card.getByRole("note")).toHaveText("零件还没设颜色，所以看起来是白模：用零件名旁边或时间线左端的圆点设颜色。")
    await looks.getByRole("radio", { name: "白模" }).click()
    await expect(card.getByRole("note")).toHaveCount(0)
    await expect(button, "a white model with nothing to colour is the usual view").toHaveAttribute("aria-pressed", "false")

    // W steps through the four, round to 白模; a line drawing or see-through lights the button.
    // (Keys typed inside the card belong to it: wait until it has closed.)
    await page.keyboard.press("Escape")
    await expect(card).toHaveCount(0)
    for (const [next, lit] of [["彩色", "false"], ["线描", "true"], ["半透明", "true"], ["白模", "false"]] as const) {
      await page.keyboard.press("w")
      await expect(button).toHaveAttribute("aria-pressed", lit)
      await button.click()
      await expect(looks.getByRole("radio", { name: next })).toHaveAttribute("aria-checked", "true")
      await page.keyboard.press("Escape")
      await expect(card).toHaveCount(0)
    }
  })

  test("/studio 拆件：零件行、隐藏、爆炸、分件导出", async ({ page }) => {
    const tree = {
      params: { L: 80, W: 50, H: 30, t: 2, Hs: 20 },
      features: [
        { id: "sk", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
        { id: "box", op: "extrude", sketch: "sk", distance: "H" },
        { id: "sk2", op: "sketch", on: { plane: "XY", offset: "t" }, shapes: [{ type: "rect", w: "L-2*t", h: "W-2*t" }] },
        { id: "cav", op: "extrude", sketch: "sk2", distance: "H-2*t", mode: "cut" },
        { id: "sp", op: "split", by: { plane: "XY", offset: "Hs" }, parts: ["底壳", "上盖"] },
        { id: "btn", op: "hole", part: "上盖", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[0, 0]], d: 10 },
      ],
    }
    await page.addInitScript((t) => localStorage.setItem("ft-studio-v1", JSON.stringify({ tree: t, history: [] })), tree)
    await page.goto("/studio")
    const parts = page.getByRole("list", { name: "零件" })
    await expect(parts.getByText("上盖")).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio parts")
    // Hide the lid, show it again.
    await parts.getByRole("button", { name: "隐藏「上盖」" }).click()
    await expect(parts.getByRole("button", { name: "显示「上盖」" })).toBeVisible()
    await parts.getByRole("button", { name: "显示「上盖」" }).click()
    // Explode: the slider appears and moves the parts apart.
    await page.getByRole("button", { name: "爆炸" }).click()
    const slider = page.getByRole("group", { name: "爆炸" }).getByLabel("零件分开的程度")
    await slider.fill("1")
    await expect(page.getByRole("group", { name: "爆炸" }).getByText("100%")).toBeVisible()
    await expectRendered(page.locator("canvas").first(), "/studio exploded")
    // Export offers one STEP with both parts, and a zip of STLs.
    await page.getByRole("button", { name: "导出", exact: true }).click()
    await expect(page.getByRole("menuitem", { name: "导出 STEP（2 个零件）" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "导出 STL（zip，每个零件一个文件）" })).toBeVisible()
  })

  test("/studio 分享链接：另一个浏览器打开、试参数、复制到工作台、撤销", async ({ page, browser }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByText("5 个特征").first()).toBeVisible({ timeout: 90_000 })
    await page.getByRole("button", { name: "分享", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "分享模型" })
    await dialog.getByLabel("标题").fill("法兰盘")
    await dialog.getByLabel("说明").fill("第三课作业")
    await dialog.getByRole("button", { name: "生成链接" }).click()
    const link = dialog.getByLabel("分享链接")
    await expect(link).toHaveValue(/\/studio\/s\/[0-9A-Za-z]{10}$/)
    const url = await link.inputValue()

    // Someone else: a fresh context shares nothing with the sharer's browser.
    const other = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 900 } })
    const viewer = await other.newPage()
    const problems: string[] = []
    viewer.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
    viewer.on("console", (m) => m.type() === "error" && problems.push(`console.error: ${m.text()}`))
    await viewer.goto(url)
    await expect(viewer.getByRole("heading", { name: "法兰盘" })).toBeVisible()
    await expect(viewer.getByText("第三课作业")).toBeVisible()
    await expect(viewer.locator('meta[name="robots"]'), "kept out of search results").toHaveAttribute("content", "noindex")
    const tree = viewer.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await expectRendered(viewer.locator("canvas").first(), "/studio/s shared model")

    // Parameters keep their notes; trying one rebuilds the model, a reload puts it back.
    await viewer.getByRole("tab", { name: "参数" }).click()
    await expect(viewer.getByText("螺栓孔所在圆的直径（节圆）")).toBeVisible()
    await viewer.getByLabel("n", { exact: true }).fill("4")
    await viewer.getByLabel("n", { exact: true }).press("Enter")
    // A step's details open on a click (look only here).
    await tree.getByRole("button", { name: /孔阵列/ }).click()
    await expect(viewer.getByRole("dialog", { name: /孔阵列/ }).getByText(/^×4/), "the tried parameter rebuilt the pattern").toBeVisible()
    await viewer.reload()
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await tree.getByRole("button", { name: /孔阵列/ }).click()
    await expect(viewer.getByRole("dialog", { name: /孔阵列/ }).getByText(/^×6/), "nothing was saved").toBeVisible()
    await viewer.keyboard.press("Escape")

    // Copy: into this browser's (empty) part, undoably.
    await viewer.getByRole("button", { name: "复制到我的工作台" }).first().click()
    await expect(viewer).toHaveURL(/\/studio$/)
    await expect(viewer.getByText("已打开「法兰盘」")).toBeVisible({ timeout: 90_000 })
    await expect(tree.getByText("5 个特征")).toBeVisible()
    await viewer.getByRole("button", { name: "撤销上一步" }).click()
    await expect(tree, "undo brings back the empty model").toHaveCount(0)
    expect(problems, "viewer page errors / console.error").toEqual([])
    await other.close()

    // The sharer can take the link back.
    await dialog.getByRole("button", { name: "删除这个链接" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "删除链接" }).click()
    await expect(page.getByText("已删除链接")).toBeVisible()
    const id = url.split("/").pop()
    expect((await page.request.get(`/api/studio/share/${id}`)).status()).toBe(404)
  })

  test("/studio 导入特征树 JSON：成为项目里的新零件，可撤销；坏的在原处说明", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    const pad = {
      params: { L: 30 },
      features: [
        { id: "sk", op: "sketch", name: "草图1", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: 20 }] },
        { id: "e1", op: "extrude", name: "拉伸1", sketch: "sk", distance: 5 },
      ],
    }

    // From the menu: a new part of the project, opened; the flange stays.
    const chooser = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "导入文件…" }).click()
    await (await chooser).setFiles({ name: "垫块.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(pad)) })
    await expect(page.getByText("已导入「垫块」")).toBeVisible()
    await expect(tree.getByText("2 个特征")).toBeVisible()
    const fileList = page.getByRole("navigation", { name: "文件" })
    await expect(fileList.getByRole("button", { name: /^垫块/ })).toBeVisible()
    await expect(fileList.getByRole("button", { name: /^零件/ })).toBeVisible()

    // The toast's undo takes the imported part away and goes back to the flange.
    await page.locator("[data-sonner-toast]").filter({ hasText: "已导入「垫块」" }).getByRole("button", { name: "撤销" }).click()
    await expect(tree.getByText("5 个特征"), "undo brings the flange back").toBeVisible()
    await expect(fileList.getByRole("button", { name: /^垫块/ })).toHaveCount(0)

    // Dropped on the view: a broken file is explained where it was dropped, and changes nothing.
    const { sketch: _sketch, ...noSketch } = pad.features[1]
    const bad = JSON.stringify({ ...pad, features: [pad.features[0], noSketch] })
    const files = await page.evaluateHandle((text) => {
      const dt = new DataTransfer()
      dt.items.add(new File([text], "坏的.json", { type: "application/json" }))
      return dt
    }, bad)
    await page.locator("main").dispatchEvent("dragover", { dataTransfer: files })
    await page.locator("main").dispatchEvent("drop", { dataTransfer: files })
    const alert = page.getByRole("alert").filter({ hasText: "没能导入「坏的.json」" })
    await expect(alert).toContainText("第 2 个特征（拉伸1）缺少 sketch 字段")
    await expect(tree.getByText("5 个特征"), "the model is unchanged").toBeVisible()
  })

  test("/studio 工程图：三视图、尺寸、标题栏，导出 SVG", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "工程图" }).click()
    const sheet = page.getByRole("img", { name: /工程图/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText("⌀90")).toBeVisible()
    await expect(sheet.getByText("第一角投影").first()).toBeVisible()
    await expect(page.getByText(/A4 横版 · 比例 1:2/)).toBeVisible()
    // Parameter names on: the pitch circle says which parameter it is.
    await page.getByRole("switch", { name: "显示参数名" }).click()
    await expect(sheet.getByText("⌀90（pcd）")).toBeVisible()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "导出 SVG" }).click()
    expect((await download).suggestedFilename()).toMatch(/工程图\.svg$/)
    // Back to 3D.
    await page.getByRole("button", { name: "回到 3D" }).click()
    await expect(sheet).toHaveCount(0)
  })

  test("/studio?start=flange 现成特征树与改参数", async ({ page }) => {
    await page.goto("/studio?start=flange")
    await expect(page.getByText("5 个特征").first()).toBeVisible({ timeout: 90_000 })
    await expectRendered(page.locator("canvas").first(), "/studio flange")
    await page.getByRole("tab", { name: "参数" }).first().click()
    // A centre hole wider than the disc: the sketch has nothing left, the tree shows the failure…
    const d0 = page.getByLabel("d0", { exact: true })
    await d0.fill("130")
    await d0.press("Enter")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByRole("button", { name: /（失败）$/ }).first(), "the failing step is marked, and read as failed").toBeVisible()
    // …and putting it back rebuilds cleanly.
    await page.getByRole("tab", { name: "参数" }).first().click()
    await page.getByLabel("d0", { exact: true }).fill("40")
    await page.getByLabel("d0", { exact: true }).press("Enter")
    await expect(tree.getByRole("button", { name: /（失败）$/ })).toHaveCount(0)
  })

  test("/studio 特征时间线：从不变大，名字只在指向的那一步下面，停一下才弹出卡片", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    const bar = tree.locator("[data-timeline-bar]")
    const steps = tree.locator("[data-step]")
    const name = tree.locator("[data-step-name]")
    const rest = await bar.boundingBox()
    await expect(name, "at rest no step is named").toHaveCount(0)

    // Pointing at a step names it, under it; the card waits for the pointer to rest.
    const second = (await steps.nth(1).getAttribute("aria-label"))!
    await steps.nth(1).hover()
    await expect(name).toHaveText(second)
    await expect(steps.nth(1), "the card opens after a pause").toHaveAttribute("data-state", "delayed-open")
    const card = page.getByRole("tooltip")
    await expect(card).toContainText("第 2 步")
    expect(await bar.boundingBox(), "pointed at, the strip keeps its size").toEqual(rest)
    // The name and card follow the pointer; once a card is up, the next one opens at once.
    const third = (await steps.nth(2).getAttribute("aria-label"))!
    await steps.nth(2).hover()
    await expect(name).toHaveText(third)
    await expect(steps.nth(2)).toHaveAttribute("data-state", "instant-open")
    await expect(card).toContainText("第 3 步")
    await page.mouse.move(5, 5)
    await expect(name).toHaveCount(0)
    await expect(card).toHaveCount(0)

    // A step clicked stays named once the pointer leaves; 「回到最新」 appears without moving anything.
    await steps.nth(1).click()
    await page.mouse.move(5, 5)
    await expect(name).toHaveText(second)
    const back = tree.getByRole("button", { name: "回到最新" })
    await expect(back).toBeVisible()
    expect(await bar.boundingBox(), "a step open, the strip keeps its size").toEqual(rest)
    // Back at the first sketch (no solid yet) the colour picker keeps its place, only disabled.
    await steps.nth(0).click()
    await page.mouse.move(5, 5)
    await expect(tree.getByRole("button", { name: /^零件的颜色/ })).toBeDisabled()
    expect(await bar.boundingBox(), "at a sketch with no solid, the strip keeps its size").toEqual(rest)
    // From the keyboard the card opens at once; Esc closes the card first, then lets go of the step.
    await steps.nth(3).focus()
    await expect(steps.nth(3)).toHaveAttribute("data-state", "instant-open")
    await expect(card).toContainText("第 4 步")
    await page.keyboard.press("Escape")
    await expect(card).toHaveCount(0)
    await expect(back, "one Esc closes one thing").toBeVisible()
    await page.keyboard.press("Escape")
    await expect(back).toHaveCount(0)
    await steps.nth(3).blur()
    await expect(name).toHaveCount(0)
  })

  test("/studio 回放建模过程：‹ › 一步步看，▶ 从第一步放到最后", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    await expect(tree.getByText("5 个特征")).toBeVisible({ timeout: 90_000 })
    const steps = tree.locator("[data-step]")
    const name = tree.locator("[data-step-name]")
    const back = tree.getByRole("button", { name: "回到最新" })
    const prev = tree.getByRole("button", { name: "上一步" })
    const next = tree.getByRole("button", { name: "下一步" })
    const play = tree.getByRole("button", { name: "播放建模过程" })
    await expect(next, "at the latest model there is no step after").toBeDisabled()

    // ‹ from the latest goes to the step before the last; › at the second-to-last comes back to the latest.
    await prev.click()
    await expect(steps.nth(3)).toHaveAttribute("aria-current", "step")
    await expect(name).toHaveText((await steps.nth(3).getAttribute("aria-label"))!)
    await expect(back).toBeVisible()
    await prev.click()
    await prev.click()
    await prev.click()
    await expect(steps.nth(0)).toHaveAttribute("aria-current", "step")
    await expect(prev, "at the first step there is none before").toBeDisabled()
    await next.click()
    await expect(steps.nth(1)).toHaveAttribute("aria-current", "step")

    // With a step's details open, ‹ › take the details along.
    await steps.nth(2).click()
    await expect(page.getByRole("dialog", { name: "「螺栓孔」" })).toBeVisible()
    await next.click()
    await expect(page.getByRole("dialog", { name: "「孔阵列」" }), "the details follow the step").toBeVisible()

    // ▶ from the latest: from the first step to the last, one at a time, then it stops there.
    await back.click()
    await expect(back).toHaveCount(0)
    await play.click()
    const pause = tree.getByRole("button", { name: "暂停" })
    await expect(pause).toBeVisible()
    await expect(steps.nth(0), "it starts at the first step").toHaveAttribute("aria-current", "step")
    await expect(steps.nth(2)).toHaveAttribute("aria-current", "step", { timeout: 15_000 })
    await expect(steps.nth(4), "the last step gets its moment too").toHaveAttribute("aria-current", "step", { timeout: 15_000 })
    await expect(play, "and then it stops at the latest model").toBeVisible({ timeout: 15_000 })
    await expect(back).toHaveCount(0)

    // A click on a step, or Esc, stops it where it is.
    await play.click()
    await expect(pause).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(play).toBeVisible()
    await expect(back, "Esc stops and comes back to the latest").toHaveCount(0)
  })

  test("/studio 颜色弹层：按一次 Esc 就关，圆点的提示不再冒出来", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const tree = page.getByRole("navigation", { name: "特征树" })
    const count = tree.getByText("5 个特征")
    await expect(count).toBeVisible({ timeout: 90_000 })
    const panel = page.getByRole("dialog", { name: "零件的颜色" })
    const dot = tree.getByRole("button", { name: /^零件的颜色/ })
    // Shown names (a closing one stays in the page for its fade, longer here: SwiftShader keeps the CPU busy).
    const tips = page.locator('[role="tooltip"]:not([data-state="closed"])')
    const closedOnce = async () => {
      await page.keyboard.press("Escape")
      await expect(panel, "one Esc closes the panel").toHaveCount(0)
      // The focus comes back to the dot after the fade; its name must not pop up again then.
      await page.waitForTimeout(600)
      await expect(tips, "no name left over to press Esc on").toHaveCount(0)
    }
    // From the keyboard, with a swatch focused (its name showing).
    await count.hover()
    await dot.focus()
    await page.keyboard.press("Enter")
    await expect(panel).toBeVisible()
    await page.keyboard.press("Tab")
    await expect(tips).toHaveText("白")
    await closedOnce()
    await expect(dot).toBeFocused()
    // With the pointer on a swatch (its name showing).
    await count.hover()
    await dot.click()
    await expect(panel).toBeVisible()
    await panel.getByRole("button", { name: "橙", exact: true }).hover()
    await expect(tips).toHaveText("橙")
    await closedOnce()
  })

  test("/studio 的说明：指向 ⓘ 就全部显示，不用点", async ({ page }) => {
    await page.goto("/studio?start=flange")
    const count = page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")
    await expect(count).toBeVisible({ timeout: 90_000 })
    // Nothing opens on its own.
    await page.waitForTimeout(1200)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    // The timeline is faint at rest; its ⓘ shows once it is pointed at.
    const info = page.getByRole("button", { name: "特征树怎么用" })
    await expect(info).toBeHidden()
    await count.hover()
    await info.hover()
    const card = page.getByRole("dialog")
    await expect(card).toContainText("点一步：模型回到这一步")
    await expect(card.getByRole("listitem").nth(1), "every tip at once").toBeVisible()
    await expect(card.getByRole("button")).toHaveCount(0)
    // Moving away closes it; a click keeps it open until a click elsewhere.
    await page.mouse.move(5, 5)
    await expect(card).toHaveCount(0)
    await count.hover()
    await info.click()
    await expect(card).toContainText("点一步：模型回到这一步")
    await page.mouse.move(5, 5)
    await page.waitForTimeout(400)
    await expect(card).toBeVisible()
    await expect(info, "the timeline stays lit while its card is open").toBeVisible()
    await page.keyboard.press("Escape")
    await expect(card).toHaveCount(0)
  })

  test("/studio?practice= 练习：要求实时打勾，做到了就完成", async ({ page }) => {
    const p = PRACTICE.find((x) => x.id === "sketch-to-solid-1")!
    await page.goto(`/studio?practice=${p.id}`)
    const card = page.getByRole("region", { name: "练习" })
    await expect(card.getByText(p.title)).toBeVisible()
    await expect(card.getByText(`0/${p.checks.length}`)).toBeVisible({ timeout: 90_000 })
    await expect(page).toHaveURL(/\/studio$/)
    // Import the reference answer: every requirement ticks, the practice is done.
    const chooser = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: "更多" }).click()
    await page.getByRole("menuitem", { name: "导入文件…" }).click()
    await (await chooser).setFiles({ name: "答案.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(p.solution)) })
    await expect(card.getByText(`${p.checks.length}/${p.checks.length}`)).toBeVisible()
    await expect(card.getByText("练习完成")).toBeVisible()
    // The requirements stayed pinned in the imported tree; the lesson shows it done.
    await page.reload()
    await expect(page.getByRole("region", { name: "练习" }).getByText(`${p.checks.length}/${p.checks.length}`)).toBeVisible({ timeout: 90_000 })
    await page.getByRole("button", { name: "退出练习" }).click()
    await expect(page.getByRole("region", { name: "练习" })).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("arbor:progress") ?? "{}").done)).toContain(`practice:${p.id}`)
  })
})

test.describe("工作台 · 项目和装配", () => {
  test.setTimeout(180_000)

  test("/studio 新建装配项目：加新零件、「直接做」建形状、放 STEP 参考件、导出零件清单", async ({ page }) => {
    await page.goto("/studio")
    const files = page.getByRole("navigation", { name: "文件" })
    await expect(files.getByRole("button", { name: /^零件/ }), "the first visit starts 「我的模型」 with one part").toBeVisible({ timeout: 90_000 })

    // 新建项目 → several parts: an assembly with its parameter file, opened.
    await page.getByRole("complementary").getByRole("button", { name: "项目：我的模型" }).click()
    await page.getByRole("menuitem", { name: "新建项目…" }).click()
    const dialog = page.getByRole("dialog", { name: "新建项目" })
    await dialog.getByLabel("项目名").fill("笔")
    await dialog.getByText("几个零件（装配）").click()
    await dialog.getByRole("button", { name: "新建项目" }).click()
    await expect(files.getByRole("button", { name: /^笔/ })).toBeVisible({ timeout: 30_000 })
    const structure = page.getByRole("region", { name: "装配零件" })
    await expect(structure.getByText(/还没有零件/)).toBeVisible()

    // ＋ 零件 → 新零件: made under parts/ and opened inside the assembly.
    await structure.getByRole("button", { name: "零件", exact: true }).click()
    await page.getByRole("menuitem", { name: "新零件…" }).click()
    const naming = page.getByRole("dialog", { name: "新零件" })
    await naming.getByLabel("零件名").fill("笔杆")
    await naming.getByRole("button", { name: "新建" }).click()
    await expect(page.getByText("在装配里", { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(files.getByRole("button", { name: /^笔杆/ })).toBeVisible()

    // 「直接做」: the desktop assistant's commands, run by the engine in this page (the scripted model builds a box).
    await page.getByRole("radio", { name: "直接做" }).click()
    await page.getByRole("textbox", { name: "给建模助教的消息" }).fill("做一个小盒子")
    await page.keyboard.press("Enter")
    await expect(page.getByText(/^做好了/), "the scripted turn finishes").toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole("button", { name: "核对要求 · 3/3" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "特征树" }).getByText("5 个特征")).toBeVisible()

    // Back to the assembly: a STEP reference uploaded from the computer goes in beside the part.
    await page.getByRole("button", { name: /^回到装配/ }).click()
    await expect(structure.getByText("笔杆")).toBeVisible({ timeout: 30_000 })
    await structure.getByRole("button", { name: "零件", exact: true }).click()
    await page.getByRole("menuitem", { name: "STEP 参考件…" }).click()
    const chooser = page.waitForEvent("filechooser")
    await page.getByRole("dialog").getByRole("button", { name: /上传/ }).click()
    await (await chooser).setFiles("e2e/fixtures/cube.step")
    await expect(structure.getByText("cube")).toBeVisible({ timeout: 60_000 })
    await expectRendered(page.locator("canvas").first(), "/studio assembly")

    // The parts list of the assembly, downloaded.
    await page.getByRole("button", { name: "导出", exact: true }).click()
    const download = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: "导出零件清单（Markdown）" }).click()
    expect((await download).suggestedFilename()).toBe("笔-零件清单.md")

    // A reload comes back to the same project and file.
    await page.reload()
    await expect(structure.getByText("cube")).toBeVisible({ timeout: 90_000 })
  })
})
