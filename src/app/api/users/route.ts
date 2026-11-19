import { connection } from "next/server";
import { withAuth } from "@/lib/auth";
import { listUsers } from "@/lib/db";

export const GET = withAuth(async () => {
  await connection();
  return Response.json(listUsers());
});
