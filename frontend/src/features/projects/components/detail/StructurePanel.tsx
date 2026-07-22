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

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
        style={{ paddingLeft: `${depth * 22 + 8}px` }}
      >
        <button
          onClick={() => {
            setOpen((o) => !o);
          }}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center text-slate-400",
            !hasChildren && "invisible",
          )}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            style.chip,
          )}
        >
          {typeNameById.get(node.tipo_id) ?? "elemento"}
        </span>

        <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {node.nombre}
        </span>

        {node.es_transversal && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
            <Repeat className="size-2.5" /> transversal
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {pct != null && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={cn("h-full rounded-full", style.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-[11px] tabular-nums text-slate-400">{pct}%</span>
            </div>
          )}
          <DateBadge node={node} />
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => {
                onAddChild(node);
              }}
              title="Añadir elemento dentro"
              className="rounded-md p-1 text-slate-400 hover:bg-accent hover:text-brand-gold-dark"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onEdit(node);
              }}
              title="Editar elemento"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onDeps(node);
              }}
              title="Dependencias (Finish-to-Start)"
              className="rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30"
            >
              <Link2 className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onClone(node);
              }}
              title="Duplicar con todo su contenido"
              className="rounded-md p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/30"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              onClick={() => {
                onDelete(node);
              }}
              title="Eliminar con todo su contenido"
              className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {open &&
        node.children.map((child) => (
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <Tag className="size-3" /> Tipos
      </span>
      {types.map((t) => {
        const style = tipoStyle(t.id);
        return (
          <span
            key={t.id}
            className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", style.chip)}
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
            className="w-24 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] outline-none focus:border-brand-gold dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            onClick={add}
            className="text-[11px] font-semibold text-brand-teal hover:text-brand-teal-dark hover:underline"
          >
            ok
          </button>
        </span>
      ) : (
        <button
          onClick={() => {
            setAdding(true);
          }}
          className="flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:border-brand-gold hover:text-brand-gold-dark dark:border-slate-600"
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

  const types = typesQuery.data ?? [];
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <FolderTree className="size-4 text-brand-teal" /> Estructura del proyecto
        </h2>
        <button
          onClick={() => {
            openAdd(null);
          }}
          disabled={types.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Añadir elemento
        </button>
      </div>

      <NodeTypesBar projectId={projectId} types={types} />

      {treeQuery.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
          <FolderTree className="size-8 text-slate-300 dark:text-slate-600" />
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Aún no hay estructura
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {types.length === 0
                ? "Crea primero un tipo de elemento (ej. «Módulo», «Fase»)."
                : "Empieza añadiendo el primer elemento de la estructura."}
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-0.5 py-2">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
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
    </div>
  );
}
