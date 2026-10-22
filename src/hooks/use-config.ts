"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  configApi,
  type Member,
  type PollInterval,
  type Repository,
  type Settings,
  type TeamInput,
} from "@/lib/api/config";
import { queryKeys } from "@/lib/query-keys";

export function failureMessage(action: string) {
  return `Falha ao ${action}. Verifique sua conexão e tente novamente.`;
}

export function useRepositories() {
  return useQuery({ queryKey: queryKeys.repositories, queryFn: configApi.repositories });
}

export function useMembers() {
  return useQuery({ queryKey: queryKeys.members, queryFn: configApi.members });
}

export function useTeams() {
  return useQuery({ queryKey: queryKeys.teams, queryFn: configApi.teams });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: configApi.settings });
}

export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: configApi.status,
    refetchInterval: 10_000,
  });
}

function useOptimisticMutation<TData, TVars>(opts: {
  queryKey: QueryKey;
  mutationFn: (vars: TVars) => Promise<unknown>;
  apply: (current: TData, vars: TVars) => TData;
  action: string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: opts.mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: opts.queryKey });
      const previous = qc.getQueryData<TData>(opts.queryKey);
      if (previous !== undefined) {
        qc.setQueryData<TData>(opts.queryKey, opts.apply(previous, vars));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(opts.queryKey, context.previous);
      }
      toast.error(failureMessage(opts.action));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: opts.queryKey });
      void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
    },
  });
}

type RepositoryPatch = { uuid: string } & Partial<
  Pick<Repository, "monitored" | "minApprovals">
>;

export function useUpdateRepository() {
  return useOptimisticMutation<{ repositories: Repository[] }, RepositoryPatch>({
    queryKey: queryKeys.repositories,
    mutationFn: ({ uuid, ...patch }) => configApi.patchRepository(uuid, patch),
    apply: (current, { uuid, ...patch }) => ({
      repositories: current.repositories.map((r) =>
        r.uuid === uuid ? { ...r, ...patch } : r,
      ),
    }),
    action: "atualizar o repositório",
  });
}

type MemberPatch = { uuid: string } & Partial<Pick<Member, "monitored">>;

export function useUpdateMember() {
  return useOptimisticMutation<{ members: Member[] }, MemberPatch>({
    queryKey: queryKeys.members,
    mutationFn: ({ uuid, ...patch }) => configApi.patchMember(uuid, patch),
    apply: (current, { uuid, ...patch }) => ({
      members: current.members.map((m) => (m.uuid === uuid ? { ...m, ...patch } : m)),
    }),
    action: "atualizar o membro",
  });
}

export function useSetPollInterval() {
  return useOptimisticMutation<Settings, PollInterval>({
    queryKey: queryKeys.settings,
    mutationFn: configApi.setPollInterval,
    apply: (_current, pollIntervalSeconds) => ({ pollIntervalSeconds }),
    action: "salvar o intervalo de atualização",
  });
}

export function useSyncRepositories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.syncRepositories,
    onSuccess: (data) => {
      toast.success(
        `${data.total} repositórios sincronizados (${data.added} novos, ${data.updated} atualizados).`,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.repositories });
    },
    onError: () => toast.error(failureMessage("sincronizar os repositórios")),
  });
}

export function useSyncMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.syncMembers,
    onSuccess: (data) => {
      if (data.forbidden) {
        toast.warning("O token não tem permissão para listar membros do workspace (403).");
        return;
      }
      toast.success(
        `${data.total} membros sincronizados (${data.added} novos, ${data.updated} atualizados).`,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.members });
    },
    onError: () => toast.error(failureMessage("sincronizar os membros")),
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.addMember,
    onSuccess: () => {
      toast.success("Membro adicionado.");
      void qc.invalidateQueries({ queryKey: queryKeys.members });
    },
    onError: () => toast.error(failureMessage("adicionar o membro")),
  });
}

export function useSaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: TeamInput }) =>
      id === null ? configApi.createTeam(input) : configApi.updateTeam(id, input),
    onSuccess: (_data, { id }) => {
      toast.success(id === null ? "Time criado." : "Time salvo.");
      void qc.invalidateQueries({ queryKey: queryKeys.teams });
      void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
    },
    onError: () => toast.error(failureMessage("salvar o time")),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.deleteTeam,
    onSuccess: () => {
      toast.success("Time excluído.");
      void qc.invalidateQueries({ queryKey: queryKeys.teams });
      void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
    },
    onError: () => toast.error(failureMessage("excluir o time")),
  });
}
