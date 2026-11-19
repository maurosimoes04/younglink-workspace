"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { patchPage } from "@/lib/client";
import { DBS, type DateValue, type DbId, type Option, type PageRow, type View } from "@/lib/schema";
import { hasPageIcon, PageIcon } from "./icons";
import { StatusTag } from "./PropCell";
import { Tag } from "./ui";

type Scale = "semana" | "mes" | "trimestre";
const DAY_W: Record<Scale, number> = { semana: 44, mes: 22, trimestre: 8 };
const SCALES: { id: Scale; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ROW_H = 36;
const MS_DAY = 86_400_000;

const dayNum = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_DAY;
};
const isoDay = (n: number) => new Date(n * MS_DAY).toISOString().slice(0, 10);
const shiftDate = (s: string, n: number) => isoDay(dayNum(s) + n) + s.slice(10);
const todayNum = () => {
  const t = new Date();
  return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / MS_DAY;
};
const dateOf = (n: number) => new Date(n * MS_DAY);

type Span = { start: number; end: number };
const spanOf = (v: DateValue | undefined): Span | null => {
  if (!v?.start) return null;
  const start = dayNum(v.start);
  const end = v.end ? Math.max(start, dayNum(v.end)) : start;
  return { start, end };
};

type Item = { kind: "group"; id: string; label: React.ReactNode; count: number } | { kind: "row"; row: PageRow; span: Span | null };
type Drag = { id: string; mode: "move" | "start" | "end"; x0: number; delta: number; moved: boolean };

