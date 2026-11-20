"use client";

import { useState, type ReactNode } from "react";
import useSWR, { mutate } from "swr";
import { fetcher, useCurrentUser } from "@/lib/client";
import { Avatar, Icon } from "./ui";

type AdminUser = {
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

type InviteResult = { sent: boolean; link: string | null };

const KEY = "/api/admin/users";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Algo correu mal.");
  await Promise.all([mutate(KEY), mutate("/api/users"), mutate("/api/me")]);
  return data as ({ generatedPassword?: string | null; invite?: InviteResult | null } & Partial<InviteResult>) | null;
}

function timeAgo(iso: string | null) {
  if (!iso) return "Nunca entrou";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 30) return `Há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
}

function Badge({ tone, children }: { tone: "brand" | "ok" | "warn"; children: ReactNode }) {
  const cls =
    tone === "brand"
      ? "bg-accent-soft text-accent-fg"
      : tone === "ok"
        ? "bg-[#16a34a]/12 text-[#15803d] dark:text-[#4ade80]"
        : "bg-[#d97706]/14 text-[#b45309] dark:text-[#fbbf24]";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

function StatusBadges({ u }: { u: AdminUser }) {
  return (
    <span className="flex flex-wrap gap-1">
      {u.isAdmin && <Badge tone="brand">Admin</Badge>}
      {!u.email ? (
        <Badge tone="warn">Sem email</Badge>
      ) : u.hasPassword ? (
        <Badge tone="ok">Pode entrar</Badge>
      ) : u.inviteSentAt ? (
        <Badge tone="brand">Convite enviado</Badge>
      ) : (
        <Badge tone="warn">Sem palavra-passe</Badge>
      )}
    </span>
  );
}

export function AdminUsers() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const { data, isLoading } = useSWR<{ users: AdminUser[]; mailConfigured: boolean }>(me?.isAdmin ? KEY : null, fetcher);
  const users = data?.users;
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (meLoading) return <Loading />;
  if (!me?.isAdmin)
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-lg font-black tracking-tight">Área reservada</p>
        <p className="mt-1 text-sm text-muted">Só administradores podem gerir contas.</p>
      </div>
    );

  const list = users ?? [];
  const pending = list.filter((u) => !u.email || !u.hasPassword).length;
  const current = list.find((u) => u.id === editing);

  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-4 pb-10 sm:px-8 lg:pt-12">
      <p className="text-[11px] font-bold tracking-widest text-accent-fg uppercase">Administração</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-black tracking-tight sm:text-[36px]">Utilizadores</h1>
          <p className="mt-1 text-sm text-muted">
            {list.length} contas{pending > 0 && ` · ${pending} ainda não podem entrar`}
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="press flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          <Icon name="plus" /> Nova conta
        </button>
      </div>

      {data && !data.mailConfigured && (
        <div className="mt-5 rounded-2xl border border-[#d97706]/30 bg-[#d97706]/10 px-4 py-3 text-sm">
          <strong>O envio de emails ainda não está configurado.</strong> Os convites funcionam na mesma: em vez de enviar o email, a app mostra o link
          para copiares e mandares à pessoa.
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Pessoa</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Último acesso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tarefas</th>
                  <th className="w-px px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0 hover:bg-hover">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar user={u} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {u.name}
                            {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-faint">(tu)</span>}
                          </span>
                          <span className="block truncate text-xs text-muted">{u.email ?? "—"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadges u={u} />
                    </td>
                    <td className="px-4 py-3 text-muted">{timeAgo(u.lastSeen)}</td>
                    <td className="px-4 py-3 text-right text-muted tabular-nums">{u.assigned}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(u.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-hover">
                        Gerir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-2 md:hidden">
            {list.map((u) => (
              <button key={u.id} onClick={() => setEditing(u.id)} className="press flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left">
                <Avatar user={u} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {u.name}
                    {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-faint">(tu)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{u.email ?? "Sem email"}</span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <StatusBadges u={u} />
                    <span className="text-[11px] text-faint">{timeAgo(u.lastSeen)}</span>
                  </span>
                </span>
                <Icon name="chevron" className="text-faint" />
              </button>
            ))}
          </div>
        </>
      )}

      <PanelLinks />

      {current && <UserSheet key={current.id} user={current} isSelf={current.id === me.id} onClose={() => setEditing(null)} />}
      {creating && <CreateSheet onClose={() => setCreating(false)} />}
    </div>
  );
}

const Loading = () => <div className="px-6 py-16 text-sm text-faint">A carregar…</div>;

function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="safe-bottom max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-card px-5 py-3.5">
          <div className="min-w-0 font-black tracking-tight">{title}</div>
          <button onClick={onClose} aria-label="Fechar" className="press rounded-full p-1.5 text-muted hover:bg-hover">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex flex-col gap-6 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold tracking-widest text-faint uppercase">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

const field = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent-fg";
const btn = "press rounded-xl border border-line px-3 py-2.5 text-sm font-semibold hover:bg-hover disabled:opacity-50";
const btnPrimary = "press rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

function Feedback({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`text-sm ${msg.ok ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{msg.text}</p>;
}

