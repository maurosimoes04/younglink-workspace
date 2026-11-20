"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { deletePage, patchPage, usePage, usePages, type PageWithRefs } from "@/lib/client";
import { DBS, isDbId, type Prop } from "@/lib/schema";
import { Attachments } from "./Attachments";
import { Comments } from "./Comments";
import { DatabaseView } from "./DatabaseView";
import { PropCell } from "./PropCell";
import { Icon, MenuItem, Popover } from "./ui";
import { hasPageIcon, PAGE_ICONS, PageIcon } from "./icons";

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div className="h-24" />,
});

export function PageView() {
  const { id } = useParams<{ id: string }>();
  const { data: page, error, isLoading } = usePage(id);

  if (isLoading) return <div className="px-6 py-16 text-sm text-faint">A carregar…</div>;
  if (error || !page)
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-lg font-bold">Esta página não existe ou foi apagada.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent-fg underline">
          Voltar ao início
        </Link>
      </div>
    );
  return <PageBody key={page.id} page={page} />;
}

const PROP_ICON: Record<Prop["type"], "status" | "select" | "person" | "date" | "text" | "url" | "relation" | "check"> = {
  status: "status",
  select: "select",
  person: "person",
  date: "date",
  text: "text",
  url: "url",
  relation: "relation",
  checkbox: "check",
};

function PageBody({ page }: { page: PageWithRefs }) {
  const router = useRouter();
  const db = page.db;
  const def = isDbId(db) ? DBS[db] : null;
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const { data: parents = [] } = usePages(db === "page" ? "page" : null);
  const parent = page.parent_id ? parents.find((p) => p.id === page.parent_id) : null;

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [title]);

  useEffect(() => {
    if (!page.title) titleRef.current?.focus();
  }, [page.title]);

  useEffect(() => {
    if (title === page.title) return;
    const t = setTimeout(() => patchPage(db, page.id, { title }), 400);
    return () => clearTimeout(t);
  }, [title, page.title, page.id, db]);

  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<unknown[] | null>(null);
  const flush = useCallback(() => {
    if (contentTimer.current) clearTimeout(contentTimer.current);
    if (pending.current) {
      patchPage(db, page.id, { content: pending.current });
      pending.current = null;
    }
  }, [db, page.id]);
  const onContent = useCallback(
    (blocks: unknown[]) => {
      pending.current = blocks;
      if (contentTimer.current) clearTimeout(contentTimer.current);
      contentTimer.current = setTimeout(flush, 700);
    },
    [flush],
  );
  useEffect(() => flush, [flush]);

  const etiqueta = db === "projetos" ? (page.props.etiqueta as string | undefined) : undefined;
  const done = !!def?.doneStatus && page.props.estado === def.doneStatus;

  return (
    <div>
      <div className="sticky top-0 z-20 hidden items-center justify-between gap-2 bg-bg/80 px-4 py-2 backdrop-blur lg:flex">
        <nav className="flex min-w-0 items-center gap-1 text-sm text-muted">
          {def ? (
            <Link href={`/${def.id}`} className="rounded px-1.5 py-0.5 hover:bg-hover">
              <span className="inline-flex items-center gap-1.5"><PageIcon name={def.icon} className="h-3.5 w-3.5" /> {def.name}</span>
            </Link>
          ) : parent ? (
            <Link href={`/p/${parent.id}`} className="truncate rounded px-1.5 py-0.5 hover:bg-hover">
              <span className="inline-flex items-center gap-1.5"><PageIcon name={parent.icon} className="h-3.5 w-3.5" /> {parent.title || "Sem título"}</span>
            </Link>
          ) : (
            <span className="px-1.5">Páginas</span>
          )}
          <span className="text-faint">/</span>
          <span className="truncate px-1.5 text-fg">{title || "Sem título"}</span>
        </nav>
        <PageMenu onDelete={async () => (await deletePage(db, page.id), router.push(def ? `/${def.id}` : "/"))} />
      </div>

      <article className="mx-auto max-w-[860px] px-5 pt-6 pb-24 sm:px-12 lg:pt-16">
        <div className="flex items-start justify-between gap-2">
          <IconPicker value={page.icon} onChange={(icon) => patchPage(db, page.id, { icon })} />
          <div className="lg:hidden">
            <PageMenu onDelete={async () => (await deletePage(db, page.id), router.push(def ? `/${def.id}` : "/"))} />
          </div>
        </div>
        {def && <div className="mt-1 text-[10px] font-bold tracking-widest text-accent-fg uppercase">{def.singular}</div>}
        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Sem título"
          aria-label="Título"
          className={`mt-1 w-full resize-none overflow-hidden bg-transparent text-[28px] leading-tight font-black tracking-tight outline-none placeholder:text-faint sm:text-[38px] ${done ? "text-muted line-through decoration-2" : ""}`}
        />

        {def && (
          <div className="mt-4 flex flex-col gap-0.5 border-b border-line pb-4">
            {def.props.map((p) => (
              <div key={p.key} className="flex min-h-[34px] items-start gap-2">
                <div className="flex w-[118px] shrink-0 items-center gap-2 py-1.5 text-sm text-muted sm:w-[160px]">
                  <Icon name={PROP_ICON[p.type]} className="h-3.5 w-3.5 text-faint" />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <PropCell db={db} page={page} prop={p} done={done} variant="field" />
                </div>
              </div>
            ))}
          </div>
        )}

        <Attachments pageId={page.id} files={page.files ?? []} enabled={page.driveEnabled} />
        <Comments pageId={page.id} db={db} />

        {etiqueta && (
          <div className="mt-6 flex flex-col gap-8 border-b border-line pb-8">
            <DatabaseView db="tarefas" embedded fixed={{ projeto: etiqueta }} title="Tarefas deste projeto" />
            <DatabaseView db="documentos" embedded fixed={{ projeto: etiqueta }} title="Documentos deste projeto" />
          </div>
        )}

        <div className="mt-6">
          <Editor initialContent={page.content} initialMarkdown={page.content_md} onChange={onContent} />
        </div>
      </article>
    </div>
  );
}

