import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { tipoStyle } from "@/features/projects/utils/tipo-style";
import type { ElementOption } from "../utils/element-options";

const MENU_WIDTH = 300;
const MENU_MAX_HEIGHT = 320;

function ElementChip({ option, className }: { option: ElementOption; className?: string }) {
  const style = tipoStyle(
    option.tipo_id ?? option.key,
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
 * Coloca el menú respecto al botón en coordenadas de VENTANA. Va en un portal
 * con `position: fixed` porque el filtro vive dentro de un panel con
 * `overflow-hidden` (el que recorta el cronograma): en flujo normal, el menú se
 * cortaba contra ese borde y solo se veían las primeras opciones.
 */
function useMenuPosition(anchor: HTMLElement | null, open: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = useCallback(() => {
    if (!anchor) {
      return;
    }
    const r = anchor.getBoundingClientRect();
    // Se abre hacia arriba si abajo no cabe, y se mantiene dentro del viewport
    // por la derecha: el filtro está pegado al borde de la pantalla.
    const below = window.innerHeight - r.bottom;
    const top =
      below < MENU_MAX_HEIGHT && r.top > below ? r.top - MENU_MAX_HEIGHT - 4 : r.bottom + 4;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setPos({ top: Math.max(8, top), left });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    place();
    window.addEventListener("resize", place);
    // `capture`: el panel que scrollea es un ancestro, no la ventana.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return pos;
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
  /** Clave del grupo elegido (ver `ElementOption.key`), o null. */
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find((o) => o.key === value) ?? null, [options, value]);
  const pos = useMenuPosition(anchor, open);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!anchor?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor]);

  // El elemento elegido puede desaparecer al cambiar otros filtros: soltamos el
  // filtro en vez de dejar la lista vacía sin explicación.
  useEffect(() => {
    if (value && !options.some((o) => o.key === value)) {
      onChange(null);
    }
  }, [options, value, onChange]);

  if (options.length === 0) {
    return null;
  }

  const pick = (key: string | null) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={setAnchor}
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              maxHeight: MENU_MAX_HEIGHT,
            }}
            className="fixed z-[70] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl"
          >
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => {
                pick(null);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <Check className={cn("size-3.5 shrink-0", value !== null && "invisible")} />
              Todos los elementos
            </button>
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={option.key === value}
                onClick={() => {
                  pick(option.key);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
              >
                <Check className={cn("size-3.5 shrink-0", option.key !== value && "invisible")} />
                <ElementChip option={option} className="min-w-0 flex-1" />
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {option.count}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
