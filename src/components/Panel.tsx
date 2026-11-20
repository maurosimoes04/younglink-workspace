"use client";

import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock, Users, WifiOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { dateOf, dayNum, MONTHS, MONTHS_LONG, MS_DAY, todayNum } from "@/lib/dates";
import { BrandTile } from "./Shell";

type Item = {
  id: string;
  kind: "tarefa" | "projeto";
  title: string;
  start: string;
  end: string | null;
  done: boolean;
  urgent: boolean;
  status: string | null;
  tag: { name: string; color: string } | null;
  people: string[];
  note: string | null;
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAYS_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const fetchPanel = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error ?? "Sem ligação."), { status: res.status });
  return data as { items: Item[]; now: string };
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useKeepAwake() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getHours() >= 4 ? 1 : 0), 4, 0, 0);
    const reload = setTimeout(() => window.location.reload(), next.getTime() - now.getTime());
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(reload);
      lock?.release().catch(() => {});
    };
  }, []);
}

const span = (it: Item) => ({ start: dayNum(it.start), end: it.end ? Math.max(dayNum(it.start), dayNum(it.end)) : dayNum(it.start) });

function dayLabel(it: Item, monthStart: number) {
  const s = span(it);
  const from = dateOf(Math.max(s.start, monthStart));
  const to = dateOf(s.end);
  if (s.start === s.end) return { day: String(from.getUTCDate()), sub: WEEKDAYS[from.getUTCDay()] };
  const sameMonth = to.getUTCMonth() === from.getUTCMonth();
  return {
    day: `${from.getUTCDate()}–${to.getUTCDate()}`,
    sub: sameMonth ? `${WEEKDAYS[from.getUTCDay()]} a ${WEEKDAYS[to.getUTCDay()]}` : `até ${to.getUTCDate()} ${MONTHS[to.getUTCMonth()]}`,
  };
}

