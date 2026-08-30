import { useEffect, useState } from "react";
import { AlarmClock, Bell, Check, Mail, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/utils/get-error-message";
import { useCreateReminder, useDeleteReminder, useReminders } from "../hooks/use-reminders";
import type { ReminderChannel } from "../types";

const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  notificacion: "Notificación",
  correo: "Correo",
  ambos: "Notificación y correo",
};

/** "en 3 h", "en 2 días", "ahora" — tiempo restante hasta `iso`. */
function formatUntil(iso: string, now: number): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  if (diffSec <= 30) {
    return "ahora";
  }
  const min = Math.round(diffSec / 60);
  if (min < 60) {
    return `en ${String(min)} min`;
  }
  const h = Math.round(min / 60);
  if (h < 24) {
    return `en ${String(h)} h`;
  }
  const d = Math.round(h / 24);
  return `en ${String(d)} ${d === 1 ? "día" : "días"}`;
}

/** Valor `datetime-local` (hora local del navegador) por defecto: dentro de 1 h. */
function defaultLocalValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RemindersBell({ placement = "down" }: { placement?: "down" | "up" }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const listQuery = useReminders("pendiente", open && isAuthenticated);
  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder();

  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultLocalValue);
  const [channel, setChannel] = useState<ReminderChannel>("notificacion");

  // "Ahora" en estado (no calculado en render, para no llamar funciones impuras
  // durante el render). Se refresca al abrir y cada 30 s mientras está abierto.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) {
      return;
    }
    const id = setInterval(() => {
      setNowTs(Date.now());
    }, 15_000);
    return () => {
      clearInterval(id);
    };
  }, [open]);

  const pending = listQuery.data ?? [];
  const isFuture = new Date(when).getTime() > nowTs;
  const canSubmit = title.trim().length >= 2 && isFuture && !createReminder.isPending;

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    createReminder.mutate(
      {
        title: title.trim(),
        // `datetime-local` es hora local sin zona; `new Date(...)` la interpreta
        // como local y `toISOString()` la pasa a UTC, que es lo que espera la API.
        remind_at: new Date(when).toISOString(),
        channel,
      },
      {
        onSuccess: () => {
          setTitle("");
          setWhen(defaultLocalValue());
        },
      },
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        aria-label="Recordatorios"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <AlarmClock className="size-4" />
        {pending.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-teal px-1 text-[9px] font-bold leading-none text-white">
            {pending.length > 9 ? "9+" : pending.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar recordatorios"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => {
              setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-label="Recordatorios"
            className={cn(
              "absolute z-50 flex max-h-[30rem] w-96 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900",
              placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Recordatorios
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Alta rápida */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submit();
                  }
                }}
                placeholder="Recordarme…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-teal dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => {
                    setWhen(e.target.value);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-teal dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <select
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value as ReminderChannel);
                  }}
                  aria-label="Canal del recordatorio"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-teal dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="notificacion">Notificación</option>
                  <option value="correo">Correo</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              {!isFuture && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Elige una fecha y hora futuras.
                </p>
              )}
              {createReminder.isError && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  {getErrorMessage(createReminder.error, "No se pudo crear el recordatorio")}
                </p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-teal px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-3.5" /> Añadir recordatorio
              </button>
            </div>

            {/* Pendientes */}
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {listQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-2">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : pending.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Bell className="size-6 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Sin recordatorios pendientes.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {pending.map((r) => (
                    <li
                      key={r.id}
                      className="group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal">
                        {r.channel === "correo" ? (
                          <Mail className="size-3.5" />
                        ) : (
                          <AlarmClock className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                          {r.title}
                        </span>
                        <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                          {formatUntil(r.remind_at, nowTs)} · {CHANNEL_LABEL[r.channel]}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Eliminar recordatorio"
                        onClick={() => {
                          deleteReminder.mutate(r.id);
                        }}
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {listQuery.isError && (
                <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  Los recordatorios no están disponibles por ahora.
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
              <Check className="size-3" /> Te avisamos por el canal que elijas cuando llegue la
              hora.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
