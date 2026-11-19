import { requestPasswordReset } from "@/lib/admin";
import { appUrl } from "@/lib/mail";

export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: unknown };
  if (typeof email !== "string" || !email.includes("@")) return Response.json({ error: "Escreve o teu email." }, { status: 400 });
  requestPasswordReset(email, appUrl(req)).catch((e) => console.error("Falha na recuperação de palavra-passe:", (e as Error).message));
  return Response.json({ ok: true });
}