function GeneratedPassword({ value, email }: { value: string; email: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-accent-fg/30 bg-accent-soft p-4">
      <p className="text-xs font-semibold text-accent-fg">Palavra-passe gerada. Só aparece agora.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-card px-3 py-2 font-mono text-base tracking-wider select-all">{value}</code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
          }}
          className={btn}
        >
          {copied ? "Copiada" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Envia-a à pessoa{email ? ` (${email})` : ""} por um canal privado. Depois de entrar, ela pode mudá-la no menu da conta.
      </p>
    </div>
  );
}

function InviteResultBox({ result, email }: { result: InviteResult; email: string | null }) {
  const [copied, setCopied] = useState(false);
  if (result.sent)
    return (
      <div className="rounded-2xl border border-[#16a34a]/30 bg-[#16a34a]/10 p-4 text-sm">
        <p className="font-semibold text-[#15803d] dark:text-[#4ade80]">Convite enviado para {email}.</p>
        <p className="mt-1 text-xs text-muted">O link é válido durante 7 dias e só pode ser usado uma vez.</p>
      </div>
    );
  return (
    <div className="rounded-2xl border border-accent-fg/30 bg-accent-soft p-4">
      <p className="text-xs font-semibold text-accent-fg">O email não foi enviado. Copia o link do convite e manda-o à pessoa.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 font-mono text-xs select-all">{result.link}</code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(result.link ?? "").catch(() => {});
            setCopied(true);
          }}
          className={btn}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Válido durante 7 dias e só pode ser usado uma vez. Envia-o por um canal privado.</p>
    </div>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async <T,>(fn: () => Promise<T>, okText?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (okText) setMsg({ ok: true, text: okText });
      return r;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

function UserSheet({ user, isSelf, onClose }: { user: AdminUser; isSelf: boolean; onClose: () => void }) {
  const url = `${KEY}/${user.id}`;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [manualPw, setManualPw] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const details = useAction();
  const pw = useAction();
  const inv = useAction();
  const access = useAction();
  const danger = useAction();
  const dirty = name.trim() !== user.name || email.trim().toLowerCase() !== (user.email ?? "");

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <Avatar user={user} size={28} />
          <span className="truncate">{user.name}</span>
        </span>
      }
    >
      <Section title="Dados">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            details.run(() => call(url, "PATCH", { name, ...(email.trim() ? { email } : {}) }), "Dados guardados.");
          }}
        >
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome" required />
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@younglink.net" aria-label="Email" />
          <Feedback msg={details.msg} />
          <button type="submit" disabled={!dirty || details.busy} className={btnPrimary}>
            Guardar dados
          </button>
        </form>
      </Section>

      {!user.hasPassword && (
        <Section
          title="Convite"
          hint={user.inviteSentAt ? `Último convite: ${timeAgo(user.inviteSentAt).toLowerCase()}. Reenviar anula o anterior.` : "A pessoa recebe um email para escolher a palavra-passe."}
        >
          {invite ? (
            <InviteResultBox result={invite} email={user.email} />
          ) : (
            <div className="flex flex-col gap-2">
              <button
                disabled={inv.busy || !user.email}
                onClick={async () => {
                  const r = await inv.run(() => call(`${url}/invite`, "POST"));
                  if (r && typeof r.sent === "boolean") setInvite({ sent: r.sent, link: r.link ?? null });
                }}
                className={btnPrimary}
              >
                {inv.busy ? "A enviar…" : user.inviteSentAt ? "Reenviar convite por email" : "Enviar convite por email"}
              </button>
              {!user.email && <p className="text-xs text-[#b45309] dark:text-[#fbbf24]">Atribui primeiro um email nos dados acima.</p>}
              <Feedback msg={inv.msg} />
            </div>
          )}
        </Section>
      )}

      <Section
        title="Palavra-passe"
        hint={user.hasPassword ? "Ao mudar, as sessões abertas desta pessoa terminam." : "Ou define já uma palavra-passe e envia-a tu."}
      >
        {generated ? (
          <GeneratedPassword value={generated} email={user.email} />
        ) : (
          <div className="flex flex-col gap-2">
            <button
              disabled={pw.busy || !user.email}
              onClick={async () => {
                const r = await pw.run(() => call(url, "PATCH", { generatePassword: true }));
                if (r?.generatedPassword) setGenerated(r.generatedPassword);
              }}
              className={user.hasPassword ? btnPrimary : btn}
            >
              Gerar palavra-passe nova
            </button>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await pw.run(() => call(url, "PATCH", { password: manualPw }), "Palavra-passe definida.");
                setManualPw("");
              }}
            >
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={manualPw}
                onChange={(e) => setManualPw(e.target.value)}
                placeholder="Ou escreve uma (mín. 8)"
                aria-label="Nova palavra-passe"
              />
              <button type="submit" disabled={pw.busy || manualPw.length < 8 || !user.email} className={btn}>
                Definir
              </button>
            </form>
            {!user.email && <p className="text-xs text-[#b45309] dark:text-[#fbbf24]">Atribui primeiro um email, que é o que a pessoa usa para entrar.</p>}
            <Feedback msg={pw.msg} />
          </div>
        )}
      </Section>

      <Section title="Acesso">
        <div className="flex flex-col gap-2">
          <label className={`flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 ${isSelf ? "opacity-60" : ""}`}>
            <span>
              <span className="block text-sm font-semibold">Administrador</span>
              <span className="block text-xs text-muted">Pode gerir contas nesta página.</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#1e3a8a]"
              checked={user.isAdmin}
              disabled={isSelf || access.busy}
              onChange={(e) => access.run(() => call(url, "PATCH", { isAdmin: e.target.checked }), e.target.checked ? "Agora é administrador." : "Deixou de ser administrador.")}
            />
          </label>
          {!isSelf && (
            <button
              disabled={access.busy || user.activeSessions === 0}
              onClick={() => access.run(() => call(url, "PATCH", { revokeSessions: true }), "Sessões terminadas.")}
              className={btn}
            >
              {user.activeSessions === 0 ? "Sem sessões abertas" : `Terminar ${user.activeSessions === 1 ? "a sessão aberta" : `as ${user.activeSessions} sessões abertas`}`}
            </button>
          )}
          <Feedback msg={access.msg} />
        </div>
      </Section>

      {!isSelf && (
        <Section title="Zona perigosa">
          <button
            disabled={danger.busy}
            onClick={async () => {
              const extra = user.assigned ? `\n\nTem ${user.assigned} ${user.assigned === 1 ? "item atribuído" : "itens atribuídos"}; esses itens ficam sem responsável.` : "";
              if (!confirm(`Apagar a conta de ${user.name}? Isto não se pode desfazer.${extra}`)) return;
              const ok = await danger.run(() => call(url, "DELETE"));
              if (ok !== undefined) onClose();
            }}
            className="press w-full rounded-xl border border-[#dc2626]/40 px-3 py-2.5 text-sm font-semibold text-[#dc2626] hover:bg-[#dc2626]/10 disabled:opacity-50"
          >
            Apagar conta
          </button>
          <Feedback msg={danger.msg} />
        </Section>
      )}
    </Sheet>
  );
}

