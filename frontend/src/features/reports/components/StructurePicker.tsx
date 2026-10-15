import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterStructure, type StructureOption } from "../utils/structure-options";

/** Cuántas filas se pintan a la vez: con cientos de elementos, escribir afina. */
const LIMIT = 120;

/**
 * Selector de una rama de la estructura con búsqueda. Una lista desplegable
 * plana no escala cuando el proyecto tiene cientos de elementos: aquí se
 * escribe parte del nombre o de la ruta («modulo 3 leccion») y se elige.
 */
export function StructurePicker({
  options,
  value,
  onChange,
  loading = false,
}: {
  options: StructureOption[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const matches = useMemo(() => filterStructure(options, query), [options, query]);
  const shown = matches.slice(0, LIMIT);
  // La fila 0 es «Toda la estructura».
  const rowCount = shown.length + 1;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    input.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const choose = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active === 0 ? undefined : shown[active - 1]?.id);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
        }}
        disabled={loading || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Elemento de la estructura"
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-[15px] outline-none transition-colors hover:border-brand-gold/60 focus:border-brand-gold disabled:opacity-60"
      >
        <span className={cn("min-w-0 truncate", !selected && "text-foreground")}>
          {selected ? selected.path.join(" › ") : "Toda la estructura"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          onKeyDown={onKeyDown}
        >
          <label className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Buscar por nombre o ruta…"
              aria-label="Buscar en la estructura"
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            <li
              role="option"
              aria-selected={value === undefined}
              onMouseEnter={() => {
                setActive(0);
              }}
              onClick={() => {
                choose(undefined);
              }}
              className={cn(
                "cursor-pointer px-3 py-1.5 text-sm font-medium",
                active === 0 && "bg-accent",
              )}
            >
              Toda la estructura
            </li>
            {shown.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={o.id === value}
                onMouseEnter={() => {
                  setActive(i + 1);
                }}
                onClick={() => {
                  choose(o.id);
                }}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  active === i + 1 && "bg-accent",
                  o.id === value && "font-semibold text-brand-gold-dark dark:text-brand-gold",
                )}
                // Sin búsqueda se ve el árbol con sangría; buscando, la ruta
                // entera, porque ya no hay jerarquía visible que la sustituya.
                style={{ paddingLeft: query ? undefined : 12 + o.depth * 16 }}
              >
                <span className="block truncate">{o.name}</span>
                {query && o.path.length > 1 && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {o.path.slice(0, -1).join(" › ")}
                  </span>
                )}
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted-foreground">
                Nada coincide con «{query}».
              </li>
            )}
          </ul>
          {matches.length > LIMIT && (
            <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              Mostrando {LIMIT} de {matches.length}: escribe para afinar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
