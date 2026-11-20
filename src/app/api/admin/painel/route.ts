import { connection } from "next/server";
import { withAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/mail";
import { createPanelLink, listPanelLinks } from "@/lib/painel";

export const GET = withAdmin(async () => {
  await connection();
  return Response.json(listPanelLinks());
});

export const POST = withAdmin(async (admin, req: Request) => {
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  const token = createPanelLink(name, admin.id);
  return Response.json({ url: `${appUrl(req)}/painel?k=${token}` }, { status: 201 });
});
