"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandTile } from "./Shell";
import { Icon } from "./ui";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setSent(true);
    else setError((await res?.json().catch(() => null))?.error ?? "Não foi possível ligar ao servidor.");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-card p-7 shadow-2xl">
        <div aria-hidden className="yl-watermark pointer-events-none absolute -top-4 -right-4 h-[130px] w-[130px] bg-fg opacity-[0.06]" />
        <div className="relative">
          <BrandTile size={56} />
          <p className="mt-5 text-[10px] font-bold tracking-widest text-accent-fg uppercase">Recuperar acesso · Young-Link</p>

          {sent ? (
            <>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight">Verifica o teu email</h1>
              <p className="mt-2 text-sm text-muted">
                Se <strong className="text-fg">{email}</strong> tiver conta no espaço de trabalho, vais receber um link para definir uma nova palavra-passe. O
                link é válido durante 1 hora.
              </p>
              <p className="mt-3 text-xs text-faint">Não chegou? Vê a pasta de spam ou pede ajuda à Direção.</p>
            </>
          ) : (
            <>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight">
                Esqueceste-te da <span className="whitespace-nowrap">palavra-passe?</span>
              </h1>
              <p className="mt-1 text-sm text-muted">Escreve o teu email e enviamos-te um link para criares uma nova.</p>
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
                    className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-[15px] outline-none placeholder:text-faint focus:border-accent-fg"
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-xl bg-[#dc2626]/10 px-3 py-2 text-sm text-[#dc2626]">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className="press mt-2 rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy ? "A enviar…" : "Enviar link"}
                </button>
              </form>
            </>
          )}

          <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted hover:text-fg">
            <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" /> Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
