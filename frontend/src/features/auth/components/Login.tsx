import {type FormEvent, useEffect, useMemo, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import {type LoginRequest, type RegisterRequest, Role} from "@/features/auth/types";
import {type FieldName, passwordStrength, validateField} from "@/features/auth/utils/security.utils.ts";
import {useLogin, useRegister} from "@/features/auth/hooks/use-auth";
import {getErrorMessage} from "@/utils/get-error-message";
import {AuthPanel} from "./AuthPanel";
import {Field} from "./Field";

type Mode = "login" | "register";
type Errors = Partial<Record<FieldName | "accepted", string>>;

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>("login");
    const [animating, setAnimating] = useState(false);
    const [dark, setDark] = useState(() => {
        const stored = localStorage.getItem("obj-theme");
        if (stored) {return stored === "dark";}
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });
    const [reduceMotion] = useState(() =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    const [loginForm, setLoginForm] = useState<LoginRequest>({email: "", password: ""});

    const [registerForm, setRegisterForm] = useState<RegisterRequest>({
        name: "", last_name: "", email: "", password: "", role: Role.USER,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});

    const firstFieldRef = useRef<HTMLInputElement>(null);
    const isRegister = mode === "register";

    const location = useLocation();
    const fromState = location.state as { from?: { pathname?: string } } | null;
    const redirectTo = fromState?.from?.pathname ?? "/dashboard";

    const loginMutation = useLogin(redirectTo);
    const registerMutation = useRegister(redirectTo);

    const isPending = loginMutation.isPending || registerMutation.isPending;
    const isSuccess = isRegister ? registerMutation.isSuccess : loginMutation.isSuccess;
    const activeError = isRegister ? registerMutation.error : loginMutation.error;
    const formError = activeError ? getErrorMessage(activeError, "Ocurrió un error, intenta de nuevo.") : null;

    useEffect((): void => {
        localStorage.setItem("obj-theme", dark ? "dark" : "light");
    }, [dark]);

    useEffect((): void => {
        if (!animating) {firstFieldRef.current?.focus();}
    }, [mode, animating]);

    const transitionMs = reduceMotion ? 0 : 300;

    const switchMode = (next: Mode): void => {
        if (animating || mode === next) {return;}
        setErrors({});
        setTouched({});
        loginMutation.reset();
        registerMutation.reset();
        if (transitionMs === 0) {
            setMode(next);
            return;
        }
        setAnimating(true);
        setTimeout((): void => {
            setMode(next);
            setAnimating(false);
        }, transitionMs);
    };

    const currentForm = isRegister ? registerForm : loginForm;

    const setField = (name: FieldName, value: string):void => {
        if (isRegister) {setRegisterForm((f) => ({...f, [name]: value}));}
        else {setLoginForm((f) => ({...f, [name]: value}));}
        setErrors((e) => ({...e, [name]: undefined}));
    };

    const handleBlur = (name: FieldName) => {
        setTouched((t) => ({...t, [name]: true}));
        const value = (currentForm as unknown as Record<string, string>)[name] ?? "";
        setErrors((e) => ({...e, [name]: validateField(name, value, isRegister)}));
    };

    const validateAll = (): boolean => {
        const fields: FieldName[] = isRegister
            ? ["name", "last_name", "email", "password"]
            : ["email", "password"];
        const next: Errors = {};
        for (const f of fields) {
            const msg = validateField(f, (currentForm as unknown as Record<string, string>)[f] ?? "", isRegister);
            if (msg) {next[f] = msg;}
        }
        if (isRegister && !accepted) {next.accepted = "Debes aceptar el tratamiento de datos.";}
        setErrors(next);
        setTouched(Object.fromEntries(fields.map((f) => [f, true])));
        return Object.keys(next).length === 0;
    };

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateAll()) {return;}
        if (isRegister) {registerMutation.mutate(registerForm);}
        else {loginMutation.mutate(loginForm);}
    };

    const pwStrength = useMemo(
        () => passwordStrength(registerForm.password),
        [registerForm.password]
    );

    const fieldClasses = (hasError: boolean) =>
        `w-full rounded-lg border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 ${
            hasError
                ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20"
                : "border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-blue-100 dark:border-slate-700 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
        }`;

    return (
        <div className={dark ? "dark" : ""}>
            <div
                className={`relative min-h-screen w-full flex flex-col md:flex-row ${isRegister ? "" : "md:flex-row-reverse"}`}>

                {/* Toggle dark mode */}
                <button
                    type="button"
                    onClick={() => { setDark((d) => !d); }}
                    aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
                    className="absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 backdrop-blur transition hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                    {dark ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                             strokeWidth={1.8}>
                            <circle cx="12" cy="12" r="4"/>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
                        </svg>
                    ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                             strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                        </svg>
                    )}
                </button>

                {/* Panel informativo */}
                <AuthPanel
                    isRegister={isRegister}
                    onSwitch={() => { switchMode(isRegister ? "login" : "register"); }}
                />

                {/* Panel formulario */}
                <main
                    className="flex w-full md:w-1/2 items-center justify-center bg-white px-6 py-12 md:px-14 dark:bg-slate-950">
                    <div
                        className="w-full max-w-sm"
                        style={{opacity: animating ? 0 : 1, transition: `opacity ${transitionMs}ms`}}
                    >
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {isRegister ? "Crear cuenta" : "Acceso al sistema"}
                            </h1>
                            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                                {isRegister
                                    ? "Completa los datos para registrarte"
                                    : "Plataforma privada de gestión de proyectos"}
                            </p>
                        </div>

                        {/* Banner éxito */}
                        {isSuccess && (
                            <div role="status"
                                 className="mb-5 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                </svg>
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    {isRegister ? "Cuenta creada correctamente." : "Acceso verificado correctamente."}
                                </p>
                            </div>
                        )}

                        {/* Banner error API */}
                        {formError && (
                            <div role="alert"
                                 className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
                                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                            </div>
                        )}

                        <form noValidate onSubmit={handleSubmit} className="space-y-4">
                            {isRegister && (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field
                                        ref={firstFieldRef}
                                        id="name" label="Nombre" placeholder="Juan"
                                        value={registerForm.name}
                                        error={touched.name ? errors.name : undefined}
                                        onChange={(e) => { setField("name", e.target.value); }}
                                        onBlur={() => { handleBlur("name"); }}
                                    />
                                    <Field
                                        id="last_name" label="Apellido" placeholder="Pérez"
                                        value={registerForm.last_name}
                                        error={touched.last_name ? errors.last_name : undefined}
                                        onChange={(e) => { setField("last_name", e.target.value); }}
                                        onBlur={() => { handleBlur("last_name"); }}
                                    />
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label htmlFor="email"
                                       className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Correo electrónico
                                </label>
                                <div className="relative">
                                    <span
                                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                             strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    </span>
                                    <input
                                        ref={isRegister ? undefined : firstFieldRef}
                                        id="email" name="email" type="email" inputMode="email"
                                        placeholder="nombre@empresa.com"
                                        value={isRegister ? registerForm.email : loginForm.email}
                                        onChange={(e) => { setField("email", e.target.value); }}
                                        onBlur={() => { handleBlur("email"); }}
                                        aria-invalid={touched.email && Boolean(errors.email)}
                                        aria-describedby={errors.email ? "email-error" : undefined}
                                        className={fieldClasses(Boolean(touched.email && errors.email)).replace("px-4", "pl-10 pr-4")}
                                    />
                                </div>
                                {touched.email && errors.email && (
                                    <p id="email-error" role="alert"
                                       className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
                                )}
                            </div>

                            {/* Contraseña */}
                            <div>
                                <label htmlFor="password"
                                       className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <span
                                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                             strokeWidth={1.8}>
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                            <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4"/>
                                        </svg>
                                    </span>
                                    <input
                                        id="password" name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={isRegister ? registerForm.password : loginForm.password}
                                        onChange={(e) => { setField("password", e.target.value); }}
                                        onBlur={() => {
                                            handleBlur("password");
                                            setCapsLock(false);
                                        }}
                                        onKeyUp={(e) => { setCapsLock(e.getModifierState("CapsLock")); }}
                                        aria-invalid={touched.password && Boolean(errors.password)}
                                        aria-describedby={errors.password ? "password-error" : undefined}
                                        className={fieldClasses(Boolean(touched.password && errors.password)).replace("px-4", "pl-10 pr-11")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setShowPassword((s) => !s); }}
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        {showPassword ? (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                                 stroke="currentColor" strokeWidth={1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                            </svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                                 stroke="currentColor" strokeWidth={1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {capsLock && (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                                             stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M5 10l7-7 7 7M5 14l7-7 7 7M5 21h14"/>
                                        </svg>
                                        Bloq Mayús está activado.
                                    </p>
                                )}

                                {touched.password && errors.password && (
                                    <p id="password-error" role="alert"
                                       className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
                                )}

                                {isRegister && registerForm.password.length > 0 && (
                                    <div className="mt-2.5">
                                        <div className="flex gap-1.5">
                                            {[0, 1, 2, 3].map((i) => (
                                                <span
                                                    key={i}
                                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                                        i < pwStrength.score ? pwStrength.color : "bg-slate-200 dark:bg-slate-700"
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            Seguridad: <span className="font-medium">{pwStrength.label}</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {!isRegister && (
                                <div className="flex justify-end -mt-1">
                                    <button type="button"
                                            className="text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            )}

                            {isRegister && (
                                <div>
                                    <label className="group flex cursor-pointer items-start gap-3">
                                        <div className="relative mt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={accepted}
                                                onChange={(e) => {
                                                    setAccepted(e.target.checked);
                                                    setErrors((er) => ({...er, accepted: undefined}));
                                                }}
                                                className="sr-only"
                                            />
                                            <div
                                                className={`flex h-4 w-4 items-center justify-center rounded border-2 transition ${
                                                    accepted
                                                        ? "border-blue-600 bg-blue-600"
                                                        : "border-slate-300 group-hover:border-blue-400 dark:border-slate-500"
                                                }`}>
                                                {accepted && (
                                                    <svg className="h-2.5 w-2.5 text-white" fill="none"
                                                         viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                            Acepto el{" "}
                                            <button type="button"
                                                    className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                                tratamiento de datos personales
                                            </button>
                                            {" "}conforme a la política de privacidad de OBJ Digital S.A.S.
                                        </span>
                                    </label>
                                    {errors.accepted && (
                                        <p role="alert"
                                           className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.accepted}</p>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isPending}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isPending ? (
                                    <>
                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                                    strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor"
                                                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                                        </svg>
                                        {isRegister ? "Creando cuenta..." : "Verificando..."}
                                    </>
                                ) : isRegister ? "Crear cuenta" : "Ingresar"}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
                            <button
                                type="button"
                                onClick={() => { switchMode(isRegister ? "login" : "register"); }}
                                className="font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                {isRegister ? "Inicia sesión" : "Regístrate"}
                            </button>
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}