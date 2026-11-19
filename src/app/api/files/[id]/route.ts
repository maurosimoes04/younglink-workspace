import { Readable } from "node:stream";
import { withAuth } from "@/lib/auth";
import { deleteFile, getFile, streamFile } from "@/lib/drive";

const ACTIVE_CONTENT = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)/i;

export const GET = withAuth(async (req: Request, ctx: RouteContext<"/api/files/[id]">) => {
  const { id } = await ctx.params;
  const f = getFile(id);
  if (!f) return Response.json({ error: "Ficheiro não encontrado." }, { status: 404 });
  const download = new URL(req.url).searchParams.has("download") || ACTIVE_CONTENT.test(f.mime);
  try {
    const stream = await streamFile(f.drive_id);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "content-type": ACTIVE_CONTENT.test(f.mime) ? "application/octet-stream" : f.mime,
        "content-length": String(f.size),
        "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("Falha ao ler do Drive:", (e as Error).message);
    return Response.json({ error: "Não foi possível abrir o ficheiro no Google Drive." }, { status: 502 });
  }
});

export const DELETE = withAuth(async (_req: Request, ctx: RouteContext<"/api/files/[id]">) => {
  const { id } = await ctx.params;
  try {
    await deleteFile(id);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("Falha ao apagar do Drive:", (e as Error).message);
    return Response.json({ error: "Não foi possível apagar no Google Drive." }, { status: 502 });
  }
});
