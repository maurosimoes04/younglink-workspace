import "server-only";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DBS, isDbId, type PageFull, type PageRow, type User } from "./schema";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as { ylDb?: Database.Database };

function open() {
  const db = new Database(path.join(dataDir, "younglink.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT
    );
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      db TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      icon TEXT,
      parent_id TEXT,
      props TEXT NOT NULL DEFAULT '{}',
      content TEXT,
      content_md TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pages_db ON pages(db, archived);
  `);
  return db;
}

export const sql = globalForDb.ylDb ?? (globalForDb.ylDb = open());

type Raw = Omit<PageFull, "props" | "content"> & { props: string; content: string | null };

function toRow(r: Raw): PageRow {
  return {
    id: r.id,
    db: r.db,
    title: r.title,
    icon: r.icon,
    parent_id: r.parent_id,
    props: JSON.parse(r.props),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function withInverses(dbId: string, rows: PageRow[], scope: PageRow[] = rows) {
  if (!isDbId(dbId)) return rows;
  const inverses = DBS[dbId].props.filter((p) => p.type === "relation" && p.inverseOf);
  for (const inv of inverses) {
    if (inv.type !== "relation" || !inv.inverseOf) continue;
    const source = inv.inverseOf;
    for (const row of rows) {
      row.props[inv.key] = scope
        .filter((o) => ((o.props[source] as string[] | undefined) ?? []).includes(row.id))
        .map((o) => o.id);
    }
  }
  return rows;
}

const ROW_COLS = "id, db, title, icon, parent_id, props, created_at, updated_at";

export function listPages(dbId: string): PageRow[] {
  const raws = sql
    .prepare(`SELECT ${ROW_COLS} FROM pages WHERE db = ? AND archived = 0 ORDER BY created_at`)
    .all(dbId) as Raw[];
  return withInverses(dbId, raws.map(toRow));
}

export function getPage(id: string): PageFull | null {
  const r = sql.prepare("SELECT * FROM pages WHERE id = ? AND archived = 0").get(id) as Raw | undefined;
  if (!r) return null;
  const row = toRow(r);
  withInverses(r.db, [row], listPages(r.db));
  return { ...row, content: r.content ? JSON.parse(r.content) : null, content_md: r.content_md };
}

export function getTitles(ids: string[]): Pick<PageRow, "id" | "title" | "icon" | "db">[] {
  if (ids.length === 0) return [];
  return sql
    .prepare(`SELECT id, title, icon, db FROM pages WHERE archived = 0 AND id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Pick<PageRow, "id" | "title" | "icon" | "db">[];
}

export type PagePatch = {
  title?: string;
  icon?: string | null;
  parent_id?: string | null;
  props?: Record<string, unknown>;
  content?: unknown[] | null;
  content_md?: string | null;
};

export function createPage(dbId: string, patch: PagePatch & { id?: string; created_at?: string }) {
  const id = patch.id ?? randomUUID();
  const now = new Date().toISOString();
  const props = Object.fromEntries(Object.entries(patch.props ?? {}).filter(([, v]) => v != null));
  if (isDbId(dbId))
    for (const p of DBS[dbId].props) if (p.type === "status" && props[p.key] == null) props[p.key] = p.options[0].name;
  sql
    .prepare(
      `INSERT INTO pages (id, db, title, icon, parent_id, props, content, content_md, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      dbId,
      patch.title ?? "",
      patch.icon ?? null,
      patch.parent_id ?? null,
      JSON.stringify(props),
      patch.content ? JSON.stringify(patch.content) : null,
      patch.content_md ?? null,
      patch.created_at ?? now,
      now,
    );
  return getPage(id)!;
}

export function updatePage(id: string, patch: PagePatch) {
  const tx = sql.transaction(() => {
    const cur = sql.prepare("SELECT props FROM pages WHERE id = ?").get(id) as { props: string } | undefined;
    if (!cur) return null;
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [new Date().toISOString()];
    if (patch.title !== undefined) {
      sets.push("title = ?");
      vals.push(patch.title);
    }
    if (patch.icon !== undefined) {
      sets.push("icon = ?");
      vals.push(patch.icon);
    }
    if (patch.parent_id !== undefined) {
      sets.push("parent_id = ?");
      vals.push(patch.parent_id);
    }
    if (patch.content !== undefined) {
      sets.push("content = ?", "content_md = NULL");
      vals.push(patch.content ? JSON.stringify(patch.content) : null);
    }
    if (patch.content_md !== undefined) {
      sets.push("content_md = ?");
      vals.push(patch.content_md);
    }
    if (patch.props) {
      const merged: Record<string, unknown> = { ...JSON.parse(cur.props), ...patch.props };
      for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];
      sets.push("props = ?");
      vals.push(JSON.stringify(merged));
    }
    sql.prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    return true;
  });
  if (!tx()) return null;
  const page = getPage(id)!;
  const rule = isDbId(page.db) ? DBS[page.db].autoUnblock : undefined;
  const touched = rule && patch.props && ("estado" in patch.props || rule.blockedBy in patch.props);
  return { ...page, unblocked: touched ? autoUnblock(page.db, id) : [] };
}

export type Unblocked = { id: string; title: string };

function autoUnblock(dbId: string, changedId: string): Unblocked[] {
  if (!isDbId(dbId)) return [];
  const def = DBS[dbId];
  const rule = def.autoUnblock;
  if (!rule || !def.doneStatus) return [];
  const rows = (sql.prepare("SELECT id, title, props FROM pages WHERE db = ? AND archived = 0").all(dbId) as { id: string; title: string; props: string }[]).map(
    (r) => ({ ...r, props: JSON.parse(r.props) as Record<string, unknown> }),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date().toISOString();
  const update = sql.prepare("UPDATE pages SET props = ?, updated_at = ? WHERE id = ?");
  const out: Unblocked[] = [];

  sql.transaction(() => {
    for (const r of rows) {
      if (r.props.estado !== rule.blocked) continue;
      const blockers = (r.props[rule.blockedBy] as string[] | undefined) ?? [];
      if (blockers.length === 0) continue;
      if (r.id !== changedId && !blockers.includes(changedId)) continue;
      const allDone = blockers.every((b) => {
        const x = byId.get(b);
        return !x || x.props.estado === def.doneStatus;
      });
      if (!allDone) continue;
      update.run(JSON.stringify({ ...r.props, estado: rule.reopenTo }), now, r.id);
      out.push({ id: r.id, title: r.title });
    }
  })();
  return out;
}

export function archivePage(id: string): Unblocked[] {
  const now = new Date().toISOString();
  const row = sql.prepare("SELECT db FROM pages WHERE id = ?").get(id) as { db: string } | undefined;
  sql.prepare("UPDATE pages SET archived = 1, updated_at = ? WHERE id = ? OR parent_id = ?").run(now, id, id);
  return row ? autoUnblock(row.db, id) : [];
}

export function searchPages(q: string, limit = 20): PageRow[] {
  const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
  const raws = sql
    .prepare(
      `SELECT ${ROW_COLS} FROM pages
       WHERE archived = 0 AND (title LIKE ? ESCAPE '\\' OR props LIKE ? ESCAPE '\\' OR content_md LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
       ORDER BY (title LIKE ? ESCAPE '\\') DESC, updated_at DESC LIMIT ?`,
    )
    .all(like, like, like, like, like, limit) as Raw[];
  return raws.map(toRow);
}

export function listUsers(): User[] {
  return sql.prepare("SELECT id, name, email FROM users ORDER BY name").all() as User[];
}

export function upsertUser(u: User) {
  sql
    .prepare("INSERT INTO users (id, name, email) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email")
    .run(u.id, u.name, u.email);
}
