import {
  AlarmClock,
  AlertTriangle,
  AtSign,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Link2,
  type LucideIcon,
  MessageSquare,
  PlayCircle,
  Undo2,
} from "lucide-react";
import type { NotificationType } from "../types";

// Ícono por tipo (presentación). Partial a propósito: si el backend enviara un
// tipo nuevo aún no mapeado, caemos a la campana sin romper.
export const TYPE_ICON: Partial<Record<NotificationType, LucideIcon>> = {
  tarea_asignada: ClipboardList,
  subtarea_asignada: ClipboardList,
  tarea_iniciada: PlayCircle,
  tarea_entregada: CheckCircle2,
  tarea_rechazada: Undo2,
  tarea_atrasada: AlertTriangle,
  tarea_por_vencer: AlarmClock,
  tarea_completada: CheckCircle2,
  tarea_devuelta: Undo2,
  tarea_reprogramada: CalendarClock,
  dependencia_terceros_fechada: Link2,
  proyecto_miembro_agregado: FolderKanban,
  proyecto_cerrado: FolderKanban,
  proyecto_iniciado: FolderKanban,
  proyecto_pausado: FolderKanban,
  proyecto_finalizado: FolderKanban,
  comentario_publicado: MessageSquare,
  comentario_respuesta: MessageSquare,
  mencion: AtSign,
  recordatorio: AlarmClock,
};

// Tono del ícono por familia de evento: tareas → teal/rose, proyectos →
// violeta, conversación → azul/ámbar. Ayuda a escanear la lista de un vistazo.
export const TYPE_TONE: Partial<Record<NotificationType, string>> = {
  tarea_asignada:
    "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal",
  subtarea_asignada:
    "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal",
  tarea_iniciada:
    "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal",
  tarea_entregada: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  tarea_rechazada: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  tarea_atrasada: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  tarea_por_vencer: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  tarea_completada: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  tarea_devuelta: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  proyecto_miembro_agregado:
    "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_cerrado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_iniciado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_pausado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_finalizado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  comentario_publicado: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  comentario_respuesta: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  mencion: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  dependencia_terceros_fechada:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
  tarea_reprogramada: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
  recordatorio: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
};

export const DEFAULT_TONE = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300";

export const FALLBACK_ICON = Bell;
