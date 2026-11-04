import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  children: ReactNode;
  /** Cuánto hay que mantenerlo presionado para confirmar. */
  holdMs?: number;
  disabled?: boolean;
  className?: string;
  /** Color de la barra que se va llenando mientras se mantiene presionado. */
  fillClassName?: string;
  title?: string;
}

/**
 * Botón de confirmación por presión sostenida: la acción solo se ejecuta si se
 * mantiene presionado `holdMs` (con el mouse, el dedo o la barra espaciadora).
 * Soltar antes cancela. Sirve para acciones que mueven fechas del proyecto y no
 * deben dispararse por un clic accidental, sin añadir un diálogo más.
 */
export function HoldToConfirmButton({
  onConfirm,
  children,
  holdMs = 1200,
  disabled = false,
  className,
  fillClassName = "bg-white/30",
  title,
}: HoldToConfirmButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimer();
    setHolding(false);
  }, [clearTimer]);

  const start = () => {
    if (disabled || timer.current !== null) {
      return;
    }
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, holdMs);
  };

  // Si el botón se desactiva o se desmonta con la cuenta en marcha, no debe
  // confirmar: se corta el temporizador (el relleno se oculta con `disabled`).
  useEffect(() => {
    if (disabled) {
      clearTimer();
    }
    return clearTimer;
  }, [disabled, clearTimer]);

  const filling = holding && !disabled;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      start();
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      cancel();
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onPointerDown={(event) => {
        if (event.button === 0) {
          start();
        }
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={cancel}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      className={cn(
        "relative touch-none select-none overflow-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0", fillClassName)}
        style={{
          width: filling ? "100%" : "0%",
          transition: filling ? `width ${String(holdMs)}ms linear` : "width 150ms ease-out",
        }}
      />
      <span className="relative flex items-center justify-center gap-1.5">{children}</span>
    </button>
  );
}
