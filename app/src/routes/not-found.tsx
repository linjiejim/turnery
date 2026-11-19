import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { StateView } from "@/components/ui/state"
import { t } from "@/lib/i18n"

/** Any path the router doesn't know, including pages that were taken down. */
export function NotFoundPage() {
  return (
    <StateView
      kind="no-match"
      title={t("没有这个页面", "Page not found")}
      description={t("链接可能写错了，或者这个页面已经下线。", "The link may be mistyped, or the page has been taken down.")}
      action={
        <Button asChild size="sm" variant="secondary">
          <Link to="/">{t("回到首页", "Go to the home page")}</Link>
        </Button>
      }
      className="min-h-[60dvh]"
    />
  )
}
