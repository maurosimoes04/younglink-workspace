import { connection } from "next/server";
import { withAuth } from "@/lib/auth";
import { archivePage, getPage, getTitles, updatePage, type PagePatch } from "@/lib/db";
import { isDriveConfigured, listFiles } from "@/lib/drive";

export const GET = withAuth(async (_req: Request, ctx: RouteContext<"/api/pages/[id]">) => {
  await connection();
  const { id } = await ctx.params;
  const page = getPage(id);
  if (!page) return Response.json({ error: "Página não encontrada" }, { status: 404 });
  const relIds = Object.values(page.props).flatMap((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []));
  const parent = page.parent_id ? getTitles([page.parent_id]) : [];
  return Response.json({ ...page, refs: getTitles([...relIds, ...parent.map((p) => p.id)]), files: listFiles(id), driveEnabled: isDriveConfigured() });
});

export const PATCH = withAuth(async (req: Request, ctx: RouteContext<"/api/pages/[id]">) => {
  const { id } = await ctx.params;
  const patch = (await req.json()) as PagePatch;
  const page = updatePage(id, patch);
  if (!page) return Response.json({ error: "Página não encontrada" }, { status: 404 });
  return Response.json(page);
});

export const DELETE = withAuth(async (_req: Request, ctx: RouteContext<"/api/pages/[id]">) => {
  const { id } = await ctx.params;
  return Response.json({ unblocked: archivePage(id) });
});
