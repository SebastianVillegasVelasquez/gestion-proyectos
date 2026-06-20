import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, FolderPlus, Sparkles } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useCreateProject } from "../hooks/use-projects";
import type { CreateProjectPayload } from "../types/api.types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20";

/** Texto recortado, o null si queda vacío (para enviar campos opcionales). */
function blank(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  );
}

export function CreateProjectPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [form, setForm] = useState<CreateProjectPayload>({
    name: "",
    description: "",
    client_name: "",
    start_date: null,
    end_date: null,
  });
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CreateProjectPayload>(key: K, value: CreateProjectPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function submit() {
    setError(null);
    if (form.name.trim().length < 2) {
      setError("El nombre del proyecto debe tener al menos 2 caracteres.");
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: form.name.trim(),
        description: blank(form.description),
        client_name: blank(form.client_name),
        start_date: form.start_date,
        end_date: form.end_date,
      });
      void navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo crear el proyecto."));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <button
        onClick={() => navigate("/projects")}
        className="flex w-fit items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="size-4" /> Proyectos
      </button>

      <header className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <FolderPlus className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Nuevo proyecto</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define lo esencial. La estructura (módulos, fases, actividades…) la armas después, a tu
            medida, dentro del proyecto.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Field label="Nombre del proyecto *">
          <input
            autoFocus
            className={inputCls}
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
            }}
            placeholder="Ej. Diplomado en Transformación Digital"
          />
        </Field>

        <Field label="Cliente">
          <input
            className={inputCls}
            value={form.client_name ?? ""}
            onChange={(e) => {
              set("client_name", e.target.value);
            }}
            placeholder="Ej. Unicafam"
          />
        </Field>

        <Field label="Descripción">
          <textarea
            className={inputCls}
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => {
              set("description", e.target.value);
            }}
            placeholder="Objetivo y alcance del proyecto…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Inicio" hint="Opcional">
            <input
              type="date"
              className={inputCls}
              value={form.start_date ?? ""}
              onChange={(e) => {
                set("start_date", e.target.value || null);
              }}
            />
          </Field>
          <Field label="Fin estimado" hint="Opcional">
            <input
              type="date"
              className={inputCls}
              value={form.end_date ?? ""}
              onChange={(e) => {
                set("end_date", e.target.value || null);
              }}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="size-3.5 text-blue-400" />
            Después podrás crear tipos de nodo y un árbol con la profundidad que quieras.
          </span>
          <button
            onClick={submit}
            disabled={createProject.isPending}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {createProject.isPending ? "Creando…" : "Crear proyecto"}
          </button>
        </div>
      </div>
    </div>
  );
}
