import "server-only";
import { auth, drive, type drive_v3 } from "@googleapis/drive";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { sql } from "./db";

sql.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    drive_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS files_page ON files(page_id);
  CREATE TABLE IF NOT EXISTS drive_folders (name TEXT PRIMARY KEY, drive_id TEXT NOT NULL);
`);

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type StoredFile = {
  id: string;
  page_id: string;
  name: string;
  mime: string;
  size: number;
  uploaded_by: string | null;
  uploader_name: string | null;
  created_at: string;
};

const rootFolder = () => process.env.GDRIVE_WORKSPACE_FOLDER_ID?.trim() || "";

export const isDriveConfigured = () =>
  Boolean(rootFolder() && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON));

let client: drive_v3.Drive | null = null;
function getDrive() {
  if (client) return client;
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  const creds = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8")) as { client_email: string; private_key: string };
  const jwt = new auth.JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  client = drive({ version: "v3", auth: jwt });
  return client;
}

async function folderFor(name: string) {
  const known = sql.prepare("SELECT drive_id FROM drive_folders WHERE name = ?").get(name) as { drive_id: string } | undefined;
  if (known) return known.drive_id;
  const res = await getDrive().files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [rootFolder()] },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = res.data.id!;
  sql.prepare("INSERT OR REPLACE INTO drive_folders (name, drive_id) VALUES (?, ?)").run(name, id);
  return id;
}

export async function uploadFile(p: { pageId: string; folder: string; name: string; mime: string; buffer: Buffer; userId: string }) {
  const parent = await folderFor(p.folder);
  const res = await getDrive().files.create({
    requestBody: { name: p.name, parents: [parent] },
    media: { mimeType: p.mime, body: Readable.from(p.buffer) },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = randomUUID();
  sql
    .prepare("INSERT INTO files (id, page_id, drive_id, name, mime, size, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, p.pageId, res.data.id!, p.name, p.mime, p.buffer.length, p.userId, new Date().toISOString());
  return getFile(id)!;
}

const FILE_COLS = "f.id, f.page_id, f.name, f.mime, f.size, f.uploaded_by, u.name AS uploader_name, f.created_at";

export function listFiles(pageId: string): StoredFile[] {
  return sql.prepare(`SELECT ${FILE_COLS} FROM files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.page_id = ? ORDER BY f.created_at`).all(pageId) as StoredFile[];
}

export function getFile(id: string) {
  return sql.prepare(`SELECT ${FILE_COLS}, f.drive_id FROM files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.id = ?`).get(id) as
    | (StoredFile & { drive_id: string })
    | undefined;
}

export async function streamFile(driveId: string) {
  const res = await getDrive().files.get({ fileId: driveId, alt: "media", supportsAllDrives: true }, { responseType: "stream" });
  return res.data as unknown as Readable;
}

export async function deleteFile(id: string) {
  const f = getFile(id);
  if (!f) return;
  await getDrive().files.update({ fileId: f.drive_id, requestBody: { trashed: true }, supportsAllDrives: true, fields: "id" });
  sql.prepare("DELETE FROM files WHERE id = ?").run(id);
}
