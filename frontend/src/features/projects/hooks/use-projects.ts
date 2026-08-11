import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/features/projects/api/projects.api";
import { projectKeys } from "./query-keys";
import type {
  CreateProjectNotePayload,
  CreateProjectPayload,
  UpdateProjectPayload,
} from "@/features/projects/types/api.types";

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: projectsApi.list,
    staleTime: 30_000,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ""),
    queryFn: () => projectsApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProjectPayload) => projectsApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}

/** Token del portal del cliente (se pide bajo demanda al abrir la tarjeta). */
export function useClientAccess(id: string, enabled: boolean) {
  return useQuery({
    queryKey: projectKeys.clientAccess(id),
    queryFn: () => projectsApi.getClientAccess(id),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Rota el token: invalida el enlace anterior y refresca el mostrado. */
export function useRegenerateClientAccess(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.regenerateClientAccess(id),
    onSuccess: (data) => {
      qc.setQueryData(projectKeys.clientAccess(id), data);
    },
  });
}

/** Notas / recordatorios del proyecto (más recientes primero). */
export function useProjectNotes(id: string) {
  return useQuery({
    queryKey: projectKeys.notes(id),
    queryFn: () => projectsApi.listNotes(id),
    enabled: Boolean(id),
  });
}

export function useCreateProjectNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectNotePayload) => projectsApi.createNote(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.notes(id) }),
  });
}

export function useDeleteProjectNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => projectsApi.deleteNote(id, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.notes(id) }),
  });
}
