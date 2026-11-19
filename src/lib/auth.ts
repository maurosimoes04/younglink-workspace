import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import type { User } from "./schema";

export const SESSION_COOKIE = "yl_session";
const SESSION_DAYS = 30;

sql.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
const userCols = (sql.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
if (!userCols.includes("password_hash")) sql.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
if (!userCols.includes("is_admin")) sql.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");

export type SessionUser = User & { isAdmin: boolean };

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string | null) {
  if (!stored) {
    scryptSync(password, "timing-equaliser", 64);
    return false;
  }
  const [, saltHex, hashHex] = stored.split("$");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60 * 1000;

export function isLocked(email: string) {
  const f = failures.get(email.trim().toLowerCase());
  return !!f && f.count >= MAX_FAILURES && f.until > Date.now();
}

function noteFailure(key: string) {
  const f = failures.get(key);
  const fresh = !f || f.until < Date.now();
  failures.set(key, { count: fresh ? 1 : f.count + 1, until: Date.now() + LOCK_MS });
}

export function checkCredentials(email: string, password: string): User | null {
  const key = email.trim().toLowerCase();
  const row = sql
    .prepare("SELECT id, name, email, password_hash FROM users WHERE lower(email) = lower(?)")
    .get(email.trim()) as (User & { password_hash: string | null }) | undefined;
  if (!verifyPassword(password, row?.password_hash ?? null) || !row) {
    noteFailure(key);
    return null;
  }
  failures.delete(key);
  return { id: row.id, name: row.name, email: row.email };
}

export async function startSession(userId: string, secure: boolean) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  sql.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  sql
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), userId, expires.toISOString(), new Date().toISOString());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) sql.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = sql
    .prepare(
      `SELECT u.id, u.name, u.email, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), new Date().toISOString()) as (User & { is_admin: number }) | undefined;
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, isAdmin: row.is_admin === 1 };
}

export class Unauthorized extends Error {}
export class Forbidden extends Error {}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Unauthorized();
  return user;
}

export const unauthorized = () => Response.json({ error: "Sessão expirada. Entra outra vez." }, { status: 401 });
const forbidden = () => Response.json({ error: "Só administradores podem fazer isto." }, { status: 403 });

function guard<A extends unknown[]>(adminOnly: boolean, handler: (user: SessionUser, ...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      const user = await requireUser();
      if (adminOnly && !user.isAdmin) throw new Forbidden();
      return await handler(user, ...args);
    } catch (e) {
      if (e instanceof Unauthorized) return unauthorized();
      if (e instanceof Forbidden) return forbidden();
      throw e;
    }
  };
}

export function withAuth<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return guard<A>(false, (_user, ...args) => handler(...args));
}

export function withAdmin<A extends unknown[]>(handler: (admin: SessionUser, ...args: A) => Promise<Response>) {
  return guard<A>(true, handler);
}

export function revokeSessions(userId: string) {
  sql.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(14);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function changePassword(userId: string, current: string, next: string) {
  const row = sql.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string | null } | undefined;
  if (!verifyPassword(current, row?.password_hash ?? null)) return false;
  sql.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), userId);
  return true;
}

export function isSecureRequest(req: Request) {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}
