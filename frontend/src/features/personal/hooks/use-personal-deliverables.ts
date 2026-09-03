import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  personalApi,
  type AddCommentBody,
  type AddVersionBody,
  type CreatePersonalDeliverableBody,
  type NewFileVersionBody,
  type UpdateVersionBody,
} from "../api/personal.api";

const keys = {
  all: ["personal-deliverables"] as const,
  mine: ["personal-deliverables", "mine"] as const,
  reviewQueue: ["personal-deliverables", "review-queue"] as const,
  myTasks: ["personal-deliverables", "my-tasks"] as const,
};

/** Mis entregas personales (tareas individuales, sin equipo). */
export function useMyPersonalDeliverables() {
  return useQuery({ queryKey: keys.mine, queryFn: personalApi.list });
}

/** «Mis tareas»: todo lo asignado a mí, individual o de equipo. */
export function useMyTasks() {
  return useQuery({ queryKey: keys.myTasks, queryFn: personalApi.myTasks });
}

/** Entregas personales que me toca revisar (soy coordinador/supervisor del
 * proyecto de la tarea y están esperando revisión). */
export function usePersonalReviewQueue() {
  return useQuery({ queryKey: keys.reviewQueue, queryFn: personalApi.reviewQueue });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.all });
    // Entregar / revisar mueve el estado de la tarea vinculada.
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["workspace"] });
  };
}

export function useCreatePersonalDeliverable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreatePersonalDeliverableBody) => personalApi.create(body),
    onSuccess: invalidate,
  });
}

export function useSetPersonalApproval() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, requiresApproval }: { id: string; requiresApproval: boolean }) =>
      personalApi.setApproval(id, requiresApproval),
    onSuccess: invalidate,
  });
}

export function useAddPersonalVersion() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddVersionBody }) =>
      personalApi.addVersion(id, body),
    onSuccess: invalidate,
  });
}

export function useUploadPersonalVersionFile() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: NewFileVersionBody }) =>
      personalApi.uploadVersionFile(id, body),
    onSuccess: invalidate,
  });
}

export function useUpdatePersonalVersion() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      versionId,
      body,
    }: {
      id: string;
      versionId: string;
      body: UpdateVersionBody;
    }) => personalApi.updateVersion(id, versionId, body),
    onSuccess: invalidate,
  });
}

export function useDeletePersonalDeliverable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => personalApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useAddPersonalComment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddCommentBody }) =>
      personalApi.addComment(id, body),
    onSuccess: invalidate,
  });
}
