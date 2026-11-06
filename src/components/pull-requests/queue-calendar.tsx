"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { TargetBadge } from "@/components/pull-requests/pull-request-badges";
import { AgeIndicator, ReviewStateBadge } from "@/components/pull-requests/review-state";
import {
  MONTHS_PT,
  WEEKDAYS_SHORT_PT,
  dayKey,
  dayKeyOf,
  dayMarks,
  daysInMonth,
  defaultDay,
  groupByOpenedDay,
  monthCount,
  openedLabel,
  sameMonth,
  shiftMonth,
  type CalendarMonth,
} from "@/components/pull-requests/queue-calendar-model";
import {
  QUEUE_PAGE_SIZES,
  paginate,
  type QueuePageSize,
} from "@/components/pull-requests/queue-pagination";
import { QueuePaginationBar } from "@/components/pull-requests/queue-pagination-bar";
import { formatCompactAge } from "@/domain/time";
import { prKey } from "@/domain/pull-request";
import { useNow } from "@/hooks/use-now";
import type { PullRequestItem } from "@/hooks/use-pull-requests";
import { cn } from "@/lib/utils";
import "./queue-calendar.css";

const styles = {
  cal: "qcal",
  calendar: "qcal-calendar",
  listCol: "qcal-list-col",
  head: "qcal-head",
  headText: "qcal-head-text",
  month: "qcal-month",
  sub: "qcal-sub",
  nav: "qcal-nav",
  iconBtn: "qcal-icon-btn",
  todayBtn: "qcal-today-btn",
  weekdays: "qcal-weekdays",
  wrap: "qcal-wrap",
  daysInner: "qcal-days-inner",
  grid: "qcal-grid",
  day: "qcal-day",
  num: "qcal-num",
  marks: "qcal-marks",
  selPill: "qcal-sel-pill",
  divider: "qcal-divider",
  listHead: "qcal-list-head",
  row: "qcal-row",
  rowText: "qcal-row-text",
  rowTitle: "qcal-row-title",
  rowMeta: "qcal-row-meta",
  metaText: "qcal-meta-text",
  rowSide: "qcal-row-side",
  group: "qcal-group",
  groupHead: "qcal-group-head",
  emptyText: "qcal-empty-text",
  textSwap: "qcal-text-swap",
  textSoft: "qcal-text-soft",
  textSoftOld: "qcal-text-soft-old",
  textSoftNew: "qcal-text-soft-new",
  resize: "qcal-resize",
  digitGroup: "qcal-digit-group",
  today: "is-today",
  empty: "is-empty",
  snoozed: "is-snoozed",
  isPressed: "is-pressed",
  isExit: "is-exit",
  isEnterStart: "is-enter-start",
  isSwapping: "is-swapping",
  isAnimating: "is-animating",
} as const;

type CalendarDay = CalendarMonth & { day: number };

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

const ARROW_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** Lê uma duração (ms) dos tokens de motion do componente. */
function cssMs(element: Element | null, name: string, fallback: number) {
  if (!element) return fallback;
  const value = parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isNaN(value) ? fallback : value;
}

const monthKeyOf = (month: CalendarMonth) => `${month.year}-${month.month}`;

/**
 * Troca de conteúdo em duas fases: o conteúdo atual sai (`isExit`), e só
 * depois de `--text-swap-dur` o novo valor é exibido e entra. A altura do
 * `wrap` fica travada durante a saída e anima até a altura do `inner` (ou do
 * próprio `el`, quando não há `inner`).
 */
function useContentSwap<T>(
  target: T,
  targetKey: string,
  el: RefObject<HTMLElement | null>,
  wrap: RefObject<HTMLElement | null>,
  inner?: RefObject<HTMLElement | null>,
) {
  const [shown, setShown] = useState({ value: target, version: 0 });
  const latest = useRef({ value: target, key: targetKey });
  const shownKey = useRef(targetKey);
  const swapTimer = useRef<number | undefined>(undefined);
  const heightTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    latest.current = { value: target, key: targetKey };
  });

  useLayoutEffect(() => {
    if (targetKey === shownKey.current && swapTimer.current === undefined) return;
    const node = el.current;
    const box = wrap.current;
    box?.style.setProperty("height", `${box.offsetHeight}px`);
    node?.classList.add(styles.isExit);
    window.clearTimeout(swapTimer.current);
    swapTimer.current = window.setTimeout(() => {
      swapTimer.current = undefined;
      const next = latest.current;
      shownKey.current = next.key;
      setShown((current) => ({ value: next.value, version: current.version + 1 }));
    }, cssMs(node, "--text-swap-dur", 150));
  }, [targetKey, el, wrap]);

  useLayoutEffect(() => {
    if (shown.version === 0) return;
    const node = el.current;
    const box = wrap.current;
    const content = inner?.current ?? node;
    if (node) {
      node.classList.remove(styles.isExit);
      node.classList.add(styles.isEnterStart);
      void node.offsetHeight;
      node.classList.remove(styles.isEnterStart);
    }
    if (box && content) {
      void box.offsetHeight;
      box.style.setProperty("height", `${content.offsetHeight}px`);
      window.clearTimeout(heightTimer.current);
      heightTimer.current = window.setTimeout(
        () => box.style.removeProperty("height"),
        cssMs(box, "--resize-dur", 300) + 60,
      );
    }
  }, [shown.version, el, wrap, inner]);

  useEffect(
    () => () => {
      window.clearTimeout(swapTimer.current);
      window.clearTimeout(heightTimer.current);
    },
    [],
  );

  return shown.value;
}

