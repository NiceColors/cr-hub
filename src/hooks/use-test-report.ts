"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FINDING_KINDS, REVIEW_SCOPES, TEST_OUTCOMES } from "@/domain/test-report";
import { ApiError, getJson, sendJson } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";

const findingSchema = z.object({
  id: z.number(),
  kind: z.enum(FINDING_KINDS),
  body: z.string(),
  sortOrder: z.number(),
});

const evidenceSchema = z.object({
  id: z.number(),
  findingId: z.number().nullable(),
  caption: z.string(),
  contentType: z.string(),
  sortOrder: z.number(),
  createdAt: z.number(),
});

const subjectSchema = z.object({
  prKey: z.string(),
  repoUuid: z.string(),
  prId: z.number(),
  title: z.string(),
  url: z.string(),
  repoSlug: z.string(),
});

const summarySchema = z.object({
  id: z.number(),
  scope: z.enum(REVIEW_SCOPES),
  title: z.string(),
  outcome: z.enum(TEST_OUTCOMES),
  updatedAt: z.number(),
  subjects: z.array(subjectSchema),
  projectId: z.number().nullable(),
  timeSpentMs: z.number().nullable(),
});

const reportSchema = summarySchema.extend({
  prKey: z.string().nullable(),
  repoUuid: z.string().nullable(),
  prId: z.number().nullable(),
  url: z.string(),
  repoSlug: z.string(),
  jiraKey: z.string().nullable(),
  howTested: z.string(),
  findings: z.array(findingSchema),
  evidence: z.array(evidenceSchema),
});

const lastSessionSchema = z.object({
  timeSpentMs: z.number(),
  completedAt: z.number(),
  title: z.string(),
  url: z.string(),
  repoSlug: z.string(),
  jiraKey: z.string().nullable(),
});

export const testReportResponseSchema = z.object({
  report: reportSchema.nullable(),
  lastSession: lastSessionSchema.nullable(),
});

const listSchema = z.object({
  reports: z.array(summarySchema),
});

export type TestReportResponse = z.infer<typeof testReportResponseSchema>;
export type TestReportSummary = z.infer<typeof summarySchema>;
export type ReportSubject = z.infer<typeof subjectSchema>;

export type SaveTestReportBody = {
  title: string;
  url: string;
  repoSlug: string;
  outcome: z.infer<typeof reportSchema.shape.outcome>;
  howTested: string;
  findings: { id: number | null; tempId: string; kind: z.infer<typeof findingSchema.shape.kind>; body: string }[];
  evidence: { id: number; caption: string; findingId: number | null; findingTempId: string | null }[];
  subjects?: ReportSubject[];
};

export type CreateTestReportBody = {
  scope: z.infer<typeof summarySchema.shape.scope>;
  title: string;
  subjects: ReportSubject[];
  projectId?: number | null;
};

function itemUrl(id: number) {
  return `/api/test-reports/item/${id}`;
}

export function useTestReports() {
  return useQuery({
    queryKey: queryKeys.testReports,
    queryFn: () => getJson("/api/test-reports", listSchema),
  });
}

export function useTestReport(id: number | null) {
  return useQuery({
    queryKey: id !== null ? queryKeys.testReport(id) : ["test-report", "none"],
    queryFn: () => getJson(itemUrl(id!), testReportResponseSchema),
    enabled: id !== null,
  });
}

export function useCreateTestReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTestReportBody) =>
      sendJson("/api/test-reports", "POST", body, testReportResponseSchema),
    onSuccess: (data) => {
      if (data.report) qc.setQueryData(queryKeys.testReport(data.report.id), data);
      void qc.invalidateQueries({ queryKey: queryKeys.testReports });
    },
  });
}

export function useSaveTestReport(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveTestReportBody) => {
      if (id === null) throw new Error("sem ficha");
      return sendJson(itemUrl(id), "PUT", body, testReportResponseSchema);
    },
    onSuccess: (data) => {
      if (data.report) qc.setQueryData(queryKeys.testReport(data.report.id), data);
      void qc.invalidateQueries({ queryKey: queryKeys.testReports });
    },
  });
}

export async function uploadEvidence(reportId: number, file: Blob, caption = "") {
  const body = new FormData();
  body.set("file", file, "evidencia.jpg");
  body.set("caption", caption);
  const res = await fetch(`${itemUrl(reportId)}/evidence`, { method: "POST", body });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(payload?.error?.message ?? "Não foi possível guardar a evidência.", res.status);
  }
  const parsed = testReportResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new ApiError("Resposta inválida ao guardar a evidência.", res.status);
  return parsed.data;
}

export async function deleteEvidence(reportId: number, evidenceId: number) {
  return sendJson(
    `${itemUrl(reportId)}/evidence/${evidenceId}`,
    "DELETE",
    undefined,
    testReportResponseSchema,
  );
}
