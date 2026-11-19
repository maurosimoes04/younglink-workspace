import { AdminError, deleteUser, updateUser } from "@/lib/admin";
import { generatePassword, withAdmin } from "@/lib/auth";

const fail = (e: unknown) => {
  if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
  throw e;
};

export const PATCH = withAdmin(async (admin, req: Request, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const generated = body.generatePassword === true ? generatePassword() : null;
  try {
    updateUser(admin.id, id, {
      name: body.name,
      email: body.email,
      isAdmin: body.isAdmin,
      revokeSessions: body.revokeSessions,
      password: generated ?? body.password,
    });
    return Response.json({ ok: true, generatedPassword: generated });
  } catch (e) {
    return fail(e);
  }
});

export const DELETE = withAdmin(async (admin, _req: Request, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const { id } = await ctx.params;
  try {
    deleteUser(admin.id, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e);
  }
});
