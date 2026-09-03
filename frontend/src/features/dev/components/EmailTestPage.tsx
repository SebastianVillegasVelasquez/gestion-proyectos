import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Mail, Send, ShieldAlert, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { getErrorMessage } from "@/utils/get-error-message";
import { useDirectory } from "@/features/projects/hooks/use-members";
import type { ManualEmailKind } from "../api/dev-email.api";
import { useSendManualEmails, useSendTestEmail } from "../hooks/use-dev-email";

const fieldCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

const KINDS: { value: ManualEmailKind; label: string; hint: string }[] = [
  {
    value: "welcome",
    label: "Bienvenida",
    hint: "Solo la plantilla (logo, botón de acceso). NO genera un enlace de activación real: úsala para revisar cómo se ve el correo.",
  },
  {
    value: "activation",
    label: "Activación de cuenta",
    hint: "Genera un enlace de activación NUEVO y lo envía. Deja la contraseña actual del destinatario en blanco: solo podrá entrar por el enlace y tendrá que crear su contraseña. Para notificar cuentas de producción que aún no han sido activadas.",
  },
  {
    value: "overdue",
    label: "Tarea vencida",
    hint: "Un correo por cada tarea vencida real del destinatario, igual que el aviso automático.",
  },
];

/**
 * Panel de Correos del rol técnico y del super_admin (RoleGuard en el router;
 * el backend revalida el rol dentro del handler).
 *
 * Arriba: disparar a mano una plantilla real (bienvenida o tarea vencida) a una
 * o varias personas — el envío y el render son los mismos que usan los flujos
 * automáticos. Abajo, plegado: el diagnóstico de envío (una dirección suelta +
 * comprobación del logo) para verificar el proveedor en producción.
 */
export function EmailTestPage() {
  const directoryQuery = useDirectory();
  const sendManual = useSendManualEmails();

  const [kind, setKind] = useState<ManualEmailKind>("welcome");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const users = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (directoryQuery.data ?? [])
      .filter(
        (u) =>
          !q ||
          `${u.name} ${u.last_name}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
      .sort((a, b) => `${a.name} ${a.last_name}`.localeCompare(`${b.name} ${b.last_name}`));
  }, [directoryQuery.data, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const kindHint = KINDS.find((k) => k.value === kind)?.hint ?? "";

  const submit = () => {
    if (selected.size === 0) {
      return;
    }
    sendManual.mutate({ kind, recipient_ids: [...selected] });
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <PageHeader
        title="Correos"
        description="Dispara a mano una plantilla real a una o varias personas. Usa el mismo envío que los flujos automáticos."
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de correo
          </span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ManualEmailKind);
              sendManual.reset();
            }}
            className={fieldCls}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">{kindHint}</span>
        </label>

        <div className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Destinatarios
            <span className="font-normal normal-case text-muted-foreground">
              {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
            </span>
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Buscar por nombre o correo…"
            className={fieldCls}
          />
          <div className="mt-1 flex items-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  users.forEach((u) => next.add(u.id));
                  return next;
                });
              }}
              className="font-semibold text-brand-gold-dark hover:underline dark:text-brand-gold"
            >
              Seleccionar {query ? "filtrados" : "todos"}
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                }}
                className="font-semibold text-muted-foreground hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border">
            {directoryQuery.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Cargando personas…</p>
            ) : users.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nadie coincide con la búsqueda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/40">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => {
                          toggle(u.id);
                        }}
                        className="size-4 accent-brand-gold"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {u.name} {u.last_name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {u.email}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {kind === "activation" && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Invalida la contraseña actual de cada destinatario. Los que ya estuvieran usando el
            sistema tendrán que volver a entrar por el enlace del correo. No te incluyas a ti.
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={selected.size === 0 || sendManual.isPending}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendManual.isPending ? (
            "Enviando…"
          ) : (
            <>
              <Send className="size-4" /> Enviar
            </>
          )}
        </button>

        {sendManual.isSuccess && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              {sendManual.data.total_sent} correo
              {sendManual.data.total_sent === 1 ? "" : "s"} enviado
              {sendManual.data.total_sent === 1 ? "" : "s"}.
              {(() => {
                const n = sendManual.data.results.filter((r) => r.already_entered).length;
                return n > 0
                  ? ` ${String(n)} ${n === 1 ? "cuenta ya había entrado y su" : "cuentas ya habían entrado y su"} contraseña queda invalidada.`
                  : "";
              })()}
            </p>
            <ul className="rounded-lg border border-border bg-background text-[12px]">
              {sendManual.data.results.map((r) => (
                <li
                  key={r.user_id}
                  className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0 truncate text-foreground">{r.name}</span>
                  <span
                    className={
                      r.sent > 0
                        ? "shrink-0 text-emerald-700 dark:text-emerald-300"
                        : "shrink-0 text-muted-foreground"
                    }
                  >
                    {r.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sendManual.isError && (
          <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {getErrorMessage(sendManual.error, "No se pudieron enviar los correos.")}
          </p>
        )}

        <p className="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <Mail className="size-3" />
          Cada envío queda registrado en los logs del servidor (quién, plantilla y total).
        </p>
      </div>

      <DiagnosticsCard />
    </div>
  );
}

/** Diagnóstico de envío: una dirección suelta + comprobación de que el logo del
 * correo es alcanzable en producción. Plegado por defecto. */
function DiagnosticsCard() {
  const send = useSendTestEmail();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [customBody, setCustomBody] = useState("");

  const canSend = /.+@.+\..+/.test(to.trim()) && !send.isPending;

  const submit = () => {
    const body = customBody.trim();
    send.mutate({
      to: to.trim(),
      html_body: body ? `<p>${body.replace(/\n/g, "<br>")}</p>` : undefined,
    });
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        Diagnóstico de envío
      </button>
      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-[11px] text-muted-foreground">
            Envía la plantilla de bienvenida a una dirección suelta y comprueba que el proveedor y
            el logo funcionan en producción. Límite: 5 envíos por minuto.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destinatario
            </span>
            <input
              type="email"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
              }}
              placeholder="tu-correo@ejemplo.com"
              className={fieldCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cuerpo personalizado (opcional)
            </span>
            <textarea
              value={customBody}
              rows={3}
              onChange={(e) => {
                setCustomBody(e.target.value);
              }}
              placeholder="Si escribes algo aquí, se envía esto en vez de la plantilla real (sin marca)."
              className={`${fieldCls} resize-y`}
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {send.isPending ? "Enviando…" : "Enviar diagnóstico"}
          </button>

          {send.isSuccess && (
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
              <p className="mb-1 font-semibold uppercase tracking-wide">
                Enviado a {send.data.to} vía {send.data.provider}
              </p>
              <p className="break-all">
                Logo: <code>{send.data.resolved_logo_url || "—"}</code>
              </p>
              <p
                className={
                  send.data.logo_reachable
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
                }
              >
                {send.data.logo_reachable
                  ? "✓ El logo es alcanzable: aparecerá en los correos."
                  : "✗ El logo NO es alcanzable. Revisa APP_PUBLIC_URL en el servidor."}{" "}
                <span className="text-muted-foreground">({send.data.logo_check_detail})</span>
              </p>
            </div>
          )}
          {send.isError && (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {getErrorMessage(send.error, "No se pudo enviar el correo de diagnóstico.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
