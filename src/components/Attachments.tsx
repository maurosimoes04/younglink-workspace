"use client";

import { File as FileIcon, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { removeFile, uploadFile, type StoredFile } from "@/lib/client";
import { Icon } from "./ui";

type Pending = { key: string; name: string; progress: number; error?: string };

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} MB`;
}

function iconFor(mime: string, name: string): LucideIcon {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx?|csv|ods)$/i.test(name)) return FileSpreadsheet;
  if (/presentation|powerpoint/.test(mime) || /\.(pptx?|odp|key)$/i.test(name)) return Presentation;
  if (/pdf|word|document|text/.test(mime) || /\.(pdf|docx?|odt|txt|md)$/i.test(name)) return FileText;
  return FileIcon;
}

const dateFmt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" });

export function Attachments({ pageId, files, enabled }: { pageId: string; files: StoredFile[]; enabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const send = (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      setPending((p) => [...p, { key, name: file.name, progress: 0 }]);
      uploadFile(pageId, file, (progress) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then(() => setPending((p) => p.filter((x) => x.key !== key)))
        .catch((e: Error) => setPending((p) => p.map((x) => (x.key === key ? { ...x, error: e.message } : x))));
    }
  };

  if (!enabled && files.length === 0) return null;

  return (
    <section
      onDragOver={(e) => {
        if (!enabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!enabled || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        send(e.dataTransfer.files);
      }}
      className={`mt-6 rounded-2xl border p-3 transition-colors ${dragOver ? "border-accent-fg bg-accent-soft" : "border-line"}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <h3 className="text-[11px] font-bold tracking-widest text-faint uppercase">
          Ficheiros {files.length > 0 && <span className="ml-1 font-semibold">{files.length}</span>}
        </h3>
        {enabled && (
          <>
            <button onClick={() => input.current?.click()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-fg hover:bg-hover">
              <Icon name="plus" className="h-3.5 w-3.5" /> Carregar
            </button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) send(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <div className="flex flex-col">
        {files.map((f) => {
          const Ico = iconFor(f.mime, f.name);
          return (
            <div key={f.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-hover">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
                <Ico className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{f.name}</span>
                <span className="block truncate text-xs text-muted">
                  {formatSize(f.size)} · {f.uploader_name ? `${f.uploader_name.split(" ")[0]}, ` : ""}
                  {dateFmt.format(new Date(f.created_at)).replace(".", "")}
                </span>
              </a>
              <a href={`/api/files/${f.id}?download`} aria-label={`Descarregar ${f.name}`} className="rounded-lg p-1.5 text-muted hover:bg-active hover:text-fg">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
                </svg>
              </a>
              {enabled && (
                <button
                  aria-label={`Apagar ${f.name}`}
                  onClick={async () => {
                    if (!confirm(`Apagar "${f.name}"? O ficheiro vai para o lixo do Google Drive (recuperável durante 30 dias).`)) return;
                    try {
                      await removeFile(pageId, f.id);
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  }}
                  className="rounded-lg p-1.5 text-muted opacity-100 hover:bg-active hover:text-[#dc2626] sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Icon name="trash" />
                </button>
              )}
            </div>
          );
        })}

        {pending.map((p) => (
          <div key={p.key} className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hover text-muted">
              <FileIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              {p.error ? (
                <span className="flex items-center gap-2 text-xs text-[#dc2626]">
                  {p.error}
                  <button onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))} className="underline">
                    Fechar
                  </button>
                </span>
              ) : (
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-active">
                  <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(4, p.progress * 100)}%` }} />
                </span>
              )}
            </span>
          </div>
        ))}

        {files.length === 0 && pending.length === 0 && (
          <button
            onClick={() => input.current?.click()}
            className="mt-1 rounded-xl border border-dashed border-line px-3 py-5 text-center text-sm text-faint hover:border-accent-fg hover:text-muted"
          >
            Arrasta ficheiros para aqui ou clica para carregar. Ficam guardados no Google Drive.
          </button>
        )}
      </div>
    </section>
  );
}
