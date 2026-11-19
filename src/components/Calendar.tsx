"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPage, patchPage } from "@/lib/client";
import { dateOf, isoDay, MONTHS_LONG, MS_DAY, moveDate, type Span, spanOf, todayNum } from "@/lib/dates";
import { DBS, type DateValue, type DbId, type Option, type PageRow, type View } from "@/lib/schema";
import { hasPageIcon, PageIcon } from "./icons";
import { StatusTag } from "./PropCell";
import { Icon, Tag } from "./ui";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MAX_VISIBLE = 3;

type Entry = { row: PageRow; span: Span };

export function Calendar({ db, view, rows, fixed }: { db: DbId; view: View; rows: PageRow[]; fixed?: Record<string, unknown> }) {
  const def = DBS[db];
  const dateKey = view.dateProp ?? "prazo";
  const router = useRouter();
  const [today] = useState(todayNum);
  const [cursor, setCursor] = useState(() => {
    const t = dateOf(today);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [over, setOver] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const first = Date.UTC(cursor.y, cursor.m, 1) / MS_DAY;
  const last = Date.UTC(cursor.y, cursor.m + 1, 0) / MS_DAY;
  const gridStart = first - ((dateOf(first).getUTCDay() + 6) % 7);
  const gridEnd = last + (6 - ((dateOf(last).getUTCDay() + 6) % 7));
  const days = Array.from({ length: gridEnd - gridStart + 1 }, (_, i) => gridStart + i);

  const entries: Entry[] = rows.flatMap((row) => {
    const span = spanOf(row.props[dateKey] as DateValue | undefined);
    return span && span.end >= gridStart && span.start <= gridEnd ? [{ row, span }] : [];
  });
  entries.sort((a, b) => a.span.start - b.span.start || b.span.end - b.span.start - (a.span.end - a.span.start) || a.row.title.localeCompare(b.row.title));
  const onDay = (d: number) => entries.filter((e) => e.span.start <= d && e.span.end >= d);
  const undated = rows.filter((r) => !spanOf(r.props[dateKey] as DateValue | undefined)).length;

  const statusProp = def.props.find((p) => p.key === "estado");
  const colorOf = (r: PageRow) => (statusProp && "options" in statusProp ? statusProp.options.find((o) => o.name === r.props.estado)?.color : undefined) ?? "blue";
  const isDone = (r: PageRow) => !!def.doneStatus && r.props.estado === def.doneStatus;

  const go = (delta: number) => {
    setExpanded(null);
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };
  const goToday = () => {
    const t = dateOf(today);
    setCursor({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
    setSelected(today);
  };
  const createOn = async (d: number) => {
    const page = await createPage(db, { title: "", props: { ...fixed, [dateKey]: { start: isoDay(d) } } });
    router.push(`/p/${page.id}`);
  };
  const drop = (d: number, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const row = rows.find((r) => r.id === e.dataTransfer.getData("text/yl-page"));
    const v = row?.props[dateKey] as DateValue | undefined;
    if (row && v?.start) patchPage(db, row.id, { props: { [dateKey]: moveDate(v, d) } });
  };

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h3 className="flex-1 text-[15px] font-black tracking-tight capitalize">
          {MONTHS_LONG[cursor.m]} {cursor.y}
        </h3>
        <button onClick={goToday} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-hover">
          Hoje
        </button>
        <button onClick={() => go(-1)} aria-label="Mês anterior" className="press rounded-lg p-1.5 text-muted hover:bg-hover">
          <Icon name="chevron" className="rotate-180" />
        </button>
        <button onClick={() => go(1)} aria-label="Mês seguinte" className="press rounded-lg p-1.5 text-muted hover:bg-hover">
          <Icon name="chevron" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold tracking-wide text-faint uppercase">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1.5">
            {w}
          </div>
        ))}
      </div>

      {/* Computador: grelha completa com arrastar e largar */}
      <div className="hidden grid-cols-7 sm:grid">
        {days.map((d, i) => {
          const list = onDay(d);
          const inMonth = d >= first && d <= last;
          const weekend = i % 7 >= 5;
          const open = expanded === d;
          const shown = open ? list : list.slice(0, MAX_VISIBLE);
          return (
            <div
              key={d}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(d);
              }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={(e) => drop(d, e)}
              className={`group relative min-h-[118px] border-r border-b border-line p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0 ${
                over === d ? "bg-accent-soft" : weekend ? "bg-hover/40" : ""
              } ${inMonth ? "" : "opacity-45"}`}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs ${
                    d === today ? "bg-[#dc2626] px-1.5 font-bold text-white" : "font-medium text-muted"
                  }`}
                >
                  {dateOf(d).getUTCDate()}
                  {dateOf(d).getUTCDate() === 1 && d !== today && <span className="ml-1">{MONTHS_LONG[dateOf(d).getUTCMonth()].slice(0, 3)}</span>}
                </span>
                <button
                  onClick={() => createOn(d)}
                  aria-label={`Nova ${def.singular} a ${isoDay(d)}`}
                  className="rounded-md p-0.5 text-faint opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-fg focus:opacity-100"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                {shown.map(({ row, span }) => {
                  const c = colorOf(row);
                  const isStart = span.start === d;
                  const isEnd = span.end === d;
                  const showTitle = isStart || i % 7 === 0;
                  return (
                    <Link
                      key={row.id}
                      href={`/p/${row.id}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/yl-page", row.id)}
                      title={row.title || "Sem título"}
                      className={`flex h-[22px] items-center gap-1 truncate px-1.5 text-[11.5px] leading-none font-medium hover:brightness-110 ${
                        isStart ? "rounded-l-md" : "-ml-1 pl-2.5"
                      } ${isEnd ? "rounded-r-md" : "-mr-1"} ${isDone(row) ? "line-through opacity-55" : ""}`}
                      style={{ background: `var(--tag-${c}-bg)`, color: `var(--tag-${c}-fg)` }}
                    >
                      {showTitle && (
                        <>
                          {hasPageIcon(row.icon) && <PageIcon name={row.icon} className="h-3 w-3" />}
                          <span className="truncate">{row.title || "Sem título"}</span>
                        </>
                      )}
                    </Link>
                  );
                })}
                {list.length > MAX_VISIBLE && (
                  <button onClick={() => setExpanded(open ? null : d)} className="rounded px-1.5 py-0.5 text-left text-[11px] font-semibold text-muted hover:bg-hover">
                    {open ? "Mostrar menos" : `+${list.length - MAX_VISIBLE} mais`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telemóvel: grelha compacta + lista do dia escolhido */}
      <div className="sm:hidden">
        <div className="grid grid-cols-7 gap-y-1 px-1 py-2">
          {days.map((d) => {
            const list = onDay(d);
            const inMonth = d >= first && d <= last;
            const isSel = d === selected;
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={`press mx-auto flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl ${isSel ? "bg-accent text-white" : ""} ${inMonth ? "" : "opacity-40"}`}
              >
                <span className={`text-sm ${d === today && !isSel ? "font-black text-[#dc2626]" : isSel ? "font-bold" : ""}`}>{dateOf(d).getUTCDate()}</span>
                <span className="flex h-1.5 gap-0.5">
                  {list.slice(0, 3).map(({ row }) => (
                    <span key={row.id} className="h-1.5 w-1.5 rounded-full" style={{ background: isSel ? "#fff" : `var(--tag-${colorOf(row)}-fg)`, opacity: isSel ? 0.9 : 0.7 }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black tracking-tight">
              {dateOf(selected).getUTCDate()} de {MONTHS_LONG[dateOf(selected).getUTCMonth()]}
            </p>
            <button onClick={() => createOn(selected)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-fg hover:bg-hover">
              <Icon name="plus" className="h-3.5 w-3.5" /> Nova
            </button>
          </div>
          {onDay(selected).length === 0 ? (
            <p className="py-4 text-center text-sm text-faint">Nada marcado para este dia.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {onDay(selected).map(({ row }) => {
                const st = statusProp && "options" in statusProp ? statusProp.options.find((o) => o.name === row.props.estado) : undefined;
                const proj = def.props.find((p) => p.key === "projeto");
                const projOpt = proj && "options" in proj ? (proj.options as Option[]).find((o) => o.name === row.props.projeto) : undefined;
                return (
                  <Link key={row.id} href={`/p/${row.id}`} className="press flex flex-col gap-1.5 rounded-xl border border-line p-3">
                    <span className={`text-[15px] leading-snug font-semibold ${isDone(row) ? "text-muted line-through" : ""}`}>{row.title || "Sem título"}</span>
                    <span className="flex flex-wrap gap-1.5 text-xs">
                      {st && <StatusTag option={st} />}
                      {projOpt && <Tag option={projOpt} />}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {undated > 0 && (
        <div className="border-t border-line px-3 py-2 text-xs text-muted">
          {undated} {undated === 1 ? `${def.singular} sem data` : `${def.name.toLowerCase()} sem data`} (não aparecem no calendário)
        </div>
      )}
    </div>
  );
}
