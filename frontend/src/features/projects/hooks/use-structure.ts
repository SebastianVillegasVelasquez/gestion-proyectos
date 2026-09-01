import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { structureApi } from "@/features/projects/api/structure.api";
import { projectKeys, taskKeys, workItemKeys } from "./query-keys";
import type {
  CloneWorkItemPayload,
  CreateTipoNodoPayload,
  CreateWorkItemPayload,
  MoveWorkItemPayload,
  ShiftWorkItemSubtreePayload,
  UpdateTipoNodoPayload,
  UpdateWorkItemPayload,
} from "@/features/projects/types/api.types";

export function useWorkTree(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.tree(projectId ?? ""),
    queryFn: () => structureApi.tree(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useNodeTypes(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.nodeTypes(projectId ?? ""),
    queryFn: () => structureApi.listTypes(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateNodeType(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTipoNodoPayload) => structureApi.createType(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.nodeTypes(projectId) }),
  });
}

export function useUpdateNodeType(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ typeId, payload }: { typeId: string; payload: UpdateTipoNodoPayload }) =>
      structureApi.updateType(typeId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.nodeTypes(projectId) }),
  });
}

export function useDeleteNodeType(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (typeId: string) => structureApi.deleteType(typeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.nodeTypes(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
    },
  });
}

export function useCreateWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemPayload) => structureApi.create(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useUpdateWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateWorkItemPayload }) =>
      structureApi.update(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

/** Papelera del proyecto. Solo se consulta al abrirla (`enabled`). */
export function useProjectTrash(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.trash(projectId),
    queryFn: () => structureApi.trash(projectId),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useRestoreWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => structureApi.restore(itemId),
    onSuccess: () => {
      // Vuelve al árbol y desaparece de la papelera: las dos vistas cambian.
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.trash(projectId) });
    },
  });
}

export function useMoveWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: MoveWorkItemPayload }) =>
      structureApi.move(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useShiftWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: ShiftWorkItemSubtreePayload }) =>
      structureApi.shift(itemId, payload),
    // Desplazar un subárbol mueve fechas de la estructura Y de sus tareas.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
    },
  });
}

/** Marca una «actividad de terceros» como entregada. Abre la compuerta de su
 * subárbol y reprograma en cascada las tareas dependientes, así que refresca
 * el árbol y las tareas. */
export function useDeliverThirdParty(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      deliveredOn,
      delivered,
    }: {
      itemId: string;
      deliveredOn?: string | null;
      delivered?: boolean;
    }) => structureApi.deliverThirdParty(itemId, { deliveredOn, delivered }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      void qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}

export function useCloneWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: CloneWorkItemPayload }) =>
      structureApi.clone(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useDeleteWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => structureApi.remove(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useWorkItemDependencies(itemId: string | undefined) {
  return useQuery({
    queryKey: workItemKeys.deps(itemId ?? ""),
    queryFn: () => structureApi.listDependencies(itemId!),
    enabled: Boolean(itemId),
  });
}

export function useAddWorkItemDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, dependsOnId }: { itemId: string; dependsOnId: string }) =>
      structureApi.addDependency(itemId, dependsOnId),
    onSuccess: (_data, { itemId }) => {
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
      void qc.invalidateQueries({ queryKey: workItemKeys.deps(itemId) });
    },
  });
}

export function useRemoveWorkItemDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, dependsOnId }: { itemId: string; dependsOnId: string }) =>
      structureApi.removeDependency(itemId, dependsOnId),
    onSuccess: (_data, { itemId }) => {
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
      void qc.invalidateQueries({ queryKey: workItemKeys.deps(itemId) });
    },
  });
}