export function Timeline({ db, view, rows }: { db: DbId; view: View; rows: PageRow[] }) {
  const def = DBS[db];
  const dateKey = view.dateProp ?? "prazo";
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<Scale>("mes");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [today] = useState(todayNum);
  const dayW = DAY_W[scale];

  const spans = new Map(rows.map((r) => [r.id, spanOf(r.props[dateKey] as DateValue | undefined)]));
  const dated = rows.filter((r) => spans.get(r.id));
  const minDay = Math.min(today, ...dated.map((r) => spans.get(r.id)!.start)) - 14;
  const maxDay = Math.max(today, ...dated.map((r) => spans.get(r.id)!.end)) + 45;
  const first = dateOf(minDay);
  const rangeStart = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1) / MS_DAY;
  const days = maxDay - rangeStart + 1;

  const byStart = (a: PageRow, b: PageRow) => (spans.get(a.id)?.start ?? Infinity) - (spans.get(b.id)?.start ?? Infinity) || a.title.localeCompare(b.title);
  const groupProp = view.groupBy ? def.props.find((p) => p.key === view.groupBy) : undefined;
  const items: Item[] = [];
  const pushRows = (list: PageRow[]) => list.sort(byStart).forEach((row) => items.push({ kind: "row", row, span: spans.get(row.id) ?? null }));
  if (groupProp && "options" in groupProp) {
    const opts: Option[] = groupProp.options;
    for (const o of opts) {
      const list = dated.filter((r) => r.props[groupProp.key] === o.name);
      if (!list.length) continue;
      items.push({ kind: "group", id: o.name, label: <Tag option={o} />, count: list.length });
      pushRows(list);
    }
    const rest = dated.filter((r) => !opts.some((o) => o.name === r.props[groupProp.key]));
    if (rest.length) {
      items.push({ kind: "group", id: "__none", label: <span className="text-muted">Sem {groupProp.name.toLowerCase()}</span>, count: rest.length });
      pushRows(rest);
    }
  } else pushRows([...dated]);
  const undated = rows.filter((r) => !spans.get(r.id));
  if (undated.length) {
    items.push({ kind: "group", id: "__undated", label: <span className="text-muted">Sem data · clica na linha para definir</span>, count: undated.length });
    pushRows([...undated]);
  }

  const scrollToToday = (smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.max(0, (today - rangeStart) * dayW - el.clientWidth * 0.3), behavior: smooth ? "smooth" : "auto" });
  };
  useLayoutEffect(() => scrollToToday(false), [scale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - drag.x0) / dayW);
      const moved = drag.moved || Math.abs(e.clientX - drag.x0) > 3;
      if (delta !== drag.delta || moved !== drag.moved) setDrag({ ...drag, delta, moved });
    };
    const onUp = () => {
      const row = rows.find((r) => r.id === drag.id);
      const v = row?.props[dateKey] as DateValue | undefined;
      setDrag(null);
      if (!row || !v?.start) return;
      if (!drag.moved) return router.push(`/p/${row.id}`);
      if (drag.delta === 0) return;
      const end = v.end ?? v.start;
      let start = v.start;
      let newEnd = end;
      if (drag.mode === "move") {
        start = shiftDate(v.start, drag.delta);
        newEnd = shiftDate(end, drag.delta);
      } else if (drag.mode === "start") start = dayNum(shiftDate(v.start, drag.delta)) > dayNum(end) ? end : shiftDate(v.start, drag.delta);
      else newEnd = dayNum(shiftDate(end, drag.delta)) < dayNum(v.start) ? v.start : shiftDate(end, drag.delta);
      const value: DateValue = dayNum(newEnd) > dayNum(start) ? { start, end: newEnd } : { start };
      patchPage(db, row.id, { props: { [dateKey]: value } });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, dayW, rows, dateKey, db, router]);

  const previewSpan = (id: string, span: Span): Span => {
    if (!drag || drag.id !== id) return span;
    if (drag.mode === "move") return { start: span.start + drag.delta, end: span.end + drag.delta };
    if (drag.mode === "start") return { start: Math.min(span.start + drag.delta, span.end), end: span.end };
    return { start: span.start, end: Math.max(span.end + drag.delta, span.start) };
  };

  const statusProp = def.props.find((p) => p.key === "estado");
  const statusOf = (r: PageRow) => (statusProp && "options" in statusProp ? statusProp.options.find((o) => o.name === r.props.estado) : undefined);

  const months: { label: string; left: number; width: number }[] = [];
  for (let d = rangeStart; d <= maxDay; ) {
    const dt = dateOf(d);
    const next = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) / MS_DAY;
    const end = Math.min(next, maxDay + 1);
    months.push({ label: `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`, left: (d - rangeStart) * dayW, width: (end - d) * dayW });
    d = next;
  }
  const dayCells = Array.from({ length: days }, (_, i) => {
    const dt = dateOf(rangeStart + i);
    return { i, dow: dt.getUTCDay(), date: dt.getUTCDate() };
  });

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex rounded-lg bg-hover p-0.5 text-xs">
          {SCALES.map((s) => (
            <button key={s.id} onClick={() => setScale(s.id)} className={`rounded-md px-2.5 py-1 ${scale === s.id ? "bg-card font-semibold shadow-sm" : "text-muted"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={() => scrollToToday(true)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-hover">
          Hoje
        </button>
      </div>

      <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
        <div className="flex" style={{ width: "max-content" }}>
          <div className="sticky left-0 z-20 w-[136px] shrink-0 border-r border-line bg-card sm:w-[240px]">
            <div className="h-14 border-b border-line" />
            {items.map((it) =>
              it.kind === "group" ? (
                <div key={`g-${it.id}`} className="flex items-center gap-2 border-b border-line bg-hover/50 px-3 text-xs font-semibold" style={{ height: ROW_H }}>
                  <span className="min-w-0 truncate">{it.label}</span>
                  <span className="text-faint">{it.count}</span>
                </div>
              ) : (
                <Link
                  key={it.row.id}
                  href={`/p/${it.row.id}`}
                  className="flex items-center gap-2 border-b border-line px-3 text-sm hover:bg-hover"
                  style={{ height: ROW_H }}
                >
                  {hasPageIcon(it.row.icon) && <PageIcon name={it.row.icon} className="h-3.5 w-3.5 text-muted" />}
                  <span className={`min-w-0 truncate ${def.doneStatus && it.row.props.estado === def.doneStatus ? "text-muted line-through" : ""}`}>
                    {it.row.title || "Sem título"}
                  </span>
                </Link>
              ),
            )}
          </div>

          <div className="relative select-none" style={{ width: days * dayW }}>
            <div className="sticky top-0 z-10 h-14 border-b border-line bg-card">
              <div className="relative h-7 border-b border-line">
                {months.map((m) => (
                  <div key={m.label} className="absolute top-0 flex h-7 items-center border-l border-line px-2 text-xs font-semibold whitespace-nowrap" style={{ left: m.left, width: m.width }}>
                    <span className="sticky left-[150px] sm:left-[254px]">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative h-7">
                {dayCells.map((c) =>
                  scale === "trimestre" ? (
                    c.dow === 1 && (
                      <div key={c.i} className="absolute top-0 flex h-7 items-center pl-0.5 text-[10px] text-faint" style={{ left: c.i * dayW }}>
                        {c.date}
                      </div>
                    )
                  ) : (
                    <div
                      key={c.i}
                      className={`absolute top-0 flex h-7 items-center justify-center text-[11px] ${rangeStart + c.i === today ? "font-bold text-[#dc2626]" : c.dow === 0 || c.dow === 6 ? "text-faint" : "text-muted"}`}
                      style={{ left: c.i * dayW, width: dayW }}
                    >
                      {scale === "semana" || c.date % 2 === 1 ? c.date : ""}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0">
              {scale !== "trimestre" &&
                dayCells
                  .filter((c) => c.dow === 0 || c.dow === 6)
                  .map((c) => <div key={c.i} className="absolute top-0 bottom-0 bg-hover/60" style={{ left: c.i * dayW, width: dayW }} />)}
              {scale === "trimestre" &&
                dayCells
                  .filter((c) => c.dow === 1)
                  .map((c) => <div key={c.i} className="absolute top-0 bottom-0 border-l border-line" style={{ left: c.i * dayW }} />)}
              <div className="absolute top-0 bottom-0 w-0.5 bg-[#dc2626]/70" style={{ left: (today - rangeStart) * dayW + dayW / 2 - 1 }} />
            </div>

            {items.map((it) => {
              if (it.kind === "group") return <div key={`g-${it.id}`} className="border-b border-line bg-hover/30" style={{ height: ROW_H }} />;
              const { row } = it;
              if (!it.span)
                return (
                  <div
                    key={row.id}
                    title="Clica para definir a data"
                    onClick={(e) => {
                      const day = rangeStart + Math.floor(e.nativeEvent.offsetX / dayW);
                      patchPage(db, row.id, { props: { [dateKey]: { start: isoDay(day) } } });
                    }}
                    className="relative cursor-copy border-b border-line hover:bg-accent-soft/40"
                    style={{ height: ROW_H }}
                  />
                );
              const s = previewSpan(row.id, it.span);
              const status = statusOf(row);
              const done = !!def.doneStatus && row.props.estado === def.doneStatus;
              const late = !done && it.span.end < today;
              const c = status?.color ?? "blue";
              const width = (s.end - s.start + 1) * dayW;
              const handle = (mode: "start" | "end") => (
                <span
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDrag({ id: row.id, mode, x0: e.clientX, delta: 0, moved: true });
                  }}
                  className={`absolute top-0 bottom-0 w-2 cursor-ew-resize ${mode === "start" ? "left-0" : "right-0"}`}
                />
              );
              return (
                <div key={row.id} className="relative border-b border-line" style={{ height: ROW_H }}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${row.title || "Sem título"}: arrastar para mudar as datas`}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      setDrag({ id: row.id, mode: "move", x0: e.clientX, delta: 0, moved: false });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/p/${row.id}`)}
                    className={`absolute top-1.5 flex h-6 touch-none items-center overflow-hidden rounded-md px-2 text-xs font-medium whitespace-nowrap shadow-sm ${
                      drag?.id === row.id ? "cursor-grabbing ring-2 ring-accent-fg" : "cursor-grab"
                    } ${done ? "opacity-50" : ""} ${late ? "ring-1 ring-[#dc2626]" : ""}`}
                    style={{ left: (s.start - rangeStart) * dayW + 1, width: Math.max(width - 2, 6), background: `var(--tag-${c}-bg)`, color: `var(--tag-${c}-fg)` }}
                  >
                    {width > 48 && <span className={`truncate ${done ? "line-through" : ""}`}>{row.title || "Sem título"}</span>}
                    {handle("start")}
                    {handle("end")}
                  </div>
                  {width <= 48 && (
                    <span className="pointer-events-none absolute top-1.5 flex h-6 items-center pl-1.5 text-xs whitespace-nowrap text-muted" style={{ left: (s.end - rangeStart + 1) * dayW }}>
                      {row.title}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {statusProp && "options" in statusProp && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          {statusProp.options.map((o) => (
            <StatusTag key={o.name} option={o} />
          ))}
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-[#dc2626]/70" /> Hoje
          </span>
        </div>
      )}
    </div>
  );
}
