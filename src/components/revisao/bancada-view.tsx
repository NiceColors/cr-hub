"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  BugIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClipboardCopyIcon,
  HistoryIcon,
  ImageIcon,
  ImagePlusIcon,
  LayersIcon,
  LayoutPanelTopIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  NotebookPenIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from "@/components/motion/alert";
import { Button } from "@/components/motion/button/base";
import {
  CARD_TARGET_CLASS,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/motion/card";
import { Input } from "@/components/motion/input";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { PageHeader } from "@/components/page-header";
import { PROJECT_KIND_ICONS } from "@/components/projects/project-kind";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bancadaPath,
  evidenceUrl,
  revisaoPath,
  splitPrKey,
} from "@/components/revisao/bancada-path";
import { shrinkImage } from "@/components/revisao/shrink-image";
import { PROJECT_KIND_LABELS, type ProjectKind } from "@/domain/project";
import { extractJiraKey, parseJiraProjectKeys } from "@/domain/pull-request";
import {
  buildJiraComment,
  buildJiraHtml,
  buildKiroPrompt,
  describeTestReport,
  SCOPE_LABEL,
  type FindingKind,
  type ReviewScope,
  type TestOutcome,
  type TestReportDraft,
} from "@/domain/test-report";
import { formatDuration } from "@/domain/weekly-report";
import { useSettings } from "@/hooks/use-config";
import { useProjects, type Project } from "@/hooks/use-projects";
import { useReviews } from "@/hooks/use-reviews";
import {
  deleteEvidence,
  uploadEvidence,
  useCreateTestReport,
  useSaveTestReport,
  useTestReport,
  useTestReports,
  type ReportSubject,
  type TestReportResponse,
} from "@/hooks/use-test-report";
import { EASE_OUT } from "@/lib/ease";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const FIELD =
  "min-h-20 w-full resize-y rounded-2xl border border-border bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/40";

const NO_FINDING = "none";

const OUTCOMES: { value: TestOutcome; label: string; icon: ReactNode }[] = [
  { value: "pass", label: "Passou", icon: <CircleCheckIcon /> },
  { value: "partial", label: "Parcial", icon: <CircleAlertIcon /> },
  { value: "fail", label: "Falhou", icon: <CircleXIcon /> },
];

const KIND_LABEL: Record<FindingKind, string> = {
  step: "Passo",
  error: "Erro",
  layout: "Layout",
};

const KIND_ICON: Record<FindingKind, ReactNode> = {
  step: <ListChecksIcon />,
  error: <BugIcon />,
  layout: <LayoutPanelTopIcon />,
};

const ENTER = { duration: 0.22, ease: EASE_OUT };

const stamp = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type DraftFinding = {
  key: string;
  id: number | null;
  kind: FindingKind;
  body: string;
};

type DraftShot = {
  id: number;
  caption: string;
  findingKey: string | null;
};

type Draft = {
  scope: ReviewScope;
  projectId: number | null;
  title: string;
  url: string;
  repoSlug: string;
  outcome: TestOutcome;
  howTested: string;
  findings: DraftFinding[];
  shots: DraftShot[];
  subjects: ReportSubject[];
};

const SCOPE_NAME: Record<ReviewScope, string> = {
  cr: "CR",
  feature: "Feature",
  project: "Projeto",
  page: "Página",
};

const SCOPE_ICON: Record<ReviewScope, ReactNode> = {
  cr: <ListChecksIcon />,
  feature: <LayersIcon />,
  project: <LayoutPanelTopIcon />,
  page: <ImageIcon />,
};

const OUTCOME_TONE: Record<TestOutcome, string> = {
  pass: "bg-success/15 text-success-foreground",
  partial: "bg-warning/20 text-warning-foreground",
  fail: "bg-destructive/15 text-destructive-foreground",
};

const OUTCOME_TEXT: Record<TestOutcome, string> = {
  pass: "text-success-foreground",
  partial: "text-warning-foreground",
  fail: "text-destructive-foreground",
};

function memberOf(subject: ReportSubject & { jiraKey?: string | null }): ReportSubject {
  return {
    prKey: subject.prKey,
    repoUuid: subject.repoUuid,
    prId: subject.prId,
    title: subject.title,
    url: subject.url,
    repoSlug: subject.repoSlug,
  };
}

function scopeForProject(kind: ProjectKind): ReviewScope {
  return kind === "feature" ? "feature" : "project";
}

function subjectsOf(project: Project): ReportSubject[] {
  return project.pullRequests.flatMap((link) => {
    if (!link.title.trim() || !link.repoSlug.trim()) return [];
    try {
      new URL(link.url);
    } catch {
      return [];
    }
    return [memberOf(link)];
  });
}

function subjectLabel(
  subject: { title: string; repoSlug: string; prId: number },
  keys: string[],
) {
  const jira = extractJiraKey(subject.title, null, keys);
  const ref = `${subject.repoSlug} #${subject.prId}`;
  return jira ? `${jira} · ${ref}` : ref;
}

