import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { BuilderNode, ProjectFormData, ProjectMember } from "../types";
import type { Task } from "../gantt/types";
import type { TaskHistory } from "../gantt/traceability/types";

// ── types ──────────────────────────────────────────────────────────────────

export interface StoredProject {
  id: string;
  project: ProjectFormData;
  nodes: BuilderNode[];
  members: ProjectMember[];
  tasks: Task[];
  history: TaskHistory[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectsContextValue {
  projects: StoredProject[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  saveProject: (id: string, project: ProjectFormData, nodes: BuilderNode[]) => void;
  deleteProject: (id: string) => void;
  addMember: (projectId: string, member: ProjectMember) => void;
  removeMember: (projectId: string, memberId: string) => void;
  setTasks: (projectId: string, tasks: Task[]) => void;
  addHistoryEntry: (projectId: string, entry: TaskHistory) => void;
}

// ── internal ───────────────────────────────────────────────────────────────

const ProjectsContext = createContext<ProjectsContextValue | null>(null);
const STORAGE_KEY = "obj-projects";

function loadFromStorage(): StoredProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? (JSON.parse(raw) as StoredProject[]) : [];
    // Backward-compat: fill fields added in later iterations
    return data.map((p) => ({ members: [], tasks: [], history: [], ...p }));
  } catch {
    return [];
  }
}

function saveToStorage(projects: StoredProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

// ── provider ───────────────────────────────────────────────────────────────

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<StoredProject[]>(loadFromStorage);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    saveToStorage(projects);
  }, [projects]);

  const stamp = () => new Date().toISOString();

  const saveProject = (id: string, project: ProjectFormData, nodes: BuilderNode[]) => {
    const now = stamp();
    setProjects((prev) => {
      const exists = prev.find((p) => p.id === id);
      if (exists) {
        return prev.map((p) =>
          p.id === id ? { ...p, project, nodes, updatedAt: now } : p
        );
      }
      return [
        ...prev,
        { id, project, nodes, members: [], tasks: [], history: [], createdAt: now, updatedAt: now },
      ];
    });
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {setActiveProjectId(null);}
  };

  const addMember = (projectId: string, member: ProjectMember) => {
    const now = stamp();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, members: [...p.members, member], updatedAt: now }
          : p
      )
    );
  };

  const removeMember = (projectId: string, memberId: string) => {
    const now = stamp();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, members: p.members.filter((m) => m.id !== memberId), updatedAt: now }
          : p
      )
    );
  };

  const setTasks = (projectId: string, tasks: Task[]) => {
    const now = stamp();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, tasks, updatedAt: now } : p
      )
    );
  };

  const addHistoryEntry = (projectId: string, entry: TaskHistory) => {
    const now = stamp();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, history: [entry, ...p.history], updatedAt: now }
          : p
      )
    );
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        activeProjectId,
        setActiveProjectId,
        saveProject,
        deleteProject,
        addMember,
        removeMember,
        setTasks,
        addHistoryEntry,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

// ── hook ───────────────────────────────────────────────────────────────────

export function useProjectsContext(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {throw new Error("useProjectsContext must be used inside ProjectsProvider");}
  return ctx;
}
