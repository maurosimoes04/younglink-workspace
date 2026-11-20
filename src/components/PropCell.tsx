"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { patchPage, usePages, useUsers } from "@/lib/client";
import type { DateValue, Option, PageRow, Prop, User } from "@/lib/schema";
import { Avatar, formatDate, Icon, isOverdue, MenuItem, People, Popover, Tag } from "./ui";

type Props = {
  db: string;
  page: PageRow;
  prop: Prop;
  done?: boolean;
  variant?: "cell" | "field" | "card";
};

export function PropValue({ page, prop, users, done, relTitles }: { page: PageRow; prop: Prop; users: User[]; done?: boolean; relTitles?: Map<string, PageRow> }) {
  const v = page.props[prop.key];
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  switch (prop.type) {
    case "select":
    case "status": {
      const opt = prop.options.find((o) => o.name === v) ?? { name: String(v), color: "default" as const };
      return prop.type === "status" ? <StatusTag option={opt} /> : <Tag option={opt} />;
    }
    case "person":
      return <People ids={v as string[]} users={users} />;
    case "date": {
      const d = v as DateValue;
      return <span className={!done && isOverdue(d) ? "text-[#eb5757]" : ""}>{formatDate(d)}</span>;
    }
    case "url":
      return (
        <a href={String(v)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="truncate underline decoration-line-strong underline-offset-2 hover:decoration-fg">
          {String(v).replace(/^https?:\/\//, "")}
        </a>
      );
    case "checkbox":
      return (
        <span className="inline-flex items-center gap-1 text-accent-fg">
          <Icon name="check" className="h-3.5 w-3.5" /> {prop.name}
        </span>
      );
    case "relation":
      return (
        <span className="flex flex-col gap-0.5">
          {(v as string[]).map((id) => {
            const r = relTitles?.get(id);
            return (
              <Link key={id} href={`/p/${id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 truncate underline decoration-line-strong underline-offset-2 hover:decoration-fg">
                <Icon name="page" className="text-faint" />
                <span className="truncate">{r?.title || "Sem título"}</span>
              </Link>
            );
          })}
        </span>
      );
    default:
      return <span className="line-clamp-3 whitespace-pre-wrap">{stripMd(String(v))}</span>;
  }
}

const stripMd = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

export function StatusTag({ option }: { option: Option }) {
  const c = option.color;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 text-[13px] leading-5 whitespace-nowrap"
      style={{ background: `var(--tag-${c}-bg)`, color: `var(--tag-${c}-fg)` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: `var(--tag-${c}-fg)`, opacity: 0.6 }} />
      {option.name}
    </span>
  );
}

export function PropCell({ db, page, prop, done, variant = "cell" }: Props) {
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { data: users = [] } = useUsers();
  const { data: siblings = [] } = usePages(prop.type === "relation" ? db : null);
  const readOnly = prop.type === "relation" && !!prop.inverseOf;
  const relTitles = new Map(siblings.map((s) => [s.id, s]));

  const save = (value: unknown) => patchPage(db, page.id, { props: { [prop.key]: value ?? null } });

  const empty = (
    <span className="text-faint">{variant === "field" ? "Vazio" : ""}</span>
  );
  const value = <PropValue page={page} prop={prop} users={users} done={done} relTitles={relTitles} />;
  const isEmpty = page.props[prop.key] == null || (Array.isArray(page.props[prop.key]) && (page.props[prop.key] as unknown[]).length === 0);

  const pad = variant === "cell" ? "min-h-[33px] px-2 py-1.5" : variant === "field" ? "min-h-[30px] px-1.5 py-1 rounded" : "";

  if (prop.type === "checkbox") {
    const on = page.props[prop.key] === true;
    return (
      <button
        role="checkbox"
        aria-checked={on}
        aria-label={prop.name}
        onClick={(e) => {
          e.stopPropagation();
          save(on ? null : true);
        }}
        className={`flex w-full items-center text-sm ${pad} hover:bg-hover`}
      >
        <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] ${on ? "border-accent bg-accent text-white" : "border-line-strong"}`}>
          {on && <Icon name="check" className="h-3 w-3" />}
        </span>
      </button>
    );
  }

  return (
    <>
      <div
        ref={anchor}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        onClick={(e) => {
          if (readOnly) return;
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === "Enter" && !readOnly && setOpen(true)}
        className={`flex w-full min-w-0 items-center text-sm ${pad} ${readOnly ? "" : "cursor-pointer hover:bg-hover"}`}
      >
        {isEmpty ? empty : value}
      </div>
      {open && (
        <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={prop.type === "text" ? 360 : 280}>
          <Editor prop={prop} value={page.props[prop.key]} users={users} siblings={siblings.filter((s) => s.id !== page.id)} save={save} close={() => setOpen(false)} />
        </Popover>
      )}
    </>
  );
}

function Editor({
  prop,
  value,
  users,
  siblings,
  save,
  close,
}: {
  prop: Prop;
  value: unknown;
  users: User[];
  siblings: PageRow[];
  save: (v: unknown) => void;
  close: () => void;
}) {
  const [q, setQ] = useState("");
  switch (prop.type) {
    case "select":
    case "status": {
      const opts = prop.options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
      return (
        <div>
          <SearchInput value={q} onChange={setQ} placeholder="Procurar uma opção…" />
          {opts.map((o) => (
            <MenuItem key={o.name} active={o.name === value} onClick={() => (save(o.name), close())}>
              {prop.type === "status" ? <StatusTag option={o} /> : <Tag option={o} />}
            </MenuItem>
          ))}
          {value != null && (
            <MenuItem onClick={() => (save(null), close())}>
              <span className="text-muted">Limpar</span>
            </MenuItem>
          )}
        </div>
      );
    }
    case "person": {
      const sel = (value as string[] | undefined) ?? [];
      return (
        <div>
          {users.map((u) => {
            const on = sel.includes(u.id);
            return (
              <MenuItem key={u.id} onClick={() => save(on ? sel.filter((x) => x !== u.id) : [...sel, u.id])}>
                <Avatar user={u} />
                <span className="flex-1">{u.name}</span>
                {on && <Icon name="check" className="text-accent-fg" />}
              </MenuItem>
            );
          })}
        </div>
      );
    }
    case "relation": {
      const sel = (value as string[] | undefined) ?? [];
      const list = siblings.filter((s) => s.title.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
      return (
        <div>
          <SearchInput value={q} onChange={setQ} placeholder="Procurar uma página…" />
          {list.map((s) => {
            const on = sel.includes(s.id);
            return (
              <MenuItem key={s.id} onClick={() => save(on ? sel.filter((x) => x !== s.id) : [...sel, s.id])}>
                <Icon name="page" className="text-faint" />
                <span className="flex-1 truncate">{s.title || "Sem título"}</span>
                {on && <Icon name="check" className="text-accent-fg" />}
              </MenuItem>
            );
          })}
        </div>
      );
    }
    case "date":
      return <DateEditor value={value as DateValue | undefined} save={save} close={close} />;
    default:
      return <TextEditor multiline={prop.type === "text"} value={(value as string) ?? ""} save={save} close={close} />;
  }
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mb-1 w-full rounded border border-line-strong bg-hover px-2 py-1 text-sm outline-none focus:border-accent"
    />
  );
}

function TextEditor({ value, save, close, multiline }: { value: string; save: (v: unknown) => void; close: () => void; multiline: boolean }) {
  const [v, setV] = useState(value);
  const commit = () => {
    if (v !== value) save(v.trim() === "" ? null : v);
    close();
  };
  const cls = "w-full rounded bg-transparent px-1.5 py-1 text-sm outline-none";
  return multiline ? (
    <textarea
      autoFocus
      value={v}
      rows={Math.min(12, Math.max(3, v.split("\n").length + 1))}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && commit()}
      className={`${cls} resize-none`}
    />
  ) : (
    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} className={cls} placeholder="https://…" />
  );
}

function DateEditor({ value, save, close }: { value?: DateValue; save: (v: unknown) => void; close: () => void }) {
  const toInput = (s?: string | null) => (s ? s.slice(0, 10) : "");
  const [start, setStart] = useState(toInput(value?.start));
  const [end, setEnd] = useState(toInput(value?.end));
  const [range, setRange] = useState(!!value?.end);
  const apply = () => {
    if (!start) save(null);
    else save({ start, ...(range && end && end >= start ? { end } : {}) });
    close();
  };
  const input = "w-full rounded border border-line-strong bg-hover px-2 py-1 text-sm outline-none focus:border-accent";
  return (
    <div className="flex flex-col gap-2 p-1.5">
      <input type="date" autoFocus value={start} onChange={(e) => setStart(e.target.value)} className={input} />
      {range && <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={input} />}
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={range} onChange={(e) => setRange(e.target.checked)} />
        Data de fim
      </label>
      <div className="flex gap-2">
        <button onClick={apply} className="flex-1 rounded bg-accent px-2 py-1 text-sm text-white hover:opacity-90">
          Guardar
        </button>
        <button onClick={() => (save(null), close())} className="rounded px-2 py-1 text-sm text-muted hover:bg-hover">
          Limpar
        </button>
      </div>
    </div>
  );
}
