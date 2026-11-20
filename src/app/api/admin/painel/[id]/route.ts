import { withAdmin } from "@/lib/auth";
import { revokePanelLink } from "@/lib/painel";

export const DELETE = withAdmin(async (_admin, _req: Request, ctx: RouteContext<"/api/admin/painel/[id]">) => {
  const { id } = await ctx.params;
  revokePanelLink(id);
  return new Response(null, { status: 204 });
});
