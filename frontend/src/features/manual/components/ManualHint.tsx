import { Link } from "react-router";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MANUAL_TOPIC } from "../manual-content";

/** Solo los temas declarados en `MANUAL_TOPIC`: así un `id` que cambie en el
 *  contenido rompe la compilación (y el test que los valida), no el enlace. */
export type ManualTopic = (typeof MANUAL_TOPIC)[keyof typeof MANUAL_TOPIC];

/**
 * Enlace de ayuda contextual: lleva al tema del manual que explica el control
 * que tiene al lado. Va junto a la acción, no en una página de ayuda aparte,
 * porque la duda aparece delante del botón, no antes de abrirlo.
 */
export function ManualHint({
  topic,
  label,
  className,
}: {
  topic: ManualTopic;
  /** Texto visible. Sin él queda solo el icono (para barras apretadas). */
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to={`/manual?tema=${topic}`}
      title={label ? `Abrir el manual: ${label}` : "Abrir el manual"}
      aria-label={label ? `Manual: ${label}` : "Abrir el manual"}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <CircleHelp className="size-3.5 shrink-0" />
      {label}
    </Link>
  );
}
