import Database from "better-sqlite3";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import path from "node:path";
import readline from "node:readline";

const USAGE = `Gestão de contas do espaço de trabalho Young-Link

  npm run users                              lista as contas
  npm run users -- add <email> <Nome>        cria uma conta e pede a palavra-passe
  npm run users -- password <email>          define uma nova palavra-passe
  npm run users -- email "<Nome>" <email>    atribui um email a uma pessoa já existente
  npm run users -- remove <email>            apaga uma conta
  npm run users -- admin <email>             dá acesso à página de Administração
  npm run users -- unadmin <email>           retira esse acesso
`;

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const db = new Database(path.join(dataDir, "younglink.db"));
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT);
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL
  );
`);
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
if (!cols.includes("is_admin")) db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");

function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

function ask(question, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : "");
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), hidden && process.stdout.write("\n"), resolve(a))));
}

async function readPassword() {
  if (process.env.YL_PASSWORD) return process.env.YL_PASSWORD;
  const a = await ask("Nova palavra-passe (mín. 8 caracteres): ", true);
  const b = await ask("Repetir: ", true);
  if (a !== b) fail("As palavras-passe não coincidem.");
  if (a.length < 8) fail("A palavra-passe tem de ter pelo menos 8 caracteres.");
  return a;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const byEmail = (email) => db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);

function setPassword(user, password) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
}

const [cmd = "list", ...args] = process.argv.slice(2);

switch (cmd) {
  case "list": {
    const rows = db.prepare("SELECT name, email, is_admin, password_hash IS NOT NULL AS ok FROM users ORDER BY name").all();
    for (const r of rows) console.log(`${r.ok ? "✓" : "·"} ${r.name.padEnd(22)} ${(r.email ?? "(sem email)").padEnd(30)} ${r.is_admin ? "admin" : ""}`);
    console.log("\n✓ = pode entrar   · = ainda sem palavra-passe");
    break;
  }
  case "add": {
    const [email, ...nameParts] = args;
    const name = nameParts.join(" ").trim();
    if (!email?.includes("@") || !name) fail(USAGE);
    if (byEmail(email)) fail(`Já existe uma conta com ${email}. Usa "password" para mudar a palavra-passe.`);
    const password = await readPassword();
    const id = randomUUID();
    db.prepare("INSERT INTO users (id, name, email) VALUES (?, ?, ?)").run(id, name, email.trim());
    setPassword({ id }, password);
    console.log(`Conta criada: ${name} <${email}>`);
    break;
  }
  case "password": {
    const user = args[0] && byEmail(args[0]);
    if (!user) fail(`Não há nenhuma conta com o email ${args[0] ?? "?"}. Vê a lista com: npm run users`);
    setPassword(user, await readPassword());
    console.log(`Palavra-passe definida para ${user.name}. Sessões antigas terminadas.`);
    break;
  }
  case "email": {
    const [name, email] = args;
    if (!name || !email?.includes("@")) fail(USAGE);
    const matches = db.prepare("SELECT * FROM users WHERE lower(name) = lower(?)").all(name);
    if (matches.length !== 1) fail(matches.length ? "Há várias pessoas com esse nome." : `Não encontrei "${name}".`);
    if (byEmail(email)) fail(`O email ${email} já está atribuído.`);
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email.trim(), matches[0].id);
    console.log(`${matches[0].name} → ${email}`);
    break;
  }
  case "remove": {
    const user = args[0] && byEmail(args[0]);
    if (!user) fail(`Não há nenhuma conta com o email ${args[0] ?? "?"}.`);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    console.log(`Conta apagada: ${user.name}`);
    break;
  }
  case "admin":
  case "unadmin": {
    const user = args[0] && byEmail(args[0]);
    if (!user) fail(`Não há nenhuma conta com o email ${args[0] ?? "?"}.`);
    const make = cmd === "admin";
    if (!make && user.is_admin && db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get().n <= 1)
      fail("Tem de existir pelo menos um administrador.");
    db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(make ? 1 : 0, user.id);
    console.log(`${user.name} ${make ? "é agora administrador" : "deixou de ser administrador"}.`);
    break;
  }
  default:
    console.log(USAGE);
}
