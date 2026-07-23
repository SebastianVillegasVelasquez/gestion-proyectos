import { useState } from "react";
import { X, CalendarRange, Clock, Hourglass, CornerDownRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateWorkItem, useUpdateWorkItem } from "../../hooks/use-structure";
import type { DuracionUnidad, TipoNodo, WorkItemTree } from "../../types/api.types";

type DateMode = "fechas" | "inicio_dur" | "fin_dur" | "solo_dur";

interface DatePayload {
  fecha_inicio_plan: string | null;
  fecha_fin_plan: string | null;
  duracion_valor: number | null;
  duracion_unidad: DuracionUnidad | null;
}

const MODES: { id: DateMode; label: string; hint: string; icon: typeof Clock }[] = [
  { id: "inicio_dur", label: "Inicio + duración", hint: "Calcula el fin", icon: Clock },
  { id: "fin_dur", label: "Fin + duración", hint: "Calcula el inicio", icon: Hourglass },
  {
    id: "solo_dur",
    label: "Solo duración",
    hint: "Toma las fechas del elemento que lo contiene o del anterior",
    icon: CornerDownRight,
  },
  { id: "fechas", label: "Fechas exactas", hint: "Inicio y fin", icon: CalendarRange },
];

/** Deduce el modo de fechas inicial al editar (best-effort sobre lo guardado). */
function inferMode(item: WorkItemTree): DateMode {
  const hasDur = item.duracion_valor != null;
  if (hasDur && item.fecha_inicio_plan) {
    return "inicio_dur";
  }
  if (hasDur && item.fecha_fin_plan) {
    return "fin_dur";
  }
  if (hasDur) {
    return "solo_dur";
  }
  if (item.fecha_inicio_plan && item.fecha_fin_plan) {
    return "fechas";
  }
  return "inicio_dur";
}

interface Props {
  projectId: string;
  /** Si se pasa, el modal entra en modo edición de ese nodo. */
  editItem?: WorkItemTree | null;
  /** Padre al crear (ignorado en edición). */
  parent: WorkItemTree | null;
  nodeTypes: TipoNodo[];
  onClose: () => void;
}

