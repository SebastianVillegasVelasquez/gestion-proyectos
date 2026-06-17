import { Plus, Copy, ClipboardPaste, Trash2, Layers, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_TYPE_LABELS, NODE_TYPE_DOT, nodeDisplayType } from "../../types/labels";
import { childrenOf } from "../../builder/tree-ops";
import type { BuilderState } from "../../builder/use-builder-state";
import type { DraftNode } from "../../builder/draft.types";

function IconButton({
  title,
  onClick,
  children,
  tone = "slate",
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "slate" | "red" | "blue";
}) {
  const toneCls =
    tone === "red"
      ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
      : tone === "blue"
        ? "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
        : "hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700";
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors",
        toneCls,
      )}
    >
      {children}
    </button>
  );
}

function NodeRow({ node, builder }: { node: DraftNode; builder: BuilderState }) {
  const children = childrenOf(builder.nodes, node.tempId);
  const isSelected = builder.selected?.kind === "node" && builder.selected.id === node.tempId;
  const childType = builder.suggestedChildType[node.node_type];

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          builder.setSelected({ kind: "node", id: node.tempId });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            builder.setSelected({ kind: "node", id: node.tempId });
          }
        }}
        className={cn(
          "group flex items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors",
          isSelected
            ? "bg-blue-50 dark:bg-blue-950/40"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
          "pl-2",
        )}
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", NODE_TYPE_DOT[node.node_type])} />
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {nodeDisplayType(node)}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            node.name ? "text-slate-700 dark:text-slate-200" : "italic text-slate-400",
          )}
        >
          {node.name || "Sin nombre"}
        </span>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            title={`Agregar ${NODE_TYPE_LABELS[childType]}`}
            tone="blue"
            onClick={() => {
              builder.addNode(node.phaseTempId ?? "", node.tempId, childType);
            }}
          >
            <Plus className="size-3.5" />
          </IconButton>
          <IconButton
            title="Copiar jerarquía"
            onClick={() => {
              builder.copyNode(node.tempId);
            }}
          >
            <Copy className="size-3.5" />
          </IconButton>
          {builder.clipboard && (
            <IconButton
              title="Pegar dentro"
              tone="blue"
              onClick={() => {
                builder.pasteInto(node.phaseTempId ?? "", node.tempId);
              }}
            >
              <ClipboardPaste className="size-3.5" />
            </IconButton>
          )}
          <IconButton
            title="Eliminar"
            tone="red"
            onClick={() => {
              builder.removeNode(node.tempId);
            }}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {children.length > 0 && (
        <div className="ml-3 border-l border-slate-100 pl-1 dark:border-slate-800">
          {children.map((child) => (
            <NodeRow key={child.tempId} node={child} builder={builder} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BuilderTree({ builder }: { builder: BuilderState }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Proyecto (raíz) */}
      <button
        type="button"
        onClick={() => {
          builder.setSelected({ kind: "project" });
        }}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold transition-colors",
          builder.selected?.kind === "project"
            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50",
        )}
      >
        <FolderKanban className="size-4 text-slate-400" />
        {builder.project.name || "Proyecto sin nombre"}
      </button>

      {/* Fases */}
      {builder.phases.map((phase) => {
        const roots = childrenOf(builder.nodes, null).filter((n) => n.phaseTempId === phase.tempId);
        const isSelected =
          builder.selected?.kind === "phase" && builder.selected.id === phase.tempId;
        return (
          <div key={phase.tempId} className="ml-1">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                builder.setSelected({ kind: "phase", id: phase.tempId });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  builder.setSelected({ kind: "phase", id: phase.tempId });
                }
              }}
              className={cn(
                "group mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                isSelected
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50",
              )}
            >
              <Layers className="size-3.5 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 truncate">{phase.name || "Fase sin nombre"}</span>
              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                <IconButton
                  title="Agregar Programa"
                  tone="blue"
                  onClick={() => {
                    builder.addNode(phase.tempId, null, "PROGRAMA");
                  }}
                >
                  <Plus className="size-3.5" />
                </IconButton>
                {builder.clipboard && (
                  <IconButton
                    title="Pegar jerarquía en esta fase"
                    tone="blue"
                    onClick={() => {
                      builder.pasteInto(phase.tempId, null);
                    }}
                  >
                    <ClipboardPaste className="size-3.5" />
                  </IconButton>
                )}
                <IconButton
                  title="Eliminar fase"
                  tone="red"
                  onClick={() => {
                    builder.removePhase(phase.tempId);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </div>

            <div className="ml-3 border-l border-slate-100 pl-1 dark:border-slate-800">
              {roots.length === 0 ? (
                <p className="px-2 py-1 text-xs italic text-slate-400">
                  Vacía — agrega un Programa
                </p>
              ) : (
                roots.map((node) => <NodeRow key={node.tempId} node={node} builder={builder} />)
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={builder.addPhase}
        className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-600"
      >
        <Plus className="size-3.5" /> Agregar fase
      </button>
    </div>
  );
}
