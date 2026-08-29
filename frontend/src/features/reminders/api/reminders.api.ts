import http from "@/lib/http";
import type { CreateReminderInput, Reminder, ReminderStatus, UpdateReminderInput } from "../types";

// Mapea 1:1 con /api/v1/reminders. Solo traduce parámetros.
export const remindersApi = {
  list: (status?: ReminderStatus) =>
    http
      .get<Reminder[]>("/reminders/", {
        params: status ? { reminder_status: status } : undefined,
      })
      .then((r) => r.data),

  create: (input: CreateReminderInput) =>
    http.post<Reminder>("/reminders/", input).then((r) => r.data),

  update: (id: string, input: UpdateReminderInput) =>
    http.patch<Reminder>(`/reminders/${id}`, input).then((r) => r.data),

  cancel: (id: string) => http.post<Reminder>(`/reminders/${id}/cancel`).then((r) => r.data),

  remove: (id: string) => http.delete(`/reminders/${id}`).then(() => undefined),
};
