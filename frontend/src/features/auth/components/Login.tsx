import {forwardRef, useEffect, useMemo, useRef, useState} from "react";
import {type LoginRequest, type RegisterRequest, Role} from "@/features/auth/types.ts";
import {type FieldName, validateField, passwordStrength} from "@/features/auth/services/SecurityServices.ts";

type Mode = "login" | "register";
type Errors = Partial<Record<FieldName | "accepted" | "form", string>>;

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>("login");
    const [animating, setAnimating] = useState(false);
    const [dark, setDark] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);

    const [loginForm, setLoginForm] = useState<LoginRequest>({email: "", password: ""});
    const [registerForm, setRegisterForm] = useState<RegisterRequest>({
        name: "", lastname: "", email: "", password: "", role: Role.COLLABORATOR
    });

    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
    const [success, setSuccess] = useState(false);

    const firstFieldRef = useRef<HTMLInputElement>(null);

    const isRegister = mode === "register";

    // ── Modo oscuro: detecta preferencia del sistema + persistencia ──
    useEffect(() => {
        const stored = localStorage.getItem("obj-theme");
        if (stored) setDark(stored === "dark");
        else setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);

        setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, []);

    useEffect(() => {
        localStorage.setItem("obj-theme", dark ? "dark" : "light");
    }, [dark]);

    // ── Foco al primer campo al cambiar de modo ──
    useEffect(() => {
        if (!animating) firstFieldRef.current?.focus();
    }, [mode, animating]);

    const transitionMs = reduceMotion ? 0 : 300;

    const switchMode = (next: Mode) => {
        if (animating || mode === next) return;
        setErrors({});
        setTouched({});
        setSuccess(false);
        if (transitionMs === 0) {
            setMode(next);
            return;
        }
        setAnimating(true);
        setTimeout(() => {
            setMode(next);
            setAnimating(false);
        }, transitionMs);
    };

    const currentForm = isRegister ? registerForm : loginForm;

    const setField = (name: FieldName, value: string) => {
        if (isRegister) setRegisterForm((f) => ({...f, [name]: value}));
        else setLoginForm((f) => ({...f, [name]: value}));
        setErrors((e) => ({...e, [name]: undefined, form: undefined}));
    };

    const handleBlur = (name: FieldName) => {
        setTouched((t) => ({...t, [name]: true}));
        const value = (currentForm as unknown as Record<string, string>)[name] ?? "";
        setErrors((e) => ({...e, [name]: validateField(name, value, isRegister)}));
    };

    const detectCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
        setCapsLock(e.getModifierState?.("CapsLock") ?? false);
    };

    const validateAll = (): boolean => {
        const fields: FieldName[] = isRegister
            ? ["name", "lastname", "email", "password"]
            : ["email", "password"];
        const next: Errors = {};
        for (const f of fields) {
            const msg = validateField(f, (currentForm as unknown as Record<string, string>)[f] ?? "", isRegister);
            if (msg) next[f] = msg;
        }
        if (isRegister && !accepted) next.accepted = "Debes aceptar el tratamiento de datos.";
        setErrors(next);
        setTouched(Object.fromEntries(fields.map((f) => [f, true])));
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAll()) return;
        setLoading(true);
        // TODO: isRegister ? await registerService(registerForm) : await loginService(loginForm)
        await new Promise((r) => setTimeout(r, 1500));
        setLoading(false);
        setSuccess(true);
    };

    const pwStrength = useMemo(
        () => passwordStrength(registerForm.password),
        [registerForm.password]
    );

    const fieldClasses = (hasError: boolean) =>
        `w-full rounded-lg border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 ${
            hasError
                ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20"
                : "border-slate-200 hover:border-slate-300 focus:border-amber-400 focus:ring-amber-100 dark:border-slate-600 dark:hover:border-slate-500 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
        }`;

    return (
        <div className={dark ? "dark" : ""}>
            <div
                className={`relative min-h-screen w-full flex flex-col md:flex-row ${
                    isRegister ? "md:flex-row-reverse" : "md:flex-row"
                }`}
            >
                {/* ── Toggle de modo oscuro ── */}
                <button
                    type="button"
                    onClick={() => setDark((d) => !d)}
                    aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
                    className="absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 backdrop-blur transition hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                    {dark ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <circle cx="12" cy="12" r="4"/>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
                        </svg>
                    ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                        </svg>
                    )}
                </button>

                {/* ── PANEL INFORMATIVO ── */}
                <aside className="relative flex w-full md:w-1/2 flex-col justify-between overflow-hidden bg-slate-50 px-8 py-12 md:px-14 md:py-16 dark:bg-slate-900">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
                        style={{
                            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                            backgroundSize: "26px 26px",
                            color: "#94a3b8",
                        }}
                    />

                    <div className="relative z-10">
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-500">
                            OBJ Digital
                        </span>

                        {!isRegister ? (
                            <>
                                <h2 className="mt-6 max-w-md text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl dark:text-white">
                                    Gestiona tus proyectos con precisión
                                </h2>
                                <ul className="mt-10 space-y-5">
                                    {[
                                        {d: "M3 7h18M3 12h18M3 17h18", title: "Centraliza todos tus proyectos"},
                                        {d: "M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z", title: "Seguimiento en tiempo real y Gantt"},
                                        {d: "M13 10V3L4 14h7v7l9-11h-7z", title: "Reportes ejecutivos con IA"},
                                    ].map((f, i) => (
                                        <li key={i} className="flex items-center gap-3.5">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d={f.d}/>
                                                </svg>
                                            </span>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {f.title}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <>
                                <h2 className="mt-6 max-w-md text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl dark:text-white">
                                    Crea tu cuenta de forma segura
                                </h2>
                                <ul className="mt-10 space-y-6">
                                    {[
                                        {d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: "Usa una contraseña segura", desc: "Mínimo 8 caracteres combinando letras, números y símbolos."},
                                        {d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: "Guarda tus credenciales", desc: "Usa un gestor de contraseñas como Bitwarden o 1Password."},
                                        {d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", title: "Usa tu correo corporativo", desc: "Registra la cuenta con tu email empresarial."},
                                    ].map((tip, i) => (
                                        <li key={i} className="flex items-start gap-3.5">
                                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d={tip.d}/>
                                                </svg>
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tip.title}</p>
                                                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{tip.desc}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    <p className="relative z-10 mt-10 text-xs text-slate-400 dark:text-slate-500">
                        Plataforma privada · Acceso solo autorizado
                    </p>
                </aside>

                {/* ── PANEL DE FORMULARIO ── */}
                <main className="flex w-full md:w-1/2 items-center justify-center bg-white px-6 py-12 md:px-14 dark:bg-slate-800">
                    <div
                        className="w-full max-w-sm"
                        style={{
                            opacity: animating ? 0 : 1,
                            transition: `opacity ${transitionMs}ms`,
                        }}
                    >
                        {/* Encabezado */}
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

                        {/* Éxito */}
                        {success && (
                            <div role="status" className="mb-5 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                </svg>
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    {isRegister ? "Cuenta creada correctamente." : "Acceso verificado correctamente."}
                                </p>
                            </div>
                        )}

                        {/* Error general */}
                        {errors.form && (
                            <div role="alert" className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
                                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p>
                            </div>
                        )}

                        <form noValidate onSubmit={handleSubmit} className="space-y-4">
                            {/* Nombre + Apellido (registro) */}
                            {isRegister && (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field
                                        ref={firstFieldRef}
                                        id="name" label="Nombre" placeholder="Juan"
                                        value={registerForm.name}
                                        error={touched.name ? errors.name : undefined}
                                        onChange={(e) => setField("name", e.target.value)}
                                        onBlur={() => handleBlur("name")}
                                    />
                                    <Field
                                        id="lastname" label="Apellido" placeholder="Pérez"
                                        value={registerForm.lastname}
                                        error={touched.lastname ? errors.lastname : undefined}
                                        onChange={(e) => setField("lastname", e.target.value)}
                                        onBlur={() => handleBlur("lastname")}
                                    />
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Correo electrónico
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    </span>
                                    <input
                                        ref={isRegister ? undefined : firstFieldRef}
                                        id="email" name="email" type="email" inputMode="email"
                                        placeholder="nombre@empresa.com"
                                        value={isRegister ? registerForm.email : loginForm.email}
                                        onChange={(e) => setField("email", e.target.value)}
                                        onBlur={() => handleBlur("email")}
                                        aria-invalid={touched.email && !!errors.email}
                                        aria-describedby={errors.email ? "email-error" : undefined}
                                        className={fieldClasses(!!(touched.email && errors.email)).replace("px-4", "pl-10 pr-4")}
                                    />
                                </div>
                                {touched.email && errors.email && (
                                    <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
                                )}
                            </div>

                            {/* Contraseña */}
                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                            <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4"/>
                                        </svg>
                                    </span>
                                    <input
                                        id="password" name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={isRegister ? registerForm.password : loginForm.password}
                                        onChange={(e) => setField("password", e.target.value)}
                                        onBlur={() => {
                                            handleBlur("password");
                                            setCapsLock(false);
                                        }}
                                        onKeyUp={detectCaps}
                                        aria-invalid={touched.password && !!errors.password}
                                        aria-describedby={errors.password ? "password-error" : undefined}
                                        className={fieldClasses(!!(touched.password && errors.password)).replace("px-4", "pl-10 pr-11")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        {showPassword ? (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                            </svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Aviso Bloq Mayús */}
                                {capsLock && (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7 7 7M5 14l7-7 7 7M5 21h14"/>
                                        </svg>
                                        Bloq Mayús está activado.
                                    </p>
                                )}

                                {touched.password && errors.password && (
                                    <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
                                )}

                                {/* Medidor de fuerza (solo registro) */}
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

                            {/* Olvidé contraseña — login */}
                            {!isRegister && (
                                <div className="flex justify-end -mt-1">
                                    <button type="button"
                                            className="text-xs font-medium text-amber-600 transition hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            )}

                            {/* Tratamiento de datos — registro */}
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
                                                        ? "border-amber-500 bg-amber-500"
                                                        : "border-slate-300 group-hover:border-amber-400 dark:border-slate-500"
                                                }`}>
                                                {accepted && (
                                                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                            Acepto el{" "}
                                            <button type="button"
                                                    className="font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">
                                                tratamiento de datos personales
                                            </button>
                                            {" "}conforme a la política de privacidad de OBJ Digital S.A.S.
                                        </span>
                                    </label>
                                    {errors.accepted && (
                                        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.accepted}</p>
                                    )}
                                </div>
                            )}

                            {/* Botón acción */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold tracking-wide text-white transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                                        </svg>
                                        {isRegister ? "Creando cuenta..." : "Verificando..."}
                                    </>
                                ) : isRegister ? "Crear cuenta" : "Ingresar"}
                            </button>
                        </form>

                        {/* Switch de modo */}
                        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
                            <button
                                type="button"
                                onClick={() => switchMode(isRegister ? "login" : "register")}
                                className="font-semibold text-amber-600 transition hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
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

// ── Campo de texto reutilizable con etiqueta vinculada y error inline ──
interface FieldProps {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(({id, label, placeholder, value, error, onChange, onBlur}, ref) => {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </label>
            <input
                ref={ref}
                id={id}
                name={id}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                className={`w-full rounded-lg border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 ${
                    error
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20"
                        : "border-slate-200 hover:border-slate-300 focus:border-amber-400 focus:ring-amber-100 dark:border-slate-600 dark:hover:border-slate-500 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
                }`}
            />
            {error && (
                <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
        </div>
    );
});

Field.displayName = "Field";
