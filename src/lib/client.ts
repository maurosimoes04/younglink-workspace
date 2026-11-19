"use client";

import useSWR, { mutate } from "swr";
import type { PageFull, PageRow, User } from "./schema";

function toLogin() {
  if (window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) toLogin();
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
  return res.json();
};

export const useCurrentUser = () => useSWR<User & { isAdmin: boolean }>("/api/me", fetcher, { revalidateOnFocus: false });

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign("/login");
}

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

export type PageWithRefs = PageFull & { refs: Pick<PageRow, "id" | "title" | "icon" | "db">[]; files: StoredFile[]; driveEnabled: boolean };

export function uploadFile(pageId: string, file: File, onProgress?: (fraction: number) => void) {
  return new Promise<StoredFile>((resolve, reject) => {
    const form = new FormData();
    form.append("pageId", pageId);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status === 401) toLogin();
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        mutate(pageKey(pageId));
        resolve(data as StoredFile);
      } else reject(new Error(data?.error ?? "Falhou o envio do ficheiro."));
    };
    xhr.onerror = () => reject(new Error("Sem ligação ao servidor."));
    xhr.send(form);
  });
}

export async function removeFile(pageId: string, fileId: string) {
  const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível apagar.");
  await mutate(pageKey(pageId));
}

const listKey = (db: string) => `/api/pages?db=${db}`;
const pageKey = (id: string) => `/api/pages/${id}`;

export const usePages = (db: string | null) => useSWR<PageRow[]>(db ? listKey(db) : null, fetcher);
export const usePage = (id: string) => useSWR<PageWithRefs>(pageKey(id), fetcher);
export const useUsers = () => useSWR<User[]>("/api/users", fetcher);

export async function createPage(db: string, data: Partial<Pick<PageRow, "title" | "icon" | "props" | "parent_id">> = {}) {
  const res = await fetch("/api/pages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ db, ...data }),
  });
  if (res.status === 401) toLogin();
  if (!res.ok) throw new Error("Não foi possível criar");
  const page = (await res.json()) as PageFull;
  await mutate(listKey(db));
  return page;
}

type Patch = Partial<Pick<PageFull, "title" | "icon" | "props" | "content" | "parent_id">>;

export async function patchPage(db: string, id: string, patch: Patch) {
  const apply = (p: PageRow): PageRow =>
    p.id !== id ? p : { ...p, ...patch, props: patch.props ? { ...p.props, ...patch.props } : p.props };
  mutate<PageRow[]>(listKey(db), (rows) => rows?.map(apply), { revalidate: false });
  if (!patch.content) mutate<PageWithRefs>(pageKey(id), (p) => (p ? { ...p, ...apply(p) } : p), { revalidate: false });
  const res = await fetch(pageKey(id), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.status === 401) toLogin();
  if (!res.ok) throw new Error("Não foi possível guardar");
  const saved = (await res.json().catch(() => null)) as { unblocked?: Unblocked[] } | null;
  if (patch.props || patch.title !== undefined || patch.icon !== undefined) {
    mutate(listKey(db));
    if (patch.props) mutate(pageKey(id));
  }
  announceUnblocked(saved?.unblocked);
}

export async function deletePage(db: string, id: string) {
  const res = await fetch(pageKey(id), { method: "DELETE" });
  const data = (await res.json().catch(() => null)) as { unblocked?: Unblocked[] } | null;
  await mutate(listKey(db));
  announceUnblocked(data?.unblocked);
}

type Unblocked = { id: string; title: string };

export type Toast = { id: number; text: string; href?: string };
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();

export function notify(text: string, href?: string) {
  const t = { id: Date.now() + Math.random(), text, href };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l());
  }, 6000);
}

export const toastStore = {
  subscribe: (cb: () => void) => {
    toastListeners.add(cb);
    return () => toastListeners.delete(cb);
  },
  get: () => toasts,
};

function announceUnblocked(list?: Unblocked[]) {
  if (!list?.length) return;
  for (const u of list) mutate(pageKey(u.id));
  if (list.length === 1) notify(`Desbloqueada: ${list[0].title || "Sem título"}`, `/p/${list[0].id}`);
  else notify(`${list.length} tarefas desbloqueadas`, "/tarefas");
}
