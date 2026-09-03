import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Loader2, Trash2, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandCanvas } from "@/components/common/BrandCanvas";
import { getErrorMessage } from "@/utils/get-error-message";
import type { AuthUser } from "@/features/auth/types";
import { avatarSrc, profileApi } from "../api/profile.api";

/** Iniciales para el hueco de la foto: dos letras como mucho. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

/**
 * Portada + foto de perfil, al estilo de un muro.
 *
 * La portada es el MISMO telón animado de la pantalla de acceso, con el logo a
 * la izquierda: entrar a la aplicación y mirarse el perfil se sienten como el
 * mismo producto. La foto se monta encima, a caballo entre la portada y la
 * ficha, que es donde el ojo la busca.
 */
export function ProfileHero({ user }: { user: AuthUser }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onError: (e) => {
      setError(getErrorMessage(e, "No se pudo subir la imagen"));
    },
  });
  const remove = useMutation({
    mutationFn: () => profileApi.deleteAvatar(),
    onError: (e) => {
      setError(getErrorMessage(e, "No se pudo quitar la imagen"));
    },
  });

  const src = avatarSrc(user.avatar_url);
  const busy = upload.isPending || remove.isPending;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative h-36 bg-sidebar sm:h-44">
        <BrandCanvas />
        <div className="relative z-10 flex items-center gap-3 px-5 py-5 sm:px-7">
          <img src="/logo.webp" alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold">
            Bitácora OBJ
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-7">
        {/* La foto sube sobre la portada con un margen negativo. */}
        <div className="relative -mt-12 shrink-0 sm:-mt-14">
          <div className="size-24 overflow-hidden rounded-2xl border-4 border-card bg-accent shadow-lg sm:size-28">
            {src ? (
              <img src={src} alt={user.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-brand-teal/10 text-2xl font-bold text-brand-teal-dark dark:text-brand-teal">
                {initials(user.name) || <UserCircle2 className="size-8" />}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setError(null);
                upload.mutate(file);
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Cambiar la foto de perfil"
            className={cn(
              "absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow transition-colors hover:bg-brand-gold-dark",
              busy && "opacity-60",
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </button>
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
            {user.name}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>

        {src && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              remove.mutate();
            }}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:self-end"
          >
            <Trash2 className="size-3.5" /> Quitar foto
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="px-5 pb-4 text-xs text-red-600 dark:text-red-400 sm:px-7">
          {error}
        </p>
      )}
    </section>
  );
}
