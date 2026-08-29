import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { remindersApi } from "../api/reminders.api";
import type { CreateReminderInput, ReminderStatus, UpdateReminderInput } from "../types";

export const reminderKeys = {
  all: ["reminders"] as const,
  list: (status?: ReminderStatus) => [...reminderKeys.all, status ?? "todos"] as const,
};

/** Lista de recordatorios del usuario (por defecto solo los pendientes). */
export function useReminders(status: ReminderStatus | undefined, enabled = true) {
  return useQuery({
    queryKey: reminderKeys.list(status),
    queryFn: () => remindersApi.list(status),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) => remindersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReminderInput }) =>
      remindersApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useCancelReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remindersApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remindersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}
