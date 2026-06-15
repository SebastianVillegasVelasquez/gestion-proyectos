import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { Plus, Trash2, Moon, Sun, Layers, FolderTree, Save } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { NODE_TYPE_LABELS } from "../types/labels";
import type { NodeType } from "../types/api.types";
import type { DraftNode, DraftPhase, DraftProject } from "../builder/draft.types";
import { useCreateProjectDraft } from "../builder/use-create-project-draft";

let seq = 0;
const tempId = () => `tmp-${(seq += 1)}`;

const NODE_TYPES: NodeType[] = ["PROGRAMA", "CURSO", "MODULO"];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20";

export function ProjectBuilderPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const { submit, isSubmitting, error } = useCreateProjectDraft();

  const [project, setProject] = useState<DraftProject>({
    name: "",
    description: "",
    client_name: "",
    start_date: "",
    end_date: "",
  });
  const [phases, setPhases] = useState<DraftPhase[]>([]);
  const [nodes, setNodes] = useState<DraftNode[]>([]);

  const setProjectField = (field: keyof DraftProject, value: string) => {
    setProject((p) => ({ ...p, [field]: value }));
  };

  const addPhase = () => {
    setPhases((p) => [
      ...p,
      { tempId: tempId(), name: "", duration_days: "", start_date: "", end_date: "" },
    ]);
  };
  const updatePhase = (id: string, field: keyof DraftPhase, value: string) => {
    setPhases((p) => p.map((ph) => (ph.tempId === id ? { ...ph, [field]: value } : ph)));
  };
  const removePhase = (id: string) => {
    setPhases((p) => p.filter((ph) => ph.tempId !== id));
    setNodes((n) => n.map((nd) => (nd.phaseTempId === id ? { ...nd, phaseTempId: null } : nd)));
  };

  const addNode = () => {
    setNodes((n) => [
      ...n,
      {
        tempId: tempId(),
        name: "",
        node_type: "PROGRAMA",
        type_label: "",
        phaseTempId: phases[0]?.tempId ?? null,
        parentTempId: null,
        end_date: "",
      },
    ]);
  };
  const updateNode = (id: string, field: keyof DraftNode, value: string | null) => {
    setNodes((n) => n.map((nd) => (nd.tempId === id ? { ...nd, [field]: value } : nd)));
  };
  const removeNode = (id: string) => {
    setNodes((n) =>
      n
        .filter((nd) => nd.tempId !== id)
        .map((nd) => (nd.parentTempId === id ? { ...nd, parentTempId: null } : nd)),
    );
  };

  const canSubmit = project.name.trim().length >= 2 && !isSubmitting;

  const handleSubmit = async () => {
    const id = await submit(project, phases, nodes);
    if (id) {
      void navigate(`/projects/${id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 lg:h-full lg:overflow-y-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Constructor de proyecto
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Define el proyecto, sus fases y la estructura de contenidos
          </p>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* 1. Datos del proyecto */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Nombre del proyecto *
            </span>
            <input
              className={inputCls}
              value={project.name}
              onChange={(e) => {
                setProjectField("name", e.target.value);
              }}
              placeholder="Diplomado en..."
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</span>
            <input
              className={inputCls}
              value={project.client_name}
              onChange={(e) => {
                setProjectField("client_name", e.target.value);
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Inicio</span>
              <input
                type="date"
                className={inputCls}
                value={project.start_date}
                onChange={(e) => {
                  setProjectField("start_date", e.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fin</span>
              <input
                type="date"
                className={inputCls}
                value={project.end_date}
                onChange={(e) => {
                  setProjectField("end_date", e.target.value);
                }}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 2. Fases */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Layers className="size-4 text-slate-400" /> Fases
          </h2>
          <button
            type="button"
            onClick={addPhase}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="size-3.5" /> Agregar fase
          </button>
        </div>
        {phases.length === 0 ? (
          <p className="text-sm italic text-slate-400 dark:text-slate-500">
            Sin fases. Las fases ordenan el flujo de trabajo del proyecto.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {phases.map((phase, idx) => (
              <Card key={phase.tempId}>
                <CardContent className="flex flex-wrap items-end gap-3 py-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {idx + 1}
                  </span>
                  <label className="flex min-w-[160px] flex-1 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Nombre</span>
                    <input
                      className={inputCls}
                      value={phase.name}
                      onChange={(e) => {
                        updatePhase(phase.tempId, "name", e.target.value);
                      }}
                      placeholder="Planeación"
                    />
                  </label>
                  <label className="flex w-28 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Duración (días)</span>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={phase.duration_days}
                      onChange={(e) => {
                        updatePhase(phase.tempId, "duration_days", e.target.value);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      removePhase(phase.tempId);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 3. Estructura */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <FolderTree className="size-4 text-slate-400" /> Estructura
          </h2>
          <button
            type="button"
            onClick={addNode}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="size-3.5" /> Agregar nodo
          </button>
        </div>
        {nodes.length === 0 ? (
          <p className="text-sm italic text-slate-400 dark:text-slate-500">
            Sin nodos. Agrega programas, cursos y módulos.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {nodes.map((node) => (
              <Card key={node.tempId}>
                <CardContent className="flex flex-wrap items-end gap-3 py-3">
                  <label className="flex w-32 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Tipo</span>
                    <select
                      className={inputCls}
                      value={node.node_type}
                      onChange={(e) => {
                        updateNode(node.tempId, "node_type", e.target.value);
                      }}
                    >
                      {NODE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {NODE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Nombre</span>
                    <input
                      className={inputCls}
                      value={node.name}
                      onChange={(e) => {
                        updateNode(node.tempId, "name", e.target.value);
                      }}
                      placeholder="Curso de Python"
                    />
                  </label>
                  <label className="flex w-28 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Etiqueta</span>
                    <input
                      className={inputCls}
                      value={node.type_label}
                      onChange={(e) => {
                        updateNode(node.tempId, "type_label", e.target.value);
                      }}
                      placeholder="Corte / Unidad"
                    />
                  </label>
                  <label className="flex w-36 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Fase</span>
                    <select
                      className={inputCls}
                      value={node.phaseTempId ?? ""}
                      onChange={(e) => {
                        updateNode(node.tempId, "phaseTempId", e.target.value || null);
                      }}
                    >
                      <option value="">Sin fase</option>
                      {phases.map((ph, i) => (
                        <option key={ph.tempId} value={ph.tempId}>
                          {ph.name || `Fase ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex w-40 flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Padre</span>
                    <select
                      className={inputCls}
                      value={node.parentTempId ?? ""}
                      onChange={(e) => {
                        updateNode(node.tempId, "parentTempId", e.target.value || null);
                      }}
                    >
                      <option value="">Raíz</option>
                      {nodes
                        .filter((other) => other.tempId !== node.tempId)
                        .map((other) => (
                          <option key={other.tempId} value={other.tempId}>
                            {other.name || "(sin nombre)"}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      removeNode(node.tempId);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2 pb-4">
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {isSubmitting ? "Creando..." : "Crear proyecto"}
        </button>
      </div>
    </div>
  );
}
