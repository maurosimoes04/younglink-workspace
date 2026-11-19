import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, revokeSessions, type SessionUser } from "./auth";
import { sql } from "./db";
import { inviteEmail, resetEmail, sendMail } from "./mail";

export const INVITE_DAYS = 7;
export const RESET_MINUTES = 60;
const RESETS_PER_HOUR = 3;

export type TokenKind = "invite" | "reset";

sql.exec(`
  CREATE TABLE IF NOT EXISTS invites (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);
sql.exec("CREATE TABLE IF NOT EXISTS reset_requests (user_id TEXT NOT NULL, created_at TEXT NOT NULL)");
if (!(sql.prepare("PRAGMA table_info(invites)").all() as { name: string }[]).some((c) => c.name === "kind"))
  sql.exec("ALTER TABLE invites ADD COLUMN kind TEXT NOT NULL DEFAULT 'invite'");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  hasPassword: boolean;
  lastSeen: string | null;
  activeSessions: number;
  assigned: number;
  inviteSentAt: string | null;
};

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function listAdminUsers(): AdminUser[] {
  const now = new Date().toISOString();
  const rows = sql
    .prepare(
      `SELECT u.id, u.name, u.email, u.is_admin, u.password_hash IS NOT NULL AS has_pw,
        (SELECT MAX(created_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS active,
        (SELECT MAX(created_at) FROM invites i WHERE i.user_id = u.id AND i.kind = 'invite' AND i.expires_at > ?) AS invite_at
       FROM users u ORDER BY u.name COLLATE NOCASE`,
    )
    .all(now, now) as {
    id: string;
    name: string;
    email: string | null;
    is_admin: number;
    has_pw: number;
    last_seen: string | null;
    active: number;
    invite_at: string | null;
  }[];

  const assigned = new Map<string, number>();
  const props = sql.prepare("SELECT props FROM pages WHERE archived = 0 AND props LIKE '%responsavel%'").all() as { props: string }[];
  for (const { props: p } of props) for (const id of (JSON.parse(p).responsavel as string[] | undefined) ?? []) assigned.set(id, (assigned.get(id) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    isAdmin: r.is_admin === 1,
    hasPassword: r.has_pw === 1,
    lastSeen: r.last_seen,
    activeSessions: r.active,
    assigned: assigned.get(r.id) ?? 0,
    inviteSentAt: r.has_pw ? null : r.invite_at,
  }));
}

function cleanName(name: unknown) {
  if (typeof name !== "string" || !name.trim()) throw new AdminError("O nome é obrigatório.");
  return name.trim().slice(0, 80);
}

function cleanEmail(email: unknown, exceptId?: string) {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) throw new AdminError("Escreve um email válido.");
  const e = email.trim().toLowerCase();
  const taken = sql.prepare("SELECT id FROM users WHERE lower(email) = ?").get(e) as { id: string } | undefined;
  if (taken && taken.id !== exceptId) throw new AdminError("Esse email já pertence a outra conta.", 409);
  return e;
}

function checkPassword(pw: unknown) {
  if (typeof pw !== "string" || pw.length < 8) throw new AdminError("A palavra-passe tem de ter pelo menos 8 caracteres.");
  return pw;
}

const adminCount = () => (sql.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;

function getRaw(id: string) {
  const u = sql.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(id) as { id: string; is_admin: number } | undefined;
  if (!u) throw new AdminError("Esta conta já não existe.", 404);
  return u;
}

export function createUser(input: { name?: unknown; email?: unknown; password?: unknown; isAdmin?: unknown }) {
  const name = cleanName(input.name);
  const email = cleanEmail(input.email);
  const hash = input.password === null ? null : hashPassword(checkPassword(input.password));
  const id = randomUUID();
  sql.prepare("INSERT INTO users (id, name, email, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)").run(id, name, email, hash, input.isAdmin === true ? 1 : 0);
  return id;
}

export async function sendInvite(actor: SessionUser, userId: string, baseUrl: string) {
  const user = sql.prepare("SELECT id, name, email FROM users WHERE id = ?").get(userId) as { id: string; name: string; email: string | null } | undefined;
  if (!user) throw new AdminError("Esta conta já não existe.", 404);
  if (!user.email) throw new AdminError("Atribui primeiro um email a esta pessoa.");

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  sql.transaction(() => {
    sql.prepare("DELETE FROM invites WHERE user_id = ?").run(user.id);
    sql
      .prepare("INSERT INTO invites (token_hash, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(sha256(token), user.id, actor.id, now.toISOString(), expires.toISOString());
  })();

  const link = `${baseUrl.replace(/\/$/, "")}/convite/${token}`;
  const mail = inviteEmail({ name: user.name, email: user.email, inviter: actor.name, link, days: INVITE_DAYS });
  const sent = await sendMail(user.email, mail.subject, mail.html, mail.text);
  return { sent, link: sent ? null : link };
}

function findToken(token: string, kind: TokenKind) {
  return sql
    .prepare(
      `SELECT u.id, u.name, u.email FROM invites i JOIN users u ON u.id = i.user_id
       WHERE i.token_hash = ? AND i.kind = ? AND i.expires_at > ?`,
    )
    .get(sha256(token), kind, new Date().toISOString()) as { id: string; name: string; email: string } | undefined;
}

export function getInvite(token: string, kind: TokenKind = "invite") {
  const inv = findToken(token, kind);
  return inv ? { name: inv.name, email: inv.email } : null;
}

export function acceptInvite(token: string, password: unknown, kind: TokenKind = "invite") {
  const pw = checkPassword(password);
  const inv = findToken(token, kind);
  if (!inv)
    throw new AdminError(
      kind === "reset" ? "Este link já foi usado ou expirou. Pede um novo na página de login." : "Este convite já foi usado ou expirou. Pede um novo a um administrador.",
      410,
    );
  sql.transaction(() => {
    sql.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(pw), inv.id);
    sql.prepare("DELETE FROM invites WHERE user_id = ?").run(inv.id);
    revokeSessions(inv.id);
  })();
  return inv.id;
}

export async function requestPasswordReset(email: string, baseUrl: string) {
  const user = sql.prepare("SELECT id, name, email FROM users WHERE lower(email) = lower(?)").get(email.trim()) as
    | { id: string; name: string; email: string }
    | undefined;
  if (!user) return;

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const recent = (sql.prepare("SELECT COUNT(*) AS n FROM reset_requests WHERE user_id = ? AND created_at > ?").get(user.id, hourAgo) as { n: number }).n;
  if (recent >= RESETS_PER_HOUR) return;

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + RESET_MINUTES * 60 * 1000);
  sql.transaction(() => {
    sql.prepare("DELETE FROM invites WHERE user_id = ? AND kind = 'reset'").run(user.id);
    sql
      .prepare("INSERT INTO invites (token_hash, user_id, created_by, created_at, expires_at, kind) VALUES (?, ?, NULL, ?, ?, 'reset')")
      .run(sha256(token), user.id, now.toISOString(), expires.toISOString());
    sql.prepare("INSERT INTO reset_requests (user_id, created_at) VALUES (?, ?)").run(user.id, now.toISOString());
    sql.prepare("DELETE FROM reset_requests WHERE created_at < ?").run(hourAgo);
  })();

  const link = `${baseUrl.replace(/\/$/, "")}/recuperar/${token}`;
  const mail = resetEmail({ name: user.name, email: user.email, link, minutes: RESET_MINUTES });
  const sent = await sendMail(user.email, mail.subject, mail.html, mail.text);
  if (!sent && process.env.NODE_ENV !== "production") console.log(`[dev] Link de recuperação para ${user.email}: ${link}`);
}

export function updateUser(
  actorId: string,
  id: string,
  input: { name?: unknown; email?: unknown; password?: unknown; isAdmin?: unknown; revokeSessions?: unknown },
) {
  const user = getRaw(id);
  const tx = sql.transaction(() => {
    if (input.name !== undefined) sql.prepare("UPDATE users SET name = ? WHERE id = ?").run(cleanName(input.name), id);
    if (input.email !== undefined) {
      const email = cleanEmail(input.email, id);
      const prev = sql.prepare("SELECT email FROM users WHERE id = ?").get(id) as { email: string | null };
      sql.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, id);
      if (prev.email?.toLowerCase() !== email) sql.prepare("DELETE FROM invites WHERE user_id = ?").run(id);
    }
    if (input.isAdmin !== undefined) {
      const makeAdmin = input.isAdmin === true;
      if (!makeAdmin && user.is_admin === 1) {
        if (id === actorId) throw new AdminError("Não podes tirar o teu próprio acesso de administrador.");
        if (adminCount() <= 1) throw new AdminError("Tem de existir pelo menos um administrador.");
      }
      sql.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(makeAdmin ? 1 : 0, id);
    }
    if (input.password !== undefined) {
      sql.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(checkPassword(input.password)), id);
      sql.prepare("DELETE FROM invites WHERE user_id = ?").run(id);
      if (id !== actorId) revokeSessions(id);
    }
    if (input.revokeSessions === true) {
      if (id === actorId) throw new AdminError("Para terminares a tua própria sessão usa “Terminar sessão”.");
      revokeSessions(id);
    }
  });
  tx();
}

export function deleteUser(actorId: string, id: string) {
  const user = getRaw(id);
  if (id === actorId) throw new AdminError("Não podes apagar a tua própria conta.");
  if (user.is_admin === 1 && adminCount() <= 1) throw new AdminError("Tem de existir pelo menos um administrador.");
  sql.prepare("DELETE FROM users WHERE id = ?").run(id);
}