export function WorkItemModal({ projectId, editItem, parent, nodeTypes, onClose }: Props) {
  const createItem = useCreateWorkItem(projectId);
  const updateItem = useUpdateWorkItem(projectId);
  const isEdit = Boolean(editItem);

  const [nombre, setNombre] = useState(editItem?.nombre ?? "");
  const [tipoId, setTipoId] = useState(editItem?.tipo_id ?? nodeTypes[0]?.id ?? "");
  const [mode, setMode] = useState<DateMode>(editItem ? inferMode(editItem) : "inicio_dur");
  const [inicio, setInicio] = useState(editItem?.fecha_inicio_plan ?? "");
  const [fin, setFin] = useState(editItem?.fecha_fin_plan ?? "");
  const [durValor, setDurValor] = useState(
    editItem?.duracion_valor != null ? String(editItem.duracion_valor) : "",
  );
  const [durUnidad, setDurUnidad] = useState<DuracionUnidad>(editItem?.duracion_unidad ?? "dias");
  const [esTransversal, setEsTransversal] = useState(editItem?.es_transversal ?? false);
  const [error, setError] = useState<string | null>(null);

  const needsDur = mode !== "fechas";
  const pending = createItem.isPending || updateItem.isPending;

  /** Devuelve las 4 columnas de fecha completas (las no usadas en null) para que
   *  el backend re-derive y, al editar, se limpie lo del modo anterior. */
  function buildDates(): DatePayload | null {
    const dur = durValor ? Number(durValor) : null;
    if (needsDur && (!dur || dur <= 0)) {
      setError("Indica una duración válida.");
      return null;
    }
    const empty: DatePayload = {
      fecha_inicio_plan: null,
      fecha_fin_plan: null,
      duracion_valor: null,
      duracion_unidad: null,
    };
    switch (mode) {
      case "fechas":
        if (!inicio || !fin) {
          setError("Indica inicio y fin.");
          return null;
        }
        return { ...empty, fecha_inicio_plan: inicio, fecha_fin_plan: fin };
      case "inicio_dur":
        if (!inicio) {
          setError("Indica la fecha de inicio.");
          return null;
        }
        return {
          ...empty,
          fecha_inicio_plan: inicio,
          duracion_valor: dur,
          duracion_unidad: durUnidad,
        };
      case "fin_dur":
        if (!fin) {
          setError("Indica la fecha de fin.");
          return null;
        }
        return { ...empty, fecha_fin_plan: fin, duracion_valor: dur, duracion_unidad: durUnidad };
      case "solo_dur":
        return { ...empty, duracion_valor: dur, duracion_unidad: durUnidad };
    }
  }

  async function submit() {
    setError(null);
    if (nombre.trim().length < 1) {
      setError("Ponle un nombre al elemento.");
      return;
    }
    if (!tipoId) {
      setError("Elige un tipo de elemento.");
      return;
    }
    const dates = buildDates();
    if (!dates) {
      return;
    }
    const base = {
      nombre: nombre.trim(),
      tipo_id: tipoId,
      es_transversal: esTransversal,
      ...dates,
    };
    try {
      if (editItem) {
        await updateItem.mutateAsync({ itemId: editItem.id, payload: base });
      } else {
        await createItem.mutateAsync({ ...base, parent_id: parent?.id ?? null });
      }
      onClose();
    } catch {
      setError("No se pudo guardar el elemento. Revisa los datos e inténtalo de nuevo.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {isEdit ? "Editar elemento" : "Nuevo elemento"}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {isEdit
                ? `Editando “${editItem!.nombre}”`
                : parent
                  ? `Dentro de “${parent.nombre}”`
                  : "En el nivel principal del proyecto"}
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-blue/25"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tipo de elemento
              </span>
              <select
                value={tipoId}
                onChange={(e) => {
                  setTipoId(e.target.value);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {nodeTypes.length === 0 && <option value="">Crea un tipo primero</option>}
                {nodeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Categoría dentro de tu proyecto (p. ej. Módulo, Curso, Fase, Tema). La creas y
                nombras tú desde la fila de <span className="font-medium">Tipos</span>.
              </span>
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
                        ? "border-brand-blue bg-brand-blue/10 ring-2 ring-brand-blue/30"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4",
                        active ? "text-brand-blue-dark dark:text-brand-blue" : "text-slate-400",
                      )}
                    />
                    <span className="flex flex-col">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          active
                            ? "text-brand-blue-dark dark:text-brand-blue"
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

          {/* Nota: las tareas del elemento pueden tener fechas fuera de este rango */}
          <div className="flex items-start gap-2 rounded-lg border border-brand-blue/25 bg-brand-blue/5 px-3 py-2 text-[12px] text-foreground/80">
            <Info className="mt-0.5 size-3.5 shrink-0 text-brand-blue" />
            <p>
              Estas fechas planifican el <span className="font-medium">elemento</span>. Las tareas
              que crees dentro pueden tener sus propias fechas y no se limitan a este rango — sirven
              como referencia, no como tope.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={esTransversal}
              onChange={(e) => {
                setEsTransversal(e.target.checked);
              }}
              className="mt-0.5 size-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium text-foreground">Frente transversal</span>
              <span className="text-[11px] text-muted-foreground">
                Trabajo continuo que acompaña al proyecto sin un entregable puntual (p. ej. QA,
                soporte, coordinación). No se le marca un fin porque avanza en paralelo a los demás
                elementos y no bloquea a los que dependen de él.
              </span>
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
            disabled={pending}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear elemento"}
          </button>
        </footer>
      </div>
    </div>
  );
}