function draftFromServer(data: TestReportResponse): Draft | null {
  const report = data.report;
  if (!report) return null;
  const findings: DraftFinding[] = report.findings.map((finding) => ({
    key: `id:${finding.id}`,
    id: finding.id,
    kind: finding.kind,
    body: finding.body,
  }));
  const keyById = new Map(findings.map((finding) => [finding.id, finding.key]));
  return {
    scope: report.scope,
    projectId: report.projectId,
    title: report.title,
    url: report.url,
    repoSlug: report.repoSlug,
    outcome: report.outcome,
    howTested: report.howTested,
    findings,
    shots: report.evidence.map((shot) => ({
      id: shot.id,
      caption: shot.caption,
      findingKey: shot.findingId === null ? null : (keyById.get(shot.findingId) ?? null),
    })),
    subjects: report.subjects,
  };
}

function assignFindingIds(current: Draft, snapshot: Draft, data: TestReportResponse): Draft {
  const server = data.report?.findings ?? [];
  const sent = snapshot.findings.filter((finding) => finding.body.trim());
  const idByKey = new Map<string, number>();
  sent.forEach((finding, index) => {
    const saved = server[index];
    if (saved) idByKey.set(finding.key, saved.id);
  });
  return {
    ...current,
    findings: current.findings.map((finding) => ({
      ...finding,
      id: idByKey.get(finding.key) ?? finding.id,
    })),
  };
}

function toSaveBody(draft: Draft) {
  return {
    title: draft.title,
    url: draft.url,
    repoSlug: draft.repoSlug,
    outcome: draft.outcome,
    howTested: draft.howTested,
    findings: draft.findings.map((finding) => ({
      id: finding.id,
      tempId: finding.key,
      kind: finding.kind,
      body: finding.body,
    })),
    evidence: draft.shots.map((shot) => {
      const finding = draft.findings.find((item) => item.key === shot.findingKey) ?? null;
      return {
        id: shot.id,
        caption: shot.caption,
        findingId: finding?.id ?? null,
        findingTempId: finding && finding.id === null ? finding.key : null,
      };
    }),
    subjects: draft.scope === "cr" ? undefined : draft.subjects,
  };
}

/** O clipboard do navegador só aceita imagem em PNG. */
async function toPng(blob: Blob) {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("png"))), "image/png");
  });
}

