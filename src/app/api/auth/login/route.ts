import { checkCredentials, isLocked, isSecureRequest, startSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return Response.json({ error: "Escreve o email e a palavra-passe." }, { status: 400 });

  if (isLocked(email)) return Response.json({ error: "Demasiadas tentativas. Tenta outra vez daqui a 15 minutos." }, { status: 429 });

  const user = checkCredentials(email, password);
  if (!user) return Response.json({ error: "Email ou palavra-passe incorretos." }, { status: 401 });

  await startSession(user.id, isSecureRequest(req));
  return Response.json(user);
}
