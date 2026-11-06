"use client";

import { useMemo } from "react";
import { ReviewLoadChart } from "@/components/dashboard/review-load-chart";
import { formatNumber } from "@/components/dashboard/format";
import { Avatar } from "@/components/motion/avatar-group";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Table, type TableColumn } from "@/components/motion/table";
import { leastLoadedMembers } from "@/domain/pull-request";
import type { LeadPerson } from "@/hooks/use-lead-overview";
import { useOnCall } from "@/hooks/use-on-call";
import { fitTableHeight } from "@/lib/table-height";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 52;

type Row = LeadPerson & { onCall: boolean; leastLoaded: boolean };

function Num({ value, tone }: { value: number; tone?: "warning" | "danger" }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        value === 0 && "text-muted-foreground",
        value > 0 && tone === "warning" && "text-warning-foreground",
        value > 0 && tone === "danger" && "text-destructive",
      )}
    >
      {formatNumber(value)}
    </span>
  );
}

const columns: TableColumn<Row>[] = [
  {
    key: "person",
    header: "Pessoa",
    sortable: true,
    truncate: false,
    sortValue: (r) => r.displayName,
    cell: (r) => (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={r.displayName} src={r.avatarUrl ?? undefined} size="sm" />
        <span className="truncate">{r.displayName}</span>
        {r.onCall ? (
          <AnimatedBadge size="sm" status="info" showIcon={false}>
            Plantão hoje
          </AnimatedBadge>
        ) : null}
        {r.leastLoaded ? (
          <AnimatedBadge size="sm" status="success" showIcon={false}>
            Menor carga
          </AnimatedBadge>
        ) : null}
      </span>
    ),
  },
  {
    key: "pending",
    header: "Para revisar",
    sortable: true,
    align: "right",
    width: "130px",
    sortValue: (r) => r.pending,
    cell: (r) => <Num value={r.pending} />,
  },
  {
    key: "overdue",
    header: "Atrasadas",
    sortable: true,
    align: "right",
    width: "130px",
    sortValue: (r) => r.overdue,
    cell: (r) => <Num value={r.overdue} tone="warning" />,
  },
  {
    key: "authored",
    header: "PRs abertos",
    sortable: true,
    align: "right",
    width: "130px",
    sortValue: (r) => r.authored,
    cell: (r) => <Num value={r.authored} />,
  },
  {
    key: "authoredFlagged",
    header: "Próprios em risco",
    sortable: true,
    align: "right",
    width: "170px",
    sortValue: (r) => r.authoredFlagged,
    cell: (r) => <Num value={r.authoredFlagged} tone="danger" />,
  },
];

export function PeopleTab({ people, teamId }: { people: LeadPerson[]; teamId: number | null }) {
  const { onCallUuids } = useOnCall();
  const rows = useMemo<Row[]>(() => {
    const least = new Set(
      leastLoadedMembers(
        people.map((p) => p.uuid),
        new Map(people.map((p) => [p.uuid, p])),
      ),
    );
    return people.map((p) => ({
      ...p,
      onCall: onCallUuids.has(p.uuid),
      leastLoaded: people.length > 1 && least.size < people.length && least.has(p.uuid),
    }));
  }, [people, onCallUuids]);

  return (
    <div className="flex flex-col gap-4">
      <Table
        data={rows}
        columns={columns}
        getRowId={(r) => r.uuid}
        rowHeight={ROW_HEIGHT}
        height={fitTableHeight(rows.length, ROW_HEIGHT, { maxRows: 12 })}
        fitContainer
        defaultSort={{ key: "overdue", direction: "desc" }}
        emptyState={
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma pessoa monitorada no escopo.
          </p>
        }
      />
      <ReviewLoadChart teamId={teamId} />
    </div>
  );
}
