"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrandTile } from "./Shell";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function Login() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.assign(safeNext(params.get("next")));
      return;
    }
    setError((await res?.json().catch(() => null))?.error ?? "Não foi possível ligar ao servidor.");
    setBusy(false);
  };

  const field =
    "w-full rounded-xl border border-line bg-bg px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent-fg";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-card p-7 shadow-2xl">
        <div aria-hidden className="yl-watermark pointer-events-none absolute -top-4 -right-4 h-[130px] w-[130px] bg-fg opacity-[0.06]" />
        <div className="relative">
          <BrandTile size={56} />
          <p className="mt-5 text-[10px] font-bold tracking-widest text-accent-fg uppercase">Young-Link</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight">Espaço de trabalho</h1>
          <p className="mt-1 text-sm text-muted">Entra com o teu email da Young-Link.</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Email</span>
              <input
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@younglink.net"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Palavra-passe</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </label>
            <Link href="/recuperar" className="-mt-1 self-end text-xs font-semibold text-accent-fg hover:underline">
              Esqueceste-te da palavra-passe?
            </Link>
            {error && (
              <p role="alert" className="rounded-xl bg-[#dc2626]/10 px-3 py-2 text-sm text-[#dc2626]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="press mt-2 rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "A entrar…" : "Entrar"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-faint">Sem acesso? Pede à Direção para criar a tua conta.</p>
        </div>
      </div>
    </div>
  );
}