export function BancadaView() {
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const router = useRouter();
  const idRaw = Number(params.get("id"));
  const reportId = Number.isInteger(idRaw) && idRaw > 0 ? idRaw : null;
  const prParam = params.get("pr");
  const titleParam = params.get("title") ?? "";
  const urlParam = params.get("url") ?? "";
  const slugParam = params.get("slug") ?? "";

  const reviews = useReviews();
  const { projects, query: projectQuery } = useProjects();
  const reports = useTestReports();
  const reportQuery = useTestReport(reportId);
  const save = useSaveTestReport(reportId);
  const create = useCreateTestReport();
  const qc = useQueryClient();
  const settings = useSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasteSteps, setPasteSteps] = useState<number[] | null>(null);
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [lane, setLane] = useState<"open" | "history">("open");
  const [composer, setComposer] = useState<"cr" | "project" | null>(null);
  const [pickedCr, setPickedCr] = useState<string | null>(null);
  const [pickedProject, setPickedProject] = useState<number | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const seeded = useRef<number | null>(null);
  const boot = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    seeded.current = null;
  }, [reportId]);

  useEffect(() => {
    if (reportId !== null || !prParam || !reports.isSuccess) return;
    if (boot.current === prParam) return;
    const list = reports.data?.reports ?? [];
    const match = list.find((item) => item.subjects.some((subject) => subject.prKey === prParam));
    if (match) {
      boot.current = prParam;
      router.replace(revisaoPath(match.id));
      return;
    }
    const identity = splitPrKey(prParam);
    if (!identity || !urlParam) return;
    boot.current = prParam;
    create.mutate(
      {
        scope: "cr",
        title: titleParam || "PR",
        subjects: [
          {
            prKey: prParam,
            repoUuid: identity.repoUuid,
            prId: identity.prId,
            title: titleParam || "PR",
            url: urlParam,
            repoSlug: slugParam || "repo",
          },
        ],
      },
      {
        onSuccess: (data) => {
          if (data.report) router.replace(revisaoPath(data.report.id));
        },
      },
    );
  }, [reportId, prParam, reports.isSuccess, reports.data, urlParam, titleParam, slugParam, router, create]);

  useEffect(() => {
    if (reportId === null || !reportQuery.isSuccess || !reportQuery.data?.report) return;
    if (seeded.current === reportId) return;
    seeded.current = reportId;
    setDraft(draftFromServer(reportQuery.data));
    setDirty(false);
    setPasteSteps(null);
  }, [reportId, reportQuery.isSuccess, reportQuery.data]);

  const saveReport = save.mutateAsync;
  useEffect(() => {
    if (!dirty || reportId === null || !draftRef.current) return;
    const snapshot = draftRef.current;
    const handle = setTimeout(() => {
      void saveReport(toSaveBody(snapshot)).then(
        (data) => {
          setDraft((current) => (current ? assignFindingIds(current, snapshot, data) : current));
          if (draftRef.current === snapshot) setDirty(false);
        },
        () => toast.error("Não foi possível salvar a ficha."),
      );
    }, 700);
    return () => clearTimeout(handle);
  }, [dirty, draft, reportId, saveReport]);

  const jiraKeys = parseJiraProjectKeys(settings.data?.jiraProjectKeys);
  const jiraKey = draft ? extractJiraKey(draft.title, null, jiraKeys) : null;
  const timeSpentMs = (() => {
    if (!draft) return null;
    const latest = reviews.data?.latest;
    if (latest) {
      let total = 0;
      let any = false;
      for (const subject of draft.subjects) {
        const row = latest[subject.prKey];
        if (!row) continue;
        any = true;
        total += row.timeSpentMs;
      }
      if (any) return total;
    }
    return reportQuery.data?.lastSession?.timeSpentMs ?? null;
  })();

  const commentDraft: TestReportDraft | null = draft
    ? {
        jiraKey: draft.scope === "cr" ? jiraKey : extractJiraKey(draft.title, null, jiraKeys),
        repoSlug: draft.subjects[0]?.repoSlug || draft.repoSlug || "repo",
        prId: draft.subjects[0]?.prId ?? 0,
        outcome: draft.outcome,
        howTested: draft.howTested,
        findings: draft.findings.map((finding) => ({ kind: finding.kind, body: finding.body })),
        shots: draft.shots.map((shot) => {
          const findingIndex = draft.findings.findIndex((finding) => finding.key === shot.findingKey);
          return {
            caption: shot.caption,
            findingIndex: findingIndex === -1 ? null : findingIndex,
          };
        }),
        timeSpentMs,
        scope: draft.scope,
        scopeTitle: draft.scope === "cr" ? undefined : draft.title,
        scopeLabel:
          draft.projectId === null
            ? undefined
            : PROJECT_KIND_LABELS[
                projects.find((project) => project.id === draft.projectId)?.kind ?? "project"
              ].toLocaleLowerCase("pt-BR"),
        subjects: draft.subjects.map((subject) => ({ label: subjectLabel(subject, jiraKeys) })),
      }
    : null;

  function patch(update: (current: Draft) => Draft) {
    setDraft((current) => (current ? update(current) : current));
    setDirty(true);
  }

  const addFiles = useCallback(async (files: File[]) => {
    if (reportId === null || !draftRef.current) {
      toast.error("Abra uma revisão antes de colar a evidência.");
      return;
    }
    const current = draftRef.current;
    const room = 8 - current.shots.length;
    if (room <= 0) {
      toast.error("A ficha já tem 8 evidências.");
      return;
    }
    for (const file of files.slice(0, room)) {
      try {
        const blob = await shrinkImage(file);
        const data = await uploadEvidence(reportId, blob);
        qc.setQueryData(queryKeys.testReport(reportId), data);
        const known = new Set(draftRef.current?.shots.map((shot) => shot.id));
        const created = data.report?.evidence.filter((shot) => !known.has(shot.id)) ?? [];
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                shots: [
                  ...prev.shots,
                  ...created.map((shot) => ({ id: shot.id, caption: shot.caption, findingKey: null })),
                ],
              }
            : prev,
        );
      } catch {
        toast.error("Não foi possível guardar a evidência. Use uma imagem de até 1,5 MB.");
      }
    }
  }, [reportId, qc]);

  useEffect(() => {
    if (reportId === null) return;
    function onPaste(event: ClipboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [reportId, addFiles]);

  async function removeShot(id: number) {
    if (reportId === null) return;
    setDraft((current) =>
      current ? { ...current, shots: current.shots.filter((shot) => shot.id !== id) } : current,
    );
    try {
      const data = await deleteEvidence(reportId, id);
      qc.setQueryData(queryKeys.testReport(reportId), data);
    } catch {
      toast.error("Não foi possível tirar a evidência.");
    }
  }

  async function flush() {
    const snapshot = draftRef.current;
    if (!snapshot || reportId === null || !dirty) return snapshot;
    const data = await saveReport(toSaveBody(snapshot));
    setDraft((current) => (current ? assignFindingIds(current, snapshot, data) : current));
    if (draftRef.current === snapshot) setDirty(false);
    return snapshot;
  }

  function openCreated(data: TestReportResponse) {
    if (!data.report) return;
    setComposer(null);
    setPickedCr(null);
    setPickedProject(null);
    router.push(revisaoPath(data.report.id));
  }

  function anotherForThisCr() {
    const subject = draft?.subjects[0];
    if (!subject || draft?.scope !== "cr") return;
    create.mutate({ scope: "cr", title: subject.title, subjects: [subject] }, { onSuccess: openCreated });
  }

  function startComposer() {
    if (!composer) return;
    if (composer === "cr") {
      const subject = knownCrs.find((item) => item.prKey === pickedCr);
      if (!subject) return;
      create.mutate(
        { scope: "cr", title: subject.title, subjects: [memberOf(subject)] },
        { onSuccess: openCreated },
      );
      return;
    }
    const project = projects.find((item) => item.id === pickedProject);
    if (!project) return;
    openProject(project);
  }

  function openProject(project: Project) {
    const existing = fichas.find((ficha) => ficha.projectId === project.id);
    if (existing) {
      router.push(revisaoPath(existing.id));
      return;
    }
    const subjects = subjectsOf(project);
    if (subjects.length === 0) {
      toast.error("Esse projeto ainda não tem CRs. Vincule na fila.");
      return;
    }
    create.mutate(
      {
        scope: scopeForProject(project.kind),
        title: project.name,
        projectId: project.id,
        subjects,
      },
      {
        onSuccess: openCreated,
        onError: () => toast.error("Não foi possível abrir a revisão desse projeto."),
      },
    );
  }

  async function copyJira() {
    if (!commentDraft || reportId === null || !draft) return;
    try {
      await flush();
      const plain = buildJiraComment(commentDraft);
      const html = buildJiraHtml(commentDraft, []);
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      if (draft.shots.length === 0) {
        setPasteSteps(null);
        toast.success("Comentário copiado para o Jira.");
        return;
      }
      setPasteSteps([]);
      toast.success("Texto copiado. Cole no Jira e depois cada imagem, na ordem.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function copyKiro() {
    if (!commentDraft) return;
    try {
      await flush();
      await navigator.clipboard.writeText(buildKiroPrompt(commentDraft));
      toast.success("Instrução copiada para o Kiro.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function copyShot(id: number) {
    if (reportId === null) return;
    try {
      const res = await fetch(evidenceUrl(reportId, id));
      if (!res.ok) throw new Error("missing");
      const png = toPng(await res.blob());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setPasteSteps((current) => (current && !current.includes(id) ? [...current, id] : current));
      toast.success("Imagem copiada. Cole no Jira.");
    } catch {
      toast.error("Não foi possível copiar a imagem.");
    }
  }

  const fichas = reports.data?.reports ?? [];
  const orderedProjects = projects.toSorted((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt");
  });
  const looseFichas = fichas.filter((ficha) => ficha.projectId === null);
  const picked = projects.find((project) => project.id === pickedProject) ?? null;
  const pickedReady = picked !== null && subjectsOf(picked).length > 0;
  const linkedProject = projects.find((project) => project.id === draft?.projectId) ?? null;
  const sessions = reviews.data?.sessions ?? [];
  const historyKey = draft?.scope === "cr" ? (draft.subjects[0]?.prKey ?? null) : null;
  const historySelectedId = sessions.find((session) => session.prKey === historyKey)?.id ?? null;
  const knownCrs = (() => {
    const map = new Map<string, ReportSubject & { jiraKey: string | null }>();
    for (const session of reviews.data?.sessions ?? []) {
      if (map.has(session.prKey)) continue;
      map.set(session.prKey, {
        prKey: session.prKey,
        repoUuid: session.repoUuid,
        prId: session.prId,
        title: session.title,
        url: session.url,
        repoSlug: session.repoSlug,
        jiraKey: session.jiraKey,
      });
    }
    return [...map.values()];
  })();
  const saveLabel = save.isPending ? "Salvando…" : dirty ? "Alterações por salvar" : "Salvo";
  const findingOptions = [
    { value: NO_FINDING, label: "Sem achado" },
    ...(draft?.findings ?? []).map((finding, index) => ({
      value: finding.key,
      label: `${KIND_LABEL[finding.kind]} ${index + 1}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Homologação"
        description="Os projetos da fila, no tipo de cada um, e a ficha de um CR."
      />

      <Alert variant="info" open>
        <AlertIcon />
        <AlertContent>
          <AlertTitle>Página em construção</AlertTitle>
          <AlertDescription>
            A Homologação ainda está em construção. O que você vê aqui pode mudar.
          </AlertDescription>
        </AlertContent>
      </Alert>

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Revisões" className="flex flex-col gap-3 lg:sticky lg:top-16">
          <div className="flex flex-col gap-2 px-1">
            <h2 className="sr-only">Revisões</h2>
            <Tabs
              value={lane}
              onValueChange={(value) => setLane(value === "history" ? "history" : "open")}
              variant="segment"
              icons="selected"
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="open" icon={<NotebookPenIcon className="size-4" />}>
                  A revisar
                </TabsTrigger>
                <TabsTrigger value="history" icon={<HistoryIcon className="size-4" />}>
                  Histórico
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {lane === "open" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={composer !== null}
                onClick={() => setComposer((current) => (current ? null : "cr"))}
              >
                <PlusIcon className="size-3.5" />
                Nova
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Cada vez que um CR foi concluído no foco.</p>
            )}
          </div>
          <AnimatePresence initial={false}>
            {lane === "open" && composer ? (
            <motion.div
              key="composer"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={ENTER}
            >
            <Card size="compact">
              <CardHeader>
                <CardTitle as="h3">Nova revisão</CardTitle>
                <CardDescription>Um CR, ou um projeto que já existe na fila.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={composer === "cr" ? "primary" : "outline"}
                    aria-pressed={composer === "cr"}
                    onClick={() => setComposer("cr")}
                  >
                    <ListChecksIcon className="size-3.5" />
                    CR
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={composer === "project" ? "primary" : "outline"}
                    aria-pressed={composer === "project"}
                    onClick={() => setComposer("project")}
                  >
                    <LayersIcon className="size-3.5" />
                    Projeto
                  </Button>
                </div>
                {composer === "cr" ? (
                  <MenuSelect
                    label="CR"
                    value={pickedCr ?? "none"}
                    open={openSelect === "composer-cr"}
                    onOpenChange={(open) => setOpenSelect(open ? "composer-cr" : null)}
                    onValueChange={setPickedCr}
                    options={[
                      { value: "none", label: "Escolha um CR" },
                      ...knownCrs.map((item) => ({
                        value: item.prKey,
                        label: subjectLabel(item, jiraKeys),
                      })),
                    ]}
                  />
                ) : projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum projeto ainda. Crie na fila de CRs: o tipo — feature, fix, projeto — vale aqui também.
                  </p>
                ) : (
                  <MenuSelect
                    label="Projeto"
                    value={pickedProject === null ? "none" : String(pickedProject)}
                    open={openSelect === "composer-project"}
                    onOpenChange={(open) => setOpenSelect(open ? "composer-project" : null)}
                    onValueChange={(value) => setPickedProject(value === "none" ? null : Number(value))}
                    options={[
                      { value: "none", label: "Escolha um projeto" },
                      ...projects.map((project) => ({
                        value: String(project.id),
                        label: `${PROJECT_KIND_LABELS[project.kind]} · ${project.name}`,
                      })),
                    ]}
                  />
                )}
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    create.isPending ||
                    (composer === "cr" ? !pickedCr || pickedCr === "none" : !pickedReady)
                  }
                  onClick={startComposer}
                >
                  Criar ficha
                </Button>
              </CardFooter>
            </Card>
            </motion.div>
            ) : null}
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={lane}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={ENTER}
          >
          {lane === "history" ? (
            reviews.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </div>
            ) : sessions.length === 0 ? (
              <EmptyLane icon={<HistoryIcon />} text="Nenhuma revisão concluída ainda. No foco, conclua um CR para o tempo ficar aqui." />
            ) : (
              <ol className="flex flex-col gap-2">
                {sessions.map((session, index) => (
                  <motion.li
                    key={session.id}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...ENTER, delay: reduce ? 0 : Math.min(index, 8) * 0.04 }}
                  >
                    <Card
                      size="compact"
                      interactive
                      selected={session.id === historySelectedId}
                      className="py-3"
                    >
                      <CardContent>
                        <button
                          type="button"
                          aria-current={session.id === historySelectedId ? "true" : undefined}
                          onClick={() => {
                            const match =
                              fichas.find(
                                (item) =>
                                  item.scope === "cr" &&
                                  item.subjects.some((subject) => subject.prKey === session.prKey),
                              ) ??
                              fichas.find((item) =>
                                item.subjects.some((subject) => subject.prKey === session.prKey),
                              );
                            if (match) {
                              router.push(revisaoPath(match.id));
                              return;
                            }
                            boot.current = null;
                            router.push(
                              bancadaPath({
                                prKey: session.prKey,
                                title: session.title,
                                url: session.url,
                                repoSlug: session.repoSlug,
                              }),
                            );
                          }}
                          className={cn(CARD_TARGET_CLASS, "flex w-full items-center gap-3 text-left")}
                        >
                          <Mark className="bg-info/10 text-info-foreground">
                            <HistoryIcon />
                          </Mark>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{session.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {session.jiraKey ? `${session.jiraKey} · ` : ""}
                              {session.repoSlug} #{session.prId}
                              {" · "}
                              {stamp.format(session.completedAt)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatDuration(session.timeSpentMs)}
                          </span>
                        </button>
                      </CardContent>
                    </Card>
                  </motion.li>
                ))}
              </ol>
            )
          ) : reports.isLoading || projectQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : orderedProjects.length === 0 && looseFichas.length === 0 ? (
            <EmptyLane icon={<NotebookPenIcon />} text="Nenhum projeto na fila e nenhuma ficha de CR. Crie o projeto na fila, ou comece uma revisão de um CR." />
          ) : (
            <ol className="flex flex-col gap-2">
              {orderedProjects.map((project, index) => {
                const ficha = fichas.find((item) => item.projectId === project.id) ?? null;
                const count = project.pullRequests.length;
                return (
                  <motion.li
                    key={`project-${project.id}`}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...ENTER, delay: reduce ? 0 : Math.min(index, 8) * 0.04 }}
                  >
                    <Card size="compact" interactive selected={ficha?.id === reportId} className="py-3">
                      <CardContent>
                        <button
                          type="button"
                          aria-current={ficha?.id === reportId ? "true" : undefined}
                          onClick={() => openProject(project)}
                          className={cn(CARD_TARGET_CLASS, "flex w-full items-center gap-3 text-left")}
                        >
                          <Mark className={ficha ? OUTCOME_TONE[ficha.outcome] : undefined}>
                            <KindIcon kind={project.kind} />
                          </Mark>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{project.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {PROJECT_KIND_LABELS[project.kind]}
                              {" · "}
                              {count} {count === 1 ? "CR" : "CRs"}
                              {project.status === "done" ? " · concluído" : ""}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {ficha === null || ficha.timeSpentMs === null ? "—" : formatDuration(ficha.timeSpentMs)}
                          </span>
                        </button>
                      </CardContent>
                    </Card>
                  </motion.li>
                );
              })}
              {looseFichas.map((ficha, index) => (
                <motion.li
                  key={ficha.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ENTER, delay: reduce ? 0 : Math.min(index, 8) * 0.04 }}
                >
                  <Card size="compact" interactive selected={ficha.id === reportId} className="py-3">
                    <CardContent>
                      <button
                        type="button"
                        aria-current={ficha.id === reportId ? "true" : undefined}
                        onClick={() => router.push(revisaoPath(ficha.id))}
                        className={cn(CARD_TARGET_CLASS, "flex w-full items-center gap-3 text-left")}
                      >
                        <Mark className={OUTCOME_TONE[ficha.outcome]}>{SCOPE_ICON[ficha.scope]}</Mark>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{ficha.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {SCOPE_NAME[ficha.scope]}
                            {" · "}
                            {ficha.scope === "cr"
                              ? ficha.subjects[0]
                                ? subjectLabel(ficha.subjects[0], jiraKeys)
                                : "CR"
                              : `${ficha.subjects.length} ${ficha.subjects.length === 1 ? "CR" : "CRs"}`}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {ficha.timeSpentMs === null ? "—" : formatDuration(ficha.timeSpentMs)}
                        </span>
                      </button>
                    </CardContent>
                  </Card>
                </motion.li>
              ))}
            </ol>
          )}
          </motion.div>
          </AnimatePresence>
        </section>

        {draft && reportId !== null && commentDraft ? (
          <motion.div
            key={reportId}
            className="flex min-w-0 flex-col gap-4"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ENTER}
          >
            <Card size="compact">
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2.5 text-balance">
                  <Mark className={OUTCOME_TONE[draft.outcome]}>
                    {linkedProject ? <KindIcon kind={linkedProject.kind} /> : SCOPE_ICON[draft.scope]}
                  </Mark>
                  {draft.scope === "cr" ? draft.title || "PR sem título" : (linkedProject?.name ?? SCOPE_NAME[draft.scope])}
                </CardTitle>
                <CardDescription className="font-mono text-xs tabular-nums">
                  {draft.scope === "cr" ? (
                    <>
                      {draft.subjects[0] ? `${draft.subjects[0].repoSlug} #${draft.subjects[0].prId}` : draft.repoSlug}
                      {jiraKey ? ` · ${jiraKey}` : ""}
                    </>
                  ) : linkedProject ? (
                    <>{PROJECT_KIND_LABELS[linkedProject.kind]}</>
                  ) : (
                    <>Abrangência: {SCOPE_LABEL[draft.scope]}</>
                  )}
                  {" · "}
                  {timeSpentMs === null ? "sem cronômetro" : formatDuration(timeSpentMs)}
                  {draft.subjects.length > 1 ? " · soma das últimas revisões" : ""}
                </CardDescription>
                <CardAction>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {save.isPending ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                    ) : dirty ? null : (
                      <CheckIcon className="size-3.5" aria-hidden />
                    )}
                    {saveLabel}
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {draft.scope === "cr" ? (
                  <Button type="button" variant="outline" size="sm" className="w-fit" onClick={anotherForThisCr}>
                    <PlusIcon className="size-3.5" />
                    Outra revisão deste CR
                  </Button>
                ) : (
                  <>
                    <Input
                      value={draft.title}
                      aria-label="Nome da revisão"
                      placeholder="Nome da revisão"
                      className="w-full"
                      onChange={(title) => patch((current) => ({ ...current, title }))}
                    />
                    <ul className="flex flex-col gap-2">
                      {draft.subjects.map((subject) => (
                        <li key={subject.prKey} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {subjectLabel(subject, jiraKeys)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Tirar ${subjectLabel(subject, jiraKeys)}`}
                            disabled={draft.subjects.length <= 1}
                            onClick={() =>
                              patch((current) => ({
                                ...current,
                                subjects: current.subjects.filter((item) => item.prKey !== subject.prKey),
                              }))
                            }
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <MenuSelect
                      label="Adicionar CR"
                      value="add"
                      open={openSelect === "add-cr"}
                      onOpenChange={(open) => setOpenSelect(open ? "add-cr" : null)}
                      onValueChange={(value) => {
                        if (value === "add") return;
                        const subject = knownCrs.find((item) => item.prKey === value);
                        if (!subject) return;
                        const member = memberOf(subject);
                        patch((current) =>
                          current.subjects.some((item) => item.prKey === member.prKey)
                            ? current
                            : { ...current, subjects: [...current.subjects, member] },
                        );
                      }}
                      options={[
                        { value: "add", label: "Adicionar CR" },
                        ...knownCrs
                          .filter((item) => !draft.subjects.some((subject) => subject.prKey === item.prKey))
                          .map((item) => ({ value: item.prKey, label: subjectLabel(item, jiraKeys) })),
                      ]}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card size="compact">
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <CircleCheckIcon className={cn("size-4", OUTCOME_TEXT[draft.outcome])} aria-hidden />
                  Resultado
                </CardTitle>
                <CardDescription>Como o teste desta revisão terminou.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <RadioGroup
                  orientation="horizontal"
                  aria-label="Resultado do teste"
                  value={draft.outcome}
                  onValueChange={(value) =>
                    patch((current) => ({ ...current, outcome: value as TestOutcome }))
                  }
                >
                  {OUTCOMES.map((option) => (
                    <RadioGroupItem
                      key={option.value}
                      value={option.value}
                      label={option.label}
                      icon={option.icon}
                    />
                  ))}
                </RadioGroup>
                <label className="flex flex-col gap-1.5">
                  <span className="px-1 text-sm font-medium">Como foi testado</span>
                  <textarea
                    value={draft.howTested}
                    onChange={(event) =>
                      patch((current) => ({ ...current, howTested: event.target.value }))
                    }
                    rows={4}
                    maxLength={8000}
                    placeholder="O caminho que você percorreu, com qual dado, em qual tela."
                    className={FIELD}
                  />
                </label>
              </CardContent>
            </Card>

            <Card size="compact">
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <ListChecksIcon className="size-4 text-muted-foreground" aria-hidden />
                  Achados
                </CardTitle>
                <CardDescription>Um passo do que funcionou, um erro ou um layout que quebrou.</CardDescription>
                <CardAction className="gap-2">
                  {(["step", "error", "layout"] as const).map((kind) => (
                    <Button
                      key={kind}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative z-10"
                      onClick={() =>
                        patch((current) => ({
                          ...current,
                          findings: [
                            ...current.findings,
                            { key: crypto.randomUUID(), id: null, kind, body: "" },
                          ],
                        }))
                      }
                    >
                      <span aria-hidden className="[&_svg]:size-3.5">
                        {KIND_ICON[kind]}
                      </span>
                      {KIND_LABEL[kind]}
                    </Button>
                  ))}
                </CardAction>
              </CardHeader>
              <CardContent>
                {draft.findings.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum achado nesta ficha.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {draft.findings.map((finding) => (
                        <motion.li
                          key={finding.key}
                          layout={reduce ? false : "position"}
                          initial={reduce ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduce ? undefined : { opacity: 0, y: -6 }}
                          transition={ENTER}
                          className="flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <MenuSelect
                              label="Tipo do achado"
                              value={finding.kind}
                              open={openSelect === finding.key}
                              onOpenChange={(open) => setOpenSelect(open ? finding.key : null)}
                              onValueChange={(value) =>
                                patch((current) => ({
                                  ...current,
                                  findings: current.findings.map((item) =>
                                    item.key === finding.key
                                      ? { ...item, kind: value as FindingKind }
                                      : item,
                                  ),
                                }))
                              }
                              options={KIND_OPTIONS}
                              className="w-40"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remover achado"
                              className="relative z-10 ml-auto"
                              onClick={() =>
                                patch((current) => ({
                                  ...current,
                                  findings: current.findings.filter((item) => item.key !== finding.key),
                                  shots: current.shots.map((shot) =>
                                    shot.findingKey === finding.key ? { ...shot, findingKey: null } : shot,
                                  ),
                                }))
                              }
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </div>
                          <textarea
                            value={finding.body}
                            aria-label="Descrição do achado"
                            rows={2}
                            maxLength={2000}
                            onChange={(event) =>
                              patch((current) => ({
                                ...current,
                                findings: current.findings.map((item) =>
                                  item.key === finding.key ? { ...item, body: event.target.value } : item,
                                ),
                              }))
                            }
                            className={cn(FIELD, "min-h-16")}
                          />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card
              size="compact"
              className={cn(dragging && "ring-2 ring-ring")}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
                void addFiles(files);
              }}
              onPaste={(event) => {
                const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
                if (files.length === 0) return;
                event.preventDefault();
                void addFiles(files);
              }}
            >
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                  Evidência
                </CardTitle>
                <CardDescription>Cole com Ctrl+V ou solte a imagem. Até 8 imagens, cada uma na própria linha do card.</CardDescription>
                <CardAction>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="relative z-10"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlusIcon className="size-3.5" />
                    Escolher imagem
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    event.target.value = "";
                    void addFiles(files);
                  }}
                />
                {draft.shots.length === 0 ? (
                  <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-muted-foreground">
                    Nenhuma evidência nesta ficha.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                    {draft.shots.map((shot, index) => (
                      <motion.li
                        key={shot.id}
                        layout={reduce ? false : "position"}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -6 }}
                        transition={ENTER}
                      >
                        <Card variant="muted" size="compact" className="gap-3">
                          <CardContent className="flex flex-col gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={evidenceUrl(reportId, shot.id)}
                              alt={shot.caption || `Evidência ${index + 1}`}
                              className="max-h-80 w-full rounded-xl bg-background object-contain"
                            />
                            <Input
                              value={shot.caption}
                              aria-label={`Legenda da evidência ${index + 1}`}
                              placeholder="O que esta evidência mostra"
                              maxLength={240}
                              className="w-full"
                              onChange={(caption) =>
                                patch((current) => ({
                                  ...current,
                                  shots: current.shots.map((item) =>
                                    item.id === shot.id ? { ...item, caption } : item,
                                  ),
                                }))
                              }
                            />
                            <div className="flex items-center gap-2">
                              <MenuSelect
                                label={`Achado ilustrado pela evidência ${index + 1}`}
                                value={shot.findingKey ?? NO_FINDING}
                                open={openSelect === `shot-${shot.id}`}
                                onOpenChange={(open) => setOpenSelect(open ? `shot-${shot.id}` : null)}
                                onValueChange={(value) =>
                                  patch((current) => ({
                                    ...current,
                                    shots: current.shots.map((item) =>
                                      item.id === shot.id
                                        ? { ...item, findingKey: value === NO_FINDING ? null : value }
                                        : item,
                                    ),
                                  }))
                                }
                                options={findingOptions}
                                className="min-w-0 flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="relative z-10 shrink-0"
                                onClick={() => void copyShot(shot.id)}
                              >
                                Copiar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Tirar evidência ${index + 1}`}
                                className="relative z-10 shrink-0"
                                onClick={() => void removeShot(shot.id)}
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.li>
                    ))}
                    </AnimatePresence>
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card size="compact">
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <ClipboardCopyIcon className="size-4 text-muted-foreground" aria-hidden />
                  Para o card
                </CardTitle>
                <CardDescription>
                  Tudo o que foi registrado. No Jira, o texto entra primeiro e cada imagem é colada em seguida.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {pasteSteps && draft.shots.length > 0 ? (
                    <motion.div
                      key="paste-steps"
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -6 }}
                      transition={ENTER}
                    >
                      <Alert variant="info" open>
                        <AlertIcon />
                        <AlertContent>
                          <AlertTitle>Agora as imagens</AlertTitle>
                          <AlertDescription>
                            O texto já está copiado. Cole no comentário do Jira e, em seguida, copie e cole cada imagem
                            na seção Evidência. O Jira só anexa a imagem quando ela é colada sozinha.
                          </AlertDescription>
                          <ol className="mt-3 flex flex-col gap-2">
                            {draft.shots.map((shot, index) => {
                              const done = pasteSteps.includes(shot.id);
                              return (
                                <li key={shot.id} className="flex items-center gap-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={evidenceUrl(reportId, shot.id)}
                                    alt=""
                                    className="size-10 shrink-0 rounded-lg bg-background object-cover"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-sm">
                                    {index + 1}. {shot.caption.trim() || "Sem legenda"}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={done ? "ghost" : "outline"}
                                    className="shrink-0"
                                    onClick={() => void copyShot(shot.id)}
                                  >
                                    {done ? <CheckIcon className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                                    {done ? `Imagem ${index + 1} copiada` : `Copiar imagem ${index + 1}`}
                                  </Button>
                                </li>
                              );
                            })}
                          </ol>
                        </AlertContent>
                      </Alert>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <CardPreview
                  draft={commentDraft}
                  shots={draft.shots.map((shot) => ({
                    src: evidenceUrl(reportId, shot.id),
                    caption: shot.caption,
                  }))}
                />
              </CardContent>
              <CardFooter className="flex-wrap">
                <Button type="button" size="sm" onClick={() => void copyJira()}>
                  <ClipboardCopyIcon className="size-3.5" />
                  Copiar para o Jira
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyKiro()}
                >
                  <SparklesIcon className="size-3.5" />
                  Copiar para o Kiro
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <EmptyLane icon={<NotebookPenIcon />} text="Escolha uma revisão na lista, ou abra “Anotar teste” a partir da fila." />
        )}
      </div>
    </div>
  );
}

const KIND_OPTIONS = (["step", "error", "layout"] as const).map((kind) => ({
  value: kind,
  label: KIND_LABEL[kind],
}));

function KindIcon({ kind }: { kind: ProjectKind }) {
  const Icon = PROJECT_KIND_ICONS[kind];
  return <Icon />;
}

function Mark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-200 [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

function EmptyLane({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Card variant="muted" size="compact">
      <CardContent className="flex flex-col items-start gap-3">
        <Mark>{icon}</Mark>
        <p className="text-pretty text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function MenuSelect({
  label,
  value,
  open,
  onOpenChange,
  onValueChange,
  options,
  className,
}: {
  label: string;
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select
      value={value}
      open={open}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      className={cn("relative z-10", className, open && "z-30")}
    >
      <SelectTrigger className="h-10 py-0">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CardPreview({
  draft,
  shots,
}: {
  draft: TestReportDraft;
  shots: { src: string; caption: string }[];
}) {
  const report = describeTestReport(draft);
  return (
    <article className="flex max-h-[32rem] flex-col gap-4 overflow-auto rounded-2xl border bg-muted/40 p-4 text-sm">
      <header className="flex flex-col gap-1">
        <h3 className="font-semibold">{report.title}</h3>
        <p className="text-muted-foreground">
          Resultado: {report.outcome} · {report.time}
        </p>
      </header>
      {report.scopeLabel && report.coverage ? (
        <section className="flex flex-col gap-1">
          <h4 className="font-medium">CRs abrangidos</h4>
          <p className="text-muted-foreground">Abrangência: {report.scopeLabel}</p>
          {report.coverage.length === 0 ? (
            <p className="text-muted-foreground">Nenhum CR vinculado.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {report.coverage.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <section className="flex flex-col gap-1">
        <h4 className="font-medium">Como foi testado</h4>
        <p className="whitespace-pre-wrap text-pretty text-muted-foreground">{report.howTested}</p>
      </section>
      <section className="flex flex-col gap-1">
        <h4 className="font-medium">O que foi exercitado</h4>
        {report.steps.length === 0 ? (
          <p className="text-muted-foreground">Nenhum passo registrado.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-1">
        <h4 className="font-medium">O que falhou</h4>
        {report.failures.length === 0 ? (
          <p className="text-muted-foreground">Nada falhou.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            {report.failures.map((failure, index) => (
              <li key={`${index}-${failure.body}`}>
                <span className="font-medium text-foreground">{failure.kind}</span>
                {" — "}
                {failure.body}
                {failure.evidence}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h4 className="inline-flex items-center gap-1.5 font-medium">
          <ImageIcon className="size-3.5" aria-hidden />
          Evidência
        </h4>
        {report.evidence.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma evidência anexada.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {report.evidence.map((shot) => (
              <li key={shot.number} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shots[shot.number - 1]?.src}
                  alt={`${shot.number}. ${shot.caption}`}
                  className="max-h-80 w-full rounded-xl bg-background object-contain"
                />
                <p className="w-full text-muted-foreground">
                  {shot.number}. {shot.caption}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
