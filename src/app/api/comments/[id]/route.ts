import { requireUser, Unauthorized, unauthorized } from "@/lib/auth";
import { CommentError, deleteComment, updateComment } from "@/lib/comments";
import { deleteFile } from "@/lib/drive";

async function run(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Unauthorized) return unauthorized();
    if (e instanceof CommentError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/comments/[id]">) {
  return run(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { body?: unknown; resolved?: unknown };
    updateComment(id, me.id, body);
    return new Response(null, { status: 204 });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/comments/[id]">) {
  return run(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const { fileIds } = deleteComment(id, me);
    for (const f of fileIds) await deleteFile(f).catch((e) => console.error("Falha ao pôr anexo no lixo:", (e as Error).message));
    return new Response(null, { status: 204 });
  });
}
