import { connection } from "next/server";
import { acceptInvite, AdminError, getInvite } from "@/lib/admin";
import { isSecureRequest, startSession } from "@/lib/auth";

export async function GET(_req: Request, ctx: RouteContext<"/api/auth/reset/[token]">) {
  await connection();
  const { token } = await ctx.params;
  const reset = getInvite(token, "reset");
  if (!reset) return Response.json({ error: "Este link já foi usado ou expirou. Pede um novo na página de login." }, { status: 410 });
  return Response.json(reset);
}

export async function POST(req: Request, ctx: RouteContext<"/api/auth/reset/[token]">) {
  const { token } = await ctx.params;
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  try {
    const userId = acceptInvite(token, password, "reset");
    await startSession(userId, isSecureRequest(req));
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
