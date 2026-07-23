import { useMemo, useState } from "react";
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
  Maximize2,
  X,
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
import type { TipoNodo, WorkItemTree } from "../../types/api.types";

function fmt(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
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
  onAddChild: (parent: WorkItemTree) => void;
  onEdit: (node: WorkItemTree) => void;
  onDeps: (node: WorkItemTree) => void;
  onClone: (node: WorkItemTree) => void;
  onDelete: (node: WorkItemTree) => void;
}

function TreeNode({
  node,
  depth,
  typeNameById,
  onAddChild,
  onEdit,
  onDeps,
  onClone,
  onDelete,
}: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const style = tipoStyle(node.tipo_id);
  const hasChildren = node.children.length > 0;
  const pct =
    node.porcentaje_completado != null ? Math.round(node.porcentaje_completado * 100) : null;

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
      <div className="group flex items-center gap-2.5 py-2.5 pr-4 pl-2 transition-colors hover:bg-accent/40">
        <button
          onClick={() => {
            setOpen((o) => !o);
          }}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
            !hasChildren && "invisible",
          )}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

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
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => {
                onAddChild(node);
              }}
              title="Añadir un elemento dentro de este"
              className="rounded-md p-1 text-muted-foreground hover:bg-brand-blue/10 hover:text-brand-blue-dark"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onEdit(node);
              }}
              title="Editar este elemento"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onDeps(node);
              }}
              title="Ordenar: qué debe terminar antes de este"
              className="rounded-md p-1 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30"
            >
              <Link2 className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onClone(node);
              }}
              title="Duplicar este elemento con todo lo que contiene"
              className="rounded-md p-1 text-muted-foreground hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/30"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onDelete(node);
              }}
              title="Eliminar este elemento y todo lo que contiene"
              className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
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
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeps={onDeps}
              onClone={onClone}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeTypesBar({ projectId, types }: { projectId: string; types: TipoNodo[] }) {
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
        return (
          <span
            key={t.id}
            className={cn(
              "rounded-full border-[1.5px] border-transparent px-3 py-1 text-[12.5px] font-bold",
              style.chip,
            )}
          >
            {t.nombre}
          </span>
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

export function StructurePanel({ projectId }: { projectId: string }) {
  const treeQuery = useWorkTree(projectId);
  const typesQuery = useNodeTypes(projectId);
  const deleteItem = useDeleteWorkItem(projectId);
  const [modalParent, setModalParent] = useState<WorkItemTree | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<WorkItemTree | null>(null);
  const [depsItem, setDepsItem] = useState<WorkItemTree | null>(null);
  const [cloneSource, setCloneSource] = useState<WorkItemTree | null>(null);
  const [expandedViewOpen, setExpandedViewOpen] = useState(false);

  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    types.forEach((t) => map.set(t.id, t.nombre));
    return map;
  }, [types]);

  const tree = treeQuery.data ?? [];

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
      {/* Fila combinada: TIPOS + botón "Añadir elemento" + beta botón alineados */}
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <NodeTypesBar projectId={projectId} types={types} />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setExpandedViewOpen(true);
            }}
            title="Vista expandida de la estructura (beta)"
            aria-label="Vista expandida de la estructura"
            className="flex items-center justify-center rounded-lg border border-border bg-card p-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Maximize2 className="size-4" />
            <span className="ml-1 hidden text-xs font-bold text-amber-600 dark:text-amber-400 sm:inline">
              BETA
            </span>
          </button>
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
      ) : (
        <Card className="flex min-h-[400px] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <CardContent className="flex flex-1 flex-col overflow-y-auto p-0">
            {tree.map((node, idx) => (
              <div key={node.id} className={cn(idx > 0 && "border-t border-accent/60")}>
                <TreeNode
                  node={node}
                  depth={0}
                  typeNameById={typeNameById}
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

      {/* Expanded structure view (beta) */}
      {expandedViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <FolderTree className="size-5 text-brand-blue" />
                <h2 className="text-lg font-semibold text-foreground">Estructura del Proyecto</h2>
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  BETA
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExpandedViewOpen(false);
                }}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {tree.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-center">
                  <div>
                    <FolderTree className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No hay elementos en la estructura
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {tree.map((node) => (
                    <ExpandedTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      typeNameById={typeNameById}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpandedTreeNode({
  node,
  depth,
  typeNameById,
}: {
  node: WorkItemTree;
  depth: number;
  typeNameById: Map<string, string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const typeName = typeNameById.get(node.tipo_id) ?? "Elemento";
  const style = tipoStyle(node.tipo_id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
          depth === 0 && "bg-accent/40",
        )}
      >
        {hasChildren && (
          <button
            onClick={() => {
              setExpanded(!expanded);
            }}
            type="button"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-background"
          >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        )}
        {!hasChildren && <div className="w-5" />}

        <div className="flex flex-1 items-start gap-2">
          <span className={cn("mt-1 inline-block h-2 w-2 rounded-full shrink-0", style.dot)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{node.nombre}</p>
            <p className="text-xs text-muted-foreground">{typeName}</p>
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="ml-6 border-l border-border/50 py-1">
          {node.children.map((child) => (
            <ExpandedTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              typeNameById={typeNameById}
            />
          ))}
        </div>
      )}
    </div>
  );
}
