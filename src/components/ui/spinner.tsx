import { Loader } from "@/components/motion/loader"
import { cn } from "@/lib/utils"

/** The app's one loading indicator: the beUI Loader in its spinner variant. */
function Spinner({
  className,
  size = 16,
  label = "Carregando",
  "aria-hidden": ariaHidden,
}: {
  className?: string
  size?: number
  label?: string
  "aria-hidden"?: boolean | "true" | "false"
}) {
  return (
    <span
      data-slot="spinner"
      aria-hidden={ariaHidden}
      className={cn("inline-flex shrink-0 text-current", className)}
    >
      <Loader variant="spinner" size={size} label={label} className="text-current" />
    </span>
  )
}

export { Spinner }
