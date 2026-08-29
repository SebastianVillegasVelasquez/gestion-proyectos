import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth, useChangePassword } from "@/features/auth/hooks/use-auth";
import { revalidateUser } from "@/features/auth/api/revalidate";
import { getErrorMessage } from "@/utils/get-error-message";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

/** Reglas de la contraseña nueva, espejo de la validación del backend
 * (`ChangePasswordRequest`): mínimo 8 caracteres y al menos un número. */
function checkRules(value: string) {
  return {
    length: value.length >= 8,
    digit: /\d/.test(value),
  };
}

/**
 * Puerta de primer ingreso.
 *
 * Cuando la cuenta entra con una contraseña provisional (alta de un admin o
 * restablecimiento), el backend marca `must_change_password`. Mientras eso siga
 * activo, este modal cubre toda la aplicación: no se puede cerrar ni saltar. Al
 * crear una contraseña propia, `revalidateUser` refresca la sesión y el modal
 * desaparece solo.
 */
export function FirstLoginPasswordGate() {
  const { user } = useAuth();
  const changePassword = useChangePassword();

  const [temporary, setTemporary] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  const rules = useMemo(() => checkRules(next), [next]);
  const matches = next.length > 0 && next === confirm;
  const differsFromTemp = next.length > 0 && next !== temporary;
  const canSubmit =
    temporary.length > 0 &&
    rules.length &&
    rules.digit &&
    matches &&
    differsFromTemp &&
    !changePassword.isPending;

  if (!user?.must_change_password) {
    return null;
  }

  const firstName = user.name.trim().split(/\s+/)[0];

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    changePassword.mutate(
      { currentPassword: temporary, newPassword: next },
      {
        onSuccess: () => {
          setDone(true);
          // Refresca la copia local del usuario: el flag ya viene en false y el
          // AuthContext vuelve a renderizar sin este modal.
          void revalidateUser(true);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-brand-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-title"
    >
      <div className="relative my-auto grid w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:grid-cols-[1.05fr_1fr]">
        {/* Panel de bienvenida — marca + mensaje motivacional */}
        <aside className="relative flex flex-col justify-between gap-6 bg-gradient-to-br from-brand-gold via-brand-gold to-brand-gold-dark p-7 text-brand-black">
          <div className="flex items-center gap-2.5">
            {/* Sobre el dorado, el logo va en una teja blanca sólida para que
                contraste (la misma imagen del login / barra lateral). */}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <img src="/logo.webp" alt="Bitácora OBJ" className="h-7 w-7 object-contain" />
            </span>
            <span className="text-sm font-bold uppercase tracking-[0.18em]">Bitácora OBJ</span>
          </div>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-black/10 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" /> Tu primer ingreso
            </span>
            <h2 id="first-login-title" className="text-2xl font-bold leading-tight">
              {firstName ? `Te damos la bienvenida, ${firstName}` : "Te damos la bienvenida"}
            </h2>
            <p className="text-sm leading-relaxed text-brand-black/80">
              Nos alegra tenerte en el equipo. Bitácora OBJ es el espacio donde damos seguimiento a
              nuestros proyectos, tareas y entregables. Antes de empezar, crea una contraseña
              personal: es el primer paso para que tu cuenta sea solo tuya.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-brand-black/85">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Solo tú la conoces: nadie de la administración puede verla.
            </li>
            <li className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0" />
              La contraseña provisional deja de funcionar en cuanto la cambies.
            </li>
          </ul>
        </aside>

        {/* Formulario */}
        <div className="flex flex-col justify-center p-7">
          {done ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="size-12 text-brand-teal" />
              <h3 className="text-lg font-semibold text-foreground">Contraseña actualizada</h3>
              <p className="text-sm text-muted-foreground">
                Ya puedes empezar a trabajar. Estamos preparando tu espacio…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Crea tu contraseña</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Necesitamos que reemplaces la contraseña provisional para continuar.
                </p>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Contraseña provisional
                </span>
                <div className="relative">
                  <input
                    className={inputCls}
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={temporary}
                    onChange={(e) => {
                      setTemporary(e.target.value);
                    }}
                    aria-label="Contraseña provisional"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Nueva contraseña</span>
                <div className="relative">
                  <input
                    className={inputCls}
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => {
                      setNext(e.target.value);
                    }}
                    aria-label="Nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShow((v) => !v);
                    }}
                    aria-label={show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Confirmar contraseña
                </span>
                <input
                  className={inputCls.replace(" pr-10", "")}
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                  }}
                  aria-label="Confirmar contraseña"
                />
              </label>

              <ul className="space-y-1 text-xs">
                <Rule ok={rules.length}>Al menos 8 caracteres</Rule>
                <Rule ok={rules.digit}>Incluye al menos un número</Rule>
                <Rule ok={matches}>Las dos contraseñas coinciden</Rule>
                <Rule ok={differsFromTemp}>Es distinta de la provisional</Rule>
              </ul>

              {changePassword.isError && (
                <p role="alert" className="text-xs text-brand-red">
                  {getErrorMessage(
                    changePassword.error,
                    "No se pudo actualizar la contraseña. Revisa la provisional e inténtalo de nuevo.",
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changePassword.isPending ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-brand-teal" : "text-muted-foreground"}`}>
      <CheckCircle2 className={`size-3.5 ${ok ? "opacity-100" : "opacity-40"}`} />
      {children}
    </li>
  );
}
