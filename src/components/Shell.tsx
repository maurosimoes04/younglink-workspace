"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPage, logout, toastStore, useCurrentUser, usePages, type Toast } from "@/lib/client";
import { DB_LIST, DBS, isDbId, type PageRow } from "@/lib/schema";
import { Avatar, Icon, MenuItem, Popover } from "./ui";
import { hasPageIcon, PageIcon } from "./icons";

export function useMe() {
  return useCurrentUser().data?.id ?? null;
}

const SearchCtx = createContext<() => void>(() => {});
export const useOpenSearch = () => useContext(SearchCtx);

export function BrandTile({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-tile flex shrink-0 items-center justify-center rounded-[9px] shadow-sm" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/yl-mark.png" alt="" className="object-contain" style={{ width: size * 0.7, height: size * 0.7 }} />
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/painel" || pathname === "/recuperar" || pathname.startsWith("/recuperar/") || pathname.startsWith("/convite/")) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchCtx.Provider value={openSearch}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader />
          <main className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</main>
        </div>
        <BottomNav />
      </div>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <Toaster />
    </SearchCtx.Provider>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${active ? "bg-accent-soft font-semibold text-accent-fg" : "text-fg/80 hover:bg-hover"}`}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="group mt-5 mb-1 flex items-center justify-between px-2.5">
      <span className="text-[10px] font-bold tracking-widest text-faint uppercase">{children}</span>
      {action}
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const openSearch = useOpenSearch();
  const { data: projects = [] } = usePages("projetos");
  const { data: pages = [] } = usePages("page");
  const active = projects.filter((p) => p.props.estado !== DBS.projetos.doneStatus);
  const isAdmin = useCurrentUser().data?.isAdmin;

  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-line bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <BrandTile size={34} />
        <div className="min-w-0">
          <div className="text-[10px] font-bold tracking-widest text-accent-fg uppercase">Young-Link</div>
          <div className="truncate text-[15px] font-black tracking-tight">Espaço de trabalho</div>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
        <button onClick={openSearch} className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-hover">
          <Icon name="search" />
          <span className="flex-1 text-left">Procurar</span>
          <kbd className="rounded border border-line px-1 text-[11px] text-faint">⌘K</kbd>
        </button>
        <NavLink href="/" active={pathname === "/"}>
          <Icon name="home" /> Início
        </NavLink>

        <SectionLabel>Bases de dados</SectionLabel>
        {DB_LIST.map((d) => (
          <NavLink key={d.id} href={`/${d.id}`} active={pathname === `/${d.id}`}>
            <PageIcon name={d.icon} /> {d.name}
          </NavLink>
        ))}

        <SectionLabel>Projetos ativos</SectionLabel>
        {active.map((p) => (
          <NavLink key={p.id} href={`/p/${p.id}`} active={pathname === `/p/${p.id}`}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.props.estado === "Em curso" ? "#3b82f6" : "var(--fg-faint)" }} />
            <span className="truncate">{p.title || "Sem título"}</span>
          </NavLink>
        ))}

        <SectionLabel
          action={
            <button
              aria-label="Nova página"
              onClick={async () => router.push(`/p/${(await createPage("page", { title: "" })).id}`)}
              className="rounded p-0.5 text-faint opacity-0 group-hover:opacity-100 hover:bg-hover"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
            </button>
          }
        >
          Páginas
        </SectionLabel>
        <PageTree pages={pages} parent={null} pathname={pathname} depth={0} />
      </div>

      <div className="border-t border-line p-2">
        {isAdmin && (
          <NavLink href="/admin" active={pathname === "/admin"}>
            <Icon name="user" /> Administração
          </NavLink>
        )}
        <AccountMenu />
      </div>
    </aside>
  );
}

function PageTree({ pages, parent, pathname, depth }: { pages: PageRow[]; parent: string | null; pathname: string; depth: number }) {
  const kids = pages.filter((p) => p.parent_id === parent || (parent === null && p.parent_id && !pages.some((x) => x.id === p.parent_id)));
  if (depth > 4) return null;
  return (
    <>
      {kids.map((p) => (
        <div key={p.id}>
          <div style={{ paddingLeft: depth * 12 }}>
            <NavLink href={`/p/${p.id}`} active={pathname === `/p/${p.id}`}>
              <PageIcon name={p.icon} className={`h-4 w-4 ${hasPageIcon(p.icon) ? "" : "text-faint"}`} />
              <span className="truncate">{p.title || "Sem título"}</span>
            </NavLink>
          </div>
          <PageTree pages={pages.filter((x) => x.id !== p.id)} parent={p.id} pathname={pathname} depth={depth + 1} />
        </div>
      ))}
    </>
  );
}

function AccountMenu({ compact }: { compact?: boolean }) {
  const { data: user } = useCurrentUser();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <>
      <button
        ref={anchor}
        onClick={() => setOpen(true)}
        aria-label="Conta"
        className={compact ? "press flex h-9 w-9 items-center justify-center rounded-full" : "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-hover"}
      >
        {user ? <Avatar user={user} size={compact ? 28 : 24} /> : <Icon name="user" className="h-6 w-6 text-faint" />}
        {!compact && <span className="flex-1 truncate text-left">{user?.name ?? ""}</span>}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={240}>
        {user && (
          <div className="border-b border-line px-2 pt-1 pb-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
        )}
        <div className="pt-1">
          {user?.isAdmin && compact && (
            <Link href="/admin" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-hover">
              Administração
            </Link>
          )}
          <MenuItem
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
          >
            Mudar palavra-passe
          </MenuItem>
          <MenuItem danger onClick={logout}>
            Terminar sessão
          </MenuItem>
        </div>
      </Popover>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setMsg({ ok: false, text: "As palavras-passe novas não coincidem." });
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    if (res.ok) {
      setMsg({ ok: true, text: "Palavra-passe alterada." });
      setTimeout(onClose, 900);
    } else setMsg({ ok: false, text: (await res.json().catch(() => null))?.error ?? "Erro ao guardar." });
  };
  const field = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent-fg";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-black tracking-tight">Mudar palavra-passe</h2>
        <div className="mt-4 flex flex-col gap-2.5">
          <input type="password" autoComplete="current-password" required placeholder="Palavra-passe atual" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} autoFocus />
          <input type="password" autoComplete="new-password" required minLength={8} placeholder="Nova (mínimo 8 caracteres)" value={next} onChange={(e) => setNext(e.target.value)} className={field} />
          <input type="password" autoComplete="new-password" required placeholder="Repetir a nova" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{msg.text}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line px-3 py-2.5 text-sm hover:bg-hover">
            Cancelar
          </button>
          <button type="submit" className="press flex-1 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

function useTitleForPath(pathname: string) {
  const seg = pathname.split("/")[1];
  if (!seg) return "Início";
  if (isDbId(seg)) return DBS[seg].name;
  if (seg === "admin") return "Administração";
  return "";
}

function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const openSearch = useOpenSearch();
  const title = useTitleForPath(pathname);
  const isDetail = pathname.startsWith("/p/");
  return (
    <header className="glass sticky top-0 z-30 flex items-center gap-2 border-b border-line px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 lg:hidden">
      {isDetail ? (
        <button onClick={() => router.back()} aria-label="Voltar" className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover">
          <Icon name="chevron" className="h-5 w-5 rotate-180" />
        </button>
      ) : (
        <BrandTile size={32} />
      )}
      <div className="min-w-0 flex-1">
        {!isDetail && <div className="text-[10px] leading-3 font-bold tracking-widest text-accent-fg uppercase">Young-Link</div>}
        <div className="truncate text-[17px] font-black tracking-tight">{title}</div>
      </div>
      <button onClick={openSearch} aria-label="Procurar" className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover">
        <Icon name="search" className="h-5 w-5" />
      </button>
      <AccountMenu compact />
    </header>
  );
}

const TABS = [
  { href: "/", label: "Início", icon: "house" },
  { href: "/tarefas", label: "Tarefas", icon: DBS.tarefas.icon },
  { href: "/projetos", label: "Projetos", icon: DBS.projetos.icon },
  { href: "/documentos", label: "Docs", icon: DBS.documentos.icon },
];

function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <nav className="glass pointer-events-auto mx-3 mb-2 flex items-center justify-evenly rounded-[28px] border border-line px-1 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.14)]">
        {TABS.map((t) => {
          const on = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className="press relative flex h-12 w-16 flex-col items-center justify-center gap-0.5">
              {on && <span className="absolute inset-0.5 rounded-2xl bg-active" />}
              <PageIcon name={t.icon} className={`relative h-[22px] w-[22px] ${on ? "" : "text-muted"}`} />
              <span className={`relative text-[10px] ${on ? "font-bold" : "text-muted"}`}>{t.label}</span>
            </Link>
          );
        })}
        <button
          aria-label="Nova tarefa"
          onClick={async () => router.push(`/p/${(await createPage("tarefas", { props: { estado: "Por fazer" } })).id}`)}
          className="press brand-tile flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md"
        >
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </nav>
    </div>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PageRow[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (!q.trim()) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((r: PageRow[]) => (setResults(r), setSel(0)))
        .catch(() => {});
    }, 120);
    return () => (clearTimeout(t), ctl.abort());
  }, [q]);

  const list = q.trim() ? results : [];
  const go = (p: PageRow) => {
    onClose();
    router.push(`/p/${p.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="shadow-pop w-full max-w-xl overflow-hidden rounded-2xl bg-popover">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Icon name="search" className="h-5 w-5 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, list.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && list[sel]) go(list[sel]);
            }}
            placeholder="Procurar tarefas, projetos, documentos…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {!q.trim() &&
            DB_LIST.map((d) => (
              <Link key={d.id} href={`/${d.id}`} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-hover">
                <PageIcon name={d.icon} className="h-4 w-4 text-muted" /> Abrir {d.name}
              </Link>
            ))}
          {q.trim() && list.length === 0 && <div className="px-3 py-6 text-center text-sm text-faint">Sem resultados para “{q}”.</div>}
          {list.map((p, i) => (
            <button
              key={p.id}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(p)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === sel ? "bg-hover" : ""}`}
            >
              <PageIcon name={p.icon} fallback={isDbId(p.db) ? DBS[p.db].icon : "file-text"} className="h-4 w-4 text-muted" />
              <span className="min-w-0 flex-1 truncate">{p.title || "Sem título"}</span>
              <span className="text-xs text-faint">{isDbId(p.db) ? DBS[p.db].name : "Página"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const NO_TOASTS: Toast[] = [];

function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get, () => NO_TOASTS);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-3 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end" role="status" aria-live="polite">
      {toasts.map((t) => {
        const body = (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a34a]/15 text-[#16a34a] dark:text-[#4ade80]">
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 truncate">{t.text}</span>
          </>
        );
        const cls = "shadow-pop pointer-events-auto flex max-w-[min(420px,100%)] items-center gap-2.5 rounded-2xl bg-popover px-3.5 py-2.5 text-sm font-medium";
        return t.href ? (
          <Link key={t.id} href={t.href} className={`${cls} hover:bg-hover`}>
            {body}
          </Link>
        ) : (
          <div key={t.id} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
