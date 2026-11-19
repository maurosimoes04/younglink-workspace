import { connection } from "next/server";
import { AdminError, createUser, listAdminUsers, sendInvite } from "@/lib/admin";
import { generatePassword, withAdmin } from "@/lib/auth";
import { appUrl, isMailConfigured } from "@/lib/mail";

export const GET = withAdmin(async () => {
  await connection();
  return Response.json({ users: listAdminUsers(), mailConfigured: isMailConfigured() });
});

export const POST = withAdmin(async (admin, req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; email?: unknown; password?: unknown; isAdmin?: unknown; mode?: unknown };
  const mode = body.mode === "manual" || body.mode === "generate" ? body.mode : "invite";
  const generated = mode === "generate" ? generatePassword() : null;
  try {
    const id = createUser({ ...body, password: mode === "invite" ? null : (generated ?? body.password) });
    const invite = mode === "invite" ? await sendInvite(admin, id, appUrl(req)) : null;
    return Response.json({ id, generatedPassword: generated, invite }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
});
