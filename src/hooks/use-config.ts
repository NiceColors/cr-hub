"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
  configApi,
  type Member,
  type PollInterval,
  type Repository,
  type RepositoryPatch,
  type SavedViewInput,
  type Settings,
  type TeamInput,
} from "@/lib/api/config";
import { ApiError } from "@/lib/api/http";
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

export function useVerifyToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.verifyToken,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.status, data);
      if (data.tokenState === "valid") toast.success("Token válido.");
      else if (data.tokenState === "rate_limited")
        toast.warning("Token válido, mas o limite da API do Bitbucket foi atingido.");
      else toast.error(data.error?.message ?? "Token inválido.");
    },
    onError: () => toast.error(failureMessage("testar o token")),
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
    onError: (error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(opts.queryKey, context.previous);
      }
      toast.error(
        error instanceof ApiError && error.status === 400
          ? error.message
          : failureMessage(opts.action),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: opts.queryKey });
      void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
    },
  });
}

export function useUpdateRepository() {
  return useOptimisticMutation<
    { repositories: Repository[] },
    { uuid: string } & RepositoryPatch
  >({
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
    apply: (current, pollIntervalSeconds) => ({ ...current, pollIntervalSeconds }),
    action: "salvar o intervalo de atualização",
  });
}

export function useSetJira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.setJira,
    onSuccess: () => {
      toast.success("Integração com o Jira salva.");
      void qc.invalidateQueries({ queryKey: queryKeys.settings });
      void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : failureMessage("salvar o Jira")),
  });
}

export function useCredentials() {
  return useQuery({ queryKey: queryKeys.credentials, queryFn: configApi.credentials });
}

function invalidateIdentity(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.credentials });
  void qc.invalidateQueries({ queryKey: queryKeys.status });
  void qc.invalidateQueries({ queryKey: queryKeys.me });
  void qc.invalidateQueries({ queryKey: queryKeys.pullRequests });
}

export function useSaveCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.saveCredentials,
    onSuccess: () => {
      toast.success("Credenciais do Bitbucket validadas e salvas.");
      invalidateIdentity(qc);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status !== 500
          ? error.message
          : failureMessage("salvar as credenciais"),
      ),
  });
}

export function useClearCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.clearCredentials,
    onSuccess: () => {
      toast.success("Credenciais removidas. Voltando a usar o .env.");
      invalidateIdentity(qc);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 403
          ? error.message
          : failureMessage("remover as credenciais"),
      ),
  });
}

export function useSavedViews() {
  return useQuery({ queryKey: queryKeys.views, queryFn: configApi.views });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.createView,
    onSuccess: () => {
      toast.success("Visão salva.");
      void qc.invalidateQueries({ queryKey: queryKeys.views });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : failureMessage("salvar a visão")),
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<SavedViewInput> }) =>
      configApi.updateView(id, input),
    onSuccess: () => {
      toast.success("Visão atualizada.");
      void qc.invalidateQueries({ queryKey: queryKeys.views });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : failureMessage("atualizar a visão")),
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configApi.deleteView,
    onSuccess: () => {
      toast.success("Visão excluída.");
      void qc.invalidateQueries({ queryKey: queryKeys.views });
    },
    onError: () => toast.error(failureMessage("excluir a visão")),
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
