import * as React from "react"
import { t } from "../../lib/i18n"

/**
 * Words the shared workbench components use for whoever builds the model: the
 * site's tutor (助教) or, in the desktop window, the person's own agent.
 */
export type HostWords = {
  /** 「助教」/「agent」 */
  helper: string
  /** The feature card's button that hands a step over. */
  askStep: string
  /** The same, on a step that failed. */
  fixStep: string
  /** When a selection can't be described: let the helper pick. */
  pickFor: string
  /** The model is being changed right now. */
  busy: string
  /** A failed requirement check: hand it over. */
  fixCheck: string
  /** The parameter list is empty. */
  noParams: string
}

export const WEB_WORDS: HostWords = {
  helper: t("助教", "tutor"),
  askStep: t("让助教改这一步…", "Ask the tutor to change this step…"),
  fixStep: t("让助教修这一步", "Ask the tutor to fix this step"),
  pickFor: t("让助教来选", "Let the tutor pick"),
  busy: t("助教正在改模型，这一轮结束后再改。", "The tutor is changing the model. Edit once this turn is done."),
  fixCheck: t("让助教修正", "Ask the tutor to fix it"),
  noParams: t("助教会把关键尺寸定成参数，之后在这里直接改。", "The tutor turns the key dimensions into parameters; change them here."),
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
