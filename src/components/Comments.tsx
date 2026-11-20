"use client";

import { CircleCheck, CircleHelp, Eye, Heart, MessageSquare, Paperclip, PartyPopper, SmilePlus, ThumbsUp, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  editComment,
  postComment,
  removeComment,
  resolveComment,
  toggleReaction,
  useComments,
  useCurrentUser,
  useUsers,
  type Comment,
  type ReactionKind,
} from "@/lib/client";
import type { User } from "@/lib/schema";
import { formatSize } from "./Attachments";
import { Avatar, Icon, Popover } from "./ui";

const REACTIONS: { kind: ReactionKind; icon: LucideIcon; label: string }[] = [
  { kind: "gosto", icon: ThumbsUp, label: "Gosto" },
  { kind: "coracao", icon: Heart, label: "Adoro" },
  { kind: "feito", icon: CircleCheck, label: "Feito" },
  { kind: "visto", icon: Eye, label: "Visto" },
  { kind: "celebrar", icon: PartyPopper, label: "Boa!" },
  { kind: "duvida", icon: CircleHelp, label: "Dúvida" },
];

const MENTION_RE = /@\[([^\]\n]{1,80})\]\(([0-9a-f-]{36})\)/g;
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short" }).replace(".", "");
}

function linkify(text: string, keyBase: string) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={`${keyBase}-${i}`} href={part} target="_blank" rel="noreferrer" className="text-accent-fg underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>
    ),
  );
}

