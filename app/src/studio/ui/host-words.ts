import * as React from "react"
import { t } from "../../lib/i18n"

/**
 * Words the shared workbench components use for whoever else changes the model. In the desktop
 * window that is the person's own agent, and steps can be handed over to it; the site's workbench
 * has nobody to hand over to (the hand-over fields are left out), the person builds it themselves.
 */
export type HostWords = {
  /** 「agent」; empty on the site. */
  helper: string
  /** The feature card's button that hands a step over. */
  askStep?: string
  /** The same, on a step that failed. */
  fixStep?: string
  /** When a selection can't be described: let the helper pick. */
  pickFor?: string
  /** The model is being changed right now. */
  busy: string
  /** A failed requirement check: hand it over. */
  fixCheck?: string
  /** The parameter list is empty. */
  noParams: string
}

export const WEB_WORDS: HostWords = {
  helper: "",
  busy: t("模型正在重建，好了再改。", "The model is rebuilding. Edit once it’s done."),
  noParams: t(
    "参数是有名字的尺寸：几处共用一个数时，改一处就都变。打开视图左上的「显示尺寸」，点模型上的一个尺寸，选「设为参数」。",
    "Parameters are named dimensions: when several places share a number, change it once and they all follow. Turn on “Show dimensions” at the top left of the view, click a dimension on the model and choose “Make a parameter”.",
  ),
}

export const DESKTOP_WORDS: HostWords = {
  helper: "agent",
  askStep: t("给 agent 留备注…", "Leave the agent a note…"),
  fixStep: t("给 agent 留备注", "Leave the agent a note"),
  pickFor: t("让 agent 来选", "Let the agent pick"),
  busy: t("agent 正在改模型，这一步结束后再改。", "The agent is changing the model. Edit once this step is done."),
  fixCheck: t("给 agent 留备注", "Leave the agent a note"),
  noParams: t("agent 会把关键尺寸定成参数，之后在这里直接改。", "The agent turns the key dimensions into parameters; change them here."),
}

export const WordsContext = React.createContext<HostWords>(WEB_WORDS)
export const useWords = () => React.useContext(WordsContext)
