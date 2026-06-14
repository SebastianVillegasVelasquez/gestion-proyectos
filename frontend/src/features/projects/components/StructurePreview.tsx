import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  BookOpen,
  FileText,
  LayoutList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { BuilderNode, NodeType } from "../types";
import { NODE_TYPE_LABELS } from "../types";

// ── helpers ────────────────────────────────────────────────────────────────

function getChildren(nodes: BuilderNode[], parentId: string | null): BuilderNode[] {
  return nodes.filter((n) => n.parent_id === parentId);
}

const ICON_OPEN: Record<NodeType, typeof FolderOpen> = {
  programa: FolderOpen,
  curso: BookOpen,
  modulo: FileText,
};
const ICON_CLOSED: Record<NodeType, typeof Folder> = {
  programa: Folder,
  curso: BookOpen,
  modulo: FileText,
};

// ── recursive node ─────────────────────────────────────────────────────────

function PreviewNode({
  node,
  nodes,
  depth,
  expanded,
  onToggle,
}: {
  node: BuilderNode;
  nodes: BuilderNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = getChildren(nodes, node.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(node.id);

  const OpenIcon = ICON_OPEN[node.node_type];
  const ClosedIcon = ICON_CLOSED[node.node_type];
  const Icon = isExpanded ? OpenIcon : ClosedIcon;

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Expand indicator */}
        <span
          className={cn(
            "shrink-0 text-slate-300 dark:text-slate-600",
            !hasChildren && "invisible pointer-events-none"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>

        {/* Icon */}
        <Icon className="size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />

        {/* Name */}
        <span
          className={cn(
            "flex-1 truncate text-[13px] text-slate-700 dark:text-slate-300",
            !node.name && "italic opacity-50"
          )}
        >
          {node.name || `${NODE_TYPE_LABELS[node.node_type]} sin nombre`}
        </span>

        {/* Child count badge */}
        {hasChildren && (
          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {children.length}
          </span>
        )}
      </div>

      {isExpanded && children.map((child) => (
        <PreviewNode
          key={child.id}
          node={child}
          nodes={nodes}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

// ── main export ────────────────────────────────────────────────────────────

export function StructurePreview({ nodes }: { nodes: BuilderNode[] }) {
  // Start with all programas expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const programas = nodes.filter((n) => n.node_type === "programa").map((n) => n.id);
    return new Set(programas);
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const rootNodes = getChildren(nodes, null);

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <LayoutList className="size-4 text-slate-400 dark:text-slate-500" />
          <CardTitle className="text-sm font-semibold">Estructura del proyecto</CardTitle>
          {nodes.length > 0 && (
            <span className="ml-auto rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {nodes.length} nodos
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-y-auto p-2">
        {rootNodes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <FolderOpen className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              Sin estructura definida
            </p>
          </div>
        ) : (
          rootNodes.map((node) => (
            <PreviewNode
              key={node.id}
              node={node}
              nodes={nodes}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
