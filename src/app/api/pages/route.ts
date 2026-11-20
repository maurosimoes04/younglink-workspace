import { connection, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { commentCounts } from "@/lib/comments";
import { createPage, listPages, type PagePatch } from "@/lib/db";
import { isDbId } from "@/lib/schema";

const isDbOrPage = (x: string | null): x is string => x === "page" || (!!x && isDbId(x));

export const GET = withAuth(async (req: NextRequest) => {
  await connection();
  const db = req.nextUrl.searchParams.get("db");
  if (!isDbOrPage(db)) return Response.json({ error: "db inválida" }, { status: 400 });
  const counts = commentCounts(db);
  return Response.json(listPages(db).map((p) => (counts.has(p.id) ? { ...p, comments: counts.get(p.id) } : p)));
});

export const POST = withAuth(async (req: Request) => {
  const body = (await req.json()) as PagePatch & { db?: string };
  if (!isDbOrPage(body.db ?? null)) return Response.json({ error: "db inválida" }, { status: 400 });
  const { db, ...patch } = body;
  return Response.json(createPage(db!, patch), { status: 201 });
});
