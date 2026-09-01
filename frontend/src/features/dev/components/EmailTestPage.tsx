import { useState } from "react";
import { ChevronDown, CheckCircle2, Mail, Send, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { getErrorMessage } from "@/utils/get-error-message";
import { useSendTestEmail } from "../hooks/use-dev-email";

const fieldCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

/**
 * Prueba de envío de correo transaccional en producción. Solo visible para el
 * rol developer (RoleGuard en el router; el backend lo revalida). Llama al
 * endpoint interno `/dev/email-test`, que usa el servicio de correo real.
 *
 * Sin nada más que el destinatario, el backend manda la plantilla REAL de
 * bienvenida (logo, botón, pie de marca): la prueba verifica exactamente lo
 * que le llega a cualquier usuario, imagen del logo incluida. El HTML crudo
 * es un modo avanzado para casos puntuales (probar un fragmento suelto).
 */
export function EmailTestPage() {
  const send = useSendTestEmail();
  const [to, setTo] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customBody, setCustomBody] = useState("");

  const canSend = /.+@.+\..+/.test(to.trim()) && !send.isPending;

  const submit = () => {
    const body = customBody.trim();
    send.mutate({
      to: to.trim(),
      // Vacío = el backend usa la plantilla real de bienvenida por defecto.
      html_body: body ? `<p>${body.replace(/\n/g, "<br>")}</p>` : undefined,
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <PageHeader
        title="Prueba de correo"
        description="Envía la plantilla real de bienvenida (con logo) por el proveedor transaccional, para verificar que el envío y las imágenes funcionan en producción."
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
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
          <span className="text-[11px] text-muted-foreground">
            Se envía la plantilla real «Te damos la bienvenida a Bitácora OBJ», con el logo. Límite:
            5 envíos por minuto.
          </span>
        </label>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              setAdvancedOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
            Avanzado: enviar HTML crudo en su lugar
          </button>
          {advancedOpen && (
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cuerpo personalizado (opcional)
              </span>
              <textarea
                value={customBody}
                rows={4}
                onChange={(e) => {
                  setCustomBody(e.target.value);
                }}
                placeholder="Si escribes algo aquí, se envía esto en vez de la plantilla real (sin logo ni marca)."
                className={`${fieldCls} resize-y`}
              />
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {send.isPending ? (
            "Enviando…"
          ) : (
            <>
              <Send className="size-4" /> Enviar correo de prueba
            </>
          )}
        </button>

        {send.isSuccess && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" />
            Enviado a <strong>{send.data.to}</strong> vía <strong>{send.data.provider}</strong>.
          </p>
        )}
        {send.isError && (
          <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {getErrorMessage(send.error, "No se pudo enviar el correo de prueba.")}
          </p>
        )}

        <p className="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <Mail className="size-3" />
          Cada envío queda registrado en los logs del servidor (quién y a qué dirección).
        </p>
      </div>
    </div>
  );
}
