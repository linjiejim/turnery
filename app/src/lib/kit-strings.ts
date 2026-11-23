/**
 * The kit's own copy (lib/strings.ts, from jim-uiux) in English. lib/strings.ts stays as upstream ships
 * it, in Chinese; an English page swaps in this table once at boot, before anything renders (both entry
 * points import this file first). Typed as the whole `Strings`, so a key the kit adds fails the type
 * check until it has its English here.
 */
import { configureStrings, type Strings } from "@/lib/strings"
import { isEn } from "@/lib/i18n"

export const KIT_EN: Strings = {
  close: "Close",
  cancel: "Cancel",
  retry: "Retry",
  undo: "Undo",
  required: "Required",
  moreInfo: "About this",
  discardTitle: "Discard unsaved changes?",
  discardBody: "If you close now, the changes you just made are lost.",
  discardConfirm: "Discard changes",
  discardKeep: "Keep editing",
  selectPlaceholder: "Choose",
  searchPlaceholder: "Search",
  noOptions: "No matching options",
  emptyTitle: "Nothing here yet",
  noMatchTitle: "No results match",
  noMatchAction: "Clear filters",
  noPermissionTitle: "You don't have access",
  noPermissionBody: "Ask an administrator if you need it.",
  errorTitle: "Couldn't load",
  errorBody: "Check your connection and try again.",
  selectedCount: (n: number) => `${n} selected`,
  clearSelection: "Clear selection",
  totalCount: (n: number) => `${n} in total`,
  pageOf: (p: number, total: number) => `${p} / ${total}`,
  perPage: (n: number) => `${n} per page`,
  prevPage: "Previous page",
  nextPage: "Next page",
  rowActions: "More actions",
  all: "All",
  yes: "Yes",
  no: "No",
  clear: "Clear",
  unsaved: "Unsaved changes",
  save: "Save",
  discard: "Discard",
  saved: "Saved",
  openMenu: "Open menu",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
  back: "Back",
  resizePanel: "Resize",
  filters: "Filters",
  andMore: (n: number) => ` and ${n} more`,
  commandPlaceholder: "Search or type a command",
  commandEmpty: "No results",
  commandNavigate: "Select",
  commandRun: "Open",
  uploadTitle: "Upload",
  uploadProgress: (done: number, total: number) => `Uploading · ${done}/${total}`,
  uploadSummary: (added: number, exists: number, failed: number) =>
    [added && `${added} added`, exists && `${exists} already there`, failed && `${failed} failed`].filter(Boolean).join(", "),
  uploadWaiting: "Waiting",
  uploadUploading: "Uploading",
  uploadPercent: (p: number) => `Uploading ${p}%`,
  uploadAdded: "Added",
  uploadExists: "Already there",
  uploadFailed: "Failed",
  collapse: "Collapse",
  expand: "Expand",
  notifications: "Notifications",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy",
  previousItem: "Previous",
  nextItem: "Next",
  itemPosition: (i: number, n: number) => `${i} / ${n}`,
  whatsNew: "What’s new",
  seeWhatsNew: "See what’s new",
  updatedTo: (version: string) => `Updated to ${version}`,
  allReleaseNotes: "All release notes",
  releaseNotesEmpty: "No release notes yet",
  /** An ISO date (2026-11-20) under a version: this year “Nov 20”, other years “Nov 20, 2025”. */
  releaseDate: (iso: string) => {
    const date = new Date(`${iso}T00:00:00Z`)
    const thisYear = date.getUTCFullYear() === new Date().getFullYear()
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: thisYear ? undefined : "numeric", timeZone: "UTC" })
  },
  newVersionReady: "A new version is out; reload to use it",
  reload: "Reload",
}

if (isEn) configureStrings(KIT_EN)
