import { useState } from "react";
import { X, CalendarRange, Clock, Hourglass, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateWorkItem } from "../../hooks/use-structure";
import type {
  CreateWorkItemPayload,
  DuracionUnidad,
  TipoNodo,
  WorkItemTree,
} from "../../types/api.types";

type DateMode = "fechas" | "inicio_dur" | "fin_dur" | "solo_dur";

const MODES: { id: DateMode; label: string; hint: string; icon: typeof Clock }[] = [
  { id: "inicio_dur", label: "Inicio + duración", hint: "Calcula el fin", icon: Clock },
  { id: "fin_dur", label: "Fin + duración", hint: "Calcula el inicio", icon: Hourglass },
  {
    id: "solo_dur",
    label: "Solo duración",
    hint: "Hereda del padre o predecesor",
    icon: CornerDownRight,
  },
  { id: "fechas", label: "Fechas exactas", hint: "Inicio y fin", icon: CalendarRange },
];

interface Props {
  projectId: string;
  parent: WorkItemTree | null;
  nodeTypes: TipoNodo[];
  onClose: () => void;
}

export function WorkItemModal({ projectId, parent, nodeTypes, onClose }: Props) {
  const createItem = useCreateWorkItem(projectId);
  const [nombre, setNombre] = useState("");
  const [tipoId, setTipoId] = useState(nodeTypes[0]?.id ?? "");
  const [mode, setMode] = useState<DateMode>("inicio_dur");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [durValor, setDurValor] = useState("");
  const [durUnidad, setDurUnidad] = useState<DuracionUnidad>("dias");
  const [esTransversal, setEsTransversal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsDur = mode !== "fechas";

  function buildDates(): Partial<CreateWorkItemPayload> | null {
    const dur = durValor ? Number(durValor) : null;
    if (needsDur && (!dur || dur <= 0)) {
      setError("Indica una duración válida.");
      return null;
    }
    switch (mode) {
      case "fechas":
        if (!inicio || !fin) {
          return (setError("Indica inicio y fin."), null);
        }
        return { fecha_inicio_plan: inicio, fecha_fin_plan: fin };
      case "inicio_dur":
        if (!inicio) {
          return (setError("Indica la fecha de inicio."), null);
        }
        return { fecha_inicio_plan: inicio, duracion_valor: dur, duracion_unidad: durUnidad };
      case "fin_dur":
        if (!fin) {
          return (setError("Indica la fecha de fin."), null);
        }
        return { fecha_fin_plan: fin, duracion_valor: dur, duracion_unidad: durUnidad };
      case "solo_dur":
        return { duracion_valor: dur, duracion_unidad: durUnidad };
    }
  }

  async function submit() {
    setError(null);
    if (nombre.trim().length < 1) {
      setError("Ponle un nombre al nodo.");
      return;
    }
    if (!tipoId) {
      setError("Elige un tipo de nodo.");
      return;
    }
    const dates = buildDates();
    if (!dates) {
      return;
    }
    try {
      await createItem.mutateAsync({
        nombre: nombre.trim(),
        tipo_id: tipoId,
        parent_id: parent?.id ?? null,
        es_transversal: esTransversal,
        ...dates,
      });
      onClose();
    } catch {
      setError("No se pudo crear el nodo. Revisa los datos e inténtalo de nuevo.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Nuevo nodo
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {parent ? `Dentro de “${parent.nombre}”` : "En la raíz del proyecto"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Nombre</span>
              <input
                autoFocus
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                }}
                placeholder="Ej. Módulo 1 — Fundamentos"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tipo de nodo
              </span>
              <select
                value={tipoId}
                onChange={(e) => {
                  setTipoId(e.target.value);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {nodeTypes.length === 0 && <option value="">Crea un tipo primero</option>}
                {nodeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Motor de fechas — 3 modos */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ¿Cómo defines su tiempo?
            </span>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                    }}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                      active
                        ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100 dark:border-blue-500 dark:bg-blue-900/20 dark:ring-blue-900/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4",
                        active ? "text-blue-600 dark:text-blue-400" : "text-slate-400",
                      )}
                    />
                    <span className="flex flex-col">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          active
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-slate-700 dark:text-slate-200",
                        )}
                      >
                        {m.label}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {m.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(mode === "fechas" || mode === "inicio_dur") && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Inicio
                </span>
                <input
                  type="date"
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            )}
            {(mode === "fechas" || mode === "fin_dur") && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fin</span>
                <input
                  type="date"
                  value={fin}
                  onChange={(e) => {
                    setFin(e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            )}
            {needsDur && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Duración
                </span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={durValor}
                    onChange={(e) => {
                      setDurValor(e.target.value);
                    }}
                    placeholder="0"
                    className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <select
                    value={durUnidad}
                    onChange={(e) => {
                      setDurUnidad(e.target.value as DuracionUnidad);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="dias">días</option>
                    <option value="semanas">semanas</option>
                  </select>
                </div>
              </label>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={esTransversal}
              onChange={(e) => {
                setEsTransversal(e.target.checked);
              }}
              className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Frente transversal (continuo, no ligado a un entregable)
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={createItem.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {createItem.isPending ? "Creando…" : "Crear nodo"}
          </button>
        </footer>
      </div>
    </div>
  );
}
