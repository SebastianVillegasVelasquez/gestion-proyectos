import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  FolderTree,
  Plus,
  Trash2,
  Repeat,
  AlertTriangle,
  CalendarClock,
  Tag,
  ChevronRight,
  ChevronDown,
  Copy,
  Pencil,
  Link2,
  ListChecks,
  ListPlus,
  Search,
  GanttChartSquare,
  ChevronsDownUp,
  ChevronsUpDown,
  MoreVertical,
  GripVertical,
  CornerLeftUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useWorkTree,
  useNodeTypes,
  useDeleteWorkItem,
  useCreateNodeType,
  useUpdateNodeType,
  useDeleteNodeType,
  useMoveWorkItem,
} from "../../hooks/use-structure";
import { tipoStyle } from "../../utils/tipo-style";
import {
  collapsibleIdsBelowRoot,
  computeOutdentPayload,
  dropPosFromEvent,
  findNode,
  subtreeIds,
  resolveDrop,
  type DropPos,
} from "../../utils/work-tree-dnd";
import { useDragAutoScroll } from "../../utils/use-drag-auto-scroll";
import { useProjectTasks } from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import { useTeams } from "../../hooks/use-teams";
import { indexById } from "../../utils/task-assignment";
import { formatShortDate } from "../../utils/task-dates";
import { CreateTaskModal } from "../../tasks/CreateTaskModal";
import { BulkTasksFromBranchModal } from "./BulkTasksFromBranchModal";
import { DateConflictModal } from "./DateConflictModal";
import { TrashModal } from "./TrashModal";
import { WorkItemModal } from "./WorkItemModal";
import { CloneWorkItemModal } from "./CloneWorkItemModal";
import { DependenciesModal } from "./DependenciesModal";
import { NodeTasksModal } from "./NodeTasksModal";
import { StructureTaskRow } from "./StructureTaskRow";
import { TaskDetailModal } from "./TaskDetailModal";
import type { ProjectMember, Task, Team, TipoNodo, WorkItemTree } from "../../types/api.types";

function nodeMatches(node: WorkItemTree, query: string, tasksByItem: Map<string, Task[]>): boolean {
  if (node.nombre.toLowerCase().includes(query)) {
    return true;
  }
  // Las tareas se ven en el árbol, así que también se buscan en él: si no,
  // buscar «Guion» no encontraría nada aunque esté ahí delante.
  return (tasksByItem.get(node.id) ?? []).some((t) => t.title.toLowerCase().includes(query));
}

/** ids de todos los nodos que tienen hijos (para "colapsar todo"). */
/** Poda el árbol a los nodos que coinciden con la búsqueda o tienen un
 * descendiente que coincide. Los ancestros de un match quedan siempre
 * visibles: el llamador fuerza su expansión mientras hay búsqueda activa. */