export function Panel() {
  const k = useSearchParams().get("k") ?? "";
  const { data, error } = useSWR(k ? `/api/painel?k=${encodeURIComponent(k)}` : null, fetchPanel, {
    refreshInterval: 60_000,
    keepPreviousData: true,
    revalidateOnFocus: true,
    shouldRetryOnError: true,
    errorRetryInterval: 30_000,
  });
  const now = useClock();
  useKeepAwake();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<Item | null>(null);
  const today = todayNum();

  if (!k || (error as { status?: number } | undefined)?.status === 401)
    return (
      <div className="flex min-h-dvh items-center justify-center p-8 text-center">
        <div className="flex max-w-md flex-col items-center">
          <BrandTile size={64} />
          <p className="mt-6 text-2xl font-black tracking-tight">Painel indisponível</p>
          <p className="mt-2 text-muted">Este link não é válido ou foi revogado. Pede um novo na Administração do espaço de trabalho.</p>
        </div>
      </div>
    );

  const base = dateOf(today);
  const months = [0, 1].map((i) => {
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth() + offset + i;
    const start = Date.UTC(y, m, 1) / MS_DAY;
    const end = Date.UTC(y, m + 1, 0) / MS_DAY;
    const d = dateOf(start);
    return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTHS_LONG[d.getUTCMonth()], year: d.getUTCFullYear(), start, end };
  });
  const items = data?.items ?? [];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg select-none">
      <header className="flex items-center gap-4 px-6 pt-5 pb-3 sm:px-8">
        <BrandTile size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.25em] text-accent-fg uppercase">Young-Link</p>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Agenda da sede</h1>
        </div>
        <div className="text-right">
          <p className="text-4xl leading-none font-black tracking-tight tabular-nums sm:text-5xl">
            {now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {WEEKDAYS_LONG[now.getDay()]}, {now.getDate()} de {MONTHS_LONG[now.getMonth()]}
          </p>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-3 sm:px-8 md:grid-cols-2">
        {months.map((m) => {
          const list = items.filter((it) => {
            const s = span(it);
            return s.end >= m.start && s.start <= m.end;
          });
          return (
            <section key={m.key} className="flex min-h-0 flex-col rounded-3xl border border-line bg-card">
              <h2 className="flex items-baseline gap-2 border-b border-line px-5 py-3">
                <span className="text-2xl font-black tracking-tight capitalize">{m.label}</span>
                <span className="text-base text-faint">{m.year}</span>
                <span className="ml-auto text-sm text-muted">{list.length || ""}</span>
              </h2>
              <div className="flex-1 overflow-y-auto p-2">
                {list.length === 0 && <p className="px-4 py-10 text-center text-muted">Nada marcado para este mês.</p>}
                {list.map((it) => {
                  const s = span(it);
                  const past = s.end < today;
                  const now = s.start <= today && s.end >= today;
                  const label = dayLabel(it, m.start);
                  const alert = it.urgent && !it.done && !past;
                  return (
                    <button
                      key={it.id}
                      onClick={() => setOpen(it)}
                      className={`press flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-hover ${now ? "bg-accent-soft" : ""} ${
                        past || it.done ? "opacity-45" : ""
                      }`}
                    >
                      <span
                        className={`flex w-[74px] shrink-0 flex-col items-center rounded-xl py-1.5 ${
                          alert ? "bg-[#dc2626]/12 text-[#dc2626]" : now ? "bg-accent text-white" : "bg-hover"
                        }`}
                      >
                        <span className={`leading-none font-black tabular-nums ${label.day.length > 3 ? "text-xl" : "text-[28px]"}`}>{label.day}</span>
                        <span className={`mt-1 text-[11px] font-semibold uppercase ${alert || now ? "" : "text-muted"}`}>{label.sub}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-start gap-1.5 text-lg leading-snug font-bold ${it.done ? "line-through" : ""}`}>
                          {alert && <CircleAlert className="mt-1 h-[18px] w-[18px] shrink-0 text-[#dc2626]" />}
                          <span className="line-clamp-2">{it.title}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                          <span className="inline-flex items-center gap-1">
                            {it.kind === "tarefa" ? <Clock className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                            {it.kind === "tarefa" ? "Prazo" : "Projeto"}
                          </span>
                          {it.tag && (
                            <span className="rounded-md px-1.5 text-[13px] font-medium" style={{ background: `var(--tag-${it.tag.color}-bg)`, color: `var(--tag-${it.tag.color}-fg)` }}>
                              {it.tag.name}
                            </span>
                          )}
                          {now && <span className="font-bold text-accent-fg">Hoje</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="flex items-center gap-2 px-6 pt-1 pb-4 text-sm text-muted sm:px-8">
        <button onClick={() => setOffset((o) => o - 1)} aria-label="Meses anteriores" className="press rounded-xl border border-line p-2.5 hover:bg-hover">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setOffset(0)} className="press rounded-xl border border-line px-4 py-2 font-semibold hover:bg-hover">
          Hoje
        </button>
        <button onClick={() => setOffset((o) => o + 1)} aria-label="Meses seguintes" className="press rounded-xl border border-line p-2.5 hover:bg-hover">
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="ml-auto flex items-center gap-2">
          {error && data && (
            <span className="flex items-center gap-1 font-semibold text-[#b45309] dark:text-[#fbbf24]">
              <WifiOff className="h-4 w-4" /> Sem ligação, a mostrar a última versão
            </span>
          )}
          {data && <span>Atualizado às {new Date(data.now).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>}
        </span>
      </footer>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <div className="w-full max-w-lg rounded-t-3xl border border-line bg-card p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-bold tracking-widest text-accent-fg uppercase">{open.kind === "tarefa" ? "Prazo" : "Projeto"}</p>
            <h3 className={`mt-1 text-2xl leading-tight font-black tracking-tight ${open.done ? "line-through opacity-60" : ""}`}>{open.title}</h3>
            <div className="mt-4 flex flex-col gap-2 text-base">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted" />
                {(() => {
                  const s = span(open);
                  const f = (n: number) => `${dateOf(n).getUTCDate()} de ${MONTHS_LONG[dateOf(n).getUTCMonth()]}`;
                  return s.start === s.end ? f(s.start) : `${f(s.start)} a ${f(s.end)}`;
                })()}
              </p>
              {open.people.length > 0 && (
                <p className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted" /> {open.people.join(", ")}
                </p>
              )}
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {open.status && <span className="rounded-md bg-hover px-2 py-0.5 font-medium">{open.status}</span>}
                {open.tag && (
                  <span className="rounded-md px-2 py-0.5 font-medium" style={{ background: `var(--tag-${open.tag.color}-bg)`, color: `var(--tag-${open.tag.color}-fg)` }}>
                    {open.tag.name}
                  </span>
                )}
              </p>
              {open.note && <p className="mt-2 max-h-48 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-muted">{open.note}</p>}
            </div>
            <button onClick={() => setOpen(null)} className="press mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
