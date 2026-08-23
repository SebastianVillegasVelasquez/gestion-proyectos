import {type FormEvent, useEffect, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import type {LoginRequest} from "@/features/auth/types";
import {type FieldName, validateField} from "@/features/auth/utils/security.utils.ts";
import {useLogin} from "@/features/auth/hooks/use-auth";
import {getErrorMessage} from "@/utils/get-error-message";
import {AuthPanel} from "./AuthPanel";

type Errors = Partial<Record<FieldName, string>>;

export default function LoginPage() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("obj-theme");
    if (stored) {
      return stored === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [loginForm, setLoginForm] = useState<LoginRequest>({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});

  const firstFieldRef = useRef<HTMLInputElement>(null);

  const location = useLocation();
  const fromState = location.state as { from?: { pathname?: string } } | null;
  const redirectTo = fromState?.from?.pathname ?? "/dashboard";

  const loginMutation = useLogin(redirectTo);

  const formError = loginMutation.error
    ? getErrorMessage(loginMutation.error, "Ocurrió un error, intenta de nuevo.")
    : null;

  useEffect((): void => {
    console.error("Probando hot reload!!")
    localStorage.setItem("obj-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect((): void => {
    firstFieldRef.current?.focus();
  }, []);

  const setField = (name: FieldName, value: string): void => {
    setLoginForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const handleBlur = (name: FieldName) => {
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((e) => ({ ...e, [name]: validateField(name, loginForm[name]) }));
  };

  const validateAll = (): boolean => {
    const fields: FieldName[] = ["email", "password"];
    const next: Errors = {};
    for (const f of fields) {
      const msg = validateField(f, loginForm[f]);
      if (msg) {
        next[f] = msg;
      }
    }
    setErrors(next);
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    return Object.keys(next).length === 0;
  };

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateAll()) {
      return;
    }
    loginMutation.mutate(loginForm);
  };

  const fieldClasses = (hasError: boolean) =>
    `w-full rounded-lg border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20"
        : "border-slate-200 hover:border-slate-300 focus:border-brand-gold focus:ring-brand-gold/20 dark:border-slate-700 dark:hover:border-slate-600 dark:focus:border-brand-gold dark:focus:ring-brand-gold/25"
    }`;

  return (
    <div className={dark ? "dark" : ""}>
      <div className="relative min-h-screen w-full flex flex-col md:flex-row-reverse">
        {/* Toggle dark mode */}
        <button
          type="button"
          onClick={() => {
            setDark((d) => !d);
          }}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 backdrop-blur transition hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {dark ? (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <circle cx="12" cy="12" r="4" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
              />
            </svg>
          )}
        </button>

        {/* Panel informativo */}
        <AuthPanel />

        {/* Panel formulario */}
        <main className="flex w-full md:w-1/2 items-center justify-center bg-white px-6 py-12 md:px-14 dark:bg-slate-950">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              {/* Marca */}
              <div className="mb-6 flex items-center gap-3">
                <img
                  src="/logo.webp"
                  alt="Bitácora OBJ"
                  className="h-11 w-11 shrink-0 rounded-lg object-contain"
                />
                <div className="leading-tight">
                  <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Bitácora OBJ
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sistema de gestión de proyectos
                  </p>
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Acceso al sistema
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Plataforma privada de gestión de proyectos
              </p>
            </div>

            {/* Banner error API */}
            {formError && (
              <div
                role="alert"
                className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              </div>
            )}

            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <input
                    ref={firstFieldRef}
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    placeholder="nombre@empresa.com"
                    value={loginForm.email}
                    onChange={(e) => {
                      setField("email", e.target.value);
                    }}
                    onBlur={() => {
                      handleBlur("email");
                    }}
                    aria-invalid={touched.email && Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={fieldClasses(Boolean(touched.email && errors.email)).replace(
                      "px-4",
                      "pl-10 pr-4",
                    )}
                  />
                </div>
                {touched.email && errors.email && (
                  <p
                    id="email-error"
                    role="alert"
                    className="mt-1.5 text-xs text-red-600 dark:text-red-400"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Contraseña */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => {
                      setField("password", e.target.value);
                    }}
                    onBlur={() => {
                      handleBlur("password");
                      setCapsLock(false);
                    }}
                    onKeyUp={(e) => {
                      setCapsLock(e.getModifierState("CapsLock"));
                    }}
                    aria-invalid={touched.password && Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className={fieldClasses(Boolean(touched.password && errors.password)).replace(
                      "px-4",
                      "pl-10 pr-11",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword((s) => !s);
                    }}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                {capsLock && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 10l7-7 7 7M5 14l7-7 7 7M5 21h14"
                      />
                    </svg>
                    Bloq Mayús está activado.
                  </p>
                )}

                {touched.password && errors.password && (
                  <p
                    id="password-error"
                    role="alert"
                    className="mt-1.5 text-xs text-red-600 dark:text-red-400"
                  >
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  className="text-xs font-medium text-brand-teal transition hover:text-brand-teal-dark"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gold py-2.5 text-sm font-semibold tracking-wide text-brand-black shadow-sm transition-all hover:bg-brand-gold-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginMutation.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                      />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  "Ingresar"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Plataforma privada. Si necesitas una cuenta, contacta a tu administrador.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