function pruneForSearch(
  nodes: WorkItemTree[],
  query: string,
  tasksByItem: Map<string, Task[]>,
): WorkItemTree[] {
  const result: WorkItemTree[] = [];
  for (const node of nodes) {
    const children = pruneForSearch(node.children, query, tasksByItem);
    if (nodeMatches(node, query, tasksByItem) || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

/** Nº de descendientes (sub-elementos, nietos… y sus tareas) de un nodo. Se
 * muestra en los nodos colapsados para saber cuánto contenido queda oculto en
 * árboles grandes. Las tareas cuentan porque también se pliegan con el nodo. */
function descendantCount(node: WorkItemTree, tasksByItem?: Map<string, Task[]>): number {
  const ownTasks = tasksByItem?.get(node.id)?.length ?? 0;
  return node.children.reduce(
    (total, child) => total + 1 + descendantCount(child, tasksByItem),
    ownTasks,
  );
}

/** Nº total de elementos en una lista de árboles (raíces + descendientes).
 * Sin el mapa de tareas: es el número que acompaña a «N elementos» en la barra
 * de herramientas, que cuenta estructura, no trabajo. */
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
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // Altura aproximada del menú (ítems + padding). Si no cabe debajo del
      // botón (fila cerca del borde inferior de la ventana, ej. al hacer
      // scroll hasta el final de la lista), lo abrimos hacia arriba en vez de
      // dejarlo renderizar fuera del viewport (donde queda inalcanzable).
      const estimatedHeight = actions.length * 34 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
      setPos({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
        right: window.innerWidth - rect.right,
      });
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
            style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
            className="z-50 flex max-h-[70vh] w-48 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 dark:border-slate-700 dark:bg-slate-900"
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

function DateBadge({
  node,
  containerName,
  onResolveConflict,
}: {
  node: WorkItemTree;
  /** Nombre del elemento que lo contiene, para el aviso (no decimos "padre"). */
  containerName: string | null;
  onResolveConflict: () => void;
}) {
  const hasRange = node.fecha_inicio_plan ?? node.fecha_fin_plan;
  if (!hasRange && node.duracion_valor == null) {
    return (
      <span className="text-[11px] italic text-slate-300 dark:text-slate-600">sin fechas</span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      {hasRange && (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            // Termina más tarde que su padre: el rango se marca en rojo, pero
            // el elemento se queda donde está. Cuadrar las fechas es una
            // decisión de planificación, no un requisito para reorganizar.
            node.conflicto_fechas
              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {formatShortDate(node.fecha_inicio_plan)} → {formatShortDate(node.fecha_fin_plan)}
        </span>
      )}
      {node.conflicto_fechas && (
        <button
          type="button"
          onClick={onResolveConflict}
          title={
            containerName
              ? `«${node.nombre}» termina después que «${containerName}». Click para ajustar las fechas.`
              : `«${node.nombre}» termina más tarde de lo que lo contiene. Click para ajustar las fechas.`
          }
          aria-label={`Resolver conflicto de fechas de ${node.nombre}`}
          className="flex shrink-0 items-center rounded-md p-0.5 text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
        >
          <CalendarClock className="size-3.5" />
        </button>
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
  /** Nombre del elemento que contiene a este (null en el nivel principal). */
  containerName: string | null;
  typeNameById: Map<string, string>;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onAddChild: (parent: WorkItemTree) => void;
  onEdit: (node: WorkItemTree) => void;
  onDeps: (node: WorkItemTree) => void;
  onClone: (node: WorkItemTree) => void;
  onDelete: (node: WorkItemTree) => void;
  onTasks: (node: WorkItemTree) => void;
  onResolveConflict: (node: WorkItemTree) => void;
  onOutdent: (node: WorkItemTree) => void;
  onCreateTask: (node: WorkItemTree) => void;
  onBulkTasks: (node: WorkItemTree) => void;
  /** Tareas colgadas de cada elemento, ya agrupadas por el panel. */
  tasksByItem: Map<string, Task[]>;
  memberById: Map<string, ProjectMember>;
  teamById: Map<string, Team>;
  onOpenTask: (task: Task, containerName: string) => void;
  // ── Drag & drop para recolocar nodos ──
  draggingId: string | null;
  /** Mismo id que `draggingId`, pero escrito de forma síncrona al empezar a
   * arrastrar: el estado de React puede llegar tarde al primer `dragover`. */
  draggingIdRef: React.RefObject<string | null>;
  dropTarget: { id: string; pos: DropPos } | null;
  invalidDropIds: Set<string>;
  onDragStartNode: (id: string) => void;
  onDragEndNode: () => void;
  onDragOverNode: (id: string, pos: DropPos) => void;
  onDropNode: (id: string, pos: DropPos) => void;
}

function TreeNode({
  node,
  depth,
  containerName,
  typeNameById,
  isExpanded,
  onToggle,
  onAddChild,
  onEdit,
  onDeps,
  onClone,
  onDelete,
  onTasks,
  onResolveConflict,
  onOutdent,
  onCreateTask,
  onBulkTasks,
  tasksByItem,
  memberById,
  teamById,
  onOpenTask,
  draggingId,
  draggingIdRef,
  dropTarget,
  invalidDropIds,
  onDragStartNode,
  onDragEndNode,
  onDragOverNode,
  onDropNode,
}: TreeNodeProps) {
  const open = isExpanded(node.id);
  const style = tipoStyle(node.tipo_id, typeNameById.get(node.tipo_id));
  // Las tareas del elemento son hijas suyas en el árbol, igual que los
  // elementos: se pliegan con la misma flecha y cuentan para saber si hay algo
  // dentro. Un módulo sin sub-elementos pero con tareas ya no se ve vacío.
  const tasks = tasksByItem.get(node.id) ?? [];
  const hasChildren = node.children.length > 0 || tasks.length > 0;
  const pct =
    node.porcentaje_completado != null ? Math.round(node.porcentaje_completado * 100) : null;
  // ¿Este nodo es un destino de suelta válido, y en qué zona?
  const isDragging = draggingId === node.id;
  const isInvalidTarget = draggingId != null && !isDragging && invalidDropIds.has(node.id);
  const dropPos =
    dropTarget?.id === node.id && draggingId != null && !invalidDropIds.has(node.id)
      ? dropTarget.pos
      : null;

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
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          // Firefox exige datos en el dataTransfer para iniciar el arrastre.
          e.dataTransfer.setData("text/plain", node.id);
          onDragStartNode(node.id);
        }}
        onDragEnd={onDragEndNode}
        onDragOver={(e) => {
          // Solo permitimos soltar en destinos válidos (evita el cursor "no-drop"
          // sobre uno mismo o un descendiente).
          //
          // El "¿hay algo arrastrándose?" se consulta al REF, no al estado:
          // React puede no haber re-renderizado todavía cuando llega el primer
          // dragover, y sin `preventDefault()` el navegador marca la fila como
          // destino inválido. Eso rompía justo las filas más cercanas al punto
          // donde empieza el arrastre (las primeras del árbol, típicamente).
          if (draggingIdRef.current == null || invalidDropIds.has(node.id)) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          onDragOverNode(node.id, dropPosFromEvent(e));
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropNode(node.id, dropPosFromEvent(e));
        }}
        className={cn(
          "group relative flex select-none items-center gap-2.5 py-2.5 pr-4 pl-2 transition-colors hover:bg-accent/40",
          isDragging && "opacity-40",
          // Mientras se arrastra, el propio subárbol se atenúa: se ve de
          // inmediato qué filas no admiten la suelta, sin tener que intentarlo.
          isInvalidTarget && "opacity-50",
          dropPos === "inside" && "rounded-lg ring-2 ring-inset ring-brand-teal bg-brand-teal/5",
        )}
      >
        {/* Indicadores de reordenamiento (soltar antes/después como hermano). */}
        {dropPos === "before" && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-brand-teal" aria-hidden />
        )}
        {dropPos === "after" && (
          <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-brand-teal" aria-hidden />
        )}
        <GripVertical
          className="size-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
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
            title={`${descendantCount(node, tasksByItem)} elementos y tareas dentro`}
          >
            {descendantCount(node, tasksByItem)}
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
          <DateBadge
            node={node}
            containerName={containerName}
            onResolveConflict={() => {
              onResolveConflict(node);
            }}
          />
          {/* Acciones rápidas (editar/eliminar) visibles al hover, además del
              menú kebab con el resto de opciones. */}
          <button
            onClick={() => {
              onEdit(node);
            }}
            title="Editar tipo y datos del elemento"
            aria-label={`Editar ${node.nombre}`}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-blue/10 hover:text-brand-blue-dark group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => {
              onDelete(node);
            }}
            title="Eliminar elemento"
            aria-label={`Eliminar ${node.nombre}`}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
          >
            <Trash2 className="size-3.5" />
          </button>
          {/* Sacar un nivel: acción rápida visible en CADA fila (además del
              menú). Con cientos de elementos, cualquier cosa que viva solo en
              la cabecera de la lista queda inalcanzable desde el final del
              scroll; la salida tiene que estar en el propio elemento.
              Se lleva consigo todo su contenido. */}
          {node.parent_id != null && (
            <button
              onClick={() => {
                onOutdent(node);
              }}
              title={
                containerName
                  ? `Sacar de «${containerName}», con todo su contenido`
                  : "Sacar un nivel, con todo su contenido"
              }
              aria-label={`Sacar ${node.nombre} un nivel`}
              className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-teal/10 hover:text-brand-teal-dark group-hover:opacity-100 dark:hover:text-brand-teal"
            >
              <CornerLeftUp className="size-3.5" />
            </button>
          )}
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
                label: "Ordenar (dependencias)",
                icon: Link2,
                onClick: () => {
                  onDeps(node);
                },
              },
              {
                // Atajo al caso habitual: el elemento de la estructura ES la
                // tarea que alguien tiene que hacer (un video, un guion). Abre
                // el alta con el nombre ya puesto, para asignarla y poco más.
                label: "Crear tarea de este elemento",
                icon: ListPlus,
                onClick: () => {
                  onCreateTask(node);
                },
              },
              // Solo con contenido: sobre una pieza suelta ya está "Crear tarea
              // de este elemento", que hace justo eso sin preguntar nada.
              ...(node.children.length > 0
                ? [
                    {
                      label: "Crear tareas de toda la rama",
                      icon: ListPlus,
                      onClick: () => {
                        onBulkTasks(node);
                      },
                    },
                  ]
                : []),
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
              containerName={node.nombre}
              typeNameById={typeNameById}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeps={onDeps}
              onClone={onClone}
              onDelete={onDelete}
              onTasks={onTasks}
              onResolveConflict={onResolveConflict}
              onOutdent={onOutdent}
              onCreateTask={onCreateTask}
              onBulkTasks={onBulkTasks}
              draggingId={draggingId}
              draggingIdRef={draggingIdRef}
              dropTarget={dropTarget}
              invalidDropIds={invalidDropIds}
              onDragStartNode={onDragStartNode}
              onDragEndNode={onDragEndNode}
              onDragOverNode={onDragOverNode}
              onDropNode={onDropNode}
              tasksByItem={tasksByItem}
              memberById={memberById}
              teamById={teamById}
              onOpenTask={onOpenTask}
            />
          ))}
          {/* Las tareas van DESPUÉS de los sub-elementos: primero se lee cómo
              se descompone el elemento y al final qué trabajo concreto cuelga
              directamente de él. */}
          {tasks.map((task) => (
            <StructureTaskRow
              key={task.id}
              task={task}
              memberById={memberById}
              teamById={teamById}
              onOpen={() => {
                onOpenTask(task, node.nombre);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Chip de un tipo de nodo. Al hacer click revela lápiz/basura para renombrar o
 * eliminarlo; un segundo click (o un click fuera) los oculta. No filtra el
 * árbol: es solo gestión del catálogo (el filtro por tipo vive en el Cronograma). */
function TypeChip({
  tipo,
  onRename,
  onRequestDelete,
}: {
  tipo: TipoNodo;
  onRename: (nombre: string) => Promise<void>;
  onRequestDelete: () => void;
}) {
  const style = tipoStyle(tipo.id, tipo.nombre);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tipo.nombre);
  const [saving, setSaving] = useState(false);
  // Editar/eliminar solo aparecen al hacer click en el chip; un segundo click o
  // un click fuera los oculta de nuevo.
  const [showActions, setShowActions] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed === tipo.nombre) {
      setEditing(false);
      setName(tipo.nombre);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={name}
          disabled={saving}
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void save();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setName(tipo.nombre);
            }
          }}
          className="w-28 rounded-full border border-border bg-background px-3 py-1 text-[12.5px] outline-none focus:border-brand-blue"
        />
        <button
          onClick={() => void save()}
          disabled={saving}
          className="text-[12.5px] font-bold text-brand-teal hover:text-brand-teal-dark hover:underline disabled:opacity-50"
        >
          ok
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setName(tipo.nombre);
          }}
          className="text-[12.5px] text-muted-foreground hover:underline"
        >
          cancelar
        </button>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative flex items-center gap-1 rounded-full border-[1.5px] pl-3 pr-1 py-1 text-[12.5px] font-bold",
        style.chip,
        showActions ? "border-current" : "border-transparent",
      )}
    >
      {showActions && (
        <button
          type="button"
          aria-label="Cerrar acciones del tipo"
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => {
            setShowActions(false);
          }}
        />
      )}
      <button
        type="button"
        onClick={() => {
          setShowActions((prev) => !prev);
        }}
        title="Editar o eliminar este tipo"
        className="relative z-50"
      >
        {tipo.nombre}
      </button>
      {showActions && (
        <>
          <button
            type="button"
            onClick={() => {
              setShowActions(false);
              setEditing(true);
            }}
            title={`Editar «${tipo.nombre}»`}
            aria-label={`Editar tipo ${tipo.nombre}`}
            className="relative z-50 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <Pencil className="size-2.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowActions(false);
              onRequestDelete();
            }}
            title={`Eliminar «${tipo.nombre}»`}
            aria-label={`Eliminar tipo ${tipo.nombre}`}
            className="relative z-50 rounded-full p-0.5 hover:bg-rose-500/20 hover:text-rose-600"
          >
            <Trash2 className="size-2.5" />
          </button>
        </>
      )}
    </span>
  );
}

