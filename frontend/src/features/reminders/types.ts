// Espejo de los enums del backend (app.modules.reminders).
export type ReminderChannel = "notificacion" | "correo" | "ambos";
export type ReminderStatus = "pendiente" | "enviado" | "cancelado";

export interface Reminder {
  id: string;
  title: string;
  note: string | null;
  remind_at: string; // ISO 8601
  channel: ReminderChannel;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
}

export interface CreateReminderInput {
  title: string;
  note?: string | null;
  remind_at: string; // ISO 8601, en el futuro
  channel: ReminderChannel;
}

export interface UpdateReminderInput {
  title?: string;
  note?: string | null;
  remind_at?: string;
  channel?: ReminderChannel;
}
