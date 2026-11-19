"use client";

import "@blocknote/mantine/style.css";
import { pt } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useSyncExternalStore } from "react";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribe = (cb: () => void) => {
  const m = darkQuery();
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export default function Editor({
  initialContent,
  initialMarkdown,
  onChange,
}: {
  initialContent: unknown[] | null;
  initialMarkdown: string | null;
  onChange: (blocks: unknown[]) => void;
}) {
  const editor = useCreateBlockNote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: initialContent?.length ? (initialContent as any) : undefined,
    dictionary: pt,
  });
  const dark = useSyncExternalStore(subscribe, () => darkQuery().matches, () => false);

  useEffect(() => {
    if (initialContent?.length || !initialMarkdown) return;
    const blocks = editor.tryParseMarkdownToBlocks(initialMarkdown);
    if (blocks.length) editor.replaceBlocks(editor.document, blocks);
  }, [editor, initialContent, initialMarkdown]);

  return (
    <div className="yl-editor -mx-3 sm:-mx-[54px]">
      <BlockNoteView editor={editor} theme={dark ? "dark" : "light"} onChange={() => onChange(editor.document)} />
    </div>
  );
}
