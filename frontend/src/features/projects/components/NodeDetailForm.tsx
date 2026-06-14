import { Briefcase, FolderOpen, BookOpen, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { BuilderNode, NodeType, ProjectFormData } from "../types";
import { NODE_TYPE_OPTIONS, NODE_TYPE_LABELS } from "../types";

// ── shared styles ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

// ── helpers ───────────────────────────────────────────────────────────────────

function getNodePath(nodes: BuilderNode[], nodeId: string): BuilderNode[] {
  const path: BuilderNode[] = [];
  let current: BuilderNode | undefined = nodes.find((n) => n.id === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? nodes.find((n) => n.id === current!.parent_id) : undefined;
  }
  return path;
}

const NODE_ICON: Record<NodeType, typeof FolderOpen> = {
  programa: FolderOpen,
  curso: BookOpen,
  modulo: FileText,
};

const PLACEHOLDER: Record<NodeType, string> = {
  programa: "Ej: Ingeniería de Sistemas",
  curso: "Ej: Fundamentos de Programación",
  modulo: "Ej: Introducción a variables",
};

// ── project form ─────────────────────────────────────────────────────────────

function ProjectFields({
  project,
  onChange,
}: {
  project: ProjectFormData;
  onChange: (patch: Partial<ProjectFormData>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className={labelCls}>Nombre del proyecto *</label>
        <input
          type="text"
          value={project.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
          placeholder="Ej: Programa Educativo 2025"
          className={inputCls}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Fecha de inicio</label>
          <input
            type="date"
            value={project.start_date}
            onChange={(e) => {
              onChange({ start_date: e.target.value });
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Fecha de fin</label>
          <input
            type="date"
            value={project.end_date}
            onChange={(e) => {
              onChange({ end_date: e.target.value });
            }}
            className={inputCls}
          />
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-900/60 dark:bg-blue-950/30">
        <p className="text-[12px] leading-relaxed text-blue-700 dark:text-blue-400">
          <span className="font-semibold">Tip:</span> Usa el árbol de la izquierda para añadir
          Programas, Cursos y Módulos. Al terminar, haz clic en{" "}
          <span className="font-semibold">"Guardar proyecto"</span> para enviar toda la estructura
          al servidor en un único POST.
        </p>
      </div>
    </div>
  );
}

// ── node form ─────────────────────────────────────────────────────────────────

function NodeFields({
  node,
  nodes,
  onChange,
}: {
  node: BuilderNode;
  nodes: BuilderNode[];
  onChange: (patch: Partial<Pick<BuilderNode, "name" | "node_type">>) => void;
}) {
  const path = getNodePath(nodes, node.id);
  const Icon = NODE_ICON[node.node_type];

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb path */}
      {path.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          {path.map((n, i) => {
            const PIcon = NODE_ICON[n.node_type];
            return (
              <span key={n.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="size-3 shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                <PIcon className="size-3 shrink-0 text-slate-400 dark:text-slate-500" />
                <span
                  className={cn(
                    "text-[11px]",
                    i === path.length - 1
                      ? "font-medium text-slate-700 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {n.name || `${NODE_TYPE_LABELS[n.node_type]} sin nombre`}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Current node type pill */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
          <Icon className="size-3.5 text-slate-500 dark:text-slate-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {NODE_TYPE_LABELS[node.node_type]}
          </span>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className={labelCls}>
          Nombre del {NODE_TYPE_LABELS[node.node_type].toLowerCase()} *
        </label>
        <input
          type="text"
          value={node.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
          placeholder={PLACEHOLDER[node.node_type]}
          className={inputCls}
          autoFocus
        />
      </div>

      {/* Type selector */}
      <div>
        <label className={labelCls}>Tipo de nodo</label>
        <select
          value={node.node_type}
          onChange={(e) => {
            onChange({ node_type: e.target.value as NodeType });
          }}
          className={inputCls}
        >
          {NODE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          Cambiar el tipo no afecta a los nodos hijos ya creados.
        </p>
      </div>
    </div>
  );
}

// ── empty panel ──────────────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <FileText className="size-6 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Selecciona un nodo para editar sus detalles
      </p>
    </div>
  );
}

// ── main export ───────────────────────────────────────────────────────────────

export interface NodeDetailFormProps {
  selectedId: string | null;
  project: ProjectFormData;
  nodes: BuilderNode[];
  onProjectChange: (patch: Partial<ProjectFormData>) => void;
  onNodeChange: (id: string, patch: Partial<Pick<BuilderNode, "name" | "node_type">>) => void;
}

export function NodeDetailForm({
  selectedId,
  project,
  nodes,
  onProjectChange,
  onNodeChange,
}: NodeDetailFormProps) {
  const isProjectSelected = selectedId === null;
  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;
  const Icon = selectedNode ? NODE_ICON[selectedNode.node_type] : null;

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="shrink-0 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {isProjectSelected ? (
            <>
              <Briefcase className="size-4 text-slate-500 dark:text-slate-400" />
              <CardTitle className="text-sm font-semibold">Detalles del proyecto</CardTitle>
            </>
          ) : selectedNode && Icon ? (
            <>
              <Icon className="size-4 text-slate-500 dark:text-slate-400" />
              <CardTitle className="text-sm font-semibold">
                Editar {NODE_TYPE_LABELS[selectedNode.node_type].toLowerCase()}
              </CardTitle>
            </>
          ) : (
            <CardTitle className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              Sin selección
            </CardTitle>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-y-auto pt-5">
        {isProjectSelected ? (
          <ProjectFields project={project} onChange={onProjectChange} />
        ) : selectedNode ? (
          <NodeFields
            node={selectedNode}
            nodes={nodes}
            onChange={(patch) => {
              onNodeChange(selectedNode.id, patch);
            }}
          />
        ) : (
          <EmptyPanel />
        )}
      </CardContent>
    </Card>
  );
}
