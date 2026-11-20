import { requireUser, Unauthorized, unauthorized } from "@/lib/auth";
import { commentAuthor, CommentError } from "@/lib/comments";
import { getPage } from "@/lib/db";
import { isDriveConfigured, MAX_UPLOAD_BYTES, uploadFile } from "@/lib/drive";

const folderName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 100) || "Geral";
const fileName = (s: string) => s.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 200) || "ficheiro";

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Unauthorized) return unauthorized();
    throw e;
  }
  if (!isDriveConfigured()) return Response.json({ error: "O Google Drive ainda não está configurado neste servidor." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const pageId = form?.get("pageId");
  const commentId = form?.get("commentId");
  if (!(file instanceof File) || typeof pageId !== "string") return Response.json({ error: "Pedido inválido." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "O ficheiro está vazio." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "O ficheiro tem mais de 50 MB." }, { status: 413 });

  const page = getPage(pageId);
  if (!page) return Response.json({ error: "Página não encontrada." }, { status: 404 });
  const tag = (page.props.projeto ?? page.props.etiqueta) as string | undefined;
  if (typeof commentId === "string" && commentId) {
    try {
      const c = commentAuthor(commentId);
      if (c.page_id !== pageId || c.author_id !== user.id) return Response.json({ error: "Só podes anexar ficheiros aos teus comentários." }, { status: 403 });
    } catch (e) {
      if (e instanceof CommentError) return Response.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }

  try {
    const stored = await uploadFile({
      pageId,
      commentId: typeof commentId === "string" && commentId ? commentId : null,
      folder: folderName(tag ?? "Geral"),
      name: fileName(file.name),
      mime: file.type || "application/octet-stream",
      buffer: Buffer.from(await file.arrayBuffer()),
      userId: user.id,
    });
    return Response.json(stored, { status: 201 });
  } catch (e) {
    console.error("Falha no upload para o Drive:", (e as Error).message);
    return Response.json({ error: "Não foi possível guardar no Google Drive." }, { status: 502 });
  }
}
