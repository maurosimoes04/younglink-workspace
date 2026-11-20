import { connection } from "next/server";
import { requireUser, Unauthorized, unauthorized } from "@/lib/auth";
import { CommentError, createComment, listComments, mentionedIds } from "@/lib/comments";
import { getPage, sql } from "@/lib/db";
import { appUrl, mentionEmail, sendMail } from "@/lib/mail";

async function user() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof Unauthorized) return null;
    throw e;
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/api/pages/[id]/comments">) {
  await connection();
  const me = await user();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  return Response.json(listComments(id, me.id));
}

const plain = (body: string) => body.replace(/@\[([^\]\n]{1,80})\]\([0-9a-f-]{36}\)/g, "@$1");

export async function POST(req: Request, ctx: RouteContext<"/api/pages/[id]/comments">) {
  const me = await user();
  if (!me) return unauthorized();
  const { id: pageId } = await ctx.params;
  const page = getPage(pageId);
  if (!page) return Response.json({ error: "Página não encontrada." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { body?: unknown; parentId?: unknown; withFiles?: unknown };

  try {
    const created = createComment({ pageId, parentId: body.parentId, authorId: me.id, body: body.body, withFiles: body.withFiles === true });
    const targets = mentionedIds(created.body).filter((uid) => uid !== me.id);
    if (targets.length) {
      const users = sql
        .prepare(`SELECT id, name, email FROM users WHERE email IS NOT NULL AND id IN (${targets.map(() => "?").join(",")})`)
        .all(...targets) as { id: string; name: string; email: string }[];
      const link = `${appUrl(req)}/p/${pageId}#c-${created.id}`;
      const excerpt = plain(created.body).slice(0, 400);
      for (const u of users) {
        const mail = mentionEmail({ name: u.name, author: me.name, pageTitle: page.title || "Sem título", excerpt, link });
        sendMail(u.email, mail.subject, mail.html, mail.text).catch(() => {});
      }
    }
    return Response.json({ id: created.id }, { status: 201 });
  } catch (e) {
    if (e instanceof CommentError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
