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

  test("/en/lesson: an English frame around a lesson that says it is still in Chinese", async ({ page }) => {
    await page.goto(`/en/lesson/${LESSONS[0].id}`)
    await expect(page.getByText(/This lesson is in Chinese for now/)).toBeVisible()
  })

  test("/en/studio: the workbench in English, an example model and its replay", async ({ page }) => {
    await page.goto("/en/studio")
    await expect(page.getByRole("heading", { name: "Model by describing it" })).toBeVisible()
    await expect(page.getByRole("button", { name: /80×50×30 box/ })).toBeEnabled({ timeout: 90_000 })
    await page.getByRole("button", { name: "Open an example model" }).click()
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