/** Tipo reservado para el trabajo que hace un tercero y del que dependen los
 * elementos que se le cuelguen. Se crea a demanda con un botón dedicado. */
const THIRD_PARTY_TIPO = "Actividad de terceros";

function NodeTypesBar({ projectId, types }: { projectId: string; types: TipoNodo[] }) {
  const createType = useCreateNodeType(projectId);
  const updateType = useUpdateNodeType(projectId);
  const deleteType = useDeleteNodeType(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TipoNodo | null>(null);

  const hasThirdParty = types.some(
    (t) => t.nombre.trim().toLowerCase() === THIRD_PARTY_TIPO.toLowerCase(),
  );

  // Cierra el input y descarta lo tecleado: vuelve al estado "sin añadir".
  function cancel() {
    setName("");
    setAdding(false);
  }

  async function add() {
    // "nuevo" + ok sin escribir nada no es un error: es cancelar la operación.
    if (name.trim().length < 1) {
      cancel();
      return;
    }
    await createType.mutateAsync({ nombre: name.trim() });
    cancel();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
        <Tag className="size-3" /> Tipos
      </span>
      {types.map((t) => (
        <TypeChip
          key={t.id}
          tipo={t}
          onRename={async (nombre) => {
            await updateType.mutateAsync({ typeId: t.id, payload: { nombre } });
          }}
          onRequestDelete={() => {
            setDeleteTarget(t);
          }}
        />
      ))}
      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar tipo"
          message={`Se eliminará el tipo «${deleteTarget.nombre}». Los elementos que ya lo usan lo perderán (se mostrarán como "elemento" genérico). ¿Continuar?`}
          confirmLabel="Eliminar"
          destructive
          loading={deleteType.isPending}
          errorMessage={
            deleteType.isError
              ? getErrorMessage(deleteType.error, "No se pudo eliminar el tipo")
              : null
          }
          onConfirm={() => {
            deleteType.mutate(deleteTarget.id, {
              onSuccess: () => {
                setDeleteTarget(null);
              },
            });
          }}
          onCancel={() => {
            setDeleteTarget(null);
          }}
        />
      )}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void add();
              }
              if (e.key === "Escape") {
                cancel();
              }
            }}
            placeholder="Ej. Fase"
            className="w-24 rounded-full border border-border bg-background px-3 py-1 text-[12.5px] outline-none focus:border-brand-blue"
          />
          <button
            onClick={() => void add()}
            className="text-[12.5px] font-bold text-brand-teal hover:text-brand-teal-dark hover:underline"
          >
            ok
          </button>
          <button onClick={cancel} className="text-[12.5px] text-muted-foreground hover:underline">
            cancelar
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

      {/* Atajo: crea el tipo «Actividad de terceros» (una vez por proyecto).
          Después se añaden elementos de ese tipo y se enlazan como dependencia
          con el editor de dependencias normal. */}
      {!hasThirdParty && (
        <button
          onClick={() => {
            createType.mutate({ nombre: THIRD_PARTY_TIPO });
          }}
          disabled={createType.isPending}
          title="Crea un tipo para el trabajo que depende de un tercero"
          className="flex items-center gap-1 rounded-full border-[1.5px] border-dashed border-brand-blue/40 bg-transparent px-3 py-1 text-[12.5px] font-bold text-brand-blue transition-colors hover:border-brand-blue hover:bg-brand-blue/5 disabled:opacity-50"
        >
          <Plus className="size-3" /> añadir actividad de terceros
        </button>
      )}
    </div>
  );
}

