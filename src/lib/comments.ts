import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { listCommentFiles, type StoredFile } from "./drive";

sql.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    parent_id TEXT,
    author_id TEXT,
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    edited_at TEXT,
    resolved_at TEXT,
    resolved_by TEXT
  );
  CREATE INDEX IF NOT EXISTS comments_page ON comments(page_id);
  CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (comment_id, user_id, kind)
  );
`);

export const REACTIONS = ["gosto", "coracao", "feito", "visto", "celebrar", "duvida"] as const;
export type ReactionKind = (typeof REACTIONS)[number];
const MAX_BODY = 5000;
const MENTION_RE = /@\[([^\]\n]{1,80})\]\(([0-9a-f-]{36})\)/g;

export class CommentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type CommentOut = {
  id: string;
  parent_id: string | null;
  author: { id: string; name: string } | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  reactions: { kind: ReactionKind; count: number; mine: boolean; names: string[] }[];
  files: StoredFile[];
};

type Row = {
  id: string;
  page_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
};

export function listComments(pageId: string, viewerId: string): CommentOut[] {
  const rows = sql
    .prepare(
      `SELECT c.*, a.name AS author_name, r.name AS resolved_by_name FROM comments c
       LEFT JOIN users a ON a.id = c.author_id LEFT JOIN users r ON r.id = c.resolved_by
       WHERE c.page_id = ? ORDER BY c.created_at`,
    )
    .all(pageId) as Row[];
  const reactions = sql
    .prepare(
      `SELECT cr.comment_id, cr.kind, cr.user_id, u.name FROM comment_reactions cr
       JOIN comments c ON c.id = cr.comment_id LEFT JOIN users u ON u.id = cr.user_id
       WHERE c.page_id = ? ORDER BY cr.created_at`,
    )
    .all(pageId) as { comment_id: string; kind: ReactionKind; user_id: string; name: string | null }[];
  const files = listCommentFiles(pageId);

  return rows.map((r) => {
    const mine = reactions.filter((x) => x.comment_id === r.id);
    return {
      id: r.id,
      parent_id: r.parent_id,
      author: r.author_id ? { id: r.author_id, name: r.author_name ?? "Conta apagada" } : null,
      body: r.body,
      created_at: r.created_at,
      edited_at: r.edited_at,
      resolved_at: r.resolved_at,
      resolved_by_name: r.resolved_by_name,
      reactions: REACTIONS.map((kind) => {
        const of = mine.filter((x) => x.kind === kind);
        return { kind, count: of.length, mine: of.some((x) => x.user_id === viewerId), names: of.map((x) => x.name ?? "?") };
      }).filter((x) => x.count > 0),
      files: files.filter((f) => f.comment_id === r.id),
    };
  });
}

function getRow(id: string) {
  const r = sql.prepare("SELECT * FROM comments WHERE id = ?").get(id) as Omit<Row, "author_name" | "resolved_by_name"> | undefined;
  if (!r) throw new CommentError("Este comentário já não existe.", 404);
  return r;
}

function cleanBody(body: unknown, allowEmpty: boolean) {
  const text = typeof body === "string" ? body.replace(/\r\n/g, "\n").trim() : "";
  if (!text && !allowEmpty) throw new CommentError("Escreve um comentário.");
  if (text.length > MAX_BODY) throw new CommentError("O comentário é demasiado longo.");
  return text;
}

export function mentionedIds(body: string) {
  return [...new Set([...body.matchAll(MENTION_RE)].map((m) => m[2]))];
}

export function createComment(p: { pageId: string; parentId?: unknown; authorId: string; body: unknown; withFiles?: boolean }) {
  const body = cleanBody(p.body, !!p.withFiles);
  let parent: string | null = null;
  if (typeof p.parentId === "string" && p.parentId) {
    const pr = getRow(p.parentId);
    if (pr.page_id !== p.pageId) throw new CommentError("Pedido inválido.");
    parent = pr.parent_id ?? pr.id;
  }
  const id = randomUUID();
  sql
    .prepare("INSERT INTO comments (id, page_id, parent_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, p.pageId, parent, p.authorId, body, new Date().toISOString());
  if (parent) sql.prepare("UPDATE comments SET resolved_at = NULL, resolved_by = NULL WHERE id = ?").run(parent);
  return { id, body, parent };
}

export function updateComment(id: string, actorId: string, patch: { body?: unknown; resolved?: unknown }) {
  const r = getRow(id);
  if (patch.body !== undefined) {
    if (r.author_id !== actorId) throw new CommentError("Só quem escreveu pode editar o comentário.", 403);
    const hasFiles = !!sql.prepare("SELECT 1 FROM files WHERE comment_id = ?").get(id);
    sql.prepare("UPDATE comments SET body = ?, edited_at = ? WHERE id = ?").run(cleanBody(patch.body, hasFiles), new Date().toISOString(), id);
  }
  if (patch.resolved !== undefined) {
    if (r.parent_id) throw new CommentError("Só se resolve a conversa inteira.");
    if (patch.resolved === true) sql.prepare("UPDATE comments SET resolved_at = ?, resolved_by = ? WHERE id = ?").run(new Date().toISOString(), actorId, id);
    else sql.prepare("UPDATE comments SET resolved_at = NULL, resolved_by = NULL WHERE id = ?").run(id);
  }
  return r.page_id;
}

export function deleteComment(id: string, actor: { id: string; isAdmin: boolean }) {
  const r = getRow(id);
  if (r.author_id !== actor.id && !actor.isAdmin) throw new CommentError("Só quem escreveu (ou um administrador) pode apagar.", 403);
  const ids = [id, ...(sql.prepare("SELECT id FROM comments WHERE parent_id = ?").all(id) as { id: string }[]).map((x) => x.id)];
  const marks = ids.map(() => "?").join(",");
  const fileIds = (sql.prepare(`SELECT id FROM files WHERE comment_id IN (${marks})`).all(...ids) as { id: string }[]).map((x) => x.id);
  sql.transaction(() => {
    sql.prepare(`DELETE FROM comment_reactions WHERE comment_id IN (${marks})`).run(...ids);
    sql.prepare(`DELETE FROM comments WHERE id IN (${marks})`).run(...ids);
  })();
  return { pageId: r.page_id, fileIds };
}

export function toggleReaction(id: string, userId: string, kind: unknown) {
  if (!REACTIONS.includes(kind as ReactionKind)) throw new CommentError("Reação inválida.");
  const r = getRow(id);
  const del = sql.prepare("DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND kind = ?").run(id, userId, kind);
  if (del.changes === 0)
    sql.prepare("INSERT INTO comment_reactions (comment_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)").run(id, userId, kind, new Date().toISOString());
  return r.page_id;
}

export function commentAuthor(id: string) {
  return getRow(id);
}

export function commentCounts(dbId: string): Map<string, number> {
  const rows = sql
    .prepare(
      `SELECT c.page_id, COUNT(*) AS n FROM comments c JOIN pages p ON p.id = c.page_id
       WHERE p.db = ? AND (c.parent_id IS NULL AND c.resolved_at IS NULL OR c.parent_id IN (SELECT id FROM comments WHERE resolved_at IS NULL))
       GROUP BY c.page_id`,
    )
    .all(dbId) as { page_id: string; n: number }[];
  return new Map(rows.map((r) => [r.page_id, r.n]));
}
