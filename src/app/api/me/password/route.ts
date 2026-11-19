import { changePassword, currentUser, unauthorized } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
  if (typeof current !== "string" || typeof next !== "string") return Response.json({ error: "Pedido inválido." }, { status: 400 });
  if (next.length < 8) return Response.json({ error: "A nova palavra-passe tem de ter pelo menos 8 caracteres." }, { status: 400 });
  if (!changePassword(user.id, current, next)) return Response.json({ error: "A palavra-passe atual está errada." }, { status: 403 });
  return new Response(null, { status: 204 });
}
