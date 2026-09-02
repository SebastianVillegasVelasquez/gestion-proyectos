import { type FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth.api";
import { useActivateAccount } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/utils/get-error-message";

/** Misma política que el backend: mínimo 8 caracteres y al menos un dígito. */
function passwordError(value: string): string | null {
  if (value.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (!/\d/.test(value)) {
    return "La contraseña debe contener al menos un número.";
  }
  return null;
}

/**
 * Pantalla de activación de cuenta (pública, sin sesión). Se llega desde el
 * enlace del correo de bienvenida: `/activar?token=...`. Valida el token, pide
 * una contraseña propia y deja la sesión iniciada. Nunca viaja una contraseña
 * por correo.
 */
export default function ActivateAccountPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const infoQuery = useQuery({
    queryKey: ["activation-info", token],
    queryFn: () => authApi.activationInfo(token),
    enabled: token.length > 0,
    retry: false,
  });

  const activate = useActivateAccount("/");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const localError = useMemo(() => {
    if (!touched) {
      return null;
    }
    return (
      passwordError(password) ?? (password !== confirm ? "Las contraseñas no coinciden." : null)
    );
  }, [touched, password, confirm]);

  const serverError = activate.error
    ? getErrorMessage(activate.error, "No se pudo activar la cuenta.")
    : null;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (passwordError(password) || password !== confirm) {
      return;
    }
    activate.mutate({ token, newPassword: password });
  };

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-gold focus:bg-white focus:ring-4 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-11 w-11 shrink-0 rounded-lg object-contain"
          />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Bitácora OBJ
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Activa tu cuenta</p>
          </div>
        </div>

        {!token ? (
          <LinkProblem message="El enlace no trae un token de activación." />
        ) : infoQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Comprobando el enlace…</p>
        ) : infoQuery.isError ? (
          <LinkProblem
            message={getErrorMessage(
              infoQuery.error,
              "El enlace de activación no es válido o ya caducó.",
            )}
          />
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Crea tu contraseña
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Estás activando la cuenta de{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {infoQuery.data?.name}
              </span>{" "}
              ({infoQuery.data?.email}).
            </p>

            {serverError && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
              >
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  placeholder="Mínimo 8 caracteres, con un número"
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Repite la contraseña
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                  }}
                  onBlur={() => {
                    setTouched(true);
                  }}
                  className={fieldClass}
                />
              </div>

              {localError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {localError}
                </p>
              )}

              <button
                type="submit"
                disabled={activate.isPending}
                className="mt-1 flex w-full items-center justify-center rounded-lg bg-brand-gold py-2.5 text-sm font-semibold tracking-wide text-brand-black shadow-sm transition-all hover:bg-brand-gold-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activate.isPending ? "Activando…" : "Activar cuenta e ingresar"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          ¿Ya tienes acceso?{" "}
          <Link to="/login" className="font-medium text-brand-teal hover:text-brand-teal-dark">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function LinkProblem({ message }: { message: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Enlace no válido
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pide a quien te dio de alta que te reenvíe un enlace nuevo.
      </p>
    </div>
  );
}