function PageMenu({ onDelete }: { onDelete: () => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchor} onClick={() => setOpen(true)} aria-label="Mais opções" className="press rounded-lg p-1.5 text-muted hover:bg-hover">
        <Icon name="dots" className="h-5 w-5" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={200}>
        <MenuItem
          danger
          onClick={() => {
            setOpen(false);
            if (confirm("Apagar esta página?")) onDelete();
          }}
        >
          <Icon name="trash" /> Apagar
        </MenuItem>
      </Popover>
    </>
  );
}

function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={anchor}
        onClick={() => setOpen(true)}
        aria-label={hasPageIcon(value) ? "Mudar ícone" : "Adicionar ícone"}
        className={
          hasPageIcon(value)
            ? "press flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-fg hover:opacity-80 sm:h-16 sm:w-16"
            : "press flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-faint hover:bg-hover"
        }
      >
        {hasPageIcon(value) ? (
          <PageIcon name={value} className="h-7 w-7 sm:h-8 sm:w-8" />
        ) : (
          <>
            <Icon name="smile" /> Adicionar ícone
          </>
        )}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={296}>
        <div className="grid grid-cols-8 gap-0.5">
          {Object.keys(PAGE_ICONS).map((name) => (
            <button
              key={name}
              title={name}
              aria-label={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-hover ${name === value ? "bg-accent-soft text-accent-fg" : "text-muted"}`}
            >
              <PageIcon name={name} className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
        {hasPageIcon(value) && (
          <MenuItem onClick={() => (onChange(null), setOpen(false))}>
            <span className="text-muted">Remover ícone</span>
          </MenuItem>
        )}
      </Popover>
    </>
  );
}
