/**
 * The site's workbench had a chat (until 2026-11-22): a visitor's own DeepSeek key, the conversations,
 * the chat mode and the delete tokens of shared links stayed in this browser. Nothing reads them any
 * more, and a key is a secret: they go the first time the workbench opens.
 */
const KEYS = ["ft-studio-deepseek-key", "ft-studio-chat-v1", "ft-studio-mode", "ft-studio-shares-v1"]
const PREFIX = "ft-studio-chat-v1:"

export function forgetChat(store: Pick<Storage, "length" | "key" | "removeItem"> = localStorage) {
  try {
    const doomed = new Set(KEYS)
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k?.startsWith(PREFIX)) doomed.add(k)
    }
    for (const k of doomed) store.removeItem(k)
  } catch {
    /* private mode: nothing was kept */
  }
}
