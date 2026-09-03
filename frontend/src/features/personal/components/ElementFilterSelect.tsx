import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { tipoStyle } from "@/features/projects/utils/tipo-style";
import type { ElementOption } from "../utils/element-options";

function ElementChip({ option, className }: { option: ElementOption; className?: string }) {
  const style = tipoStyle(
    option.tipo_id ?? option.id,
    option.tipo_nombre,
    option.es_dependencia_externa,
  );
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium",
        style.chip,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
      <span className="truncate">{option.name}</span>
    </span>
  );
}

/**
 * Filtro por elemento de la estructura: en vez de escribir el nombre a ciegas,
 * se elige de una lista con LOS MISMOS chips de color que la miga de pan y la
 * vista de estructura. El color es la pista: el usuario reconoce «lo del Módulo
 * 2» por el mismo tinte que ve en el resto de la aplicación.
 *
 * Es un desplegable propio y no un `<select>` nativo porque las opciones de un
 * `<option>` no admiten color ni conteo en los navegadores de escritorio.
 */
export function ElementFilterSelect({
  options,
  value,
  onChange,
}: {
  options: ElementOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

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

  // El elemento elegido puede desaparecer al cambiar otros filtros: soltamos el
  // filtro en vez de dejar la lista vacía sin explicación.
  useEffect(() => {
    if (value && !options.some((o) => o.id === value)) {
      onChange(null);
    }
  }, [options, value, onChange]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar por elemento de la estructura"
        className={cn(
          "flex h-[34px] min-w-[180px] max-w-[260px] items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm transition-colors",
          selected ? "border-brand-gold" : "border-border hover:bg-accent",
        )}
      >
        <FolderTree className="size-3.5 shrink-0 text-muted-foreground" />
        {selected ? (
          <ElementChip option={selected} className="min-w-0" />
        ) : (
          <span className="truncate text-muted-foreground">Todos los elementos</span>
        )}
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-80 w-[280px] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === null}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Check className={cn("size-3.5 shrink-0", value !== null && "invisible")} />
            Todos los elementos
          </button>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
            >
              <Check className={cn("size-3.5 shrink-0", option.id !== value && "invisible")} />
              <ElementChip option={option} className="min-w-0 flex-1" />
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {option.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
