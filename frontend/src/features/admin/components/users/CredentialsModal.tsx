import { Copy } from "lucide-react";

// ── Modal: credenciales / enlace generados (crear / reset) ──────────────────
// - reset  → `password`: contraseña temporal para entregar.
// - alta   → `activationUrl`: enlace de activación (también enviado por correo).
export function CredentialsModal({
  title,
  email,
  password,
  activationUrl,
  onClose,
}: {
  title: string;
  email: string;
  password?: string;
  activationUrl?: string | null;
  onClose: () => void;
}) {
  const isLink = Boolean(activationUrl);
  const text = isLink
    ? `Usuario: ${email}\nEnlace de activación: ${activationUrl ?? ""}`
    : `Usuario: ${email}\nContraseña temporal: ${password ?? ""}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {isLink
            ? "Ya se envió por correo. Este enlace es de un solo uso; cópialo solo si necesitas reenviarlo por otro canal."
            : "Cópialas y entrégaselas al usuario. No se volverán a mostrar."}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          {text}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(text)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:bg-accent"
          >
            <Copy className="size-4" /> Copiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
