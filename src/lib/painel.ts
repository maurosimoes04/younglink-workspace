import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { listPages, sql } from "./db";
import { DBS, PROJECT_TAGS, type DateValue } from "./schema";

sql.exec(`
  CREATE TABLE IF NOT EXISTS panel_links (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    last_seen TEXT
  );
`);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type PanelLink = { id: string; name: string; created_at: string; last_seen: string | null; created_by_name: string | null; online: boolean };

export function listPanelLinks(): PanelLink[] {
  const recent = new Date(Date.now() - 5 * 60_000).toISOString();
  return (
    sql
      .prepare("SELECT l.id, l.name, l.created_at, l.last_seen, u.name AS created_by_name FROM panel_links l LEFT JOIN users u ON u.id = l.created_by ORDER BY l.created_at")
      .all() as Omit<PanelLink, "online">[]
  ).map((l) => ({ ...l, online: !!l.last_seen && l.last_seen > recent }));
}

export function createPanelLink(name: unknown, actorId: string) {
  const label = typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "Tablet";
  const token = randomBytes(24).toString("base64url");
  sql
    .prepare("INSERT INTO panel_links (id, token_hash, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), sha256(token), label, actorId, new Date().toISOString());
  return token;
}

export function revokePanelLink(id: string) {
  sql.prepare("DELETE FROM panel_links WHERE id = ?").run(id);
}

export function checkPanelToken(token: string | null) {
  if (!token || token.length > 100) return false;
  const row = sql.prepare("SELECT id FROM panel_links WHERE token_hash = ?").get(sha256(token)) as { id: string } | undefined;
  if (!row) return false;
  sql.prepare("UPDATE panel_links SET last_seen = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  return true;
}

export type PanelItem = {
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

const stripMd = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

export function panelItems(): PanelItem[] {
  const names = new Map((sql.prepare("SELECT id, name FROM users").all() as { id: string; name: string }[]).map((u) => [u.id, u.name]));
  const out: PanelItem[] = [];
  for (const [db, dateKey, kind] of [
    ["tarefas", "prazo", "tarefa"],
    ["projetos", "datas", "projeto"],
  ] as const) {
    const def = DBS[db];
    for (const p of listPages(db)) {
      if (p.props.painel !== true) continue;
      const d = p.props[dateKey] as DateValue | undefined;
      if (!d?.start) continue;
      const tagName = (p.props.projeto ?? p.props.etiqueta) as string | undefined;
      const tag = PROJECT_TAGS.find((t) => t.name === tagName);
      const note = (p.props.notas ?? p.props.resumo) as string | undefined;
      out.push({
        id: p.id,
        kind,
        title: p.title || "Sem título",
        start: d.start.slice(0, 10),
        end: d.end ? d.end.slice(0, 10) : null,
        done: p.props.estado === def.doneStatus,
        urgent: p.props.prioridade === "Urgente" || p.props.prioridade === "Alta",
        status: (p.props.estado as string | undefined) ?? null,
        tag: tag ? { name: tag.name, color: tag.color } : null,
        people: ((p.props.responsavel as string[] | undefined) ?? []).map((id) => (names.get(id) ?? "").split(" ")[0]).filter(Boolean),
        note: note ? stripMd(note).slice(0, 600) : null,
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