/** Texto que troca com desfoque cruzado e anima a própria largura. */
function SoftText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = el.dataset.text;
    if (prev === undefined) {
      el.dataset.text = text;
      el.textContent = text;
      return;
    }
    if (prev === text) return;
    el.dataset.text = text;
    window.clearTimeout(timer.current);
    const out = document.createElement("span");
    out.className = styles.textSoftOld;
    out.setAttribute("aria-hidden", "true");
    out.textContent = prev;
    const inn = document.createElement("span");
    inn.className = styles.textSoftNew;
    inn.textContent = text;
    const w0 = el.getBoundingClientRect().width;
    el.classList.remove(styles.isSwapping);
    el.replaceChildren(out, inn);
    const w1 = inn.getBoundingClientRect().width;
    el.style.width = `${w0}px`;
    void el.offsetWidth;
    el.classList.add(styles.isSwapping);
    el.style.width = `${w1}px`;
    timer.current = window.setTimeout(
      () => {
        el.classList.remove(styles.isSwapping);
        el.style.removeProperty("width");
        el.textContent = text;
      },
      Math.max(cssMs(el, "--text-soft-dur", 200), cssMs(el, "--text-soft-resize-dur", 240)) + 40,
    );
  }, [text]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // O conteúdo é do efeito: o React não renderiza filhos aqui.
  return <span ref={ref} className={styles.textSoft} />;
}

/** Número em que só os dígitos que mudaram entram, com mola. */
function DigitText({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = (el.textContent ?? "").replace(/\s+/g, "");
    if (prev === value) return;
    let same = 0;
    while (same < prev.length && same < value.length && prev[same] === value[same]) same++;
    el.classList.remove(styles.isAnimating);
    const chars = value.split("");
    el.replaceChildren(
      ...chars.map((char, index) => {
        const span = document.createElement("span");
        span.textContent = char;
        if (index < same && prev.length === value.length) span.dataset.same = "";
        if (index === chars.length - 1) span.dataset.stagger = "1";
        return span;
      }),
    );
    void el.offsetHeight;
    el.classList.add(styles.isAnimating);
  }, [value]);

  return <span ref={ref} className={styles.digitGroup} />;
}

/** Num toque, o botão fica pressionado por pelo menos `--press-dur`. */
function holdTouchPress(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "mouse" || !(event.target instanceof Element)) return;
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const started = performance.now();
  const min = cssMs(button, "--press-dur", 150);
  button.classList.add(styles.isPressed);
  const release = () => {
    document.removeEventListener("pointerup", release, true);
    document.removeEventListener("pointercancel", release, true);
    window.setTimeout(
      () => button.classList.remove(styles.isPressed),
      Math.max(0, min - (performance.now() - started)),
    );
  };
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
}

/** Um bloco da lista do dia, com o cabeçalho já montado por quem agrupa. */
export type QueueCalendarGroup = {
  id: string;
  label: ReactNode;
  items: PullRequestItem[];
};

const FLAT_GROUP: QueueCalendarGroup = { id: "all", label: null, items: [] };

/**
 * Calendário mensal da fila: cada dia marca os PRs abertos nele (pela data de
 * criação), coloridos pela faixa de idade. Escolher um dia desliza o destaque
 * até ele e troca a lista de PRs com a altura animada. Com `groupDay`, a lista
 * do dia sai em blocos (por projeto, por exemplo).
 */
