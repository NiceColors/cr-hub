"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PROJECT_KINDS, PROJECT_STATUSES, type ProjectKind, type ProjectStatus } from "@/domain/project";
import { ApiError, getJson, sendJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import { failureMessage } from "@/hooks/use-config";
import type { PullRequestItem } from "@/hooks/use-pull-requests";

const linkSchema = z.object({
  prKey: z.string(),
  repoUuid: z.string(),
  prId: z.number(),
  title: z.string(),
  url: z.string(),
  repoSlug: z.string(),
  authorName: z.string().nullable(),
  addedAt: z.number(),
});

const projectSchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(PROJECT_KINDS),
  status: z.enum(PROJECT_STATUSES),
  notes: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  pullRequests: z.array(linkSchema),
});

export type ProjectLink = z.infer<typeof linkSchema>;
export type Project = z.infer<typeof projectSchema>;

const listSchema = z.object({ projects: z.array(projectSchema) });
const oneSchema = z.object({ project: projectSchema });

const NO_PROJECTS: Project[] = [];

export function useProjects() {
  const query = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => getJson("/api/projects", listSchema),
  });
  return { query, projects: query.data?.projects ?? NO_PROJECTS };
}

export function projectsForPullRequest(projects: Project[], key: string) {
  return projects.filter((project) => project.pullRequests.some((link) => link.prKey === key));
}

export function pullRequestLinkInput(pr: PullRequestItem) {
  return {
    repoUuid: pr.repository.uuid,
    prId: pr.id,
    title: pr.title,
    url: pr.url,
    repoSlug: pr.repository.slug,
    authorName: pr.author.displayName,
  };
}

function errorText(error: unknown, action: string) {
  return error instanceof ApiError && error.status < 500 ? error.message : failureMessage(action);
}

export type ProjectDraft = {
  name: string;
  kind: ProjectKind;
  notes?: string | null;
};

export function useProjectActions() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.projects });

  const create = useMutation({
    mutationFn: (draft: ProjectDraft) => sendJson("/api/projects", "POST", draft, oneSchema),
    onSuccess: (data) => {
      toast.success(`${data.project.name} criado.`);
      invalidate();
    },
    onError: (error) => toast.error(errorText(error, "criar o projeto")),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<ProjectDraft> & { status?: ProjectStatus };
    }) => sendJson(`/api/projects/${id}`, "PATCH", patch, oneSchema),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorText(error, "salvar o projeto")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => sendJson(`/api/projects/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Projeto excluído.");
      invalidate();
    },
    onError: (error) => toast.error(errorText(error, "excluir o projeto")),
  });

  const link = useMutation({
    mutationFn: ({ projectId, pr }: { projectId: number; pr: PullRequestItem }) =>
      sendJson(`/api/projects/${projectId}/links`, "POST", pullRequestLinkInput(pr)),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorText(error, "vincular o CR")),
  });

  const unlink = useMutation({
    mutationFn: ({ projectId, prKey }: { projectId: number; prKey: string }) =>
      sendJson(`/api/projects/${projectId}/links?prKey=${encodeURIComponent(prKey)}`, "DELETE"),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorText(error, "tirar o vínculo")),
  });

  return { create, update, remove, link, unlink };
}
