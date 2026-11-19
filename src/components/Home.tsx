"use client";

import Link from "next/link";
import { useMemo } from "react";
import { patchPage, usePages, useUsers } from "@/lib/client";
import { DBS, PROJECT_TAGS, type DateValue, type PageRow } from "@/lib/schema";
import { StatusTag } from "./PropCell";
import { useMe } from "./Shell";
import { formatDate, Icon, isOverdue, parseDate, Tag } from "./ui";
import { hasPageIcon, PageIcon } from "./icons";

const tarefas = DBS.tarefas;

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Boa noite" : h < 13 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

const byDue = (a: PageRow, b: PageRow) =>
  ((a.props.prazo as DateValue | undefined)?.start ?? "9999").localeCompare((b.props.prazo as DateValue | undefined)?.start ?? "9999");

export function Home() {
  const me = useMe();
  const { data: users = [] } = useUsers();
  const { data: tasks = [], isLoading } = usePages("tarefas");
  const { data: projects = [] } = usePages("projetos");
  const user = users.find((u) => u.id === me);

  const open = useMemo(() => tasks.filter((t) => t.props.estado !== tarefas.doneStatus && t.title), [tasks]);
  const mine = useMemo(
    () => (me ? open.filter((t) => ((t.props.responsavel as string[]) ?? []).includes(me)) : open.filter((t) => t.props.prioridade === "Urgente")).sort(byDue),
    [open, me],
  );
  const overdue = open.filter((t) => isOverdue(t.props.prazo as DateValue));
  const week = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 7);
    return open
      .filter((t) => {
        const d = t.props.prazo as DateValue | undefined;
        if (!d?.start) return false;
        const s = parseDate(d.start);
        return s >= now && s <= limit;
      })
      .sort(byDue);
  }, [open]);
  const activeProjects = projects.filter((p) => p.props.estado !== DBS.projetos.doneStatus);

  const today = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 pb-10 sm:px-8 lg:pt-12">
      <p className="text-[11px] font-bold tracking-widest text-accent-fg uppercase">{today}</p>
      <h1 className="mt-1 text-[30px] leading-tight font-black tracking-tight sm:text-[40px]">
        {greeting()}
        {user ? `, ${user.name.split(" ")[0]}` : ""}
      </h1>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        <Stat label="Tarefas abertas" value={open.length} href="/tarefas" />
        <Stat label="Em atraso" value={overdue.length} tone={overdue.length ? "danger" : undefined} href="/tarefas" />
        <Stat label="Projetos ativos" value={activeProjects.length} href="/projetos" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title={me ? "As minhas tarefas" : "Tarefas urgentes"} count={mine.length}>
          {isLoading ? <Muted>A carregar…</Muted> : mine.length === 0 ? <Muted>Nada pendente.</Muted> : mine.slice(0, 12).map((t) => <TaskRow key={t.id} t={t} />)}
          {mine.length > 12 && (
            <Link href="/tarefas" className="block px-3 py-2 text-sm text-accent-fg">
              Ver todas ({mine.length})
            </Link>
          )}
        </Card>
        <Card title="Próximos 7 dias" count={week.length}>
          {week.length === 0 ? <Muted>Sem prazos esta semana.</Muted> : week.map((t) => <TaskRow key={t.id} t={t} compact />)}
        </Card>
      </div>

      <div className="mt-10 mb-3 flex items-end justify-between">
        <h2 className="text-xl font-black tracking-tight">Projetos</h2>
        <Link href="/projetos" className="text-sm text-accent-fg">
          Ver todos
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activeProjects.map((p) => {
          const pt = tasks.filter((t) => t.props.projeto === p.props.etiqueta && t.title);
          const done = pt.filter((t) => t.props.estado === tarefas.doneStatus).length;
          const estado = DBS.projetos.props[0];
          const opt = "options" in estado ? estado.options.find((o) => o.name === p.props.estado) : undefined;
          return (
            <Link key={p.id} href={`/p/${p.id}`} className="press flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 hover:border-line-strong">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold tracking-tight">
                  <PageIcon name={p.icon} fallback="folder" className="mr-1.5 inline h-4 w-4 -translate-y-px text-muted" />
                  {p.title}
                </span>
                {opt && <StatusTag option={opt} />}
              </div>
              {typeof p.props.resumo === "string" && <p className="line-clamp-2 text-sm text-muted">{p.props.resumo}</p>}
              <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-active">
                  <div className="h-full rounded-full bg-accent" style={{ width: pt.length ? `${(done / pt.length) * 100}%` : 0 }} />
                </div>
                {done}/{pt.length} tarefas
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone?: "danger"; href: string }) {
  return (
    <Link href={href} className="press min-w-[140px] flex-1 rounded-2xl border border-line bg-card px-4 py-3">
      <div className={`text-[28px] leading-none font-black tracking-tight ${tone === "danger" ? "text-[#dc2626]" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </Link>
  );
}

function Card({ title, subtitle, count, children }: { title: string; subtitle?: string; count: number; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <header className="flex items-baseline gap-2 border-b border-line px-4 py-3">
        <h2 className="font-black tracking-tight">{title}</h2>
        <span className="text-sm text-faint">{count}</span>
        {subtitle && <span className="ml-auto hidden text-xs text-faint sm:inline">{subtitle}</span>}
      </header>
      <div className="p-1">{children}</div>
    </section>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => <p className="px-3 py-6 text-center text-sm text-faint">{children}</p>;

function TaskRow({ t, compact }: { t: PageRow; compact?: boolean }) {
  const prazo = t.props.prazo as DateValue | undefined;
  const late = isOverdue(prazo);
  const proj = PROJECT_TAGS.find((o) => o.name === t.props.projeto);
  return (
    <div className="group flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-hover">
      <button
        aria-label="Marcar como feita"
        onClick={() => patchPage("tarefas", t.id, { props: { estado: tarefas.doneStatus } })}
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong text-transparent hover:border-accent-fg hover:text-accent-fg"
      >
        <Icon name="check" className="h-3 w-3" />
      </button>
      <Link href={`/p/${t.id}`} className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{t.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {prazo && <span className={late ? "font-semibold text-[#dc2626]" : ""}>{formatDate(prazo)}</span>}
          {!compact && proj && <Tag option={proj} />}
          {t.props.prioridade === "Urgente" && !compact && <span className="font-semibold text-[#dc2626]">Urgente</span>}
        </span>
      </Link>
    </div>
  );
}
