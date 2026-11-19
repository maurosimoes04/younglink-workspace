"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  AlignLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Ellipsis,
  FileText,
  House,
  Kanban,
  Link,
  Menu,
  Plus,
  Search,
  Shield,
  Smile,
  SquareArrowOutUpRight,
  Table,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import type { Color, DateValue, Option, User } from "@/lib/schema";

export function Tag({ option, onRemove }: { option: Option | { name: string; color?: Color }; onRemove?: () => void }) {
  const c = option.color ?? "default";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 truncate rounded-[3px] px-1.5 text-[13px] leading-5 whitespace-nowrap"
      style={{ background: `var(--tag-${c}-bg)`, color: `var(--tag-${c}-fg)` }}
    >
      <span className="truncate">{option.name}</span>
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label={`Remover ${option.name}`}>
          ×
        </button>
      )}
    </span>
  );
}

const AVATAR_COLORS = ["#e16259", "#d9730d", "#cb912f", "#448361", "#337ea9", "#9065b0", "#c14c8a"];

export function Avatar({ user, size = 20 }: { user: Pick<User, "id" | "name">; size?: number }) {
  const color = AVATAR_COLORS[[...user.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      title={user.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {initials}
    </span>
  );
}

export function People({ ids, users }: { ids: string[]; users: User[] }) {
  const list = ids.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u);
  if (list.length === 0) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {list.map((u) => (
        <span key={u.id} className="inline-flex min-w-0 items-center gap-1.5">
          <Avatar user={u} />
          <span className="truncate">{u.name.split(" ")[0]}</span>
        </span>
      ))}
    </span>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const timeFmt = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });

const hasTime = (s: string) => s.includes("T");
export const parseDate = (s: string) => (hasTime(s) ? new Date(s) : new Date(s + "T00:00:00"));

function fmtOne(s: string, withYear: boolean) {
  const d = parseDate(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear && !sameYear ? ` ${d.getFullYear()}` : ""}`;
  return hasTime(s) ? `${base}, ${timeFmt.format(d)}` : base;
}

export function formatDate(v: DateValue | undefined | null) {
  if (!v?.start) return "";
  if (!v.end) return fmtOne(v.start, true);
  return `${fmtOne(v.start, false)} → ${fmtOne(v.end, true)}`;
}

export function isOverdue(v: DateValue | undefined | null) {
  if (!v?.start) return false;
  const end = parseDate(v.end ?? v.start);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

export function Popover({
  anchor,
  open,
  onClose,
  children,
  width = 260,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !anchor.current || !el) return;
    const r = anchor.current.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const above = window.innerHeight - r.bottom < 320 && r.top > 320;
    el.style.width = `${w}px`;
    el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    el.style.top = `${above ? r.top - 4 : r.bottom + 4}px`;
    el.style.transform = above ? "translateY(-100%)" : "";
    el.style.visibility = "visible";
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchor]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      className="shadow-pop fixed top-0 left-0 z-50 max-h-[min(420px,70vh)] overflow-auto rounded-xl bg-popover p-1 text-fg"
      style={{ visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  children,
  onClick,
  active,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-hover ${active ? "bg-hover" : ""} ${danger ? "text-[#eb5757]" : ""}`}
    >
      {children}
    </button>
  );
}

const ICONS = {
  search: Search,
  home: House,
  plus: Plus,
  chevron: ChevronRight,
  dots: Ellipsis,
  trash: Trash2,
  table: Table,
  board: Kanban,
  open: SquareArrowOutUpRight,
  menu: Menu,
  close: X,
  page: FileText,
  user: UserIcon,
  check: Check,
  shield: Shield,
  status: CircleDot,
  select: ChevronDown,
  person: UserIcon,
  date: Calendar,
  text: AlignLeft,
  url: Link,
  relation: ArrowUpRight,
  smile: Smile,
};

export function Icon({ name, className = "" }: { name: keyof typeof ICONS; className?: string }) {
  const Cmp = ICONS[name];
  return <Cmp className={`h-4 w-4 shrink-0 ${className}`} strokeWidth={1.75} aria-hidden />;
}
