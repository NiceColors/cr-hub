import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { extractJiraKey, parseJiraProjectKeys, prKey } from "@/domain/pull-request";
import {
  REVIEW_SCOPES,
  type FindingKind,
  type ReviewScope,
  type TestOutcome,
} from "@/domain/test-report";
import { db } from "@/lib/db";
import {
  reviewSessions,
  testEvidence,
  testFindings,
  testReportMembers,
  testReports,
} from "@/lib/db/schema";
import { getSettings } from "@/services/configService";

export const EVIDENCE_LIMIT = 8;
export const EVIDENCE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

const CONTENT_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const SCOPES = new Set<string>(REVIEW_SCOPES);

export class TestReportError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TestReportError";
  }
}

export type ReportSubjectInput = {
  prKey: string;
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
};

export type ReportFindingInput = {
  id: number | null;
  tempId: string;
  kind: FindingKind;
  body: string;
};

export type ReportEvidenceInput = {
  id: number;
  caption: string;
  findingId: number | null;
  findingTempId: string | null;
};

export type SaveTestReportInput = {
  title: string;
  url: string;
  repoSlug: string;
  outcome: TestOutcome;
  howTested: string;
  findings: ReportFindingInput[];
  evidence: ReportEvidenceInput[];
  subjects?: ReportSubjectInput[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Subject = ReportSubjectInput;

function evidenceDir() {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "evidence");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function evidencePath(fileName: string) {
  const safe = path.basename(fileName);
  return path.join(evidenceDir(), safe);
}

function jiraKeyFor(title: string) {
  return extractJiraKey(title, null, parseJiraProjectKeys(getSettings().jiraProjectKeys));
}

function asScope(value: string): ReviewScope {
  return SCOPES.has(value) ? (value as ReviewScope) : "cr";
}

function toSubject(row: {
  prKey: string;
  repoUuid: string;
  prId: number;
  title: string;
  url: string;
  repoSlug: string;
}): Subject {
  return {
    prKey: row.prKey,
    repoUuid: row.repoUuid,
    prId: row.prId,
    title: row.title,
    url: row.url,
    repoSlug: row.repoSlug,
  };
}

function normalizeSubjects(subjects: ReportSubjectInput[]) {
  const seen = new Set<string>();
  const result: Subject[] = [];
  for (const subject of subjects) {
    const key = prKey(subject.repoUuid, subject.prId);
    if (subject.prKey !== key) {
      throw new TestReportError("BAD_REQUEST", "CR inválido.", 400);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...subject,
      prKey: key,
      title: subject.title.trim(),
      url: subject.url,
      repoSlug: subject.repoSlug.trim(),
    });
  }
  if (result.length === 0) {
    throw new TestReportError("BAD_REQUEST", "A revisão precisa de ao menos um CR.", 400);
  }
  return result;
}

function subjectsFor(reportIds: number[]) {
  if (reportIds.length === 0) return new Map<number, Subject[]>();
  const rows = db
    .select()
    .from(testReportMembers)
    .where(inArray(testReportMembers.reportId, reportIds))
    .all();
  const grouped = new Map<number, Subject[]>();
  for (const row of rows) {
    const list = grouped.get(row.reportId) ?? [];
    list.push(toSubject(row));
    grouped.set(row.reportId, list);
  }
  return grouped;
}

function latestTimes() {
  const rows = db
    .select()
    .from(reviewSessions)
    .orderBy(desc(reviewSessions.completedAt), desc(reviewSessions.id))
    .all();
  const times = new Map<string, number>();
  for (const row of rows) {
    if (!times.has(row.prKey)) times.set(row.prKey, row.timeSpentMs);
  }
  return times;
}

function sumTimes(subjects: Subject[], times: Map<string, number>) {
  let total = 0;
  let any = false;
  for (const subject of subjects) {
    const spent = times.get(subject.prKey);
    if (spent === undefined) continue;
    any = true;
    total += spent;
  }
  return any ? total : null;
}

function sessionFor(subjects: Subject[]) {
  if (subjects.length === 0) return null;
  const keys = subjects.map((subject) => subject.prKey);
  const rows = db
    .select()
    .from(reviewSessions)
    .where(inArray(reviewSessions.prKey, keys))
    .orderBy(desc(reviewSessions.completedAt), desc(reviewSessions.id))
    .all();
  const seen = new Set<string>();
  let total = 0;
  let newest: (typeof rows)[number] | null = null;
  for (const row of rows) {
    if (seen.has(row.prKey)) continue;
    seen.add(row.prKey);
    total += row.timeSpentMs;
    if (!newest || row.completedAt.getTime() > newest.completedAt.getTime()) newest = row;
  }
  if (!newest) return null;
  return {
    timeSpentMs: total,
    completedAt: newest.completedAt.getTime(),
    title: newest.title,
    url: newest.url,
    repoSlug: newest.repoSlug,
    jiraKey: newest.jiraKey ?? jiraKeyFor(newest.title),
  };
}

function replaceMembers(tx: Tx, reportId: number, subjects: Subject[]) {
  tx.delete(testReportMembers).where(eq(testReportMembers.reportId, reportId)).run();
  for (const subject of subjects) {
    tx.insert(testReportMembers).values({ reportId, ...subject }).run();
  }
}

export function listTestReports() {
  const reports = db
    .select()
    .from(testReports)
    .orderBy(desc(testReports.updatedAt), desc(testReports.id))
    .limit(80)
    .all();
  const grouped = subjectsFor(reports.map((report) => report.id));
  const times = latestTimes();
  return {
    reports: reports.map((report) => {
      const subjects = grouped.get(report.id) ?? [];
      return {
        id: report.id,
        scope: asScope(report.scope),
        title: report.title,
        outcome: report.outcome as TestOutcome,
        updatedAt: report.updatedAt.getTime(),
        subjects,
        projectId: report.projectId,
        timeSpentMs: sumTimes(subjects, times),
      };
    }),
  };
}

export function latestReportIdForPullRequest(repoUuid: string, prId: number) {
  const key = prKey(repoUuid, prId);
  const links = db
    .select({ reportId: testReportMembers.reportId })
    .from(testReportMembers)
    .where(eq(testReportMembers.prKey, key))
    .all();
  if (links.length === 0) return null;
  const row = db
    .select({ id: testReports.id })
    .from(testReports)
    .where(
      inArray(
        testReports.id,
        links.map((link) => link.reportId),
      ),
    )
    .orderBy(desc(testReports.updatedAt), desc(testReports.id))
    .get();
  return row?.id ?? null;
}

export function getTestReport(id: number) {
  const report = db.select().from(testReports).where(eq(testReports.id, id)).get() ?? null;
  if (!report) return { report: null, lastSession: null };
  const findings = db
    .select()
    .from(testFindings)
    .where(eq(testFindings.reportId, id))
    .orderBy(asc(testFindings.sortOrder), asc(testFindings.id))
    .all();
  const evidence = db
    .select()
    .from(testEvidence)
    .where(eq(testEvidence.reportId, id))
    .orderBy(asc(testEvidence.sortOrder), asc(testEvidence.id))
    .all();
  const subjects = subjectsFor([id]).get(id) ?? [];
  const scope = asScope(report.scope);
  const primary = subjects[0] ?? null;
  const lastSession = sessionFor(subjects);
  return {
    report: {
      id: report.id,
      scope,
      timeSpentMs: lastSession?.timeSpentMs ?? null,
      title: report.title,
      prKey: scope === "cr" ? (report.prKey ?? primary?.prKey ?? null) : null,
      repoUuid: scope === "cr" ? (report.repoUuid ?? primary?.repoUuid ?? null) : null,
      prId: scope === "cr" ? (report.prId ?? primary?.prId ?? null) : null,
      url: report.url,
      repoSlug: report.repoSlug,
      jiraKey: report.jiraKey ?? jiraKeyFor(report.title),
      outcome: report.outcome as TestOutcome,
      howTested: report.howTested,
      updatedAt: report.updatedAt.getTime(),
      projectId: report.projectId,
      subjects,
      findings: findings.map((finding) => ({
        id: finding.id,
        kind: finding.kind as FindingKind,
        body: finding.body,
        sortOrder: finding.sortOrder,
      })),
      evidence: evidence.map((shot) => ({
        id: shot.id,
        findingId: shot.findingId,
        caption: shot.caption,
        contentType: shot.contentType,
        sortOrder: shot.sortOrder,
        createdAt: shot.createdAt.getTime(),
      })),
    },
    lastSession,
  };
}

export function getTestReportForPullRequest(repoUuid: string, prId: number) {
  const id = latestReportIdForPullRequest(repoUuid, prId);
  if (id === null) {
    const key = prKey(repoUuid, prId);
    const last =
      db
        .select()
        .from(reviewSessions)
        .where(eq(reviewSessions.prKey, key))
        .orderBy(desc(reviewSessions.completedAt), desc(reviewSessions.id))
        .get() ?? null;
    return {
      report: null,
      lastSession: last
        ? {
            timeSpentMs: last.timeSpentMs,
            completedAt: last.completedAt.getTime(),
            title: last.title,
            url: last.url,
            repoSlug: last.repoSlug,
            jiraKey: last.jiraKey ?? jiraKeyFor(last.title),
          }
        : null,
    };
  }
  return getTestReport(id);
}

export function createTestReport(input: {
  scope: ReviewScope;
  title: string;
  subjects: ReportSubjectInput[];
  projectId?: number | null;
}) {
  if (!SCOPES.has(input.scope)) {
    throw new TestReportError("BAD_REQUEST", "Tipo de revisão inválido.", 400);
  }
  const subjects = normalizeSubjects(input.subjects);
  const title = input.scope === "cr" ? subjects[0]?.title ?? "" : input.title.trim();
  if (input.scope === "cr" && subjects.length !== 1) {
    throw new TestReportError("BAD_REQUEST", "A revisão de CR usa um único CR.", 400);
  }
  if (!title) {
    throw new TestReportError("BAD_REQUEST", "Dê um nome para a revisão.", 400);
  }
  const primary = input.scope === "cr" ? subjects[0] : null;
  const inserted = db
    .insert(testReports)
    .values({
      scope: input.scope,
      title,
      prKey: primary?.prKey ?? null,
      repoUuid: primary?.repoUuid ?? null,
      prId: primary?.prId ?? null,
      url: primary?.url ?? "",
      repoSlug: primary?.repoSlug ?? "",
      jiraKey: jiraKeyFor(title),
      outcome: "partial",
      howTested: "",
      projectId: input.projectId ?? null,
      updatedAt: new Date(),
    })
    .run();
  const id = Number(inserted.lastInsertRowid);
  db.transaction((tx) => {
    replaceMembers(tx, id, subjects);
  });
  return getTestReport(id);
}

export function saveTestReport(id: number, input: SaveTestReportInput) {
  const findings = input.findings.flatMap((finding) => {
    const body = finding.body.trim();
    return body ? [{ ...finding, body }] : [];
  });

  db.transaction((tx) => {
    const report = tx.select().from(testReports).where(eq(testReports.id, id)).get();
    if (!report) throw new TestReportError("NOT_FOUND", "Revisão não encontrada.", 404);
    const scope = asScope(report.scope);
    const title = input.title.trim();
    if (!title) throw new TestReportError("BAD_REQUEST", "Dê um nome para a revisão.", 400);

    tx.update(testReports)
      .set({
        title,
        url: scope === "cr" ? input.url : report.url,
        repoSlug: scope === "cr" ? input.repoSlug : report.repoSlug,
        jiraKey: jiraKeyFor(title),
        outcome: input.outcome,
        howTested: input.howTested.trim(),
        updatedAt: new Date(),
      })
      .where(eq(testReports.id, id))
      .run();

    if (scope === "cr") {
      tx.update(testReportMembers)
        .set({ title, url: input.url, repoSlug: input.repoSlug })
        .where(eq(testReportMembers.reportId, id))
        .run();
    } else if (input.subjects) {
      replaceMembers(tx, id, normalizeSubjects(input.subjects));
    }

    const kept = new Set<number>();
    const idByTemp = new Map<string, number>();
    findings.forEach((finding, index) => {
      if (finding.id !== null) {
        const row = tx
          .select()
          .from(testFindings)
          .where(and(eq(testFindings.id, finding.id), eq(testFindings.reportId, id)))
          .get();
        if (!row) return;
        tx.update(testFindings)
          .set({ kind: finding.kind, body: finding.body, sortOrder: index })
          .where(eq(testFindings.id, finding.id))
          .run();
        kept.add(finding.id);
        idByTemp.set(finding.tempId, finding.id);
        return;
      }
      const inserted = tx
        .insert(testFindings)
        .values({ reportId: id, kind: finding.kind, body: finding.body, sortOrder: index })
        .run();
      const created = Number(inserted.lastInsertRowid);
      kept.add(created);
      idByTemp.set(finding.tempId, created);
    });

    const current = tx.select().from(testFindings).where(eq(testFindings.reportId, id)).all();
    for (const row of current) {
      if (kept.has(row.id)) continue;
      tx.update(testEvidence).set({ findingId: null }).where(eq(testEvidence.findingId, row.id)).run();
      tx.delete(testFindings).where(eq(testFindings.id, row.id)).run();
    }

    for (const shot of input.evidence) {
      const findingId =
        shot.findingTempId !== null
          ? (idByTemp.get(shot.findingTempId) ?? null)
          : shot.findingId !== null && kept.has(shot.findingId)
            ? shot.findingId
            : null;
      tx.update(testEvidence)
        .set({ caption: shot.caption.trim(), findingId })
        .where(and(eq(testEvidence.id, shot.id), eq(testEvidence.reportId, id)))
        .run();
    }
  });

  return getTestReport(id);
}

export function saveTestReportForPullRequest(
  input: SaveTestReportInput & { repoUuid: string; prId: number },
) {
  let id = latestReportIdForPullRequest(input.repoUuid, input.prId);
  if (id === null) {
    const created = createTestReport({
      scope: "cr",
      title: input.title,
      subjects: [
        {
          prKey: prKey(input.repoUuid, input.prId),
          repoUuid: input.repoUuid,
          prId: input.prId,
          title: input.title,
          url: input.url,
          repoSlug: input.repoSlug,
        },
      ],
    });
    id = created.report?.id ?? null;
  }
  if (id === null) throw new TestReportError("NOT_FOUND", "Revisão não encontrada.", 404);
  return saveTestReport(id, input);
}

export function addEvidence(input: {
  reportId: number;
  caption: string;
  contentType: string;
  bytes: Buffer;
}) {
  const extension = CONTENT_TYPES.get(input.contentType);
  if (!extension) {
    throw new TestReportError(
      "UNSUPPORTED_TYPE",
      "A evidência precisa ser PNG, JPEG, WebP ou GIF.",
      415,
    );
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > EVIDENCE_MAX_BYTES) {
    throw new TestReportError("FILE_TOO_LARGE", "Cada evidência pode ter no máximo 1,5 MB.", 413);
  }
  const report = db.select().from(testReports).where(eq(testReports.id, input.reportId)).get();
  if (!report) throw new TestReportError("NOT_FOUND", "Revisão não encontrada.", 404);

  const count = db
    .select()
    .from(testEvidence)
    .where(eq(testEvidence.reportId, input.reportId))
    .all().length;
  if (count >= EVIDENCE_LIMIT) {
    throw new TestReportError(
      "EVIDENCE_FULL",
      `A ficha já tem ${EVIDENCE_LIMIT} evidências. Tire uma antes de colar outra.`,
      409,
    );
  }

  const fileName = `${randomUUID()}.${extension}`;
  const fullPath = evidencePath(fileName);
  fs.writeFileSync(fullPath, input.bytes);
  try {
    db.transaction((tx) => {
      const order =
        tx
          .select({ value: max(testEvidence.sortOrder) })
          .from(testEvidence)
          .where(eq(testEvidence.reportId, input.reportId))
          .get()?.value ?? -1;
      tx.insert(testEvidence)
        .values({
          reportId: input.reportId,
          findingId: null,
          fileName,
          contentType: input.contentType,
          caption: input.caption.trim(),
          sortOrder: order + 1,
          createdAt: new Date(),
        })
        .run();
    });
  } catch (error) {
    fs.rmSync(fullPath, { force: true });
    throw error;
  }

  return getTestReport(input.reportId);
}

export function removeEvidence(reportId: number, evidenceId: number) {
  const row = db
    .select()
    .from(testEvidence)
    .where(and(eq(testEvidence.id, evidenceId), eq(testEvidence.reportId, reportId)))
    .get();
  if (!row) throw new TestReportError("NOT_FOUND", "Evidência não encontrada.", 404);
  db.delete(testEvidence).where(eq(testEvidence.id, row.id)).run();
  fs.rmSync(evidencePath(row.fileName), { force: true });
  return getTestReport(reportId);
}

export function readEvidence(reportId: number, evidenceId: number) {
  const row = db
    .select()
    .from(testEvidence)
    .where(and(eq(testEvidence.id, evidenceId), eq(testEvidence.reportId, reportId)))
    .get();
  if (!row) return null;
  const fullPath = evidencePath(row.fileName);
  if (!fs.existsSync(fullPath)) return null;
  return { contentType: row.contentType, bytes: fs.readFileSync(fullPath) };
}

export function readEvidenceForPullRequest(repoUuid: string, prId: number, evidenceId: number) {
  const row = db.select().from(testEvidence).where(eq(testEvidence.id, evidenceId)).get();
  if (!row) return null;
  const key = prKey(repoUuid, prId);
  const member = db
    .select()
    .from(testReportMembers)
    .where(and(eq(testReportMembers.reportId, row.reportId), eq(testReportMembers.prKey, key)))
    .get();
  if (!member) return null;
  return readEvidence(row.reportId, evidenceId);
}

export function removeEvidenceForPullRequest(repoUuid: string, prId: number, evidenceId: number) {
  const row = db.select().from(testEvidence).where(eq(testEvidence.id, evidenceId)).get();
  if (!row) throw new TestReportError("NOT_FOUND", "Evidência não encontrada.", 404);
  const key = prKey(repoUuid, prId);
  const member = db
    .select()
    .from(testReportMembers)
    .where(and(eq(testReportMembers.reportId, row.reportId), eq(testReportMembers.prKey, key)))
    .get();
  if (!member) throw new TestReportError("NOT_FOUND", "Evidência não encontrada.", 404);
  return removeEvidence(row.reportId, evidenceId);
}