function Body({ text, meId }: { text: string; meId?: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    out.push(...linkify(text.slice(last, m.index), `t${last}`));
    out.push(
      <span key={`m${m.index}`} className={`rounded px-1 font-semibold ${m[2] === meId ? "bg-[#d97706]/15 text-[#b45309] dark:text-[#fbbf24]" : "bg-accent-soft text-accent-fg"}`}>
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(...linkify(text.slice(last), `t${last}`));
  return <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{out}</div>;
}

const toEditable = (body: string) => {
  const mentions: User[] = [];
  const text = body.replace(MENTION_RE, (_, name: string, id: string) => {
    mentions.push({ id, name, email: null });
    return `@${name}`;
  });
  return { text, mentions };
};

function Composer({
  users,
  initial = "",
  placeholder,
  submitLabel,
  allowFiles,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  users: User[];
  initial?: string;
  placeholder: string;
  submitLabel: string;
  allowFiles: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string, files: File[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const start = toEditable(initial);
  const [text, setText] = useState(start.text);
  const [mentions, setMentions] = useState<User[]>(start.mentions);
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [pick, setPick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [text]);

  const candidates = query === null ? [] : users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  const detect = (value: string, caret: number) => {
    const m = value.slice(0, caret).match(/(?:^|\s)@([\p{L}\p{M}' -]{0,24})$/u);
    setQuery(m ? m[1] : null);
    setPick(0);
  };

  const insert = (u: User) => {
    const el = area.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@([\p{L}\p{M}' -]{0,24})$/u, `@${u.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setMentions((m) => (m.some((x) => x.id === u.id) ? m : [...m, u]));
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const encode = () => {
    let out = text.trim();
    for (const u of [...mentions].sort((a, b) => b.name.length - a.name.length)) out = out.split(`@${u.name}`).join(`@[${u.name}](${u.id})`);
    return out;
  };

  const submit = async () => {
    if (busy || (!text.trim() && files.length === 0)) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(encode(), files);
      setText("");
      setMentions([]);
      setFiles([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative rounded-xl border border-line bg-bg focus-within:border-accent-fg">
      <textarea
        ref={area}
        value={text}
        rows={1}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (candidates.length && query !== null) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setPick((p) => (p + (e.key === "ArrowDown" ? 1 : candidates.length - 1)) % candidates.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insert(candidates[pick]);
              return;
            }
          }
          if (e.key === "Escape") {
            if (query !== null) setQuery(null);
            else onCancel?.();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className="block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-faint"
      />

      {candidates.length > 0 && query !== null && (
        <div className="shadow-pop absolute bottom-full left-2 z-30 mb-1 w-64 rounded-xl bg-popover p-1">
          <p className="px-2 py-1 text-[11px] text-faint">Mencionar</p>
          {candidates.map((u, i) => (
            <button
              key={u.id}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(u);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === pick ? "bg-hover" : ""}`}
            >
              <Avatar user={u} /> {u.name}
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-1">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="flex max-w-full items-center gap-1 rounded-lg bg-hover px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="text-faint">{formatSize(f.size)}</span>
              <button aria-label={`Remover ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="ml-0.5 text-faint hover:text-fg">
                <Icon name="close" className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-1.5 pb-1.5">
        {allowFiles && (
          <>
            <button onClick={() => fileInput.current?.click()} aria-label="Anexar ficheiros" className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = "";
                setFiles((f) => [...f, ...list]);
              }}
            />
          </>
        )}
        <span className="hidden flex-1 truncate px-1 text-[11px] text-faint sm:block">@ para mencionar · ⌘↵ para enviar</span>
        <span className="flex-1 sm:hidden" />
        {onCancel && (
          <button onClick={onCancel} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-hover">
            Cancelar
          </button>
        )}
        <button
          onClick={submit}
          disabled={busy || (!text.trim() && files.length === 0)}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "A enviar…" : submitLabel}
        </button>
      </div>
      {error && <p className="px-3 pb-2 text-xs whitespace-pre-line text-[#dc2626]">{error}</p>}
    </div>
  );
}

function ReactionPicker({ onPick }: { onPick: (k: ReactionKind) => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchor} onClick={() => setOpen(true)} aria-label="Reagir" className="rounded-lg p-1 text-muted hover:bg-hover hover:text-fg">
        <SmilePlus className="h-4 w-4" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={236}>
        <div className="grid grid-cols-6 gap-0.5">
          {REACTIONS.map((r) => (
            <button
              key={r.kind}
              title={r.label}
              aria-label={r.label}
              onClick={() => {
                onPick(r.kind);
                setOpen(false);
              }}
              className="flex h-9 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-accent-fg"
            >
              <r.icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

function CommentItem({
  c,
  pageId,
  db,
  users,
  meId,
  isAdmin,
  onReply,
  compact,
}: {
  c: Comment;
  pageId: string;
  db: string;
  users: User[];
  meId?: string;
  isAdmin?: boolean;
  allowFiles: boolean;
  onReply?: () => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const mine = c.author?.id === meId;
  const author = c.author ?? { id: "x", name: "Conta apagada" };

  return (
    <div id={`c-${c.id}`} className="group flex scroll-mt-24 gap-2.5">
      <Avatar user={author} size={compact ? 24 : 28} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{author.name}</span>
          <span className="text-xs text-faint" title={new Date(c.created_at).toLocaleString("pt-PT")}>
            {timeAgo(c.created_at)}
            {c.edited_at && " · editado"}
          </span>
        </div>

        {editing ? (
          <div className="mt-1">
            <Composer
              users={users}
              initial={c.body}
              placeholder="Editar comentário"
              submitLabel="Guardar"
              allowFiles={false}
              autoFocus
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await editComment(pageId, c.id, body);
                setEditing(false);
              }}
            />
          </div>
        ) : (
          c.body && (
            <div className="mt-0.5">
              <Body text={c.body} meId={meId} />
            </div>
          )
        )}

        {c.files.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.files.map((f) => (
              <a
                key={f.id}
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex max-w-full items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs hover:bg-hover"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-accent-fg" />
                <span className="truncate font-medium">{f.name}</span>
                <span className="shrink-0 text-faint">{formatSize(f.size)}</span>
              </a>
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {c.reactions.map((r) => {
            const def = REACTIONS.find((x) => x.kind === r.kind)!;
            return (
              <button
                key={r.kind}
                title={`${def.label}: ${r.names.join(", ")}`}
                onClick={() => toggleReaction(pageId, c.id, r.kind)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  r.mine ? "border-accent-fg/40 bg-accent-soft text-accent-fg" : "border-line text-muted hover:bg-hover"
                }`}
              >
                <def.icon className="h-3.5 w-3.5" />
                {r.count}
              </button>
            );
          })}
          <div className={`flex items-center gap-0.5 ${c.reactions.length ? "" : "-ml-1"} opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100`}>
            <ReactionPicker onPick={(k) => toggleReaction(pageId, c.id, k)} />
            {onReply && (
              <button onClick={onReply} className="rounded-lg px-1.5 py-1 text-xs font-semibold text-muted hover:bg-hover hover:text-fg">
                Responder
              </button>
            )}
            {mine && !editing && (
              <button onClick={() => setEditing(true)} className="rounded-lg px-1.5 py-1 text-xs font-semibold text-muted hover:bg-hover hover:text-fg">
                Editar
              </button>
            )}
            {(mine || isAdmin) && (
              <button
                onClick={async () => {
                  const msg = c.parent_id ? "Apagar este comentário?" : "Apagar esta conversa, incluindo as respostas?";
                  if (!confirm(`${msg}${c.files.length ? " Os ficheiros anexados vão para o lixo do Google Drive." : ""}`)) return;
                  await removeComment(pageId, db, c.id).catch((e: Error) => alert(e.message));
                }}
                className="rounded-lg px-1.5 py-1 text-xs font-semibold text-muted hover:bg-hover hover:text-[#dc2626]"
              >
                Apagar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Thread({ root, replies, ...rest }: { root: Comment; replies: Comment[]; pageId: string; db: string; users: User[]; meId?: string; isAdmin?: boolean; allowFiles: boolean }) {
  const [replying, setReplying] = useState(false);
  const resolved = !!root.resolved_at;
  return (
    <div className={`rounded-2xl border p-3 ${resolved ? "border-line bg-hover/40" : "border-line bg-card"}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-faint">{resolved ? `Resolvida por ${root.resolved_by_name ?? "alguém"}` : ""}</span>
        <button
          onClick={() => resolveComment(rest.pageId, rest.db, root.id, !resolved).catch((e: Error) => alert(e.message))}
          className={`-mt-1 -mr-1 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${resolved ? "text-muted hover:bg-hover" : "text-muted hover:bg-hover hover:text-[#16a34a]"}`}
        >
          <CircleCheck className="h-3.5 w-3.5" />
          {resolved ? "Reabrir" : "Resolver"}
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <CommentItem c={root} {...rest} onReply={() => setReplying(true)} />
        {replies.length > 0 && (
          <div className="ml-[38px] flex flex-col gap-3 border-l-2 border-line pl-3">
            {replies.map((r) => (
              <CommentItem key={r.id} c={r} {...rest} compact />
            ))}
          </div>
        )}
        {replying && (
          <div className="ml-[38px]">
            <Composer
              users={rest.users}
              placeholder="Responder…"
              submitLabel="Responder"
              allowFiles={rest.allowFiles}
              autoFocus
              onCancel={() => setReplying(false)}
              onSubmit={async (body, files) => {
                await postComment(rest.pageId, rest.db, { body, parentId: root.id, files });
                setReplying(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function Comments({ pageId, db }: { pageId: string; db: string }) {
  const { data: comments = [], isLoading } = useComments(pageId);
  const { data: users = [] } = useUsers();
  const { data: me } = useCurrentUser();
  const [showResolved, setShowResolved] = useState(false);
  const allowFiles = !!me?.driveEnabled;

  useEffect(() => {
    if (isLoading || !window.location.hash.startsWith("#c-")) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-accent-fg", "rounded-xl");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-accent-fg", "rounded-xl"), 2500);
    return () => clearTimeout(t);
  }, [isLoading]);

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const open = roots.filter((c) => !c.resolved_at);
  const resolved = roots.filter((c) => c.resolved_at);
  const common = { pageId, db, users, meId: me?.id, isAdmin: me?.isAdmin, allowFiles };

  return (
    <section className="mt-8">
      <h3 className="mb-3 flex items-center gap-2 px-1 text-[11px] font-bold tracking-widest text-faint uppercase">
        <MessageSquare className="h-3.5 w-3.5" /> Comentários {comments.length > 0 && <span className="font-semibold">{comments.length}</span>}
      </h3>

      <div className="flex flex-col gap-3">
        {open.map((c) => (
          <Thread key={c.id} root={c} replies={repliesOf(c.id)} {...common} />
        ))}

        {resolved.length > 0 && (
          <button onClick={() => setShowResolved((s) => !s)} className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-hover">
            <Icon name="chevron" className={`h-3 w-3 transition-transform ${showResolved ? "rotate-90" : ""}`} />
            {resolved.length === 1 ? "1 conversa resolvida" : `${resolved.length} conversas resolvidas`}
          </button>
        )}
        {showResolved && resolved.map((c) => <Thread key={c.id} root={c} replies={repliesOf(c.id)} {...common} />)}

        <div className="flex gap-2.5">
          {me && <Avatar user={me} size={28} />}
          <div className="min-w-0 flex-1">
            <Composer
              users={users}
              placeholder={roots.length ? "Novo comentário…" : "Escreve o primeiro comentário…"}
              submitLabel="Comentar"
              allowFiles={allowFiles}
              onSubmit={(body, files) => postComment(pageId, db, { body, files })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
