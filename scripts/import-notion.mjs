import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const seedPath = process.argv[2] ?? path.join(dataDir, "notion-seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "younglink.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT);
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY, db TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', icon TEXT, parent_id TEXT,
    props TEXT NOT NULL DEFAULT '{}', content TEXT, content_md TEXT, archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS pages_db ON pages(db, archived);
`);

const upUser = db.prepare(
  "INSERT INTO users (id, name, email) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email",
);
const upPage = db.prepare(`
  INSERT INTO pages (id, db, title, icon, parent_id, props, content, content_md, archived, created_at, updated_at)
  VALUES (@id, @db, @title, @icon, @parent_id, @props, NULL, @content_md, 0, @created_at, @now)
  ON CONFLICT(id) DO UPDATE SET db = excluded.db, title = excluded.title, icon = excluded.icon, parent_id = excluded.parent_id,
    props = excluded.props, content = NULL, content_md = excluded.content_md, archived = 0, updated_at = excluded.updated_at
`);

const EMOJI_TO_ICON = {
  "🏡": "house",
  "🏠": "house",
  "✈️": "plane",
  "🇪🇺": "globe",
  "🌳": "tree-pine",
  "🎄": "gift",
  "🎙️": "mic",
  "🏗️": "building",
  "💶": "euro",
  "💻": "laptop",
  "📜": "scroll-text",
  "🗂️": "folder-open",
  "🗳️": "vote",
  "🤝": "handshake",
  "🧓": "heart-handshake",
  "🧠": "brain",
};
const toIcon = (emoji) => (emoji ? (EMOJI_TO_ICON[emoji] ?? null) : null);

const now = new Date().toISOString();
const counts = {};
db.transaction(() => {
  for (const u of seed.users ?? []) upUser.run(u.id, u.name, u.email ?? null);
  for (const p of seed.pages ?? []) {
    upPage.run({
      id: p.id,
      db: p.db,
      title: p.title ?? "",
      icon: toIcon(p.icon),
      parent_id: p.parent_id ?? null,
      props: JSON.stringify(p.props ?? {}),
      content_md: p.content_md ?? null,
      created_at: p.created_at ?? now,
      now,
    });
    counts[p.db] = (counts[p.db] ?? 0) + 1;
  }
})();

console.log(`Importado: ${(seed.users ?? []).length} utilizadores`, counts);
