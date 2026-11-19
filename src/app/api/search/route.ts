import { connection, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { searchPages } from "@/lib/db";

export const GET = withAuth(async (req: NextRequest) => {
  await connection();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json([]);
  return Response.json(searchPages(q));
});
