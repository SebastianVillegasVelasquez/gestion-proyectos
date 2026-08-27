import { useMemo, useState } from "react";
import { ChevronRight, FolderTree, Search, Slash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tipoStyle } from "../utils/tipo-style";
import type { TipoNodo, WorkItemTree } from "../types/api.types";

interface Props {
  tree: WorkItemTree[];
  nodeTypes: TipoNodo[];
  /** Elemento seleccionado al abrir, o null si la tarea está suelta. */
  value: string | null;
  onSelect: (workItemId: string | null) => void;
  onClose: () => void;
}

interface FlatRow {
  item: WorkItemTree;
  depth: number;
  /** Ruta desde la raíz hasta este elemento, sin incluirlo. */
  ancestors: string[];
  hasChildren: boolean;
}

/**
 * Recorre el árbol en el orden en que se ve, llevando la ruta de cada nodo.
 * La ruta es lo que convierte "Unidad 3" en algo identificable cuando hay
 * quince "Unidad 3" repartidas por el proyecto.
 */
function flatten(
  nodes: WorkItemTree[],
  depth = 0,
  ancestors: string[] = [],
  collapsed = new Set<string>(),
  ignoreCollapse = false,
): FlatRow[] {
  return nodes.flatMap((item) => {
    const row: FlatRow = {
      item,
      depth,
      ancestors,
      hasChildren: item.children.length > 0,
    };
    const hidden = !ignoreCollapse && collapsed.has(item.id);
    return [
      row,
      ...(hidden
        ? []
        : flatten(
            item.children,
            depth + 1,
            [...ancestors, item.nombre],
            collapsed,
            ignoreCollapse,
          )),
    ];
  });
}

/**
 * Elegir dónde cuelga una tarea, viendo la estructura completa.
 *
 * Antes esto era un `<select>` con el árbol aplanado a golpe de sangrías: con
 * cuatro niveles y decenas de unidades, quien elige no ve el contexto y acaba
 * adivinando. Aquí se ve la jerarquía entera, con el color y el tipo de cada
 * elemento — los mismos que en la Estructura y el cronograma, para que sea el
 * mismo objeto en las tres pantallas.
 */
export function WorkItemPickerModal({ tree, nodeTypes, value, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(value);

  const typeNameById = useMemo(() => new Map(nodeTypes.map((t) => [t.id, t.nombre])), [nodeTypes]);

  const needle = search.trim().toLowerCase();
  const rows = useMemo(() => {
    // Buscando se ignora el plegado: esconder una coincidencia dentro de una
    // rama cerrada haría parecer que el elemento no existe.
    const all = flatten(tree, 0, [], collapsed, needle !== "");
    if (!needle) {
      return all;
    }
    return all.filter(
      (row) =>
        row.item.nombre.toLowerCase().includes(needle) ||
        row.ancestors.some((ancestor) => ancestor.toLowerCase().includes(needle)),
    );
  }, [tree, collapsed, needle]);

  // Sobre el árbol COMPLETO: la ruta del elegido debe verse en el pie aunque su
  // rama esté plegada o la búsqueda lo haya dejado fuera de la lista.
  const selectedRow = useMemo(
    () => flatten(tree, 0, [], new Set(), true).find((row) => row.item.id === selected) ?? null,
    [tree, selected],
  );

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const choose = (workItemId: string | null) => {
    onSelect(workItemId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Elegir ubicación en la estructura"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Grande a propósito: el problema del desplegable era no poder ver la
          estructura mientras se elige. */}
      <div className="relative flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FolderTree className="size-4 text-brand-teal" />
              Ubicación en la estructura
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Elige el elemento del que cuelga esta tarea. Se reflejará en la estructura y en el
              cronograma.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Buscar un elemento…"
              aria-label="Buscar un elemento de la estructura"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-teal"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
            }}
            onDoubleClick={() => {
              choose(null);
            }}
            aria-pressed={selected === null}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              selected === null
                ? "bg-brand-teal/10 text-brand-teal-dark ring-1 ring-brand-teal dark:text-brand-teal"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Slash className="size-3.5 shrink-0" />
            Sin ubicación (tarea independiente)
          </button>

          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {tree.length === 0
                ? "Este proyecto todavía no tiene estructura. Crea la tarea suelta y ubícala cuando exista."
                : "Ningún elemento coincide con la búsqueda."}
            </p>
          ) : (
            <ul>
              {rows.map(({ item, depth, ancestors, hasChildren }) => {
                const style = tipoStyle(item.tipo_id);
                const isSelected = selected === item.id;
                const isCollapsed = collapsed.has(item.id);
                return (
                  <li key={item.id} className="flex items-center">
                    {/* El plegado es su propio botón, hermano del de selección:
                        abrir una rama no debe elegirla. */}
                    <span
                      className="flex shrink-0 items-center"
                      style={{ paddingLeft: 8 + depth * 18 }}
                    >
                      {hasChildren && !needle ? (
                        <button
                          type="button"
                          onClick={() => {
                            toggle(item.id);
                          }}
                          aria-expanded={!isCollapsed}
                          aria-label={`${isCollapsed ? "Abrir" : "Cerrar"} ${item.nombre}`}
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <ChevronRight
                            className={cn(
                              "size-3.5 transition-transform",
                              !isCollapsed && "rotate-90",
                            )}
                          />
                        </button>
                      ) : (
                        <span className="size-[18px]" aria-hidden />
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSelected(item.id);
                      }}
                      onDoubleClick={() => {
                        choose(item.id);
                      }}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                        isSelected ? "bg-brand-teal/10 ring-1 ring-brand-teal" : "hover:bg-accent",
                      )}
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide",
                          style.chip,
                        )}
                      >
                        {typeNameById.get(item.tipo_id) ?? "Elemento"}
                      </span>
                      <span className="truncate text-sm text-foreground">{item.nombre}</span>
                      {needle && ancestors.length > 0 && (
                        <span className="ml-auto shrink-0 truncate text-[11px] text-muted-foreground">
                          {ancestors.join(" / ")}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-5 py-3">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {selectedRow ? (
              <>
                {selectedRow.ancestors.length > 0 && (
                  <span>{selectedRow.ancestors.join(" / ")} / </span>
                )}
                <span className="font-semibold text-foreground">{selectedRow.item.nombre}</span>
              </>
            ) : (
              "Sin ubicación: la tarea queda suelta en el proyecto."
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                choose(selected);
              }}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Usar esta ubicación
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
