import { connection, type NextRequest } from "next/server";
import { checkPanelToken, panelItems } from "@/lib/painel";

export async function GET(req: NextRequest) {
  await connection();
  if (!checkPanelToken(req.nextUrl.searchParams.get("k")))
    return Response.json({ error: "Este link do painel não é válido ou foi revogado." }, { status: 401 });
  return Response.json({ items: panelItems(), now: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