export function QueueCalendar({
  pullRequests,
  onOpen,
  groupDay,
  pageSize,
  onPageSizeChange,
}: {
  pullRequests: PullRequestItem[];
  onOpen: (pr: PullRequestItem) => void;
  groupDay?: (items: PullRequestItem[]) => QueueCalendarGroup[];
  pageSize: QueuePageSize;
  onPageSizeChange: (pageSize: QueuePageSize) => void;
}) {
  const now = useNow();
  const today = new Date(now);
  const todayKey = dayKeyOf(today);
  const todayMonth: CalendarMonth = { year: today.getFullYear(), month: today.getMonth() };

  const groups = useMemo(() => groupByOpenedDay(pullRequests), [pullRequests]);

  const [view, setView] = useState<CalendarDay>(() => {
    const start = new Date(now);
    const month = { year: start.getFullYear(), month: start.getMonth() };
    return { ...month, day: defaultDay(groups, month, start) };
  });

  const pillRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const daysWrapRef = useRef<HTMLDivElement>(null);
  const daysInnerRef = useRef<HTMLDivElement>(null);
  const listWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const placedMonth = useRef<string | null>(null);

  const gridShown = useContentSwap(view, monthKeyOf(view), gridRef, daysWrapRef, daysInnerRef);
  const grouped = groupDay !== undefined;
  const listBase = `${dayKey(view.year, view.month, view.day)}:${grouped ? "grouped" : "flat"}`;
  // A página vale para um dia e um agrupamento; trocar qualquer um volta para a 1.
  const [paging, setPaging] = useState({ key: listBase, page: 1 });
  const page = paging.key === listBase ? paging.page : 1;
  const listTarget = useMemo(
    () => ({ ...view, grouped, page, pageSize }),
    [view, grouped, page, pageSize],
  );
  const listShown = useContentSwap(
    listTarget,
    `${listBase}:${page}:${pageSize}`,
    listRef,
    listWrapRef,
  );

  const gridKey = monthKeyOf(gridShown);
  const inSync = sameMonth(gridShown, view);
  const pressedDay = inSync ? view.day : gridShown.day;

  const place = useCallback((animate: boolean) => {
    const pill = pillRef.current;
    const button = gridRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!pill || !button) return;
    if (!animate) pill.style.transition = "none";
    pill.style.width = `${button.offsetWidth}px`;
    pill.style.height = `${button.offsetHeight}px`;
    pill.style.transform = `translate(${button.offsetLeft}px, ${button.offsetTop}px)`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.removeProperty("transition");
    }
    return button;
  }, []);

  useLayoutEffect(() => {
    // Mesmo mês: o destaque desliza. Mês novo (ou primeira pintura): já nasce no lugar.
    const animate = placedMonth.current === gridKey;
    placedMonth.current = gridKey;
    const button = place(animate);
    if (button && focusPending.current && inSync) {
      focusPending.current = false;
      button.focus();
    }
  }, [gridKey, pressedDay, inSync, place]);

  useLayoutEffect(() => {
    const inner = daysInnerRef.current;
    if (!inner) return;
    const observer = new ResizeObserver(() => place(false));
    observer.observe(inner);
    return () => observer.disconnect();
  }, [place]);

  function select(next: CalendarDay) {
    setView((current) =>
      sameMonth(current, next) && current.day === next.day ? current : next,
    );
  }

  function go(delta: number) {
    const month = shiftMonth(view, delta);
    select({ ...month, day: defaultDay(groups, month, today) });
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      focusPending.current = true;
      go(event.key === "PageUp" ? -1 : 1);
      return;
    }
    const step = ARROW_STEP[event.key];
    const next =
      step !== undefined
        ? new Date(view.year, view.month, view.day + step)
        : event.key === "Home"
          ? new Date(view.year, view.month, 1)
          : event.key === "End"
            ? new Date(view.year, view.month + 1, 0)
            : null;
    if (!next) return;
    event.preventDefault();
    const target = { year: next.getFullYear(), month: next.getMonth(), day: next.getDate() };
    if (sameMonth(target, view) && target.day === view.day) return;
    focusPending.current = true;
    select(target);
  }

  const monthLabel = `${MONTHS_PT[view.month]} ${view.year}`;
  const gridLabel = `${MONTHS_PT[gridShown.month]} ${gridShown.year}`;
  const total = monthCount(groups, gridShown);
  const leading = new Date(gridShown.year, gridShown.month, 1).getDay();
  const dayCount = daysInMonth(gridShown);
  const onToday = sameMonth(view, todayMonth) && view.day === today.getDate();

  const listItems = groups.get(dayKey(listShown.year, listShown.month, listShown.day)) ?? [];
  const listRows =
    listShown.grouped && groupDay
      ? groupDay(listItems).flatMap((group) => group.items.map((item) => ({ group, item })))
      : listItems.map((item) => ({ group: FLAT_GROUP, item }));
  const listPage = paginate(listRows, listShown.page, listShown.pageSize);
  const listGroups: QueueCalendarGroup[] = [];
  for (const { group, item } of listPage.items) {
    const last = listGroups.at(-1);
    if (last?.id === group.id) last.items.push(item);
    else listGroups.push({ id: group.id, label: group.label, items: [item] });
  }
  const listWeekday =
    WEEKDAYS_SHORT_PT[new Date(listShown.year, listShown.month, listShown.day).getDay()];

  return (
    <div className={styles.cal} onPointerDown={holdTouchPress}>
      <div className={styles.calendar}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.month}>
              <SoftText text={monthLabel} />
            </h2>
            <div className={styles.sub}>
              <DigitText value={String(total)} /> {openedLabel(total)}
            </div>
          </div>
          <div className={styles.nav}>
            {onToday ? null : (
              <button
                type="button"
                className={styles.todayBtn}
                onClick={() => select({ ...todayMonth, day: today.getDate() })}
              >
                Hoje
              </button>
            )}
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Mês anterior"
              onClick={() => go(-1)}
            >
              <ChevronLeftIcon aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Próximo mês"
              onClick={() => go(1)}
            >
              <ChevronRightIcon aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <span key={index}>{initial}</span>
          ))}
        </div>

        <div ref={daysWrapRef} className={cn(styles.resize, styles.wrap)}>
          <div ref={daysInnerRef} className={styles.daysInner}>
            <span ref={pillRef} className={styles.selPill} />
            <div
              ref={gridRef}
              className={cn(styles.grid, styles.textSwap)}
              role="group"
              aria-label={`Dias de ${gridLabel}. Setas mudam o dia, Page Up e Page Down mudam o mês.`}
              onKeyDown={onGridKeyDown}
            >
              {Array.from({ length: leading }, (_, index) => (
                <span key={`${gridKey}-empty-${index}`} className={cn(styles.day, styles.empty)} />
              ))}
              {Array.from({ length: dayCount }, (_, index) => {
                const day = index + 1;
                const key = dayKey(gridShown.year, gridShown.month, day);
                const items = groups.get(key) ?? [];
                const pressed = day === pressedDay;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    className={cn(styles.day, isToday && styles.today)}
                    aria-pressed={pressed}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${day} de ${MONTHS_PT[gridShown.month]}${isToday ? ", hoje" : ""}, ${
                      items.length === 1 ? "1 PR aberto" : `${items.length} PRs abertos`
                    }`}
                    tabIndex={pressed ? 0 : -1}
                    onClick={() => select({ ...gridShown, day })}
                  >
                    <span className={styles.num}>{day}</span>
                    <span className={styles.marks}>
                      {dayMarks(items).map((band, mark) => (
                        <i key={mark} data-band={band} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.listCol}>
        <div ref={listWrapRef} className={cn(styles.resize, styles.wrap)}>
          <div ref={listRef} className={styles.textSwap} aria-live="polite">
            <div className={styles.listHead}>
              {listWeekday}, {listShown.day} de {MONTHS_PT[listShown.month].toLowerCase()}
              {listItems.length > 0
                ? ` · ${listItems.length === 1 ? "1 PR" : `${listItems.length} PRs`}`
                : null}
            </div>
            {listItems.length === 0 ? (
              <div className={styles.emptyText}>Nenhum PR aberto neste dia</div>
            ) : (
              listGroups.map((group) => (
                <div key={group.id} className={styles.group}>
                  {group.label ? <div className={styles.groupHead}>{group.label}</div> : null}
                  {group.items.map((pr) => (
                    <button
                      key={prKey(pr.repository.uuid, pr.id)}
                      type="button"
                      className={cn(styles.row, pr.snooze && styles.snoozed)}
                      onClick={() => onOpen(pr)}
                      aria-label={`Ver detalhes de ${pr.repository.slug} #${pr.id}: ${pr.title}`}
                    >
                      <AgeIndicator band={pr.ageBand} />
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle} title={pr.title}>
                          {pr.title}
                        </span>
                        <span className={styles.rowMeta}>
                          <span className={cn(styles.metaText, "font-mono")}>
                            {pr.repository.slug} #{pr.id}
                          </span>
                          <span aria-hidden>·</span>
                          <span className={styles.metaText}>{pr.author.displayName}</span>
                          <span aria-hidden>·</span>
                          <span className="tabular-nums">
                            {formatCompactAge(pr.createdOn, today)}
                          </span>
                        </span>
                      </span>
                      <span className={styles.rowSide}>
                        {pr.targetKind ? (
                          <TargetBadge kind={pr.targetKind} branch={pr.destinationBranch} />
                        ) : null}
                        <ReviewStateBadge state={pr.reviewState} compact />
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
        {listRows.length > QUEUE_PAGE_SIZES[0] ? (
          <QueuePaginationBar
            className="mt-3 rounded-xl"
            page={listPage.page}
            pageCount={listPage.pageCount}
            pageSize={listShown.pageSize}
            start={listPage.start}
            end={listPage.end}
            total={listPage.total}
            onPageChange={(next) => setPaging({ key: listBase, page: next })}
            onPageSizeChange={(next) => {
              setPaging({ key: listBase, page: 1 });
              onPageSizeChange(next);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
