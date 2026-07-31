import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Link2, RefreshCw } from "lucide-react";

/**
 * Enlace público del portal del cliente. NO lleva el token: es un enlace fijo a
 * la pantalla de acceso donde el cliente introduce el token por separado (se
 * envía por POST, nunca en la URL).
 */
export function portalLink(): string {
  return `${window.location.origin}/portal/entrar`;
}

function CopyField({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Link2;
  label: string;
  value: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => {
            e.target.select();
          }}
          className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        />
        <button
          type="button"
          onClick={() => void copy()}
          title={`Copiar ${label.toLowerCase()}`}
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title="Abrir en una pestaña nueva"
            aria-label="Abrir en una pestaña nueva"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Muestra el acceso del cliente en dos campos SEPARADOS: el enlace de la pantalla
 * de acceso (sin token) y el token. El cliente abre el enlace e introduce el
 * token; así el token no queda expuesto en la URL. Presentacional: recibe el
 * token y el callback de regenerar; no consulta datos.
 */
export function ClientAccessFields({
  token,
  onRegenerate,
  regenerating,
}: {
  token: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CopyField icon={Link2} label="Enlace de acceso" value={portalLink()} href={portalLink()} />
      <CopyField icon={KeyRound} label="Token de acceso" value={token} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Comparte el enlace y el token por separado. El cliente introduce el token para ver el
          avance en solo lectura, sin iniciar sesión.
        </p>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-rose-600 disabled:opacity-50 dark:text-slate-400"
          >
            <RefreshCw className={regenerating ? "size-3 animate-spin" : "size-3"} />
            Regenerar
          </button>
        )}
      </div>
    </div>
  );
}
