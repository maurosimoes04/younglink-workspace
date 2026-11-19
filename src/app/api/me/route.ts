import { connection } from "next/server";
import { currentUser, unauthorized } from "@/lib/auth";

export async function GET() {
  await connection();
  const user = await currentUser();
  return user ? Response.json(user) : unauthorized();
}
