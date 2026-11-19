import type { Metadata } from "next";
import { DatabaseView } from "@/components/DatabaseView";

export const metadata: Metadata = { title: "Documentos" };

export default function Page() {
  return <DatabaseView db="documentos" />;
}
