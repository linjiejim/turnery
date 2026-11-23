import * as React from "react"
import { parseChangelog } from "@/lib/changelog"
import { isEn } from "@/lib/i18n"
import { ReleaseNotesDialog, useReleaseNotes } from "@/components/ui/release-notes"
import changelogEn from "../../../../desktop/CHANGELOG.md?raw"
import changelogZh from "../../../../desktop/CHANGELOG.zh-CN.md?raw"
import { turnery } from "../bridge"

/** The full history, beyond what the changelog in the app has. */
const RELEASES_URL = "https://github.com/linjiejim/turnery/releases"

// The notes this build was made with, in the window's language (fixed for the life of the page).
const releases = parseChangelog(isEn ? changelogEn : changelogZh)

/**
 * After an update, once: 「已更新到 0.14.0 · 查看更新内容」, and the dialog with every version since the one
 * last opened. A first install says nothing. Turnery → 查看更新内容… opens it with every version. The desktop
 * window only: the website has no versions.
 */
export function WhatsNew() {
  const notes = useReleaseNotes({ version: turnery.version, releases, storageKey: "turnery:release-notes:seen" })
  const { openAll } = notes
  const openRef = React.useRef(openAll)
  React.useEffect(() => {
    openRef.current = openAll
  })
  React.useEffect(() => turnery.onMenu((action) => action === "whats-new" && openRef.current()), [])
  // window.open goes to the main process, which hands web addresses to the browser (setWindowOpenHandler).
  return <ReleaseNotesDialog {...notes.dialog} onMore={() => void window.open(RELEASES_URL, "_blank", "noopener")} />
}
