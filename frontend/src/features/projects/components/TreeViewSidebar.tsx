import type { MouseEvent } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Briefcase,
  FolderOpen,
  Folder,
  BookOpen,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { BuilderNode, NodeType, ProjectFormData } from "../types";
import { NODE_CHILD_TYPE, NODE_TYPE_LABELS } from "../types";

// ── helpers ────────────────────────────────────────────────────────────────

export function getChildren(nodes: BuilderNode[], parentId: string | null): BuilderNode[] {
  return nodes.filter((n) => n.parent_id === parentId);
}

export function getAllDescendantIds(nodes: BuilderNode[], nodeId: string): string[] {
  const children = getChildren(nodes, nodeId);
  return children.flatMap((c) => [c.id, ...getAllDescendantIds(nodes, c.id)]);
}

// ── sub-components ──────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  title,
  variant,
  children,
}: {
  onClick: (e: MouseEvent) => void;
  title: string;
  variant: "add" | "delete";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded transition-colors duration-150",
        variant === "add"
          ? "text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
          : "text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400",
      )}
    >
      {children}
    </button>
  );
}

// ── recursive tree node ────────────────────────────────────────────────────

interface TreeNodeProps {
  node: BuilderNode;
  nodes: BuilderNode[];
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddChild: (parentId: string, nodeType: NodeType) => void;
  onDelete: (id: string) => void;
}

function TreeNode({
  node,
  nodes,
  depth,
  selectedId,
  expanded,
  onSelect,
  onToggleExpand,
  onAddChild,
  onDelete,
}: TreeNodeProps) {
  const children = getChildren(nodes, node.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const childType = NODE_CHILD_TYPE[node.node_type];

  const OpenIcon =
    node.node_type === "programa" ? FolderOpen : node.node_type === "curso" ? BookOpen : FileText;
  const ClosedIcon =
    node.node_type === "programa" ? Folder : node.node_type === "curso" ? BookOpen : FileText;
  const Icon = isExpanded ? OpenIcon : ClosedIcon;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-150",
          isSelected
            ? "bg-blue-50 dark:bg-blue-600/15"
            : "hover:bg-slate-100 dark:hover:bg-slate-800/50",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(node.id);
        }}
      >
        {/* Expand/collapse */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
          aria-label={isExpanded ? "Colapsar" : "Expandir"}
          className={cn(
            "shrink-0 transition-colors duration-150",
            hasChildren
              ? "text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
              : "invisible pointer-events-none",
          )}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>

        {/* Type icon */}
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
          )}
        />

        {/* Label */}
        <span
          className={cn(
            "flex-1 truncate text-[13px]",
            isSelected
              ? "font-medium text-blue-700 dark:text-blue-300"
              : "text-slate-700 dark:text-slate-300",
            !node.name && "italic opacity-60",
          )}
        >
          {node.name || `${NODE_TYPE_LABELS[node.node_type]} sin nombre`}
        </span>

        {/* Action buttons — appear on hover */}
        <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {childType && (
            <ActionBtn
              variant="add"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id, childType);
              }}
              title={`Añadir ${NODE_TYPE_LABELS[childType]}`}
            >
              <Plus className="size-3" />
            </ActionBtn>
          )}
          <ActionBtn
            variant="delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            title="Eliminar nodo"
          >
            <Trash2 className="size-3" />
          </ActionBtn>
        </div>
      </div>

      {/* Recursive children */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              nodes={nodes}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── main export ─────────────────────────────────────────────────────────────

export interface TreeViewSidebarProps {
  project: ProjectFormData;
  nodes: BuilderNode[];
  selectedId: string | null;
  expanded: Set<string>;
  onSelectProject: () => void;
  onSelectNode: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddRootNode: () => void;
  onAddChild: (parentId: string, nodeType: NodeType) => void;
  onDelete: (id: string) => void;
}

export function TreeViewSidebar({
  project,
  nodes,
  selectedId,
  expanded,
  onSelectProject,
  onSelectNode,
  onToggleExpand,
  onAddRootNode,
  onAddChild,
  onDelete,
}: TreeViewSidebarProps) {
  const rootNodes = getChildren(nodes, null);
  const isProjectSelected = selectedId === null;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b border-slate-100 pb-3 dark:border-slate-800">
        <CardTitle className="text-sm font-semibold">Estructura del proyecto</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-2">
        <div role="tree" className="flex flex-1 flex-col overflow-y-auto">
          {/* Project root row */}
          <div
            role="treeitem"
            aria-selected={isProjectSelected}
            className={cn(
              "group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-150",
              isProjectSelected
                ? "bg-blue-50 dark:bg-blue-600/15"
                : "hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
            onClick={onSelectProject}
          >
            {/* Spacer to align with tree nodes that have expand chevron */}
            <span className="invisible pointer-events-none size-3.5 shrink-0" />

            <Briefcase
              className={cn(
                "size-3.5 shrink-0",
                isProjectSelected
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400",
              )}
            />

            <span
              className={cn(
                "flex-1 truncate text-[13px]",
                isProjectSelected
                  ? "font-semibold text-blue-700 dark:text-blue-300"
                  : "font-medium text-slate-800 dark:text-slate-200",
                !project.name && "italic opacity-60",
              )}
            >
              {project.name || "Proyecto sin nombre"}
            </span>

            <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <ActionBtn
                variant="add"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddRootNode();
                }}
                title="Añadir Programa"
              >
                <Plus className="size-3" />
              </ActionBtn>
            </div>
          </div>

          {/* Recursive tree */}
          {rootNodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              nodes={nodes}
              depth={1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelectNode}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <FolderOpen className="size-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-[12px] text-slate-400 dark:text-slate-500">Sin nodos todavía</p>
              <button
                type="button"
                onClick={onAddRootNode}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
              >
                <Plus className="size-3" />
                Añadir primer programa
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
