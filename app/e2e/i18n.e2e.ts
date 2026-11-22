import { LESSONS } from "../src/content/lessons/index"
import { expect, expectRendered, test } from "./fixtures"

/** No Chinese characters in what a locator shows. */
const CJK = /[一-龥]/

/**
 * The English site under /en (lib/i18n.ts): its pages are English, its links stay under /en, and the
 * language menu goes to the same page in the other language, remembered for the next visit.
 */
test.describe("English pages", () => {
  test("/en home: English page, English links, the hero renders", async ({ page }) => {
    await page.goto("/en")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("See how every feature")
    await expectRendered(page.locator("canvas").first(), "/en hero")
    const nav = page.getByRole("banner")
    await expect(nav.getByRole("link", { name: "Learning path" })).toHaveAttribute("href", "/en/learn")
    expect(await page.getByRole("main").innerText(), "the home page has no Chinese left").not.toMatch(CJK)
  })

  test("/en/learn, /en/atlas, /en/glossary: the catalog is English too", async ({ page }) => {
    for (const [path, heading] of [
      ["/en/learn", "Learning path"],
      ["/en/atlas", "Command atlas"],
      ["/en/glossary", "Glossary"],
    ]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
      await expect(page).toHaveTitle(new RegExp(`^${heading} · Turnery`))
      expect(await page.getByRole("main").innerText(), `${path} has no Chinese left`).not.toMatch(CJK)
    }
    // Lessons are still linked from the English outline, inside /en.
    await page.goto("/en/learn")
    await expect(page.locator(`a[href="/en/lesson/${LESSONS[0].id}"]`).first()).toBeAttached()
  })

  test("/en/lesson, /en/card, /en/teardown: the course itself is English", async ({ page }) => {
    await page.goto(`/en/lesson/${LESSONS[0].id}`)
    const text = page.locator("aside").first()
    await expect(text.getByRole("button", { name: /^(Next|Skip for now)$/ })).toBeVisible({ timeout: 30_000 })
    expect(await text.innerText(), "the lesson's text has no Chinese left").not.toMatch(CJK)
    await page.goto("/en/card/0.1.4")
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(CJK)
    // Links to the sources keep the title of the page they cite (a Chinese help page stays Chinese).
    const cardText = await page.getByRole("main").evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement
      copy.querySelectorAll('a[target="_blank"]').forEach((a) => a.remove())
      return copy.innerText
    })
    expect(cardText, "the card has no Chinese left").not.toMatch(CJK)
    await page.goto("/en/teardown/mug")
    await expect(page.getByText("Mug", { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  })

  test("/en/studio: the workbench in English, an example model and its replay", async ({ page }) => {
    await page.goto("/en/studio")
    await expect(page.getByRole("heading", { name: "Start from a sketch" })).toBeVisible({ timeout: 90_000 })
    // The feature form speaks English too.
    await page.getByRole("button", { name: "New sketch" }).click()
    const form = page.getByRole("dialog", { name: "New sketch" })
    await expect(form.getByRole("textbox", { name: "Width (x)" })).toHaveValue("40")
    await form.getByRole("button", { name: "Cancel" }).first().click()
    await expect(form).toHaveCount(0)
    await page.getByRole("button", { name: "Open an example" }).click()
    await page.getByRole("menuitem", { name: "Flange" }).click()
    const tree = page.getByRole("navigation", { name: "Feature tree" })
    await expect(tree.getByText("5 features")).toBeVisible({ timeout: 90_000 })
    await expect(tree.locator("[data-step]").nth(2), "the example's own names are English").toHaveAttribute("aria-label", "Bolt hole")
    await tree.getByRole("button", { name: "Replay the modeling" }).click()
    await expect(tree.getByRole("button", { name: "Pause" })).toBeVisible()
  })

  test("the language menu goes to the same page in the other language, and is remembered", async ({ page }) => {
    await page.goto("/en/learn")
    await page.getByRole("button", { name: /^Language/ }).click()
    await page.getByRole("menuitemradio", { name: "中文" }).click()
    await expect(page).toHaveURL(/\/learn$/)
    await expect(page.getByRole("heading", { name: "学习路径" })).toBeVisible()
    await page.getByRole("button", { name: /^语言/ }).click()
    await page.getByRole("menuitemradio", { name: "English" }).click()
    await expect(page).toHaveURL(/\/en\/learn$/)
    // English chosen: a Chinese address now opens its English twin.
    await page.goto("/glossary")
    await expect(page).toHaveURL(/\/en\/glossary$/)
    await expect(page.getByRole("heading", { name: "Glossary", exact: true })).toBeVisible()
  })
})
