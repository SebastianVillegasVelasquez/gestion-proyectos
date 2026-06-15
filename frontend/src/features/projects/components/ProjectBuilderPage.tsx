import { useNavigate, useOutletContext } from "react-router";
import { Moon, Sun, Save, Plus, ClipboardCheck } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useBuilderState } from "../builder/use-builder-state";
import { useCreateProjectDraft } from "../builder/use-create-project-draft";
import { BuilderTree } from "./builder/BuilderTree";
import { BuilderDetail } from "./builder/BuilderDetail";

export function ProjectBuilderPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const builder = useBuilderState();
  const { submit, isSubmitting, error } = useCreateProjectDraft();

  const canSubmit = builder.project.name.trim().length >= 2 && !isSubmitting;

  const handleSubmit = async () => {
    const id = await submit(builder.project, builder.phases, builder.nodes);
    if (id) {
      void navigate(`/projects/${id}`);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-5">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Constructor de proyecto
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Arma fases y dentro de cada una la estructura: programas, cursos y módulos
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {builder.clipboard && (
            <span className="hidden items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 sm:flex">
              <ClipboardCheck className="size-3.5" />
              Jerarquía copiada ({builder.clipboard.length})
            </span>
          )}
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* 2 paneles: árbol + detalle */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="min-h-0 overflow-hidden">
          <CardContent className="h-full overflow-y-auto py-4">
            {builder.phases.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Empieza creando la primera fase del proyecto
                </p>
                <button
                  type="button"
                  onClick={builder.addPhase}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="size-4" /> Crear fase 1
                </button>
              </div>
            ) : (
              <BuilderTree builder={builder} />
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardContent className="h-full overflow-y-auto py-4">
            <BuilderDetail builder={builder} />
          </CardContent>
        </Card>
      </div>

      <div className="flex shrink-0 justify-end gap-2">
        <button
          type="button"
          onClick={() => void navigate("/projects")}
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
