import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Save,
  CheckCircle,
  AlertCircle,
  Moon,
  Sun,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuilderNode, NodeType, ProjectFormData } from "../types";
import { useProjectsContext } from "../context/ProjectsContext";
import { getAllDescendantIds } from "./TreeViewSidebar";
import { TreeViewSidebar } from "./TreeViewSidebar";
import { NodeDetailForm } from "./NodeDetailForm";

type SaveStatus = "idle" | "saving" | "success" | "error";

const genId = () => crypto.randomUUID();

// ── project switcher (above tree) ──────────────────────────────────────────

function ProjectSwitcher({
  projects,
  activeId,
  onSwitch,
  onNew,
}: {
  projects: { id: string; name: string }[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
}) {
  const selectCls = cn(
    "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900",
    "outline-none transition-colors duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30",
    "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
  );

  return (
    <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
      {projects.length === 0 ? (
        <span className="flex-1 truncate text-[12px] italic text-slate-400 dark:text-slate-500">
          Nuevo proyecto
        </span>
      ) : (
        <select
          value={activeId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {onSwitch(val);}
          }}
          className={selectCls}
        >
          {activeId === null && (
            <option value="">Nuevo proyecto (sin guardar)</option>
          )}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "Sin nombre"}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={onNew}
        title="Nuevo proyecto"
        aria-label="Nuevo proyecto"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

// ── main layout ────────────────────────────────────────────────────────────

export interface ProjectBuilderLayoutProps {
  dark: boolean;
  onToggleDark: () => void;
}

export function ProjectBuilderLayout({ dark, onToggleDark }: ProjectBuilderLayoutProps) {
  const navigate = useNavigate();
  const { projects, activeProjectId, setActiveProjectId, saveProject } =
    useProjectsContext();

  // Local form state (edits are local; committed to context on save)
  const [project, setProject] = useState<ProjectFormData>({
    name: "",
    start_date: "",
    end_date: "",
  });
  const [nodes, setNodes] = useState<BuilderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [localId] = useState<string>(genId); // stable temp ID for unsaved projects
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Sync from context whenever activeProjectId changes
  useEffect(() => {
    const active = projects.find((p) => p.id === activeProjectId);
    if (active) {
      setProject(active.project);
      setNodes(active.nodes);
    } else {
      setProject({ name: "", start_date: "", end_date: "" });
      setNodes([]);
    }
    setSelectedId(null);
    setExpanded(new Set());
  }, [activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── node handlers ────────────────────────────────────────────────────────

  const addNode = (parentId: string | null, nodeType: NodeType) => {
    const newNode: BuilderNode = {
      id: `tmp_${genId()}`,
      name: "",
      node_type: nodeType,
      parent_id: parentId,
    };
    setNodes((prev) => [...prev, newNode]);
    if (parentId) {setExpanded((prev) => new Set([...prev, parentId]));}
    setSelectedId(newNode.id);
  };

  const deleteNode = (id: string) => {
    const descendantIds = getAllDescendantIds(nodes, id);
    const toDelete = new Set([id, ...descendantIds]);
    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
    setSelectedId((prev) => (prev !== null && toDelete.has(prev) ? null : prev));
  };

  const updateProject = (patch: Partial<ProjectFormData>) => {
    setProject((prev) => ({ ...prev, ...patch }));
  };

  const updateNode = (
    id: string,
    patch: Partial<Pick<BuilderNode, "name" | "node_type">>
  ) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── project switching ────────────────────────────────────────────────────

  const commitCurrent = () => {
    if (project.name.trim()) {
      const id = activeProjectId ?? localId;
      saveProject(id, project, nodes);
      if (!activeProjectId) {setActiveProjectId(id);}
    }
  };

  const handleSwitchProject = (id: string) => {
    commitCurrent();
    setActiveProjectId(id);
  };

  const handleNewProject = () => {
    commitCurrent();
    setActiveProjectId(null);
  };

  // ── save ─────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!project.name.trim()) {
      setErrorMsg("Nombre del proyecto requerido");
      setSaveStatus("error");
      setTimeout(() => { setSaveStatus("idle"); }, 3000);
      return;
    }

    setSaveStatus("saving");

    const id = activeProjectId ?? localId;
    saveProject(id, project, nodes);
    if (!activeProjectId) {setActiveProjectId(id);}

    console.log("Proyecto guardado →", {
      id,
      project: { ...project, progress_pct: 0 },
      nodes,
    });

    setTimeout(() => {
      setSaveStatus("success");
      setTimeout(() => { setSaveStatus("idle"); }, 2500);
    }, 400);
  };

  // ── project list for switcher ─────────────────────────────────────────────

  const projectsForSwitcher = projects.map((p) => ({
    id: p.id,
    name: p.project.name,
  }));

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { commitCurrent(); navigate("/projects"); }}
            title="Ver todos los proyectos"
            aria-label="Volver a todos los proyectos"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
              Constructor de proyectos
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Define la estructura jerárquica antes de guardar
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60",
              saveStatus === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400"
                : saveStatus === "error"
                  ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            )}
          >
            {saveStatus === "success" ? (
              <><CheckCircle className="size-4" /> Guardado</>
            ) : saveStatus === "error" ? (
              <><AlertCircle className="size-4" /><span className="max-w-[140px] truncate">{errorMsg}</span></>
            ) : (
              <><Save className="size-4" /> Guardar proyecto</>
            )}
          </button>
        </div>
      </header>

      {/* Split pane */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Left: project switcher + tree */}
        <div className="flex h-72 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:h-80 lg:h-full lg:w-72 lg:shrink-0">
          <ProjectSwitcher
            projects={projectsForSwitcher}
            activeId={activeProjectId}
            onSwitch={handleSwitchProject}
            onNew={handleNewProject}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TreeViewSidebar
              project={project}
              nodes={nodes}
              selectedId={selectedId}
              expanded={expanded}
              onSelectProject={() => { setSelectedId(null); }}
              onSelectNode={setSelectedId}
              onToggleExpand={toggleExpand}
              onAddRootNode={() => { addNode(null, "programa"); }}
              onAddChild={addNode}
              onDelete={deleteNode}
            />
          </div>
        </div>

        {/* Right: detail form */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <NodeDetailForm
            selectedId={selectedId}
            project={project}
            nodes={nodes}
            onProjectChange={updateProject}
            onNodeChange={updateNode}
          />
        </div>
      </div>
    </div>
  );
}
