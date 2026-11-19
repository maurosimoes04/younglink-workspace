import { AdminError, sendInvite } from "@/lib/admin";
import { withAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/mail";

export const POST = withAdmin(async (admin, req: Request, ctx: RouteContext<"/api/admin/users/[id]/invite">) => {
  const { id } = await ctx.params;
  try {
    return Response.json(await sendInvite(admin, id, appUrl(req)));
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
});
