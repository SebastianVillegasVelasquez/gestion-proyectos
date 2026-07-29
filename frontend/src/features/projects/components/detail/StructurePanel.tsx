import { useMemo, useRef, useState } from "react";
import {
  FolderTree,
  Plus,
  Trash2,
  Repeat,
  AlertTriangle,
  Tag,
  ChevronRight,
  ChevronDown,
  Copy,
  Pencil,
  Link2,
  ListChecks,
  Search,
  ListTree,
  List,
  ChevronsDownUp,
  ChevronsUpDown,
  MoreVertical,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  useWorkTree,
  useNodeTypes,
  useDeleteWorkItem,
  useCreateNodeType,
} from "../../hooks/use-structure";
import { tipoStyle } from "../../utils/tipo-style";
import { WorkItemModal } from "./WorkItemModal";
import { CloneWorkItemModal } from "./CloneWorkItemModal";
import { DependenciesModal } from "./DependenciesModal";
import { NodeTasksModal } from "./NodeTasksModal";
import type { TipoNodo, WorkItemTree } from "../../types/api.types";

function fmt(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function nodeMatches(node: WorkItemTree, query: string): boolean {
  return node.nombre.toLowerCase().includes(query);
}

/** ids de todos los nodos que tienen hijos (para "colapsar todo"). */
function collectParentIds(nodes: WorkItemTree[], acc: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.add(node.id);
      collectParentIds(node.children, acc);
    }
  }
  return acc;
}

/** Poda el árbol a los nodos que coinciden con la búsqueda o tienen un
 * descendiente que coincide. Los ancestros de un match quedan siempre
 * visibles: el llamador fuerza su expansión mientras hay búsqueda activa. */