/** Alta de una tarea a partir de un elemento de la estructura.
 *
 * Envuelve a `CreateTaskModal` solo para traer las tareas del proyecto (las
 * necesita el selector de dependencias). Al vivir en un componente que se monta
 * al abrir el modal, la Estructura no las pide mientras nadie las necesite.
 */
function CreateTaskFromNode({
  projectId,
  node,
  onClose,
}: {
  projectId: string;
  node: WorkItemTree;
  onClose: () => void;
}) {
  const tasksQuery = useProjectTasks(projectId);
  return (
    <CreateTaskModal
      projectId={projectId}
      tasks={tasksQuery.data ?? []}
      initialWorkItemId={node.id}
      initialTitle={node.nombre}
      onClose={onClose}
    />
  );
}

export function StructurePanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const treeQuery = useWorkTree(projectId);
  const typesQuery = useNodeTypes(projectId);
  const deleteItem = useDeleteWorkItem(projectId);
  const moveItem = useMoveWorkItem(projectId);
  const [modalParent, setModalParent] = useState<WorkItemTree | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<WorkItemTree | null>(null);
  const [depsItem, setDepsItem] = useState<WorkItemTree | null>(null);
  const [cloneSource, setCloneSource] = useState<WorkItemTree | null>(null);
  const [tasksNode, setTasksNode] = useState<WorkItemTree | null>(null);
  // Elemento del que se está creando una tarea directamente (sin pasar por la
  // lista de tareas del elemento).
  const [taskFromNode, setTaskFromNode] = useState<WorkItemTree | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  // Rama sobre la que se está creando trabajo en bloque.
  const [bulkTasksNode, setBulkTasksNode] = useState<WorkItemTree | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkItemTree | null>(null);
  // Elemento cuyo conflicto de fechas se está resolviendo (termina después que
  // su padre). Se guarda el nodo; el padre se busca en el árbol al renderizar.
  const [conflictItem, setConflictItem] = useState<WorkItemTree | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  // Tarea cuya ficha se está viendo, junto al elemento del que cuelga (el nodo
  // ya se conoce en el punto del árbol donde se pulsa; buscarlo otra vez aquí
  // sería recorrer el árbol para un dato que ya teníamos).
  const [openTask, setOpenTask] = useState<{ task: Task; containerName: string } | null>(null);

  const [search, setSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  // Drag & drop para recolocar nodos: reordenar entre hermanos (before/after) o
  // anidar dentro de otro (inside).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPos } | null>(null);

  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    types.forEach((t) => map.set(t.id, t.nombre));
    return map;
  }, [types]);

  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  // ── Tareas como parte del árbol ─────────────────────────────────────────
  // El árbol de elementos y las tareas viven en endpoints distintos (son
  // agregados distintos en el backend); se cruzan aquí, en la vista, por
  // `work_item_id`. Las sueltas (`work_item_id === null`) no aparecen en la
  // estructura: no cuelgan de ningún elemento, se ven en la vista de Tareas.
  const tasksQuery = useProjectTasks(projectId);
  const membersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);

  const tasksByItem = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasksQuery.data ?? []) {
      if (!task.work_item_id) {
        continue;
      }
      const bucket = map.get(task.work_item_id);
      if (bucket) {
        bucket.push(task);
      } else {
        map.set(task.work_item_id, [task]);
      }
    }
    return map;
  }, [tasksQuery.data]);

  const memberById = useMemo(
    () => indexById(membersQuery.data ?? [], (m) => m.user_id),
    [membersQuery.data],
  );
  const teamById = useMemo(
    () => indexById(teamsQuery.data?.items ?? [], (t) => t.id),
    [teamsQuery.data],
  );

  const query = search.trim().toLowerCase();
  const visibleTree = useMemo(() => {
    if (!query) {
      return tree;
    }
    return pruneForSearch(tree, query, tasksByItem);
  }, [tree, query, tasksByItem]);

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

  function openAdd(parent: WorkItemTree | null) {
    setModalParent(parent);
    setModalOpen(true);
  }

  function handleDelete(node: WorkItemTree) {
    setDeleteTarget(node);
  }

  // Destinos inválidos mientras se arrastra: el propio nodo y sus descendientes
  // (soltarlo ahí crearía un ciclo). Vacío cuando no se arrastra nada.
  const invalidDropIds = useMemo(() => {
    const empty = new Set<string>();
    if (!draggingId) {
      return empty;
    }
    const dragged = findNode(tree, draggingId);
    return dragged ? subtreeIds(dragged) : empty;
  }, [draggingId, tree]);

  // Contenedor scrollable del árbol: se auto-desplaza al arrastrar cerca de sus
  // bordes, para poder alcanzar un destino que quedó fuera de la vista.
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  useDragAutoScroll(treeScrollRef, draggingId != null);

  // Apertura automática al posarse sobre un elemento plegado ("spring-loaded"):
  // sin esto, para soltar algo dentro de una rama cerrada habría que abrirla
  // antes, soltando el arrastre a mitad de camino.
  const springRef = useRef<{ id: string; timer: number } | null>(null);

  function cancelSpringOpen() {
    if (springRef.current) {
      clearTimeout(springRef.current.timer);
      springRef.current = null;
    }
  }

  function scheduleSpringOpen(id: string, pos: DropPos) {
    if (springRef.current?.id === id) {
      return;
    }
    cancelSpringOpen();
    const node = findNode(tree, id);
    if (pos !== "inside" || !node || node.children.length === 0 || isExpanded(id)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      springRef.current = null;
    }, 600);
    springRef.current = { id, timer };
  }

  function startDrag(id: string) {
    draggingIdRef.current = id;
    setDraggingId(id);
  }

  function resetDrag() {
    cancelSpringOpen();
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  /** Suelta el nodo arrastrado sobre `targetId`, reordenando (before/after entre
   * hermanos) o anidando (inside). Las reglas (qué destino es válido y en qué
   * índice cae) viven en `resolveDrop`, compartidas con el Gantt. */
  function handleDropOn(targetId: string, pos: DropPos) {
    const itemId = draggingId;
    resetDrag();
    if (!itemId) {
      return;
    }
    const decision = resolveDrop(tree, itemId, targetId, pos);
    if (!decision) {
      return;
    }
    if (!decision.ok) {
      setMoveError(decision.reason);
      return;
    }
    setMoveError(null);
    moveItem.mutate(
      { itemId, payload: decision.payload },
      {
        onError: (err) => {
          setMoveError(getErrorMessage(err, "No se pudo mover el elemento"));
        },
      },
    );
  }

  /** Saca un elemento de donde está y lo deja junto a su antiguo contenedor.
   * Misma operación que arrastrarlo fuera, pero sin arrastrar: con estructuras
   * grandes es la forma cómoda de deshacer un anidado equivocado. */
  function handleOutdent(node: WorkItemTree) {
    const payload = computeOutdentPayload(tree, node.id);
    if (!payload) {
      return;
    }
    setMoveError(null);
    moveItem.mutate(
      { itemId: node.id, payload },
      {
        onError: (err) => {
          setMoveError(getErrorMessage(err, "No se pudo mover el elemento"));
        },
      },
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar: buscador, colapsar-expandir todo, + añadir, ir al cronograma */}
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

        <button
          type="button"
          onClick={() => {
            setCollapsedIds((prev) =>
              prev.size > 0 ? new Set() : new Set(collapsibleIdsBelowRoot(tree)),
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

        {totalCount > 0 && (
          <span className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <FolderTree className="size-3.5" />
            {query ? `${visibleCount} de ${totalCount}` : totalCount}
            <span className="font-normal">{totalCount === 1 ? "elemento" : "elementos"}</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Acceso directo al cronograma (misma navegación que la card de
              secciones del proyecto). */}
          <button
            type="button"
            onClick={() => {
              setShowTrash(true);
            }}
            title="Ver y restaurar elementos borrados"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Trash2 className="size-4 text-muted-foreground" /> Papelera
          </button>
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}/gantt`)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <GanttChartSquare className="size-4 text-brand-teal" /> Cronograma
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

      <NodeTypesBar projectId={projectId} types={types} />

      {moveError && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">{moveError}</p>
          <button
            type="button"
            onClick={() => {
              setMoveError(null);
            }}
            aria-label="Cerrar aviso"
            className="rounded-md p-0.5 text-rose-500 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/40"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

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
      ) : (
        <Card className="flex min-h-[400px] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <CardContent ref={treeScrollRef} className="flex flex-1 flex-col overflow-y-auto p-0">
            {visibleTree.map((node, idx) => (
              <div key={node.id} className={cn(idx > 0 && "border-t border-accent/60")}>
                <TreeNode
                  node={node}
                  depth={0}
                  containerName={null}
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
                  onResolveConflict={(n) => {
                    setConflictItem(n);
                  }}
                  onOutdent={handleOutdent}
                  onCreateTask={(n) => {
                    setTaskFromNode(n);
                  }}
                  onBulkTasks={(n) => {
                    setBulkTasksNode(n);
                  }}
                  draggingId={draggingId}
                  draggingIdRef={draggingIdRef}
                  dropTarget={dropTarget}
                  invalidDropIds={invalidDropIds}
                  onDragStartNode={startDrag}
                  onDragEndNode={resetDrag}
                  onDragOverNode={(id, pos) => {
                    // `dragover` se dispara decenas de veces por segundo sobre la
                    // misma fila; sin este guardado cada uno re-renderiza el
                    // árbol entero y el arrastre se siente con lag.
                    setDropTarget((prev) =>
                      prev?.id === id && prev.pos === pos ? prev : { id, pos },
                    );
                    scheduleSpringOpen(id, pos);
                  }}
                  onDropNode={handleDropOn}
                  tasksByItem={tasksByItem}
                  memberById={memberById}
                  teamById={teamById}
                  onOpenTask={(task, containerName) => {
                    setOpenTask({ task, containerName });
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showTrash && (
        <TrashModal
          projectId={projectId}
          onClose={() => {
            setShowTrash(false);
          }}
        />
      )}

      {bulkTasksNode && (
        <BulkTasksFromBranchModal
          projectId={projectId}
          node={bulkTasksNode}
          onClose={() => {
            setBulkTasksNode(null);
          }}
        />
      )}

      {taskFromNode && (
        <CreateTaskFromNode
          projectId={projectId}
          node={taskFromNode}
          onClose={() => {
            setTaskFromNode(null);
          }}
        />
      )}

      {/* Conflicto de fechas: el elemento termina después que su padre. Solo
          tiene sentido con un padre real (en la raíz no hay contra qué medir). */}
      {conflictItem?.parent_id != null &&
        (() => {
          const parent = findNode(tree, conflictItem.parent_id);
          if (!parent) {
            return null;
          }
          return (
            <DateConflictModal
              projectId={projectId}
              item={conflictItem}
              container={parent}
              onClose={() => {
                setConflictItem(null);
              }}
            />
          );
        })()}

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
          parent={editItem.parent_id ? findNode(tree, editItem.parent_id) : null}
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

      {openTask && (
        <TaskDetailModal
          projectId={projectId}
          task={openTask.task}
          containerName={openTask.containerName}
          memberById={memberById}
          teamById={teamById}
          onClose={() => {
            setOpenTask(null);
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

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar elemento"
          message={`Se eliminará “${deleteTarget.nombre}” y todo su contenido (elementos y tareas dentro de él). Esta acción no se puede deshacer. ¿Continuar?`}
          confirmLabel="Eliminar"
          destructive
          loading={deleteItem.isPending}
          errorMessage={
            deleteItem.isError
              ? getErrorMessage(deleteItem.error, "No se pudo eliminar el elemento")
              : null
          }
          onConfirm={() => {
            deleteItem.mutate(deleteTarget.id, {
              onSuccess: () => {
                setDeleteTarget(null);
              },
            });
          }}
          onCancel={() => {
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
