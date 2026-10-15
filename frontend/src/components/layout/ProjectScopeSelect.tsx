import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectMark } from "@/components/common/EntityBadge";
import { useActiveProject } from "@/features/projects/hooks/use-active-project";
import { useProjectScopeOptions } from "@/features/projects/hooks/use-project-scope-options";

/**
 * «Proyecto activo» del menú lateral: acota los equipos y «Mis tareas» a un
 * proyecto. Con varios proyectos y equipos en marcha, es la forma de trabajar
 * de uno en uno; «Todos los proyectos» devuelve la vista completa.
 */
export function ProjectScopeSelect({ collapsed }: { collapsed: boolean }) {
  const { projectId, setProjectId } = useActiveProject();
  const options = useProjectScopeOptions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Con un solo proyecto no hay qué elegir.
  if (options.length < 2) {
    return null;
  }

  const current = options.find((o) => o.id === projectId) ?? null;
  const pick = (id: string | null) => {
    setProjectId(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn("relative pb-2", collapsed ? "md:px-2" : "px-3")}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Proyecto activo"
        title={collapsed ? (current?.name ?? "Todos los proyectos") : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border py-2 text-left text-sm transition-colors duration-150",
          collapsed ? "px-3 md:justify-center md:px-0" : "px-3",
          current
            ? "border-brand-gold/40 bg-brand-gold/10 text-sidebar-foreground"
            : "border-sidebar-border text-sidebar-foreground/70 hover:bg-white/10",
        )}
      >
        {current ? (
          <ProjectMark name={current.name} seed={current.id} size="md" />
        ) : (
          <FolderKanban className="size-4 shrink-0" />
        )}
        <span className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            Proyecto activo
          </span>
          <span className="block truncate font-medium">
            {current?.name ?? "Todos los proyectos"}
          </span>
        </span>
        <ChevronsUpDown className={cn("size-3.5 shrink-0 opacity-60", collapsed && "md:hidden")} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-3 top-full z-50 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-sidebar-border bg-sidebar p-1 shadow-xl"
        >
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={projectId === null}
              onClick={() => {
                pick(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/80 hover:bg-white/10"
            >
              <FolderKanban className="size-4 shrink-0" />
              <span className="flex-1">Todos los proyectos</span>
              {projectId === null && <Check className="size-3.5 text-brand-gold" />}
            </button>
          </li>
          {options.map((o) => (
            <li key={o.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={o.id === projectId}
                onClick={() => {
                  pick(o.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/80 hover:bg-white/10"
              >
                <ProjectMark name={o.name} seed={o.id} />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {o.id === projectId && <Check className="size-3.5 text-brand-gold" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
