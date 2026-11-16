import * as React from "react"
import { Info } from "@/components/ui/info"

/**
 * The explanations a panel used to print in full, behind the kit's grey ⓘ (`Info`: pointing at it
 * opens it, a click, Enter or a tap pins it). One tip reads as a sentence, several as a list.
 */
export function Hint({ tips, ...info }: { tips: string[] } & Omit<React.ComponentProps<typeof Info>, "children">) {
  return (
    <Info {...info}>
      {tips.length === 1 ? (
        <p className="text-body">{tips[0]}</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body marker:text-faint-foreground">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
    </Info>
  )
}
