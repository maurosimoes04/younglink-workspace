"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { createPage, patchPage, usePages, useUsers } from "@/lib/client";
import { DBS, type DateValue, type DbId, type Option, type PageRow, type Prop, type User, type View } from "@/lib/schema";
import { PropCell, PropValue, StatusTag } from "./PropCell";
import { Timeline } from "./Timeline";
import { Calendar } from "./Calendar";
import { Avatar, Icon, Tag } from "./ui";
import { hasPageIcon, PageIcon } from "./icons";

type Filters = { q: string; person: string; projeto: string };

const noopSubscribe = () => () => {};

export function DatabaseView({
  db,
  fixed,
  embedded,
  title,
}: {
  db: DbId;
  fixed?: Record<string, unknown>;
  embedded?: boolean;
  title?: string;
}) {
  const def = DBS[db];
  const { data: rows, isLoading } = usePages(db);
  const { data: users = [] } = useUsers();
  const storeKey = `yl:view:${db}${embedded ? ":emb" : ""}`;
  const saved = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return localStorage.getItem(storeKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ q: "", person: "", projeto: "" });

  const views = def.views.filter((v) => v.type === "timeline" || !(v.groupBy && fixed && v.groupBy in fixed));
  const viewId = picked ?? saved;
  const view = views.find((v) => v.id === viewId) ?? views[0];
  const pickView = (id: string) => {
    setPicked(id);
    try {
      localStorage.setItem(storeKey, id);
    } catch {}
  };

  const visible = (() => {
    let list = rows ?? [];
    if (fixed) list = list.filter((r) => Object.entries(fixed).every(([k, v]) => r.props[k] === v));
    if (view.hideDone && def.doneStatus) list = list.filter((r) => r.props.estado !== def.doneStatus);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q) || String(r.props.notas ?? r.props.resumo ?? "").toLowerCase().includes(q));
    }
    if (filters.person) list = list.filter((r) => ((r.props.responsavel as string[]) ?? []).includes(filters.person));
    if (filters.projeto) list = list.filter((r) => r.props.projeto === filters.projeto);
    return sortRows(list, view.sortBy ? def.props.find((p) => p.key === view.sortBy) : undefined);
  })();

  const hasProjeto = def.props.some((p) => p.key === "projeto") && !fixed?.projeto;
  const hasPerson = def.props.some((p) => p.key === "responsavel");

  return (
    <div className={embedded ? "" : "px-4 pt-3 pb-10 sm:px-8 lg:px-16 lg:pt-12"}>
      {embedded ? (
        <h3 className="mb-1 flex items-center gap-2 text-base font-black tracking-tight">
          <PageIcon name={def.icon} className="h-4 w-4 text-muted" /> {title ?? def.name}
        </h3>
      ) : (
        <h1 className="mb-6 hidden items-center gap-3 text-[40px] leading-tight font-black tracking-tight lg:flex">
          <PageIcon name={def.icon} className="h-9 w-9 text-accent-fg" />
          {def.name}
        </h1>
      )}

      <div className="mb-1 flex flex-col gap-y-1.5 border-b border-line pb-1.5 xl:flex-row xl:items-center">
        <div className="no-scrollbar -mx-4 flex min-w-0 items-center gap-0.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 xl:flex-1">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => pickView(v.id)}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm whitespace-nowrap ${v.id === view.id ? "text-fg shadow-[inset_0_-2px_0_var(--fg)]" : "text-muted hover:bg-hover"}`}
            >
              <Icon name={v.type === "board" ? "board" : v.type === "timeline" ? "timeline" : v.type === "calendar" ? "calendar" : "table"} className="h-3.5 w-3.5" />
              {v.name}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <label className="flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 text-muted focus-within:bg-hover sm:flex-none">
            <Icon name="search" className="h-3.5 w-3.5" />
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Procurar"
              aria-label="Procurar"
              className="w-full min-w-0 bg-transparent py-1 text-sm text-fg outline-none placeholder:text-faint sm:w-24 sm:focus:w-40"
            />
          </label>
          {hasPerson && (
            <FilterSelect
              label="Responsável"
              value={filters.person}
              onChange={(person) => setFilters({ ...filters, person })}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          )}
          {hasProjeto && (
            <FilterSelect
              label="Projeto"
              value={filters.projeto}
              onChange={(projeto) => setFilters({ ...filters, projeto })}
              options={(def.props.find((p) => p.key === "projeto") as { options: Option[] }).options.map((o) => ({ value: o.name, label: o.name }))}
            />
          )}
          <NewButton db={db} defaults={{ ...fixed, ...(filters.projeto ? { projeto: filters.projeto } : {}) }} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-sm text-faint">A carregar…</div>
      ) : view.type === "calendar" ? (
        <Calendar db={db} view={view} rows={visible} fixed={fixed} />
      ) : view.type === "timeline" ? (
        <Timeline db={db} view={fixed && view.groupBy && view.groupBy in fixed ? { ...view, groupBy: undefined } : view} rows={visible} />
      ) : view.type === "board" ? (
        <Board db={db} view={view} rows={visible} users={users} fixed={fixed} />
      ) : (
        <GroupedTable db={db} view={view} rows={visible} users={users} fixed={fixed} hideProps={embedded ? Object.keys(fixed ?? {}) : []} />
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`w-[104px] shrink-0 rounded bg-transparent px-1 py-1 text-sm outline-none hover:bg-hover sm:w-auto sm:max-w-40 ${value ? "font-semibold text-accent-fg" : "text-muted"}`}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NewButton({ db, defaults }: { db: DbId; defaults: Record<string, unknown> }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const p = await createPage(db, { props: defaults });
        router.push(`/p/${p.id}`);
      }}
      className="ml-1 shrink-0 rounded-lg bg-accent px-2.5 py-1 text-sm font-medium text-white hover:opacity-90"
    >
      Nova
    </button>
  );
}

function sortRows(rows: PageRow[], prop?: Prop) {
  if (!prop) return rows;
  const key = (r: PageRow): number | string => {
    const v = r.props[prop.key];
    if (prop.type === "date") return (v as DateValue | undefined)?.start ?? "9999";
    if (prop.type === "select" || prop.type === "status") {
      const i = prop.options.findIndex((o) => o.name === v);
      return i < 0 ? 999 : i;
    }
    return String(v ?? "");
  };
  const desc = prop.key === "atualizado";
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    const c = ka < kb ? -1 : ka > kb ? 1 : 0;
    return desc ? -c : c;
  });
}

type Group = { id: string; label: React.ReactNode; rows: PageRow[]; value: unknown };

function groupRows(rows: PageRow[], prop: Prop | undefined, users: User[], keepEmpty: boolean): Group[] {
  if (!prop) return [{ id: "all", label: null, rows, value: undefined }];
  const groups: Group[] = [];
  if (prop.type === "select" || prop.type === "status") {
    for (const o of prop.options) {
      const rs = rows.filter((r) => r.props[prop.key] === o.name);
      if (rs.length || keepEmpty) groups.push({ id: o.name, label: prop.type === "status" ? <StatusTag option={o} /> : <Tag option={o} />, rows: rs, value: o.name });
    }
    const none = rows.filter((r) => !prop.options.some((o) => o.name === r.props[prop.key]));
    if (none.length) groups.push({ id: "__none", label: <span className="text-muted">Sem {prop.name.toLowerCase()}</span>, rows: none, value: null });
  } else if (prop.type === "person") {
    for (const u of users) {
      const rs = rows.filter((r) => ((r.props[prop.key] as string[]) ?? []).includes(u.id));
      if (rs.length || keepEmpty)
        groups.push({
          id: u.id,
          label: (
            <span className="flex items-center gap-1.5">
              <Avatar user={u} /> {u.name}
            </span>
          ),
          rows: rs,
          value: [u.id],
        });
    }
    const none = rows.filter((r) => !((r.props[prop.key] as string[]) ?? []).length);
    if (none.length || keepEmpty) groups.push({ id: "__none", label: <span className="text-muted">Sem responsável</span>, rows: none, value: null });
  }
  return groups;
}

function tableProps(db: DbId, hide: string[]) {
  return DBS[db].props.filter((p) => !hide.includes(p.key) && !(p.type === "relation") && p.key !== "etiqueta");
}

const colWidth = (p: Prop) => (p.type === "text" ? 280 : p.type === "date" ? 170 : p.type === "url" ? 200 : 150);

function GroupedTable({ db, view, rows, users, fixed, hideProps }: { db: DbId; view: View; rows: PageRow[]; users: User[]; fixed?: Record<string, unknown>; hideProps: string[] }) {
  const def = DBS[db];
  const groupProp = view.groupBy ? def.props.find((p) => p.key === view.groupBy) : undefined;
  const groups = groupRows(rows, groupProp, users, false);
  const cols = tableProps(db, [...hideProps, ...(view.groupBy ? [view.groupBy] : [])]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (rows.length === 0) return <Empty db={db} />;

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {groups.map((g) => (
          <div key={g.id} className={groupProp ? "mt-5" : ""}>
            {groupProp && (
              <button onClick={() => setCollapsed({ ...collapsed, [g.id]: !collapsed[g.id] })} className="mb-1 flex items-center gap-2 rounded px-1 py-1 text-sm font-medium hover:bg-hover">
                <Icon name="chevron" className={`h-3 w-3 transition-transform ${collapsed[g.id] ? "" : "rotate-90"}`} />
                {g.label}
                <span className="text-faint">{g.rows.length}</span>
              </button>
            )}
            {!collapsed[g.id] && (
              <>
                <div className="hidden sm:block">
                  <Table db={db} cols={cols} rows={g.rows} defaults={{ ...fixed, ...(groupProp && g.value != null ? { [groupProp.key]: g.value } : {}) }} />
                </div>
                <MobileList db={db} cols={cols} rows={g.rows} users={users} defaults={{ ...fixed, ...(groupProp && g.value != null ? { [groupProp.key]: g.value } : {}) }} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Table({ db, cols, rows, defaults }: { db: DbId; cols: Prop[]; rows: PageRow[]; defaults: Record<string, unknown> }) {
  const def = DBS[db];
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-y border-line text-left text-muted">
          <th className="min-w-[260px] px-2 py-1.5 font-normal sm:min-w-[340px]">{def.titleName}</th>
          {cols.map((c) => (
            <th key={c.key} className="border-l border-line px-2 py-1.5 font-normal whitespace-nowrap" style={{ minWidth: colWidth(c) }}>
              {c.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="group border-b border-line">
            <td className="px-2 py-1.5 align-top">
              <Link href={`/p/${r.id}`} className="flex items-start gap-1.5 font-medium">
                {hasPageIcon(r.icon) && <PageIcon name={r.icon} className="mt-0.5 h-4 w-4 text-muted" />}
                <span className={`underline decoration-transparent underline-offset-2 group-hover:decoration-line-strong ${r.title ? "" : "text-faint"}`}>{r.title || "Sem título"}</span>
              </Link>
            </td>
            {cols.map((c) => (
              <td key={c.key} className="border-l border-line align-top" style={{ maxWidth: colWidth(c) + 80 }}>
                <PropCell db={db} page={r} prop={c} done={!!def.doneStatus && r.props.estado === def.doneStatus} />
              </td>
            ))}
          </tr>
        ))}
        <tr>
          <td colSpan={cols.length + 1}>
            <InlineNew db={db} defaults={defaults} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function MobileList({ db, cols, rows, users, defaults }: { db: DbId; cols: Prop[]; rows: PageRow[]; users: User[]; defaults: Record<string, unknown> }) {
  const def = DBS[db];
  const chips = cols.filter((c) => c.type !== "text" && c.type !== "url");
  return (
    <div className="flex flex-col gap-2 pt-2 sm:hidden">
      {rows.map((r) => {
        const done = !!def.doneStatus && r.props.estado === def.doneStatus;
        return (
          <Link key={r.id} href={`/p/${r.id}`} className="press flex flex-col gap-2 rounded-2xl border border-line bg-card p-3.5">
            <span className={`text-[15px] leading-snug font-semibold ${done ? "text-muted line-through" : ""} ${r.title ? "" : "text-faint"}`}>
              {hasPageIcon(r.icon) && <PageIcon name={r.icon} className="mr-1.5 inline h-4 w-4 -translate-y-px text-muted" />}
              {r.title || "Sem título"}
            </span>
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
              {chips.map((c) =>
                r.props[c.key] == null ? null : <PropValue key={c.key} page={r} prop={c} users={users} done={done} />,
              )}
            </span>
          </Link>
        );
      })}
      <div className="rounded-2xl border border-dashed border-line">
        <InlineNew db={db} defaults={defaults} />
      </div>
    </div>
  );
}

function InlineNew({ db, defaults }: { db: DbId; defaults: Record<string, unknown> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const submit = async () => {
    const t = title.trim();
    setTitle("");
    if (t) await createPage(db, { title: t, props: defaults });
    else setEditing(false);
  };
  return editing ? (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setTitle("");
          setEditing(false);
        }
      }}
      onBlur={submit}
      placeholder={`Escreve o nome da ${DBS[db].singular} e carrega Enter`}
      className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
    />
  ) : (
    <button onClick={() => setEditing(true)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-sm text-faint hover:bg-hover">
      <Icon name="plus" className="h-3.5 w-3.5" /> Nova
    </button>
  );
}

function Empty({ db }: { db: DbId }) {
  return (
    <div className="py-10 text-center text-sm text-faint">
      Nada por aqui.
      <InlineNew db={db} defaults={{}} />
    </div>
  );
}

function Board({ db, view, rows, users, fixed }: { db: DbId; view: View; rows: PageRow[]; users: User[]; fixed?: Record<string, unknown> }) {
  const def = DBS[db];
  const groupProp = def.props.find((p) => p.key === view.groupBy)!;
  const groups = groupRows(rows, groupProp, users, true);
  const [over, setOver] = useState<string | null>(null);
  const cardProps = def.props.filter((p) => p.key !== groupProp.key && ["select", "status", "person", "date"].includes(p.type) && p.key !== "etiqueta" && !(fixed && p.key in fixed));

  const drop = (g: Group, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/yl-page");
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    patchPage(db, id, { props: { [groupProp.key]: g.value ?? null } });
  };

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pt-3 pb-4 sm:mx-0 sm:px-0">
      {groups.map((g) => (
        <div
          key={g.id}
          onDragOver={(e) => (e.preventDefault(), setOver(g.id))}
          onDragLeave={() => setOver((o) => (o === g.id ? null : o))}
          onDrop={(e) => drop(g, e)}
          className={`flex w-[260px] shrink-0 flex-col gap-2 rounded-lg p-1.5 transition-colors ${over === g.id ? "bg-active" : "bg-hover/40"}`}
        >
          <div className="flex items-center gap-2 px-1 py-1 text-sm">
            {g.label}
            <span className="text-faint">{g.rows.length}</span>
          </div>
          {g.rows.map((r) => (
            <Link
              key={r.id}
              href={`/p/${r.id}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/yl-page", r.id)}
              className="shadow-pop flex flex-col gap-1.5 rounded-md bg-popover p-2.5 text-sm hover:bg-hover"
            >
              <span className={`font-medium ${r.title ? "" : "text-faint"}`}>
                {hasPageIcon(r.icon) && <PageIcon name={r.icon} className="mr-1 inline h-4 w-4 -translate-y-px text-muted" />}
                {r.title || "Sem título"}
              </span>
              {typeof r.props.resumo === "string" && <span className="line-clamp-2 text-xs text-muted">{r.props.resumo}</span>}
              {cardProps.map((p) =>
                r.props[p.key] == null ? null : (
                  <span key={p.key} className="flex text-xs">
                    <PropValue page={r} prop={p} users={users} done={!!def.doneStatus && r.props.estado === def.doneStatus} />
                  </span>
                ),
              )}
            </Link>
          ))}
          <InlineNew db={db} defaults={{ ...fixed, ...(g.value != null ? { [groupProp.key]: g.value } : {}) }} />
        </div>
      ))}
    </div>
  );
}
