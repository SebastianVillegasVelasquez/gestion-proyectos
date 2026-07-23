import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  GanttChartSquare,
  ListTodo,
  type LucideIcon,
  Share2,
  Users2,
} from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useClientAccess,
  useCreateProject,
  useRegenerateClientAccess,
} from "../hooks/use-projects";
import { ClientAccessFields } from "./detail/ClientAccessFields";
import type { CreateProjectPayload } from "../types/api.types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25";

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

// Qué viene después de crear el proyecto, en lenguaje del negocio. Orienta al
// responsable sobre el flujo completo sin tecnicismos.
const NEXT_STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ClipboardList,
    title: "Organiza el contenido",
    text: "Divide el proyecto en fases, módulos o actividades, con los niveles que tu equipo maneja.",
  },
  {
    icon: Users2,
    title: "Suma a tu equipo",
    text: "Agrega integrantes o asigna equipos completos con sus roles dentro del proyecto.",
  },
  {
    icon: ListTodo,
    title: "Reparte el trabajo",
    text: "Crea tareas con responsable y fechas de entrega en cada parte del proyecto.",
  },
  {
    icon: GanttChartSquare,
    title: "Sigue el avance",
    text: "El cronograma y los indicadores de progreso se arman solos con la información anterior.",
  },
];

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
  // Proyecto recién creado: al fijarlo, mostramos la pantalla de éxito con el
  // enlace del cliente listo (en vez de saltar directo al detalle).
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const accessQuery = useClientAccess(created?.id ?? "", Boolean(created));
  const regenerate = useRegenerateClientAccess(created?.id ?? "");

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
      setCreated({ id: project.id, name: project.name });
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo crear el proyecto."));
    }
  }

  // ── Pantalla de éxito: proyecto creado + enlace del cliente listo ──────────
  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Proyecto creado
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              «{created.name}» ya está listo. Comparte su avance con el cliente cuando quieras.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Share2 className="size-4 text-brand-teal" /> Acceso del cliente
          </p>
          {accessQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : accessQuery.isError || !accessQuery.data ? (
            <p className="text-xs text-rose-500">
              El proyecto se creó, pero no se pudo obtener el enlace del cliente. Podrás generarlo
              desde el detalle del proyecto.
            </p>
          ) : (
            <ClientAccessFields
              token={accessQuery.data.token}
              onRegenerate={() => {
                regenerate.mutate();
              }}
              regenerating={regenerate.isPending}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => navigate("/projects")}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
          >
            Ir a proyectos
          </button>
          <button
            onClick={() => navigate(`/projects/${created.id}`)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-gold-dark"
          >
            Configurar el proyecto <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <button
        onClick={() => navigate("/projects")}
        className="flex w-fit items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="size-4" /> Todos los proyectos
      </button>

      {/* Encabezado con identidad de marca */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-gold/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-brand-teal/10 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-gold-dark text-brand-black shadow-md">
            <FolderKanban className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Nuevo proyecto
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Registra los datos generales para arrancar. Lo demás — contenido, equipo, tareas y
              cronograma — lo construyes dentro del proyecto, a tu ritmo.
            </p>
          </div>
        </div>
      </header>

      {/* Dos columnas iguales; items-stretch iguala las alturas de ambas cards */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Información general
          </h2>

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

          <Field label="Cliente" hint="La organización o área para la que se desarrolla.">
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputCls} pl-9`}
                value={form.client_name ?? ""}
                onChange={(e) => {
                  set("client_name", e.target.value);
                }}
                placeholder="Ej. Unicafam"
              />
            </div>
          </Field>

          <Field label="Descripción" hint="Objetivo y alcance, en una o dos frases.">
            <textarea
              className={inputCls}
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => {
                set("description", e.target.value);
              }}
              placeholder="Ej. Virtualizar el curso de Excel intermedio para el área de formación…"
            />
          </Field>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <CalendarRange className="size-3.5 text-brand-teal" /> Periodo estimado
              <span className="font-normal text-slate-400">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Inicio">
                <input
                  type="date"
                  className={inputCls}
                  value={form.start_date ?? ""}
                  onChange={(e) => {
                    set("start_date", e.target.value || null);
                  }}
                />
              </Field>
              <Field label="Entrega">
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
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              onClick={() => navigate("/projects")}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={createProject.isPending}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-gold-dark disabled:opacity-60"
            >
              {createProject.isPending ? "Creando…" : "Crear proyecto"}
            </button>
          </div>
        </div>

        {/* Guía: qué sigue después de crear el proyecto */}
        <aside className="flex flex-col">
          <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              ¿Qué sigue después?
            </h2>
            {/* flex-1 + justify-between reparte los pasos a lo alto de la card,
                espejando la altura del formulario */}
            <ol className="mt-4 flex flex-1 flex-col justify-between gap-4">
              {NEXT_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-teal shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                      <step.icon className="size-4" />
                    </div>
                    {i < NEXT_STEPS.length - 1 && (
                      <span className="mt-1 h-full w-px bg-slate-200 dark:bg-slate-700" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
