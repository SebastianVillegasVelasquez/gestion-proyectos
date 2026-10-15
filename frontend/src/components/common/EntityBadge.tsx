import { cn } from "@/lib/utils";
import { entityInitials, identityFor } from "@/features/projects/utils/entity-identity";

type Size = "sm" | "md";

const BOX: Record<Size, string> = {
  sm: "size-5 rounded-md text-[9px]",
  md: "size-7 rounded-lg text-[11px]",
};

/** Cuadrito de color con las siglas del proyecto. `seed` (el id) fija el color:
 *  dos proyectos con nombre parecido siguen viéndose distintos. */
export function ProjectMark({
  name,
  seed,
  size = "sm",
  className,
}: {
  name: string;
  seed?: string;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        BOX[size],
        identityFor(seed ?? name).solid,
        className,
      )}
    >
      {entityInitials(name)}
    </span>
  );
}

/** Siglas + nombre del proyecto en una sola pieza. */
export function ProjectBadge({
  name,
  seed,
  size = "sm",
  className,
}: {
  name: string;
  seed?: string;
  size?: Size;
  className?: string;
}) {
  return (
    <span title={name} className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <ProjectMark name={name} seed={seed} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Etiqueta suave con el nombre del equipo, del color de SU proyecto: dos
 *  equipos «Contenidos» de proyectos distintos se distinguen por el color. */
export function TeamTag({
  name,
  projectSeed,
  className,
}: {
  name: string;
  projectSeed?: string;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        identityFor(projectSeed ?? name).soft,
        className,
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}