type Mode = "invite" | "generate" | "manual";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "invite", label: "Enviar convite por email", hint: "A pessoa escolhe a palavra-passe através de um link." },
  { id: "generate", label: "Gerar palavra-passe agora", hint: "Copias e envias tu." },
  { id: "manual", label: "Escolher eu a palavra-passe", hint: "Mínimo 8 caracteres." },
];

function CreateSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<Mode>("invite");
  const [password, setPassword] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const action = useAction();

  if (generated || invite)
    return (
      <Sheet title="Conta criada" onClose={onClose}>
        <p className="text-sm">
          A conta de <strong>{name}</strong> ({email}) foi criada.
        </p>
        {generated && <GeneratedPassword value={generated} email={email} />}
        {invite && <InviteResultBox result={invite} email={email} />}
        <button onClick={onClose} className={btnPrimary}>
          Concluído
        </button>
      </Sheet>
    );

  return (
    <Sheet title="Nova conta" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await action.run(() => call(KEY, "POST", { name, email, isAdmin, mode, password: mode === "manual" ? password : undefined }));
          if (r === undefined) return;
          if (r?.generatedPassword) setGenerated(r.generatedPassword);
          else if (r?.invite) setInvite(r.invite);
          else onClose();
        }}
      >
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e apelido" aria-label="Nome" required autoFocus />
        <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@younglink.net" aria-label="Email" required />

        <fieldset className="mt-1 flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[11px] font-bold tracking-widest text-faint uppercase">Acesso</legend>
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${mode === m.id ? "border-accent-fg bg-accent-soft" : "border-line hover:bg-hover"}`}
            >
              <input type="radio" name="mode" className="mt-0.5 h-4 w-4 accent-[#1e3a8a]" checked={mode === m.id} onChange={() => setMode(m.id)} />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {mode === "manual" && (
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Palavra-passe (mín. 8)"
            aria-label="Palavra-passe"
          />
        )}
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#1e3a8a]" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          Administrador (pode gerir contas)
        </label>
        <Feedback msg={action.msg} />
        <button type="submit" disabled={action.busy} className={btnPrimary}>
          {action.busy ? "A criar…" : mode === "invite" ? "Criar e enviar convite" : "Criar conta"}
        </button>
      </form>
    </Sheet>
  );
}

type PanelLink = { id: string; name: string; created_at: string; last_seen: string | null; created_by_name: string | null; online: boolean };
const PANEL_KEY = "/api/admin/painel";

function PanelLinks() {
  const { data: links = [] } = useSWR<PanelLink[]>(PANEL_KEY, fetcher, { refreshInterval: 60_000 });
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const action = useAction();

  return (
    <section className="mt-10">
      <h2 className="text-xl font-black tracking-tight">Ecrãs do painel</h2>
      <p className="mt-1 text-sm text-muted">
        Cada tablet abre o painel da sede com um link próprio, só de leitura, sem conta. Mostra as tarefas e projetos marcados com «No painel».
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
        {links.length === 0 && <p className="px-4 py-6 text-center text-sm text-faint">Ainda não há nenhum ecrã.</p>}
        {links.map((l) => {
          const online = l.online;
          return (
            <div key={l.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? "bg-[#16a34a]" : "bg-line-strong"}`} title={online ? "Ligado" : "Desligado"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{l.name}</span>
                <span className="block truncate text-xs text-muted">
                  {online ? "Ligado agora" : l.last_seen ? `Visto ${timeAgo(l.last_seen).toLowerCase()}` : "Nunca abriu o painel"}
                  {l.created_by_name ? ` · criado por ${l.created_by_name.split(" ")[0]}` : ""}
                </span>
              </span>
              <button
                onClick={() => {
                  if (confirm(`Revogar o link de "${l.name}"? Essa tablet deixa de mostrar o painel.`))
                    action.run(() => call(`${PANEL_KEY}/${l.id}`, "DELETE").then(() => mutate(PANEL_KEY)));
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-hover hover:text-[#dc2626]"
              >
                Revogar
              </button>
            </div>
          );
        })}
      </div>

      {created ? (
        <div className="mt-3 rounded-2xl border border-accent-fg/30 bg-accent-soft p-4">
          <p className="text-xs font-semibold text-accent-fg">Link criado. Só aparece agora: abre-o na tablet (ou guarda-o na Fully Kiosk).</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 font-mono text-xs select-all">{created}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(created).catch(() => {});
                setCopied(true);
              }}
              className={btn}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button onClick={() => setCreated(null)} className="mt-2 text-xs text-muted underline">
            Fechar
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = (await action.run(async () => {
              const res = await fetch(PANEL_KEY, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
              const data = await res.json().catch(() => null);
              if (!res.ok) throw new Error(data?.error ?? "Algo correu mal.");
              return data as { url: string };
            })) as { url: string } | undefined;
            if (r?.url) {
              setCreated(r.url);
              setCopied(false);
              setName("");
              mutate(PANEL_KEY);
            }
          }}
        >
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do ecrã (ex.: Tablet da entrada)" aria-label="Nome do ecrã" />
          <button type="submit" disabled={action.busy} className={`${btnPrimary} shrink-0`}>
            Criar link
          </button>
        </form>
      )}
      <Feedback msg={action.msg} />
    </section>
  );
}
