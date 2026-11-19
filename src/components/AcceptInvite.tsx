"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { BrandTile } from "./Shell";

type Invite = { name: string; email: string };

const fetchInvite = async (url: string): Promise<Invite> => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Convite inválido.");
  return data;
};

const COPY = {
  invite: {
    api: "/api/invite/",
    eyebrow: "Convite · Young-Link",
    checking: "A verificar o convite…",
    unavailable: "Convite indisponível",
    lead: "Escolhe a tua palavra-passe para entrares no espaço de trabalho.",
    submit: "Entrar no espaço de trabalho",
  },
  reset: {
    api: "/api/auth/reset/",
    eyebrow: "Recuperar acesso · Young-Link",
    checking: "A verificar o link…",
    unavailable: "Link indisponível",
    lead: "Escolhe a tua nova palavra-passe. As sessões abertas noutros aparelhos vão terminar.",
    submit: "Guardar e entrar",
  },
};

export function AcceptInvite({ mode = "invite" }: { mode?: "invite" | "reset" }) {
  const copy = COPY[mode];
  const { token } = useParams<{ token: string }>();
  const { data: invite, error, isLoading } = useSWR(`${copy.api}${encodeURIComponent(token)}`, fetchInvite, { revalidateOnFocus: false, shouldRetryOnError: false });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setMsg("As palavras-passe não coincidem.");
    setBusy(true);
    setMsg("");
    const res = await fetch(`${copy.api}${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.assign("/");
      return;
    }
    setMsg((await res?.json().catch(() => null))?.error ?? "Não foi possível ligar ao servidor.");
    setBusy(false);
  };

  const field = "w-full rounded-xl border border-line bg-bg px-4 py-3 text-[15px] outline-none placeholder:text-faint focus:border-accent-fg";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-card p-7 shadow-2xl">
        <div aria-hidden className="yl-watermark pointer-events-none absolute -top-4 -right-4 h-[130px] w-[130px] bg-fg opacity-[0.06]" />
        <div className="relative">
          <BrandTile size={56} />
          <p className="mt-5 text-[10px] font-bold tracking-widest text-accent-fg uppercase">{copy.eyebrow}</p>

          {isLoading ? (
            <p className="mt-4 text-sm text-faint">{copy.checking}</p>
          ) : error || !invite ? (
            <>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight">{copy.unavailable}</h1>
              <p className="mt-2 text-sm text-muted">{error?.message ?? "Convite inválido."}</p>
              <a href={mode === "reset" ? "/recuperar" : "/login"} className="press mt-6 block rounded-xl border border-line px-4 py-3 text-center text-sm font-semibold hover:bg-hover">
                {mode === "reset" ? "Pedir um link novo" : "Ir para o login"}
              </a>
            </>
          ) : (
            <>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight">Olá, {invite.name.split(" ")[0]}!</h1>
              <p className="mt-1 text-sm text-muted">{copy.lead}</p>
              <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted">Email</span>
                  <input type="email" autoComplete="username" value={invite.email} readOnly className={`${field} text-muted`} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted">Palavra-passe</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className={field}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted">Repetir palavra-passe</span>
                  <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
                </label>
                {msg && (
                  <p role="alert" className="rounded-xl bg-[#dc2626]/10 px-3 py-2 text-sm text-[#dc2626]">
                    {msg}
                  </p>
                )}
                <button type="submit" disabled={busy} className="press mt-2 rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy ? "A guardar…" : copy.submit}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