function pruneForSearch(nodes: WorkItemTree[], query: string): WorkItemTree[] {
  const result: WorkItemTree[] = [];
  for (const node of nodes) {
    const children = pruneForSearch(node.children, query);
    if (nodeMatches(node, query) || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

/** Nº de descendientes (hijos, nietos…) de un nodo. Se muestra en los nodos
 * colapsados para saber cuánto contenido queda oculto en árboles grandes. */
function descendantCount(node: WorkItemTree): number {
  return node.children.reduce((total, child) => total + 1 + descendantCount(child), 0);
}

/** Nº total de elementos en una lista de árboles (raíces + descendientes). */
function totalNodes(nodes: WorkItemTree[]): number {
  return nodes.reduce((total, node) => total + 1 + descendantCount(node), 0);
}

interface NodeAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Estilo destructivo (rojo) para acciones como eliminar. */
  danger?: boolean;
}

/** Menú de opciones por nodo (kebab). Concentra todas las acciones en un solo
 * botón para no saturar cada fila —clave con muchos elementos—. Se posiciona
 * con `fixed` anclado al botón, así no lo recorta el scroll del contenedor. */
function NodeActionsMenu({ actions }: { actions: NodeAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Opciones del elemento"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <MoreVertical className="size-4" />
      </button>

      {open && pos && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => {
              setOpen(false);
            }}
          />
          <div
            role="menu"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 flex w-48 flex-col rounded-xl border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 dark:border-slate-700 dark:bg-slate-900"
          >
            {actions.map(({ label, icon: Icon, onClick, danger }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClick();
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  danger
                    ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                    : "text-slate-700 hover:bg-accent dark:text-slate-200",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function DateBadge({ node }: { node: WorkItemTree }) {
  const hasRange = node.fecha_inicio_plan ?? node.fecha_fin_plan;
  if (!hasRange && node.duracion_valor == null) {
    return (
      <span className="text-[11px] italic text-slate-300 dark:text-slate-600">sin fechas</span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      {hasRange && (
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {fmt(node.fecha_inicio_plan)} → {fmt(node.fecha_fin_plan)}
        </span>
      )}
      {node.duracion_valor != null && (
        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          {node.duracion_valor} {node.duracion_unidad === "semanas" ? "sem" : "d"}
        </span>
      )}
      {node.advertencia_fechas && (
        <AlertTriangle className="size-3.5 text-amber-500" aria-label="Fechas inconsistentes" />
      )}
    </span>
  );
}

interface TreeNodeProps {
  node: WorkItemTree;
  depth: number;
  typeNameById: Map<string, string>;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onAddChild: (parent: WorkItemTree) => void;
  onEdit: (node: WorkItemTree) => void;
  onDeps: (node: WorkItemTree) => void;
  onClone: (node: WorkItemTree) => void;
  onDelete: (node: WorkItemTree) => void;
  onTasks: (node: WorkItemTree) => void;
  activeTypeIds: Set<string>;
}

function TreeNode({
  node,
  depth,
  typeNameById,
  isExpanded,
  onToggle,
  onAddChild,
  onEdit,
  onDeps,
  onClone,
  onDelete,
  onTasks,
  activeTypeIds,
}: TreeNodeProps) {
  const open = isExpanded(node.id);
  const style = tipoStyle(node.tipo_id);
  const hasChildren = node.children.length > 0;
  const pct =
    node.porcentaje_completado != null ? Math.round(node.porcentaje_completado * 100) : null;
  const nodeDimmed = activeTypeIds.size > 0 && !activeTypeIds.has(node.tipo_id);

  const nameSize =
    depth === 0
      ? "text-[15.5px] font-semibold text-foreground"
      : depth === 1
        ? "text-[15px] font-medium text-foreground/90"
        : "text-[14.5px] font-medium text-foreground/80";

  return (
    <div
      className={cn(
        "relative",
        depth > 0 &&
          "before:absolute before:left-[-16px] before:top-[22px] before:h-[1.5px] before:w-4 before:bg-border before:content-['']",
      )}
    >
      <div
        className={cn(
          "group flex items-center gap-2.5 py-2.5 pr-4 pl-2 transition-colors hover:bg-accent/40",
          nodeDimmed && "opacity-40",
        )}
      >
        <button
          onClick={() => {
            onToggle(node.id);
          }}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
            !hasChildren && "invisible",
          )}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {/* Cuántos elementos hay dentro cuando el nodo está colapsado: da idea
            del tamaño oculto en árboles grandes sin tener que expandir. */}
        {hasChildren && !open && (
          <span
            className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground"
            title={`${descendantCount(node)} elementos dentro`}
          >
            {descendantCount(node)}
          </span>
        )}

        <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
            style.chip,
          )}
        >
          {typeNameById.get(node.tipo_id) ?? "elemento"}
        </span>

        <span className={cn("truncate", nameSize)}>{node.nombre}</span>

        {node.es_transversal && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-teal-dark dark:text-brand-teal">
            <Repeat className="size-2.5" /> transversal
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {pct != null && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent">
                <div
                  className={cn("h-full rounded-full", style.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
            </div>
          )}
          <DateBadge node={node} />
          {/* Acción rápida (añadir dentro) visible al hover + resto en el menú.
              Un solo botón por fila mantiene limpia la vista con muchos nodos. */}
          <button
            onClick={() => {
              onAddChild(node);
            }}
            title="Añadir un elemento dentro de este"
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-blue/10 hover:text-brand-blue-dark group-hover:opacity-100"
          >
            <Plus className="size-3.5" />
          </button>
          <NodeActionsMenu
            actions={[
              {
                label: "Añadir dentro",
                icon: Plus,
                onClick: () => {
                  onAddChild(node);
                },
              },
              {
                label: "Editar",
                icon: Pencil,
                onClick: () => {
                  onEdit(node);
                },
              },
              {
                label: "Ordenar (dependencias)",
                icon: Link2,
                onClick: () => {
                  onDeps(node);
                },
              },
              {
                label: "Tareas",
                icon: ListChecks,
                onClick: () => {
                  onTasks(node);
                },
              },
              {
                label: "Duplicar / pegar",
                icon: Copy,
                onClick: () => {
                  onClone(node);
                },
              },
              {
                label: "Eliminar",
                icon: Trash2,
                danger: true,
                onClick: () => {
                  onDelete(node);
                },
              },
            ]}
          />
        </div>
      </div>

      {open && hasChildren && (
        <div className="ml-[31px] border-l-[1.5px] border-border pl-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              typeNameById={typeNameById}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeps={onDeps}
              onClone={onClone}
              onDelete={onDelete}
              onTasks={onTasks}
              activeTypeIds={activeTypeIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeTypesBar({
  projectId,
  types,
  activeTypeIds,
  onToggleType,
}: {
  projectId: string;
  types: TipoNodo[];
  activeTypeIds: Set<string>;
  onToggleType: (id: string) => void;
}) {
  const createType = useCreateNodeType(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    if (name.trim().length < 1) {
      return;
    }
    await createType.mutateAsync({ nombre: name.trim() });
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
        <Tag className="size-3" /> Tipos
      </span>
      {types.map((t) => {
        const style = tipoStyle(t.id);
        const active = activeTypeIds.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onToggleType(t.id);
            }}
            aria-pressed={active}
            title="Filtrar / atenuar por este tipo"
            className={cn(
              "rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold transition-opacity",
              style.chip,
              active ? "border-current" : "border-transparent",
              activeTypeIds.size > 0 && !active && "opacity-40",
            )}
          >
            {t.nombre}
          </button>
        );
      })}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ej. Fase"
            className="w-24 rounded-full border border-border bg-background px-3 py-1 text-[12.5px] outline-none focus:border-brand-blue"
          />
          <button
            onClick={add}
            className="text-[12.5px] font-bold text-brand-teal hover:text-brand-teal-dark hover:underline"
          >
            ok
          </button>
        </span>
      ) : (
        <button
          onClick={() => {
            setAdding(true);
          }}
          className="flex items-center gap-1 rounded-full border-[1.5px] border-dashed border-border bg-transparent px-3 py-1 text-[12.5px] font-bold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-3" /> nuevo
        </button>
      )}
    </div>
  );
}

/** Vista de lista: tabla plana (sin jerarquía visual) de todos los nodos, para
 * cuando el volumen de elementos hace incómodo navegar el árbol. */
function ListRows({
  nodes,
  typeNameById,
  activeTypeIds,
}: {
  nodes: WorkItemTree[];
  typeNameById: Map<string, string>;
  activeTypeIds: Set<string>;
}) {
  const rows: WorkItemTree[] = [];
  const collect = (list: WorkItemTree[]) => {
    for (const n of list) {
      rows.push(n);
      collect(n.children);
    }
  };
  collect(nodes);

  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 border-b border-border bg-card text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-4 py-3">Nombre</th>
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Fechas</th>
          <th className="px-4 py-3">Duración</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((node) => {
          const style = tipoStyle(node.tipo_id);
          const dimmed = activeTypeIds.size > 0 && !activeTypeIds.has(node.tipo_id);
          return (
            <tr
              key={node.id}
              className={cn("border-b border-accent/60 last:border-0", dimmed && "opacity-40")}
            >
              <td className="px-4 py-2.5 font-semibold text-foreground">{node.nombre}</td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                    style.chip,
                  )}
                >
                  {typeNameById.get(node.tipo_id) ?? "elemento"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {node.fecha_inicio_plan || node.fecha_fin_plan
                  ? `${fmt(node.fecha_inicio_plan)} → ${fmt(node.fecha_fin_plan)}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {node.duracion_valor != null
                  ? `${node.duracion_valor} ${node.duracion_unidad === "semanas" ? "sem" : "d"}`
                  : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function StructurePanel({ projectId }: { projectId: string }) {
  const treeQuery = useWorkTree(projectId);
  const typesQuery = useNodeTypes(projectId);
  const deleteItem = useDeleteWorkItem(projectId);
  const [modalParent, setModalParent] = useState<WorkItemTree | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<WorkItemTree | null>(null);
  const [depsItem, setDepsItem] = useState<WorkItemTree | null>(null);
  const [cloneSource, setCloneSource] = useState<WorkItemTree | null>(null);
  const [tasksNode, setTasksNode] = useState<WorkItemTree | null>(null);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"arbol" | "lista">("arbol");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeTypeIds, setActiveTypeIds] = useState<Set<string>>(new Set());

  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    types.forEach((t) => map.set(t.id, t.nombre));
    return map;
  }, [types]);

  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  const query = search.trim().toLowerCase();
  const visibleTree = useMemo(() => {
    if (!query) {
      return tree;
    }
    return pruneForSearch(tree, query);
  }, [tree, query]);

  const totalCount = useMemo(() => totalNodes(tree), [tree]);
  const visibleCount = useMemo(() => totalNodes(visibleTree), [visibleTree]);

  // Con búsqueda activa, todo lo que sobrevive a la poda queda expandido
  // (ya son solo los matches y sus ancestros); sin búsqueda, respeta lo que
  // el usuario colapsó manualmente.
  const isExpanded = (id: string): boolean => (query ? true : !collapsedIds.has(id));

  const toggleNode = (id: string) => {
    if (query) {
      return;
    }
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleType = (id: string) => {
    setActiveTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  function openAdd(parent: WorkItemTree | null) {
    setModalParent(parent);
    setModalOpen(true);
  }

  function handleDelete(node: WorkItemTree) {
    if (window.confirm(`¿Eliminar “${node.nombre}” y todo su contenido?`)) {
      deleteItem.mutate(node.id);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar: buscador, vista árbol/lista, colapsar-expandir todo, + añadir */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Buscar elemento…"
            aria-label="Buscar elemento de la estructura"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => {
              setView("arbol");
            }}
            aria-pressed={view === "arbol"}
            aria-label="Vista de árbol"
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-bold transition-colors",
              view === "arbol"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListTree className="size-3.5" /> Árbol
          </button>
          <button
            type="button"
            onClick={() => {
              setView("lista");
            }}
            aria-pressed={view === "lista"}
            aria-label="Vista de lista"
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-bold transition-colors",
              view === "lista"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-3.5" /> Lista
          </button>
        </div>

        {view === "arbol" && (
          <button
            type="button"
            onClick={() => {
              setCollapsedIds((prev) =>
                prev.size > 0 ? new Set() : collectParentIds(tree, new Set()),
              );
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsedIds.size > 0 ? (
              <>
                <ChevronsUpDown className="size-3.5" /> Expandir todo
              </>
            ) : (
              <>
                <ChevronsDownUp className="size-3.5" /> Colapsar todo
              </>
            )}
          </button>
        )}

        {totalCount > 0 && (
          <span className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <FolderTree className="size-3.5" />
            {query ? `${visibleCount} de ${totalCount}` : totalCount}
            <span className="font-normal">{totalCount === 1 ? "elemento" : "elementos"}</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              openAdd(null);
            }}
            disabled={types.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" /> Añadir elemento
          </button>
        </div>
      </div>

      <NodeTypesBar
        projectId={projectId}
        types={types}
        activeTypeIds={activeTypeIds}
        onToggleType={toggleType}
      />

      {treeQuery.isLoading ? (
        <div className="min-h-[400px] flex-1 animate-pulse rounded-2xl bg-accent" />
      ) : tree.length === 0 ? (
        <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <FolderTree className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Aún no hay estructura</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {types.length === 0
                ? "Crea primero un tipo de elemento (ej. «Módulo», «Fase»)."
                : "Empieza añadiendo el primer elemento de la estructura."}
            </p>
          </div>
        </div>
      ) : query && visibleTree.length === 0 ? (
        <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Search className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ningún elemento coincide con «{search}».</p>
        </div>
      ) : view === "lista" ? (
        <Card className="flex min-h-[400px] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <CardContent className="flex-1 overflow-auto p-0">
            <ListRows
              nodes={visibleTree}
              typeNameById={typeNameById}
              activeTypeIds={activeTypeIds}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-[400px] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <CardContent className="flex flex-1 flex-col overflow-y-auto p-0">
            {visibleTree.map((node, idx) => (
              <div key={node.id} className={cn(idx > 0 && "border-t border-accent/60")}>
                <TreeNode
                  node={node}
                  depth={0}
                  typeNameById={typeNameById}
                  isExpanded={isExpanded}
                  onToggle={toggleNode}
                  onAddChild={(p) => {
                    openAdd(p);
                  }}
                  onEdit={(n) => {
                    setEditItem(n);
                  }}
                  onDeps={(n) => {
                    setDepsItem(n);
                  }}
                  onClone={(n) => {
                    setCloneSource(n);
                  }}
                  onDelete={handleDelete}
                  onTasks={(n) => {
                    setTasksNode(n);
                  }}
                  activeTypeIds={activeTypeIds}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {modalOpen && (
        <WorkItemModal
          projectId={projectId}
          parent={modalParent}
          nodeTypes={types}
          onClose={() => {
            setModalOpen(false);
          }}
        />
      )}

      {editItem && (
        <WorkItemModal
          projectId={projectId}
          editItem={editItem}
          parent={null}
          nodeTypes={types}
          onClose={() => {
            setEditItem(null);
          }}
        />
      )}

      {depsItem && (
        <DependenciesModal
          projectId={projectId}
          item={depsItem}
          tree={tree}
          onClose={() => {
            setDepsItem(null);
          }}
        />
      )}

      {cloneSource && (
        <CloneWorkItemModal
          projectId={projectId}
          source={cloneSource}
          tree={tree}
          onClose={() => {
            setCloneSource(null);
          }}
        />
      )}

      {tasksNode && (
        <NodeTasksModal
          projectId={projectId}
          node={tasksNode}
          onClose={() => {
            setTasksNode(null);
          }}
        />
      )}
    </div>
  );
}
