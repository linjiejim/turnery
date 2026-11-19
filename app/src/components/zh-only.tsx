import { Languages } from "lucide-react"
import { Callout } from "@/components/ui/callout"
import { isEn } from "@/lib/i18n"

/**
 * On English pages whose own text (a lesson, a card, a teardown's steps) is still only in Chinese:
 * says so once, at the top, instead of leaving the reader to wonder. Renders nothing in Chinese.
 */
export function ZhOnlyNotice({ what = "This page", className }: { what?: string; className?: string }) {
  if (!isEn) return null
  return (
    <Callout tone="neutral" icon={<Languages />} className={className}>
      {what} is in Chinese for now. The interface around it is in English; the English text is on its way.
    </Callout>
  )
}
