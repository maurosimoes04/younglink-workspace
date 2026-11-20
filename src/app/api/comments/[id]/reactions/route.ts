import { requireUser, Unauthorized, unauthorized } from "@/lib/auth";
import { CommentError, toggleReaction } from "@/lib/comments";

export async function POST(req: Request, ctx: RouteContext<"/api/comments/[id]/reactions">) {
  try {
    const me = await requireUser();
    const { id } = await ctx.params;
    const { kind } = (await req.json().catch(() => ({}))) as { kind?: unknown };
    toggleReaction(id, me.id, kind);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof Unauthorized) return unauthorized();
    if (e instanceof CommentError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
