import { connection } from "next/server";
import { currentUser, unauthorized } from "@/lib/auth";
import { isDriveConfigured } from "@/lib/drive";

export async function GET() {
  await connection();
  const user = await currentUser();
  return user ? Response.json({ ...user, driveEnabled: isDriveConfigured() }) : unauthorized();
}
